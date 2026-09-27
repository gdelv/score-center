import { fetchSeasonLines } from "@/lib/lines";
import { LinesBoard } from "@/components/LinesBoard";

export const metadata = {
  title: "NFL Lines — Score Center",
  description:
    "Every finished NFL game this season with its opening and closing betting line — spread, total, and moneyline — and how it actually landed.",
};

export default async function LinesPage() {
  const lines = await fetchSeasonLines();

  return <LinesBoard initialLines={lines} initialFetchedAt={new Date().toISOString()} />;
}
