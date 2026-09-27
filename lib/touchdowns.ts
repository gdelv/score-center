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
  /** Roster position ("QB", "RB", "WR", "TE", "CB", …); null if the name isn't on a roster. */
  position: string | null;
}

export interface TdTeam {
  id: string;
  name: string;
  abbreviation: string;
  logo: string | null;
}

/** A player's chance to score at least one TD in an upcoming game, from ESPN's projections. */
export interface ProjectedScorer {
  player: string;
  /** 0-1. */
  probability: number;
}

/** One team's game in one week. A team missing from a week's `teams` had a bye. */
export interface TeamWeek {
  /** Kickoff, ISO UTC — for the game-time slot filter. */
  date: string;
  opponent: string;
  home: boolean;
  state: "pre" | "in" | "post";
  touchdowns: Touchdown[];
  /** Only for a not-yet-played regular-season game; most likely first. Empty if ESPN has none. */
  projected: ProjectedScorer[];
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

type GameTouchdowns = { teamId: string; touchdown: Omit<Touchdown, "position"> }[];

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

// ESPN's fantasy API (public, no key) — the only ESPN source with per-player,
// per-week TD projections. Regular season only: fantasy has no playoff weeks.
const FANTASY =
  "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leaguedefaults/3";

// Fantasy stat ids: 25 = rushing TDs, 43 = receiving TDs. Passing TDs are
// deliberately left out — the passer doesn't score them.
const RUSH_TD = "25";
const REC_TD = "43";
// Injury statuses that mean the player won't play; their projections are
// near zero anyway, but a ruled-out name shouldn't appear at all.
const RULED_OUT = new Set(["OUT", "INJURY_RESERVE", "SUSPENSION"]);
const PROJECTED_PER_TEAM = 3;

interface FantasyPlayer {
  player: {
    fullName: string;
    proTeamId: number;
    injuryStatus?: string;
    stats?: { externalId?: string; statSourceId?: number; stats?: Record<string, number> }[];
  };
}

/**
 * Top projected TD scorers per team for one regular-season week, keyed by
 * team id (fantasy `proTeamId` is the same id the scoreboard uses). The raw
 * response runs ~5KB per player — a few MB for a full slate — so it's never
 * fetch-cached; the small result is cached below instead.
 */
async function fetchWeekProjections(
  year: number,
  week: number,
  teamIds: string[],
): Promise<Record<string, ProjectedScorer[]>> {
  const filter = {
    players: {
      // Projections (source 1), single-week split (1), this week only, and
      // QB/RB/WR/TE only (slot ids 0/2/4/6).
      filterStatsForSourceIds: { value: [1] },
      filterStatsForSplitTypeIds: { value: [1] },
      filterStatsForScoringPeriodIds: { value: [week] },
      filterSlotIds: { value: [0, 2, 4, 6] },
      filterProTeamIds: { value: teamIds.map(Number) },
      // A full slate is ~610 players. The API rejects `limit` without a sort.
      limit: 1000,
      sortPercOwned: { sortAsc: false, sortPriority: 1 },
    },
  };
  let players: FantasyPlayer[] = [];
  try {
    const res = await fetch(
      `${FANTASY.replace("{year}", String(year))}?view=kona_player_info&scoringPeriodId=${week}`,
      { headers: { "X-Fantasy-Filter": JSON.stringify(filter) } },
    );
    if (res.ok) players = ((await res.json()) as { players?: FantasyPlayer[] }).players ?? [];
  } catch {
    // Projections are extra; without them the cell just says "Not played yet".
  }

  // Each player can carry both this season's and last season's projection for
  // the same week number; only `${year}${week}` is this game.
  const externalId = `${year}${week}`;
  const byTeam: Record<string, ProjectedScorer[]> = {};
  for (const { player } of players) {
    if (RULED_OUT.has(player.injuryStatus ?? "")) continue;
    const stats = player.stats?.find((st) => st.externalId === externalId)?.stats;
    const expected = (stats?.[RUSH_TD] ?? 0) + (stats?.[REC_TD] ?? 0);
    if (expected <= 0) continue;
    // Expected TDs -> chance of at least one, treating TDs as Poisson.
    const probability = 1 - Math.exp(-expected);
    (byTeam[String(player.proTeamId)] ??= []).push({ player: player.fullName, probability });
  }
  for (const teamId of Object.keys(byTeam)) {
    byTeam[teamId] = byTeam[teamId]
      .sort((a, b) => b.probability - a.probability)
      .slice(0, PROJECTED_PER_TEAM);
  }
  return byTeam;
}

// Projections move during the week (injuries, depth charts), but not by the
// minute — 30 minutes keeps the multi-MB upstream call rare.
const cachedWeekProjections = unstable_cache(
  fetchWeekProjections,
  ["score-center-nfl-week-projections"],
  { revalidate: 1800 },
);

interface EspnRoster {
  athletes?: { items?: { displayName: string; position?: { abbreviation?: string } }[] }[];
}

/**
 * Player name -> roster position for one team. Scoring plays carry only the
 * scorer's name, and the game summary's boxscore has no positions, so this
 * is the one place positions come from. ~350KB raw per team; the small map
 * is cached for a day — positions barely change mid-season.
 */
async function fetchTeamPositions(teamId: string): Promise<Record<string, string>> {
  const roster = await fetchJson<EspnRoster>(`${SITE}/teams/${teamId}/roster`);
  const positions: Record<string, string> = {};
  for (const group of roster?.athletes ?? []) {
    for (const athlete of group.items ?? []) {
      if (athlete.position?.abbreviation)
        positions[athlete.displayName] = athlete.position.abbreviation;
    }
  }
  return positions;
}

const cachedTeamPositions = unstable_cache(
  fetchTeamPositions,
  ["score-center-nfl-team-positions"],
  { revalidate: 86_400 },
);

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

  // Projections only for regular-season weeks with games still to play.
  const projections = await Promise.all(
    started.map((week, i) => {
      const upcomingTeamIds = weekEvents[i]
        .filter((e) => e.status.type.state === "pre")
        .flatMap((e) => (e.competitions[0]?.competitors ?? []).map((c) => c.team.id))
        .sort();
      return week.seasonType === "2" && upcomingTeamIds.length > 0
        ? cachedWeekProjections(year, Number(week.week), upcomingTeamIds)
        : Promise.resolve({} as Record<string, ProjectedScorer[]>);
    }),
  );

  // Positions for every team that has scored. Looked up on the scoring team's
  // current roster first; a player traded since falls back to whichever
  // roster he's on now, as long as that name is unique league-wide.
  const scoringTeamIds = [...new Set([...tdsByEvent.values()].flat().map((t) => t.teamId))].sort();
  const rosters = new Map<string, Record<string, string>>();
  await mapLimit(scoringTeamIds, 8, async (teamId) => {
    rosters.set(teamId, await cachedTeamPositions(teamId));
  });
  const leagueWide = new Map<string, string | null>();
  for (const roster of rosters.values()) {
    for (const [name, position] of Object.entries(roster)) {
      leagueWide.set(name, leagueWide.has(name) ? null : position);
    }
  }
  const positionOf = (teamId: string, player: string) =>
    rosters.get(teamId)?.[player] ?? leagueWide.get(player) ?? null;

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
          date: e.date,
          opponent: opponent?.team.abbreviation ?? "TBD",
          home: c.homeAway === "home",
          state: e.status.type.state,
          touchdowns: tds
            .filter((t) => t.teamId === c.team.id)
            .map((t) => ({ ...t.touchdown, position: positionOf(c.team.id, t.touchdown.player) })),
          projected: e.status.type.state === "pre" ? (projections[i][c.team.id] ?? []) : [],
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

/** Which team-weeks count — e.g. only games in one time slot. Defaults to all. */
export type GameFilter = (game: TeamWeek) => boolean;

const everyGame: GameFilter = () => true;

/** TD totals per player across the games `include` keeps, most first. */
export function scorerTotals(
  season: TdSeason,
  include: GameFilter = everyGame,
  counts: (td: Touchdown) => boolean = () => true,
): ScorerTotal[] {
  const abbr = new Map(season.teams.map((t) => [t.id, t.abbreviation]));
  const totals = new Map<string, ScorerTotal>();
  for (const week of season.weeks) {
    for (const [teamId, game] of Object.entries(week.teams)) {
      if (!include(game)) continue;
      for (const td of game.touchdowns) {
        if (!counts(td)) continue;
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

export type LeaderPosition = "WR" | "RB" | "TE" | "QB";

/**
 * Most TDs by position. WR/RB/TE count every TD they score; QB counts only
 * rushing TDs — a QB's passing TDs are scored by the receiver. Fullbacks
 * count as RBs.
 */
export const LEADER_POSITIONS: {
  id: LeaderPosition;
  label: string;
  counts: (td: Touchdown) => boolean;
}[] = [
  { id: "WR", label: "Wide receivers", counts: (td) => td.position === "WR" },
  {
    id: "RB",
    label: "Running backs",
    counts: (td) => td.position === "RB" || td.position === "FB",
  },
  { id: "TE", label: "Tight ends", counts: (td) => td.position === "TE" },
  {
    id: "QB",
    label: "Quarterbacks (rushing TDs)",
    counts: (td) => td.position === "QB" && td.kind === "rush",
  },
];
