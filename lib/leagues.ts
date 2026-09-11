export type Sport = "soccer" | "nfl";

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
];

export const LEAGUES_BY_ID: Record<string, LeagueConfig> = Object.fromEntries(
  LEAGUES.map((l) => [l.id, l]),
);

export const DEFAULT_SELECTED_LEAGUE_IDS = LEAGUES.map((l) => l.id);
