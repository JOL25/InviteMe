// Opt-in integration check. Creates disposable users only in the configured
// InviteMe project; cleans up its own records and never prints credentials.
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const base = process.env.INVITEME_TEST_BASE_URL || 'http://localhost:3101';
assert(
  ['localhost', '127.0.0.1'].includes(new URL(base).hostname),
  'Integration API target must be the local InviteMe app.',
);
assert(url && publicKey && secret, 'Configure the local Supabase environment.');
assert(
  process.env.INVITEME_ALLOW_REMOTE_TESTS === '1',
  'Set INVITEME_ALLOW_REMOTE_TESTS=1 to authorize disposable integration fixtures.',
);
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function cookieClient() {
  const jar = new Map();
  const client = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) =>
        values.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  return {
    client,
    header: () =>
      [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
  };
}
const ownerCookies = cookieClient();
const strangerCookies = cookieClient();
const owner = ownerCookies.client;
const stranger = strangerCookies.client;
const anonymous = createClient(url, publicKey, {
  auth: { persistSession: false },
});
const users = [];
const events = [];
const covers = [];
let passed = 0;
function check(condition, label) {
  assert(condition, label);
  passed++;
  console.log(`PASS ${label}`);
}
async function newUser(client) {
  const email = `inviteme-test-${randomUUID()}@example.invalid`;
  const password = `${randomUUID()}Aa9!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error)
    console.error('Auth fixture error:', {
      message: error.message,
      status: error.status,
      code: error.code,
    });
  assert(!error && data.user, 'Could not create disposable Auth fixture.');
  users.push(data.user.id);
  const result = await client.auth.signInWithPassword({ email, password });
  check(
    !result.error && result.data.user?.id === data.user.id,
    'real Auth password login',
  );
  return data.user.id;
}
try {
  const ownerId = await newUser(owner);
  await newUser(stranger);
  const slug = `test-${randomUUID()}`;
  const created = await owner
    .from('events')
    .insert({
      owner_id: ownerId,
      slug,
      title: 'Celebración de prueba',
      starts_at: '2027-06-18T22:00:00Z',
      venue_name: 'Lima',
      message: 'Una prueba temporal.',
      capacity: 1,
    })
    .select()
    .single();
  assert(!created.error && created.data, 'Could not create owner event.');
  const event = created.data;
  events.push(event.id);
  const emptyExport = await fetch(`${base}/api/events/${event.id}/export`, {
    headers: { Cookie: ownerCookies.header() },
  });
  check(
    emptyExport.status === 200 &&
      (await emptyExport.text()).trimEnd().split('\r\n').length === 1,
    'empty event CSV contains only its header',
  );
  check(
    (await fetch(`${base}/i/${slug}`)).status === 404,
    'draft is not public',
  );
  const otherRead = await stranger
    .from('events')
    .select('id')
    .eq('id', event.id);
  check(
    !otherRead.error && otherRead.data.length === 0,
    'stranger cannot read owner event',
  );
  const otherWrite = await stranger
    .from('events')
    .update({ title: 'Intrusión' })
    .eq('id', event.id)
    .select('id');
  check(
    !otherWrite.error && otherWrite.data.length === 0,
    'stranger cannot update owner event',
  );
  const anonRead = await anonymous.from('events').select('id');
  check(Boolean(anonRead.error), 'anonymous table access denied');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQxkAAAAASUVORK5CYII=',
    'base64',
  );
  const cover = `${ownerId}/${event.id}/${randomUUID()}.png`;
  const uploaded = await owner.storage
    .from('covers')
    .upload(cover, png, { contentType: 'image/png' });
  assert(!uploaded.error, 'Owner cover upload failed.');
  covers.push(cover);
  check(!uploaded.error, 'owner can upload private cover');
  const otherImage = await stranger.storage
    .from('covers')
    .createSignedUrl(cover, 60);
  check(Boolean(otherImage.error), 'stranger cannot sign owner cover');
  const ownImage = await owner.storage
    .from('covers')
    .createSignedUrl(cover, 60);
  check(
    Boolean(ownImage.data?.signedUrl) && !ownImage.error,
    'owner can sign own cover',
  );
  const published = await owner
    .from('events')
    .update({ published_at: new Date().toISOString(), cover_path: cover })
    .eq('id', event.id);
  assert(!published.error, 'Could not publish fixture.');
  const publicPage = await fetch(`${base}/i/${slug}`);
  const html = await publicPage.text();
  check(
    publicPage.status === 200 && html.includes('Celebración de prueba'),
    'published invitation renders through real backend',
  );
  check(
    !html.includes('guest_email') && !html.includes(secret),
    'public HTML omits guest fields and server key',
  );
  const origin = new URL(base).origin;
  const fixtureAddress = `192.0.2.${randomInt(1, 255)}`;
  const rsvp = (key, name) => ({
    slug,
    guestName: name,
    guestEmail: '',
    attendance: true,
    partySize: 1,
    note: '',
    idempotencyKey: key,
    website: '',
  });
  async function send(body) {
    const response = await fetch(`${base}/api/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'x-forwarded-for': fixtureAddress,
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  const keys = [randomUUID(), randomUUID()];
  const payloads = [
    rsvp(keys[0], 'Primera persona'),
    rsvp(keys[1], 'Segunda persona'),
  ];
  const pair = await Promise.all(payloads.map(send));
  check(
    pair.filter((row) => row.status === 201).length === 1 &&
      pair.filter((row) => row.status === 409).length === 1,
    'two simultaneous RSVP requests cannot overbook last seat',
  );
  const winningIndex = pair.findIndex((row) => row.status === 201);
  const retry = await send(payloads[winningIndex]);
  check(
    retry.status === 200 && retry.body.id === pair[winningIndex].body.id,
    'HTTP retry returns same RSVP without duplication',
  );
  const no = await send({
    ...rsvp(randomUUID(), 'No asistirá'),
    attendance: false,
  });
  check(no.status === 201, 'decline does not consume capacity');
  const summary = await owner.rpc('guest_summary', { p_event_id: event.id });
  check(
    !summary.error &&
      summary.data?.[0]?.attendee_count === 1 &&
      summary.data?.[0]?.no_count === 1,
    'owner aggregate matches attendance',
  );
  const otherGuests = await stranger
    .from('rsvps')
    .select('*')
    .eq('event_id', event.id);
  check(
    !otherGuests.error && otherGuests.data.length === 0,
    'stranger cannot read guest personal data',
  );
  const lowerCapacity = await owner
    .from('events')
    .update({ capacity: 0 })
    .eq('id', event.id);
  check(Boolean(lowerCapacity.error), 'invalid capacity rejected by database');
  await owner.from('events').update({ rsvp_open: false }).eq('id', event.id);
  check(
    (await send({ ...rsvp(randomUUID(), 'Evento cerrado'), attendance: false }))
      .status === 409,
    'closed RSVP rejects new requests',
  );
  const batch = Array.from({ length: 1000 }, (_, index) => ({
    event_id: event.id,
    guest_name: `CSV prueba ${index}`,
    attendance: false,
    party_size: 1,
    note: '',
    idempotency_key: randomUUID(),
    created_at: new Date(
      Date.now() + (index === 999 ? 60000 : 0),
    ).toISOString(),
  }));
  const seeded = await admin.from('rsvps').insert(batch);
  assert(!seeded.error, 'CSV fixture batch failed.');
  const exportUrl = `${base}/api/events/${event.id}/export`;
  const ownCsv = await fetch(exportUrl, {
    headers: { Cookie: ownerCookies.header() },
  });
  const csvText = await ownCsv.text();
  check(
    ownCsv.status === 200 && csvText.trimEnd().split('\r\n').length === 1003,
    'SSR CSV exports all 1002 committed replies despite clock skew and API page limit',
  );
  const deniedCsv = await fetch(exportUrl, {
    headers: { Cookie: strangerCookies.header() },
  });
  check(deniedCsv.status === 404, 'other owner cannot export CSV');
  check(
    (await fetch(exportUrl)).status === 401,
    'anonymous CSV request requires login',
  );
  const privateEdit = await fetch(`${base}/dashboard/events/${event.id}/edit`, {
    headers: { Cookie: ownerCookies.header() },
  });
  check(
    privateEdit.status === 200 &&
      (await privateEdit.text()).includes('Celebración de prueba'),
    'SSR cookie session authorizes owner edit screen',
  );
  await owner.from('events').update({ published_at: null }).eq('id', event.id);
  check(
    (await fetch(`${base}/i/${slug}`)).status === 404,
    'unpublishing immediately hides invitation',
  );
  console.log(`Remote verification passed: ${passed} checks.`);
} finally {
  if (covers.length) await admin.storage.from('covers').remove(covers);
  for (const id of events) {
    const result = await admin.from('events').delete().eq('id', id);
    assert(!result.error, 'Fixture event cleanup failed.');
  }
  for (const client of [owner, stranger]) await client.auth.signOut();
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id);
    assert(!result.error, 'Disposable Auth fixture cleanup failed.');
  }
  console.log('Disposable records removed.');
}
