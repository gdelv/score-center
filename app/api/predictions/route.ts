import { NextResponse } from "next/server";
import predictionsData from "@/data/predictions.json";
import { gradeWeeks, type PredictionsData } from "@/lib/predictions";

export async function GET() {
  const weeks = await gradeWeeks(predictionsData as PredictionsData);
  return NextResponse.json(
    { weeks, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=300" } },
  );
}
