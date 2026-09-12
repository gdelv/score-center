import { CONTESTANTS, type ContestantRecord } from "@/lib/predictions";

export function PredictionsLeaderboard({ records }: { records: ContestantRecord[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {records.map((record) => {
        const meta = CONTESTANTS.find((c) => c.id === record.contestant);
        if (!meta) return null;

        return (
          <div key={record.contestant} className="rounded-sm border border-border p-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: meta.accent }}
                aria-hidden
              />
              <span className="font-display text-lg font-bold text-ink">{meta.label}</span>
            </div>

            <div className="tabular mt-2 text-sm">
              <span className="font-semibold text-turf">{record.parlaysWon}W</span>
              <span className="text-ink-dim"> – </span>
              <span className="font-semibold text-loss">{record.parlaysBusted}L</span>
              {record.parlaysAlive > 0 && (
                <span className="text-ink-dim"> · {record.parlaysAlive} alive</span>
              )}
              {record.parlaysPending > 0 && (
                <span className="text-ink-dim"> · {record.parlaysPending} pending</span>
              )}
            </div>

            <div className="tabular mt-1 text-xs text-ink-dim">
              Legs: {record.legsHit}-{record.legsMiss}
              {record.legsPush > 0 ? `-${record.legsPush}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
