import { unstable_cache } from "next/cache";
import { LEAGUES, type LeagueConfig } from "./leagues";

export type MatchState = "pre" | "in" | "post";

export interface MatchTeam {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
  score: string | null;
  winner: boolean;
  /** AP Top 25 rank (1-25), only ever set for `filterToRankedTeams` leagues. */
  rank: number | null;
  /**
   * Combined score across every leg of a multi-leg tie so far — e.g. a
   * Copa Libertadores quarterfinal is two legs, and this is what actually
   * decides who advances, not either leg's score alone. Only set when
   * `Match.seriesLeg` is non-null (see there for why); null otherwise,
   * including for every single-match competition (NFL, EPL, etc.).
   */
  aggregateScore: number | null;
}

export interface MatchOdds {
  /** Human-readable spread/moneyline summary as ESPN presents it, e.g. "CIN -3.5" or "BOU +150". */
  details: string | null;
  overUnder: number | null;
  /** Sportsbook this line comes from, e.g. "DraftKings" — shown for attribution. */
  provider: string | null;
}

export interface Match {
  id: string;
  sport: LeagueConfig["sport"];
  leagueId: string;
  leagueName: string;
  leagueShortName: string;
  accent: string;
  date: string; // ISO, UTC
  state: MatchState;
  statusDetail: string;
  home: MatchTeam;
  away: MatchTeam;
  venue: string | null;
  broadcast: string | null;
  odds: MatchOdds | null;
  /** e.g. "2nd Leg" — only set for a multi-leg tie (see `MatchTeam.aggregateScore`); null for every single-match competition. */
  seriesLeg: string | null;
}

// Raw ESPN scoreboard shapes, narrowed to only the fields we read.
interface EspnTeamRef {
  id: string;
  displayName: string;
  shortDisplayName: string;
  abbreviation: string;
  logo?: string;
}

interface EspnCompetitor {
  id: string;
  homeAway: "home" | "away";
  team: EspnTeamRef;
  score?: string;
  winner?: boolean;
  aggregateScore?: number;
}

interface EspnBroadcast {
  names?: string[];
}

interface EspnVenue {
  fullName?: string;
}

interface EspnOdds {
  details?: string;
  overUnder?: number;
  provider?: { displayName?: string };
}

interface EspnCompetition {
  competitors: EspnCompetitor[];
  venue?: EspnVenue;
  broadcasts?: EspnBroadcast[];
  odds?: EspnOdds[];
  leg?: { displayValue?: string };
  series?: { totalCompetitions?: number };
}

interface EspnStatusType {
  state: MatchState;
  detail: string;
  shortDetail: string;
}

interface EspnEvent {
  id: string;
  date: string;
  name: string;
  status: { type: EspnStatusType };
  competitions: EspnCompetition[];
}

interface EspnScoreboardResponse {
  events?: EspnEvent[];
}

interface EspnRankEntry {
  current: number;
  team: { id: string };
}

interface EspnRankingsPoll {
  type: string;
  ranks: EspnRankEntry[];
}

interface EspnRankingsResponse {
  rankings?: EspnRankingsPoll[];
}

/**
 * Team id -> current AP Top 25 rank (1-25). Used to cut college football
 * down to a readable slate and to label each ranked team with its number —
 * see `LeagueConfig.filterToRankedTeams`. Fails closed (empty map) on any
 * error, since showing nothing beats silently reverting to the full
 * 80-games-a-Saturday slate.
 */
async function fetchRankedTeams(): Promise<Map<string, number>> {
  try {
    // Caching happens one level up, around the small normalized result in
    // fetchAllUpcomingMatches — not here, and deliberately not via `fetch`'s
    // own `next.revalidate`, which tries to store the raw response verbatim
    // (see fetchLeagueMatches below for why that matters).
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
    );
    if (!res.ok) return new Map();

    const data: EspnRankingsResponse = await res.json();
    const apPoll = data.rankings?.find((p) => p.type === "ap");
    return new Map(apPoll?.ranks.map((r) => [r.team.id, r.current]) ?? []);
  } catch {
    return new Map();
  }
}

function toTeam(c: EspnCompetitor | undefined, isMultiLegTie: boolean): MatchTeam {
  if (!c) {
    return {
      id: "unknown",
      name: "TBD",
      shortName: "TBD",
      logo: null,
      score: null,
      winner: false,
      rank: null,
      aggregateScore: null,
    };
  }
  return {
    id: c.team.id,
    name: c.team.displayName,
    shortName: c.team.shortDisplayName ?? c.team.abbreviation ?? c.team.displayName,
    logo: c.team.logo ?? null,
    score: c.score ?? null,
    winner: Boolean(c.winner),
    rank: null,
    aggregateScore: isMultiLegTie && c.aggregateScore != null ? c.aggregateScore : null,
  };
}

/**
 * Fetches one league's scoreboard for the given date window. Never throws.
 * Exported for `lib/predictions.ts`, which needs a specific past date (a
 * pick's kickoff day) rather than the rolling "yesterday onward" window
 * `fetchAllUpcomingMatches` uses — the same normalization applies either way.
 */
export async function fetchLeagueMatches(
  league: LeagueConfig,
  fromYmd: string,
  toYmd: string,
): Promise<Match[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${league.espnPath}/scoreboard?dates=${fromYmd}-${toYmd}`;

  try {
    // Deliberately uncached here: ESPN's raw scoreboard payload for a busy
    // league (college football especially) can run several MB, over
    // Next.js's 2MB fetch-cache entry limit — `next.revalidate` would just
    // fail to cache it and log a warning on every request. We cache the
    // small, normalized result instead, one level up in
    // fetchAllUpcomingMatches.
    const res = await fetch(url);
    if (!res.ok) return [];

    const data: EspnScoreboardResponse = await res.json();
    const events = data.events ?? [];

    // Includes finished ("post") games too — the fetch window's start is
    // pinned to (at most) yesterday, never further back, so a finished game
    // returned here is always from yesterday or today, never real history.
    // Callers that only want the upcoming board filter state==="post" back
    // out themselves; the live ticker's finished-game fallback wants exactly
    // these, including last night's, until something newer goes live.
    return events.map((e) => {
      const competition = e.competitions[0];
      const competitors = competition?.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      const broadcastNames = competition?.broadcasts?.[0]?.names;
      const rawOdds = competition?.odds?.[0];
      // Group-stage/final matches are single games (totalCompetitions
      // absent or 1) — only a knockout-round two-legged tie has this > 1,
      // and only then does an aggregate score mean anything.
      const isMultiLegTie = (competition?.series?.totalCompetitions ?? 1) > 1;

      return {
        id: `${league.id}-${e.id}`,
        sport: league.sport,
        leagueId: league.id,
        leagueName: league.name,
        leagueShortName: league.shortName,
        accent: league.accent,
        date: e.date,
        state: e.status.type.state,
        statusDetail: e.status.type.shortDetail || e.status.type.detail,
        home: toTeam(home, isMultiLegTie),
        away: toTeam(away, isMultiLegTie),
        venue: competition?.venue?.fullName ?? null,
        broadcast: broadcastNames?.length ? broadcastNames.join(", ") : null,
        seriesLeg: isMultiLegTie ? (competition?.leg?.displayValue ?? null) : null,
        // Built whenever either line is present — a spread isn't always
        // posted this early, but an over/under often already is (or vice
        // versa), and dropping the whole thing for lacking one is why
        // over/under could go missing even when ESPN actually has it.
        odds:
          rawOdds && (rawOdds.details || rawOdds.overUnder != null)
            ? {
                details: rawOdds.details ?? null,
                overUnder: rawOdds.overUnder ?? null,
                provider: rawOdds.provider?.displayName ?? null,
              }
            : null,
      };
    });
  } catch {
    // A single upstream hiccup should never take down the whole board.
    return [];
  }
}

/** Exported for `lib/predictions.ts` — same YYYYMMDD format ESPN's `dates` param expects. */
export function formatYmd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

async function fetchAllUpcomingMatchesUncached(days: number): Promise<Match[]> {
  // Starts one UTC day *before* today, not today itself. UTC rolls over
  // hours before local midnight for anyone west of it (a 7pm ET kickoff is
  // already 11pm UTC that same UTC day; by actual local midnight ET, UTC has
  // long since advanced to the next date) — so a window starting at "today"
  // loses last night's late finishers the moment UTC ticks over, well before
  // the guest's own day has ended. Shifting the whole window back by one day
  // (not just widening it) keeps every league's total span, and therefore
  // payload size, unchanged — see fetchLeagueMatches for why that matters.
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - 1);
  const fromYmd = formatYmd(windowStart);

  function windowEndYmd(league: LeagueConfig): string {
    const end = new Date(windowStart);
    end.setUTCDate(end.getUTCDate() + Math.min(days, league.maxWindowDays ?? days));
    return formatYmd(end);
  }

  const [rankedTeams, ...leagueResults] = await Promise.all([
    fetchRankedTeams(),
    ...LEAGUES.map((league) => fetchLeagueMatches(league, fromYmd, windowEndYmd(league))),
  ]);

  const results = leagueResults.map((matches, i) => {
    const league = LEAGUES[i];
    if (!league.filterToRankedTeams) return matches;

    return matches
      .filter((m) => rankedTeams.has(m.home.id) || rankedTeams.has(m.away.id))
      .map((m) => ({
        ...m,
        home: { ...m.home, rank: rankedTeams.get(m.home.id) ?? null },
        away: { ...m.away, rank: rankedTeams.get(m.away.id) ?? null },
      }));
  });

  return results.flat().sort((a, b) => a.date.localeCompare(b.date));
}

const cachedFetchAllUpcomingMatches = unstable_cache(
  fetchAllUpcomingMatchesUncached,
  ["score-center-upcoming-matches"],
  { revalidate: 120 },
);

/**
 * Fetches every configured league in parallel for roughly the next `days`
 * days (the window actually starts yesterday — see below), and caches the
 * resulting — small, normalized — match list for 120s. Caching happens here
 * rather than on the individual upstream fetches: see fetchLeagueMatches for
 * why.
 *
 * Despite the name, this includes yesterday's and today's *finished* games
 * too (state "post") — the upcoming-matches board filters those back out
 * itself, but the live ticker wants them as its finished-game fallback, kept
 * around through the guest's own local midnight until something new goes
 * live. See fetchLeagueMatches for why that's still safe (bounded to
 * yesterday at the earliest, never real history).
 */
export function fetchAllUpcomingMatches(days = 14): Promise<Match[]> {
  return cachedFetchAllUpcomingMatches(days);
}
