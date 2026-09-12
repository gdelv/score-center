import { CONTESTANTS, type GradedWeek } from "@/lib/predictions";
import { ParlayCard } from "./ParlayCard";

export function PredictionsWeek({ week }: { week: GradedWeek }) {
  return (
    <section className="pt-10 first:pt-0">
      <h2 className="mb-4 border-b border-border pb-2 font-display text-xl font-bold text-ink">
        {week.label}
      </h2>

      <div className="space-y-8">
        {CONTESTANTS.map(({ id, label, accent }) => {
          const parlays = week.parlays
            .filter((p) => p.contestant === id)
            .sort((a, b) => a.legCount - b.legCount);

          if (parlays.length === 0) return null;

          return (
            <div key={id}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <h3 className="font-display text-lg font-bold text-ink">{label}</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {parlays.map((parlay) => (
                  <ParlayCard key={`${parlay.contestant}-${parlay.legCount}`} parlay={parlay} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
