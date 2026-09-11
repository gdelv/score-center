import { LEAGUES, type LeagueConfig } from "./leagues";

export type MatchState = "pre" | "in" | "post";

export interface MatchTeam {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
  score: string | null;
  winner: boolean;
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

interface EspnCompetition {
  competitors: EspnCompetitor[];
  venue?: EspnVenue;
  broadcasts?: EspnBroadcast[];
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

function toTeam(c: EspnCompetitor | undefined): MatchTeam {
  if (!c) {
    return {
      id: "unknown",
      name: "TBD",
      shortName: "TBD",
      logo: null,
      score: null,
      winner: false,
    };
  }
  return {
    id: c.team.id,
    name: c.team.displayName,
    shortName: c.team.shortDisplayName ?? c.team.abbreviation ?? c.team.displayName,
    logo: c.team.logo ?? null,
    score: c.score ?? null,
    winner: Boolean(c.winner),
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
    const res = await fetch(url, {
      // Shared across all visitors; short enough to stay fresh, long enough to stay fast.
      next: { revalidate: 120 },
    });
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

/** Fetches every configured league in parallel for the next `days` days (incl. today). */
export async function fetchAllUpcomingMatches(days = 14): Promise<Match[]> {
  const today = new Date();
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + days);
  const fromYmd = formatYmd(today);
  const toYmd = formatYmd(end);

  const results = await Promise.all(
    LEAGUES.map((league) => fetchLeagueMatches(league, fromYmd, toYmd)),
  );

  return results.flat().sort((a, b) => a.date.localeCompare(b.date));
}
