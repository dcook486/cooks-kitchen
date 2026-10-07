"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export type ToastTone = "success" | "info" | "error";

export type ToastMessage = {
  /** Changing the id restarts the timer (use a new id for each message). */
  id: string;
  text: string;
  tone?: ToastTone;
};

type ToastProps = {
  message: string;
  tone?: ToastTone;
  /** How long the toast stays up. Hover or keyboard focus pauses the countdown. */
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  /** Called when the countdown ends (not when the user taps the action or ×). */
  onExpire?: () => void;
  onDismiss: () => void;
};

export function Toast({ message, tone = "success", duration = 5000, actionLabel, onAction, onExpire, onDismiss }: ToastProps) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(duration);
  const callbacksRef = useRef({ onExpire, onDismiss });

  useEffect(() => {
    callbacksRef.current = { onExpire, onDismiss };
  });

  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      remainingRef.current = 0;
      callbacksRef.current.onExpire?.();
      callbacksRef.current.onDismiss();
    }, remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [paused]);

  return (
    <div
      className={`toast toast-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <span className="toast-message">{message}</span>
      {actionLabel && onAction && (
        <button className="toast-action" type="button" onClick={onAction}>{actionLabel}</button>
      )}
      <button className="toast-close" type="button" onClick={onDismiss} aria-label="Dismiss notification">×</button>
    </div>
  );
}

/** Fixed bottom-of-screen stack that holds one or more toasts. */
export function ToastRegion({ children }: { children: ReactNode }) {
  return <div className="toast-region">{children}</div>;
}
