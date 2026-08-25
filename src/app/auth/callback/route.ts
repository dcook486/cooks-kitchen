import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function redirectToApp(request: Request, next: string) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (process.env.NODE_ENV === "development") {
    return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  if (forwardedHost) {
    return NextResponse.redirect(new URL(next, `${forwardedProto}://${forwardedHost}`));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));
  const providerError = requestUrl.searchParams.get("error_description");

  if (providerError) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", providerError);
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectToApp(request, next);
    }

    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", error.message);
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "Google sign-in did not return an authorization code.");
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}
