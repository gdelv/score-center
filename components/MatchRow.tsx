import type { Match, MatchTeam } from "@/lib/espn";
import { LEAGUES_BY_ID } from "@/lib/leagues";
import { formatOdds, matchTime } from "@/lib/format";
import { TeamLogo } from "./TeamLogo";
import { TeamMatchupHint } from "./TeamMatchupHint";
import { LiveBadge } from "./LiveBadge";

function TeamLine({
  team,
  showScore,
  showRankGutter,
  espnPath,
  hintDisabled,
}: {
  team: MatchTeam;
  showScore: boolean;
  showRankGutter: boolean;
  espnPath: string;
  hintDisabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {showRankGutter && (
        <span className="tabular w-5 shrink-0 text-right text-[12px] font-semibold text-ink-dim">
          {team.rank ? `#${team.rank}` : ""}
        </span>
      )}
      <TeamMatchupHint
        espnPath={espnPath}
        teamId={team.id}
        teamName={team.name}
        disabled={hintDisabled}
      >
        <TeamLogo src={team.logo} alt={team.shortName} size={22} />
        <span
          className={`truncate text-[15px] ${team.winner ? "font-semibold text-ink" : "font-medium text-ink"}`}
        >
          {team.name}
        </span>
      </TeamMatchupHint>
      {showScore && (
        <span className="tabular ml-auto pl-2 text-[15px] font-semibold text-ink">
          {team.score}
        </span>
      )}
    </div>
  );
}

export function MatchRow({
  match,
  showBroadcast,
  showOdds,
}: {
  match: Match;
  showBroadcast: boolean;
  showOdds: boolean;
}) {
  const isLive = match.state === "in";
  const showRankGutter = Boolean(match.home.rank || match.away.rank);
  const espnPath = LEAGUES_BY_ID[match.leagueId]?.espnPath ?? "";

  return (
    <div className="rounded-sm border border-border p-3.5">
      <div className="flex items-center justify-between gap-3 text-[11px] text-ink-dim">
        <span className="tabular truncate" suppressHydrationWarning>
          {isLive ? match.leagueShortName : `${matchTime(match.date)} · ${match.leagueShortName}`}
          {match.seriesLeg ? ` · ${match.seriesLeg}` : ""}
          {showBroadcast && match.broadcast ? ` · ${match.broadcast}` : ""}
        </span>
        {match.venue && <span className="truncate text-right">{match.venue}</span>}
      </div>

      <div className="mt-2 space-y-1.5">
        <TeamLine
          team={match.away}
          showScore={isLive}
          showRankGutter={showRankGutter}
          espnPath={espnPath}
          hintDisabled={isLive}
        />
        <TeamLine
          team={match.home}
          showScore={isLive}
          showRankGutter={showRankGutter}
          espnPath={espnPath}
          hintDisabled={isLive}
        />
      </div>

      {match.seriesLeg && (
        <div className="tabular mt-2 text-[11px] text-ink-dim">
          Agg {match.away.aggregateScore ?? 0}–{match.home.aggregateScore ?? 0}
        </div>
      )}

      {showOdds && match.odds && (
        <div className="tabular mt-2 text-[11px] text-ink-dim">
          {isLive ? `Pregame: ${formatOdds(match.odds)}` : formatOdds(match.odds)}
        </div>
      )}

      {isLive && (
        <div className="mt-2">
          <LiveBadge detail={match.statusDetail} />
        </div>
      )}
    </div>
  );
}
