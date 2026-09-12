import type { Match } from "@/lib/espn";
import { TeamLogo } from "./TeamLogo";

function LiveTickerItem({ match }: { match: Match }) {
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 text-[13px]">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-turf opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-turf" />
      </span>
      <span className="text-ink-dim">{match.leagueShortName}</span>

      <TeamLogo src={match.away.logo} alt={match.away.shortName} size={16} />
      <span className="font-medium text-ink">{match.away.shortName}</span>
      <span className="tabular font-semibold text-ink">{match.away.score}</span>
      <span className="text-ink-dim">–</span>
      <span className="tabular font-semibold text-ink">{match.home.score}</span>
      <span className="font-medium text-ink">{match.home.shortName}</span>
      <TeamLogo src={match.home.logo} alt={match.home.shortName} size={16} />

      <span className="text-ink-dim">{match.statusDetail}</span>
    </span>
  );
}

// Broadcast-style "AWAY score @ HOME score F" — no pulsing dot, since that
// signal is reserved for genuinely live matches (Von Restorff isolation).
function FinishedTickerItem({ match }: { match: Match }) {
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 text-[13px]">
      <span className="text-ink-dim">{match.leagueShortName}</span>

      <TeamLogo src={match.away.logo} alt={match.away.shortName} size={16} />
      <span className="font-medium text-ink">{match.away.shortName}</span>
      <span className="tabular font-semibold text-ink">{match.away.score}</span>
      <span className="text-ink-dim">@</span>
      <TeamLogo src={match.home.logo} alt={match.home.shortName} size={16} />
      <span className="font-medium text-ink">{match.home.shortName}</span>
      <span className="tabular font-semibold text-ink">{match.home.score}</span>

      <span className="font-semibold text-ink-dim">F</span>
    </span>
  );
}

// The loop works by scrolling the track exactly -50% (see the ticker-scroll
// keyframes), which only looks seamless if that first half is already wider
// than the viewport — otherwise the second half runs out mid-screen and the
// rest of the bar just sits empty. With only 1-2 matches, doubling alone
// isn't nearly enough, so repeat up to a minimum item count first.
const MIN_ITEMS_BEFORE_DOUBLING = 14;

function ScrollingBar({
  matches,
  Item,
}: {
  matches: Match[];
  Item: (props: { match: Match }) => React.ReactNode;
}) {
  const repeatCount = Math.max(1, Math.ceil(MIN_ITEMS_BEFORE_DOUBLING / matches.length));
  const half = Array.from({ length: repeatCount }, () => matches).flat();
  const track = [...half, ...half];

  // Keeps pacing roughly constant per item instead of one fixed duration
  // that would race by with few matches or crawl with many.
  const durationSeconds = Math.max(20, track.length * 4);

  return (
    <div
      className="ticker-track flex w-max py-2 hover:[animation-play-state:paused]"
      style={{ animationDuration: `${durationSeconds}s` }}
    >
      {track.map((match, i) => (
        <Item key={`${match.id}-${i}`} match={match} />
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
        <ScrollingBar matches={liveMatches} Item={LiveTickerItem} />
      ) : (
        <ScrollingBar matches={recentFinishedMatches} Item={FinishedTickerItem} />
      )}
    </div>
  );
}
