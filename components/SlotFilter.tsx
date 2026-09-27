"use client";

import { SLOT_LABELS, gameSlot, type GameSlot } from "@/lib/lines";

/** Slots that have at least one game in `dates`, in schedule order. */
export function slotsPresent(dates: string[]): GameSlot[] {
  const present = new Set(dates.map(gameSlot));
  return (Object.keys(SLOT_LABELS) as GameSlot[]).filter((s) => present.has(s));
}

/**
 * "All games / Thursday night / Sunday early / …" chips, shared by the two
 * NFL pages. `value` null = every slot. See `gameSlot` for how slots are cut.
 */
export function SlotFilter({
  slots,
  value,
  onChange,
}: {
  slots: GameSlot[];
  value: GameSlot | null;
  onChange: (slot: GameSlot | null) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <div className="flex gap-2 whitespace-nowrap" role="group" aria-label="Filter by game time">
        {[null, ...slots].map((s) => {
          const isActive = s === value;
          return (
            <button
              key={s ?? "all"}
              type="button"
              onClick={() => onChange(s)}
              aria-pressed={isActive}
              className={`min-h-11 shrink-0 rounded-sm border px-3.5 text-sm font-medium transition-colors ${
                isActive ? "border-amber text-ink" : "border-border text-ink-dim hover:text-ink"
              }`}
            >
              {s ? SLOT_LABELS[s] : "All games"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
