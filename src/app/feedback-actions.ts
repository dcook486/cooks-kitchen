"use server";

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";

const FEEDBACK_CATEGORIES = new Set(["bug", "idea", "general"]);

type FeedbackInput = {
  category: string;
  message: string;
  pageUrl?: string;
};

type FeedbackResult = {
  ok: boolean;
  error?: string;
};

function sanitizePageUrl(value?: string) {
  const pageUrl = value?.trim();
  if (!pageUrl || !pageUrl.startsWith("/")) return null;
  return pageUrl.slice(0, 1000);
}

export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const category = input.category?.trim();
  const message = input.message?.trim();

  if (!FEEDBACK_CATEGORIES.has(category)) {
    return { ok: false, error: "Choose a feedback type." };
  }

  if (!message) {
    return { ok: false, error: "Tell us a little about what happened or what you have in mind." };
  }

  if (message.length > 4000) {
    return { ok: false, error: "Keep feedback under 4,000 characters." };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return { ok: false, error: "Your session expired. Sign in again, then resend your feedback." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    Sentry.captureException(membershipError, {
      tags: { feature: "feedback", step: "household_lookup" },
    });
  }

  const { error } = await supabase.from("feedback_submissions").insert({
    user_id: userId,
    household_id: membership?.household_id ?? null,
    category,
    message,
    page_url: sanitizePageUrl(input.pageUrl),
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { feature: "feedback", step: "insert" },
    });
    return { ok: false, error: "We couldn't send that just now. Please try again." };
  }

  return { ok: true };
}
