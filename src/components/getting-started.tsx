"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const DISMISS_KEY = "ck:getting-started-dismissed";
const RECIPE_TARGET = 3;

// Dismissal lives in localStorage (per device). Falls back to "this visit" if storage is unavailable.
const listeners = new Set<() => void>();
let dismissedThisVisit = false;

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function readDismissed() {
  if (dismissedThisVisit) return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// Hidden during server render/hydration so the card never flashes for people who dismissed it.
function readDismissedOnServer() {
  return true;
}

function dismissGettingStarted() {
  dismissedThisVisit = true;
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Storage can be unavailable (private mode); hiding for this visit is fine.
  }
  listeners.forEach((listener) => listener());
}

type Props = {
  recipeCount: number;
  hasPlannedDinner: boolean;
  memberCount: number;
  justOnboarded: boolean;
  onAddRecipe: () => void;
  onOpenPlan: () => void;
};

export function GettingStarted({ recipeCount, hasPlannedDinner, memberCount, justOnboarded, onAddRecipe, onOpenPlan }: Props) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, readDismissedOnServer);

  const steps = [
    {
      id: "recipes",
      done: recipeCount >= RECIPE_TARGET,
      title: recipeCount >= RECIPE_TARGET ? `${recipeCount} recipes saved` : `Add ${RECIPE_TARGET} go-to recipes`,
      detail: recipeCount >= RECIPE_TARGET ? "Your recipe bank is ready for planning." : `${recipeCount} of ${RECIPE_TARGET} so far. Paste a link or just type a name.`,
      action: <button className="secondary getting-started-action" type="button" onClick={onAddRecipe}>Add a recipe</button>,
    },
    {
      id: "plan",
      done: hasPlannedDinner,
      title: hasPlannedDinner ? "Dinner is on the plan" : "Plan your first dinner",
      detail: hasPlannedDinner ? "Fill in the rest of the week whenever you’re ready." : "Tap “Choose dinner” on any day in The Plan.",
      action: <button className="secondary getting-started-action" type="button" onClick={onOpenPlan}>Open the plan</button>,
    },
    {
      id: "invite",
      done: memberCount > 1,
      title: memberCount > 1 ? "Your co-planner is in" : "Invite your co-planner",
      detail: memberCount > 1 ? "You’re both seeing the same recipes and plan." : "Share a private link so your partner or family sees the same plan.",
      action: <Link className="secondary getting-started-action link-button" href="/household">Invite someone</Link>,
    },
  ];

  const remaining = steps.filter((step) => !step.done).length;
  if (dismissed) return null;
  if (!remaining && !justOnboarded) return null;

  return (
    <section className="getting-started" aria-labelledby="getting-started-title">
      <div className="getting-started-heading">
        <div>
          <p className="eyebrow">{justOnboarded ? "YOU’RE ALL SET" : "GETTING STARTED"}</p>
          <h2 id="getting-started-title">{justOnboarded ? "Welcome to your kitchen" : "A few steps to a stress-free week"}</h2>
          <p>{remaining ? `${steps.length - remaining} of ${steps.length} done. Here’s what makes Cook’s Kitchen click:` : "Everything’s set up. Enjoy dinner!"}</p>
        </div>
        <button className="text-button getting-started-dismiss" type="button" onClick={dismissGettingStarted}>
          {remaining ? "Hide for now" : "Dismiss"}
        </button>
      </div>
      <ol className="getting-started-steps">
        {steps.map((step) => (
          <li key={step.id} className={step.done ? "done" : ""}>
            <span className="getting-started-check" aria-hidden="true">{step.done ? "✓" : ""}</span>
            <div className="getting-started-copy">
              <strong>{step.title}<span className="visually-hidden">{step.done ? " (done)" : " (to do)"}</span></strong>
              <span>{step.detail}</span>
            </div>
            {!step.done && step.action}
          </li>
        ))}
      </ol>
    </section>
  );
}
