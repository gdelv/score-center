import { fetchSeasonTouchdowns } from "@/lib/touchdowns";
import { ParlayBoard } from "@/components/ParlayBoard";

export const metadata = {
  title: "TD Parlay — Score Center",
  description:
    "The group's weekly anytime-touchdown parlay — everyone picks one scorer, graded live against real NFL results.",
};

// Picks aren't prerendered — they're user-written and change any moment, so
// ParlayBoard loads them from /api/parlay after mount. The season's TD data
// is the same cached data /lines/touchdowns renders.
export default async function ParlayPage() {
  const season = await fetchSeasonTouchdowns();

  return <ParlayBoard initialSeason={season} initialFetchedAt={new Date().toISOString()} />;
}
