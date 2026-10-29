create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email)) and char_length(email) between 3 and 254),
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table public.app_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null
);
create index sessions_expiry_idx on public.app_sessions(expires_at);
create table public.auth_limits (
  key text not null,
  window_start timestamptz not null,
  attempts integer not null default 1,
  primary key(key,window_start)
);
-- PostgreSQL accessed exclusively by the application server. Ownership is checked in the data layer.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,150}$'),
  title text not null check (char_length(trim(title)) between 3 and 120),
  category text not null default 'other' check (category in ('wedding','birthday','graduation','other')),
  timezone text not null default 'America/Lima',
  starts_at timestamptz not null,
  venue_name text not null check (char_length(trim(venue_name)) between 2 and 160),
  venue_address text not null default '' check (char_length(venue_address) <= 300),
  map_url text not null default '' check (map_url = '' or (map_url ~ '^https://' and char_length(map_url) <= 2000)),
  capacity integer check (capacity between 1 and 100000),
  rsvp_open boolean not null default true,
  published_at timestamptz,
  template_key text not null default 'classic' check (template_key = 'classic'),
  primary_color text not null default '#18233B' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color text not null default '#D49D9D' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  message text not null check (char_length(trim(message)) between 3 and 3000),
  cover_path text check (cover_path is null or (
    split_part(cover_path, '/', 1) = owner_id::text and
    split_part(cover_path, '/', 2) = id::text and
    cardinality(string_to_array(cover_path, '/')) = 3 and
    split_part(cover_path, '/', 3) ~ '^[a-f0-9-]+\.(jpg|png|webp)$'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_owner_created_idx on public.events(owner_id, created_at desc);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_name text not null check (char_length(trim(guest_name)) between 2 and 120),
  guest_email text check (guest_email is null or char_length(guest_email) <= 254),
  attendance boolean not null,
  party_size integer not null check (party_size between 1 and 10),
  note text not null default '' check (char_length(note) <= 500),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique(event_id, idempotency_key)
);
create index rsvps_event_created_idx on public.rsvps(event_id, created_at desc);

create schema if not exists private;
revoke all on schema private from public;

create table private.rsvp_limits (
  window_start timestamptz not null,
  client_hash text not null,
  attempts integer not null default 1,
  primary key(window_start, client_hash)
);



create function public.validate_event_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare confirmed integer;
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.owner_id <> old.owner_id or new.slug <> old.slug or new.id <> old.id then
      raise exception 'Event identity is immutable' using errcode = '23514';
    end if;
    if new.capacity is not null then
      select coalesce(sum(party_size),0) into confirmed from public.rsvps where event_id = new.id and attendance;
      if confirmed > new.capacity then
        raise exception 'Capacity below confirmed attendees' using errcode = '23514';
      end if;
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.validate_event_update() from public;
create trigger event_validation before insert or update on public.events
  for each row execute function public.validate_event_update();

-- Only the database owner (application backend) can execute this function.
create function public.submit_rsvp(
  p_slug text, p_guest_name text, p_guest_email text, p_attendance boolean,
  p_party_size integer, p_note text, p_key uuid, p_client_hash text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ev public.events%rowtype;
  previous public.rsvps%rowtype;
  used_capacity integer;
  attempts_now integer;
  window_now timestamptz := date_trunc('hour', now()) + floor(extract(minute from now()) / 10) * interval '10 minutes';
  new_id uuid;
begin
  if p_key is null or p_attendance is null or p_party_size is null or p_party_size not between 1 and 10
    or p_guest_name is null or char_length(trim(p_guest_name)) not between 2 and 120
    or char_length(coalesce(p_guest_email,'')) > 254 or char_length(coalesce(p_note,'')) > 500
    or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status',400,'error','Datos inválidos.');
  end if;
  delete from private.rsvp_limits where window_start < now() - interval '1 day';
  insert into private.rsvp_limits(window_start, client_hash) values (window_now,p_client_hash)
    on conflict(window_start,client_hash) do update set attempts = private.rsvp_limits.attempts + 1
    returning attempts into attempts_now;
  if attempts_now > 10 then
    return jsonb_build_object('status',429,'error','Demasiados intentos. Espera unos minutos.');
  end if;
  select * into ev from public.events where slug = p_slug for update;
  if not found or ev.published_at is null then
    return jsonb_build_object('status',404,'error','Invitación no disponible.');
  end if;
  select * into previous from public.rsvps where event_id = ev.id and idempotency_key = p_key;
  if found then
    if previous.guest_name = trim(p_guest_name) and coalesce(previous.guest_email,'') = coalesce(p_guest_email,'')
      and previous.attendance = p_attendance and previous.party_size = p_party_size and previous.note = coalesce(p_note,'') then
      return jsonb_build_object('status',200,'id',previous.id,'success',true);
    end if;
    return jsonb_build_object('status',409,'error','Esta respuesta ya fue enviada.');
  end if;
  if not ev.rsvp_open then
    return jsonb_build_object('status',409,'error','Las confirmaciones están cerradas.');
  end if;
  if p_attendance and ev.capacity is not null then
    select coalesce(sum(party_size),0) into used_capacity from public.rsvps where event_id = ev.id and attendance;
    if used_capacity + p_party_size > ev.capacity then
      return jsonb_build_object('status',409,'error','No quedan suficientes cupos. Reduce el número de asistentes.');
    end if;
  end if;
  insert into public.rsvps(event_id,guest_name,guest_email,attendance,party_size,note,idempotency_key)
    values(ev.id,trim(p_guest_name),nullif(p_guest_email,''),p_attendance,p_party_size,coalesce(p_note,''),p_key)
    returning id into new_id;
  return jsonb_build_object('status',201,'id',new_id,'success',true);
end;
$$;
revoke all on function public.submit_rsvp(text,text,text,boolean,integer,text,uuid,text) from public;



create table public.covers (
  event_id uuid primary key references public.events(id) on delete cascade,
  path text not null unique,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  bytes bytea not null check (octet_length(bytes) between 1 and 3145728)
);
revoke all on all tables in schema public from public;
