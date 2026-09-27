import Link from "next/link";

const TABS = [
  { href: "/lines", label: "Betting lines", id: "lines" },
  { href: "/lines/touchdowns", label: "TD scorers", id: "touchdowns" },
  { href: "/lines/parlay", label: "TD parlay", id: "parlay" },
] as const;

/** Sub-navigation between the NFL pages, which share the header's "NFL Lines" slot. */
export function LinesNav({ active }: { active: (typeof TABS)[number]["id"] }) {
  return (
    <nav className="inline-flex rounded-sm border border-border bg-surface p-1">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-9 items-center rounded-sm px-4 text-sm font-medium transition-colors ${
              isActive ? "bg-amber text-amber-ink" : "text-ink-dim hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
