import type { Match } from "./espn";

/**
 * UTC calendar-day key, e.g. "2026-09-11" — deliberately UTC, not the
 * viewer's local timezone. This key decides which day-bucket a match falls
 * into and which of "Today"/"Tomorrow"/a weekday name it gets, and that
 * grouping has to be identical between the server render and the client
 * hydration pass, or React sees a structurally different tree (different
 * number/keys of day sections) and throws a hydration error — not just a
 * mismatched text node, which `suppressHydrationWarning` could paper over.
 * The actual kickoff *time* shown to the guest still uses their local
 * timezone — see `matchTime` — only the day-bucketing is pinned to UTC.
 */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function dayLabel(iso: string): string {
  const target = new Date(iso);
  const now = new Date();

  const targetKey = dayKey(iso);
  const todayKey = dayKey(now.toISOString());
  // Plain epoch-ms arithmetic rather than Date.setDate/getDate, which
  // operate in the runtime's *local* time — the whole point here is to
  // never depend on which timezone this happens to run in (see dayKey).
  const tomorrowKey = dayKey(new Date(now.getTime() + ONE_DAY_MS).toISOString());

  if (targetKey === todayKey) return "Today";
  if (targetKey === tomorrowKey) return "Tomorrow";

  // Only this far-out branch uses the viewer's local timezone (for a
  // human-readable weekday name) — safe, since it's just text at this
  // point, not the structural bucketing decision above.
  return target.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function matchTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface DayGroup {
  key: string;
  label: string;
  matches: Match[];
}

export function groupByDay(matches: Match[]): DayGroup[] {
  const map = new Map<string, DayGroup>();

  for (const match of matches) {
    const key = dayKey(match.date);
    const existing = map.get(key);
    if (existing) {
      existing.matches.push(match);
    } else {
      map.set(key, { key, label: dayLabel(match.date), matches: [match] });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}
