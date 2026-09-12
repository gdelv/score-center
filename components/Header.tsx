"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function secondsAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

function agoLabel(seconds: number): string {
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

const NAV_LINKS = [
  { href: "/", label: "Scores", match: "scores" },
  { href: "/predictions", label: "Predictions", match: "predictions" },
] as const;

export function Header({
  fetchedAt,
  active,
}: {
  fetchedAt: string;
  active: "scores" | "predictions";
}) {
  // Ticks periodically so the "updated N ago" label keeps advancing even
  // when fetchedAt itself hasn't changed; the label is derived fresh below.
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border py-5">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="font-display text-2xl font-bold leading-none text-ink sm:text-[26px]"
        >
          Score Center
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={active === link.match ? "text-ink" : "text-ink-dim hover:text-ink"}
              aria-current={active === link.match ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <span className="text-xs text-ink-dim" suppressHydrationWarning>
        Updated {agoLabel(secondsAgo(fetchedAt))}
      </span>
    </header>
  );
}
