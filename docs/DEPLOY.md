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

Recorded 2026-08-21 at 9 games (post-Phase 2.5 visual-design pass), so
regressions are visible:

| | uncompressed | gzipped |
|---|---|---|
| All JavaScript | 223 KB | **75 KB** |
| Home page HTML | 45 KB | 7 KB |
| Total `dist/` | 4.6 MB | — |

`dist/` dropped (5.2 MB → 4.6 MB) despite this pass adding real weight
elsewhere (the genre tier, category bands, the ground-plane/card-shadow CSS,
the rail-hardware markup) — cover art shrank more than all of that combined.
JS and HTML both grew slightly from the extra markup and logic (genre tier,
banding, arrow-nav column detection), which is expected and small.

**`sharp` is installed** (transitively, via Astro's own image tooling) —
correcting this doc's prior claim that no PNG optimiser was available.
`scripts/build-logo.ts` and `scripts/optimize-covers.ts` both use it. The two
heaviest covers (Antimatter Dimensions, Bitburner) were re-encoded from PNG to
WebP: 278 KB → 35 KB and 386 KB → 150 KB at their worst points, no manifest
schema change needed (`content.config.ts`'s cover fields only require a
`/covers/` prefix, not a specific extension). The remaining PNG covers are
small hand-authored SVGs or already-reasonable captures, not worth the same
pass.

React's runtime is 176 KB of that. If the JS budget ever becomes a real
constraint on low-end Chromebooks, aliasing `react` → `preact/compat` would cut
it to roughly 12 KB; the islands use only hooks and `createPortal`, both
supported. Not done now because 69 KB gzipped is not currently a problem, and
it would be a change to an approved stack made on speculation rather than
measurement.

The search index is inlined into every page. At this catalogue size that is
cheaper than a runtime fetch, but it scales with the number of games — revisit
somewhere north of 50.
