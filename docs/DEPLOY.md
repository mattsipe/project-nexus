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

Recorded 2026-08-21 at 9 games (post-Observatory-redesign), so regressions are
visible:

| | uncompressed | gzipped |
|---|---|---|
| All JavaScript | 219 KB | **69 KB** |
| Home page HTML | 37 KB | 6 KB |
| Total `dist/` | 5.0 MB | — |

Barely moved despite the redesign being a near-total rewrite of the UI layer
(new Galaxy/Library/GameCapsule islands, several removed) — the home page HTML
actually shrank, since the old hero headline and stats block are gone. `dist/`
grew from 3.6 MB to 5.0 MB from real cover art (PNG screenshots and upstream
promotional images) replacing the old abstract SVG placeholders; still small
enough not to matter for a static Netlify deploy.

React's runtime is 176 KB of that 215 KB. If the JS budget ever becomes a real
constraint on low-end Chromebooks, aliasing `react` → `preact/compat` would cut
it to roughly 12 KB; the islands use only hooks and `createPortal`, both
supported. Not done now because 67 KB gzipped is not currently a problem, and
it would be a change to an approved stack made on speculation rather than
measurement.

The search index is inlined into every page. At this catalogue size that is
cheaper than a runtime fetch, but it scales with the number of games — revisit
somewhere north of 50.
