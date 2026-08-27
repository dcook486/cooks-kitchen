"use client";

import { useCallback, useEffect, useState } from "react";
import { FeedbackModal } from "@/components/feedback-modal";
import { createClient } from "@/lib/supabase/client";

export function AuthenticatedFeedbackFooter() {
  const [signedIn, setSignedIn] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadSession() {
      const { data } = await supabase.auth.getUser();
      if (active) setSignedIn(Boolean(data.user));
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session?.user));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!signedIn) return null;

  return (
    <>
      <footer className="beta-feedback-footer">
        <div className="beta-feedback-footer-copy">
          <span className="beta-feedback-badge">BETA</span>
          <div>
            <strong>Help shape Cook&apos;s Kitchen</strong>
            <span>Found something confusing, broken, or worth improving?</span>
          </div>
        </div>
        <button className="beta-feedback-button" type="button" onClick={() => setFeedbackOpen(true)}>
          <span aria-hidden="true">♡</span>
          Send feedback
        </button>
      </footer>

      <FeedbackModal open={feedbackOpen} onClose={closeFeedback} />
    </>
  );
}
