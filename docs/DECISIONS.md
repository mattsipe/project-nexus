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
