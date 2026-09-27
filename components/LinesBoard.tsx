"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SLOT_LABELS,
  gameSlot,
  summarize,
  type GameSlot,
  type LinesSummary,
  type Record3,
  type SeasonLines,
} from "@/lib/lines";
import { Header } from "./Header";
import { LineCard } from "./LineCard";
import { EmptyState } from "./EmptyState";
import { SlotFilter, slotsPresent } from "./SlotFilter";
import { LinesNav } from "./LinesNav";

const POLL_MS = 90_000;

function pct(wins: number, losses: number): string {
  const decided = wins + losses;
  return decided === 0 ? "—" : `${Math.round((wins / decided) * 100)}%`;
}

function recordText({ wins, losses, pushes }: Record3): string {
  return `${wins}–${losses}${pushes ? `–${pushes}` : ""}`;
}

function SummaryCards({ summary }: { summary: LinesSummary }) {
  const { favoritesAts: ats, totals, favoritesSu: su } = summary;
  const cards = [
    {
      title: "Favorites against the spread",
      value: recordText(ats),
      note: `${pct(ats.wins, ats.losses)} covered`,
    },
    {
      title: "Overs – unders",
      value: `${totals.over}–${totals.under}${totals.push ? `–${totals.push}` : ""}`,
      note: `${pct(totals.over, totals.under)} went over`,
    },
    {
      title: "Favorites straight up",
      value: recordText(su),
      note: `${su.losses} upset${su.losses === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.title} className="rounded-sm border border-border p-4">
          <p className="text-xs text-ink-dim">{card.title}</p>
          <p className="tabular mt-1 font-display text-3xl font-bold leading-none text-ink">
            {card.value}
          </p>
          <p className="tabular mt-1.5 text-xs text-ink-dim">{card.note}</p>
        </div>
      ))}
    </div>
  );
}

export function LinesBoard({
  initialLines,
  initialFetchedAt,
}: {
  initialLines: SeasonLines;
  initialFetchedAt: string;
}) {
  const [lines, setLines] = useState(initialLines);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);
  // null = the latest week with a finished game.
  const [pickedWeek, setPickedWeek] = useState<string | null>(null);
  // null = every time slot.
  const [slot, setSlot] = useState<GameSlot | null>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/lines", { cache: "no-store" });
        if (!res.ok) return;
        const data: { lines: SeasonLines; fetchedAt: string } = await res.json();
        setLines(data.lines);
        setFetchedAt(data.fetchedAt);
      } catch {
        // Skip this refresh; the next interval tries again.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const weeks = useMemo(() => lines.weeks.filter((w) => w.games.length > 0), [lines]);
  const allGames = useMemo(() => weeks.flatMap((w) => w.games), [weeks]);
  // Only offer slots that actually have a finished game this season, in
  // schedule order.
  const slots = useMemo(() => slotsPresent(allGames.map((g) => g.date)), [allGames]);
  const inSlot = useMemo(
    () => (game: { date: string }) => slot === null || gameSlot(game.date) === slot,
    [slot],
  );

  // The slot filter narrows the season records too — "how do favorites do on
  // Monday nights" is the question it's for.
  const season = useMemo(() => summarize(allGames.filter(inSlot)), [allGames, inSlot]);
  const week = weeks.find((w) => w.key === pickedWeek) ?? weeks[weeks.length - 1];
  const weekGames = useMemo(() => (week ? week.games.filter(inSlot) : []), [week, inSlot]);
  const weekSummary = useMemo(() => (week ? summarize(weekGames) : null), [week, weekGames]);
  const slotLabel = slot ? SLOT_LABELS[slot] : null;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6">
      <Header fetchedAt={fetchedAt} active="lines" />

      <div className="pb-16">
        <div className="pt-5">
          <LinesNav active="lines" />
        </div>
        <p className="pt-4 text-sm text-ink-dim">
          Closing DraftKings lines for every finished NFL game
          {lines.season ? ` of the ${lines.season} season` : ""}, graded against the final score.
        </p>

        {!week || !weekSummary ? (
          <EmptyState message="No finished NFL games with lines yet this season." />
        ) : (
          <>
            <div className="pt-6">
              <h2 className="mb-2 text-sm font-medium text-ink-dim">
                Season so far{slotLabel ? ` · ${slotLabel}` : ""} · {season.games} game
                {season.games === 1 ? "" : "s"}
              </h2>
              <SummaryCards summary={season} />
            </div>

            <div className="-mx-4 mt-8 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              <div className="inline-flex gap-1 rounded-sm border border-border bg-surface p-1">
                {[...weeks].reverse().map((w) => {
                  const isActive = w.key === week.key;
                  return (
                    <button
                      key={w.key}
                      type="button"
                      onClick={() => setPickedWeek(w.key)}
                      aria-pressed={isActive}
                      className={`min-h-9 shrink-0 whitespace-nowrap rounded-sm px-4 text-sm font-medium transition-colors ${
                        isActive ? "bg-amber text-amber-ink" : "text-ink-dim hover:text-ink"
                      }`}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <SlotFilter slots={slots} value={slot} onChange={setSlot} />
            </div>

            <section className="pt-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
                <h2 className="font-display text-xl font-bold text-ink">
                  {week.label}
                  {slotLabel && <span className="text-ink-dim"> · {slotLabel}</span>}
                </h2>
                <p className="tabular text-xs text-ink-dim">
                  Favorites {recordText(weekSummary.favoritesAts)} ATS · Overs{" "}
                  {weekSummary.totals.over}–{weekSummary.totals.under}
                  {week.remaining > 0
                    ? ` · ${week.remaining} game${week.remaining === 1 ? "" : "s"} still to play`
                    : ""}
                </p>
              </div>
              {weekGames.length === 0 ? (
                <EmptyState
                  message={`No finished ${slotLabel} games in ${week.label}${
                    week.remaining > 0 ? " yet" : ""
                  }.`}
                  actionLabel="Show all games"
                  onAction={() => setSlot(null)}
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-6 xl:grid-cols-3">
                  {weekGames.map((game) => (
                    <LineCard key={game.id} game={game} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
