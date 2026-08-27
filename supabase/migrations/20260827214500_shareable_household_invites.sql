alter table public.household_invitations
  alter column invited_email drop not null;

alter table public.household_invitations
  drop constraint household_invitations_invited_email_check;

alter table public.household_invitations
  add constraint household_invitations_invited_email_check
  check (invited_email is null or length(trim(invited_email)) > 3);

create or replace function public.accept_household_invitation(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  invitation public.household_invitations%rowtype;
  existing_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to accept an invitation.';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  select *
  into invitation
  from public.household_invitations
  where token = invite_token
  for update;

  if not found then
    raise exception 'This invitation does not exist.';
  end if;

  if invitation.revoked_at is not null then
    raise exception 'This invitation has been revoked.';
  end if;

  if invitation.accepted_at is not null then
    if invitation.accepted_by = current_user_id then
      return invitation.household_id;
    end if;
    raise exception 'This invitation has already been used.';
  end if;

  if invitation.expires_at <= now() then
    raise exception 'This invitation has expired.';
  end if;

  if invitation.invited_email is not null
     and lower(invitation.invited_email) <> current_email then
    raise exception 'This invitation was sent to a different email address.';
  end if;

  select hm.household_id
  into existing_household_id
  from public.household_members hm
  where hm.user_id = current_user_id
  limit 1;

  if existing_household_id is not null and existing_household_id <> invitation.household_id then
    raise exception 'This account already belongs to another household.';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (invitation.household_id, current_user_id, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invitations
  set accepted_at = now(),
      accepted_by = current_user_id,
      updated_at = now()
  where id = invitation.id;

  return invitation.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(uuid) from public;
grant execute on function public.accept_household_invitation(uuid) to authenticated;
