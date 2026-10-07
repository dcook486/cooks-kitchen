"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options<T> = {
  /** Runs the real change once the undo window has passed (normal path). Resolve false if it failed. */
  commit: (item: T) => Promise<boolean>;
  /** Runs the real change when the page is being left mid-window; must survive unload (keepalive fetch). */
  flush: (item: T) => void;
  /** Optional change that is already pending on first render (e.g. arriving from another page). */
  initial?: T | null;
};

/**
 * Holds one "pending" change that the UI already shows as done, so the user can undo it.
 * Nothing is written until `expire()` (after the toast timer), a new change replaces it,
 * the component unmounts (in-app navigation), or the page is hidden/unloaded.
 */
export function useUndoable<T extends { id: string }>({ commit, flush, initial = null }: Options<T>) {
  const [pending, setPending] = useState<T | null>(initial);
  // Ids whose real change is running or done; they stay hidden so nothing flickers back while the server catches up.
  const [settledIds, setSettledIds] = useState<string[]>([]);
  const pendingRef = useRef<T | null>(initial);
  const optionsRef = useRef({ commit, flush });
  const mountedRef = useRef(false);

  useEffect(() => {
    optionsRef.current = { commit, flush };
  });

  const setBoth = useCallback((value: T | null) => {
    pendingRef.current = value;
    setPending(value);
  }, []);

  const commitItem = useCallback(async (item: T) => {
    setSettledIds((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
    let ok = false;
    try {
      ok = await optionsRef.current.commit(item);
    } catch {
      ok = false;
    }
    if (!ok) setSettledIds((ids) => ids.filter((id) => id !== item.id));
  }, []);

  const start = useCallback((item: T) => {
    const previous = pendingRef.current;
    if (previous?.id === item.id) return;
    if (previous) void commitItem(previous);
    setBoth(item);
  }, [commitItem, setBoth]);

  const undo = useCallback(() => setBoth(null), [setBoth]);

  const expire = useCallback(() => {
    const item = pendingRef.current;
    setBoth(null);
    if (item) void commitItem(item);
  }, [commitItem, setBoth]);

  const isHidden = useCallback((id: string) => pending?.id === id || settledIds.includes(id), [pending, settledIds]);

  useEffect(() => {
    mountedRef.current = true;

    function flushNow() {
      const item = pendingRef.current;
      if (!item) return;
      pendingRef.current = null;
      optionsRef.current.flush(item);
    }

    function onPageShow(event: PageTransitionEvent) {
      // Restored from the back/forward cache after we already flushed: drop the stale toast.
      if (event.persisted && !pendingRef.current) setPending(null);
    }

    window.addEventListener("pagehide", flushNow);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", flushNow);
      window.removeEventListener("pageshow", onPageShow);
      // Defer so React Strict Mode's dev-only remount doesn't trigger a flush; a real unmount (navigation) does.
      window.setTimeout(() => {
        if (!mountedRef.current) flushNow();
      }, 0);
    };
  }, []);

  return { pending, start, undo, expire, isHidden };
}

/** Finalizes an undoable recipe change while the page unloads. */
export function flushRecipeChange(kind: "delete_recipe" | "remove_photo", id: string) {
  try {
    void fetch("/api/recipes/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    // If the browser refuses, the change simply doesn't happen; nothing is lost.
  }
}
