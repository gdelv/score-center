// Server only: where TD parlay picks live. The site's one piece of stored,
// user-written data — everything else is read live from ESPN.
import { getStore } from "@netlify/blobs";
import type { Picker, StoredPick } from "./parlay";

export function pickKey(season: number, weekKey: string, picker: Picker): string {
  return `${season}/${weekKey}/${picker}`;
}

interface PickStore {
  get(key: string): Promise<StoredPick | null>;
  set(key: string, pick: StoredPick): Promise<void>;
  list(prefix: string): Promise<StoredPick[]>;
}

// One blob per person per week, so two people saving at the same moment
// never overwrite each other. Strong consistency so a pick shows up on the
// very next read, not after edge propagation.
function blobsStore(): PickStore {
  const store = getStore({ name: "td-parlay-picks", consistency: "strong" });
  return {
    get: async (key) => (await store.get(key, { type: "json" })) ?? null,
    set: async (key, pick) => {
      await store.setJSON(key, pick);
    },
    list: async (prefix) => {
      const { blobs } = await store.list({ prefix });
      const picks = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
      return picks.filter(Boolean) as StoredPick[];
    },
  };
}

// Local development only (`PICKS_STORE=memory`): Netlify Blobs needs the
// Netlify runtime, which `next dev`/`next start` don't provide. Picks last as
// long as the server process. In memory rather than a file on purpose — a
// dynamic `fs` path makes Next trace the entire project into the server
// bundle. Opt-in rather than an automatic fallback, so a misconfigured
// deploy fails loudly instead of quietly keeping picks in a throwaway process.
const memory = new Map<string, StoredPick>();

function memoryStore(): PickStore {
  return {
    get: async (key) => memory.get(key) ?? null,
    set: async (key, pick) => {
      memory.set(key, pick);
    },
    list: async (prefix) =>
      [...memory.entries()].filter(([key]) => key.startsWith(prefix)).map(([, pick]) => pick),
  };
}

export function pickStore(): PickStore {
  return process.env.PICKS_STORE === "memory" ? memoryStore() : blobsStore();
}
