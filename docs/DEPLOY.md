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

Re-recorded 2026-08-22 after the post-expansion quality pass, still at 29
games, so regressions are visible:

| | uncompressed | gzipped | vs. end of wave 4 |
|---|---|---|---|
| All JavaScript | 231 KB | **70 KB** | +8 KB (the player sizer) |
| Home page HTML | 115 KB | 12 KB | +11 KB (manifest `player` blocks) |
| Total `dist/` | 37 MB | — | −2 MB |

The pass added the `player` block to twelve manifests and a sizer to
GameFrame, which is the 8 KB of JavaScript and most of the extra HTML — the
manifest is inlined into every page. `dist/` went *down* 2 MB despite Micropolis
moving in-house (+1.3 MB), because Clumsy Bird (3.9 MB) and Neon Serpent were
retired and their replacements are small: Snake is 180 KB and Flappy 416 KB
(most of that jQuery and jquery.transit, which its code depends on — its own
generated sprite set is a few dozen KB).

`dist/` went 4.6 MB -> 39 MB, and essentially all of it is ten new self-hosted
game bundles. That number is only meaningful per game: nothing a visitor loads
got bigger, because a bundle is only fetched when someone launches that game.
JavaScript did not move at all — twenty new games needed no application code
beyond one category and one optional manifest field.

The home page grew from 45 KB to 104 KB (7 KB -> 11 KB gzipped), purely from
twenty more capsules' worth of markup and inlined search data. That is the
number to watch: it scales with the catalogue and every visitor pays it. At
gzip it is still small, but the search index is inlined into every page, and
this is the growth curve the note at the bottom of this file is about.

The four heavy bundles were shrunk rather than embedded (DECISIONS #22), by
`scripts/shrink-bundle.ts`:

| bundle | vendored | shipped | what went |
|---|---|---|---|
| HexGL | 17 MB | 7.6 MB | level editor, duplicate three.js, all textures to WebP |
| A Dark Room | 10 MB | 6.1 MB | 25 translation bundles |
| Classic 8-Ball | 13.5 MB | 1.1 MB | a 9 MB CC-BY menu track, sprites to WebP |
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
still cheaper than a runtime fetch, but it is now the main driver of page
weight: 9 games -> 29 games took the home page from 45 KB to 104 KB, roughly
2 KB per game, and every page carries it. Revisit somewhere north of 50 —
that is when the inlined index passes the point where fetching it once and
caching it wins.
