"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "score-center:display-prefs";

export interface DisplayPrefs {
  /** Where to watch (broadcast network). */
  showBroadcast: boolean;
  /** Betting odds (spread / over-under). */
  showOdds: boolean;
}

// Off by default — most guests just want the score; both are opt-in extras.
const DEFAULTS: DisplayPrefs = { showBroadcast: false, showOdds: false };

let cache: DisplayPrefs | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): DisplayPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Corrupt/blocked storage falls back to defaults.
  }
  return DEFAULTS;
}

function getSnapshot(): DisplayPrefs {
  if (cache === null) cache = readFromStorage();
  return cache;
}

// Must be a stable reference — see the matching note in useLeagueFilter.ts.
const SERVER_SNAPSHOT = DEFAULTS;

function getServerSnapshot(): DisplayPrefs {
  return SERVER_SNAPSHOT;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function commit(next: DisplayPrefs) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort persistence only.
  }
  listeners.forEach((l) => l());
}

export function useDisplayPrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleBroadcast = useCallback(() => {
    const current = getSnapshot();
    commit({ ...current, showBroadcast: !current.showBroadcast });
  }, []);

  const toggleOdds = useCallback(() => {
    const current = getSnapshot();
    commit({ ...current, showOdds: !current.showOdds });
  }, []);

  return { ...prefs, toggleBroadcast, toggleOdds };
}
