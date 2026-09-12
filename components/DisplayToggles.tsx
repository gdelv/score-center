export function DisplayToggles({
  showBroadcast,
  showOdds,
  onToggleBroadcast,
  onToggleOdds,
}: {
  showBroadcast: boolean;
  showOdds: boolean;
  onToggleBroadcast: () => void;
  onToggleOdds: () => void;
}) {
  return (
    <div className="mb-6 border-b border-border pb-6">
      <h2 className="mb-1 text-sm font-medium text-ink-dim">Show on each match</h2>
      <ul>
        <li>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink">
            <input
              type="checkbox"
              checked={showBroadcast}
              onChange={onToggleBroadcast}
              className="h-[18px] w-[18px] shrink-0"
            />
            Where to watch
          </label>
        </li>
        <li>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink">
            <input
              type="checkbox"
              checked={showOdds}
              onChange={onToggleOdds}
              className="h-[18px] w-[18px] shrink-0"
            />
            Betting odds
          </label>
        </li>
      </ul>
    </div>
  );
}
