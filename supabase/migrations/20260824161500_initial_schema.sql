create extension if not exists pgcrypto;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Cook Family',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  primary key (household_id, user_id)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  minutes integer check (minutes is null or minutes > 0),
  category text,
  tags text[] not null default '{}',
  favorite boolean not null default false,
  notes text,
  source_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  position integer not null default 0,
  amount numeric,
  unit text,
  name text not null,
  category text not null default 'Other'
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  unique (household_id, week_start)
);

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  day date not null,
  slot_type text not null check (slot_type in ('recipe', 'out', 'leftovers')),
  recipe_id uuid references public.recipes(id) on delete set null,
  note text,
  unique (meal_plan_id, day),
  check ((slot_type = 'recipe' and recipe_id is not null) or slot_type <> 'recipe')
);

create table public.grocery_checks (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  ingredient_key text not null,
  checked boolean not null default false,
  unique (meal_plan_id, ingredient_key)
);

create or replace function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid()
  );
$$;

create or replace function public.add_household_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger households_add_owner after insert on public.households
for each row execute function public.add_household_owner();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_entries enable row level security;
alter table public.grocery_checks enable row level security;

create policy "members view households" on public.households for select to authenticated using (public.is_household_member(id));
create policy "users create households" on public.households for insert to authenticated with check (created_by = auth.uid());
create policy "members view membership" on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy "members manage recipes" on public.recipes for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage meal plans" on public.meal_plans for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members manage ingredients" on public.recipe_ingredients for all to authenticated using (exists (select 1 from public.recipes r where r.id = recipe_id and public.is_household_member(r.household_id))) with check (exists (select 1 from public.recipes r where r.id = recipe_id and public.is_household_member(r.household_id)));
create policy "members manage meal entries" on public.meal_plan_entries for all to authenticated using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and public.is_household_member(mp.household_id))) with check (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and public.is_household_member(mp.household_id)));
create policy "members manage grocery checks" on public.grocery_checks for all to authenticated using (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and public.is_household_member(mp.household_id))) with check (exists (select 1 from public.meal_plans mp where mp.id = meal_plan_id and public.is_household_member(mp.household_id)));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.households, public.household_members, public.recipes, public.recipe_ingredients, public.meal_plans, public.meal_plan_entries, public.grocery_checks to authenticated;
