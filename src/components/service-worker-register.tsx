"use client";

import { useEffect } from "react";
// Side effect: start listening for beforeinstallprompt as early as possible on every page.
import "@/lib/install-prompt";

/** Registers /sw.js in production builds only (dev keeps normal hot reload behavior). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Registration failing (e.g. private mode) just means no offline page; the app works normally.
    });
  }, []);

  return null;
}
