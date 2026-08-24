export type Ingredient = {
  amount: number;
  unit: string;
  name: string;
  category: string;
};

export type Recipe = {
  id: string;
  name: string;
  minutes: number;
  category: string;
  tags: string[];
  favorite: boolean;
  ingredients: Ingredient[];
};

export type MealSlot =
  | { type: "recipe"; recipeId: string }
  | { type: "out" }
  | { type: "leftovers" };

export type WeekPlan = Record<string, MealSlot | undefined>;
