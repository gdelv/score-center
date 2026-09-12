import type { Match } from "@/lib/espn";
import { TeamLogo } from "./TeamLogo";

function Pipe() {
  return (
    <span className="text-border" aria-hidden>
      |
    </span>
  );
}

// Logos only, no team names — the point of a ticker is to scan fast, and
// the logo already carries recognition; the pulsing dot (live only — that
// signal stays reserved for genuinely live matches, Von Restorff isolation)
// or "F" carries the rest.
function GameScore({ match, isLive }: { match: Match; isLive: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px]">
      {isLive && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-turf opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-turf" />
        </span>
      )}
      <TeamLogo src={match.away.logo} alt={match.away.shortName} size={16} />
      <span className="tabular font-semibold text-ink">{match.away.score}</span>
      <span className="text-ink-dim">@</span>
      <TeamLogo src={match.home.logo} alt={match.home.shortName} size={16} />
      <span className="tabular font-semibold text-ink">{match.home.score}</span>
      <span className="text-ink-dim">{isLive ? match.statusDetail : "F"}</span>
    </span>
  );
}

/** Keeps same-league games adjacent so the label only needs to appear once per run. */
function groupByLeague(matches: Match[]): Match[] {
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const group = groups.get(m.leagueId);
    if (group) group.push(m);
    else groups.set(m.leagueId, [m]);
  }
  return Array.from(groups.values()).flat();
}

// The loop works by scrolling the track exactly -50% (see the ticker-scroll
// keyframes), which only looks seamless if that first half is already wider
// than the viewport — otherwise the second half runs out mid-screen and the
// rest of the bar just sits empty. With only 1-2 matches, doubling alone
// isn't nearly enough, so repeat up to a minimum item count first.
const MIN_ITEMS_BEFORE_DOUBLING = 14;

function ScrollingBar({ matches, isLive }: { matches: Match[]; isLive: boolean }) {
  const grouped = groupByLeague(matches);
  const repeatCount = Math.max(1, Math.ceil(MIN_ITEMS_BEFORE_DOUBLING / grouped.length));
  const half = Array.from({ length: repeatCount }, () => grouped).flat();
  const track = [...half, ...half];

  // Keeps pacing roughly constant per item instead of one fixed duration
  // that would race by with few matches or crawl with many.
  const durationSeconds = Math.max(20, track.length * 4);

  // A flat list of cells — a league label only where the league changes
  // from the previous game, a game every time — each preceded by a pipe
  // except the very first cell in the whole track.
  const cells: React.ReactNode[] = [];
  track.forEach((match, i) => {
    const prev = track[i - 1];
    if (!prev || prev.leagueId !== match.leagueId) {
      cells.push(
        <span key={`label-${match.id}-${i}`} className="font-medium text-ink-dim">
          {match.leagueShortName}
        </span>,
      );
    }
    cells.push(<GameScore key={`${match.id}-${i}`} match={match} isLive={isLive} />);
  });

  return (
    <div
      className="ticker-track flex w-max items-center gap-3 py-2 hover:[animation-play-state:paused]"
      style={{ animationDuration: `${durationSeconds}s` }}
    >
      {cells.map((cell, i) => (
        <span key={i} className="flex shrink-0 items-center gap-3">
          {i > 0 && <Pipe />}
          {cell}
        </span>
      ))}
    </div>
  );
}

/**
 * A continuously scrolling strip, unfiltered by the league/sport selection
 * below it. Prefers live matches; falls back to recently finished results
 * when nothing's live — including last night's, kept around through the
 * guest's own local midnight until something new goes live, not just
 * "today" by the server's UTC clock (see fetchAllUpcomingMatches) — rather
 * than an empty bar; falls back again to a static message when neither
 * exists (e.g. before anything's kicked off).
 */
export function LiveTicker({
  liveMatches,
  recentFinishedMatches,
}: {
  liveMatches: Match[];
  recentFinishedMatches: Match[];
}) {
  if (liveMatches.length === 0 && recentFinishedMatches.length === 0) {
    // Same bar, same height regardless of which state we're in — no layout
    // jump the moment a match goes live or wraps up.
    return (
      <div className="overflow-hidden border-b border-border bg-surface">
        <div className="flex items-center px-4 py-2 text-[13px] text-ink-dim">
          No games right now
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-b border-border bg-surface">
      {liveMatches.length > 0 ? (
        <ScrollingBar matches={liveMatches} isLive />
      ) : (
        <ScrollingBar matches={recentFinishedMatches} isLive={false} />
      )}
    </div>
  );
}
