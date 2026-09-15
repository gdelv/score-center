"use client";

import { useEffect, useState } from "react";
import type { Match } from "@/lib/espn";
import { LEAGUES_BY_ID } from "@/lib/leagues";
import { dayLabel, formatOdds, matchTime } from "@/lib/format";
import { TeamLogo } from "./TeamLogo";
import { TeamMatchupHint } from "./TeamMatchupHint";
import { LiveBadge } from "./LiveBadge";

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "kicking off now";

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

export function NextMatchPanel({
  match,
  showBroadcast,
  showOdds,
}: {
  match: Match;
  showBroadcast: boolean;
  showOdds: boolean;
}) {
  // Ticks periodically so the countdown keeps advancing; the label is derived fresh below.
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const until = timeUntil(match.date);
  const isLive = match.state === "in";
  const showRankGutter = Boolean(match.home.rank || match.away.rank);
  const espnPath = LEAGUES_BY_ID[match.leagueId]?.espnPath ?? "";

  return (
    <div className="rounded-sm border border-border border-l-[3px] border-l-amber bg-surface px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex items-center justify-between gap-3 text-xs text-ink-dim">
        <span className="truncate">
          {match.leagueName}
          {match.seriesLeg ? ` · ${match.seriesLeg}` : ""}
          {showBroadcast && match.broadcast ? ` · ${match.broadcast}` : ""}
        </span>
        {match.venue && <span className="hidden truncate sm:inline">{match.venue}</span>}
      </div>

      <div className="mt-3 flex items-center gap-3">
        {showRankGutter && (
          <span className="tabular w-7 shrink-0 text-right text-base font-semibold text-ink-dim">
            {match.away.rank ? `#${match.away.rank}` : ""}
          </span>
        )}
        <TeamMatchupHint
          espnPath={espnPath}
          teamId={match.away.id}
          teamName={match.away.name}
          disabled={isLive}
          gapClassName="gap-3"
        >
          <TeamLogo src={match.away.logo} alt={match.away.shortName} size={30} />
          <span className="truncate font-display text-2xl font-bold leading-none text-ink sm:text-3xl">
            {match.away.name}
          </span>
        </TeamMatchupHint>
        {isLive && (
          <span className="tabular ml-auto font-display text-2xl font-bold text-ink">
            {match.away.score}
          </span>
        )}
      </div>
      <div className="my-1.5 flex items-center gap-3 text-sm font-medium text-ink-dim">
        {showRankGutter && <span className="w-7 shrink-0" aria-hidden />}
        <span className="w-[30px] shrink-0" aria-hidden />
        <span>at</span>
      </div>
      <div className="flex items-center gap-3">
        {showRankGutter && (
          <span className="tabular w-7 shrink-0 text-right text-base font-semibold text-ink-dim">
            {match.home.rank ? `#${match.home.rank}` : ""}
          </span>
        )}
        <TeamMatchupHint
          espnPath={espnPath}
          teamId={match.home.id}
          teamName={match.home.name}
          disabled={isLive}
          gapClassName="gap-3"
        >
          <TeamLogo src={match.home.logo} alt={match.home.shortName} size={30} />
          <span className="truncate font-display text-2xl font-bold leading-none text-ink sm:text-3xl">
            {match.home.name}
          </span>
        </TeamMatchupHint>
        {isLive && (
          <span className="tabular ml-auto font-display text-2xl font-bold text-ink">
            {match.home.score}
          </span>
        )}
      </div>

      <div className="tabular mt-4 text-sm font-semibold text-amber" suppressHydrationWarning>
        {isLive ? (
          <LiveBadge detail={match.statusDetail} />
        ) : (
          <>
            {dayLabel(match.date)} · {matchTime(match.date)}
            <span className="text-ink-dim" suppressHydrationWarning>
              {" "}
              — {until}
            </span>
          </>
        )}
      </div>

      {match.seriesLeg && (
        <div className="tabular mt-1.5 text-xs text-ink-dim">
          Agg {match.away.aggregateScore ?? 0}–{match.home.aggregateScore ?? 0}
        </div>
      )}

      {showOdds && match.odds && (
        <div className="tabular mt-1.5 text-xs text-ink-dim">
          {isLive ? `Pregame: ${formatOdds(match.odds)}` : formatOdds(match.odds)}
        </div>
      )}
    </div>
  );
}
