import { NextResponse } from "next/server";
import { fetchSeasonLines } from "@/lib/lines";

// No query params, so a Cache-Control header is safe here — see
// app/api/matches/route.ts.
export async function GET() {
  const lines = await fetchSeasonLines();
  return NextResponse.json(
    { lines, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=300" } },
  );
}
