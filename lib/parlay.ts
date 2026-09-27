// The group's weekly anytime-TD parlay: each person picks one player to score
// a touchdown, and every pick is a leg. Pure and client-safe — storage lives
// in lib/parlay-store.ts (server only).
import history from "@/data/td-parlay-history.json";
import { sameName, type TdSeason } from "./touchdowns";

export const PICKERS = [
  "Giusseppe",
  "Dana",
  "Mike",
  "Irene",
  "Daniel",
  "Gabriel",
  "Vany",
  "Mikael",
  "Cristian",
] as const;

export type Picker = (typeof PICKERS)[number];

export function isPicker(value: unknown): value is Picker {
  return typeof value === "string" && (PICKERS as readonly string[]).includes(value);
}

/** One saved pick. Keyed in the store by season, week, and picker. */
export interface StoredPick {
  picker: Picker;
  weekKey: string;
  playerId: string;
  player: string;
  position: string;
  teamId: string;
  pickedAt: string;
}

export interface Leg {
  /** null for history legs, where who picked what wasn't recorded. */
  picker: Picker | null;
  player: string;
  position: string | null;
  teamId: string;
}

export type LegStatus = "pending" | "live" | "hit" | "miss" | "no-game";

export interface GradedLeg extends Leg {
  status: LegStatus;
  /** Kickoff of the leg's game, ISO; null if the team had no game that week. */
  kickoff: string | null;
}

export type ParlayStatus = "pending" | "alive" | "won" | "busted";

export interface GradedWeek {
  key: string;
  label: string;
  legs: GradedLeg[];
  status: ParlayStatus;
}

/** History legs by week key, with team abbreviations resolved to ids. */
function historyLegs(season: TdSeason): Record<string, Leg[]> {
  if (history.season !== season.season) return {};
  const idOf = new Map(season.teams.map((t) => [t.abbreviation, t.id]));
  return Object.fromEntries(
    Object.entries(history.weeks).map(([weekKey, legs]) => [
      weekKey,
      legs.map((leg) => ({
        picker: null,
        player: leg.player,
        position: null,
        teamId: idOf.get(leg.team) ?? leg.team,
      })),
    ]),
  );
}

function gradeLeg(leg: Leg, season: TdSeason, weekKey: string): GradedLeg {
  const game = season.weeks.find((w) => w.key === weekKey)?.teams[leg.teamId];
  if (!game) return { ...leg, status: "no-game", kickoff: null };
  // A TD during the game already settles the leg — no need to wait for the end.
  const scored = game.touchdowns.some((td) => sameName(td.player, leg.player));
  const status: LegStatus = scored
    ? "hit"
    : game.state === "post"
      ? "miss"
      : game.state === "in"
        ? "live"
        : "pending";
  return { ...leg, status, kickoff: game.date };
}

/** Real parlay rules: one missed leg busts it; it's won only when every leg has hit. */
function parlayStatus(legs: GradedLeg[]): ParlayStatus {
  if (legs.some((l) => l.status === "miss" || l.status === "no-game")) return "busted";
  if (legs.length > 0 && legs.every((l) => l.status === "hit")) return "won";
  if (legs.some((l) => l.status === "hit" || l.status === "live")) return "alive";
  return "pending";
}

/**
 * Every week that has legs, newest first, graded live against the season's
 * TD data — nothing about a result is ever stored.
 */
export function gradeParlays(season: TdSeason, picks: StoredPick[]): GradedWeek[] {
  const legsByWeek = historyLegs(season);
  for (const pick of picks) {
    (legsByWeek[pick.weekKey] ??= []).push({
      picker: pick.picker,
      player: pick.player,
      position: pick.position,
      teamId: pick.teamId,
    });
  }

  return season.weeks
    .filter((w) => legsByWeek[w.key]?.length)
    .map((w) => {
      const legs = legsByWeek[w.key]
        .map((leg) => gradeLeg(leg, season, w.key))
        .sort(
          (a, b) =>
            (PICKERS as readonly (string | null)[]).indexOf(a.picker) -
            (PICKERS as readonly (string | null)[]).indexOf(b.picker),
        );
      return { key: w.key, label: w.label, legs, status: parlayStatus(legs) };
    })
    .reverse();
}

/** The week picks are open for: the latest one with a game not yet kicked off. */
export function openWeek(season: TdSeason) {
  return [...season.weeks]
    .reverse()
    .find((w) => Object.values(w.teams).some((g) => g.state === "pre"));
}

export interface PickerRecord {
  picker: Picker;
  hits: number;
  misses: number;
}

/** Per-person leg record across the season (history legs have no picker, so don't count). */
export function pickerRecords(weeks: GradedWeek[]): PickerRecord[] {
  return PICKERS.map((picker) => {
    const legs = weeks.flatMap((w) => w.legs).filter((l) => l.picker === picker);
    return {
      picker,
      hits: legs.filter((l) => l.status === "hit").length,
      misses: legs.filter((l) => l.status === "miss" || l.status === "no-game").length,
    };
  });
}
