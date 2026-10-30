import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createBackup, restoreBackup } from './database-backup.mjs';
import { previewEnvironment } from './backup-rules.mjs';
const command = process.argv[2];
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      directory: { type: 'string' },
      backup: { type: 'string' },
      database: { type: 'string' },
      restore: { type: 'string' },
      port: { type: 'string' },
    },
    allowPositionals: false,
  });
  if (command === 'create') {
    if (values.backup || values.database || values.restore || values.port)
      throw new Error('db:backup solo admite --directory.');
    const result = await createBackup({ directory: values.directory });
    console.log(
      `Respaldo creado: ${result.directory}\nIncluye ${result.manifest.tables.length} tablas y la configuración privada de enlaces.`,
    );
    return;
  }
  if (command === 'restore' || command === 'verify') {
    if (
      !values.backup ||
      values.directory ||
      values.restore ||
      values.port ||
      (command === 'verify' && values.database)
    )
      throw new Error(
        'Indica --backup con la carpeta del respaldo. db:restore admite --database con un nombre nuevo.',
      );
    const result = await restoreBackup({
      directory: values.backup,
      database: values.database,
      temporary: command === 'verify',
    });
    console.log(
      command === 'verify'
        ? `Respaldo verificado: ${result.tables} tablas restauradas. La copia temporal y sus roles se eliminaron.`
        : `Base restaurada: ${result.database}\nConfiguración privada: ${result.directory}\nSesiones antiguas cerradas. La base activa no cambió.\nPara probar: npm run db:preview -- --restore "${result.directory}"`,
    );
    return;
  }
  if (command === 'preview') {
    if (!values.restore || values.backup || values.directory || values.database)
      throw new Error(
        'Indica --restore con la carpeta de configuración de la base restaurada.',
      );
    const port = Number(values.port || 3103);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error('El puerto debe estar entre 1024 y 65535.');
    const config = JSON.parse(
      await readFile(
        path.join(path.resolve(values.restore), 'runtime.json'),
        'utf8',
      ),
    );
    const env = previewEnvironment(config, values.restore, port);
    console.log(
      `Vista local de la copia: ${env.NEXT_PUBLIC_SITE_URL}\nDetén antes otros servidores next dev de este proyecto.\nUsa tu contraseña guardada en el respaldo. Ctrl+C detiene esta vista.`,
    );
    const child = spawn(
      process.execPath,
      [
        path.resolve('node_modules/next/dist/bin/next'),
        'dev',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      { env, stdio: 'inherit', windowsHide: true },
    );
    process.exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code) => resolve(code ?? 1));
    });
    return;
  }
  throw new Error('Comando no válido: create, restore, verify o preview.');
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'No se pudo completar la operación.',
  );
  process.exitCode = 1;
}
