"use client";

import { useSearchParams } from "next/navigation";
import styles from "./recipe-history.module.css";

type Props = {
  dates: string[];
};

function formatHistoryDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function RecipeHistory({ dates }: Props) {
  const searchParams = useSearchParams();
  if (searchParams.get("edit") === "1") return null;

  const lastCooked = dates[0] ? formatHistoryDate(dates[0]) : null;

  return (
    <section className={styles.shell} aria-labelledby="recipe-history-heading">
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>MEAL HISTORY</p>
            <h2 id="recipe-history-heading">Previously cooked</h2>
          </div>
          {dates.length > 0 && (
            <div className={styles.summary}>
              <span>{dates.length === 1 ? "1 time" : `${dates.length} times`}</span>
              <strong>Last: {lastCooked}</strong>
            </div>
          )}
        </div>

        {dates.length > 0 ? (
          <div className={styles.dates}>
            {dates.map((date) => (
              <time className={styles.date} dateTime={date} key={date}>
                <span aria-hidden="true">✓</span>
                {formatHistoryDate(date)}
              </time>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            No past dates yet. Once this recipe appears on a past dinner plan, its history will show here.
          </p>
        )}

        <p className={styles.note}>History is based on past dates saved on your household dinner plan.</p>
      </div>
    </section>
  );
}
