import type { GradedLeg, GradedParlay, ParlayStatus } from "@/lib/predictions";
import { TeamLogo } from "./TeamLogo";

const STATUS_LABEL: Record<ParlayStatus, string> = {
  pending: "Pending",
  alive: "Alive",
  won: "Won",
  busted: "Busted",
};

const STATUS_COLOR: Record<ParlayStatus, string> = {
  pending: "text-ink-dim",
  alive: "text-amber",
  won: "text-turf",
  busted: "text-loss",
};

function LegStatus({ leg }: { leg: GradedLeg }) {
  if (leg.status === "pending") {
    return <span className="text-xs text-ink-dim">—</span>;
  }

  if (leg.status === "push") {
    return <span className="text-xs font-semibold text-ink-dim">Push</span>;
  }

  if (leg.status === "live") {
    return (
      <span className={`tabular text-xs font-semibold ${leg.covering ? "text-turf" : "text-loss"}`}>
        {leg.awayScore}–{leg.homeScore} · live
      </span>
    );
  }

  // hit or miss
  return (
    <span className={`tabular text-xs font-semibold ${leg.status === "hit" ? "text-turf" : "text-loss"}`}>
      {leg.awayScore}–{leg.homeScore} {leg.status === "hit" ? "✓" : "✕"}
    </span>
  );
}

function LegRow({ leg }: { leg: GradedLeg }) {
  const pickedShort = leg.pick === "home" ? leg.homeShort : leg.awayShort;
  const pickedLogo = leg.pick === "home" ? leg.homeLogo : leg.awayLogo;
  const opponentShort = leg.pick === "home" ? leg.awayShort : leg.homeShort;
  const lineText = leg.line > 0 ? `+${leg.line}` : `${leg.line}`;

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <TeamLogo src={pickedLogo} alt={pickedShort} size={18} />
        <span className="truncate text-[13px] text-ink">
          <span className="font-medium">{pickedShort}</span>{" "}
          <span className="tabular text-ink-dim">{lineText}</span>
          <span className="text-ink-dim"> vs {opponentShort}</span>
        </span>
      </div>
      <LegStatus leg={leg} />
    </div>
  );
}

export function ParlayCard({ parlay }: { parlay: GradedParlay }) {
  return (
    <div className="rounded-sm border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-bold text-ink">{parlay.legCount}-leg</span>
        <span className={`text-xs font-semibold ${STATUS_COLOR[parlay.status]}`}>
          {STATUS_LABEL[parlay.status]}
        </span>
      </div>
      <div className="mt-1 divide-y divide-border">
        {parlay.legs.map((leg) => (
          <LegRow key={leg.matchId} leg={leg} />
        ))}
      </div>
    </div>
  );
}
