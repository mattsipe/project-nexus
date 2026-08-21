# Project Nexus

A browser-game arcade. Static site, no accounts, no database, no tracking.
Games are either self-hosted (when the licence permits), embedded from the
developer's own build (when they permit framing), or linked to.

## Commands

```bash
npm run dev            # dev server
npm run build          # production build → dist/  (validates the manifest)
npm run serve          # foreground static server for dist/ on :4321
npm run check          # astro check — must stay at 0 errors / 0 warnings / 0 hints
npm run verify         # check + verify:assets
npm run verify:assets  # every manifest entry has real art, a real bundle, a licence
npm run verify:embed   # re-probe embedded games for framing restrictions (network)
npm run test:e2e       # Playwright, laptop + mobile viewports
npm run vendor -- <owner>/<repo>@<ref> <slug> [--subdir p] [--dry]
```

## Hard rules — non-negotiable

1. **Never** implement school-filter / GoGuardian evasion, tab cloaking, title or
   favicon spoofing, `about:blank` popunders, or `beforeunload` traps. If asked,
   decline and say why. The site this project was modelled on did all of these;
   we deliberately do not.
2. **Never** self-host a game without a verified redistributable licence. The
   build enforces this (`src/content.config.ts`), so do not weaken the schema to
   get around it.
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
3. Add a cover motif to `scripts/make-covers.ts`, then `node
   --experimental-strip-types scripts/make-covers.ts`.
4. Write `src/content/games/<slug>.yaml`.
5. `npm run verify && npm run build && npm run test:e2e`.

Adding a game requires **no application code**. If it seems to, the schema is
probably the thing that needs extending.

## Architecture

Astro 7 (static) · TypeScript strict · Tailwind 4 · React islands · Netlify.

- `src/content/games/*.yaml` — **the manifest**, one file per game. The source of truth.
- `src/content.config.ts` — Zod schema. Enforces the licensing policy at build time.
- `src/lib/` — all logic. `storage.ts` is the *only* thing that touches localStorage.
- `src/components/react/` — islands. Everything else is static `.astro`.
- `public/play/<slug>/` — vendored game bundles, copied verbatim, licence intact.
- `public/thumbs/<slug>.svg` — generated cover art, never scraped.

**`/play/*` is game bundles; `/games/*` is our detail routes.** They were the
same path once and collided — do not merge them again.

### Delivery modes
| mode | meaning | savesTo |
|---|---|---|
| `selfhost` | served from `public/play/`, licence permits redistribution | `origin` |
| `embed` | developer's own build in an iframe, they permit framing | `thirdparty` |
| `external` | opens their site in a new tab | `none` |

The schema rejects any other combination.

## Design — "Cabinet"

A dark room lit by screens. Tokens in `src/styles/theme.css`.

- Blue-black surfaces (`--color-ink` #07080d). Never neutral black.
- **Amber** (`--color-amber`) = interaction: hover, focus, favourite, primary action.
- **Cyan** (`--color-live`) = live state *only* — "playing now", the resume rail.
  Do not use it decoratively. Its scarcity is what makes it mean something.
- Archivo (display, expanded) · IBM Plex Sans (body) · IBM Plex Mono (all numbers,
  via `.tnum` — counts must not jitter as they tick).
- Signature: `.cabinet-glow` — a card lifts and casts its own art colour beneath it.
- `prefers-reduced-motion` removes transforms, not just shortens them.

## Writing

Sentence case. British spelling ("favourites", "licence"). Active voice; a
control says what it does. Empty states invite an action rather than apologise.
Never claim the site is official, or that a save is safe when it is not.

## Definition of done for a game PR

- [ ] `npm run verify` clean
- [ ] `npm run check` at 0/0/0
- [ ] `npm run test:e2e` green on both viewports
- [ ] Rights evidence + date recorded in the manifest's `rightsNote`
- [ ] Self-hosted: licence file and `NEXUS-MODIFICATIONS.txt` present
- [ ] Cover art renders (the verify script checks it is well-formed XML)

## Known constraints

- **`github.com` is blocked on the development network** (TLS reset; SSH times
  out on 22 and 443). `raw.githubusercontent.com` and `cdn.jsdelivr.net` work,
  which is why `scripts/vendor-game.ts` uses jsDelivr rather than `git clone`.
  `git push` must run from an unblocked network.
- `astro check` needs TypeScript ^6; TS 7 is not yet supported by `@astrojs/check`.
- `astro preview` daemonises in Astro 7, so Playwright uses `scripts/serve.ts`.
