<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from
your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing
any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Score Center — Developer Guide

## What this is
A guest-only board of every upcoming soccer, NFL, and ranked college football match. No
accounts, no login — visitors pick which leagues they want to see and the choice is remembered
on that device. Not tied to a specific paying client; it's a standalone product living alongside
the other projects in `businessProjects/`.

## Stack
- **Framework:** Next.js 16, App Router, TypeScript strict
- **Styles:** Tailwind CSS v4 (CSS-first config in `app/globals.css` under `@theme inline` —
  there is no `tailwind.config.js`)
- **Animations:** Framer Motion (client components only)
- **Fonts:** `next/font/google` — Big Shoulders (display) + IBM Plex Sans (body)
- **Data:** ESPN's public scoreboard JSON endpoints (see below) — no API key, no backend, no
  database
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
(soccer slugs look like `eng.1`, `esp.1`, `uefa.champions`; football is `football/nfl` or
`football/college-football`; find new ones by hitting
`site.api.espn.com/apis/site/v2/sports/{sport}/{slug}/scoreboard` and checking for a 200), a
`shortName` for the compact list label, and an `accent` hex used only for that league's filter
checkbox tint. No other code changes needed — the filter list, tabs, and match feed all derive
from this array. Two optional per-league escape hatches exist for leagues with unusual volume
(see `college-football`'s entry for both in use):
- `maxWindowDays` — caps the lookahead window below the global 14 days, for leagues whose raw
  payload would otherwise blow past the 2MB-per-fetch-entry ceiling mentioned above.
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

## Component map
| Component | Purpose |
|-----------|---------|
| `components/ScoreCenter.tsx` | Client orchestrator — polling, sport-tab state, league-filter state, empty states |
| `components/LiveTicker.tsx` | Full-bleed scrolling strip of every currently-live match — unfiltered by league/sport, see rationale below |
| `components/Header.tsx` | Wordmark + live "updated N ago" indicator |
| `components/SportTabs.tsx` | All / Soccer / NFL / College segmented control |
| `components/LeagueFilter.tsx` | Checkbox list grouped by sport, used in both the sidebar and the mobile sheet |
| `components/FilterSheet.tsx` | Mobile bottom-sheet wrapper around `LeagueFilter` |
| `components/NextMatchPanel.tsx` | The single "Next up" hero — soonest match after filtering |
| `components/DateSection.tsx` / `MatchRow.tsx` | Day-grouped ticker list |
| `components/LiveBadge.tsx` | Pulsing live indicator, reused in the hero and in rows |
| `components/TeamLogo.tsx` | Team crest with an initials fallback when ESPN has no logo |
| `hooks/useLeagueFilter.ts` | `useSyncExternalStore`-backed league selection, persisted to `localStorage` |
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
- **`LiveTicker` is intentionally unfiltered.** It shows every live match across every league,
  regardless of the guest's sport tab or league selection below it — a global pulse of "what's
  happening right now" is a different job than the personalized list, the same way a stock
  ticker shows the whole market rather than just your portfolio. It bleeds full-width outside
  the page's max-width container (real broadcast/stock tickers always do), pauses on hover so a
  guest can actually read one line, and renders nothing at all when there's no live match rather
  than showing an empty strip.
- **Aesthetic-usability effect + speed as trust** — the first paint is server-rendered with no
  loading spinner; the one entrance animation is skipped on initial load (`AnimatePresence
  initial={false}` in `ScoreCenter.tsx`) so nothing delays what the guest already has. Motion is
  reserved for responses to an action — toggling a league reflows the list, opening the mobile
  sheet slides it in — never scattered decoration.

## Known caveats
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

## Deploy
- `netlify.toml` at project root handles build + plugin config (standard `@netlify/plugin-nextjs`
  setup, matching every other project in this repo)
- No environment variables or secrets required — the ESPN endpoints are public
