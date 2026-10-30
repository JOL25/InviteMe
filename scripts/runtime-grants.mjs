// No GRANT ALL: new tables/functions stay inaccessible until explicitly allowed.
export async function grantRuntime(client, role) {
  const quoted = '"' + role.replaceAll('"', '""') + '"';
  const { rows } = await client.query(
    `select r.rolsuper,r.rolbypassrls,pg_has_role($1,c.relowner,'MEMBER') owns_tables
     from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
     where r.rolname=$1 and n.nspname='public' and c.relname='events'`,
    [role],
  );
  if (
    !rows[0] ||
    rows[0].rolsuper ||
    rows[0].rolbypassrls ||
    rows[0].owns_tables
  )
    throw new Error(
      'El usuario de aplicación debe ser distinto al dueño, sin superusuario ni BYPASSRLS.',
    );
  await client.query(`grant usage on schema public,private to ${quoted}`);
  await client.query(
    `grant select,insert,update,delete on public.events,public.covers to ${quoted}`,
  );
  await client.query(`grant select on public.rsvps to ${quoted}`);
  await client.query(
    `grant select,insert,update,delete on public.event_photos to ${quoted}`,
  );
  for (const fn of [
    'private.actor_id()',
    'private.login_user(text)',
    'private.register_user(text,text)',
    'private.session_user(text)',
    'private.open_session(uuid,text)',
    'private.close_session(text)',
    'private.auth_attempt(text)',
    'public.public_invitation(text)',
    'public.read_cover(uuid)',
    'public.invitation_photos(text)',
    'public.read_gallery_photo(uuid)',
    'public.submit_rsvp(text,text,text,boolean,integer,text,uuid,text)',
  ])
    await client.query(`grant execute on function ${fn} to ${quoted}`);
}
