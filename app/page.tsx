import { fetchAllUpcomingMatches } from "@/lib/espn";
import { ScoreCenter } from "@/components/ScoreCenter";

export default async function Home() {
  const matches = await fetchAllUpcomingMatches();

  return (
    <ScoreCenter initialMatches={matches} initialFetchedAt={new Date().toISOString()} />
  );
}
