create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  category text not null check (category in ('bug', 'idea', 'general')),
  message text not null check (char_length(message) between 1 and 4000),
  page_url text check (page_url is null or char_length(page_url) <= 1000),
  created_at timestamptz not null default now()
);

create index feedback_submissions_created_at_idx on public.feedback_submissions(created_at desc);
create index feedback_submissions_user_id_idx on public.feedback_submissions(user_id);
create index feedback_submissions_household_id_idx on public.feedback_submissions(household_id);

alter table public.feedback_submissions enable row level security;

revoke all on table public.feedback_submissions from public, anon, authenticated;
grant insert on table public.feedback_submissions to authenticated;

create policy "feedback_insert_self" on public.feedback_submissions
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    household_id is null
    or (select private.is_household_member(household_id))
  )
);
