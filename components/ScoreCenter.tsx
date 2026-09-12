"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Match } from "@/lib/espn";
import { groupByDay } from "@/lib/format";
import { LEAGUES, DEFAULT_SELECTED_LEAGUE_IDS } from "@/lib/leagues";
import { useLeagueFilter } from "@/hooks/useLeagueFilter";
import { useDisplayPrefs } from "@/hooks/useDisplayPrefs";
import { Header } from "./Header";
import { SportTabs, type SportTab } from "./SportTabs";
import { LeagueFilter } from "./LeagueFilter";
import { DisplayToggles } from "./DisplayToggles";
import { FilterSheet } from "./FilterSheet";
import { LiveTicker } from "./LiveTicker";
import { NextMatchPanel } from "./NextMatchPanel";
import { DateSection } from "./DateSection";
import { MatchRow } from "./MatchRow";
import { EmptyState } from "./EmptyState";

const POLL_MS = 90_000;

export function ScoreCenter({
  initialMatches,
  initialFetchedAt,
}: {
  initialMatches: Match[];
  initialFetchedAt: string;
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt);
  const [tab, setTab] = useState<SportTab>("all");
  const { selected, toggle, selectAll, selectNone } = useLeagueFilter();
  const { showBroadcast, showOdds, toggleBroadcast, toggleOdds } = useDisplayPrefs();

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/matches", { cache: "no-store" });
        if (!res.ok) return;
        const data: { matches: Match[]; fetchedAt: string } = await res.json();
        setMatches(data.matches);
        setFetchedAt(data.fetchedAt);
      } catch {
        // Skip this refresh; the next interval tries again.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Deliberately unfiltered by league/sport — the ticker is a pulse of
  // everything live (or, failing that, everything finished today) right
  // now, independent of what the guest has chosen to follow below it.
  const liveMatches = useMemo(() => matches.filter((m) => m.state === "in"), [matches]);
  const finishedTodayMatches = useMemo(
    () => matches.filter((m) => m.state === "post"),
    [matches],
  );

  const filteredMatches = useMemo(
    () =>
      matches.filter(
        (m) =>
          m.state !== "post" && (tab === "all" || m.sport === tab) && selected.has(m.leagueId),
      ),
    [matches, tab, selected],
  );

  const [heroMatch, ...restMatches] = filteredMatches;
  const groups = useMemo(() => groupByDay(restMatches), [restMatches]);

  return (
    <>
      <LiveTicker liveMatches={liveMatches} finishedTodayMatches={finishedTodayMatches} />

      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6">
        <Header fetchedAt={fetchedAt} />

        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <SportTabs active={tab} onChange={setTab} />
          <FilterSheet
            selected={selected}
            totalCount={LEAGUES.length}
            onToggle={toggle}
            onSelectAll={() => selectAll(DEFAULT_SELECTED_LEAGUE_IDS)}
            onSelectNone={selectNone}
            showBroadcast={showBroadcast}
            showOdds={showOdds}
            onToggleBroadcast={toggleBroadcast}
            onToggleOdds={toggleOdds}
          />
        </div>

        <div className="flex gap-10 pb-16">
          <aside className="hidden w-56 shrink-0 lg:block">
            <DisplayToggles
              showBroadcast={showBroadcast}
              showOdds={showOdds}
              onToggleBroadcast={toggleBroadcast}
              onToggleOdds={toggleOdds}
            />
            <LeagueFilter
              selected={selected}
              onToggle={toggle}
              onSelectAll={() => selectAll(DEFAULT_SELECTED_LEAGUE_IDS)}
              onSelectNone={selectNone}
            />
          </aside>

          <main className="min-w-0 flex-1">
            {selected.size === 0 ? (
              <EmptyState
                message="Nothing to show. Turn on a league to see what's coming up."
                actionLabel="Show all leagues"
                onAction={() => selectAll(DEFAULT_SELECTED_LEAGUE_IDS)}
              />
            ) : filteredMatches.length === 0 ? (
              <EmptyState message="No matches in the next two weeks for these leagues." />
            ) : (
              <>
                {heroMatch && (
                  <div className="max-w-2xl pb-6">
                    <h2 className="mb-1 text-sm font-medium text-ink-dim">Next up</h2>
                    <NextMatchPanel
                      match={heroMatch}
                      showBroadcast={showBroadcast}
                      showOdds={showOdds}
                    />
                  </div>
                )}

                {groups.map((group) => (
                  <DateSection key={group.key} label={group.label}>
                    <AnimatePresence initial={false}>
                      {group.matches.map((match) => (
                        <motion.div
                          key={match.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <MatchRow
                            match={match}
                            showBroadcast={showBroadcast}
                            showOdds={showOdds}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </DateSection>
                ))}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
