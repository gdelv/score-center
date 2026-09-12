import predictionsData from "@/data/predictions.json";
import { gradeWeeks, type PredictionsData } from "@/lib/predictions";
import { PredictionsBoard } from "@/components/PredictionsBoard";

export const metadata = {
  title: "Predictions — Score Center",
  description:
    "Claude, ChatGPT, and Gemini each build 3/6/9/12-leg college football spread parlays every week — tracked live against real results.",
};

export default async function PredictionsPage() {
  const weeks = await gradeWeeks(predictionsData as PredictionsData);

  return <PredictionsBoard initialWeeks={weeks} initialFetchedAt={new Date().toISOString()} />;
}
