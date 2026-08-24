"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = clean(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function list(value: FormDataEntryValue | null) {
  return clean(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function lines(value: FormDataEntryValue | null) {
  return clean(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function currentUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) redirect("/login");
  return { supabase, userId };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = clean(formData.get("email"));
  const password = clean(formData.get("password"));

  if (!email || !password) redirect("/login?error=Enter%20your%20email%20and%20password.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const displayName = clean(formData.get("display_name"));
  const email = clean(formData.get("email"));
  const password = clean(formData.get("password"));

  if (!displayName || !email || !password) {
    redirect("/login?mode=signup&error=Complete%20all%20fields.");
  }
  if (password.length < 8) {
    redirect("/login?mode=signup&error=Use%20at%20least%208%20characters%20for%20your%20password.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  redirect(`/login?message=${encodeURIComponent("Check your email to confirm your account, then sign in.")}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function createHousehold(formData: FormData) {
  const { supabase, userId } = await currentUserId();
  const name = clean(formData.get("name")) || "Cook Family";

  const { data: existing } = await supabase
    .from("households")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();

  let householdId = existing?.id;

  if (!householdId) {
    const { data: household, error } = await supabase
      .from("households")
      .insert({
        name,
        timezone: "America/Chicago",
        created_by: userId,
      })
      .select("id")
      .single();

    if (error || !household) redirect(`/onboarding?error=${encodeURIComponent(error?.message ?? "Could not create household")}`);
    householdId = household.id;
  }

  const { error: memberError } = await supabase.from("household_members").upsert(
    {
      household_id: householdId,
      user_id: userId,
      role: "owner",
    },
    { onConflict: "household_id,user_id" },
  );

  if (memberError) redirect(`/onboarding?error=${encodeURIComponent(memberError.message)}`);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function addRecipe(formData: FormData) {
  const { supabase, userId } = await currentUserId();
  const householdId = clean(formData.get("household_id"));
  const name = clean(formData.get("name"));

  if (!householdId || !name) return;

  const ingredients = lines(formData.get("ingredients")).map((text) => ({ text }));
  const instructions = lines(formData.get("instructions"));

  const { error } = await supabase.from("recipes").insert({
    household_id: householdId,
    name,
    description: clean(formData.get("description")) || null,
    source_url: clean(formData.get("source_url")) || null,
    prep_minutes: numberOrNull(formData.get("prep_minutes")),
    cook_minutes: numberOrNull(formData.get("cook_minutes")),
    servings: numberOrNull(formData.get("servings")),
    ingredients,
    instructions,
    tags: list(formData.get("tags")),
    dietary_tags: list(formData.get("dietary_tags")),
    is_favorite: formData.get("is_favorite") === "on",
    created_by: userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function toggleFavorite(formData: FormData) {
  const { supabase } = await currentUserId();
  const id = clean(formData.get("id"));
  const nextValue = clean(formData.get("next")) === "true";
  if (!id) return;

  const { error } = await supabase.from("recipes").update({ is_favorite: nextValue }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function deleteRecipe(formData: FormData) {
  const { supabase } = await currentUserId();
  const id = clean(formData.get("id"));
  if (!id) return;

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
