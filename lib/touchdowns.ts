import { unstable_cache } from "next/cache";
import {
  SITE,
  fetchJson,
  fetchStartedWeeks,
  fetchWeekEvents,
  type EspnCompetitor,
  type EspnEvent,
} from "./nfl";

/** rush = rushing TD, rec = receiving TD, def = defensive/special-teams return. */
export type TdKind = "rush" | "rec" | "def";

export interface Touchdown {
  player: string;
  kind: TdKind;
  /** ESPN's own play text, e.g. "Joshua Palmer 43 Yd pass from Josh Allen (Tyler Bass Kick)". */
  text: string;
}

export interface TdTeam {
  id: string;
  name: string;
  abbreviation: string;
  logo: string | null;
}

/** One team's game in one week. A team missing from a week's `teams` had a bye. */
export interface TeamWeek {
  opponent: string;
  home: boolean;
  state: "pre" | "in" | "post";
  touchdowns: Touchdown[];
}

export interface TdWeek {
  key: string;
  label: string;
  /** Keyed by team id. */
  teams: Record<string, TeamWeek>;
}

export interface TdSeason {
  season: number | null;
  /** Every team seen this season, alphabetical. */
  teams: TdTeam[];
  /** Oldest first. */
  weeks: TdWeek[];
}

interface EspnScoringPlay {
  text: string;
  type?: { text?: string };
  // The reliable TD marker. `type.abbreviation` isn't: defensive fumble-return
  // TDs come through as type "Sack Opp Fumble Recovery" (SFOP), and only
  // `scoringType` says they were touchdowns.
  scoringType?: { abbreviation?: string };
  team?: { id?: string };
}

// ESPN's scoring-play text always leads with the scorer and the yardage:
// "Josh Allen 1 Yd Rush", "Joshua Palmer 43 Yd pass from Josh Allen",
// "T.J. Watt 35 Yd Interception Return". There's no structured scorer field
// in the summary; the core plays feed has one, but it's ~870KB a game and
// each athlete is another request. Checked against every TD of 2026 weeks
// 1-3 (168 plays): no misses.
const SCORER = /^(.+?)\s+\d+\s+(?:Yd|Yds|Yard|Yards)\b/i;

function toKind(typeText: string | undefined): TdKind {
  if (/rushing/i.test(typeText ?? "")) return "rush";
  if (/passing|receiving/i.test(typeText ?? "")) return "rec";
  return "def";
}

type GameTouchdowns = { teamId: string; touchdown: Touchdown }[];

/**
 * One game's touchdowns, from the game summary's `scoringPlays`. The summary
 * is ~570KB — far too big to keep, and not fetch-cached for the same reason
 * as the scoreboards (see lib/espn.ts) — so only the small parsed result is
 * cached, per finished game, below.
 */
async function fetchGameTouchdowns(eventId: string): Promise<GameTouchdowns> {
  const summary = await fetchJson<{ scoringPlays?: EspnScoringPlay[] }>(
    `${SITE}/summary?event=${eventId}`,
  );
  return (summary?.scoringPlays ?? [])
    .filter((p) => p.scoringType?.abbreviation === "TD" && p.team?.id)
    .map((p) => ({
      teamId: p.team!.id!,
      touchdown: {
        player: p.text.match(SCORER)?.[1] ?? p.text.split(" (")[0],
        kind: toKind(p.type?.text),
        text: p.text,
      },
    }));
}

// A final game's scoring doesn't change, so cache it for a day — without
// this every 120s season refresh would re-download every summary so far.
const cachedFinalGameTouchdowns = unstable_cache(
  fetchGameTouchdowns,
  ["score-center-nfl-game-touchdowns"],
  { revalidate: 86_400 },
);

/** Runs `fn` over `items` at most `limit` at a time — a cold cache late in the season is ~280 summaries. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function toTeam(c: EspnCompetitor): TdTeam {
  return {
    id: c.team.id,
    name: c.team.displayName,
    abbreviation: c.team.abbreviation,
    logo: c.team.logo ?? null,
  };
}

async function fetchSeasonTouchdownsUncached(): Promise<TdSeason> {
  const { year, weeks: started } = await fetchStartedWeeks();
  if (!year) return { season: null, teams: [], weeks: [] };

  const weekEvents = await Promise.all(started.map((w) => fetchWeekEvents(year, w)));

  const played = weekEvents.flat().filter((e) => e.status.type.state !== "pre");
  const tdsByEvent = new Map<string, GameTouchdowns>();
  await mapLimit(played, 8, async (e: EspnEvent) => {
    const fetcher =
      e.status.type.state === "post" ? cachedFinalGameTouchdowns : fetchGameTouchdowns;
    tdsByEvent.set(e.id, await fetcher(e.id));
  });

  const teams = new Map<string, TdTeam>();
  const weeks = started.map((week, i): TdWeek => {
    const byTeam: Record<string, TeamWeek> = {};
    for (const e of weekEvents[i]) {
      const competitors = e.competitions[0]?.competitors ?? [];
      const tds = tdsByEvent.get(e.id) ?? [];
      for (const c of competitors) {
        const opponent = competitors.find((o) => o !== c);
        teams.set(c.team.id, toTeam(c));
        byTeam[c.team.id] = {
          opponent: opponent?.team.abbreviation ?? "TBD",
          home: c.homeAway === "home",
          state: e.status.type.state,
          touchdowns: tds.filter((t) => t.teamId === c.team.id).map((t) => t.touchdown),
        };
      }
    }
    return { key: week.key, label: week.label, teams: byTeam };
  });

  return {
    season: year,
    teams: [...teams.values()].sort((a, b) => a.name.localeCompare(b.name)),
    weeks: weeks.filter((w) => Object.keys(w.teams).length > 0),
  };
}

const cachedFetchSeasonTouchdowns = unstable_cache(
  fetchSeasonTouchdownsUncached,
  ["score-center-nfl-season-touchdowns"],
  { revalidate: 120 },
);

/**
 * Every NFL touchdown this season, by week and team. Same 120s
 * `unstable_cache` pattern as the rest of the site; finished games' parsed
 * touchdowns are cached for a day on top, so a refresh only re-downloads
 * games that are live right now.
 */
export function fetchSeasonTouchdowns(): Promise<TdSeason> {
  return cachedFetchSeasonTouchdowns();
}

// --- Pure, client-safe -------------------------------------------------------

export interface ScorerTotal {
  /** `${teamId}:${player}` — names alone can collide across teams. */
  key: string;
  player: string;
  team: string;
  count: number;
}

export function scorerKey(teamId: string, player: string): string {
  return `${teamId}:${player}`;
}

/** Season TD totals per player, most first. */
export function scorerTotals(season: TdSeason): ScorerTotal[] {
  const abbr = new Map(season.teams.map((t) => [t.id, t.abbreviation]));
  const totals = new Map<string, ScorerTotal>();
  for (const week of season.weeks) {
    for (const [teamId, game] of Object.entries(week.teams)) {
      for (const td of game.touchdowns) {
        const key = scorerKey(teamId, td.player);
        const entry = totals.get(key) ?? {
          key,
          player: td.player,
          team: abbr.get(teamId) ?? "",
          count: 0,
        };
        entry.count++;
        totals.set(key, entry);
      }
    }
  }
  return [...totals.values()].sort((a, b) => b.count - a.count || a.player.localeCompare(b.player));
}
