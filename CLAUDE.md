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
node --experimental-strip-types scripts/shrink-bundle.ts <slug> [--dry]
                       # drop/WebP a heavy vendored bundle; prints its own change log
node --experimental-strip-types scripts/make-flappy-art.ts
                       # regenerate Flappy's sprite set — all of it original to
                       # Nexus, because upstream's was the real Flappy Bird's
```

## Hard rules — non-negotiable

1. **Never** implement school-filter / GoGuardian evasion, tab cloaking, title or
   favicon spoofing, `about:blank` popunders, or `beforeunload` traps. If asked,
   decline and say why. The site this project was modelled on did all of these;
   we deliberately do not.
2. **Never** self-host a game (or its cover art) without a verified redistributable
   licence. The build enforces this (`src/content.config.ts`), so do not weaken
   the schema to get around it. **A permissive licence on a repository grants
   nothing over material its author did not own** — floppybird is Apache-2.0
   and its `assets/` folder was still the original Flappy Bird sprite and sound
   set. Check what is actually in the bundle, not just the LICENSE file; the
   remedy is to keep the code and replace the assets (DECISIONS #35).
3. **Never** bypass `X-Frame-Options` or CSP `frame-ancestors` — no proxying, no
   header stripping. A game that blocks framing becomes `mode: external`.
4. **Never** autoplay audio. For a vendored game this means: no sound before the
   player's own launch click. A bundle that starts music on page load gets
   patched to wait for a gesture or to start muted, and the patch is recorded
   like any other modification. Checked per game during the vendor audit.
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
  the game and its cover art — at build time. Its optional `notice` field is for
  text a licence *obliges* us to display (Micropolis's trademark attribution is
  the case that introduced it); `/games/[slug]` and `/credits` both render it.
  Not a marketing slot.
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

### Per-game player sizing

Most games do not size themselves correctly against a plain full-bleed iframe.
An **optional** `player` block in the manifest (`nativeWidth`/`nativeHeight`,
`aspect`, `minWidth`, `orientation`) tells `GameFrame` how to fit one. A game
that declares nothing keeps the default, so nothing already-correct can
regress — do not turn any of this into a global rule. Where the bundle's own
CSS is the cause, fix the bundle and record it. See DECISIONS #31, and re-run
the three-viewport measurement (1366x768 / 1920x1080 / 412x915) after touching
it.

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
  desktop / bottom bar on mobile. Library · Continue · Favourites, then a
  hairline divider, then Settings — controls (mute, settings) grouped apart
  from navigation destinations. Not glass — it's meant to read as hardware,
  not web chrome. `.rail-bezel` (theme.css) adds a faint inset top+inner-edge
  highlight so it reads as a raised bezel without drawing an actual panel.
  Active state is a thin emerald edge (`border-r-2` desktop / `border-t-2`
  mobile) — an indicator LED, not a filled chip. The mute toggle
  (`MusicPlayer.tsx`) is a separate component mounted at the layout level,
  but restyled to match the rail's own item tiles (same size, same solid
  non-blurred treatment) and positioned to dock visually into the rail's
  column on desktop — see the z-index note in that file if repositioning it.
- **Genre tier** (inside `Library.tsx`) — a second column docked at
  `left: var(--rail-w)` on desktop (`hidden md:flex`, width `--genre-w`), a
  horizontal mono strip above the grid on mobile (`flex md:hidden`) where the
  rail is a bottom bar. Same buttons, same `setCategoryAndSync` handler, same
  `aria-pressed` in both — Tailwind's `hidden` removes an element from the
  accessibility tree entirely, so tests only ever see whichever variant is
  actually on screen. **If you add anything to these buttons' visible
  content** (a count badge, an icon), set an explicit `aria-label` — the
  accessible name is otherwise computed from ALL child text concatenated, and
  this has already silently broken exact-name test assertions once. Content
  padding for the genre tier lives on a wrapper div, never on `.shell`
  itself — `.shell`'s own `padding-inline` is a shorthand that silently wins
  over a `pl-[...]` utility applied to the same element.
- **Header** (inside `Library.tsx`) — search + favourites toggle only; genre
  filtering lives in the tier above, not here. Sticky, solid `.chassis` (not
  glass — a sticky blur over a permanently animating background forced a
  re-composite every frame; measured cost, see DECISIONS #15). `⌘K`/`Ctrl-K`/
  `/` focus the search box; there is no separate search modal.
- **Library.tsx** is the whole product surface: search, the genre tier, the
  Continue row, and the portrait grid — banded by category when no
  filter/search is active (`ARCADE · 06`), collapsing to one flat grid the
  moment a filter or search narrows the view. It mounts `GameFrame` directly
  on capsule click — no navigation, no detail-page detour. `/games/[slug]`
  still exists as the secondary "About" / deep-link surface, reached via the
  (i) icon on hover or "About" in the player chrome. Arrow-key grid
  navigation derives column count from the *focused button's own row*, not a
  single global row — bands are separate CSS grids, so row width can differ
  between them.
- **Galaxy** (`src/components/react/Galaxy.tsx`) — the environment, not
  decoration. A CSS nebula (`.nebula` in theme.css) whose hue reads
  `--stage-hue` (resting value 168 — near-but-not-exactly `--color-emerald`'s
  own hue, ~151, so the environment reads as "at home" in the brand at rest
  without a hover being required to reach it; keep `theme.css`'s
  `@property --stage-hue` and `stageHue.ts`'s `DEFAULT_HUE` in sync if this
  ever changes) plus a static horizon/floor plane beneath the hue-driven
  gradients — a thin emerald rim-light and a `--color-ground`-toned floor,
  neither of which reference `--stage-hue`, so they cost nothing beyond what
  the sky tint above already pays. Two canvas star layers (three until
  Phase 2 — cut for perf, see DECISIONS #15) drawn **once** and only ever
  moved with
  `transform: translate3d`, never redrawn, sized to viewport + a fixed
  overscan margin (not a multiple of the viewport — that was most of the
  cost). Capsule hover calls `setStageHue(accent)` (`src/lib/stageHue.ts`),
  which writes `--stage-hue` **onto `.nebula` itself**, not `:root` —
  `@property --stage-hue` has `inherits: false` specifically so that tween
  only ever recalculates that one element. Pauses entirely (no rAF callback
  at all, not just skipped work) while a game is running
  (`src/lib/playerState.ts`), the tab is hidden, **or the pointer/scroll have
  settled** — it doesn't tick forever at a fixed cost. Degrades to the static
  nebula alone under `prefers-reduced-motion` or if `getContext('2d')` fails.
  **Budget: median frame ≤20ms, <25% of frames over 20ms, under a 4x CPU
  throttle, measured by frame *interval* during a real pointer sweep over a
  grid cloned three-deep across every band (~78 capsules today)** —
  `tests/e2e/galaxy.spec.ts` enforces this. It is tagged `@perf` and runs in
  its own Playwright project that depends on the other two, so it gets the
  machine to itself; a throttled measurement sharing cores with other workers
  measures the host, not the site. (An
  earlier version of this budget measured rAF callback *duration* and missed
  a real regression because the cost was style recalc and compositing, not
  scripting — see DECISIONS #15 before changing the measurement approach
  again.) If a change regresses this, cut a canvas layer before trying to
  micro-optimise it.
- **GameFrame.tsx** — launched from Library, it grows from the clicked
  capsule's own rect to fullscreen (`autoLaunch`/`originRect`/`coverSrc`
  props) via a CSS transform, no library needed. Launched from the detail
  page, it shows its own Play button first, no grow animation. `onBack`
  distinguishes the two: Library-launched instances call it to unmount;
  detail-page instances fall back to collapsing their own `launched` state.

**Brand mark**: `public/brand/mark-{26,52,78}.{png,webp}` are derived
directly from the supplied Nexus logo (`assets/brand/nexus-mark-source.png`,
a six-fold interlaced ring mark) by `scripts/build-logo.ts` (`sharp`) — a
tight crop to the real alpha bounding box, square-padded, exported at
1x/2x/3x. Phase 2 shipped a flat single-weight *reconstruction* instead, on
the assumption the source's bevelled gradient would turn to mush at rail
size; rendered from the actual art at 20–64px, that assumption didn't hold,
so the reconstruction was reversed (DECISIONS #19) — **use the real
derivatives, don't redraw the mark again** unless a genuinely new size class
proves illegible. `favicon-{32,64}.png`, `apple-touch-icon.png` and
`og-image.png` all come from the same script, ink-backed. Keep the mark off
the library screen — it belongs in the rail glyph and nowhere else there;
`/credits` and `/settings` are the only pages that also show the wordmark.

Tokens in `src/styles/theme.css`, still "Cabinet" as an internal name for the
capsule glow/lift language, which survived both redesigns:
- Deep teal-black surfaces (`--color-ink` #060e0f). Never neutral black, and
  not the old indigo — the ground the emerald identity sits *in*, not on.
- **Emerald** (`--color-emerald`) = the system's own identity: chrome, focus
  rings, favourites, primary actions, the mark. This is Phase 2's rebrand
  around the supplied Nexus logo — see DECISIONS #16 before changing it.
- **Amber** (`--color-amber`) = live state *only* — "playing now" in the
  Continue row. Kept, not deleted, when emerald became the primary accent —
  do not use it decoratively or promote it back to general interaction.
- **Cyan retired** in Phase 2 — it sat inside the new emerald hue family and
  read as brand colour rather than a distinct live-state signal. Don't
  reintroduce `--color-live` as cyan; the live role is amber's now.
- Each game's own `accent` field is a separate, third role — capsule
  hover glow/border and the nebula tint. Never reassign it to emerald; that's
  what would make every game look the same. **Keep new accents outside
  roughly 20° of hue 151** (emerald) — three existing games collided closely
  enough with the system colour that hovering them barely moved anything,
  and were nudged in their manifests (DECISIONS #19).
- `--color-ground` — the nebula's floor plane and the tint mixed into card
  resting shadows. Distinct from `--color-ink`; a pure-black shadow was
  invisible against near-black ground.
- Archivo (display) · IBM Plex Sans (body) · IBM Plex Mono (all numbers, via
  `.tnum` — also now genre-tier counts, band counts, and anything else that
  reads as instrument data rather than prose).
- `.cabinet-glow` triggers on `:hover`, `:focus-visible`, **and
  `:focus-within`** — it's usually on a wrapper around the real interactive
  element (so a favourite button can be a sibling, not nested inside another
  button), and a wrapper never receives focus itself. Its box-shadow carries
  three jobs at once on hover: the lift, a tight glow at the card's own edge,
  and a broader/lower "reflection" cast of `--glow` beneath it (the ground
  picking up the card's light) — all one already-transitioning property, not
  a separate element.
- `.btn-primary` — the dimensional treatment for primary actions (`Play
  <title>`, empty-state CTAs). Use it instead of a flat `bg-emerald` fill,
  which reads as generic SaaS chrome.
- `prefers-reduced-motion` removes transforms, not just shortens them.

## Naming games

Use the game's actual official/upstream name wherever legally permissible.
Do **not** invent a Nexus name because an upstream one seems generic, dated or
awkward. Rename only for a concrete reason — trademark/IP exposure, a licensing
requirement, misleading impersonation of a commercial title, or no usable
upstream title — and preserve the upstream name prominently in provenance and
on `/credits`. A recognisable generic name beats a developer-y upstream one
where the generic name is not a trademark ("Snake", not "JavaScript Snake").
See DECISIONS #30.

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
- **`scripts/serve.ts` caches on mtime, and it must stay that way.** Playwright's
  `reuseExistingServer` is on locally, so a server left alive from a previous
  session outlives the next `npm run build`. When the cache assumed `dist/` was
  immutable it served the previous build to the entire suite, and every symptom
  pointed at the site instead of the server.
- `astro preview` **and** `astro dev` daemonise in Astro 7 (they background
  themselves and return immediately) — this is expected, not a hang; check
  `astro dev status` / `curl` rather than waiting on the command. Playwright
  uses `scripts/serve.ts` instead of `astro preview` for exactly this reason.
- **The frame-pacing gate runs alone.** It is tagged `@perf` and lives in a
  `perf` project that `dependencies` holds until laptop and mobile finish. Do
  not fold it back into those projects to save a few seconds: with the machine
  shared it failed reliably, and in isolation it passes with ~20% headroom.
- **Playwright is capped at 2 workers locally** (`playwright.config.ts`). Two
  projects × an uncapped worker pool × one CPU-throttled test can oversubscribe
  an 8-core dev machine badly enough to fail otherwise-reliable,
  condition-waited tests purely from host contention — confirmed by re-running
  the identical suite at a lower cap and getting a clean pass. If a test fails
  only under full local parallelism and passes in isolation, that's this, not
  a bug — don't chase it with more timeouts.
