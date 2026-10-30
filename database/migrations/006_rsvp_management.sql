alter table public.rsvps
  add column management_hash text unique check(management_hash ~ '^[a-f0-9]{64}$'),
  add column revision integer not null default 1 check(revision>0),
  add column updated_at timestamptz not null default now(),
  add column cancelled_at timestamptz;

-- Only a newly created open reply may acquire a management capability. A retry
-- or a legacy idempotency key must never claim an existing response.
create function public.submit_managed_rsvp(
  p_slug text,p_name text,p_email text,p_attendance boolean,p_size integer,
  p_note text,p_key uuid,p_client_hash text,p_management_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if p_management_hash is null or p_management_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status',400,'error','Enlace de gestión inválido.');
  end if;
  result := public.submit_rsvp(p_slug,p_name,p_email,p_attendance,p_size,p_note,p_key,p_client_hash);
  if (result->>'status')::int=201 then
    update public.rsvps set management_hash=p_management_hash where id=(result->>'id')::uuid;
  elsif (result->>'status')::int=200 and not exists(
    select 1 from public.rsvps where id=(result->>'id')::uuid and management_hash=p_management_hash
  ) then
    return jsonb_build_object('status',409,'error','La respuesta ya existe con otro enlace de gestión.');
  end if;
  return result;
end;
$$;
revoke all on function public.submit_managed_rsvp(text,text,text,boolean,integer,text,uuid,text,text) from public;

create function public.resolve_rsvp_management(p_slug text,p_kind text,p_hash text)
returns table(id uuid,guest_name text,guest_email text,attendance boolean,party_size integer,note text,
  revision integer,cancelled boolean,max_party_size integer,rsvp_open boolean)
language sql stable security definer set search_path='' as $$
  select r.id,r.guest_name,coalesce(r.guest_email,''),r.attendance,r.party_size,r.note,
    r.revision,r.cancelled_at is not null,coalesce(g.max_party_size,10),e.rsvp_open
  from public.rsvps r join public.events e on e.id=r.event_id
  left join public.event_guests g on g.id=r.guest_id
  where e.slug=p_slug and e.published_at is not null and (
    (p_kind='open' and r.guest_id is null and r.management_hash=p_hash) or
    (p_kind='guest' and g.token_hash=p_hash and g.revoked_at is null)
  );
$$;
revoke all on function public.resolve_rsvp_management(text,text,text) from public;

create function public.manage_rsvp(
  p_slug text,p_kind text,p_hash text,p_revision integer,p_intent text,
  p_name text,p_email text,p_attendance boolean,p_size integer,p_note text,p_client_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  ev public.events%rowtype;
  reply public.rsvps%rowtype;
  quota integer;
  used_capacity integer;
  attempts_now integer;
  window_now timestamptz := date_trunc('hour',now())+floor(extract(minute from now())/10)*interval '10 minutes';
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_kind is null or p_kind not in('open','guest')
    or p_revision is null or p_revision<1 or p_intent is null or p_intent not in('update','cancel')
    or p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status',400,'error','Datos inválidos.');
  end if;
  if p_intent='update' and (p_name is null or char_length(trim(p_name)) not between 2 and 120
    or char_length(coalesce(p_email,''))>254 or char_length(coalesce(p_note,''))>500
    or p_attendance is null or p_size is null or p_size not between 1 and 10) then
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
  select r.* into reply from public.rsvps r left join public.event_guests g on g.id=r.guest_id
    where r.event_id=ev.id and (
      (p_kind='open' and r.guest_id is null and r.management_hash=p_hash) or
      (p_kind='guest' and g.token_hash=p_hash and g.revoked_at is null)
    ) for update of r;
  if not found then
    return jsonb_build_object('status',404,'error','El enlace de gestión no está disponible.');
  end if;
  if p_intent='cancel' and reply.cancelled_at is not null then
    return jsonb_build_object('status',200,'revision',reply.revision,'success',true);
  end if;
  if reply.revision<>p_revision then
    return jsonb_build_object('status',409,'error','La respuesta cambió en otra pestaña. Recarga los datos antes de continuar.');
  end if;
  if p_intent='cancel' then
    update public.rsvps set attendance=false,party_size=1,cancelled_at=now(),updated_at=now(),revision=revision+1 where id=reply.id;
  else
    if not ev.rsvp_open then
      return jsonb_build_object('status',409,'error','Las confirmaciones están cerradas. Aún puedes cancelar tu asistencia.');
    end if;
    select max_party_size into quota from public.event_guests where id=reply.guest_id;
    if p_attendance and p_size>coalesce(quota,10) then
      return jsonb_build_object('status',409,'error','El número de personas supera el cupo de tu invitación.');
    end if;
    if p_attendance and ev.capacity is not null then
      select coalesce(sum(party_size),0) into used_capacity from public.rsvps
        where event_id=ev.id and attendance and id<>reply.id;
      if used_capacity+p_size>ev.capacity then
        return jsonb_build_object('status',409,'error','No quedan suficientes cupos. Reduce el número de asistentes.');
      end if;
    end if;
    update public.rsvps set guest_name=case when guest_id is null then trim(p_name) else guest_name end,
      guest_email=nullif(p_email,''),attendance=p_attendance,party_size=case when p_attendance then p_size else 1 end,
      note=coalesce(p_note,''),cancelled_at=null,updated_at=now(),revision=revision+1 where id=reply.id;
  end if;
  return jsonb_build_object('status',200,'revision',reply.revision+1,'success',true);
end;
$$;
revoke all on function public.manage_rsvp(text,text,text,integer,text,text,text,boolean,integer,text,text) from public;
