-- The migration owner owns tables/functions. The runtime role is NOT a member
-- of it and gets only explicit grants from scripts/runtime-grants.mjs.
create function private.actor_id() returns uuid
language sql stable security invoker set search_path = '' as $$
  select nullif(current_setting('app.user_id',true),'')::uuid;
$$;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.covers enable row level security;
alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.auth_limits enable row level security;
alter table private.rsvp_limits enable row level security;
alter table public.app_migrations enable row level security;

create policy events_owner on public.events for all
  using(owner_id=(select private.actor_id()))
  with check(owner_id=(select private.actor_id()));
create policy replies_owner on public.rsvps for select using (
  exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select private.actor_id()))
);
create policy covers_owner on public.covers for all
  using(exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select private.actor_id())))
  with check(exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select private.actor_id())));

-- Narrow backend functions bypass owner RLS intentionally. No browser receives
-- database credentials. All names are qualified and search_path is empty.
alter function public.submit_rsvp(text,text,text,boolean,integer,text,uuid,text) security definer;
create function public.public_invitation(p_slug text) returns table(
  slug text,title text,category text,timezone text,starts_at timestamptz,
  venue_name text,venue_address text,map_url text,rsvp_open boolean,
  primary_color text,accent_color text,message text,cover_path text
) language sql stable security definer set search_path = '' as $$
  select e.slug,e.title,e.category,e.timezone,e.starts_at,e.venue_name,
    e.venue_address,e.map_url,e.rsvp_open,e.primary_color,e.accent_color,e.message,e.cover_path
  from public.events e where e.slug=p_slug and e.published_at is not null;
$$;
create function public.read_cover(p_id uuid) returns table(bytes bytea,content_type text)
language sql stable security definer set search_path = '' as $$
  select c.bytes,c.content_type from public.covers c join public.events e on e.id=c.event_id
  where e.id=p_id and c.path=e.cover_path
    and (e.published_at is not null or e.owner_id=private.actor_id());
$$;

create function private.login_user(p_email text) returns table(id uuid,password_hash text)
language sql stable security definer set search_path = '' as $$
  select u.id,u.password_hash from public.app_users u where u.email=p_email;
$$;
create function private.register_user(p_email text,p_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if p_hash !~ '^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$' then
    raise exception 'Invalid password hash' using errcode='23514';
  end if;
  insert into public.app_users(email,password_hash) values(p_email,p_hash) returning id into new_id;
  return new_id;
end;
$$;
create function private.session_user(p_hash text) returns table(id uuid,email text)
language sql stable security definer set search_path = '' as $$
  select u.id,u.email from public.app_users u join public.app_sessions s on s.user_id=u.id
  where s.token_hash=p_hash and s.expires_at>now();
$$;
create function private.open_session(p_user uuid,p_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.app_sessions where expires_at<=now();
  insert into public.app_sessions(token_hash,user_id,expires_at) values(p_hash,p_user,now()+interval '7 days');
end;
$$;
create function private.close_session(p_hash text) returns void
language sql security definer set search_path = '' as $$
  delete from public.app_sessions where token_hash=p_hash;
$$;
create function private.auth_attempt(p_key text) returns integer
language plpgsql security definer set search_path = '' as $$
declare attempts_now integer;
begin
  delete from public.auth_limits where window_start<now()-interval '1 day';
  insert into public.auth_limits(key,window_start)
    values(p_key,date_bin(interval '10 minutes',now(),timestamptz '2000-01-01'))
    on conflict(key,window_start) do update set attempts=public.auth_limits.attempts+1
    returning attempts into attempts_now;
  return attempts_now;
end;
$$;
revoke all on all functions in schema private from public;
revoke all on function public.public_invitation(text),public.read_cover(uuid) from public;
