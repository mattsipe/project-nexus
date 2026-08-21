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
