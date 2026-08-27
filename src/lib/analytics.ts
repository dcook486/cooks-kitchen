import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProductEvent =
  | "onboarding_completed"
  | "recipe_added"
  | "recipe_imported"
  | "dinner_planned";

type PropertyValue = string | number | boolean | null;

type TrackProductEventInput = {
  supabase: SupabaseClient;
  userId: string;
  eventName: ProductEvent;
  householdId?: string | null;
  pagePath?: string | null;
  properties?: Record<string, PropertyValue>;
};

function safePagePath(value?: string | null) {
  const path = value?.trim();
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path.slice(0, 500);
}

function safeProperties(value?: Record<string, PropertyValue>) {
  if (!value) return {};

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 12)
      .filter(([key]) => /^[a-z0-9_]{1,50}$/i.test(key))
      .map(([key, propertyValue]) => [
        key,
        typeof propertyValue === "string" ? propertyValue.slice(0, 120) : propertyValue,
      ]),
  );
}

export async function trackProductEvent({
  supabase,
  userId,
  eventName,
  householdId = null,
  pagePath = null,
  properties,
}: TrackProductEventInput) {
  const { error } = await supabase.from("analytics_events").insert({
    event_name: eventName,
    user_id: userId,
    household_id: householdId,
    page_path: safePagePath(pagePath),
    properties: safeProperties(properties),
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { feature: "product_analytics", event: eventName },
    });
  }
}
