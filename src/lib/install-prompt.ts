"use client";

/**
 * Tracks whether we can offer "Install app":
 *  - "prompt": Chrome/Edge/Android fired beforeinstallprompt (we can show the native install dialog).
 *  - "ios":    iPhone/iPad Safari, where installing is Share → Add to Home Screen.
 *  - "none":   already installed/standalone, dismissed, or not supported.
 * The listener is attached as soon as this module loads (it's imported by the root layout's
 * service-worker registrar) so an early beforeinstallprompt event isn't missed.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallHintKind = "prompt" | "ios" | "none";

const DISMISS_KEY = "ck:install-hint-dismissed";
const listeners = new Set<() => void>();
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let dismissedThisVisit = false;
let attached = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function attach() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // We show our own subtle hint instead of the browser's mini-infobar.
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    dismissInstallHint();
  });
}

attach();

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1);
  const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua);
  return iOS && safari;
}

function isDismissed() {
  if (dismissedThisVisit) return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function getInstallHintKind(): InstallHintKind {
  if (typeof window === "undefined" || isStandalone() || isDismissed()) return "none";
  if (deferredPrompt) return "prompt";
  if (isIosSafari()) return "ios";
  return "none";
}

export function getServerInstallHintKind(): InstallHintKind {
  return "none";
}

export function subscribeInstallHint(listener: () => void) {
  attach();
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function dismissInstallHint() {
  dismissedThisVisit = true;
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Private mode: hiding for this visit is fine.
  }
  emit();
}

/** Opens the browser's install dialog (Chrome/Edge/Android). */
export async function promptInstall() {
  const event = deferredPrompt;
  if (!event) return;
  deferredPrompt = null;
  await event.prompt();
  const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" as const }));
  // Either way, don't keep nagging on this device.
  if (choice.outcome === "accepted" || choice.outcome === "dismissed") dismissInstallHint();
}
