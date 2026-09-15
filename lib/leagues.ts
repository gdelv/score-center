export type Sport = "soccer" | "nfl" | "cfb";

export interface LeagueConfig {
  /** Stable id used in filter state + localStorage. */
  id: string;
  sport: Sport;
  /** ESPN path segment. Soccer: "soccer/{slug}". NFL: "football/nfl". */
  espnPath: string;
  name: string;
  shortName: string;
  /** Accent used for the league pill + card edge. Kept subtle, not per-team. */
  accent: string;
  /**
   * College football alone runs ~80 games on a single Saturday — far more
   * than every other league combined. Restricting it to games involving an
   * AP Top 25 team keeps the board readable instead of drowning it.
   */
  filterToRankedTeams?: boolean;
  /**
   * Overrides the global lookahead window for this league. College
   * football's full scoreboard payload for a 14-day window runs ~3.5MB —
   * over Next.js's 2MB fetch-cache limit, so it stops being cached at all.
   * A 7-day window (one weekend's slate) stays under that and is still
   * everything a "what's coming up" board needs.
   */
  maxWindowDays?: number;
}

export const LEAGUES: LeagueConfig[] = [
  {
    id: "nfl",
    sport: "nfl",
    espnPath: "football/nfl",
    name: "NFL",
    shortName: "NFL",
    accent: "#D62839",
  },
  {
    id: "college-football",
    sport: "cfb",
    espnPath: "football/college-football",
    name: "College Football",
    shortName: "NCAAF",
    accent: "#6B1E23",
    filterToRankedTeams: true,
    maxWindowDays: 7,
  },
  {
    id: "eng.1",
    sport: "soccer",
    espnPath: "soccer/eng.1",
    name: "Premier League",
    shortName: "EPL",
    accent: "#3D195B",
  },
  {
    id: "esp.1",
    sport: "soccer",
    espnPath: "soccer/esp.1",
    name: "La Liga",
    shortName: "La Liga",
    accent: "#EE8707",
  },
  {
    id: "ita.1",
    sport: "soccer",
    espnPath: "soccer/ita.1",
    name: "Serie A",
    shortName: "Serie A",
    accent: "#008FD7",
  },
  {
    id: "ger.1",
    sport: "soccer",
    espnPath: "soccer/ger.1",
    name: "Bundesliga",
    shortName: "Bundesliga",
    accent: "#D3010C",
  },
  {
    id: "fra.1",
    sport: "soccer",
    espnPath: "soccer/fra.1",
    name: "Ligue 1",
    shortName: "Ligue 1",
    accent: "#0A5CA8",
  },
  {
    id: "uefa.champions",
    sport: "soccer",
    espnPath: "soccer/uefa.champions",
    name: "UEFA Champions League",
    shortName: "UCL",
    accent: "#0E1E5B",
  },
  {
    id: "usa.1",
    sport: "soccer",
    espnPath: "soccer/usa.1",
    name: "MLS",
    shortName: "MLS",
    accent: "#1C1C1C",
  },
  {
    id: "mex.1",
    sport: "soccer",
    espnPath: "soccer/mex.1",
    name: "Liga MX",
    shortName: "Liga MX",
    accent: "#0B7B3E",
  },
  {
    id: "conmebol.libertadores",
    sport: "soccer",
    espnPath: "soccer/conmebol.libertadores",
    name: "Copa Libertadores",
    shortName: "Libertadores",
    accent: "#8B6F2E",
  },
  {
    id: "conmebol.sudamericana",
    sport: "soccer",
    espnPath: "soccer/conmebol.sudamericana",
    name: "Copa Sudamericana",
    shortName: "Sudamericana",
    accent: "#B5502C",
    // Unlike every other league here, ESPN's own scoreboard endpoint for
    // this specific competition returns a 400 for windows past ~9-10 days —
    // confirmed reproducible, not rate-limit flakiness (same query fails
    // consistently on retry) — likely because fixtures for the competition's
    // current round aren't resolved that far ahead server-side. Since
    // fetchLeagueMatches makes one request for the whole window, that
    // failure was all-or-nothing: it wiped out even the real near-term
    // matches a narrower query returns fine. Libertadores has no such limit
    // at the full 14-day window, so this is scoped to Sudamericana only.
    maxWindowDays: 7,
  },
];

export const LEAGUES_BY_ID: Record<string, LeagueConfig> = Object.fromEntries(
  LEAGUES.map((l) => [l.id, l]),
);

export const DEFAULT_SELECTED_LEAGUE_IDS = LEAGUES.map((l) => l.id);
