create table private.password_resets (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null
);
alter table private.password_resets enable row level security;
revoke all on private.password_resets from public;
create table private.password_reset_limits (
  key text not null,
  window_start timestamptz not null,
  attempts integer not null default 1,
  primary key(key,window_start)
);
alter table private.password_reset_limits enable row level security;
revoke all on private.password_reset_limits from public;

create function private.recovery_attempt(p_key text,p_limit integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare attempts_now integer;
begin
  delete from private.password_reset_limits where window_start<now()-interval '1 day';
  insert into private.password_reset_limits(key,window_start)
    values(p_key,date_bin(interval '15 minutes',now(),timestamptz '2000-01-01'))
    on conflict(key,window_start) do update set attempts=private.password_reset_limits.attempts+1
    returning attempts into attempts_now;
  return attempts_now<=p_limit;
end;
$$;
revoke all on function private.recovery_attempt(text,integer) from public;

create function private.issue_password_reset(p_email text,p_hash text,p_client text,p_email_key text) returns boolean
language plpgsql security definer set search_path='' as $$
declare user_id uuid;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_client is null or p_client !~ '^[a-f0-9]{64}$'
    or p_email_key is null or p_email_key !~ '^[a-f0-9]{64}$' then return false; end if;
  if not private.recovery_attempt('request-ip:'||p_client,10) then return false; end if;
  if not private.recovery_attempt('request-email:'||p_email_key,3) then return false; end if;
  select id into user_id from public.app_users where email=p_email for update;
  if not found then return false; end if;
  insert into private.password_resets(user_id,token_hash,expires_at) values(user_id,p_hash,now()+interval '30 minutes')
    on conflict(user_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  return true;
end;
$$;
revoke all on function private.issue_password_reset(text,text,text,text) from public;

create function private.password_reset_attempt(p_client text) returns boolean
language sql security definer set search_path='' as $$
  select case when p_client ~ '^[a-f0-9]{64}$' then private.recovery_attempt('consume-ip:'||p_client,10) else false end;
$$;
revoke all on function private.password_reset_attempt(text) from public;

create function private.consume_password_reset(p_hash text,p_password text) returns text
language plpgsql security definer set search_path='' as $$
declare reset_user uuid; reset_email text;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_password is null
    or p_password !~ '^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$' then return null; end if;
  select user_id into reset_user from private.password_resets where token_hash=p_hash;
  if not found then return null; end if;
  -- Same user lock as issuance and checked login: a reset must also defeat a
  -- password verification that started before this password was changed.
  perform 1 from public.app_users where id=reset_user for update;
  perform 1 from private.password_resets where user_id=reset_user and token_hash=p_hash and expires_at>now() for update;
  if not found then return null; end if;
  update public.app_users set password_hash=p_password where id=reset_user;
  delete from public.app_sessions where user_id=reset_user;
  delete from private.password_resets where user_id=reset_user;
  select email into reset_email from public.app_users where id=reset_user;
  return reset_email;
end;
$$;
revoke all on function private.consume_password_reset(text,text) from public;

create function private.open_checked_session(p_user uuid,p_hash text,p_password text) returns boolean
language plpgsql security definer set search_path='' as $$
declare current_password text;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  select password_hash into current_password from public.app_users where id=p_user for update;
  if not found or p_password is null or current_password<>p_password then return false; end if;
  delete from public.app_sessions where user_id=p_user and expires_at<=now();
  insert into public.app_sessions(token_hash,user_id,expires_at) values(p_hash,p_user,now()+interval '7 days');
  return true;
end;
$$;
revoke all on function private.open_checked_session(uuid,text,text) from public;
