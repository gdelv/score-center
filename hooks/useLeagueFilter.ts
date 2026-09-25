"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_SELECTED_LEAGUE_IDS } from "@/lib/leagues";

const STORAGE_KEY = "score-center:selected-leagues";
// Every league id this device has already been offered. A league added to
// LEAGUES later isn't in here, so it gets switched on for guests who saved a
// custom selection before it existed — otherwise it would stay silently off
// for exactly the guests engaged enough to have customized.
const SEEN_KEY = "score-center:seen-leagues";
// What LEAGUES held before SEEN_KEY existed — the implicit seen-list for a
// selection saved back then. Never add to this; new leagues go in LEAGUES only.
const LEAGUES_BEFORE_SEEN_TRACKING = [
  "nfl",
  "college-football",
  "eng.1",
  "esp.1",
  "ita.1",
  "ger.1",
  "fra.1",
  "uefa.champions",
  "usa.1",
  "mex.1",
  "conmebol.libertadores",
  "conmebol.sudamericana",
];

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const selected = new Set<string>(JSON.parse(raw));
      const seenRaw = window.localStorage.getItem(SEEN_KEY);
      const seen = new Set<string>(
        seenRaw ? JSON.parse(seenRaw) : LEAGUES_BEFORE_SEEN_TRACKING,
      );
      const added = DEFAULT_SELECTED_LEAGUE_IDS.filter((id) => !seen.has(id));
      if (added.length > 0) {
        added.forEach((id) => selected.add(id));
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(Array.from(selected)),
        );
        window.localStorage.setItem(
          SEEN_KEY,
          JSON.stringify(DEFAULT_SELECTED_LEAGUE_IDS),
        );
      }
      return selected;
    }
  } catch {
    // Corrupt/blocked storage falls back to "everything selected".
  }
  return new Set(DEFAULT_SELECTED_LEAGUE_IDS);
}

function getSnapshot(): Set<string> {
  if (cache === null) cache = readFromStorage();
  return cache;
}

// Must be a stable reference — useSyncExternalStore re-invokes this on every
// render and warns of a possible infinite loop if it sees a new object each time.
const SERVER_SNAPSHOT = new Set(DEFAULT_SELECTED_LEAGUE_IDS);

function getServerSnapshot(): Set<string> {
  return SERVER_SNAPSHOT;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function commit(next: Set<string>) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
    window.localStorage.setItem(
      SEEN_KEY,
      JSON.stringify(DEFAULT_SELECTED_LEAGUE_IDS),
    );
  } catch {
    // Best-effort persistence only.
  }
  listeners.forEach((l) => l());
}

/**
 * Guest-only preference, so it lives in localStorage rather than an account.
 * Backed by useSyncExternalStore: the server/initial snapshot is "everything
 * selected", and it syncs to the real saved choice right after hydration.
 */
export function useLeagueFilter() {
  const selected = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggle = useCallback((id: string) => {
    const current = getSnapshot();
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commit(next);
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    commit(new Set(ids));
  }, []);

  const selectNone = useCallback(() => {
    commit(new Set());
  }, []);

  return { selected, toggle, selectAll, selectNone };
}
