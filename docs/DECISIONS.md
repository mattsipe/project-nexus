# Decisions

Short records of choices that would otherwise get quietly reversed.

## 1. Astro rather than Next.js
**2026-08-21.** The brief's baseline was Next.js. Astro was chosen because
`public/` passes through the bundler untouched — self-hosted games are raw
HTML/JS that must not be processed — and because static-first output ships far
less JavaScript, which is the Chromebook requirement made structural. Content
Collections plus Zod also give a typed, build-validated manifest for free, which
is where the licensing policy is enforced.

## 2. The licence allowlist is enforced by the build
**2026-08-21.** `REDISTRIBUTABLE_LICENSES` in `src/content.config.ts` gates
`mode: selfhost`. A policy that lives only in documentation gets forgotten under
deadline; one that fails the build does not. Verified by deliberately
configuring a proprietary game as self-hosted — the build refuses with an
actionable message. Widening the list requires an entry here.

## 3. `/play/*` for bundles, `/games/*` for pages
**2026-08-21.** They were both `/games/*` initially and collided: the vendored
`public/games/2048/index.html` shadowed the `/games/2048` detail route, and
Astro silently skipped the page. Splitting the namespaces is the fix. Do not
merge them again.

## 4. jsDelivr instead of `git clone`
**2026-08-21.** `github.com`, `api.github.com`, and `codeload.github.com` are
unreachable from the development network — TCP connects but the TLS handshake is
reset even without SNI, and SSH times out on both 22 and 443. Disabling the
Claude sandbox changed nothing, so it is a network appliance, not local config.
`cdn.jsdelivr.net` mirrors GitHub repository contents and exposes a file-listing
API, so `scripts/vendor-game.ts` uses it. This is a workaround for a blocked
network, not a preference; `git clone` is fine where GitHub is reachable.

## 5. Antimatter Dimensions is embedded, not self-hosted
**2026-08-21.** Its source is MIT, so self-hosting would be permitted. But the
repository ships only unbuilt Vue/webpack source, and the one prebuilt deploy
repository we found (`IvarK/IvarK.github.io`, also MIT) is an outdated release
whose entry point is just a redirect stub. Embedding gives players the current
official version, which is better for them than a stale self-hosted copy.
Revisit if carrying a build step becomes worthwhile.

## 6. Ambience is synthesised, not streamed
**2026-08-21.** The plan called for CC0 audio loops. Web Audio synthesis
(`src/lib/ambience.ts`) was chosen instead: it downloads nothing, raises no
licensing question, never repeats audibly, and works offline. Strictly better on
every axis the plan cared about — page weight, legal cleanliness, and school-wifi
reliability. Still off by default and still never autoplays.

## 7. TypeScript pinned to ^6
**2026-08-21.** `@astrojs/check@0.9.10` supports TypeScript `^5 || ^6`, and TS 7
is installed by default. Full `.astro` type coverage was judged worth more than
the TS 7 compiler's speed. Revisit when `@astrojs/check` supports TS 7.

## 8. Playwright uses a custom static server
**2026-08-21.** `astro preview` daemonises in Astro 7, so Playwright's
`webServer` always sees it exit immediately and aborts the run.
`scripts/serve.ts` serves `dist/` in the foreground with Netlify-like
trailing-slash behaviour and caches files in memory, which also stopped the
server being the bottleneck under parallel workers.

## 9. Rename to Project Nexus
**2026-08-21.** Rebranded from Arcadia. Ran as one atomic commit ahead of the
Observatory redesign so the rename diff wasn't buried under the redesign diff.
The `localStorage` namespace (`arcadia:` → `nexus:`) and the save-backup format
identifier were both changed with no migration shim — nothing was deployed and
there were no users, so this was a clean break rather than permanent code to
carry a pre-launch rename. GPL-3.0 change-record files
(`ARCADIA-MODIFICATIONS.txt` → `NEXUS-MODIFICATIONS.txt`, and the `[Arcadia]`
→ `[Nexus]` markers inside vendored Hextris source) had their file names and
attributing party updated; the factual description of what changed did not,
since that's what GPL-3.0 §5(a) actually requires.

## 10. Redesign: Observatory — click-to-launch, one screen, no hero
**2026-08-21.** Phase 1 shipped a technically sound site with the wrong product
shape: on a 1366×768 Chromebook, 72% of the viewport was spent before the first
pixel of game art, and 19 `<article>` cards rendered only 9 distinct games
(Featured + every category section repeating the same catalogue). That's a
content-site pattern — sections you scroll. A launcher is one library you
filter. Fixing that single structural fact deleted the hero, Featured section,
per-category pages, and the separate favourites page in one move; `Library.tsx`
is now the entire product surface, and `/games/[slug]` survives only as the
secondary "About"/deep-link path. Re-measured after: first game art at 69px
(was 522px), all 9 games visible with zero scrolling, 23 words in `<main>`
(was 279).

Click launches a game **inline**, with no navigation — a genuine product
requirement, not a nicety, since "does it feel like a launcher" hinges on it.
This forced `GameFrame` to support two entry points: Library's inline launch
(`autoLaunch`, `originRect`, `onBack`) and the detail page's own Play-button
flow (unchanged). See `CLAUDE.md`'s Architecture section for the resulting
prop contract.

## 11. games.ts split into a server half and a client-safe half
**2026-08-21.** `Library.tsx` needs `CATEGORY_LABELS` from `games.ts`, but
`games.ts` imports `getCollection` from `astro:content` — a server-only
module. Astro's build fails outright (`ServerOnlyModule`) the instant anything
in a client island's dependency graph reaches it, even transitively through an
unrelated named import. Split into `gameMeta.ts` (pure functions, the
`LibraryDoc` type, zero `astro:content` runtime import — only a type-only
`import type { CollectionEntry }`, which TypeScript erases entirely) and
`games.ts` (the `astro:content`-backed fetchers, re-exporting gameMeta's
exports so server-side `.astro` pages don't have to change their imports).
Client islands must import `gameMeta.ts` directly. Caught by the build
failing outright, not by a subtler runtime bug — but the fix pattern (split
server-only data access from pure client-safe helpers) is worth remembering
before it recurs.

## 12. Cover art: real official/captured art where rights allow, hand-authored where they don't
**2026-08-21.** The generated-SVG covers from Phase 1 (initials on a gradient)
were explicitly rejected as too abstract to recognise. Checked every game's
upstream repo for reusable art before defaulting to originals: Antimatter
Dimensions (MIT) and Bitburner (Apache-2.0) both ship real promotional/loading
art in their source repos, whose licence covers assets, not just code — used
via `scripts/fetch-upstream-art.ts`, with `license` + `sourceUrl` recorded in
the manifest and enforced by the same `REDISTRIBUTABLE_LICENSES` allowlist as
game code (`content.config.ts`'s `superRefine`, cover branch). Self-hosted/
original games get a real screenshot of our own running build
(`scripts/capture-covers.ts`, Playwright). The four games with no reusable
licence (Kittens Game, Trimps, The Prestige Tree, Distance Incremental) get
hand-authored UI mock-ups (`scripts/make-original-covers.ts`) built from each
game's real terminology and checked against the live game — recognisable to
someone who plays it, without a single copied pixel.

Two real layout bugs surfaced building these and are worth remembering: (1)
deriving vertical rhythm from `h` while font size derives from `w` breaks the
instant a component renders at two very different aspect ratios (capsule 3:4
vs hero 16:9) — both must derive from the same base unit. (2) A 6-item, 3-row
building grid that fit the 800px-tall capsule overflowed the 720px-tall hero;
the fix was a smaller, fixed-height single row, not chasing an exact fit at
every aspect ratio.

## 13. No visual-regression baselines this pass
**2026-08-21.** The redesign plan called for `toHaveScreenshot()` baselines on
the library, a hovered capsule, and the player. Skipped for this pass — a
redesign this size makes every prior baseline meaningless (everything visually
changed on purpose), so the first real value from visual regression starts
*after* this lands, protecting against accidental drift from here forward.
Manual and automated verification (the hue/metrics assertions in
`tests/e2e/catalog.spec.ts` and `galaxy.spec.ts`, plus direct screenshot review
during the build) covered this pass instead. Worth adding before the next
significant visual change, once there's a stable baseline worth protecting.

## 14. Playwright capped at 2 workers locally
**2026-08-21.** Running the full suite (2 projects × ~19 tests, one of them
deliberately 4x CPU-throttled for the galaxy perf budget) with an uncapped
worker pool oversubscribed an 8-core dev machine badly enough to fail
otherwise-reliable, condition-waited tests purely from host contention —
confirmed by re-running the identical suite at `workers: 2` and getting a
clean pass repeatedly. `workers` is left unset (Playwright's own default) in
CI, where the runner's core count is known and dedicated to the job.

## 15. Phase 2 — performance diagnosis: measure before guessing
**2026-08-21.** The user reported "slight lag." Profiled with Playwright + CDP
against the production build under a 4x CPU throttle rather than guessing —
sweeping the pointer across the library ran at **15fps median, 96% of frames
over 20ms**. Two causes, both measured, neither the one that looked most
suspicious at a glance (the galaxy's star canvases):

1. `@property --stage-hue` was `inherits: true`, transitioned on `:root`
   (`src/lib/stageHue.ts` wrote to `document.documentElement`). Every frame of
   the 900ms hover-tint tween invalidated style for the **entire document**
   — measured at ~4s of style recalc during one hover sweep, against ~50ms of
   layout. Fixed by scoping both the property (`inherits: false`) and the
   write (`.nebula` element, not the root) to the one element that actually
   uses it — recalculating one node instead of the whole tree.
2. Three star canvases sized at `innerWidth/innerHeight * 1.5` — ~7 Mpx / 27MB
   of permanently GPU-resident texture for a parallax range that never
   exceeds ~120px. Cut to two layers sized to viewport + a fixed overscan
   margin (`src/components/react/Galaxy.tsx`).

Also: the sticky header's `backdrop-filter` (blur over a permanently animating
background) forced a re-composite every frame — replaced with the same solid
`.chassis` treatment as the rail, which reads as more "one console" anyway,
not just faster. The galaxy's rAF loop now idles out once pointer/scroll
settle rather than ticking forever at a fixed cost.

Combined, at ~27 games in the grid (this phase's expansion target): **15fps →
60fps, 96% janky frames → 15%.** The existing perf test
(`tests/e2e/galaxy.spec.ts`) passed at <2ms throughout, because it measured
rAF *callback duration* — the actual cost was style recalc and compositing,
neither of which shows up inside a callback's own execution time. Replaced
with a frame-*interval* budget (median ≤20ms, <25% over 20ms) measured during
a real pointer sweep over a cloned ~27-card grid — this is what caught the
regression the old test missed, and is what "smooth" actually means.

## 16. Phase 2 — accent system: emerald identity, amber demoted to live-only
**2026-08-21.** The supplied Nexus logo (a six-fold interlaced ring mark,
emerald/teal) became the brand anchor. Reconstructed as a flat, single-weight
SVG for small sizes (`public/logo-mark.svg` — the bevelled/gradient original
turns to mush under ~32px) plus a gradient mid-fidelity version for occasional
larger display (`public/logo-mark-gradient.svg`, `/credits`, `/settings`).

Three roles, not two: **emerald** (`--color-emerald`, new) is the system's own
identity — chrome, focus rings, favourites, primary actions, the mark itself.
**Amber** (`--color-amber`, unchanged value) is *kept*, not deleted, but
narrowed to exactly one job: "playing now," the Continue row's badge — a warm
colour is still the fastest-reading signal against a now-green interface, so
demoting it beat retiring it. **Cyan** (`--color-live`) retires outright — at
hue 176 it sat inside the new emerald family and would have read as brand
colour, not a distinct live-state signal. **Each game's own `accent`** is the
third, unchanged role: capsule hover glow/border and the nebula tint, so
individual games keep their identity inside a shared emerald shell rather than
everything turning uniformly green. Ground shifted from indigo (`#08060f`) to
a deep teal-black (`#060e0f`) so the emerald sits *in* the space rather than
sitting on top of a clashing hue.

## 17. Phase 2 — a real CSS bug, and a build-time guard against its class
**2026-08-21.** `GameCapsule.tsx` used `rounded-[--radius-card]` and
`ease-[--ease-out-cabinet]` — Tailwind arbitrary values referencing a *bare*
custom-property token. These compile to `border-radius:--radius-card`, which
browsers silently discard: every capsule in the library had square corners
and default easing, unnoticed through the whole Observatory redesign. Same bug
class as the `[--rail-w]` rail-width bug fixed last phase — evidently not a
one-off. Fixed to `[var(--x)]`, and `scripts/verify-assets.ts` now greps `src/`
for the bare-token pattern on every `npm run verify`, so a third occurrence
fails the build instead of shipping silently.

## 18. Phase 2 — cover art: fixing execution, not rights
**2026-08-21.** Four covers were visually weak without any rights problem —
tightened at the "how it's drawn/captured" level, same provenance as before:

- **Neon Serpent** (ours, MIT): the scripted capture only played ~10 short
  moves, producing a 3-cell snake and a near-empty board. Growing it
  organically meant scripting an AI to survive against a randomly-placed
  pellet — real effort for a screenshot. Instead, `game.js` gained a small
  debug-only setter (`window.__neonSerpentDebug.setForCapture`, freezes the
  tick loop via `tickMs = Infinity` rather than pausing, so the HUD/rendering
  stay exactly as they'd look mid-game) that lets the capture script draw the
  *same frame* a long real game reaches, without depending on one surviving
  that long inside a scripted browser session. Doesn't affect gameplay.
- **Hextris** (GPL-3.0, vendored): the board sits centred in a lot of the
  game's own light page chrome at our capture viewport, and the old capture
  waited it out too briefly for any colour to accumulate. Slower, steadier
  scripted rotations plus a centred crop before the final resize
  (`scripts/capture-covers.ts`, `cropCapsule`). The hero was originally a
  separate wide-viewport capture, but the board reproducibly rendered visibly
  sheared at 1280x720 (not a one-off animation frame — happened across
  repeated runs) for reasons that didn't repay chasing; derived from the
  now-good capsule instead, same technique 2048 already used.
- **Bitburner** (Apache-2.0 art): the official Steam capsule's centred crop
  cut through the "bitburner" wordmark near the image's bottom edge. Keeping
  it uncropped fixed that but then duplicated our own card title a few pixels
  above it in two typefaces — cropped to just the icon and code snippet
  instead (`scripts/fetch-upstream-art.ts`, `cropAt`, a small Pillow shell-out
  since `sips` only crops centred), padded with the source's own black.
- **Distance Incremental** (original art, no upstream rights): the original
  cover was thin, low-opacity speed lines — legible at hero size, close to
  invisible at capsule/thumbnail size, which is most of where it's actually
  seen. Replaced with a velocity gauge as the dominant graphic
  (`scripts/make-original-covers.ts`) — the actual HUD element the game is
  built around, and legible at any size, matching the bolder-graphic
  treatment its siblings (Trimps' zone bars, the Prestige Tree's tree)
  already had.

## 19. Phase 2.5 — "The Viewport": a visual-design pass
**2026-08-21.** Priority A shipped a working perf/accent/logo foundation, but
reviewed against the running site it still read as a webpage on a space
wallpaper: 164px capsules, a stock pill filter bar, a rail that was four
lonely hairline icons, cards with a black shadow on near-black ground (i.e.
no visible shadow at all), and — the tell — a **violet** nebula at rest under
an emerald identity. Direction: the library is a screen inside a console,
looking out, not a page floating over a background.

- **`--stage-hue` resting value, 262 → 168.** The environment's most-seen
  state contradicted its own brand. 168 sits near `--color-emerald` (hue
  ~151) without matching it exactly, so hovering still visibly moves the
  nebula rather than the resting state needing a hover just to reach the
  brand colour. Kept in sync between `theme.css`'s `@property` and
  `stageHue.ts`'s `DEFAULT_HUE` — a comment on each points at the other.
- **A ground plane**, added as two more static (non-`--stage-hue`) layers in
  `.nebula`'s existing gradient stack: a thin emerald rim-light at a fixed
  horizon line, and a floor darkening beneath it. Static and layered into an
  element that was already repainting on hover — it costs nothing extra and
  turns "the grid stops, the page doesn't" into a floor the grid sits on.
- **Cards became lit objects**: a light top hairline / dark bottom hairline
  on `.cabinet-glow` (light from above, same cue as the ground plane), a
  resting shadow tinted toward a new `--color-ground` token instead of pure
  black (invisible against near-black), and — the signature — one more
  box-shadow layer on hover, broader and lower, casting the card's own
  `--glow` colour beneath it. Implemented as an additional shadow on the
  property that was already transitioning, not a new element or a `filter` —
  cheaper than either, and only the one hovered card ever pays for it.
- **Genre navigation moved out of the header pill row into a rail-adjacent
  tier** (`Library.tsx`, new `--genre-w` token): a fixed column on desktop
  (`hidden md:flex`, docked at `left: var(--rail-w)`), a horizontal mono strip
  on mobile (`flex md:hidden`) where the rail is a bottom bar. Same buttons,
  same `setCategoryAndSync` handler, same `aria-pressed` contract in both —
  Tailwind's `hidden` is `display:none`, which removes an element from the
  accessibility tree entirely, so role-based queries only ever see whichever
  variant is actually on screen at a given viewport. **Caught in testing:**
  adding a visible count badge inside the same button changed its computed
  accessible name from "Puzzle" to "Puzzle2" (concatenated text content),
  breaking every exact-name assertion — fixed with an explicit `aria-label`
  and `aria-hidden` on the decorative spans. Also caught: `.shell`'s own
  `padding-inline` (a shorthand) silently overrides a `pl-[...]` utility
  applied to the *same* element regardless of source order, since both target
  the `padding-left` longhand — the genre-tier offset had to live on a
  separate wrapper, not on `.shell` itself.
- **Category bands**: with no filter/search active, the grid groups by each
  game's primary category (`ARCADE · 06`) instead of one flat list; any
  active filter or search collapses it back to a flat grid, since a "Puzzle"
  band over an already-puzzle-only grid would be a redundant label. Column
  count dropped 7 → 5 (164px capsules → ~235px) — "game art should dominate"
  and 164px was thumbnail-sized. Arrow-key navigation's column-count
  detection was rewritten to derive columns from the *focused button's own
  row* rather than comparing against the grid's first button — bands are
  separate CSS grids, so a global first-row comparison broke the moment two
  bands had different widths.
- **Rail hardware**: the active-state fill (`bg-raised`, a filled chip)
  became a thin emerald edge instead (`border-r-2` desktop / `border-t-2`
  mobile) — an indicator LED, not a button state, consistent with the genre
  tier's own left-edge LED. Added `.rail-bezel` (an inset top + inner-edge
  highlight) so the rail reads as a raised bezel without drawing an actual
  panel. Settings moved below a hairline divider, grouped with the mute
  toggle (`MusicPlayer.tsx`, restyled to match the rail's own item tiles —
  solid, not blurred, same reasoning as the rail itself) — controls and
  navigation destinations are now visibly two different things, not one flat
  list of icons.
- **The logo reconstruction was reversed.** Phase 2 built a flat single-weight
  redraw on the assumption the real bevelled/gradient art would turn to mush
  at rail/favicon sizes. Rendered from the actual supplied PNG at
  20/26/32/48/64px, that assumption didn't hold — the interlace stayed
  legible well below the 26px rail size. `scripts/build-logo.ts` (new,
  `sharp`) now crops to the real alpha bounding box (found by scanning the
  raw alpha channel directly — `sharp`'s own `trim()` compares against the
  corner pixel and found nothing to trim on this source, whose outer glow
  fades gradually rather than hitting zero cleanly) and derives every brand
  asset from the actual artwork: rail glyph (1x/2x/3x, WebP+PNG), favicon,
  apple-touch-icon, og:image. `public/logo-mark.svg` and
  `public/logo-mark-gradient.svg` (the reconstructions) are deleted.
- **Cover art**: `sharp` (already present transitively via Astro, contrary to
  `DEPLOY.md`'s prior "no optimiser installed" note — corrected there too)
  re-encoded the two heaviest covers (Antimatter Dimensions, Bitburner) to
  WebP — 278KB→35KB and 386KB→150KB at their worst — via
  `scripts/optimize-covers.ts`. No schema change needed: `content.config.ts`'s
  cover fields only require a `/covers/` prefix, not a specific extension.
  Kittens Game's cover was redrawn — the original six-row resource ledger was
  legible at the 164px cards it was built for and illegible at this pass's
  ~235px cards (proportionally small text stays proportionally small
  regardless of vector crispness) — into a bold "11 / 15 KITTENS" headline
  with a small geometric cat-ear motif, matching the bolder graphic-first
  language the other three hand-authored covers already used.
- **Accent de-collision**: three games' accents sat within ~25° hue of the
  new system emerald (`#3ddc84` Bitburner, `#5ad17e` The Prestige Tree,
  `#35e0d4` Neon Serpent — the latter also close to the new 168° resting
  nebula hue), so hovering them barely moved anything. Nudged in the
  manifests (`accent:` field), not special-cased in `GameCapsule.tsx`, toward
  hues that if anything fit each game *better*: `#58dc3d` (a more matrix-green
  for a hacking-terminal game), `#8cd15a`, `#35b2e0` (a neon blue for a
  serpent). `scripts/make-original-covers.ts`'s hardcoded Prestige Tree accent
  was updated to match — the cover and the card glow are meant to be the same
  colour.
- **Tooling assessed, nothing new adopted**: Figma MCP (source of truth is
  `theme.css` + TSX; `generate_figma_design` would add a translation layer,
  not capability), `claude-in-chrome` (less scriptable than the Playwright +
  CDP harness already driving the perf gate), `DesignSync` (publishes a
  component library to claude.ai/design; this project has one consumer),
  `skill-creator` (this file and `CLAUDE.md` already encode the design
  language). `sharp` was the one real find — already installed transitively,
  previously undocumented, now used for both the logo and the cover pass.

## 20. `racing` becomes a real category

The catalogue gained two racers (HexGL, Racer) and had nowhere to put them.
`arcade` would have been a lie by omission — a racing game and a falling-block
game are not the same shelf, and the genre tier and category bands are now the
primary way anyone browses.

Added to `CATEGORIES` in `src/content.config.ts` and to `CATEGORY_LABELS` in
`src/lib/gameMeta.ts`. That second edit is not optional bookkeeping: the labels
map is a `Record<Category, string>`, so `astro check` fails if it is forgotten,
and its **key order** is what drives band order in `Library.tsx`. Racing sits
after action, so the bands read arcade · action · racing · puzzle · strategy ·
sandbox · classic · incremental — roughly reflex-first to patience-last.

This is the case `CLAUDE.md` describes when it says adding a game should need no
application code, and that if it seems to, the schema is the thing to extend.

## 21. Clones of trademarked titles are retitled, not renamed away or shipped as-is

`dmcinnes/HTML5-Asteroids` is genuinely MIT, 248KB, and good. "Asteroids" is
also a live Atari trademark, and `CATALOG.md` had already set the opposite
precedent for Tetris ("build an original block-stacker under a different name").

Shipping it under the trademark to get the recognition would contradict that
precedent; dropping it would throw away properly-licensed code over a naming
problem. So: **vendor the MIT source, ship it under a Nexus title, keep the
upstream copyright notice intact, credit the original author in
`source.author`, and state the retitle in both `NEXUS-MODIFICATIONS.txt` and
`source.rightsNote`.** MIT expressly permits modification and redistribution
under a different name; what it does not permit is dropping the attribution,
and we don't.

The test for this class is "would a reasonable person think we are claiming to
be the trademark holder", not "is the word in the title".

## 22. Heavy bundles are self-hosted and shrunk, not embedded

Three of the best additions ship 8–20MB (HexGL 20MB, Classic Pool 13.5MB, Racer
8.7MB) under licences that permit redistribution. Embedding them would have kept
`dist/` near 8MB at the cost of putting the games on someone else's host — which
for this project's actual users means a third-party request that a school
network may block, and saves that land in third-party storage.

Self-hosting won, with `scripts/shrink-bundle.ts` (declarative drop/WebP rules,
sharp, prints its own change log) doing the reconciling. HexGL alone loses ~5MB
to a texture set only its max-quality path loads.

DECISIONS #5 (Antimatter Dimensions, MIT but embedded) is not contradicted: that
game ships no usable prebuilt output at all, which is a different problem from
shipping too much.

## 23. Micropolis carries a name licence on top of the GPL

`micropolisJS` is GPL-3.0, but `MicropolisPublicNameLicense.md` separately
governs the *name*: using it requires a trademark attribution on the welcome or
title page and in credits, crediting Micropolis GmbH and linking to
micropolis.com. Satisfied on `/games/micropolis-js` and `/credits`.

Recorded here because it is the first entry whose obligations are not captured
by the licence field alone — the schema cannot express "and you must render this
sentence", so a human has to know.

## 24. Slope runs through Y8, its publisher, and says so

Coolmath's copy of Slope sends `X-Frame-Options: SAMEORIGIN`, which by itself
would make it `external`. It is not the only route: Y8, the game's original
publisher, ships an "iFrame Embed" snippet on its own Slope page pointing at
`https://y8.com/embed/slope`, which returns 200 with no framing headers.

That endpoint exists *because* Y8 wants the game embedded. Using it is the
opposite of the header-stripping this project refuses to do — one publisher
declining to be framed does not make another publisher's own embed route
illegitimate. Y8's ads and GDPR consent UI come with it and are accepted;
the manifest and the detail page both name Y8 as the host, because a player
should know whose site they are actually in.

Flagged as heavier than the rest of its wave: it is Unity WebGL.

## 25. Nexus Elements — the definition, written down this time

**Nexus Elements is a specific planned original game: a Little Alchemy-style
combination game, architected from the start so it can later evolve into Nexus
Infinite.** It is *not* an umbrella term for "the Nexus originals" generally.

This is recorded here because the definition previously lived only in a plan
file, that plan file was overwritten by the next phase's plan, and the name was
then reconstructed wrongly from context. Original-game development, Nexus
Elements included, is deferred to its own phase with its own design pass.
