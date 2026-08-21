# Project Nexus

A browser-game arcade. Static, free to host, no accounts, no database, no
tracking, nothing to install.

```bash
npm install
npm run dev
```

## What it is

A catalogue of browser games with search, categories, favourites, recently
played, and an in-page player with fullscreen. Everything you do is stored in
your own browser; there is no server holding any of it.

Games reach you one of three ways, and every game page says which:

- **Hosted here** — the licence permits redistribution, so we serve it ourselves
  and it saves to this site.
- **Played in place** — the developer's own build in a frame, because they
  permit framing. We host no copy.
- **Linked** — not licensed for us to host and not embeddable, so we send you to
  the original.

We do not copy games we have no right to copy. `docs/CATALOG.md` records the
licence and the evidence for every entry.

## What it deliberately is not

This project is modelled on a site that was, in practice, a filter-evasion tool
— a spoofed page title, a device gate, and a handler that blocked closing the
tab. None of that is here, and it will not be added. See `CLAUDE.md`.

## Stack

Astro · TypeScript · Tailwind · React islands · Netlify. No backend.

## Docs

- `CLAUDE.md` — working rules, architecture, design system
- `docs/ADDING-A-GAME.md` — the rights-verification process
- `docs/CATALOG.md` — per-game licence audit
- `docs/DECISIONS.md` — why things are the way they are
