import { fetchSeasonTouchdowns } from "@/lib/touchdowns";
import { TouchdownBoard } from "@/components/TouchdownBoard";

export const metadata = {
  title: "NFL TD Scorers — Score Center",
  description:
    "Every NFL touchdown scorer this season, mapped by team and week — who scored, how, and against whom.",
};

export default async function TouchdownsPage() {
  const season = await fetchSeasonTouchdowns();

  return <TouchdownBoard initialSeason={season} initialFetchedAt={new Date().toISOString()} />;
}
