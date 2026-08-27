"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { submitFeedback } from "@/app/feedback-actions";

type Props = {
  open: boolean;
  onClose: () => void;
};

type FeedbackCategory = "bug" | "idea" | "general";

const CATEGORIES: Array<{
  value: FeedbackCategory;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: "bug",
    label: "Something broke",
    description: "Tell us what you expected and what happened.",
    icon: "!",
  },
  {
    value: "idea",
    label: "I have an idea",
    description: "Suggest a feature or improvement.",
    icon: "+",
  },
  {
    value: "general",
    label: "General feedback",
    description: "Anything else on your mind.",
    icon: "♥",
  },
];

export function FeedbackModal({ open, onClose }: Props) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;

    setPageUrl(`${window.location.pathname}${window.location.search}`);
    setError(null);
    setSent(false);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 80);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await submitFeedback({ category, message, pageUrl });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error ?? "We couldn't send that just now. Please try again.");
      return;
    }

    setMessage("");
    setSent(true);
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  const pageLabel = pageUrl.split("?")[0] || "/";

  return (
    <div
      className="feedback-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="feedback-dialog-topbar">
          <div>
            <p className="eyebrow">COOK&apos;S KITCHEN</p>
            <h2 id="feedback-title">Send feedback</h2>
          </div>
          <button className="feedback-close" type="button" onClick={handleClose} aria-label="Close feedback">
            ×
          </button>
        </div>

        {sent ? (
          <div className="feedback-success">
            <span className="feedback-success-mark" aria-hidden="true">✓</span>
            <h3>Thanks — got it.</h3>
            <p>Your feedback was sent successfully.</p>
            <button className="primary" type="button" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form className="feedback-form" onSubmit={handleSubmit}>
            <p className="feedback-intro">What would you like us to know?</p>

            <div className="feedback-categories" role="group" aria-label="Feedback type">
              {CATEGORIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`feedback-category ${category === item.value ? "active" : ""}`}
                  aria-pressed={category === item.value}
                  onClick={() => setCategory(item.value)}
                  disabled={submitting}
                >
                  <span className="feedback-category-icon" aria-hidden="true">{item.icon}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              ))}
            </div>

            <label className="feedback-message-label">
              <span>Message</span>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={4000}
                rows={6}
                placeholder={category === "bug" ? "What happened? What were you trying to do?" : "Tell us what you're thinking..."}
                required
                disabled={submitting}
              />
            </label>

            <div className="feedback-context-row">
              <span>Page included: <strong>{pageLabel}</strong></span>
              <span>{message.length}/4000</span>
            </div>

            {error && <div className="form-alert error">{error}</div>}

            <div className="feedback-actions">
              <button className="secondary" type="button" onClick={handleClose} disabled={submitting}>Cancel</button>
              <button className="primary" type="submit" disabled={submitting || !message.trim()}>
                {submitting ? "Sending..." : "Send feedback"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
