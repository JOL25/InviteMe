import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, beforeEach, afterEach, afterAll, it, expect } from 'vitest';
import { grantRuntime } from '../../scripts/runtime-grants.mjs';
let db: PGlite;
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const oldPassword = `scrypt-v1$${'1'.repeat(32)}$${'2'.repeat(128)}`;
const newPassword = `scrypt-v1$${'3'.repeat(32)}$${'4'.repeat(128)}`;
const hash = 'a'.repeat(64),
  secondHash = 'b'.repeat(64),
  client = 'c'.repeat(64),
  emailKey = 'd'.repeat(64);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    'create table app_migrations(name text primary key,checksum text not null); create role app_runtime nosuperuser nobypassrls',
  );
  for (const file of readdirSync('database/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(`database/migrations/${file}`, 'utf8'));
  await grantRuntime(db, 'app_runtime');
  await db.query(
    "insert into app_users(id,email,password_hash) values($1,'owner@test.local',$3),($2,'other@test.local',$3)",
    [user, other, oldPassword],
  );
  await db.query(
    "insert into app_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '7 days'),($3,$2,now()+interval '7 days'),($4,$5,now()+interval '7 days')",
    ['1'.repeat(64), user, '2'.repeat(64), '3'.repeat(64), other],
  );
});
beforeEach(async () => {
  await db.exec('begin');
});
afterEach(async () => {
  await db.exec('rollback; reset role');
});
afterAll(async () => {
  await db?.close();
});
async function runtime<T>(work: () => Promise<T>) {
  await db.exec('set role app_runtime');
  try {
    return await work();
  } finally {
    await db.exec('reset role').catch(() => {});
  }
}
async function issue(
  token = hash,
  address = client,
  key = emailKey,
  email = 'owner@test.local',
) {
  return runtime(
    async () =>
      (
        await db.query<{ result: boolean }>(
          'select private.issue_password_reset($1,$2,$3,$4) result',
          [email, token, address, key],
        )
      ).rows[0].result,
  );
}
async function consume(token = hash, password = newPassword) {
  return runtime(
    async () =>
      (
        await db.query<{ result: string | null }>(
          'select private.consume_password_reset($1,$2) result',
          [token, password],
        )
      ).rows[0].result,
  );
}
it('la solicitud no modifica contraseñas ni sesiones y guarda solo el hash durante 30 minutos', async () => {
  expect(await issue()).toBe(true);
  expect(
    (await db.query('select count(*)::int count from app_sessions')).rows,
  ).toEqual([{ count: 3 }]);
  expect(
    (await db.query('select password_hash from app_users where id=$1', [user]))
      .rows,
  ).toEqual([{ password_hash: oldPassword }]);
  const row = (
    await db.query<{ token_hash: string; active: boolean }>(
      "select token_hash,expires_at>now()+interval '29 minutes' active from private.password_resets",
    )
  ).rows[0];
  expect(row).toEqual({ token_hash: hash, active: true });
  expect(
    await issue(secondHash, client, 'e'.repeat(64), 'unknown@test.local'),
  ).toBe(false);
});
it('un enlace nuevo sustituye al anterior y un enlace caducado no cambia nada', async () => {
  await issue();
  await issue(secondHash);
  expect(await consume(hash)).toBeNull();
  await db.query(
    "update private.password_resets set expires_at=now()-interval '1 second'",
  );
  expect(await consume(secondHash)).toBeNull();
  expect(
    (await db.query('select count(*)::int count from app_sessions')).rows,
  ).toEqual([{ count: 3 }]);
});
it('el consumo cambia la contraseña, revoca todas las sesiones propias y funciona una sola vez', async () => {
  await issue();
  expect(await consume()).toBe('owner@test.local');
  expect(await consume()).toBeNull();
  expect(
    (await db.query('select password_hash from app_users where id=$1', [user]))
      .rows,
  ).toEqual([{ password_hash: newPassword }]);
  expect((await db.query('select user_id from app_sessions')).rows).toEqual([
    { user_id: other },
  ]);
  expect(
    (await db.query('select * from private.password_resets')).rows,
  ).toHaveLength(0);
});
it('el inicio de sesión pendiente con la contraseña antigua no sobrevive al cambio', async () => {
  await issue();
  await consume();
  const open = (password: string) =>
    runtime(
      async () =>
        (
          await db.query<{ allowed: boolean }>(
            'select private.open_checked_session($1,$2,$3) allowed',
            [user, 'f'.repeat(64), password],
          )
        ).rows[0].allowed,
    );
  expect(await open(oldPassword)).toBe(false);
  expect(await open(newPassword)).toBe(true);
});
it('limita solicitudes por correo y por IP sin crear tokens para cuentas desconocidas', async () => {
  expect(await issue()).toBe(true);
  expect(await issue(secondHash)).toBe(true);
  expect(await issue('e'.repeat(64))).toBe(true);
  expect(await issue('f'.repeat(64))).toBe(false);
  for (let i = 0; i < 7; i++)
    await issue(
      hash,
      client,
      i.toString(16).padStart(64, '0'),
      'unknown@test.local',
    );
  expect(await issue(hash, client, '9'.repeat(64), 'other@test.local')).toBe(
    false,
  );
  expect(
    (await db.query('select count(*)::int count from private.password_resets'))
      .rows,
  ).toEqual([{ count: 1 }]);
});
it('limita intentos de consumo y rechaza hashes o contraseñas mal formados', async () => {
  await issue();
  expect(await consume('invalid')).toBeNull();
  expect(await consume(hash, 'not-scrypt')).toBeNull();
  for (let i = 0; i < 10; i++)
    expect(
      (
        await runtime(() =>
          db.query<{ allowed: boolean }>(
            'select private.password_reset_attempt($1) allowed',
            [client],
          ),
        )
      ).rows[0].allowed,
    ).toBe(true);
  expect(
    (
      await runtime(() =>
        db.query<{ allowed: boolean }>(
          'select private.password_reset_attempt($1) allowed',
          [client],
        ),
      )
    ).rows[0].allowed,
  ).toBe(false);
});
it('las tablas de recuperación son privadas incluso para el propietario autenticado', async () => {
  await db.exec('set role app_runtime');
  await db.query("select set_config('app.user_id',$1,true)", [user]);
  await expect(
    db.query('select * from private.password_resets'),
  ).rejects.toThrow();
});
it('el runtime ya no puede abrir sesiones mediante la función antigua', async () => {
  await db.exec('set role app_runtime');
  await expect(
    db.query('select private.open_session($1,$2)', [user, hash]),
  ).rejects.toThrow();
});
it('el borrado de una cuenta elimina su enlace de recuperación', async () => {
  await issue();
  await db.query('delete from app_users where id=$1', [user]);
  expect(
    (await db.query('select * from private.password_resets')).rows,
  ).toHaveLength(0);
});
