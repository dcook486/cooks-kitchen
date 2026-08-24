import type { Recipe, WeekPlan } from "./types";

export const days = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

export const recipes: Recipe[] = [
  { id: "chicken-tacos", name: "Chicken Tacos", minutes: 30, category: "Mexican", tags: ["quick", "kid-friendly", "gluten-free option"], favorite: true, ingredients: [
    { amount: 1.5, unit: "lb", name: "Chicken breast", category: "Meat" },
    { amount: 12, unit: "count", name: "Corn tortillas", category: "Bakery" },
    { amount: 1, unit: "bunch", name: "Cilantro", category: "Produce" },
    { amount: 2, unit: "count", name: "Limes", category: "Produce" }
  ]},
  { id: "sheet-pan-salmon", name: "Sheet Pan Salmon", minutes: 35, category: "Seafood", tags: ["gluten-free", "dairy-free", "weeknight"], favorite: true, ingredients: [
    { amount: 1.5, unit: "lb", name: "Salmon", category: "Seafood" },
    { amount: 1, unit: "lb", name: "Baby potatoes", category: "Produce" },
    { amount: 1, unit: "bunch", name: "Asparagus", category: "Produce" }
  ]},
  { id: "steak-bowls", name: "Steak Rice Bowls", minutes: 40, category: "Bowls", tags: ["high-protein", "gluten-free"], favorite: false, ingredients: [
    { amount: 1.25, unit: "lb", name: "Sirloin steak", category: "Meat" },
    { amount: 2, unit: "cup", name: "Jasmine rice", category: "Pantry" },
    { amount: 2, unit: "count", name: "Bell peppers", category: "Produce" }
  ]},
  { id: "pesto-pasta", name: "Chicken Pesto Pasta", minutes: 25, category: "Pasta", tags: ["quick", "comfort food"], favorite: true, ingredients: [
    { amount: 1, unit: "lb", name: "Chicken breast", category: "Meat" },
    { amount: 1, unit: "box", name: "Pasta", category: "Pantry" },
    { amount: 1, unit: "jar", name: "Pesto", category: "Pantry" }
  ]},
  { id: "burgers", name: "Grilled Burgers", minutes: 30, category: "Grill", tags: ["kid-friendly", "weekend"], favorite: true, ingredients: [
    { amount: 1.5, unit: "lb", name: "Ground beef", category: "Meat" },
    { amount: 6, unit: "count", name: "Burger buns", category: "Bakery" },
    { amount: 1, unit: "count", name: "Tomato", category: "Produce" }
  ]}
];

export const initialWeek: WeekPlan = {
  monday: { type: "recipe", recipeId: "chicken-tacos" },
  tuesday: { type: "recipe", recipeId: "sheet-pan-salmon" },
  wednesday: { type: "leftovers" },
  thursday: { type: "recipe", recipeId: "pesto-pasta" },
  friday: { type: "out" }
};
