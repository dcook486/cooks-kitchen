create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Chicago',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members(user_id);
create index households_created_by_idx on public.households(created_by);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  source_url text,
  image_url text,
  prep_minutes integer check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes integer check (cook_minutes is null or cook_minutes >= 0),
  servings numeric check (servings is null or servings > 0),
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  is_favorite boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_household_id_idx on public.recipes(household_id);
create index recipes_name_idx on public.recipes(name);
create index recipes_created_by_idx on public.recipes(created_by);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create index meal_plans_household_id_idx on public.meal_plans(household_id);
create index meal_plans_created_by_idx on public.meal_plans(created_by);

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  meal_date date not null,
  meal_type text not null default 'dinner' check (meal_type in ('breakfast','lunch','dinner','snack')),
  recipe_id uuid references public.recipes(id) on delete set null,
  custom_label text,
  status text not null default 'planned' check (status in ('planned','leftovers','eating_out','skipped')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_plan_id, meal_date, meal_type),
  check (recipe_id is not null or custom_label is not null or status in ('leftovers','eating_out','skipped'))
);

create index meal_plan_items_meal_plan_id_idx on public.meal_plan_items(meal_plan_id);
create index meal_plan_items_recipe_id_idx on public.meal_plan_items(recipe_id);

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_plan_id uuid references public.meal_plans(id) on delete cascade,
  name text not null,
  quantity text,
  category text,
  is_checked boolean not null default false,
  source_recipe_id uuid references public.recipes(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index grocery_items_household_id_idx on public.grocery_items(household_id);
create index grocery_items_meal_plan_id_idx on public.grocery_items(meal_plan_id);
create index grocery_items_source_recipe_id_idx on public.grocery_items(source_recipe_id);
create index grocery_items_created_by_idx on public.grocery_items(created_by);

create or replace function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
      and hm.role = 'owner'
  );
$$;

revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.is_household_owner(uuid) from public;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.is_household_owner(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.recipes enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.grocery_items enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.meal_plan_items to authenticated;
grant select, insert, update, delete on public.grocery_items to authenticated;

create policy "profiles_select_self" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_self" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "households_select_member" on public.households for select to authenticated using ((select private.is_household_member(id)) or created_by = (select auth.uid()));
create policy "households_insert_creator" on public.households for insert to authenticated with check (created_by = (select auth.uid()));
create policy "households_update_owner" on public.households for update to authenticated using ((select private.is_household_owner(id))) with check ((select private.is_household_owner(id)));
create policy "households_delete_owner" on public.households for delete to authenticated using ((select private.is_household_owner(id)));

create policy "household_members_select_household" on public.household_members for select to authenticated using ((select private.is_household_member(household_id)) or user_id = (select auth.uid()));
create policy "household_members_insert_initial_or_owner" on public.household_members for insert to authenticated with check ((user_id = (select auth.uid()) and role = 'owner' and exists (select 1 from public.households h where h.id = household_id and h.created_by = (select auth.uid()))) or (select private.is_household_owner(household_id)));
create policy "household_members_update_owner" on public.household_members for update to authenticated using ((select private.is_household_owner(household_id))) with check ((select private.is_household_owner(household_id)));
create policy "household_members_delete_owner_or_self" on public.household_members for delete to authenticated using ((select private.is_household_owner(household_id)) or user_id = (select auth.uid()));

create policy "recipes_select_member" on public.recipes for select to authenticated using ((select private.is_household_member(household_id)));
create policy "recipes_insert_member" on public.recipes for insert to authenticated with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy "recipes_update_member" on public.recipes for update to authenticated using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));
create policy "recipes_delete_member" on public.recipes for delete to authenticated using ((select private.is_household_member(household_id)));

create policy "meal_plans_select_member" on public.meal_plans for select to authenticated using ((select private.is_household_member(household_id)));
create policy "meal_plans_insert_member" on public.meal_plans for insert to authenticated with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy "meal_plans_update_member" on public.meal_plans for update to authenticated using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));
create policy "meal_plans_delete_member" on public.meal_plans for delete to authenticated using ((select private.is_household_member(household_id)));

create policy "meal_plan_items_select_member" on public.meal_plan_items for select to authenticated using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and (select private.is_household_member(mp.household_id))));
create policy "meal_plan_items_insert_member" on public.meal_plan_items for insert to authenticated with check (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and (select private.is_household_member(mp.household_id))));
create policy "meal_plan_items_update_member" on public.meal_plan_items for update to authenticated using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and (select private.is_household_member(mp.household_id)))) with check (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and (select private.is_household_member(mp.household_id))));
create policy "meal_plan_items_delete_member" on public.meal_plan_items for delete to authenticated using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and (select private.is_household_member(mp.household_id))));

create policy "grocery_items_select_member" on public.grocery_items for select to authenticated using ((select private.is_household_member(household_id)));
create policy "grocery_items_insert_member" on public.grocery_items for insert to authenticated with check ((select private.is_household_member(household_id)) and created_by = (select auth.uid()));
create policy "grocery_items_update_member" on public.grocery_items for update to authenticated using ((select private.is_household_member(household_id))) with check ((select private.is_household_member(household_id)));
create policy "grocery_items_delete_member" on public.grocery_items for delete to authenticated using ((select private.is_household_member(household_id)));
