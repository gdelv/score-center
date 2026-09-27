// Shared ESPN NFL plumbing for /lines and /lines/touchdowns. NFL only for
// now: both URLs are per-sport/league, so another league means another pair.
export const SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
export const CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";

// Raw ESPN shapes, narrowed to the fields read here.
export interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  team: { id: string; displayName: string; abbreviation: string; logo?: string };
}

export interface EspnEvent {
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

export interface NflWeek {
  /** Unique across season types, e.g. "2-3" = regular season week 3. */
  key: string;
  label: string;
  seasonType: string;
  week: string;
}

export async function fetchJson<T>(url: string, revalidate?: number): Promise<T | null> {
  try {
    const res = await fetch(url, revalidate ? { next: { revalidate } } : undefined);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * The current season and every regular-season ("2") and postseason ("3")
 * week that has started, oldest first, from the default scoreboard's
 * calendar. Preseason is skipped: backups-only games aren't worth tracking.
 */
export async function fetchStartedWeeks(): Promise<{ year: number | null; weeks: NflWeek[] }> {
  const current = await fetchJson<EspnScoreboard>(`${SITE}/scoreboard`);
  const year = current?.season?.year;
  if (!year) return { year: null, weeks: [] };

  const now = Date.now();
  const weeks = (current.leagues?.[0]?.calendar ?? [])
    .filter((section) => section.value === "2" || section.value === "3")
    .flatMap((section) =>
      (section.entries ?? [])
        .filter((entry) => Date.parse(entry.startDate) <= now)
        .map((entry) => ({
          key: `${section.value}-${entry.value}`,
          label: entry.label,
          seasonType: section.value,
          week: entry.value,
        })),
    );
  return { year, weeks };
}

/**
 * One week's games. `week=` queries aren't hit by ESPN's ranged-`dates=`
 * 400s (see lib/espn.ts). Raw scoreboard deliberately uncached — callers
 * cache their small normalized result instead.
 */
export async function fetchWeekEvents(year: number, week: NflWeek): Promise<EspnEvent[]> {
  const board = await fetchJson<EspnScoreboard>(
    `${SITE}/scoreboard?seasontype=${week.seasonType}&week=${week.week}&dates=${year}`,
  );
  return board?.events ?? [];
}
