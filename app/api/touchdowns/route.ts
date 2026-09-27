import { NextResponse } from "next/server";
import { fetchSeasonTouchdowns } from "@/lib/touchdowns";

// No query params, so a Cache-Control header is safe here — see
// app/api/matches/route.ts.
export async function GET() {
  const season = await fetchSeasonTouchdowns();
  return NextResponse.json(
    { season, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=300" } },
  );
}
