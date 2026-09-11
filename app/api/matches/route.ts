import { NextResponse } from "next/server";
import { fetchAllUpcomingMatches } from "@/lib/espn";

export async function GET() {
  const matches = await fetchAllUpcomingMatches();
  return NextResponse.json(
    { matches, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=300" } },
  );
}
