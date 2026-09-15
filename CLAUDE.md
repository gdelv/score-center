<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from
your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing
any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Score Center — Developer Guide

## What this is
A guest-only board of every upcoming soccer, NFL, and ranked college football match, plus a
`/predictions` page tracking college football spread parlays from Claude, ChatGPT, and Gemini
against real results. No accounts, no login — visitors pick which leagues they want to see and
the choice is remembered on that device. Not tied to a specific paying client; it's a standalone
product living alongside the other projects in `businessProjects/`.

## Stack
- **Framework:** Next.js 16, App Router, TypeScript strict
- **Styles:** Tailwind CSS v4 (CSS-first config in `app/globals.css` under `@theme inline` —
  there is no `tailwind.config.js`)
- **Animations:** Framer Motion (client components only)
- **Fonts:** `next/font/google` — Big Shoulders (display) + IBM Plex Sans (body)
- **Data:** ESPN's public scoreboard JSON endpoints (see below) — no API key, no backend, no
  database. The one exception is `data/predictions.json`, a small committed data file (not a
  database — no writes at runtime, no user ever touches it) that holds AI parlay picks; see
  "Predictions data" below.
- **Deployment:** Netlify + `@netlify/plugin-nextjs`

## Commands
```bash
npm run dev      # local dev
npm run build    # production build — verify before deploying
npm run start    # run the production build locally
npm run lint     # eslint (includes react-hooks rules)
```

## Data source
`lib/espn.ts` calls ESPN's undocumented public scoreboard API directly from the server —
no key, no signup:
```
https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMMDD-YYYYMMDD
```
`fetchAllUpcomingMatches()` fans this out in parallel across every league in `lib/leagues.ts`
for a 14-day window, drops finished games (`status.type.state === "post"`), normalizes the
shape into `Match`, and sorts by kickoff time. A single league's request failing (rate limit,
timeout, schema change) returns `[]` for that league rather than breaking the page — this is an
unofficial API with no uptime guarantee, so treat every call site as best-effort.

**Everything is live — there is no data to add by hand, ever.** No match, score, date, or team
is hardcoded anywhere in this codebase. Every page load and every 90-second poll re-derives the
board from ESPN in real time. The season rolling over, a game getting rescheduled, a score
changing mid-match — all of it just shows up on the next fetch. The only thing that would ever
need a manual code change is adding a *new league* (see below) — never refreshing data for an
existing one.

**Caching:** the raw upstream fetches in `fetchLeagueMatches`/`fetchRankedTeamIds` are
deliberately *uncached* (no `next.revalidate`) — ESPN's raw payload for a busy league (college
football especially) can run several MB, over Next.js's 2MB fetch-cache entry limit, so trying
to cache it there just fails silently on every request. Instead, `fetchAllUpcomingMatches` — the
small, already-normalized result — is wrapped in `unstable_cache` with a 120s revalidate. That's
the one place caching happens. `app/page.tsx` calls it server-side for the first paint;
`components/ScoreCenter.tsx` polls `GET /api/matches` every 90 seconds client-side to keep the
board current without a page reload.

**Adding a league:** add an entry to `LEAGUES` in `lib/leagues.ts` with its ESPN path segment
(soccer slugs look like `eng.1`, `esp.1`, `uefa.champions`, `conmebol.libertadores`; football is
`football/nfl` or `football/college-football`; find new ones by hitting
`site.api.espn.com/apis/site/v2/sports/{sport}/{slug}/scoreboard` and checking for a 200), a
`shortName` for the compact list label, and an `accent` hex used only for that league's filter
checkbox tint. No other code changes needed — the filter list, tabs, and match feed all derive
from this array. **Before shipping a new league, actually test its date-range behavior** — verify
a plain 200 isn't enough, see below. Two optional per-league escape hatches exist for leagues
with unusual volume or upstream quirks:
- `maxWindowDays` — caps the lookahead window below the global 14 days. Two different reasons to
  use this so far, both real, both found by testing rather than assumption:
  - **Payload size** (`college-football`) — its raw payload for the full window blows past the
    2MB-per-fetch-entry ceiling mentioned above.
  - **Upstream range limit** (`conmebol.sudamericana`) — ESPN's own scoreboard endpoint for this
    specific competition returns a 400 for a `dates=` span past roughly 9-10 days, confirmed
    reproducible on retry (not rate-limit flakiness) — likely because fixtures for the
    competition's current round aren't resolved that far out server-side yet. Since
    `fetchLeagueMatches` requests the whole window as one call, that failure was all-or-nothing:
    it silently wiped out even the real near-term matches a narrower query returns fine.
    `conmebol.libertadores` has no such limit at the full 14-day window even though it's the
    same confederation's other continental cup — this is genuinely per-competition, not
    something you can assume from one CONMEBOL competition to another. If a new league's board
    entries look sparse or empty despite the league clearly having real fixtures, binary-search
    the `dates=` span by hand against the raw ESPN URL before assuming it's a code bug.
- `filterToRankedTeams` — restricts the league to games with at least one AP Top 25 team, via
  `fetchRankedTeams()`, and labels each ranked team with its current number (`MatchTeam.rank`,
  rendered as `#N` in `MatchRow`/`NextMatchPanel`). College football runs ~80 games on a single
  Saturday — dumping all of them in unfiltered would swamp every other league in the day-grouped
  list. Fails closed (shows nothing rather than the full unfiltered slate) if the rankings fetch
  itself fails. Rank lookups are scoped per-league (only applied when this flag is set) rather
  than globally, since ESPN's numeric team IDs aren't unique across sports — an NFL or soccer
  team's ID could coincidentally match a ranked college team's ID.

**If ESPN changes or removes an endpoint:** `lib/espn.ts` is the only file that talks to the
network; everything downstream consumes the normalized `Match` type, so a replacement data
source only needs a new implementation of `fetchAllUpcomingMatchesUncached()`.

## Predictions data (`/predictions`)
Three "contestants" — Claude, ChatGPT, and Gemini — each build against-the-spread college
football parlays (3/6/9/12 legs) weekly. The user asks each AI separately (outside this app) and
tells Claude Code the picks; there's no on-page submission form and no database — see the "How to
add a new week's picks" question this was built to answer, below.

**Data model** (`lib/predictions.ts`, data lives in `data/predictions.json`): a `PredictionsData`
is `{ weeks: Week[] }`; each `Week` has an `id`, a display `label`, and `parlays: Parlay[]`; each
`Parlay` is one contestant's `legCount`-leg ticket, `legs: PredictionLeg[]`. Each `PredictionLeg`
is one game: `matchId` (must equal a real `Match.id` this app's own data layer would produce —
`college-football-{espnEventId}`, get it from `/api/matches` or ESPN's scoreboard for that date),
both teams' names, which side was `pick`ed, and the spread `line` *relative to the picked side*
(e.g. `-3.5` if the pick is favored by 3.5, `+7.5` if the pick is an underdog getting 7.5).

**How to add a new week's picks:** create a new entry in the `weeks` array in
`data/predictions.json` with a fresh `id`/`label`, one `Parlay` per contestant per leg-count they
did that week, find each game's real `matchId` via `/api/matches` (or ESPN's college-football
scoreboard for that date) so grading can find it, then commit and let it deploy. There is
deliberately no other step — no separate "grade this week" action, no scores to enter by hand.
Each leg also takes an optional `reason` string — a sentence or two of why that pick was made,
shown on hover (desktop) / tap (mobile) via `LegReasonHint.tsx`, same interaction pattern as
`TeamMatchupHint.tsx` (mutually-exclusive hover/click handlers, not layered — see that
component's doc comment for why) but simpler: the text is already in hand from the data file, no
fetch or cache needed. `ParlayCard.tsx` adds a dotted underline to a pick's team name only when
it has a `reason`, so there's a visible affordance for which picks are hoverable. Claude's own
picks always get a `reason` explaining the actual basis for the pick (ranking, spread-as-market-
signal, or explicit judgment call) — if the user relays ChatGPT's/Gemini's picks without their
own stated reasoning, it's fine to leave `reason` off those legs rather than inventing one.

**Grading is fully dynamic, not recorded once and left stale** (`gradeWeeks` in
`lib/predictions.ts`, same `unstable_cache` + 120s-revalidate pattern as
`fetchAllUpcomingMatches`, polled the same way by `PredictionsBoard.tsx`). Every page load
re-fetches the actual college-football scoreboard for every unique date any leg needs (via
`fetchLeagueMatches`, exported from `lib/espn.ts` for exactly this reuse — it takes a specific
date range rather than the rolling "yesterday onward" window `fetchAllUpcomingMatches` uses) and
computes each leg's status fresh: `pending` (game hasn't started), `live` (in progress — a
`covering` boolean is computed the same way as final grading, so a live leg's current lean shows
without pretending it's final), `hit`/`miss`/`push` once the game ends. A parlay's own status
(`pending`/`alive`/`won`/`busted`) follows real parlay rules: any missed leg busts the whole
thing regardless of the rest; a push neither wins nor loses its leg. This means a "busted"
parlay never quietly reverts, and a from-last-week parlay whose final leg just finished updates
on its own — nothing about this needed last week's grade to be written down anywhere.

`ParlayCard.tsx`'s per-leg status column shows whichever of time/score is actually meaningful
right now, not a static dash: kickoff time (via `matchTime`, same helper and same local-timezone
convention as the main scores page) while `pending`, the live score while `live`, the final score
once decided — matching how the main board itself represents a match at each stage.

**Why against-the-spread, not moneyline or a mix:** it's the standard shape for a real parlay and
matches the betting-odds data already on the main board (same DraftKings-via-ESPN source), and a
single bet type keeps grading (and comparing the three AIs) uniform instead of needing a
type-specific evaluator per leg.

## Component map
| Component | Purpose |
|-----------|---------|
| `components/ScoreCenter.tsx` | Client orchestrator — polling, sport-tab state, league-filter state, empty states |
| `components/LiveTicker.tsx` | Full-bleed scrolling strip of every currently-live match — unfiltered by league/sport, see rationale below |
| `components/Header.tsx` | Wordmark + live "updated N ago" indicator |
| `components/SportTabs.tsx` | All / Soccer / NFL / College segmented control |
| `components/LeagueFilter.tsx` | Checkbox list grouped by sport, used in both the sidebar and the mobile sheet |
| `components/FilterSheet.tsx` | Mobile bottom-sheet wrapper around `LeagueFilter` + `DisplayToggles` |
| `components/DisplayToggles.tsx` | Opt-in checkboxes for per-match broadcast/odds info, in both the sidebar and the mobile sheet |
| `components/NextMatchPanel.tsx` | The single "Next up" hero — soonest match after filtering |
| `components/DateSection.tsx` / `MatchRow.tsx` | Day-grouped match grid |
| `components/TeamMatchupHint.tsx` | Hover (desktop) / tap (mobile) a team on a non-live match to see that team's own last result |
| `components/LiveBadge.tsx` | Pulsing live indicator, reused in the hero and in rows |
| `components/TeamLogo.tsx` | Team crest with an initials fallback when ESPN has no logo |
| `components/PredictionsBoard.tsx` | Client orchestrator for `/predictions` — same polling pattern as `ScoreCenter.tsx` |
| `components/PredictionsLeaderboard.tsx` / `PredictionsWeek.tsx` / `ParlayCard.tsx` | Season record cards, per-week grouping, one parlay's legs |
| `components/LegReasonHint.tsx` | Hover (desktop) / tap (mobile) a pick to read why it was made |
| `hooks/useLeagueFilter.ts` | `useSyncExternalStore`-backed league selection, persisted to `localStorage` |
| `hooks/useDisplayPrefs.ts` | Same pattern, for the broadcast/odds display toggles |
| `lib/espn.ts`, `lib/leagues.ts`, `lib/format.ts` | Data fetching, league config, date/time formatting |

## Design rationale
Grounded in the actual subject — a stadium scoreboard/ticker — rather than a generic sports-app
template. See `app/globals.css` for the token values.

- **Palette:** deep night-navy base (`#10141c`) with a single bold accent, amber (`#f5a623`,
  evoking floodlights), used sparingly (active tab, hero bezel, focus ring). Turf green
  (`#35c25e`) is reserved *only* for the live state — a functional signal, not decoration.
  Light mode (`prefers-color-scheme: light`) swaps to an overcast off-white with deepened
  accents for contrast.
- **Type:** Big Shoulders (modeled on collegiate athletics signage) for the wordmark, the hero
  match, and date headers; IBM Plex Sans for body/list text. Scores and times use
  `font-variant-numeric: tabular-nums` (the `.tabular` class) so digits stay aligned.
- **Layout:** left-aligned match cards in a responsive grid (1 column on mobile, 2 from `lg:`,
  3 from `xl:` — see `DateSection.tsx`), grouped under a bold, full-width-ruled day heading so
  each day reads as its own chapter rather than a divider line in a continuous list. The outer
  page runs up to 1440px so a wide desktop actually uses its width instead of one narrow column
  with empty margins either side; the "Next up" hero stays capped at a narrower width on its own
  so it reads as a focused moment even when the grid below is wide. One deliberate bold moment
  (the amber-bezel hero panel); everything else stays quiet.

Specific UX calls, from Irene Pereyra's *Universal Principles of UX*:
- **Hick's Law** — sport tabs default to "All"; the league filter defaults to everything
  selected, so a first-time guest sees the full board immediately rather than an empty state
  requiring setup.
- **Recognition over recall** — league and team identity is carried by logos wherever ESPN
  provides one, not by text alone.
- **Progressive disclosure** — the league filter lives in a persistent sidebar on desktop but
  collapses into a bottom sheet on mobile rather than competing with the match feed for space.
- **Fitts's Law** — every tap target (checkboxes, tabs, the filter trigger, "Done") is at least
  44px tall.
- **Chunking** — matches are grouped under day headers ("Today", "Tomorrow", then weekday
  names) instead of one flat list.
- **Von Restorff effect (isolation)** — live matches get the one non-amber color (turf green)
  and a pulsing dot so they stand out from merely-scheduled ones.
- **`LiveTicker` is intentionally unfiltered, and has a three-tier fallback.** It shows every
  live match across every league, regardless of the guest's sport tab or league selection below
  it — a global pulse of "what's happening right now" is a different job than the personalized
  list, the same way a stock ticker shows the whole market rather than just your portfolio. It
  bleeds full-width outside the page's max-width container (real broadcast/stock tickers always
  do), and pauses on hover so a guest can actually read one line.

  Falls back in order: **live matches** (pulsing dot, elapsed time) → **recently finished games**,
  if nothing's live (no dot — that signal is reserved for genuinely live) → a static "No games
  right now" message, only if neither exists (e.g. before anything's kicked off). Same bar, same
  height in every state — no layout jump as it moves between them.

  Items are logos-only, no team name text (`components/LiveTicker.tsx`'s `GameScore`) — a ticker
  is for scanning fast, and the logo already carries recognition. `groupByLeague` reorders the
  list so same-league games sit adjacent, and `ScrollingBar` only emits a league label where the
  league actually changes from the previous cell, not before every game: `"NCAAF | 13 @ 59 F |
  3 @ 59 F | 38 @ 21 F | Liga MX | 1 @ 0 F | ..."` — three NCAAF games, one label. This grouping
  happens *before* the repeat-then-double step below, so it also holds across every repetition of
  the loop, not just the first pass.

  This is why `fetchLeagueMatches` in `lib/espn.ts` no longer filters out `state === "post"`
  events — the upcoming-matches board still excludes them itself (`ScoreCenter.tsx`'s
  `filteredMatches` filters `state !== "post"`), but the ticker's finished-game fallback needs
  them, including last night's, until something newer goes live.

  **The fetch window in `fetchAllUpcomingMatches` starts a day *before* today, not at today** —
  this is deliberately not the same "today" as `dayKey`'s UTC bucketing. UTC rolls over hours
  before local midnight for anyone west of it: a 7pm ET kickoff is already 11pm UTC that same UTC
  day, so by the time it's actually midnight in the US, UTC has long since advanced to the next
  date, and a window starting at "today" (UTC) would have already dropped last night's late
  finishers — hours before the guest's own day had even ended. Shifting the *whole* window back
  one day, rather than widening it, keeps every league's total span (and therefore payload size)
  identical to before — see the next paragraph for why that matters. A finished game returned is
  still always bounded to yesterday-or-today, never real history.

  The seamless-loop trick (scroll a doubled track exactly -50%) only works if that first half is
  already wider than the viewport — with just 1-2 matches it isn't, and the bar runs out of
  content partway across the screen instead of looping cleanly. `LiveTicker.tsx`'s shared
  `ScrollingBar` repeats whichever match list it's given up to a minimum item count *before*
  doubling it for the loop, so this holds regardless of how few (or many) matches there are.

- **Broadcast and odds are opt-in, off by default** (`DisplayToggles.tsx` /
  `hooks/useDisplayPrefs.ts`, same `useSyncExternalStore` + `localStorage` pattern as the league
  filter). Both come straight from ESPN's scoreboard payload — `competition.broadcasts[0].names`
  and `competition.odds[0]` (DraftKings' spread/moneyline line, when posted) — normalized onto
  `Match.broadcast` / `Match.odds` in `lib/espn.ts`. They default off per Hick's Law: most guests
  just want the score, and every card gets denser the moment both are on, so it's a choice the
  guest opts into rather than clutter everyone pays for by default. `formatOdds()` in
  `lib/format.ts` joins whichever of the spread and over/under is actually present — either can
  be posted without the other, and dropping the whole line for lacking one used to hide an O/U
  that was genuinely available.

  `competition.odds[0]`'s top-level `details`/`overUnder` fields are ESPN's **closing (pregame)**
  line — confirmed by comparing them against that same object's `pointSpread`/`total` sub-fields
  during a live match, where `open`/`close` stayed put while `current` had already moved with
  live betting action. We only ever read the top-level fields, so what's shown for a live match
  is deliberately the pregame line, not a live-updating one — and it's labeled "Pregame: " in
  that case so it doesn't read as if it were live.
- **`TeamMatchupHint` shows a team's own last result, not head-to-head history.** "The score of
  each team's previous matchup" is ambiguous between those two readings; head-to-head between two
  specific teams has no direct ESPN endpoint and would mean cross-referencing both teams' full
  schedules for a shared past opponent — unreliable, and often empty for teams that haven't met
  in over a year. Each team's own most recent completed game (`app/api/team-result/route.ts`,
  proxying `.../teams/{id}/schedule`) is direct, fast, and always has an answer once a team's
  played at least once. Fetched lazily per team on first hover/tap and cached client-side by
  `${espnPath}:${teamId}` — not prefetched for every team on the page, which could mean 100+
  upstream calls for one page load.

  Hover (desktop) and tap (mobile, no hover) can't both be wired to the same element with the
  naive handlers: a real tap fires a synthetic `mouseenter` immediately before its `click`
  (standard touch-to-mouse compatibility-event behavior in every mobile browser, not a testing
  artifact), so a `mouseenter`-opens / `click`-toggles pair opens and immediately re-closes on
  every single tap. `TeamMatchupHint` picks one handler set via `matchMedia("(hover: hover)")`
  (through `useSyncExternalStore`, so it also reacts if a mouse gets connected/disconnected) and
  never attaches both at once.

  **`app/api/team-result/route.ts` must never set its own `Cache-Control` header** — it did once,
  briefly, and every single team on the site showed identical results because of it (one team's
  response, whichever got cached first, served back for every other team's query). Netlify's CDN
  caches a route handler's response by *pathname only* — it does not automatically vary by
  arbitrary query strings like `espnPath`/`teamId` the way you'd expect a normal HTTP cache to.
  `GET /api/team-result?...&teamId=3307` and `...&teamId=124` are, to that cache, the same key.
  Per-team correctness instead comes entirely from the *upstream* ESPN `fetch` inside the route,
  via `next: { revalidate }` — that's origin-level caching keyed by the full URL including query
  params, which behaves the way you'd actually expect. `/api/matches/route.ts` is the one route
  that's safe to put a `Cache-Control` header on, specifically because it takes no query
  parameters at all — every request to it really is the same response, so pathname-only CDN
  caching is correct there, not a bug.
- **Aesthetic-usability effect + speed as trust** — the first paint is server-rendered with no
  loading spinner; the one entrance animation is skipped on initial load (`AnimatePresence
  initial={false}` in `ScoreCenter.tsx`) so nothing delays what the guest already has. Motion is
  reserved for responses to an action — toggling a league reflows the list, opening the mobile
  sheet slides it in — never scattered decoration.

## Known caveats
- **`lib/format.ts`'s `dayKey` must stay UTC-based — do not "fix" it back to local time.**
  It decides which day-bucket (and "Today"/"Tomorrow"/weekday label) a match falls into. Early
  on this used the runtime's local timezone, which is correct-looking in isolation but breaks
  hydration in production: the server (Netlify, effectively UTC) and each guest's browser (their
  own timezone) would bucket the same match differently, so React would see a structurally
  different tree — a different number of `DateSection`s with different matches in each — between
  the server-rendered HTML and the client's hydration pass, and throw a hydration error rather
  than a fixable text-mismatch warning. Keeping the *bucketing* decision on UTC (timezone-
  independent, so server and client always agree) while `matchTime`'s displayed clock time stays
  on the guest's local timezone (intentional — see `suppressHydrationWarning` on its render
  sites) is what makes both work: correct grouping *and* a kickoff time in the guest's own zone.
- ESPN's endpoint is public but unofficial and undocumented — no SLA, no versioning guarantee.
  If a league's scoreboard starts returning empty or errors, check the URL shape still matches
  by hand before assuming the code is at fault.
- Team crests are served from `a.espncdn.com` and rendered with `unoptimized` (see
  `components/TeamLogo.tsx`) since they're already small, pre-sized PNGs — no benefit from
  Next's image optimizer, and one less remote fetch on Netlify's image pipeline.
- No test suite yet. If one gets added, use Vitest to match the convention for projects in this
  repo that aren't `nazca-films` (which uses Jest).

## Verified
`npm run build`, `npx tsc --noEmit`, and `npm run lint` all pass clean. Manually driven with a
scratch Playwright script against both `npm run dev` and a production `npm run build && npm run
start`: confirmed zero console/hydration errors, league checkboxes filter the feed, sport tabs
switch the "Next up" hero and list, and the mobile bottom sheet opens/closes — at both a 1280px
desktop viewport and a 390px phone viewport.

The timezone hydration fix specifically was verified against a production build across five
`timezoneId` contexts spanning UTC-11 to UTC+14 (`Pacific/Midway` through `Pacific/Kiritimati`,
~25 hours apart) — zero console/hydration errors in any of them. If this regresses, that's the
fastest way to reproduce it locally: `npm run build && npm run start`, then drive it with
Playwright contexts at extreme, far-apart `timezoneId`s rather than just your own machine's zone
— a same-timezone dev server will never reproduce a server/client timezone mismatch.

## Deploy
- `netlify.toml` at project root handles build + plugin config (standard `@netlify/plugin-nextjs`
  setup, matching every other project in this repo)
- No environment variables or secrets required — the ESPN endpoints are public
