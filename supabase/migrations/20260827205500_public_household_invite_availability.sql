create or replace function public.is_household_invitation_available(invite_token uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_invitations i
    where i.token = invite_token
      and i.accepted_at is null
      and i.revoked_at is null
      and i.expires_at > now()
  );
$$;

revoke all on function public.is_household_invitation_available(uuid) from public;
grant execute on function public.is_household_invitation_available(uuid) to anon, authenticated, service_role;
