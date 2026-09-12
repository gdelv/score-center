import { NextResponse } from "next/server";

interface EspnScheduleTeamRef {
  id: string;
  displayName: string;
  shortDisplayName?: string;
  abbreviation?: string;
}

interface EspnScheduleCompetitor {
  team: EspnScheduleTeamRef;
  winner?: boolean;
  score?: { displayValue?: string };
}

interface EspnScheduleCompetition {
  status?: { type?: { state?: string } };
  competitors?: EspnScheduleCompetitor[];
}

interface EspnScheduleEvent {
  date: string;
  competitions?: EspnScheduleCompetition[];
}

interface EspnScheduleResponse {
  events?: EspnScheduleEvent[];
}

export interface TeamLastResult {
  result: "W" | "L" | "D";
  teamScore: string;
  opponentScore: string;
  opponent: string;
}

/**
 * A team's own most recent completed game (any opponent) — not head-to-head
 * history between two specific teams, which ESPN has no direct endpoint for
 * and would otherwise require cross-referencing both teams' full schedules
 * for an unreliable, often-empty result.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espnPath = searchParams.get("espnPath");
  const teamId = searchParams.get("teamId");

  if (!espnPath || !teamId) {
    return NextResponse.json({ result: null }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams/${teamId}/schedule`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return NextResponse.json({ result: null });

    const data: EspnScheduleResponse = await res.json();
    const events = data.events ?? [];

    const completed = events
      .filter((e) => e.competitions?.[0]?.status?.type?.state === "post")
      .sort((a, b) => b.date.localeCompare(a.date));

    const last = completed[0];
    const competitors = last?.competitions?.[0]?.competitors ?? [];
    const self = competitors.find((c) => c.team.id === teamId);
    const opponent = competitors.find((c) => c.team.id !== teamId);

    if (!self || !opponent || !self.score || !opponent.score) {
      return NextResponse.json({ result: null });
    }

    const result: TeamLastResult = {
      result: self.winner ? "W" : opponent.winner ? "L" : "D",
      teamScore: self.score.displayValue ?? "?",
      opponentScore: opponent.score.displayValue ?? "?",
      opponent: opponent.team.shortDisplayName ?? opponent.team.displayName,
    };

    return NextResponse.json(
      { result },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ result: null });
  }
}
