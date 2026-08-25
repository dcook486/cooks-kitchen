alter table public.households
  add column if not exists kitchen_name text not null default 'Cook''s Kitchen',
  add column if not exists tagline text;

alter table public.households
  drop constraint if exists households_kitchen_name_length,
  add constraint households_kitchen_name_length check (char_length(trim(kitchen_name)) between 1 and 80),
  drop constraint if exists households_tagline_length,
  add constraint households_tagline_length check (tagline is null or char_length(tagline) <= 120);
