# Deploy

The site is a static build. `npm run build` → `dist/`. There is no backend.

## Current blockers

Both are environmental, not code. Everything else is done and verified.

### 1. GitHub is unreachable from this network

`github.com`, `api.github.com`, and `codeload.github.com` fail from the
development machine: TCP connects on 443 but the TLS handshake is reset, even
with no SNI, and SSH times out on both 22 and 443. This is a network appliance
(disabling the Claude sandbox changes nothing), so it must be resolved by
switching networks or by IT.

From any unblocked network — home wifi or a phone hotspot is enough:

```bash
gh repo create arcadia --public --source=. --remote=origin --push
```

The repository is already initialised with clean history, so that single
command is all that remains.

### 2. Netlify needs an auth token

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

`arcadia` if the subdomain is free, otherwise let Netlify generate one and
rename later. The name is not baked into the build; only `site` in
`astro.config.mjs` refers to it, and that only affects canonical URLs.

## Measured payload

Recorded 2026-08-21 at 9 games, so regressions are visible:

| | uncompressed | gzipped |
|---|---|---|
| All JavaScript | 215 KB | **67 KB** |
| Home page HTML | 62 KB | 7 KB |
| Total `dist/` | 3.6 MB | — |

React's runtime is 176 KB of that 215 KB. If the JS budget ever becomes a real
constraint on low-end Chromebooks, aliasing `react` → `preact/compat` would cut
it to roughly 12 KB; the islands use only hooks and `createPortal`, both
supported. Not done now because 67 KB gzipped is not currently a problem, and
it would be a change to an approved stack made on speculation rather than
measurement.

The search index is inlined into every page. At this catalogue size that is
cheaper than a runtime fetch, but it scales with the number of games — revisit
somewhere north of 50.
