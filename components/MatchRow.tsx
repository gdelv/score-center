import type { Match, MatchTeam } from "@/lib/espn";
import { matchTime } from "@/lib/format";
import { TeamLogo } from "./TeamLogo";
import { LiveBadge } from "./LiveBadge";

function TeamLine({ team, showScore }: { team: MatchTeam; showScore: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <TeamLogo src={team.logo} alt={team.shortName} size={22} />
      <span
        className={`truncate text-[15px] ${team.winner ? "font-semibold text-ink" : "font-medium text-ink"}`}
      >
        {team.name}
      </span>
      {showScore && (
        <span className="tabular ml-auto pl-2 text-[15px] font-semibold text-ink">
          {team.score}
        </span>
      )}
    </div>
  );
}

export function MatchRow({ match }: { match: Match }) {
  const isLive = match.state === "in";

  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-border last:border-b-0">
      <div className="w-16 shrink-0 pt-0.5 text-right">
        {!isLive && (
          <div className="tabular text-sm font-medium text-ink">{matchTime(match.date)}</div>
        )}
        <div className="mt-0.5 text-[11px] text-ink-dim">{match.leagueShortName}</div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <TeamLine team={match.away} showScore={isLive} />
        <TeamLine team={match.home} showScore={isLive} />
        {isLive && (
          <div className="pt-0.5">
            <LiveBadge detail={match.statusDetail} />
          </div>
        )}
      </div>

      {match.venue && (
        <div className="hidden max-w-[160px] shrink-0 truncate pt-0.5 text-right text-xs text-ink-dim sm:block">
          {match.venue}
        </div>
      )}
    </div>
  );
}
