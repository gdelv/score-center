"use client";

import { useSyncExternalStore } from "react";

// No real external store to subscribe to — the "event" this fires on is
// simply "React has committed the client render", which useSyncExternalStore
// already detects natively when getSnapshot's return value differs from
// getServerSnapshot's, scheduling the corrective re-render itself. That's
// what makes this the idiomatic way to do this rather than a manual
// setState-in-effect: no explicit subscription is needed for a value that
// only ever needs to flip once, on mount.
function subscribe() {
  return () => {};
}

function getSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * True only once the client has hydrated. Gates any locale/timezone-
 * dependent text (kickoff times, relative "updated N ago" labels) so the
 * server/ISR-prerendered HTML — necessarily rendered using the *build
 * server's* timezone and a build-time "now", not the guest's — never gets
 * served with a value that could be factually wrong. Better to show nothing
 * for an instant than a confidently wrong clock time.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
