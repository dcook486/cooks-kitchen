"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  next: string;
  label?: string;
};

export default function GoogleSignInButton({ next, label = "Continue with Google" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);

    try {
      const supabase = createClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        window.location.assign(
          `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
        );
      }
    } catch {
      window.location.assign(
        `/login?error=${encodeURIComponent("Could not start Google sign-in. Please try again.")}&next=${encodeURIComponent(next)}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className="secondary wide google-sign-in-button"
      type="button"
      onClick={handleGoogleSignIn}
      disabled={loading}
      aria-busy={loading}
    >
      <span className="google-sign-in-mark" aria-hidden="true">G</span>
      {loading ? "Opening Google…" : label}
    </button>
  );
}
