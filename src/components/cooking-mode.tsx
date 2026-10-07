"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/* ---------- "Keep screen on" (Screen Wake Lock API) ---------- */

const PREF_KEY = "ck:keep-screen-on";
const prefListeners = new Set<() => void>();
let prefFallback: boolean | null = null;

function subscribePref(callback: () => void) {
  prefListeners.add(callback);
  return () => {
    prefListeners.delete(callback);
  };
}

function readPref() {
  if (prefFallback !== null) return prefFallback;
  try {
    // On by default: when a recipe is open you're usually cooking from it.
    return window.localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

function writePref(value: boolean) {
  prefFallback = value;
  try {
    window.localStorage.setItem(PREF_KEY, value ? "1" : "0");
  } catch {
    // Private mode etc. The in-memory value still applies for this visit.
  }
  prefListeners.forEach((listener) => listener());
}

function subscribeNothing() {
  return () => {};
}

function wakeLockSupported() {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

type WakeLockStatus = "idle" | "on" | "failed";

export function KeepScreenOn() {
  const supported = useSyncExternalStore(subscribeNothing, wakeLockSupported, () => false);
  const enabled = useSyncExternalStore(subscribePref, readPref, () => false);
  const [status, setStatus] = useState<WakeLockStatus>("idle");

  useEffect(() => {
    if (!supported || !enabled) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
        setStatus("on");
        lock.addEventListener("release", () => {
          if (!cancelled) setStatus("idle");
        });
      } catch {
        // Low battery mode, an iframe, or the browser wants a tap first. The toggle stays usable.
        if (!cancelled) setStatus("failed");
      }
    }

    // The lock is dropped whenever the app is backgrounded; grab it again when it comes back.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (sentinel && !sentinel.released) void sentinel.release();
      setStatus("idle");
    };
  }, [supported, enabled]);

  if (!supported) return null;

  const isOn = enabled && status === "on";
  const hint = !enabled ? "Off" : status === "failed" ? "Tap to retry" : isOn ? "On" : "…";

  return (
    <button
      type="button"
      className={`keep-awake-toggle${isOn ? " is-on" : ""}`}
      aria-pressed={enabled}
      onClick={() => {
        if (enabled && status === "failed") {
          // Retry from a real tap, which some browsers require.
          writePref(false);
          window.setTimeout(() => writePref(true), 0);
          return;
        }
        writePref(!enabled);
      }}
    >
      <span className="keep-awake-icon" aria-hidden="true">☀︎</span>
      <span className="keep-awake-label">Keep screen on</span>
      <span className="keep-awake-state" aria-live="polite">{hint}</span>
    </button>
  );
}

/* ---------- Tap-to-check ingredients and steps ---------- */

type CookingListsProps = {
  ingredients: string[];
  instructions: string[];
};

export function CookingLists({ ingredients, instructions }: CookingListsProps) {
  const [gotIngredients, setGotIngredients] = useState<Set<number>>(() => new Set());
  const [doneSteps, setDoneSteps] = useState<Set<number>>(() => new Set());
  const anyChecked = gotIngredients.size > 0 || doneSteps.size > 0;

  function toggle(setter: typeof setGotIngredients, index: number) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <>
      <div className="cooking-toolbar">
        <KeepScreenOn />
        {anyChecked && (
          <button type="button" className="text-button cooking-reset" onClick={() => { setGotIngredients(new Set()); setDoneSteps(new Set()); }}>
            Clear checks
          </button>
        )}
      </div>

      <div className="recipe-cook-grid">
        <section className="recipe-cook-card ingredients-card">
          <div className="recipe-section-heading">
            <p className="eyebrow">WHAT YOU NEED</p>
            <h2>Ingredients</h2>
            {ingredients.length > 0 && <p className="cooking-tip">Tap items as you gather them.</p>}
          </div>
          {ingredients.length ? (
            <ul className="ingredient-list checkable-list">
              {ingredients.map((ingredient, index) => {
                const checked = gotIngredients.has(index);
                return (
                  <li key={`${ingredient}-${index}`} className={checked ? "is-checked" : ""}>
                    <label>
                      <input type="checkbox" checked={checked} onChange={() => toggle(setGotIngredients, index)} />
                      <span className="check-box" aria-hidden="true">{checked ? "✓" : ""}</span>
                      <span className="check-text">{ingredient}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : <p className="recipe-empty-copy">No ingredients have been added yet.</p>}
        </section>

        <section className="recipe-cook-card instructions-card">
          <div className="recipe-section-heading">
            <p className="eyebrow">HOW TO MAKE IT</p>
            <h2>Instructions</h2>
            {instructions.length > 0 && <p className="cooking-tip">Tap a step when it’s done.</p>}
          </div>
          {instructions.length ? (
            <ol className="instruction-list checkable-list">
              {instructions.map((instruction, index) => {
                const checked = doneSteps.has(index);
                return (
                  <li key={`${instruction}-${index}`} className={checked ? "is-checked" : ""}>
                    <label>
                      <input type="checkbox" checked={checked} onChange={() => toggle(setDoneSteps, index)} aria-label={`Step ${index + 1} done`} />
                      <span className="step-number" aria-hidden="true">{checked ? "✓" : index + 1}</span>
                      <p>{instruction}</p>
                    </label>
                  </li>
                );
              })}
            </ol>
          ) : <p className="recipe-empty-copy">No instructions have been added yet.</p>}
        </section>
      </div>
    </>
  );
}
