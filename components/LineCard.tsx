"use client";

import {
  favoriteSide,
  spreadResult,
  totalResult,
  winnerSide,
  type GameLine,
  type LineTeam,
  type Side,
} from "@/lib/lines";
import { formatLine, matchDayTime } from "@/lib/format";
import { useHasMounted } from "@/hooks/useHasMounted";
import { TeamLogo } from "./TeamLogo";

function TeamScore({ team, won }: { team: LineTeam; won: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <TeamLogo src={team.logo} alt={team.abbreviation} size={22} />
      <span className={`truncate text-[15px] ${won ? "font-semibold text-ink" : "text-ink-dim"}`}>
        {team.name}
      </span>
      <span
        className={`tabular ml-auto pl-2 text-[15px] ${won ? "font-semibold text-ink" : "text-ink-dim"}`}
      >
        {team.score}
      </span>
    </div>
  );
}

function LineRow({
  label,
  line,
  moved,
  result,
  highlight = false,
}: {
  label: string;
  line: string;
  moved?: string | null;
  result: string;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-[3.75rem_1fr_auto] items-baseline gap-2 text-[13px]">
      <span className="text-ink-dim">{label}</span>
      <span className="tabular min-w-0 truncate text-ink">
        {line}
        {moved && <span className="text-ink-dim"> · {moved}</span>}
      </span>
      <span className={`tabular text-right font-semibold ${highlight ? "text-amber" : "text-ink"}`}>
        {result}
      </span>
    </div>
  );
}

export function LineCard({ game }: { game: GameLine }) {
  const mounted = useHasMounted();
  const team = (side: Side) => (side === "home" ? game.home : game.away);
  // ESPN's lines are home-relative; flip for the away side.
  const fromSide = (side: Side, homeRelative: number) =>
    side === "home" ? homeRelative : -homeRelative;

  const fav = favoriteSide(game);
  const winner = winnerSide(game);
  const points = game.home.score + game.away.score;

  let spread = null;
  if (game.spread) {
    const side = fav ?? "home";
    const { open, close } = game.spread;
    const ats = spreadResult(game);
    spread = {
      line: fav ? `${team(side).abbreviation} ${formatLine(fromSide(side, close))}` : "PK",
      moved:
        open != null && open !== close
          ? `opened ${fav ? "" : `${team(side).abbreviation} `}${formatLine(fromSide(side, open))}`
          : null,
      result: ats === "push" ? "Push" : `${team(ats!).abbreviation} covered`,
    };
  }

  let total = null;
  if (game.total) {
    const { open, close } = game.total;
    const result = totalResult(game)!;
    total = {
      line: `${close}`,
      moved: open != null && open !== close ? `opened ${open}` : null,
      result: `${result[0].toUpperCase()}${result.slice(1)} · ${points}`,
    };
  }

  let moneyline = null;
  if (game.moneyline) {
    const { home, away } = game.moneyline;
    const upset = fav !== null && winner !== null && winner !== fav;
    moneyline = {
      line: [
        away != null ? `${game.away.abbreviation} ${formatLine(away)}` : null,
        home != null ? `${game.home.abbreviation} ${formatLine(home)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      result: !winner
        ? "Tie"
        : !fav
          ? `${team(winner).abbreviation} won`
          : upset
            ? "Upset"
            : "Favorite won",
      upset,
    };
  }

  return (
    <div className="rounded-sm border border-border p-3.5">
      <div className="flex items-center justify-between gap-3 text-[11px] text-ink-dim">
        <span className="tabular">{mounted ? matchDayTime(game.date) : " "}</span>
        <span>Final</span>
      </div>

      <div className="mt-2 space-y-1.5">
        <TeamScore team={game.away} won={winner === "away"} />
        <TeamScore team={game.home} won={winner === "home"} />
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border pt-3">
        {spread || total || moneyline ? (
          <>
            {spread && <LineRow label="Spread" {...spread} />}
            {total && <LineRow label="Total" {...total} />}
            {moneyline && (
              <LineRow
                label="Money"
                line={moneyline.line}
                result={moneyline.result}
                highlight={moneyline.upset}
              />
            )}
          </>
        ) : (
          <p className="text-[13px] text-ink-dim">No line posted for this game.</p>
        )}
      </div>
    </div>
  );
}
