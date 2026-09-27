import { unstable_cache } from "next/cache";

// NFL only for now. Both URLs are per-sport/league, so another league means a
// second pair of these (and checking its core odds endpoint has open/close).
const SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";

export interface LineTeam {
  id: string;
  name: string;
  abbreviation: string;
  logo: string | null;
  score: number;
}

/** Opening and closing numbers for one market. `open` is null when ESPN has no opener. */
export interface LineMove {
  open: number | null;
  close: number;
}

export interface GameLine {
  id: string;
  date: string; // ISO, UTC
  home: LineTeam;
  away: LineTeam;
  provider: string | null;
  /** Home-relative, like ESPN's own: -5.5 = home favored by 5.5. Null = no line posted. */
  spread: LineMove | null;
  total: LineMove | null;
  moneyline: { home: number | null; away: number | null } | null;
}

export interface WeekLines {
  /** Unique across season types, e.g. "2-3" = regular season week 3. */
  key: string;
  label: string;
  /** Finished games only — a line is only "past" once the game has a result. */
  games: GameLine[];
  /** Games in this week not finished yet (scheduled or live). */
  remaining: number;
}

export interface SeasonLines {
  season: number | null;
  /** Oldest first. */
  weeks: WeekLines[];
}

// Raw ESPN shapes, narrowed to the fields read here.
interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team: { id: string; displayName: string; abbreviation: string; logo?: string };
}

interface EspnEvent {
  id: string;
  date: string;
  status: { type: { state: "pre" | "in" | "post" } };
  competitions: { id: string; competitors: EspnCompetitor[] }[];
}

interface EspnCalendarSection {
  value: string;
  entries?: { label: string; value: string; startDate: string }[];
}

interface EspnScoreboard {
  season?: { year: number };
  leagues?: { calendar?: EspnCalendarSection[] }[];
  events?: EspnEvent[];
}

interface EspnPrice {
  american?: string;
}

interface EspnTeamOdds {
  moneyLine?: number;
  open?: { pointSpread?: EspnPrice };
  close?: { pointSpread?: EspnPrice; moneyLine?: EspnPrice };
}

interface EspnOddsItem {
  provider?: { name?: string };
  spread?: number;
  overUnder?: number;
  homeTeamOdds?: EspnTeamOdds;
  awayTeamOdds?: EspnTeamOdds;
  open?: { total?: EspnPrice };
  close?: { total?: EspnPrice };
}

/** ESPN writes lines as strings: "-5.5", "+3", "o52.5", "PK", "EVEN". */
function parseLine(value: string | number | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (/^(pk|even)$/i.test(value.trim())) return 0;
  const n = parseFloat(value.replace(/^[ou]/i, ""));
  return Number.isNaN(n) ? null : n;
}

async function fetchJson<T>(url: string, revalidate?: number): Promise<T | null> {
  try {
    const res = await fetch(url, revalidate ? { next: { revalidate } } : undefined);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

function toTeam(c: EspnCompetitor | undefined): LineTeam {
  return {
    id: c?.team.id ?? "unknown",
    name: c?.team.displayName ?? "TBD",
    abbreviation: c?.team.abbreviation ?? "TBD",
    logo: c?.team.logo ?? null,
    score: Number(c?.score ?? 0),
  };
}

/**
 * One game's lines from ESPN's core odds endpoint (~7KB, unlike the ~570KB
 * game summary that also carries them). Unlike the scoreboard — which drops
 * `odds` once a game is final — this keeps the line after the game, including
 * the opener. Fetch-cached for a day: a closing line never changes once the
 * game is over, and the payload is far under the 2MB fetch-cache limit.
 */
async function fetchGameOdds(
  eventId: string,
  competitionId: string,
): Promise<Pick<GameLine, "provider" | "spread" | "total" | "moneyline">> {
  const data = await fetchJson<{ items?: EspnOddsItem[] }>(
    `${CORE}/events/${eventId}/competitions/${competitionId}/odds`,
    86_400,
  );
  const odds = data?.items?.[0];
  if (!odds) return { provider: null, spread: null, total: null, moneyline: null };

  const closeSpread = parseLine(odds.homeTeamOdds?.close?.pointSpread?.american) ?? odds.spread;
  const closeTotal = parseLine(odds.close?.total?.american) ?? odds.overUnder;
  const homeMl =
    parseLine(odds.homeTeamOdds?.close?.moneyLine?.american) ?? odds.homeTeamOdds?.moneyLine;
  const awayMl =
    parseLine(odds.awayTeamOdds?.close?.moneyLine?.american) ?? odds.awayTeamOdds?.moneyLine;

  return {
    provider: odds.provider?.name ?? null,
    spread:
      closeSpread != null
        ? { open: parseLine(odds.homeTeamOdds?.open?.pointSpread?.american), close: closeSpread }
        : null,
    total:
      closeTotal != null
        ? { open: parseLine(odds.open?.total?.american), close: closeTotal }
        : null,
    moneyline:
      homeMl != null || awayMl != null ? { home: homeMl ?? null, away: awayMl ?? null } : null,
  };
}

async function fetchWeekLines(
  year: number,
  seasonType: string,
  week: string,
  label: string,
): Promise<WeekLines> {
  // Raw scoreboard deliberately uncached — see fetchScoreboardEvents in
  // lib/espn.ts. The normalized season result is cached one level up.
  const board = await fetchJson<EspnScoreboard>(
    `${SITE}/scoreboard?seasontype=${seasonType}&week=${week}&dates=${year}`,
  );
  const events = board?.events ?? [];
  const finished = events.filter((e) => e.status.type.state === "post");

  const games = await Promise.all(
    finished.map(async (e): Promise<GameLine> => {
      const competition = e.competitions[0];
      const competitors = competition?.competitors ?? [];
      return {
        id: e.id,
        date: e.date,
        home: toTeam(competitors.find((c) => c.homeAway === "home")),
        away: toTeam(competitors.find((c) => c.homeAway === "away")),
        ...(await fetchGameOdds(e.id, competition?.id ?? e.id)),
      };
    }),
  );

  return {
    key: `${seasonType}-${week}`,
    label,
    games: games.sort((a, b) => a.date.localeCompare(b.date)),
    remaining: events.length - finished.length,
  };
}

async function fetchSeasonLinesUncached(): Promise<SeasonLines> {
  // The default scoreboard carries the current season and its week calendar.
  const current = await fetchJson<EspnScoreboard>(`${SITE}/scoreboard`);
  const year = current?.season?.year;
  if (!year) return { season: null, weeks: [] };

  const now = Date.now();
  // Regular season ("2") and postseason ("3") weeks that have started.
  // Preseason is skipped: lines on backups-only games aren't worth tracking.
  const started = (current.leagues?.[0]?.calendar ?? [])
    .filter((section) => section.value === "2" || section.value === "3")
    .flatMap((section) =>
      (section.entries ?? [])
        .filter((entry) => Date.parse(entry.startDate) <= now)
        .map((entry) => ({ seasonType: section.value, ...entry })),
    );

  const weeks = await Promise.all(
    started.map((w) => fetchWeekLines(year, w.seasonType, w.value, w.label)),
  );
  return { season: year, weeks: weeks.filter((w) => w.games.length > 0 || w.remaining > 0) };
}

const cachedFetchSeasonLines = unstable_cache(
  fetchSeasonLinesUncached,
  ["score-center-nfl-season-lines"],
  { revalidate: 120 },
);

/**
 * Every finished NFL game this season with its opening and closing
 * DraftKings line, grouped by week. Same 120s `unstable_cache` pattern as
 * fetchAllUpcomingMatches; per-game odds are separately fetch-cached for a
 * day, so a refresh mostly costs one small scoreboard call per week.
 */
export function fetchSeasonLines(): Promise<SeasonLines> {
  return cachedFetchSeasonLines();
}

// --- Grading: pure, client-safe ---------------------------------------------

export type Side = "home" | "away";

/** The side the closing spread favors; null for a pick'em or no line. */
export function favoriteSide(game: GameLine): Side | null {
  if (!game.spread || game.spread.close === 0) return null;
  return game.spread.close < 0 ? "home" : "away";
}

/** Who covered the closing spread. */
export function spreadResult(game: GameLine): Side | "push" | null {
  if (!game.spread) return null;
  const margin = game.home.score - game.away.score + game.spread.close;
  return margin > 0 ? "home" : margin < 0 ? "away" : "push";
}

export function totalResult(game: GameLine): "over" | "under" | "push" | null {
  if (!game.total) return null;
  const points = game.home.score + game.away.score;
  return points > game.total.close ? "over" : points < game.total.close ? "under" : "push";
}

export function winnerSide(game: GameLine): Side | null {
  if (game.home.score === game.away.score) return null;
  return game.home.score > game.away.score ? "home" : "away";
}

export interface Record3 {
  wins: number;
  losses: number;
  pushes: number;
}

export interface LinesSummary {
  /** Favorite's record against the closing spread (pick'ems excluded). */
  favoritesAts: Record3;
  /** Over-under-push against the closing total. */
  totals: { over: number; under: number; push: number };
  /** Favorite's straight-up record (pick'ems and ties excluded). */
  favoritesSu: Record3;
  games: number;
}

export function summarize(games: GameLine[]): LinesSummary {
  const s: LinesSummary = {
    favoritesAts: { wins: 0, losses: 0, pushes: 0 },
    totals: { over: 0, under: 0, push: 0 },
    favoritesSu: { wins: 0, losses: 0, pushes: 0 },
    games: games.length,
  };

  for (const game of games) {
    const fav = favoriteSide(game);
    const ats = spreadResult(game);
    if (fav && ats) {
      if (ats === "push") s.favoritesAts.pushes++;
      else if (ats === fav) s.favoritesAts.wins++;
      else s.favoritesAts.losses++;
    }

    const total = totalResult(game);
    if (total) s.totals[total]++;

    const winner = winnerSide(game);
    if (fav && winner) {
      if (winner === fav) s.favoritesSu.wins++;
      else s.favoritesSu.losses++;
    }
  }
  return s;
}
