import 'server-only';
import { Pool, types, type QueryResultRow, type PoolClient } from 'pg';

// Preserve microseconds: CSV snapshot boundaries must include the newest RSVP.
types.setTypeParser(1184, (value) =>
  value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'),
);
const globalDb = globalThis as typeof globalThis & {
  inviteMePool?: Pool;
  inviteMeConnection?: string;
  inviteMeRoleCheck?: Promise<void>;
};
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error('Falta configurar DATABASE_URL.');
  if (
    globalDb.inviteMePool &&
    globalDb.inviteMeConnection !== process.env.DATABASE_URL
  ) {
    void globalDb.inviteMePool.end();
    globalDb.inviteMePool = undefined;
    globalDb.inviteMeRoleCheck = undefined;
  }
  globalDb.inviteMeConnection = process.env.DATABASE_URL;
  return (globalDb.inviteMePool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
}
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values: unknown[] = [],
) {
  await checkRuntimeRole();
  return database().query<T>(sql, values);
}
async function checkRuntimeRole() {
  database();
  return (globalDb.inviteMeRoleCheck ??= (async () => {
    const { rows } = await database()
      .query(`select r.rolsuper,r.rolbypassrls,pg_has_role(current_user,c.relowner,'MEMBER') owns_tables
      from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
      where r.rolname=current_user and n.nspname='public' and c.relname='events'`);
    if (
      !rows[0] ||
      rows[0].rolsuper ||
      rows[0].rolbypassrls ||
      rows[0].owns_tables
    )
      throw new Error(
        'DATABASE_URL debe usar el usuario de aplicación con RLS. Ejecuta npm run db:start.',
      );
  })());
}
// The caller supplies identity verified by requireUser/currentUser. SET LOCAL
// lives in this transaction only; success and rollback both clear pooled state.
export async function ownerTransaction<T>(
  ownerId: string | null,
  work: (client: PoolClient) => Promise<T>,
) {
  await checkRuntimeRole();
  const client = await database().connect();
  try {
    await client.query('begin');
    await client.query("select set_config('app.user_id',$1,true)", [
      ownerId ?? '',
    ]);
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
export async function ownerQuery<T extends QueryResultRow = QueryResultRow>(
  ownerId: string | null,
  sql: string,
  values: unknown[] = [],
) {
  return ownerTransaction(ownerId, (client) => client.query<T>(sql, values));
}
export function forOwner(ownerId: string) {
  return <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values: unknown[] = [],
  ) => ownerQuery<T>(ownerId, sql, values);
}
