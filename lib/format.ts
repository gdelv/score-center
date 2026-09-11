import type { Match } from "./espn";

/** Local-timezone calendar-day key, e.g. "2026-09-11". Grouping must use this, not the UTC date. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function dayLabel(iso: string): string {
  const target = new Date(iso);
  const now = new Date();

  const targetKey = dayKey(iso);
  const todayKey = dayKey(now.toISOString());
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dayKey(tomorrow.toISOString());

  if (targetKey === todayKey) return "Today";
  if (targetKey === tomorrowKey) return "Tomorrow";

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
