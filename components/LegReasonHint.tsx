"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

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
 * Wraps a pick so hovering (desktop) or tapping (mobile, where hover
 * doesn't exist) reveals the reasoning behind it. Same interaction pattern
 * as `TeamMatchupHint` (hover/tap handlers must be mutually exclusive, not
 * layered — see that component for why), but simpler: the text is already
 * in hand from `data/predictions.json`, no fetch or cache needed.
 */
export function LegReasonHint({
  reason,
  children,
}: {
  reason?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const canHover = useSyncExternalStore(
    subscribeHoverCapability,
    getHoverCapability,
    getServerHoverCapability,
  );
  const containerRef = useRef<HTMLSpanElement>(null);

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

  if (!reason) {
    // Same flex/gap layout as the interactive version below, so a leg
    // without a reason yet lines up identically with one that has one.
    return <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>;
  }

  return (
    <span ref={containerRef} className="relative inline-flex min-w-0 flex-1">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        {...(canHover
          ? {
              onMouseEnter: () => setOpen(true),
              onMouseLeave: () => setOpen(false),
            }
          : {
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                setOpen((wasOpen) => !wasOpen);
              },
            })}
      >
        {children}
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 w-64 max-w-[80vw] text-pretty rounded-sm border border-border bg-surface-raised px-2.5 py-2 text-xs leading-relaxed text-ink shadow-sm"
        >
          {reason}
        </span>
      )}
    </span>
  );
}
