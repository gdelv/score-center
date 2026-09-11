import type { Sport } from "@/lib/leagues";

export type SportTab = Sport | "all";

const TABS: { id: SportTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "soccer", label: "Soccer" },
  { id: "nfl", label: "NFL" },
  { id: "cfb", label: "College" },
];

export function SportTabs({
  active,
  onChange,
}: {
  active: SportTab;
  onChange: (tab: SportTab) => void;
}) {
  return (
    <div className="inline-flex rounded-sm border border-border bg-surface p-1">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            className={`min-h-9 rounded-sm px-4 text-sm font-medium transition-colors ${
              isActive ? "bg-amber text-amber-ink" : "text-ink-dim hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
