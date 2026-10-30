create table public.event_activities (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check(char_length(trim(title)) between 2 and 120),
  description text not null default '' check(char_length(description)<=500),
  venue_name text not null default '' check(char_length(venue_name)<=160),
  starts_at timestamptz not null check(isfinite(starts_at))
);
create index event_activities_event_time_idx on public.event_activities(event_id,starts_at,id);
alter table public.event_activities enable row level security;
revoke all on public.event_activities from public;
create policy activity_owner on public.event_activities for all
  using(exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select private.actor_id())))
  with check(exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select private.actor_id())));

create function public.validate_activity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    if new.id<>old.id or new.event_id<>old.event_id then
      raise exception 'Activity identity is immutable' using errcode='23514';
    end if;
  else
    perform 1 from public.events where id=new.event_id for update;
    if (select count(*) from public.event_activities where event_id=new.event_id)>=20 then
      raise exception 'Activity limit reached' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger activity_validation before insert or update on public.event_activities
  for each row execute function public.validate_activity();
revoke all on function public.validate_activity() from public;

create function public.invitation_activities(p_slug text)
returns table(id uuid,title text,description text,venue_name text,starts_at timestamptz)
language sql stable security definer set search_path='' as $$
  select a.id,a.title,a.description,a.venue_name,a.starts_at
  from public.event_activities a join public.events e on e.id=a.event_id
  where e.slug=p_slug and e.published_at is not null order by a.starts_at,a.id;
$$;
revoke all on function public.invitation_activities(text) from public;
