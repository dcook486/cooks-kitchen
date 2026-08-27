"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "development" ? "http" : "https");
  return host ? `${proto}://${host}` : "https://cooks-kitchen.vercel.app";
}

export async function requestPasswordReset(formData: FormData) {
  const email = clean(formData.get("email")).toLowerCase();
  if (!email || !email.includes("@")) {
    redirect("/forgot-password?error=Enter%20a%20valid%20email%20address.");
  }

  const supabase = await createClient();
  const origin = await requestOrigin();
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Avoid revealing whether an email address exists in Cook's Kitchen.
  if (error && /rate|limit|too many/i.test(error.message)) {
    redirect(`/forgot-password?error=${encodeURIComponent("Too many reset attempts. Wait a few minutes and try again.")}`);
  }

  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}

export async function updatePassword(formData: FormData) {
  const password = clean(formData.get("password"));
  const confirmPassword = clean(formData.get("confirm_password"));

  if (password.length < 8) {
    redirect("/reset-password?error=Use%20at%20least%208%20characters%20for%20your%20new%20password.");
  }
  if (password !== confirmPassword) {
    redirect("/reset-password?error=The%20passwords%20do%20not%20match.");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/forgot-password?error=Your%20reset%20link%20is%20no%20longer%20valid.%20Request%20a%20new%20one.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?message=Password%20updated.%20Sign%20in%20with%20your%20new%20password.");
}
