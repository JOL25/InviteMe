import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  rename,
  unlink,
} from 'node:fs/promises';
// Preserve the runtime-filesystem annotations in the compiler's documented form.
// prettier-ignore
export function localMailDirectory() {
  const root = path.resolve('.local');
  const directory = path.resolve(
    /*turbopackIgnore: true*/
    process.env.PASSWORD_RESET_OUTBOX || path.join(root, 'mail'),
  );
  const relative = path.relative(root, directory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('El buzón debe estar dentro de .local.');
  return directory;
}
export function localRecoveryEnabled() {
  try {
    const url = new URL(
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    );
    return (
      process.env.PASSWORD_RESET_DELIVERY === 'local' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      ['http:', 'https:'].includes(url.protocol)
    );
  } catch {
    return false;
  }
}
// prettier-ignore
export async function localMessages() {
  const directory = localMailDirectory();
  // These are private runtime files, never build-time input or bundled assets.
  await mkdir(/*turbopackIgnore: true*/ directory, {
    recursive: true,
    mode: 0o700,
  });
  const messages = [];
  for (const file of await readdir(/*turbopackIgnore: true*/ directory)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
    try {
      const message = JSON.parse(
        await readFile(
          /*turbopackIgnore: true*/ path.join(
            /*turbopackIgnore: true*/ directory,
            file,
          ),
          'utf8',
        ),
      );
      if (
        typeof message.created_at !== 'string' ||
        !Number.isFinite(Date.parse(message.created_at)) ||
        !Number.isFinite(Date.parse(message.expires_at)) ||
        typeof message.to !== 'string' ||
        !['reset', 'changed'].includes(message.kind) ||
        (message.kind === 'reset' && typeof message.link !== 'string')
      )
        continue;
      if (Date.parse(message.expires_at) <= Date.now()) {
        await unlink(
          /*turbopackIgnore: true*/ path.join(
            /*turbopackIgnore: true*/ directory,
            file,
          ),
        );
        continue;
      }
      messages.push(message);
    } catch {
      /* Ignore an incomplete or malformed local message. */
    }
  }
  return messages.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
/** @param {{to: string, kind: 'reset' | 'changed', link?: string}} input */
// prettier-ignore
export async function writeLocalMessage(input) {
  if (!localRecoveryEnabled())
    throw new Error('La entrega local no está habilitada.');
  const directory = localMailDirectory();
  await localMessages();
  const id = randomUUID();
  const message = {
    id,
    ...input,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
  const temporary = path.join(
    /*turbopackIgnore: true*/ directory,
    `${id}.tmp`,
  );
  await writeFile(
    /*turbopackIgnore: true*/ temporary,
    JSON.stringify(message),
    {
      mode: 0o600,
      flag: 'wx',
    },
  );
  await rename(
    /*turbopackIgnore: true*/ temporary,
    path.join(/*turbopackIgnore: true*/ directory, `${id}.json`),
  );
}
