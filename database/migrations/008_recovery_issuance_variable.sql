-- Preserve the applied migration and disambiguate the PL/pgSQL variable.
create or replace function private.issue_password_reset(p_email text,p_hash text,p_client text,p_email_key text) returns boolean
language plpgsql security definer set search_path='' as $$
declare reset_user_id uuid;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_client is null or p_client !~ '^[a-f0-9]{64}$'
    or p_email_key is null or p_email_key !~ '^[a-f0-9]{64}$' then return false; end if;
  if not private.recovery_attempt('request-ip:'||p_client,10) then return false; end if;
  if not private.recovery_attempt('request-email:'||p_email_key,3) then return false; end if;
  select id into reset_user_id from public.app_users where email=p_email for update;
  if not found then return false; end if;
  insert into private.password_resets(user_id,token_hash,expires_at) values(reset_user_id,p_hash,now()+interval '30 minutes')
    on conflict(user_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  return true;
end;
$$;
revoke all on function private.issue_password_reset(text,text,text,text) from public;

