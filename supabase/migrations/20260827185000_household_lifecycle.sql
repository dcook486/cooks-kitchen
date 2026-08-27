-- Household lifecycle safeguards for beta rollout.

create or replace function public.transfer_household_ownership(
  target_household_id uuid,
  new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
  target_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if current_user_id = new_owner_user_id then
    raise exception 'You already own this household.';
  end if;

  select hm.role into current_role
  from public.household_members hm
  where hm.household_id = target_household_id
    and hm.user_id = current_user_id
  for update;

  if current_role is distinct from 'owner' then
    raise exception 'Only the household owner can transfer ownership.';
  end if;

  select hm.role into target_role
  from public.household_members hm
  where hm.household_id = target_household_id
    and hm.user_id = new_owner_user_id
  for update;

  if target_role is null then
    raise exception 'The new owner must already be a member of this household.';
  end if;

  update public.household_members
  set role = 'owner'
  where household_id = target_household_id
    and user_id = new_owner_user_id;

  update public.household_members
  set role = 'member'
  where household_id = target_household_id
    and user_id = current_user_id;

  update public.households
  set created_by = new_owner_user_id,
      updated_at = now()
  where id = target_household_id;
end;
$$;

revoke all on function public.transfer_household_ownership(uuid, uuid) from public;
grant execute on function public.transfer_household_ownership(uuid, uuid) to authenticated;

create or replace function public.leave_household(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  select hm.role into current_role
  from public.household_members hm
  where hm.household_id = target_household_id
    and hm.user_id = current_user_id
  for update;

  if current_role is null then
    raise exception 'You are not a member of this household.';
  end if;

  if current_role = 'owner' then
    raise exception 'Transfer ownership before leaving this household.';
  end if;

  delete from public.household_members
  where household_id = target_household_id
    and user_id = current_user_id;
end;
$$;

revoke all on function public.leave_household(uuid) from public;
grant execute on function public.leave_household(uuid) to authenticated;

-- Prevent direct deletes from ever removing the owner. Owners must transfer first.
drop policy if exists "household_members_delete_owner_or_self" on public.household_members;
create policy "household_members_delete_non_owner"
on public.household_members for delete to authenticated
using (
  role <> 'owner'
  and (
    user_id = (select auth.uid())
    or (select private.is_household_owner(household_id))
  )
);

-- Backstop role edits so an owner cannot be demoted unless another owner exists.
create or replace function private.prevent_ownerless_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.role = 'owner' then
    raise exception 'Transfer ownership before removing the household owner.';
  end if;

  if tg_op = 'UPDATE'
     and old.role = 'owner'
     and new.role <> 'owner'
     and not exists (
       select 1
       from public.household_members hm
       where hm.household_id = old.household_id
         and hm.user_id <> old.user_id
         and hm.role = 'owner'
     ) then
    raise exception 'A household must always have an owner.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists household_members_prevent_ownerless on public.household_members;
create trigger household_members_prevent_ownerless
before update or delete on public.household_members
for each row execute function private.prevent_ownerless_household();
