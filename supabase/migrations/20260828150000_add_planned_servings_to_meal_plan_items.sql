alter table public.meal_plan_items
add column planned_servings numeric;

alter table public.meal_plan_items
add constraint meal_plan_items_planned_servings_check
check (planned_servings is null or planned_servings > 0);

update public.meal_plan_items item
set planned_servings = recipe.servings
from public.recipes recipe
where item.recipe_id = recipe.id
  and item.planned_servings is null;
