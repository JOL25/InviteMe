import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { connectionEnvironment } from './backup-rules.mjs';
export async function pgTool(tool, args, { connection, input, output } = {}) {
  if (!['pg_dump', 'pg_restore'].includes(tool))
    throw new Error('Herramienta PostgreSQL no permitida.');
  const env = connection
    ? connectionEnvironment(connection).env
    : { ...process.env };
  let executable = path.join(
    process.env.PG_BIN ||
      (process.platform === 'win32'
        ? 'C:/Program Files/PostgreSQL/17/bin'
        : '/usr/lib/postgresql/17/bin'),
    tool + (process.platform === 'win32' ? '.exe' : ''),
  );
  let parameters = args;
  const container = process.env.INVITEME_PG_CONTAINER;
  if (container) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(container))
      throw new Error('Contenedor PostgreSQL inválido.');
    executable = 'docker';
    parameters = [
      'exec',
      '-i',
      ...Object.keys(env)
        .filter((key) => key.startsWith('PG'))
        .flatMap((key) => ['--env', key]),
      container,
      tool,
      ...args,
    ];
  }
  const child = spawn(executable, parameters, {
    env,
    windowsHide: true,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let text = '';
  child.stderr.resume(); // Tool errors may contain rows or connection details; do not print them.
  const completion = new Promise((resolve, reject) => {
    child.on('error', () =>
      reject(
        new Error(
          `No se pudo ejecutar ${tool}. Revisa PG_BIN o la instalación de PostgreSQL 17.`,
        ),
      ),
    );
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${tool} falló. Comprueba permisos, versión y conexión (código ${code}).`,
            ),
          ),
    );
  });
  const operations = [completion];
  if (input) operations.push(pipeline(createReadStream(input), child.stdin));
  else child.stdin.end();
  if (output)
    operations.push(
      pipeline(
        child.stdout,
        createWriteStream(output, { flags: 'wx', mode: 0o600 }),
      ),
    );
  else
    child.stdout.on('data', (chunk) => {
      text += chunk.toString();
      if (text.length > 2 * 1024 * 1024) child.kill();
    });
  try {
    await Promise.all(operations);
  } catch {
    child.kill();
    await Promise.allSettled(operations);
    throw new Error(
      `No se completó ${tool}. Comprueba permisos, versión y conexión.`,
    );
  }
  return text;
}
export async function requirePostgres17() {
  for (const tool of ['pg_dump', 'pg_restore'])
    if (!/\b17\./.test(await pgTool(tool, ['--version'])))
      throw new Error(
        'Usa pg_dump y pg_restore de PostgreSQL 17 mediante PG_BIN.',
      );
}
