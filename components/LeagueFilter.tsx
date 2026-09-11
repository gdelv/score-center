import { LEAGUES, type Sport } from "@/lib/leagues";

const SPORT_LABEL: Record<Sport, string> = {
  nfl: "NFL",
  soccer: "Soccer",
};

export function LeagueFilter({
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  const bySport = new Map<Sport, typeof LEAGUES>();
  for (const league of LEAGUES) {
    bySport.set(league.sport, [...(bySport.get(league.sport) ?? []), league]);
  }

  return (
    <div>
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-medium text-ink-dim">Leagues</h2>
        <div className="flex gap-3 text-sm">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-ink-dim underline-offset-2 hover:text-ink hover:underline"
          >
            All
          </button>
          <button
            type="button"
            onClick={onSelectNone}
            className="text-ink-dim underline-offset-2 hover:text-ink hover:underline"
          >
            None
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {Array.from(bySport.entries()).map(([sport, leagues]) => (
          <div key={sport}>
            <h3 className="pb-1 text-xs text-ink-dim">{SPORT_LABEL[sport]}</h3>
            <ul>
              {leagues.map((league) => (
                <li key={league.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink">
                    <input
                      type="checkbox"
                      checked={selected.has(league.id)}
                      onChange={() => onToggle(league.id)}
                      style={{ "--league-accent": league.accent } as React.CSSProperties}
                      className="league-checkbox h-[18px] w-[18px] shrink-0"
                    />
                    {league.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
