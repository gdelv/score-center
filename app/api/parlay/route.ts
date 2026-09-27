import { NextResponse, type NextRequest } from "next/server";
import { fetchSeasonTouchdowns } from "@/lib/touchdowns";
import { isPicker, openWeek, type StoredPick } from "@/lib/parlay";
import { pickKey, pickStore } from "@/lib/parlay-store";

// Never CDN-cached: a pick has to show up for everyone right after it's made.
const NO_STORE = { "Cache-Control": "no-store" };

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/** The season's TD data plus every pick, so the page can grade live in one poll. */
export async function GET() {
  const season = await fetchSeasonTouchdowns();
  const picks = season.season ? await pickStore().list(`${season.season}/`) : [];
  return NextResponse.json(
    { season, picks, fetchedAt: new Date().toISOString() },
    { headers: NO_STORE },
  );
}

/**
 * Save (or replace) one person's pick for the open week. Everything is
 * checked here, not trusted from the page: the name must be on the list, the
 * player must be a projected QB/RB/WR/TE on a team whose game hasn't kicked
 * off, and an existing pick can only be replaced before its own game starts.
 */
export async function POST(request: NextRequest) {
  let body: { picker?: unknown; playerId?: unknown; teamId?: unknown };
  try {
    body = await request.json();
  } catch {
    return error("Expected a JSON body.", 400);
  }
  const { picker, playerId, teamId } = body;
  if (!isPicker(picker)) return error("Pick your name from the list.", 400);
  if (typeof playerId !== "string" || typeof teamId !== "string") {
    return error("Pick a player.", 400);
  }

  const season = await fetchSeasonTouchdowns();
  const week = openWeek(season);
  if (!season.season || !week) return error("No week is open for picks right now.", 409);

  const now = Date.now();
  const notStarted = (game: { state: string; date: string } | undefined) =>
    !!game && game.state === "pre" && now < Date.parse(game.date);

  const game = week.teams[teamId];
  if (!notStarted(game)) return error("That game has already kicked off.", 409);
  const player = game.projected.find((p) => p.id === playerId);
  if (!player) return error("That player isn't available to pick.", 400);

  const store = pickStore();
  const key = pickKey(season.season, week.key, picker);
  const existing = await store.get(key);
  if (existing && !notStarted(week.teams[existing.teamId])) {
    return error(`${picker}'s pick (${existing.player}) is locked — that game has started.`, 409);
  }

  const pick: StoredPick = {
    picker,
    weekKey: week.key,
    playerId: player.id,
    player: player.player,
    position: player.position,
    teamId,
    pickedAt: new Date().toISOString(),
  };
  await store.set(key, pick);
  return NextResponse.json({ pick }, { headers: NO_STORE });
}
