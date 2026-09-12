"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TeamLastResult } from "@/app/api/team-result/route";

type FetchState = "loading" | { data: TeamLastResult | null };

// Shared across every instance on the page — hovering the same team twice
// (e.g. it appears in two different matches) only ever fetches once.
const cache = new Map<string, TeamLastResult | null>();

function subscribeHoverCapability(callback: () => void) {
  const mql = window.matchMedia("(hover: hover)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getHoverCapability(): boolean {
  return window.matchMedia("(hover: hover)").matches;
}

// Assume hover-capable until proven otherwise on the client — this only
// selects which handlers get attached below, never rendered markup, so it
// can't cause a hydration mismatch either way.
function getServerHoverCapability(): boolean {
  return true;
}

/**
 * Wraps a team name/logo so hovering (desktop) or tapping (mobile, where
 * hover doesn't exist) reveals that team's own most recent result — not
 * head-to-head history against today's opponent, which ESPN has no direct
 * endpoint for. Only meaningful for a match that hasn't started yet; render
 * children directly (no wrapper) for live matches.
 */
export function TeamMatchupHint({
  espnPath,
  teamId,
  teamName,
  disabled,
  gapClassName = "gap-2",
  children,
}: {
  espnPath: string;
  teamId: string;
  teamName: string;
  disabled?: boolean;
  /** Matches the surrounding row's gap so logo/name spacing stays consistent — default `gap-2`. */
  gapClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState>("loading");
  const canHover = useSyncExternalStore(
    subscribeHoverCapability,
    getHoverCapability,
    getServerHoverCapability,
  );
  const containerRef = useRef<HTMLSpanElement>(null);
  const key = `${espnPath}:${teamId}`;

  function load() {
    const cached = cache.get(key);
    if (cached !== undefined) {
      setState({ data: cached });
      return;
    }
    setState("loading");
    fetch(`/api/team-result?espnPath=${encodeURIComponent(espnPath)}&teamId=${teamId}`)
      .then((res) => (res.ok ? res.json() : { result: null }))
      .then((json: { result: TeamLastResult | null }) => {
        cache.set(key, json.result);
        setState({ data: json.result });
      })
      .catch(() => {
        cache.set(key, null);
        setState({ data: null });
      });
  }

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [open]);

  if (disabled || teamId === "unknown") return <>{children}</>;

  return (
    <span ref={containerRef} className="relative inline-flex min-w-0">
      <button
        type="button"
        className={`flex min-w-0 items-center text-left ${gapClassName}`}
        // Hover and click handlers must be mutually exclusive, not layered:
        // a real tap fires a synthetic mouseenter immediately before its
        // click (standard touch-to-mouse compatibility-event behavior), so
        // with both attached the mouseenter opens it and the very same tap's
        // click then toggles it straight back closed.
        {...(canHover
          ? {
              onMouseEnter: () => {
                setOpen(true);
                load();
              },
              onMouseLeave: () => setOpen(false),
            }
          : {
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                setOpen((wasOpen) => {
                  if (!wasOpen) load();
                  return !wasOpen;
                });
              },
            })}
      >
        {children}
      </button>

      {open && (
        <span
          role="tooltip"
          className="tabular absolute left-0 top-full z-20 mt-1 whitespace-nowrap rounded-sm border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-ink shadow-sm"
        >
          {state === "loading" && "Loading…"}
          {state !== "loading" &&
            (state.data
              ? `Last: ${state.data.result} ${state.data.teamScore}-${state.data.opponentScore} vs ${state.data.opponent}`
              : `No recent result for ${teamName}`)}
        </span>
      )}
    </span>
  );
}
