# Project Nexus

A browser-game launcher. Static site, no accounts, no database, no tracking.
Games are either self-hosted (when the licence permits), embedded from the
developer's own build (when they permit framing), or linked to.

## Commands

```bash
npm run dev            # dev server
npm run build          # production build → dist/  (validates the manifest)
npm run serve          # foreground static server for dist/ on :4321
npm run check          # astro check — must stay at 0 errors / 0 warnings / 0 hints
npm run verify         # check + verify:assets
npm run verify:assets  # every manifest entry has real art (both formats), a real bundle, a licence
npm run verify:embed   # re-probe embedded games for framing restrictions (network)
npm run test:e2e       # Playwright, laptop + mobile, capped to 2 workers locally — see Known constraints
npm run vendor -- <owner>/<repo>@<ref> <slug> [--subdir p] [--dry]
```

## Hard rules — non-negotiable

1. **Never** implement school-filter / GoGuardian evasion, tab cloaking, title or
   favicon spoofing, `about:blank` popunders, or `beforeunload` traps. If asked,
   decline and say why. The site this project was modelled on did all of these;
   we deliberately do not.
2. **Never** self-host a game (or its cover art) without a verified redistributable
   licence. The build enforces this (`src/content.config.ts`), so do not weaken
   the schema to get around it.
3. **Never** bypass `X-Frame-Options` or CSP `frame-ancestors` — no proxying, no
   header stripping. A game that blocks framing becomes `mode: external`.
4. **Never** autoplay audio.
5. **Never** commit credentials, or the reference-site password (session-only).
6. When vendoring a game, strip third-party analytics and record every change in
   `NEXUS-MODIFICATIONS.txt` beside it. GPL-3.0 §5(a) requires the change
   record; the privacy reason applies regardless of licence.

## Adding a game — the whole recipe

1. Establish rights and pick a delivery mode (full process:
   `docs/ADDING-A-GAME.md`). Never source from an "unblocked games" mirror.
2. Self-hosting only: `npm run vendor -- owner/repo@ref <slug>` → lands in
   `public/play/<slug>/`. Audit it for analytics and absolute paths.
3. Cover art — a capsule (3:4) and a hero (16:9), same rights bar as the game
   itself:
   - Self-hosted or original: `node --experimental-strip-types
     scripts/capture-covers.ts` (real gameplay screenshot — add the game to
     its `CAPTURES` list first).
   - Embedded, and the upstream repo's licence covers its own assets: `node
     --experimental-strip-types scripts/fetch-upstream-art.ts` (add a fetch
     block for it).
   - Otherwise: `scripts/make-original-covers.ts` — hand-authored, built from
     the game's real terminology, checked against the live game.
4. Write `src/content/games/<slug>.yaml`, including `cover:` provenance.
5. `npm run verify && npm run build && npm run test:e2e`.

Adding a game requires **no application code**. If it seems to, the schema is
probably the thing that needs extending.

## Architecture

Astro 7 (static) · TypeScript strict · Tailwind 4 · React islands · Netlify.

- `src/content/games/*.yaml` — **the manifest**, one file per game. The source of truth.
- `src/content.config.ts` — Zod schema. Enforces the licensing policy — for both
  the game and its cover art — at build time.
- `src/lib/gameMeta.ts` — client-safe game helpers and the `LibraryDoc` type.
  `src/lib/games.ts` — the same, plus `astro:content`-backed fetchers
  (`allGames`, `libraryDocs`), and it re-exports gameMeta's stuff for
  convenience. **Client islands must import `gameMeta.ts` directly, never
  `games.ts`** — `astro:content` is server-only, and Vite hard-fails the build
  if it reaches a client bundle even transitively. If `astro build` ever throws
  `ServerOnlyModule` again, this is almost certainly why.
- `src/lib/storage.ts` — the *only* thing that touches localStorage.
- `src/lib/stageHue.ts` / `playerState.ts` — the galaxy's two small pieces of
  cross-island state (hovered accent → nebula hue; is a game running).
- `src/components/react/` — islands. Everything else is static `.astro`.
- `public/play/<slug>/` — vendored game bundles, copied verbatim, licence intact.
- `public/covers/<slug>-{capsule,hero}.{png,svg}` — cover art, never scraped.

**`/play/*` is game bundles; `/games/*` is our detail routes.** They were the
same path once and collided — do not merge them again.

### Delivery modes
| mode | meaning | savesTo |
|---|---|---|
| `selfhost` | served from `public/play/`, licence permits redistribution | `origin` |
| `embed` | developer's own build in an iframe, they permit framing | `thirdparty` |
| `external` | opens their site in a new tab | `none` |

### Cover provenance
| source | meaning |
|---|---|
| `captured` | our own screenshot of a game we already have the right to run |
| `upstream-official` | real art from a repo whose licence covers assets, not just code — requires `license` + `sourceUrl` |
| `original` | hand-authored for this project |

Both tables are enforced by `content.config.ts`'s `superRefine` — an invalid
combination fails the build with a specific, actionable message. Verify this
still works before trusting a schema change: temporarily set a proprietary
game's `delivery.mode` to `selfhost` (or its cover `source` to
`upstream-official` with a non-redistributable `license`) and confirm
`npm run build` refuses it.

## UI — "Observatory"

You're at a console at the edge of a galaxy; each game is a world. One screen,
one grid, click to play — not a content site with a hero and sections.

- **Rail** (`src/components/Rail.astro`) — solid chassis, left sidebar on
  desktop / bottom bar on mobile. Library · Continue · Favourites · Settings.
  Not glass — it's meant to read as hardware, not web chrome.
- **Header** (inside `Library.tsx`) — always-visible search + category chips,
  glass, sticky. `⌘K`/`Ctrl-K`/`/` focus the search box; there is no separate
  search modal.
- **Library.tsx** is the whole product surface: search, chips, the Continue
  row, the portrait grid, and it mounts `GameFrame` directly on capsule click
  — no navigation, no detail-page detour. `/games/[slug]` still exists as the
  secondary "About" / deep-link surface, reached via the (i) icon on hover or
  "About" in the player chrome.
- **Galaxy** (`src/components/react/Galaxy.tsx`) — the environment, not
  decoration. A CSS nebula (`.nebula` in theme.css) whose hue reads
  `--stage-hue`; three canvas star layers drawn **once** and only ever moved
  with `transform: translate3d`, never redrawn. Capsule hover calls
  `setStageHue(accent)` (`src/lib/stageHue.ts`); `@property --stage-hue` in
  theme.css makes the browser tween it natively. Pauses entirely (no rAF
  callback at all, not just skipped work) while a game is running
  (`src/lib/playerState.ts`) or the tab is hidden. Degrades to the static
  nebula alone under `prefers-reduced-motion` or if `getContext('2d')` fails.
  **Budget: <2ms/frame of scripting under a 4x CPU throttle** — if a change
  regresses this, cut the canvas layer before trying to micro-optimise it;
  `tests/e2e/galaxy.spec.ts` enforces the budget.
- **GameFrame.tsx** — launched from Library, it grows from the clicked
  capsule's own rect to fullscreen (`autoLaunch`/`originRect`/`coverSrc`
  props) via a CSS transform, no library needed. Launched from the detail
  page, it shows its own Play button first, no grow animation. `onBack`
  distinguishes the two: Library-launched instances call it to unmount;
  detail-page instances fall back to collapsing their own `launched` state.

Tokens in `src/styles/theme.css`, still "Cabinet" as an internal name for the
capsule glow/lift language, which survived the redesign:
- Deep indigo surfaces (`--color-ink` #08060f). Never neutral black.
- **Amber** = interaction: hover, focus, favourite, primary action.
- **Cyan** (`--color-live`) = live state *only* — "playing now" in the
  Continue row. Do not use it decoratively.
- Archivo (display) · IBM Plex Sans (body) · IBM Plex Mono (all numbers, via
  `.tnum`).
- `.cabinet-glow` triggers on `:hover`, `:focus-visible`, **and
  `:focus-within`** — it's usually on a wrapper around the real interactive
  element (so a favourite button can be a sibling, not nested inside another
  button), and a wrapper never receives focus itself.
- `prefers-reduced-motion` removes transforms, not just shortens them.

## Writing

Sentence case. British spelling ("favourites", "licence"). Active voice; a
control says what it does. Empty states invite an action rather than apologise.
Never claim the site is official, or that a save is safe when it is not.

## Definition of done for a game PR

- [ ] `npm run verify` clean
- [ ] `npm run check` at 0/0/0
- [ ] `npm run test:e2e` green on both viewports
- [ ] Rights evidence + date recorded in the manifest's `rightsNote` — for both
      the game (`source.rightsNote`) and its cover (`cover.rightsNote`)
- [ ] Self-hosted: licence file and `NEXUS-MODIFICATIONS.txt` present
- [ ] Cover art renders (the verify script checks it is well-formed XML for SVGs)

## Known constraints

- **`github.com` is blocked on some development networks** (TLS reset; SSH times
  out on 22 and 443) — network-dependent, not always true. `raw.githubusercontent.com`
  and `cdn.jsdelivr.net` work regardless, which is why `scripts/vendor-game.ts`
  and `scripts/fetch-upstream-art.ts` use jsDelivr rather than `git clone`.
- `astro check` needs TypeScript ^6; TS 7 is not yet supported by `@astrojs/check`.
- `astro preview` **and** `astro dev` daemonise in Astro 7 (they background
  themselves and return immediately) — this is expected, not a hang; check
  `astro dev status` / `curl` rather than waiting on the command. Playwright
  uses `scripts/serve.ts` instead of `astro preview` for exactly this reason.
- **Playwright is capped at 2 workers locally** (`playwright.config.ts`). Two
  projects × an uncapped worker pool × one CPU-throttled test can oversubscribe
  an 8-core dev machine badly enough to fail otherwise-reliable,
  condition-waited tests purely from host contention — confirmed by re-running
  the identical suite at a lower cap and getting a clean pass. If a test fails
  only under full local parallelism and passes in isolation, that's this, not
  a bug — don't chase it with more timeouts.
