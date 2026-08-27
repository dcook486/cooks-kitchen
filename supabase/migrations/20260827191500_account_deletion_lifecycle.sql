-- Safe self-service account deletion for Cook's Kitchen.

create or replace function private.prevent_ownerless_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.role = 'owner' then
    -- Allow the owner's membership row to disappear only as part of deleting
    -- the entire parent household. Direct owner removal remains blocked.
    if not exists (
      select 1 from public.households h where h.id = old.household_id
    ) then
      return old;
    end if;
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

create or replace function public.delete_own_account(confirm_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_household_id uuid;
  current_role text;
  member_count integer;
  successor_user_id uuid;
  related_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if confirm_text <> 'DELETE' then
    raise exception 'Type DELETE to confirm account deletion.';
  end if;

  select hm.household_id, hm.role
  into current_household_id, current_role
  from public.household_members hm
  where hm.user_id = current_user_id
  limit 1
  for update;

  if current_role = 'owner' then
    select count(*) into member_count
    from public.household_members hm
    where hm.household_id = current_household_id;

    if member_count > 1 then
      raise exception 'Transfer household ownership before deleting your account.';
    end if;

    -- Sole-owner deletion removes the whole kitchen and all household-scoped data.
    delete from public.households
    where id = current_household_id;
  end if;

  -- Preserve shared household data by reassigning authorship to the current owner.
  for related_household_id in
    select distinct x.household_id
    from (
      select r.household_id from public.recipes r where r.created_by = current_user_id
      union all
      select mp.household_id from public.meal_plans mp where mp.created_by = current_user_id
      union all
      select gi.household_id from public.grocery_items gi where gi.created_by = current_user_id
      union all
      select hi.household_id from public.household_invitations hi where hi.invited_by = current_user_id
      union all
      select h.id as household_id from public.households h where h.created_by = current_user_id
    ) x
  loop
    if not exists (select 1 from public.households h where h.id = related_household_id) then
      continue;
    end if;

    select hm.user_id into successor_user_id
    from public.household_members hm
    where hm.household_id = related_household_id
      and hm.role = 'owner'
      and hm.user_id <> current_user_id
    limit 1;

    if successor_user_id is null then
      if not exists (
        select 1 from public.household_members hm
        where hm.household_id = related_household_id
          and hm.user_id <> current_user_id
      ) then
        delete from public.households where id = related_household_id;
        continue;
      end if;
      raise exception 'Transfer household ownership before deleting your account.';
    end if;

    update public.recipes
    set created_by = successor_user_id
    where household_id = related_household_id
      and created_by = current_user_id;

    update public.meal_plans
    set created_by = successor_user_id
    where household_id = related_household_id
      and created_by = current_user_id;

    update public.grocery_items
    set created_by = successor_user_id
    where household_id = related_household_id
      and created_by = current_user_id;

    update public.household_invitations
    set invited_by = successor_user_id,
        updated_at = now()
    where household_id = related_household_id
      and invited_by = current_user_id;

    update public.households
    set created_by = successor_user_id,
        updated_at = now()
    where id = related_household_id
      and created_by = current_user_id;
  end loop;

  update public.household_invitations
  set accepted_by = null,
      updated_at = now()
  where accepted_by = current_user_id;

  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_own_account(text) from public;
revoke execute on function public.delete_own_account(text) from anon;
grant execute on function public.delete_own_account(text) to authenticated;
