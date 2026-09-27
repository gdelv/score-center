"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PICKERS,
  gradeParlays,
  openWeek,
  pickerRecords,
  type GradedLeg,
  type GradedWeek,
  type ParlayStatus,
  type Picker,
  type StoredPick,
} from "@/lib/parlay";
import type { TdSeason } from "@/lib/touchdowns";
import { matchDayTime } from "@/lib/format";
import { useHasMounted } from "@/hooks/useHasMounted";
import { Header } from "./Header";
import { LinesNav } from "./LinesNav";

const POLL_MS = 60_000;

const PARLAY_STATUS: Record<ParlayStatus, { label: string; className: string }> = {
  won: { label: "Won", className: "text-amber" },
  busted: { label: "Busted", className: "text-loss" },
  alive: { label: "Alive", className: "text-turf" },
  pending: { label: "Not started", className: "text-ink-dim" },
};

function LegStatus({ leg }: { leg: GradedLeg }) {
  const mounted = useHasMounted();
  switch (leg.status) {
    case "hit":
      return <span className="font-semibold text-amber">Hit</span>;
    case "miss":
      return <span className="font-semibold text-loss">Miss</span>;
    case "no-game":
      return <span className="font-semibold text-loss">No game</span>;
    case "live":
      return (
        <span className="flex items-center gap-1.5 font-semibold text-turf">
          <span className="h-1.5 w-1.5 rounded-full bg-turf" aria-hidden />
          Live
        </span>
      );
    default:
      // Guest-local kickoff time: mount-gated like every other clock time.
      return (
        <span className="tabular text-ink-dim">
          {mounted && leg.kickoff ? matchDayTime(leg.kickoff) : " "}
        </span>
      );
  }
}

function WeekLegs({
  week,
  teamAbbr,
  showMissingPickers,
}: {
  week: GradedWeek | null;
  teamAbbr: Map<string, string>;
  showMissingPickers: boolean;
}) {
  const legs = week?.legs ?? [];
  const missing = showMissingPickers
    ? PICKERS.filter((p) => !legs.some((l) => l.picker === p))
    : [];

  return (
    <ul className="divide-y divide-border rounded-sm border border-border">
      {legs.map((leg) => (
        <li
          key={`${leg.picker ?? "history"}-${leg.player}`}
          className="flex min-h-11 items-center gap-3 px-3.5 py-2 text-[14px]"
        >
          {leg.picker && <span className="w-20 shrink-0 text-ink-dim">{leg.picker}</span>}
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-ink">{leg.player}</span>
            <span className="text-xs text-ink-dim">
              {" "}
              {teamAbbr.get(leg.teamId) ?? ""}
              {leg.position ? ` · ${leg.position}` : ""}
            </span>
          </span>
          <span className="shrink-0 text-[13px]">
            <LegStatus leg={leg} />
          </span>
        </li>
      ))}
      {missing.map((picker) => (
        <li key={picker} className="flex min-h-11 items-center gap-3 px-3.5 py-2 text-[14px]">
          <span className="w-20 shrink-0 text-ink-dim">{picker}</span>
          <span className="text-ink-dim italic">No pick yet</span>
        </li>
      ))}
    </ul>
  );
}

function WeekHeading({ label, week }: { label: string; week: GradedWeek | null }) {
  const status = week ? PARLAY_STATUS[week.status] : null;
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-border pb-2">
      <h2 className="font-display text-xl font-bold text-ink">{label}</h2>
      {week && status && (
        <span className="tabular text-sm">
          <span className="text-ink-dim">{week.legs.length}-leg · </span>
          <span className={`font-semibold ${status.className}`}>{status.label}</span>
        </span>
      )}
    </div>
  );
}

function PickForm({
  season,
  picks,
  onSaved,
}: {
  season: TdSeason;
  picks: StoredPick[];
  onSaved: () => Promise<void>;
}) {
  const mounted = useHasMounted();
  const [picker, setPicker] = useState<Picker | "">("");
  const [gameKey, setGameKey] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const week = openWeek(season);
  const teamAbbr = useMemo(
    () => new Map(season.teams.map((t) => [t.id, t.abbreviation])),
    [season],
  );

  // Games still open for picks, one entry per matchup (keyed by home team).
  // "Not started" comes from the data (refreshed every minute); the server
  // re-checks the actual kickoff time, so a pick in the last minute before
  // kickoff gets a clear "already kicked off" instead of slipping through.
  const games = useMemo(() => {
    if (!week) return [];
    return Object.entries(week.teams)
      .filter(([, g]) => g.home && g.state === "pre")
      .map(([homeId, g]) => {
        const awayId = Object.entries(week.teams).find(
          ([id, other]) =>
            id !== homeId && other.date === g.date && other.opponent === teamAbbr.get(homeId),
        )?.[0];
        return { key: homeId, homeId, awayId, date: g.date };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [week, teamAbbr]);

  const game = games.find((g) => g.key === gameKey);
  const existing = picks.find((p) => p.picker === picker && p.weekKey === week?.key);

  if (!week) {
    return (
      <p className="rounded-sm border border-border p-4 text-sm text-ink-dim">
        No week is open for picks right now — check back once the next week&apos;s games are on the
        schedule.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!picker || !game || !playerId) return;
    const teamId = [game.homeId, game.awayId].find((id) =>
      id ? week!.teams[id].projected.some((p) => p.id === playerId) : false,
    );
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/parlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picker, playerId, teamId }),
      });
      const data: { pick?: StoredPick; error?: string } = await res.json();
      if (!res.ok || !data.pick) {
        setMessage({ text: data.error ?? "Couldn't save that pick.", error: true });
      } else {
        setMessage({ text: `Saved: ${picker} has ${data.pick.player}.`, error: false });
        setGameKey("");
        setPlayerId("");
        await onSaved();
      }
    } catch {
      setMessage({ text: "Couldn't reach the server — try again.", error: true });
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    "min-h-11 w-full rounded-sm border border-border bg-surface px-3 text-[15px] text-ink disabled:opacity-50";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-sm border border-border p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-dim">Who are you?</span>
          <select
            value={picker}
            onChange={(e) => setPicker(e.target.value as Picker | "")}
            className={selectClass}
            required
          >
            <option value="">Choose your name</option>
            {PICKERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-dim">Game</span>
          <select
            value={gameKey}
            onChange={(e) => {
              setGameKey(e.target.value);
              setPlayerId("");
            }}
            className={selectClass}
            required
          >
            <option value="">{games.length ? "Choose a game" : "No games left to pick"}</option>
            {games.map((g) => (
              <option key={g.key} value={g.key}>
                {teamAbbr.get(g.awayId ?? "")} @ {teamAbbr.get(g.homeId)}
                {mounted ? ` · ${matchDayTime(g.date)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-dim">Player to score a TD</span>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className={selectClass}
            disabled={!game}
            required
          >
            <option value="">{game ? "Choose a player" : "Choose a game first"}</option>
            {game &&
              [game.awayId, game.homeId].map((teamId) =>
                teamId ? (
                  <optgroup key={teamId} label={teamAbbr.get(teamId)}>
                    {week.teams[teamId].projected.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.player} · {p.position} · {Math.round(p.probability * 100)}%
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          disabled={saving || !picker || !playerId}
          className="min-h-11 rounded-sm bg-amber px-5 text-[15px] font-semibold text-amber-ink disabled:opacity-50"
        >
          {saving ? "Saving…" : existing ? "Change pick" : "Lock in pick"}
        </button>
        {existing && !message && (
          <span className="text-sm text-ink-dim">
            {picker}&apos;s current pick: <span className="text-ink">{existing.player}</span>
          </span>
        )}
        {message && (
          <span role="status" className={`text-sm ${message.error ? "text-loss" : "text-ink"}`}>
            {message.text}
          </span>
        )}
      </div>
      <p className="text-xs text-ink-dim">
        % is ESPN&apos;s projected chance to score. You can change your pick until that
        player&apos;s game kicks off.
      </p>
    </form>
  );
}

export function ParlayBoard({
  initialSeason,
  initialFetchedAt,
}: {
  initialSeason: TdSeason;
  initialFetchedAt: string;
}) {
  const [season, setSeason] = useState(initialSeason);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);
  // null until the first load: picks are never part of the prerendered page.
  const [picks, setPicks] = useState<StoredPick[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/parlay", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data: { season: TdSeason; picks: StoredPick[]; fetchedAt: string } = await res.json();
      setSeason(data.season);
      setPicks(data.picks);
      setFetchedAt(data.fetchedAt);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // Deferred a tick so the first load isn't a synchronous setState in the effect body.
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const weeks = useMemo(() => gradeParlays(season, picks ?? []), [season, picks]);
  const open = openWeek(season);
  const openGraded = open ? (weeks.find((w) => w.key === open.key) ?? null) : null;
  const pastWeeks = weeks.filter((w) => w.key !== open?.key);
  const records = useMemo(() => pickerRecords(weeks), [weeks]);
  const hasRecords = records.some((r) => r.hits + r.misses > 0);
  const teamAbbr = useMemo(
    () => new Map(season.teams.map((t) => [t.id, t.abbreviation])),
    [season],
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6">
      <Header fetchedAt={fetchedAt} active="lines" />

      <div className="max-w-3xl pb-16">
        <div className="pt-5">
          <LinesNav active="parlay" />
        </div>
        <p className="pt-4 text-sm text-ink-dim">
          Everyone picks one player to score a touchdown each week, and every pick is a leg of the
          group&apos;s parlay. It hits only if every pick scores. Graded live from ESPN.
        </p>

        {loadError && (
          <p role="alert" className="pt-4 text-sm text-loss">
            Couldn&apos;t load picks — retrying.
          </p>
        )}

        <div className="pt-6">
          <PickForm season={season} picks={picks ?? []} onSaved={load} />
        </div>

        {open && (
          <section className="pt-10">
            <WeekHeading label={`${open.label} parlay`} week={openGraded} />
            {picks === null ? (
              <p className="text-sm text-ink-dim">Loading picks…</p>
            ) : (
              <WeekLegs week={openGraded} teamAbbr={teamAbbr} showMissingPickers />
            )}
          </section>
        )}

        {hasRecords && (
          <section className="pt-10">
            <h2 className="mb-3 border-b border-border pb-2 font-display text-xl font-bold text-ink">
              Standings
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...records]
                .sort((a, b) => b.hits - a.hits || a.misses - b.misses)
                .map((r) => (
                  <li
                    key={r.picker}
                    className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5 text-sm"
                  >
                    <span className="text-ink">{r.picker}</span>
                    <span className="tabular text-ink-dim">
                      <span className="font-semibold text-ink">{r.hits}</span>–{r.misses}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {pastWeeks.map((week) => (
          <section key={week.key} className="pt-10">
            <WeekHeading label={`${week.label} parlay`} week={week} />
            <WeekLegs week={week} teamAbbr={teamAbbr} showMissingPickers={false} />
          </section>
        ))}
      </div>
    </div>
  );
}
