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

function safeNext(value: FormDataEntryValue | null) {
  const next = clean(value);
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function optionalNext(value: FormDataEntryValue | null) {
  const next = clean(value);
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function safeTimeZone(value: FormDataEntryValue | null) {
  const timeZone = clean(value) || "America/Chicago";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "America/Chicago";
  }
}

function mondayForIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return date.toISOString().slice(0, 10);
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
  const next = safeNext(formData.get("next"));
  const inviteToken = clean(formData.get("invite_token"));

  if (!email || !password) {
    const suffix = inviteToken ? `&invite=${encodeURIComponent(inviteToken)}&next=${encodeURIComponent(next)}` : "";
    redirect(`/login?error=Enter%20your%20email%20and%20password.${suffix}`);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const suffix = inviteToken ? `&invite=${encodeURIComponent(inviteToken)}&next=${encodeURIComponent(next)}` : "";
    redirect(`/login?error=${encodeURIComponent(error.message)}${suffix}`);
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const displayName = clean(formData.get("display_name"));
  const email = clean(formData.get("email"));
  const password = clean(formData.get("password"));
  const next = safeNext(formData.get("next"));
  const inviteToken = clean(formData.get("invite_token"));

  if (!displayName || !email || !password) {
    redirect(`/login?mode=signup&error=Complete%20all%20fields.&next=${encodeURIComponent(next)}${inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""}`);
  }
  if (password.length < 8) {
    redirect(`/login?mode=signup&error=Use%20at%20least%208%20characters%20for%20your%20password.&next=${encodeURIComponent(next)}${inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""}`);
  }

  const metadata: Record<string, string> = { display_name: displayName };
  if (inviteToken) metadata.pending_household_invite = inviteToken;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) {
    redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}${inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""}`);
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  redirect(`/login?message=${encodeURIComponent("Check your email to confirm your account, then sign in.")}&next=${encodeURIComponent(next)}${inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function createHousehold(formData: FormData) {
  const { supabase, userId } = await currentUserId();
  const name = clean(formData.get("name")) || "My Family";
  const kitchenName = clean(formData.get("kitchen_name")) || "My Kitchen";
  const timeZone = safeTimeZone(formData.get("timezone"));

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
      .insert({ name, kitchen_name: kitchenName, timezone: timeZone, created_by: userId })
      .select("id")
      .single();

    if (error || !household) redirect(`/onboarding?error=${encodeURIComponent(error?.message ?? "Could not create household")}`);
    householdId = household.id;
  } else {
    const { error } = await supabase
      .from("households")
      .update({ name, kitchen_name: kitchenName, timezone: timeZone })
      .eq("id", householdId);
    if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  const { error: memberError } = await supabase.from("household_members").upsert(
    { household_id: householdId, user_id: userId, role: "owner" },
    { onConflict: "household_id,user_id" },
  );

  if (memberError) redirect(`/onboarding?error=${encodeURIComponent(memberError.message)}`);

  revalidatePath("/", "layout");
  redirect("/onboarding?step=recipes");
}

export async function addRecipe(formData: FormData) {
  const { supabase, userId } = await currentUserId();
  const householdId = clean(formData.get("household_id"));
  const name = clean(formData.get("name"));
  const next = optionalNext(formData.get("next"));
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
  revalidatePath("/onboarding");
  if (next) redirect(next);
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

export async function saveDinnerPlan(formData: FormData) {
  const { supabase, userId } = await currentUserId();
  const householdId = clean(formData.get("household_id"));
  const mealDate = clean(formData.get("meal_date"));
  const weekStart = clean(formData.get("week_start")) || mondayForIso(mealDate) || "";
  const selection = clean(formData.get("selection"));
  const next = optionalNext(formData.get("next"));
  if (!householdId || !weekStart || !mealDate || !selection) return;

  const { data: membership } = await supabase.from("household_members").select("household_id").eq("household_id", householdId).eq("user_id", userId).maybeSingle();
  if (!membership) throw new Error("You do not have access to this household.");

  const { data: existingPlan, error: planLookupError } = await supabase.from("meal_plans").select("id").eq("household_id", householdId).eq("week_start", weekStart).maybeSingle();
  if (planLookupError) throw new Error(planLookupError.message);

  let mealPlanId = existingPlan?.id;

  if (selection === "none") {
    if (mealPlanId) {
      const { error } = await supabase.from("meal_plan_items").delete().eq("meal_plan_id", mealPlanId).eq("meal_date", mealDate).eq("meal_type", "dinner");
      if (error) throw new Error(error.message);
    }
    revalidatePath("/");
    if (next) redirect(next);
    return;
  }

  if (!mealPlanId) {
    const { data: newPlan, error } = await supabase.from("meal_plans").insert({ household_id: householdId, week_start: weekStart, created_by: userId }).select("id").single();
    if (error || !newPlan) throw new Error(error?.message ?? "Could not create meal plan.");
    mealPlanId = newPlan.id;
  }

  let status: "planned" | "leftovers" | "eating_out" | "skipped" = "planned";
  let recipeId: string | null = null;

  if (selection.startsWith("recipe:")) {
    recipeId = selection.slice("recipe:".length);
    const { data: recipe, error } = await supabase.from("recipes").select("id").eq("id", recipeId).eq("household_id", householdId).maybeSingle();
    if (error || !recipe) throw new Error("That recipe is not available in this household.");
  } else if (selection === "leftovers" || selection === "eating_out" || selection === "skipped") {
    status = selection;
  } else {
    throw new Error("Unknown meal selection.");
  }

  const { error } = await supabase.from("meal_plan_items").upsert(
    { meal_plan_id: mealPlanId, meal_date: mealDate, meal_type: "dinner", recipe_id: recipeId, custom_label: null, status, notes: null },
    { onConflict: "meal_plan_id,meal_date,meal_type" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/onboarding");
  if (next) redirect(next);
}

export async function createHouseholdInvitation(formData: FormData) {
  const { supabase, userId } = await currentUserId();
  const householdId = clean(formData.get("household_id"));
  const email = clean(formData.get("email")).toLowerCase();

  if (!householdId || !email || !email.includes("@")) {
    redirect("/?section=household&share_error=Enter%20a%20valid%20email%20address.");
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.role !== "owner") throw new Error("Only a household owner can send invitations.");

  await supabase
    .from("household_invitations")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .ilike("invited_email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const { data: invitation, error } = await supabase
    .from("household_invitations")
    .insert({ household_id: householdId, invited_email: email, invited_by: userId })
    .select("token")
    .single();

  if (error || !invitation) throw new Error(error?.message ?? "Could not create invitation.");

  revalidatePath("/");
  redirect(`/?section=household&invite=${invitation.token}`);
}

export async function revokeHouseholdInvitation(formData: FormData) {
  const { supabase } = await currentUserId();
  const id = clean(formData.get("id"));
  if (!id) return;

  const { error } = await supabase
    .from("household_invitations")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/?section=household");
}

export async function removeHouseholdMember(formData: FormData) {
  const { supabase, userId } = await currentUserId();
  const householdId = clean(formData.get("household_id"));
  const memberUserId = clean(formData.get("user_id"));

  if (!householdId || !memberUserId) {
    redirect("/?section=household&share_error=Could%20not%20identify%20that%20household%20member.");
  }

  const { data: ownerMembership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ownerMembership?.role !== "owner") {
    redirect("/?section=household&share_error=Only%20the%20household%20owner%20can%20remove%20members.");
  }

  if (memberUserId === userId) {
    redirect("/?section=household&share_error=The%20household%20owner%20cannot%20remove%20themselves.");
  }

  const { data: targetMembership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", memberUserId)
    .maybeSingle();

  if (!targetMembership) {
    redirect("/?section=household&share_error=That%20person%20is%20no%20longer%20in%20the%20household.");
  }

  if (targetMembership.role === "owner") {
    redirect("/?section=household&share_error=The%20household%20owner%20cannot%20be%20removed.");
  }

  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", memberUserId);

  if (error) {
    redirect(`/?section=household&share_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/?section=household");
}

export async function acceptHouseholdInvitation(formData: FormData) {
  const { supabase } = await currentUserId();
  const token = clean(formData.get("token"));
  if (!token) redirect("/");

  const { error } = await supabase.rpc("accept_household_invitation", { invite_token: token });
  if (error) redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  redirect("/?section=household&joined=1");
}
