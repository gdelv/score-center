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

function toTeam(c: EspnCompetitor | undefined): MatchTeam {
  if (!c) {
    return {
      id: "unknown",
      name: "TBD",
      shortName: "TBD",
      logo: null,
      score: null,
      winner: false,
      rank: null,
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
  };
}

/** Fetches one league's scoreboard for the given date window. Never throws. */
async function fetchLeagueMatches(
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

    return events
      .filter((e) => e.status.type.state !== "post")
      .map((e) => {
        const competition = e.competitions[0];
        const competitors = competition?.competitors ?? [];
        const home = competitors.find((c) => c.homeAway === "home");
        const away = competitors.find((c) => c.homeAway === "away");
        const broadcastNames = competition?.broadcasts?.[0]?.names;
        const rawOdds = competition?.odds?.[0];

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
          home: toTeam(home),
          away: toTeam(away),
          venue: competition?.venue?.fullName ?? null,
          broadcast: broadcastNames?.length ? broadcastNames.join(", ") : null,
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

function formatYmd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

async function fetchAllUpcomingMatchesUncached(days: number): Promise<Match[]> {
  const today = new Date();
  const fromYmd = formatYmd(today);

  function windowEndYmd(league: LeagueConfig): string {
    const end = new Date(today);
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
 * Fetches every configured league in parallel for the next `days` days
 * (incl. today), and caches the resulting — small, normalized — match list
 * for 120s. Caching happens here rather than on the individual upstream
 * fetches: see fetchLeagueMatches for why.
 */
export function fetchAllUpcomingMatches(days = 14): Promise<Match[]> {
  return cachedFetchAllUpcomingMatches(days);
}
