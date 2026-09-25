"use client";

import { localDayKey, shiftLocalDay } from "@/lib/format";
import { useHasMounted } from "@/hooks/useHasMounted";

/**
 * Prev/next day arrows around a native date input, plus a way back to the
 * default rolling "upcoming" board. `value` is a `localDayKey` or null for
 * the upcoming board. Native `<input type="date">` rather than a custom
 * calendar: it's the platform's own picker on every phone, already
 * accessible, and one less thing to get wrong.
 */
export function DatePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (day: string | null) => void;
}) {
  // "Today" is the guest's local today — unknowable on the server, so the
  // input stays blank until mounted rather than prerendering a wrong date.
  const mounted = useHasMounted();
  const today = mounted ? localDayKey(new Date()) : "";
  const shown = value ?? today;

  const step = (days: number) => shown && onChange(shiftLocalDay(shown, days));

  const arrowClass =
    "flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink-dim hover:text-ink disabled:opacity-40";

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-sm border border-border bg-surface">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!shown}
          aria-label="Previous day"
          className={arrowClass}
        >
          ‹
        </button>
        <input
          type="date"
          value={shown}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label="Show matches on date"
          className={`tabular min-h-11 bg-transparent px-1 text-sm font-medium ${
            value ? "text-ink" : "text-ink-dim"
          }`}
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!shown}
          aria-label="Next day"
          className={arrowClass}
        >
          ›
        </button>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="min-h-11 rounded-sm px-3 text-sm font-medium text-amber hover:underline"
        >
          Upcoming
        </button>
      )}
    </div>
  );
}
