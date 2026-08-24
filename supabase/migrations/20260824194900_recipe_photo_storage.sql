insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-photos',
  'recipe-photos',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "recipe_photos_insert_household_member"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'recipe-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = (select auth.uid())
      and hm.household_id::text = (storage.foldername(name))[1]
  )
);

create policy "recipe_photos_update_household_member"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'recipe-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = (select auth.uid())
      and hm.household_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'recipe-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = (select auth.uid())
      and hm.household_id::text = (storage.foldername(name))[1]
  )
);

create policy "recipe_photos_delete_household_member"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'recipe-photos'
  and exists (
    select 1
    from public.household_members hm
    where hm.user_id = (select auth.uid())
      and hm.household_id::text = (storage.foldername(name))[1]
  )
);

-- Imported website images were previously stored as external URLs. Recipe photos
-- are now household-uploaded assets, so remove any legacy external image links.
update public.recipes
set image_url = null,
    updated_at = now()
where image_url is not null;
