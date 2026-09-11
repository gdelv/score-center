<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from
your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing
any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Score Center — Developer Guide

## What this is
A guest-only board of every upcoming soccer and NFL match. No accounts, no login — visitors
pick which leagues they want to see and the choice is remembered on that device. Not tied to a
specific paying client; it's a standalone product living alongside the other projects in
`businessProjects/`.

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

**Caching:** each ESPN fetch carries `next: { revalidate: 120 }`. `app/page.tsx` calls it
server-side for the first paint; `components/ScoreCenter.tsx` polls `GET /api/matches` every
90 seconds client-side to keep the board current without a page reload.

**Adding a league:** add an entry to `LEAGUES` in `lib/leagues.ts` with its ESPN path segment
(soccer slugs look like `eng.1`, `esp.1`, `uefa.champions`; find new ones by hitting
`site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard` and checking for a 200), a
`shortName` for the compact list label, and an `accent` hex used only for that league's filter
checkbox tint. No other code changes needed — the filter list, tabs, and match feed all derive
from this array.

**If ESPN changes or removes an endpoint:** `lib/espn.ts` is the only file that talks to the
network; everything downstream consumes the normalized `Match` type, so a replacement data
source only needs a new implementation of `fetchAllUpcomingMatches()`.

## Component map
| Component | Purpose |
|-----------|---------|
| `components/ScoreCenter.tsx` | Client orchestrator — polling, sport-tab state, league-filter state, empty states |
| `components/Header.tsx` | Wordmark + live "updated N ago" indicator |
| `components/SportTabs.tsx` | All / Soccer / NFL segmented control |
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
- **Layout:** a left-aligned, hairline-divided ticker list — not a rounded-card grid — grouped
  by day, because that's what an actual scoreboard looks like. One deliberate bold moment (the
  amber-bezel "Next up" panel); everything else stays quiet.

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
