"use client";

import { useEffect, useMemo, useState } from "react";
import { computeRecords, type GradedWeek } from "@/lib/predictions";
import { Header } from "./Header";
import { PredictionsLeaderboard } from "./PredictionsLeaderboard";
import { PredictionsWeek } from "./PredictionsWeek";
import { EmptyState } from "./EmptyState";

const POLL_MS = 90_000;

export function PredictionsBoard({
  initialWeeks,
  initialFetchedAt,
}: {
  initialWeeks: GradedWeek[];
  initialFetchedAt: string;
}) {
  const [weeks, setWeeks] = useState(initialWeeks);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/predictions", { cache: "no-store" });
        if (!res.ok) return;
        const data: { weeks: GradedWeek[]; fetchedAt: string } = await res.json();
        setWeeks(data.weeks);
        setFetchedAt(data.fetchedAt);
      } catch {
        // Skip this refresh; the next interval tries again.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const records = useMemo(() => computeRecords(weeks), [weeks]);
  const sortedWeeks = useMemo(() => [...weeks].reverse(), [weeks]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6">
      <Header fetchedAt={fetchedAt} active="predictions" />

      <div className="pb-16">
        {weeks.length === 0 ? (
          <div className="pt-6">
            <EmptyState message="No predictions yet — check back once the first college football parlays are in." />
          </div>
        ) : (
          <>
            <div className="pt-6">
              <h2 className="mb-1 text-sm font-medium text-ink-dim">Season record</h2>
              <PredictionsLeaderboard records={records} />
            </div>

            {sortedWeeks.map((week) => (
              <PredictionsWeek key={week.id} week={week} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
