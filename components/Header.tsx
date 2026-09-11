"use client";

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

export function Header({ fetchedAt }: { fetchedAt: string }) {
  // Ticks periodically so the "updated N ago" label keeps advancing even
  // when fetchedAt itself hasn't changed; the label is derived fresh below.
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-border py-5">
      <span className="font-display text-2xl font-bold leading-none text-ink sm:text-[26px]">
        Score Center
      </span>
      <span className="text-xs text-ink-dim" suppressHydrationWarning>
        Updated {agoLabel(secondsAgo(fetchedAt))}
      </span>
    </header>
  );
}
