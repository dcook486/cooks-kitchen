"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f8f7f4", color: "#2d4050", fontFamily: "Inter, system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "min(560px, 100%)", background: "white", border: "1px solid #e3dfdd", borderRadius: 24, padding: 36, boxShadow: "0 16px 42px rgba(45,64,80,.07)" }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#738372" }}>COOK&apos;S KITCHEN</p>
            <h1 style={{ margin: 0, fontSize: 36 }}>We hit a snag.</h1>
            <p style={{ lineHeight: 1.6, color: "#6f7b82" }}>The error has been logged. Try the page again, or return to your kitchen.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
              <button type="button" onClick={reset} style={{ border: 0, borderRadius: 12, background: "#2d4050", color: "white", padding: "11px 16px", fontWeight: 800, cursor: "pointer" }}>Try again</button>
              <a href="/" style={{ border: "1px solid #e3dfdd", borderRadius: 12, color: "#2d4050", padding: "10px 16px", fontWeight: 800, textDecoration: "none" }}>Back to my kitchen</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
