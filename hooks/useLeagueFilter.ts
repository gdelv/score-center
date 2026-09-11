"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_SELECTED_LEAGUE_IDS } from "@/lib/leagues";

const STORAGE_KEY = "score-center:selected-leagues";

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
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
  const selected = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
