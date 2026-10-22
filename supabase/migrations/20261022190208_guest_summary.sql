create function public.guest_summary(p_event_id uuid)
returns table(yes_count bigint, no_count bigint, attendee_count bigint)
language sql stable security invoker set search_path = '' as $$
  select count(*) filter(where attendance), count(*) filter(where not attendance),
    coalesce(sum(party_size) filter(where attendance),0)::bigint
  from public.rsvps where event_id = p_event_id;
$$;
revoke all on function public.guest_summary(uuid) from public, anon;
grant execute on function public.guest_summary(uuid) to authenticated;
