"use client";

import type { ComponentProps, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type Props = Omit<ComponentProps<"button">, "type"> & {
  /** Label shown while the form is submitting, e.g. "Saving…". */
  pendingLabel?: string;
  /** When set, the user must confirm before the form submits. */
  confirmMessage?: string;
};

/**
 * Submit button that shows a pending label and disables itself while its form
 * is submitting, so people know their tap registered and don't double-submit.
 * Works for server-action forms (via useFormStatus) and plain GET forms (via
 * the form's submit event, reset when the page is restored from history).
 */
export function SubmitButton({ children, pendingLabel, confirmMessage, disabled, onClick, className, ...rest }: Props) {
  const { pending: actionPending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form || (form.getAttribute("method") ?? "").toLowerCase() !== "get") return;

    const onSubmit = (event: SubmitEvent) => {
      if (!event.defaultPrevented) setNavigating(true);
    };
    const onPageShow = () => setNavigating(false);

    form.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const pending = actionPending || navigating;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      ref={buttonRef}
      type="submit"
      className={`${className ?? ""}${pending ? " is-pending" : ""}`.trim() || undefined}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={handleClick}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
