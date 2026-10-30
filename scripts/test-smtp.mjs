import { SMTPServer } from 'smtp-server';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
/** @param {string} directory */
export async function startTestSMTP(directory) {
  const readControl = async () => {
    try {
      return JSON.parse(
        await readFile(path.join(directory, 'smtp-control.json'), 'utf8'),
      );
    } catch {
      return {};
    }
  };
  const record = async (message) =>
    writeFile(
      path.join(directory, `${randomUUID()}.json`),
      JSON.stringify(message),
      { mode: 0o600 },
    );
  const server = new SMTPServer({
    name: 'inviteme-smtp.test',
    secure: false,
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    disableReverseLookup: true,
    logger: false,
    size: 256 * 1024,
    socketTimeout: 10000,
    closeTimeout: 1000,
    async onRcptTo(address, _session, callback) {
      try {
        let control = await readControl();
        if (control.rejectRecipient === address.address) {
          await record({ kind: 'rejected', to: [address.address] });
          callback(
            Object.assign(new Error('Rejected by the test receiver'), {
              responseCode: 550,
            }),
          );
          return;
        }
        let remaining = 50;
        if (control.hold) await record({ kind: 'held', to: [address.address] });
        while (control.hold && remaining-- > 0) {
          await setTimeout(100);
          control = await readControl();
        }
        if (control.hold) {
          callback(
            Object.assign(new Error('Test receiver gate timed out'), {
              responseCode: 451,
            }),
          );
          return;
        }
        callback();
      } catch {
        callback(new Error('Test receiver unavailable'));
      }
    },
    onData(stream, session, callback) {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', () =>
        callback(new Error('Test receiver stream error')),
      );
      stream.on('end', () => {
        if (stream.sizeExceeded) {
          callback(
            Object.assign(new Error('Message too large'), {
              responseCode: 552,
            }),
          );
          return;
        }
        void record({
          kind: 'delivered',
          to: session.envelope.rcptTo.map((recipient) => recipient.address),
          raw: Buffer.concat(chunks).toString('utf8'),
        }).then(
          () => callback(),
          () => callback(new Error('Test capture failed')),
        );
      });
    },
  });
  server.on('error', () => {});
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.server.address();
  if (!address || typeof address === 'string')
    throw new Error('SMTP test server did not start');
  return {
    port: address.port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
