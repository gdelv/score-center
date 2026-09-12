import { unstable_cache } from "next/cache";
import { fetchLeagueMatches, formatYmd, type Match } from "./espn";
import { LEAGUES_BY_ID } from "./leagues";

export type Contestant = "claude" | "chatgpt" | "gemini";
export type LegCount = 3 | 6 | 9 | 12;
export type PickSide = "home" | "away";

export const CONTESTANTS: { id: Contestant; label: string; accent: string }[] = [
  { id: "claude", label: "Claude", accent: "#D97757" },
  { id: "chatgpt", label: "ChatGPT", accent: "#10A37F" },
  { id: "gemini", label: "Gemini", accent: "#4285F4" },
];

export const LEG_COUNTS: LegCount[] = [3, 6, 9, 12];

/**
 * One against-the-spread pick. `matchId` must match a `Match.id` this app's
 * own data layer would produce (`college-football-{espnEventId}`) — look the
 * game up via `/api/matches` or ESPN's scoreboard for that date to get it
 * right; grading finds the game by this id and nothing else.
 */
export interface PredictionLeg {
  matchId: string;
  awayTeam: string;
  awayShort: string;
  homeTeam: string;
  homeShort: string;
  /** Which side was picked to cover. */
  pick: PickSide;
  /** Spread relative to the picked side — e.g. -3.5 (favorite) or +7.5 (underdog). */
  line: number;
  /** Kickoff, ISO UTC — used only to know which date to query for grading. */
  kickoff: string;
  /** Why this pick was made — shown on hover/tap. Optional so older entries without one still render fine. */
  reason?: string;
}

export interface Parlay {
  contestant: Contestant;
  legCount: LegCount;
  legs: PredictionLeg[];
}

export interface Week {
  id: string;
  label: string;
  parlays: Parlay[];
}

export interface PredictionsData {
  weeks: Week[];
}

export type LegStatus = "pending" | "live" | "hit" | "miss" | "push";

export interface GradedLeg extends PredictionLeg {
  status: LegStatus;
  /** Current lean toward covering, whenever a score exists — independent of `status`, since a live game's lean can still flip. */
  covering: boolean | null;
  awayScore: string | null;
  homeScore: string | null;
  awayLogo: string | null;
  homeLogo: string | null;
}

export type ParlayStatus = "pending" | "alive" | "won" | "busted";

export interface GradedParlay extends Omit<Parlay, "legs"> {
  legs: GradedLeg[];
  status: ParlayStatus;
}

export interface GradedWeek extends Omit<Week, "parlays"> {
  parlays: GradedParlay[];
}

function gradeLeg(leg: PredictionLeg, match: Match | undefined): GradedLeg {
  const base = {
    ...leg,
    awayScore: match?.away.score ?? null,
    homeScore: match?.home.score ?? null,
    awayLogo: match?.away.logo ?? null,
    homeLogo: match?.home.logo ?? null,
  };

  if (!match || match.state === "pre") {
    return { ...base, status: "pending", covering: null };
  }

  const pickedScore = Number(leg.pick === "home" ? match.home.score : match.away.score);
  const opponentScore = Number(leg.pick === "home" ? match.away.score : match.home.score);
  const adjustedMargin = pickedScore - opponentScore + leg.line;
  const covering = adjustedMargin > 0;

  if (match.state === "in") {
    return { ...base, status: "live", covering };
  }

  // state === "post"
  const status: LegStatus = adjustedMargin === 0 ? "push" : covering ? "hit" : "miss";
  return { ...base, status, covering: status === "push" ? null : covering };
}

function gradeParlayStatus(legs: GradedLeg[]): ParlayStatus {
  if (legs.some((l) => l.status === "miss")) return "busted";
  if (legs.every((l) => l.status === "pending")) return "pending";
  if (legs.every((l) => l.status === "hit" || l.status === "push")) return "won";
  return "alive";
}

async function fetchCollegeFootballOnDate(ymd: string): Promise<Match[]> {
  const league = LEAGUES_BY_ID["college-football"];
  if (!league) return [];
  return fetchLeagueMatches(league, ymd, ymd);
}

async function gradeWeeksUncached(data: PredictionsData): Promise<GradedWeek[]> {
  const allLegs = data.weeks.flatMap((w) => w.parlays.flatMap((p) => p.legs));
  const uniqueDates = [...new Set(allLegs.map((leg) => formatYmd(new Date(leg.kickoff))))];

  const perDateMatches = await Promise.all(uniqueDates.map(fetchCollegeFootballOnDate));
  const matchById = new Map<string, Match>();
  for (const match of perDateMatches.flat()) {
    matchById.set(match.id, match);
  }

  return data.weeks.map((week) => ({
    ...week,
    parlays: week.parlays.map((parlay) => {
      const legs = parlay.legs.map((leg) => gradeLeg(leg, matchById.get(leg.matchId)));
      return { ...parlay, legs, status: gradeParlayStatus(legs) };
    }),
  }));
}

const cachedGradeWeeks = unstable_cache(gradeWeeksUncached, ["score-center-predictions-grading"], {
  revalidate: 120,
});

/**
 * Grades every leg of every parlay against real game data and caches the
 * result for 120s (same window as the main scoreboard) — deliberately
 * dynamic rather than a grade recorded once and left stale, so a parlay
 * that's "alive" updates automatically as games finish, with no manual
 * update step required week to week.
 */
export function gradeWeeks(data: PredictionsData): Promise<GradedWeek[]> {
  return cachedGradeWeeks(data);
}

export interface ContestantRecord {
  contestant: Contestant;
  parlaysWon: number;
  parlaysBusted: number;
  parlaysAlive: number;
  parlaysPending: number;
  legsHit: number;
  legsMiss: number;
  legsPush: number;
}

/** Cumulative record per contestant across every week — the "track their progress" view. */
export function computeRecords(weeks: GradedWeek[]): ContestantRecord[] {
  return CONTESTANTS.map(({ id }) => {
    const record: ContestantRecord = {
      contestant: id,
      parlaysWon: 0,
      parlaysBusted: 0,
      parlaysAlive: 0,
      parlaysPending: 0,
      legsHit: 0,
      legsMiss: 0,
      legsPush: 0,
    };

    for (const week of weeks) {
      for (const parlay of week.parlays) {
        if (parlay.contestant !== id) continue;

        if (parlay.status === "won") record.parlaysWon++;
        else if (parlay.status === "busted") record.parlaysBusted++;
        else if (parlay.status === "alive") record.parlaysAlive++;
        else record.parlaysPending++;

        for (const leg of parlay.legs) {
          if (leg.status === "hit") record.legsHit++;
          else if (leg.status === "miss") record.legsMiss++;
          else if (leg.status === "push") record.legsPush++;
        }
      }
    }

    return record;
  });
}
