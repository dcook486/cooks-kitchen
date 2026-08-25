"use client";

import { useEffect, useMemo, useState } from "react";
import { logout } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

type Props = {
  displayName: string;
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CK";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function safeAvatarUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;

    let avatarUrl = url.toString();
    if (url.hostname.endsWith("googleusercontent.com")) {
      avatarUrl = avatarUrl.replace(/=s\d+(?:-c)?(?:-[a-z0-9-]+)?$/i, "=s256");
    }
    return avatarUrl;
  } catch {
    return null;
  }
}

export function AccountMenu({ displayName }: Props) {
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const initials = useMemo(() => initialsFor(displayName), [displayName]);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;

      setEmail(data.user.email ?? null);
      const metadata = data.user.user_metadata ?? {};
      setAvatarUrl(safeAvatarUrl(metadata.avatar_url) ?? safeAvatarUrl(metadata.picture));
    }

    loadAccount();
    return () => {
      active = false;
    };
  }, []);

  return (
    <details className="account-menu">
      <summary className="account-menu-trigger" aria-label="Open account menu">
        <span
          className={`account-avatar ${avatarUrl ? "has-image" : ""}`}
          style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
          aria-hidden="true"
        >
          {!avatarUrl && initials}
        </span>
        <span className="account-trigger-copy">
          <strong>{displayName}</strong>
          <span>Account</span>
        </span>
        <span className="account-chevron" aria-hidden="true">⌄</span>
      </summary>

      <div className="account-popover">
        <div className="account-popover-heading">
          <span
            className={`account-avatar large ${avatarUrl ? "has-image" : ""}`}
            style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
            aria-hidden="true"
          >
            {!avatarUrl && initials}
          </span>
          <div>
            <strong>{displayName}</strong>
            {email && <span>{email}</span>}
          </div>
        </div>

        <div className="account-menu-links">
          <a href="/profile"><span>Profile</span><span aria-hidden="true">→</span></a>
          <a href="/household"><span>Household</span><span aria-hidden="true">→</span></a>
        </div>

        <form action={logout} className="account-signout-form">
          <button type="submit">Sign out</button>
        </form>
      </div>
    </details>
  );
}
