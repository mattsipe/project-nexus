# Adding a game

The catalogue's credibility rests entirely on this process being followed every
time. It takes about ten minutes per game.

## 1. Find the upstream source

The developer's own repository or site. **Never** an "unblocked games" or
aggregator mirror — those are themselves usually unlicensed copies, and
sourcing from one launders the problem rather than solving it.

## 2. Read the actual licence

Fetch it and read it. Do not infer it from a README badge or from the fact that
the source is public — **public source is not a licence.**

```bash
for f in LICENSE LICENSE.md LICENSE.txt license.txt COPYING; do
  curl -sS "https://raw.githubusercontent.com/<owner>/<repo>/<branch>/$f" | head -20
done
```

Check the README too — some projects state terms inline instead (Kittens Game's
"WET PAWS" licence is a real example).

**No licence file means all rights reserved.** That is the default under
copyright, not an oversight you may read past.

## 3. Classify

| Finding | Mode |
|---|---|
| Permissive or copyleft licence (MIT, Apache-2.0, GPL, BSD, MPL, CC0…) | `selfhost` |
| No licence, or one that forbids redistribution | try `embed` |
| Framing blocked, or the developer objects | `external` |

The allowlist that gates `selfhost` is `REDISTRIBUTABLE_LICENSES` in
`src/content.config.ts`. Widening it requires an entry in `DECISIONS.md`.

## 4. If not self-hostable, test framing

```bash
npm run verify:embed        # checks everything already in the catalogue
```

For a new candidate, probe it directly:

```bash
curl -sSL -o /dev/null -D - "<url>" | grep -iE "x-frame-options|content-security-policy"
```

No `X-Frame-Options` and no `frame-ancestors` means framing is **not technically
blocked**. Be honest that this is not the same as express permission — where the
developer is reachable and the game is going to be featured, ask them. If they
say no, that settles it.

## 5. Never bypass a block

If a site blocks framing, that is the answer. No proxy, no header stripping, no
CORS workaround. Set `mode: external` and move on.

## 6. Vendor it (self-hosted only)

```bash
npm run vendor -- <owner>/<repo>@<ref> <slug> --dry   # inspect first
npm run vendor -- <owner>/<repo>@<ref> <slug>
```

Then audit what landed:

```bash
grep -rEoh "https?://[a-zA-Z0-9.-]+" public/play/<slug>/index.html | sort -u
grep -rilE "google-analytics|googletagmanager|gtag\(" public/play/<slug>/
grep -Eoh '(src|href)="/[^/"][^"]*"' public/play/<slug>/index.html   # absolute paths break under /play/
```

Strip any analytics — it sends our visitors' data to a third party without
consent, and the request is commonly blocked on school networks, which stalls
the game. Record every change in `public/play/<slug>/ARCADIA-MODIFICATIONS.txt`.
For GPL games this record is a licence obligation, not a courtesy.

## 7. Cover art

Add a motif entry to `scripts/make-covers.ts` and regenerate. We draw our own
covers; we do not use the game's promotional art, which is copyrighted.

## 8. Write the manifest and verify

`src/content/games/<slug>.yaml`. The `rightsNote` must say **how** you
established the rights and **when** — it is the audit trail, so "MIT" is not
enough but "MIT LICENSE read at repo root on 2026-08-21" is.

```bash
npm run verify && npm run build && npm run test:e2e
```
