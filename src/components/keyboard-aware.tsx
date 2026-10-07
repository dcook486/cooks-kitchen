"use client";

import { useEffect } from "react";

const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image", "hidden"]);

function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return !target.readOnly;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type) && !target.readOnly;
  if (target instanceof HTMLSelectElement) return false;
  return target.isContentEditable;
}

/**
 * Adds `ck-typing` to <html> while a text field has focus so phone layouts can tuck away
 * fixed UI (bottom nav, floating buttons) that would otherwise ride on top of the keyboard.
 */
export function KeyboardAware() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    function sync() {
      window.cancelAnimationFrame(frame);
      // Wait a frame so focus moving between two fields doesn't flash the nav back in.
      frame = window.requestAnimationFrame(() => {
        root.classList.toggle("ck-typing", isTextEntry(document.activeElement));
      });
    }

    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", sync);
      root.classList.remove("ck-typing");
    };
  }, []);

  return null;
}
