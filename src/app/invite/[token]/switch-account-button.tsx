"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  token: string;
};

export function SwitchInviteAccountButton({ token }: Props) {
  const [loading, setLoading] = useState(false);

  async function switchAccount() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    const next = `/invite/${token}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}&invite=${encodeURIComponent(token)}`);
  }

  return (
    <button className="primary wide" type="button" onClick={switchAccount} disabled={loading}>
      {loading ? "Signing out…" : "Use the invited Google account"}
    </button>
  );
}
