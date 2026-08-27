"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function ErrorPage({
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
    <main className="legal-page">
      <section className="legal-shell">
        <div className="legal-card">
          <p className="eyebrow">SOMETHING WENT WRONG</p>
          <h1>We hit a snag.</h1>
          <p className="profile-section-copy">
            Cook&apos;s Kitchen couldn&apos;t finish that request. The error has been logged so it can be investigated.
          </p>
          <div className="inline-actions">
            <button className="primary" type="button" onClick={reset}>Try again</button>
            <a className="secondary link-button" href="/">Back to my kitchen</a>
          </div>
        </div>
      </section>
    </main>
  );
}
