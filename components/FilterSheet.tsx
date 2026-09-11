"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LeagueFilter } from "./LeagueFilter";
import { DisplayToggles } from "./DisplayToggles";

export function FilterSheet({
  selected,
  totalCount,
  onToggle,
  onSelectAll,
  onSelectNone,
  showBroadcast,
  showOdds,
  onToggleBroadcast,
  onToggleOdds,
}: {
  selected: Set<string>;
  totalCount: number;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  showBroadcast: boolean;
  showOdds: boolean;
  onToggleBroadcast: () => void;
  onToggleOdds: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-2 rounded-sm border border-border bg-surface px-4 text-[15px] font-medium text-ink lg:hidden"
      >
        Leagues
        <span className="tabular rounded-sm bg-surface-raised px-1.5 py-0.5 text-xs text-ink-dim">
          {selected.size}/{totalCount}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-lg border-t border-border bg-surface px-5 pb-8 pt-5 lg:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              role="dialog"
              aria-label="Filter leagues"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              <LeagueFilter
                selected={selected}
                onToggle={onToggle}
                onSelectAll={onSelectAll}
                onSelectNone={onSelectNone}
              />
              <DisplayToggles
                showBroadcast={showBroadcast}
                showOdds={showOdds}
                onToggleBroadcast={onToggleBroadcast}
                onToggleOdds={onToggleOdds}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-5 min-h-11 w-full rounded-sm bg-amber text-[15px] font-semibold text-amber-ink"
              >
                Done
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
