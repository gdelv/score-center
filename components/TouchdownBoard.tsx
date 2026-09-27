"use client";

import { useEffect, useMemo, useState } from "react";
import { SLOT_LABELS, gameSlot, type GameSlot } from "@/lib/lines";
import {
  LEADER_POSITIONS,
  scorerKey,
  scorerTotals,
  type GameFilter,
  type ScorerTotal,
  type TdKind,
  type TdSeason,
  type TeamWeek,
  type Touchdown,
} from "@/lib/touchdowns";
import { Header } from "./Header";
import { LinesNav } from "./LinesNav";
import { TeamLogo } from "./TeamLogo";
import { EmptyState } from "./EmptyState";
import { SlotFilter, slotsPresent } from "./SlotFilter";

const POLL_MS = 90_000;

const KIND_LABEL: Record<TdKind, string> = { rush: "rush", rec: "rec", def: "def" };
const TOP_N = 5;

function PositionBoard({
  label,
  totals,
  selected,
  onSelect,
}: {
  label: string;
  totals: ScorerTotal[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const shown = totals.slice(0, TOP_N);
  // Say how many more share the last shown count rather than cutting a tie
  // at an arbitrary name — early in the season a dozen TEs can have 1 TD.
  const cutoff = shown[shown.length - 1]?.count;
  const moreTied = totals.slice(TOP_N).filter((t) => t.count === cutoff).length;

  return (
    <div className="rounded-sm border border-border p-4">
      <h3 className="text-xs text-ink-dim">{label}</h3>
      {shown.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-dim">No TDs yet.</p>
      ) : (
        <ol className="mt-2 space-y-0.5">
          {shown.map((t) => {
            const isSelected = t.key === selected;
            return (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => onSelect(t.key)}
                  aria-pressed={isSelected}
                  className="flex min-h-9 w-full items-center gap-2 text-left text-sm"
                >
                  <span
                    className={`truncate ${isSelected ? "font-semibold text-amber" : "font-medium text-ink"}`}
                  >
                    {t.player}
                  </span>
                  <span className="shrink-0 text-xs text-ink-dim">{t.team}</span>
                  <span className="tabular ml-auto shrink-0 font-display text-lg font-bold text-ink">
                    {t.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {moreTied > 0 && (
        <p className="tabular mt-1 text-xs text-ink-dim">
          +{moreTied} more with {cutoff}
        </p>
      )}
    </div>
  );
}

interface CellScorer {
  player: string;
  count: number;
  kinds: TdKind[];
  texts: string[];
}

/** One player per line, first-scored order, with their TD count in this game. */
function groupScorers(touchdowns: Touchdown[]): CellScorer[] {
  const byPlayer = new Map<string, CellScorer>();
  for (const td of touchdowns) {
    const entry = byPlayer.get(td.player) ?? { player: td.player, count: 0, kinds: [], texts: [] };
    entry.count++;
    if (!entry.kinds.includes(td.kind)) entry.kinds.push(td.kind);
    entry.texts.push(td.text);
    byPlayer.set(td.player, entry);
  }
  return [...byPlayer.values()];
}

function WeekCell({
  teamId,
  game,
  outsideSlot,
  selected,
  onSelect,
}: {
  teamId: string;
  game: TeamWeek | undefined;
  /** The game exists but isn't in the time slot being filtered to. */
  outsideSlot: boolean;
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  if (!game) return <span className="text-[13px] italic text-ink-dim">Bye</span>;
  if (outsideSlot) return <span className="text-[13px] text-ink-dim">—</span>;

  const scorers = groupScorers(game.touchdowns);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-dim">
        {game.state === "in" && (
          <span className="h-1.5 w-1.5 rounded-full bg-turf" aria-label="Live" />
        )}
        <span className="tabular">
          {game.home ? "vs" : "@"} {game.opponent}
        </span>
      </div>
      {game.state === "pre" ? (
        game.projected.length > 0 ? (
          <div>
            <p className="text-[11px] italic text-ink-dim">Projected</p>
            <ul className="space-y-0.5">
              {game.projected.map((p) => (
                <li
                  key={p.player}
                  className="flex items-baseline justify-between gap-2 text-[13px] leading-snug text-ink-dim"
                >
                  <span className="truncate">{p.player}</span>
                  <span className="tabular shrink-0">{Math.round(p.probability * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[13px] text-ink-dim">Not played yet</p>
        )
      ) : scorers.length === 0 ? (
        <p className="text-[13px] text-ink-dim">No TDs</p>
      ) : (
        <ul className="space-y-0.5">
          {scorers.map((s) => {
            const key = scorerKey(teamId, s.player);
            const isSelected = key === selected;
            return (
              <li key={s.player}>
                <button
                  type="button"
                  onClick={() => onSelect(key)}
                  title={s.texts.join("\n")}
                  aria-pressed={isSelected}
                  className={`text-left text-[13px] leading-snug hover:underline ${
                    isSelected ? "font-semibold text-amber" : "text-ink"
                  }`}
                >
                  {s.player}
                  {s.count > 1 && <span className="tabular font-semibold"> ×{s.count}</span>}
                  <span className="text-[11px] font-normal text-ink-dim">
                    {" "}
                    {s.kinds.map((k) => KIND_LABEL[k]).join("/")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TouchdownBoard({
  initialSeason,
  initialFetchedAt,
}: {
  initialSeason: TdSeason;
  initialFetchedAt: string;
}) {
  const [season, setSeason] = useState(initialSeason);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);
  // `${teamId}:${player}` of the scorer highlighted across the grid, if any.
  const [selected, setSelected] = useState<string | null>(null);
  // null = every time slot.
  const [slot, setSlot] = useState<GameSlot | null>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/touchdowns", { cache: "no-store" });
        if (!res.ok) return;
        const data: { season: TdSeason; fetchedAt: string } = await res.json();
        setSeason(data.season);
        setFetchedAt(data.fetchedAt);
      } catch {
        // Skip this refresh; the next interval tries again.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const slots = useMemo(
    () =>
      slotsPresent(
        season.weeks.flatMap((w) =>
          Object.values(w.teams)
            .filter((g) => g.state !== "pre")
            .map((g) => g.date),
        ),
      ),
    [season],
  );
  const inSlot = useMemo<GameFilter>(
    () => (game) => slot === null || gameSlot(game.date) === slot,
    [slot],
  );
  const slotLabel = slot ? SLOT_LABELS[slot] : null;

  const totals = useMemo(() => scorerTotals(season, inSlot), [season, inSlot]);
  const positionBoards = useMemo(
    () => LEADER_POSITIONS.map((p) => ({ ...p, totals: scorerTotals(season, inSlot, p.counts) })),
    [season, inSlot],
  );
  const selectedTotal = totals.find((t) => t.key === selected);
  // Newest week first, so the latest results are visible without scrolling
  // sideways on a phone — same order as the week tabs on /lines.
  const weeks = useMemo(() => [...season.weeks].reverse(), [season]);

  const teamTotals = useMemo(() => {
    const counts = new Map<string, number>();
    for (const week of season.weeks) {
      for (const [teamId, game] of Object.entries(week.teams)) {
        if (!inSlot(game)) continue;
        counts.set(teamId, (counts.get(teamId) ?? 0) + game.touchdowns.length);
      }
    }
    return counts;
  }, [season, inSlot]);

  // With a slot picked, only teams that played (or will play) in it.
  const visibleTeams = useMemo(
    () =>
      slot === null
        ? season.teams
        : season.teams.filter((t) =>
            season.weeks.some((w) => w.teams[t.id] && inSlot(w.teams[t.id])),
          ),
    [season, slot, inSlot],
  );

  const toggle = (key: string) => setSelected((current) => (current === key ? null : key));

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6">
      <Header fetchedAt={fetchedAt} active="lines" />

      <div className="pb-16">
        <div className="pt-5">
          <LinesNav active="touchdowns" />
        </div>
        <p className="pt-4 text-sm text-ink-dim">
          Every touchdown scorer
          {season.season ? ` of the ${season.season} NFL season` : ""}, by team and week. Tap a
          player to highlight all of their scores.
        </p>

        {weeks.length === 0 ? (
          <EmptyState message="No NFL games played yet this season." />
        ) : (
          <>
            <div className="pt-6">
              <SlotFilter slots={slots} value={slot} onChange={setSlot} />
            </div>

            <div className="pt-6">
              <h2 className="mb-2 text-sm font-medium text-ink-dim">
                Most TDs by position{slotLabel ? ` · ${slotLabel}` : ""}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {positionBoards.map((board) => (
                  <PositionBoard
                    key={board.id}
                    label={board.label}
                    totals={board.totals}
                    selected={selected}
                    onSelect={toggle}
                  />
                ))}
              </div>
            </div>

            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-6 text-xs text-ink-dim">
              <span>
                <span className="text-ink">rush</span> rushing ·{" "}
                <span className="text-ink">rec</span> receiving ·{" "}
                <span className="text-ink">def</span> defensive/special-teams return ·{" "}
                <span className="text-ink">%</span> projected chance to score, from ESPN&apos;s
                fantasy projections
              </span>
              {selectedTotal && (
                <span className="flex items-center gap-2">
                  <span className="text-ink">
                    {selectedTotal.player} ({selectedTotal.team}): {selectedTotal.count} TD
                    {selectedTotal.count === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="min-h-11 px-2 font-medium text-amber hover:underline"
                  >
                    Clear
                  </button>
                </span>
              )}
            </div>

            <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              <table className="w-max border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-border bg-bg py-2 pr-4 text-xs font-medium text-ink-dim">
                      Team
                    </th>
                    {weeks.map((week) => (
                      <th
                        key={week.key}
                        className="border-b border-border px-3 py-2 font-display text-base font-bold whitespace-nowrap text-ink"
                      >
                        {week.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTeams.map((team) => (
                    <tr key={team.id}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-border bg-bg py-2.5 pr-4 align-top"
                      >
                        <span className="flex items-center gap-2">
                          <TeamLogo src={team.logo} alt={team.abbreviation} size={22} />
                          <span className="text-sm font-semibold text-ink">
                            {team.abbreviation}
                          </span>
                          <span className="tabular text-xs font-normal text-ink-dim">
                            {teamTotals.get(team.id) ?? 0}
                          </span>
                        </span>
                      </th>
                      {weeks.map((week) => {
                        const game = week.teams[team.id];
                        const hasSelected =
                          selected !== null &&
                          !!game &&
                          inSlot(game) &&
                          game.touchdowns.some((td) => scorerKey(team.id, td.player) === selected);
                        return (
                          <td
                            key={week.key}
                            className={`w-44 min-w-44 border-b border-border px-3 py-2.5 align-top ${
                              hasSelected
                                ? "bg-surface-raised shadow-[inset_2px_0_0_var(--amber)]"
                                : ""
                            }`}
                          >
                            <WeekCell
                              teamId={team.id}
                              game={game}
                              outsideSlot={!!game && !inSlot(game)}
                              selected={selected}
                              onSelect={toggle}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
