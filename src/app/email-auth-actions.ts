"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNext(value: FormDataEntryValue | null) {
  const next = clean(value);
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "development" ? "http" : "https");
  return host ? `${proto}://${host}` : "https://cooks-kitchen.vercel.app";
}

export async function signupWithEmail(formData: FormData) {
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

  const origin = await requestOrigin();
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo,
    },
  });

  if (error) {
    redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}${inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""}`);
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  redirect(`/login?message=${encodeURIComponent("Check your email to confirm your account, then continue from the link in that email.")}&next=${encodeURIComponent(next)}${inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""}`);
}
