create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'account_created',
    'onboarding_completed',
    'recipe_added',
    'recipe_imported',
    'dinner_planned',
    'household_invite_sent',
    'household_invite_accepted',
    'feedback_sent'
  )),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  page_path text check (page_path is null or char_length(page_path) <= 500),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  created_at timestamptz not null default now()
);

create index analytics_events_event_created_idx on public.analytics_events(event_name, created_at desc);
create index analytics_events_user_created_idx on public.analytics_events(user_id, created_at desc);
create index analytics_events_household_created_idx on public.analytics_events(household_id, created_at desc);

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from public, anon, authenticated;
grant insert on public.analytics_events to authenticated;

create policy "analytics_events_insert_self"
on public.analytics_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    household_id is null
    or (select private.is_household_member(household_id))
  )
);

create or replace function private.track_account_created_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (event_name, user_id, page_path)
  values ('account_created', new.id, '/login');
  return new;
end;
$$;
revoke all on function private.track_account_created_event() from public;

create trigger track_account_created_event
after insert on public.profiles
for each row execute function private.track_account_created_event();

create or replace function private.track_household_invite_sent_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (event_name, user_id, household_id, page_path)
  values ('household_invite_sent', new.invited_by, new.household_id, '/household');
  return new;
end;
$$;
revoke all on function private.track_household_invite_sent_event() from public;

create trigger track_household_invite_sent_event
after insert on public.household_invitations
for each row execute function private.track_household_invite_sent_event();

create or replace function private.track_household_invite_accepted_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.accepted_at is null and new.accepted_at is not null and new.accepted_by is not null then
    insert into public.analytics_events (event_name, user_id, household_id, page_path)
    values ('household_invite_accepted', new.accepted_by, new.household_id, '/invite');
  end if;
  return new;
end;
$$;
revoke all on function private.track_household_invite_accepted_event() from public;

create trigger track_household_invite_accepted_event
after update on public.household_invitations
for each row execute function private.track_household_invite_accepted_event();

create or replace function private.track_feedback_sent_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (event_name, user_id, household_id, page_path, properties)
  values (
    'feedback_sent',
    new.user_id,
    new.household_id,
    left(new.page_url, 500),
    jsonb_build_object('category', new.category)
  );
  return new;
end;
$$;
revoke all on function private.track_feedback_sent_event() from public;

create trigger track_feedback_sent_event
after insert on public.feedback_submissions
for each row execute function private.track_feedback_sent_event();
