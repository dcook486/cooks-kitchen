"use client";

import { useState, useSyncExternalStore } from "react";

function subscribeNothing() {
  return () => {};
}

function clipboardReadable() {
  return typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";
}

type Props = {
  onText: (text: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Reads the clipboard on tap. Hidden where the browser can't do that; on iPhone, Safari shows
 * its own small "Paste" bubble to confirm, which is expected.
 */
export function PasteButton({ onText, label = "Paste", className = "", disabled }: Props) {
  const supported = useSyncExternalStore(subscribeNothing, clipboardReadable, () => false);
  const [note, setNote] = useState("");

  if (!supported) return null;

  async function paste() {
    setNote("");
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setNote("Your clipboard is empty. Copy the recipe link or text first.");
        return;
      }
      onText(text);
    } catch {
      setNote("Couldn’t read your clipboard. Long-press the box and choose Paste instead.");
    }
  }

  return (
    <>
      <button type="button" className={`secondary paste-button ${className}`.trim()} onClick={() => void paste()} disabled={disabled}>
        <span aria-hidden="true">📋</span> {label}
      </button>
      {note && <p className="paste-note" role="status">{note}</p>}
    </>
  );
}
