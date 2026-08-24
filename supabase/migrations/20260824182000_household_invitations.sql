create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null,
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(invited_email)) > 3)
);

create index household_invitations_household_id_idx on public.household_invitations(household_id);
create index household_invitations_invited_email_idx on public.household_invitations(lower(invited_email));
create index household_invitations_token_idx on public.household_invitations(token);
create index household_invitations_invited_by_idx on public.household_invitations(invited_by);

alter table public.household_invitations enable row level security;
grant select, insert, update, delete on public.household_invitations to authenticated;

create policy "household_invitations_select_owner"
on public.household_invitations for select to authenticated
using ((select private.is_household_owner(household_id)));

create policy "household_invitations_insert_owner"
on public.household_invitations for insert to authenticated
with check (
  (select private.is_household_owner(household_id))
  and invited_by = (select auth.uid())
);

create policy "household_invitations_update_owner"
on public.household_invitations for update to authenticated
using ((select private.is_household_owner(household_id)))
with check ((select private.is_household_owner(household_id)));

create policy "household_invitations_delete_owner"
on public.household_invitations for delete to authenticated
using ((select private.is_household_owner(household_id)));

create policy "profiles_select_shared_household"
on public.profiles for select to authenticated
using (
  exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = profiles.id
  )
);

create or replace function public.get_household_invitation(invite_token uuid)
returns table (
  household_id uuid,
  household_name text,
  invited_email text,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.household_id,
    h.name,
    i.invited_email,
    i.expires_at,
    i.accepted_at,
    i.revoked_at
  from public.household_invitations i
  join public.households h on h.id = i.household_id
  where i.token = invite_token
    and (select auth.uid()) is not null
  limit 1;
$$;

revoke all on function public.get_household_invitation(uuid) from public;
grant execute on function public.get_household_invitation(uuid) to authenticated;

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

  if lower(invitation.invited_email) <> current_email then
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
