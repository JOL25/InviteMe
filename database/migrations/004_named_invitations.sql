create table public.event_guests (
  id uuid primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check(char_length(trim(name)) between 2 and 120),
  email text check(email is null or char_length(email)<=254),
  max_party_size integer not null default 1 check(max_party_size between 1 and 10),
  token_nonce uuid not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(event_id,id)
);
create index event_guests_event_created_idx on public.event_guests(event_id,created_at,id);
alter table public.event_guests enable row level security;
revoke all on public.event_guests from public;
create policy guest_list_owner on public.event_guests for all
  using(exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select private.actor_id())))
  with check(exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select private.actor_id())));

alter table public.rsvps add column guest_id uuid;
alter table public.rsvps add constraint one_reply_per_guest unique(guest_id);
alter table public.rsvps add constraint reply_matches_guest_event
  foreign key(event_id,guest_id) references public.event_guests(event_id,id)
  on delete no action deferrable initially deferred;

create function public.validate_guest_update() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.id<>old.id or new.event_id<>old.event_id then
    raise exception 'Guest identity is immutable' using errcode='23514';
  end if;
  if (new.name is distinct from old.name or new.email is distinct from old.email or new.max_party_size<>old.max_party_size)
    and exists(select 1 from public.rsvps r where r.guest_id=old.id) then
    raise exception 'Guest already replied' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger guest_validation before update on public.event_guests
  for each row execute function public.validate_guest_update();
revoke all on function public.validate_guest_update() from public;

-- A bearer link reveals only its own name/quota/reply, never contact emails or
-- a list of guests. Tokens are hashed before reaching SQL.
create function public.resolve_guest_invitation(p_slug text,p_hash text)
returns table(id uuid,name text,max_party_size integer,attendance boolean,party_size integer)
language sql stable security definer set search_path='' as $$
  select g.id,g.name,g.max_party_size,r.attendance,r.party_size
  from public.event_guests g join public.events e on e.id=g.event_id
  left join public.rsvps r on r.guest_id=g.id
  where e.slug=p_slug and e.published_at is not null and g.token_hash=p_hash and g.revoked_at is null;
$$;
revoke all on function public.resolve_guest_invitation(text,text) from public;

create function public.submit_guest_rsvp(
  p_slug text,p_token_hash text,p_guest_email text,p_attendance boolean,
  p_party_size integer,p_note text,p_key uuid,p_client_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  ev public.events%rowtype;
  invited public.event_guests%rowtype;
  previous public.rsvps%rowtype;
  used_capacity integer;
  attempts_now integer;
  window_now timestamptz := date_trunc('hour',now())+floor(extract(minute from now())/10)*interval '10 minutes';
  new_id uuid;
begin
  if p_key is null or p_attendance is null or p_party_size is null or p_party_size not between 1 and 10
    or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    or char_length(coalesce(p_guest_email,''))>254 or char_length(coalesce(p_note,''))>500
    or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status',400,'error','Datos inválidos.');
  end if;
  delete from private.rsvp_limits where window_start<now()-interval '1 day';
  insert into private.rsvp_limits(window_start,client_hash) values(window_now,p_client_hash)
    on conflict(window_start,client_hash) do update set attempts=private.rsvp_limits.attempts+1
    returning attempts into attempts_now;
  if attempts_now>10 then
    return jsonb_build_object('status',429,'error','Demasiados intentos. Espera unos minutos.');
  end if;
  select * into ev from public.events where slug=p_slug for update;
  if not found or ev.published_at is null then
    return jsonb_build_object('status',404,'error','Invitación no disponible.');
  end if;
  select * into invited from public.event_guests
    where event_id=ev.id and token_hash=p_token_hash and revoked_at is null for update;
  if not found then
    return jsonb_build_object('status',404,'error','El enlace individual no está disponible.');
  end if;
  select * into previous from public.rsvps where guest_id=invited.id;
  if found then
    if coalesce(previous.guest_email,'')=coalesce(p_guest_email,'') and previous.attendance=p_attendance
      and previous.party_size=p_party_size and previous.note=coalesce(p_note,'') then
      return jsonb_build_object('status',200,'id',previous.id,'success',true);
    end if;
    return jsonb_build_object('status',409,'error','Este invitado ya respondió.');
  end if;
  if exists(select 1 from public.rsvps where event_id=ev.id and idempotency_key=p_key) then
    return jsonb_build_object('status',409,'error','La clave de esta respuesta ya está utilizada.');
  end if;
  if not ev.rsvp_open then
    return jsonb_build_object('status',409,'error','Las confirmaciones están cerradas.');
  end if;
  if p_attendance and p_party_size>invited.max_party_size then
    return jsonb_build_object('status',409,'error','El número de personas supera el cupo de tu invitación.');
  end if;
  if p_attendance and ev.capacity is not null then
    select coalesce(sum(party_size),0) into used_capacity from public.rsvps where event_id=ev.id and attendance;
    if used_capacity+p_party_size>ev.capacity then
      return jsonb_build_object('status',409,'error','No quedan suficientes cupos. Reduce el número de asistentes.');
    end if;
  end if;
  insert into public.rsvps(event_id,guest_id,guest_name,guest_email,attendance,party_size,note,idempotency_key)
    values(ev.id,invited.id,invited.name,nullif(p_guest_email,''),p_attendance,p_party_size,coalesce(p_note,''),p_key)
    returning id into new_id;
  return jsonb_build_object('status',201,'id',new_id,'success',true);
end;
$$;
revoke all on function public.submit_guest_rsvp(text,text,text,boolean,integer,text,uuid,text) from public;

-- Keep open RSVP backwards compatible without reusing a named response.
create or replace function public.submit_rsvp(
  p_slug text, p_guest_name text, p_guest_email text, p_attendance boolean,
  p_party_size integer, p_note text, p_key uuid, p_client_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
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
    if previous.guest_id is not null then
      return jsonb_build_object('status',409,'error','Esta respuesta corresponde a una invitación individual.');
    end if;
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
