import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchMatchesAroundDay } from "@/lib/espn";

// The day is a path segment, not a query param, on purpose: Netlify's CDN
// keys route-handler responses by pathname only (see
// app/api/team-result/route.ts), so `?date=` plus a Cache-Control header
// would serve one day's matches for every day. With the date in the path,
// each day really is its own cache key and the header is safe.
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/matches/[date]">,
) {
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return NextResponse.json(
      { error: "Expected a date like 2026-09-26" },
      { status: 400 },
    );
  }

  const matches = await fetchMatchesAroundDay(date.replaceAll("-", ""));
  return NextResponse.json(
    { matches, fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
}
