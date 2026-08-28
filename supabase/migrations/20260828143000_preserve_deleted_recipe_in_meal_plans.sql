create or replace function private.preserve_deleted_recipe_name()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.meal_plan_items
  set custom_label = coalesce(custom_label, old.name),
      updated_at = now()
  where recipe_id = old.id
    and custom_label is null;

  return old;
end;
$$;

revoke all on function private.preserve_deleted_recipe_name() from public;

create trigger preserve_deleted_recipe_name_before_delete
before delete on public.recipes
for each row execute function private.preserve_deleted_recipe_name();
