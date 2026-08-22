# Deploy

The site is a static build. `npm run build` → `dist/`. There is no backend.

## Current status

### GitHub — resolved

`github.com` was unreachable from the original development network (TLS reset
on 443, SSH timeout on both 22 and 443 — a network appliance, not local
config). From the current network it is reachable and `gh` is authenticated,
so the repository has been created and pushed: **github.com/mattsipe/project-nexus**.

If this ever needs redoing from a blocked network again, the fix is simply to
run the same command from an unblocked one — home wifi or a phone hotspot is
enough:

```bash
gh repo create project-nexus --public --source=. --remote=origin --push
```

### Netlify — still needs your login

`api.netlify.com` is reachable (it answers 401, i.e. it wants credentials).
Deploying needs one of:

- **Git-linked (preferred).** Once the GitHub repo exists, connect it at
  app.netlify.com. `netlify.toml` already sets the build command, publish
  directory, Node version, and cache headers. Every PR then gets a deploy
  preview for free.
- **Direct from the CLI**, which needs no GitHub at all:

  ```bash
  npm i -g netlify-cli
  netlify login          # opens a browser; must be run by you, not by Claude
  netlify deploy --prod --dir=dist
  ```

Claude cannot perform either login step — that is a credential action.

## Site name

`project-nexus` if the subdomain is free, otherwise let Netlify generate one and
rename later. The name is not baked into the build; only `site` in
`astro.config.mjs` refers to it, and that only affects canonical URLs.

## Measured payload

Recorded 2026-08-22 at 19 games (Phase 2 expansion, waves 1-2), so regressions
are visible:

| | uncompressed | gzipped |
|---|---|---|
| All JavaScript | 223 KB | **70 KB** |
| Home page HTML | 75 KB | 9 KB |
| Total `dist/` | 38 MB | — |

`dist/` went 4.6 MB -> 38 MB, and essentially all of it is ten new game
bundles. That number is only meaningful per game: nothing a visitor loads got
bigger, because a bundle is only fetched when someone launches that game. The
home page grew from 45 KB to 75 KB (7 KB -> 9 KB gzipped) purely from ten more
capsules' worth of markup and inlined search data.

The four heavy bundles were shrunk rather than embedded (DECISIONS #22), by
`scripts/shrink-bundle.ts`:

| bundle | vendored | shipped | what went |
|---|---|---|---|
| HexGL | 17 MB | 7.6 MB | level editor, duplicate three.js, all textures to WebP |
| A Dark Room | 10 MB | 6.1 MB | 25 translation bundles |
| Pocket Pool | 13.5 MB | 1.1 MB | a 9 MB CC-BY menu track, sprites to WebP |
| Racer | 8.7 MB | 0.8 MB | 7.8 MB soundtrack, three superseded versions |

**`sharp` is installed** (transitively, via Astro's own image tooling) —
correcting this doc's prior claim that no PNG optimiser was available. It backs
`scripts/build-logo.ts`, `scripts/optimize-covers.ts` and
`scripts/shrink-bundle.ts`. The two heaviest covers (Antimatter Dimensions,
Bitburner) were re-encoded from PNG to WebP: 278 KB -> 35 KB and 386 KB ->
150 KB. No schema change was needed — `content.config.ts`'s cover fields only
require a `/covers/` prefix, not a specific extension.

React's runtime is 176 KB of that. If the JS budget ever becomes a real
constraint on low-end Chromebooks, aliasing `react` → `preact/compat` would cut
it to roughly 12 KB; the islands use only hooks and `createPortal`, both
supported. Not done now because 70 KB gzipped is not currently a problem, and
it would be a change to an approved stack made on speculation rather than
measurement.

The search index is inlined into every page. At this catalogue size that is
cheaper than a runtime fetch, but it scales with the number of games — revisit
somewhere north of 50.
