import 'server-only';
import { Pool, types, type QueryResultRow } from 'pg';

// Preserve microseconds: CSV snapshot boundaries must include the newest RSVP.
types.setTypeParser(1184, (value) =>
  value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'),
);
const globalDb = globalThis as typeof globalThis & { inviteMePool?: Pool };
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error('Falta configurar DATABASE_URL.');
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
  return database().query<T>(sql, values);
}
