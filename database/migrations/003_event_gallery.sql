create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  position integer not null check(position between 0 and 7),
  alt_text text not null check(char_length(trim(alt_text)) between 3 and 180),
  caption text not null default '' check(char_length(caption)<=180),
  content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),
  bytes bytea not null check(octet_length(bytes) between 1 and 3145728),
  created_at timestamptz not null default now(),
  constraint event_photos_position_unique unique(event_id,position) deferrable initially immediate
);
-- Eight unique positions enforce the limit even outside the application.
alter table public.event_photos enable row level security;
revoke all on public.event_photos from public;
create policy photos_owner on public.event_photos for all
  using(exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select private.actor_id())))
  with check(exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select private.actor_id())));

create function public.validate_photo_identity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.id<>old.id or new.event_id<>old.event_id then
    raise exception 'Photo identity is immutable' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger photo_identity before update on public.event_photos
  for each row execute function public.validate_photo_identity();
revoke all on function public.validate_photo_identity() from public;

-- Public projection contains display metadata only, never bytes or owner IDs.
create function public.invitation_photos(p_slug text)
returns table(id uuid,alt_text text,caption text)
language sql stable security definer set search_path='' as $$
  select p.id,p.alt_text,p.caption from public.event_photos p
  join public.events e on e.id=p.event_id
  where e.slug=p_slug and e.published_at is not null order by p.position,p.id;
$$;
create function public.read_gallery_photo(p_id uuid)
returns table(bytes bytea,content_type text)
language sql stable security definer set search_path='' as $$
  select p.bytes,p.content_type from public.event_photos p
  join public.events e on e.id=p.event_id
  where p.id=p_id and (e.published_at is not null or e.owner_id=private.actor_id());
$$;
revoke all on function public.invitation_photos(text),public.read_gallery_photo(uuid) from public;
