# Catalogue — rights audit

The legal source of truth. Every game must appear here with evidence and a date
before it ships. Re-verify anything older than six months.

Method: licence files fetched from `raw.githubusercontent.com` and read in full;
framing tested with `curl -sSL -o /dev/null -D -` against the official playable
URL, checking `X-Frame-Options` and CSP `frame-ancestors`.

## In the catalogue

| Game | Author | Licence | Mode | Evidence | Verified |
|---|---|---|---|---|---|
| Antimatter Dimensions | IvarK (Hevipelle) | MIT | embed | Source is MIT; embedded because only unbuilt source ships and the prebuilt deploy is outdated. See DECISIONS #5. | 2026-08-21 |
| 2048 | Gabriele Cirulli | MIT | selfhost | `LICENSE.txt` at repo root | 2026-08-21 |
| Hextris | Engstrom, Finucane, Moroze, Yang | GPL-3.0 | selfhost | `LICENSE.md` at repo root; modified (analytics removed), change record shipped | 2026-08-21 |
| Snake | Patrick Gillespie (patorjk) | MIT | selfhost | `LICENSE` at repo root; covers the code and the author's own block sprites, no third-party assets. Listed as "Snake" rather than upstream's "JavaScript Snake" (DECISIONS #30). Replaced Neon Serpent, our own original, which was retired 2026-08-22 | 2026-08-22 |
| Bitburner | Bitburner contributors | Apache-2.0 + Commons Clause | embed | `license.txt`; Commons Clause forbids *selling* the software, not free hosting — self-hosting would be permissible but the build is heavy | 2026-08-21 |
| Kittens Game | nuclear-unicorn (Bloodrizer) | "WET PAWS" | embed | `license.txt`: personal/educational changes allowed, **no commercial use, no derivative works**. Embedding creates neither a copy nor a derivative. | 2026-08-21 |
| The Prestige Tree | Jacorb / Acamaeda | none found | embed | No `LICENSE` file upstream ⇒ all rights reserved | 2026-08-21 |
| Distance Incremental | Jacorb | none found | embed | No `LICENSE` file upstream ⇒ all rights reserved | 2026-08-21 |
| Trimps | Greensatellite | proprietary | embed | No public redistribution grant | 2026-08-21 |
| Space Huggers | Frank Force (KilledByAPixel) | GPL-3.0 | selfhost | `LICENSE` at repo root; modified (engine build tooling removed, development watermark off), change record shipped | 2026-08-21 |
| Radius Raid | Jack Rugile | MIT | selfhost | `LICENSE.md` at repo root; vendored unmodified | 2026-08-21 |
| Star Battle | Yang Bin (4Ark) | MIT | selfhost | `LICENSE` at repo root; modified (UI translated from Simplified Chinese, page centred), change record shipped | 2026-08-21 |
| Astray | Rye Terrell (wwwtyro) | Unlicense | selfhost | `License.md` at repo root — public-domain dedication; three texture paths made relative | 2026-08-21 |
| Flappy | Nebez Briefkani | Apache-2.0 (**code only**) | selfhost | `LICENSE` at repo root covers Nebez Briefkani's code. It does **not** cover `assets/`, which shipped the original Flappy Bird sprite and sound set — the README calls the project a "vintage knockoff" and Dong Nguyen granted no redistribution. Every asset was deleted before the first commit and replaced by `scripts/make-flappy-art.ts`; only the code is upstream's. Nexus claims no affiliation with Dong Nguyen or dotGEARS. See DECISIONS #35. Replaced Clumsy Bird, retired 2026-08-22 | 2026-08-22 |
| Belt Runner | Doug McInnes | MIT | selfhost | `LICENSE` at repo root, copyright notice intact. Upstream title "Asteroids" is an Atari trademark, so Nexus retitles under MIT's modification grant and credits the author everywhere — see DECISIONS #21 | 2026-08-21 |
| HexGL | Thibaut Despoulain (BKcore) | MIT | selfhost | `LICENSE` at repo root, covering art and audio as well as code; modified (analytics stripped, editor dropped, textures re-encoded to WebP), change record shipped | 2026-08-21 |
| A Dark Room | Michael Townsend (Doublespeak Games) | MPL-2.0 | selfhost | `LICENSE.md` at repo root — file-level copyleft, headers intact; modified (analytics stripped, CDN jQuery localised, 25 translation bundles dropped), change record shipped | 2026-08-21 |
| Classic 8-Ball | Chen Shmilovich | MIT | selfhost | `LICENSE.txt` at repo root. Upstream repo is `henshmi/Classic-Pool-Game`; the game titles itself Classic 8-Ball, which is what Nexus now uses (an earlier pass had invented "Pocket Pool" — see DECISIONS #30). Its 9MB menu track is Kevin MacLeod's "Bossa Antigua" under CC-BY 3.0 — **not** covered by the repo's MIT grant and shipped without visible attribution, so it was removed rather than redistributed | 2026-08-21 |
| Racer | Jake Gordon | MIT | selfhost | `LICENSE` at repo root; only the final of four write-up versions is vendored, soundtrack removed, change record shipped | 2026-08-21 |
| Sandboxels | R74n | none found | embed | No `LICENSE`/`COPYING` upstream and no terms in the README ⇒ all rights reserved | 2026-08-22 |
| Micropolis | Graeme McCutcheon | GPL-3.0 + Micropolis Public Name Licence | **selfhost** | `LICENSE` and `MicropolisPublicNameLicense.md` both read at repo root. Previously embedded on the mistaken premise that the repo ships only TypeScript source; it maintains a built `gh-pages` branch, so GPL-3.0 self-hosting was available all along (DECISIONS #34). A Google Fonts import and a Twitter widget loader were stripped; change record shipped. The name licence requires a visible trademark attribution, rendered by the game itself, on the game's page and in /credits | 2026-08-22 |
| Untrusted | Alex Nisnevich, Greg Shuflin | none found | embed | No `LICENSE` file upstream ⇒ all rights reserved | 2026-08-22 |
| Cube Composer | David Peter (sharkdp) | MIT | embed | `LICENSE` at repo root. MIT would permit self-hosting; the repo is PureScript with no compiled output committed, so embedded for build reasons, not licensing ones | 2026-08-22 |
| Candy Box 2 | aniwey | proprietary | embed | No source repository and no licence — published only on the author's own site | 2026-08-22 |
| Universal Paperclips | Frank Lantz | proprietary | embed | No source repository and no licence — published only on the author's own site | 2026-08-22 |
| Slope | Rob Kay, published by Y8 | proprietary | embed | Y8 publishes an "iFrame Embed" snippet for `y8.com/embed/slope` on its own Slope page. Verified 2026-08-22: the ordinary game page sends `X-Frame-Options: SAMEORIGIN`, the embed endpoint sends no framing headers at all — a route the publisher provides deliberately. Y8's ads and consent UI come with it. See DECISIONS #24 | 2026-08-22 |
| Cookie Clicker | Orteil (Julien Thiennot) | proprietary | external | No licence, no source repository. `orteil.dashnet.org` answers non-browser clients with 403 behind a Cloudflare challenge, and Orteil has objected to the game being embedded | 2026-08-22 |
| Run 3 | Joseph Cloutier (Player 03) | proprietary | external | `coolmathgames.com` sends `X-Frame-Options: SAMEORIGIN`. Y8 checked for a publisher embed endpoint (as used for Slope) — it does not carry this game | 2026-08-22 |
| Duck Life | Wix Games | proprietary | external | Same: SAMEORIGIN at Coolmath, no Y8 embed endpoint | 2026-08-22 |

## Assessed, not yet added

| Game | Finding | Disposition |
|---|---|---|
| DodecaDragons | No `LICENSE` upstream. The URL previously noted (`dodecadragons.netlify.app`) 404s as of 2026-08-22 | Resolve the current URL, then embed if permitted |
| Incremental Mass Rewritten | No `LICENSE` upstream. `incremental-mass-rewritten.github.io` 404s as of 2026-08-22 | Resolve the current URL, then embed if permitted |
| One Trillion Free Draws, Calculator Evolution, Fundamental, Celestial Incremental | Author-uploaded to **galaxy.click**, which permits framing (verified 2026-08-21) | Still open. Deliberately not taken up in the Phase 2 expansion: all four are incremental, and the catalogue was already incremental-heavy |
| Minecraft-style | Eaglercraft and similar are infringing repackagings | Build an original three.js voxel sandbox |
| Tetris-style | "Tetris" is a trademark of the Tetris Company | Build an original block-stacker under a different name |
| Asteroids-style | Doug McInnes's HTML5 rebuild is genuinely MIT, but "Asteroids" is an Atari trademark | **Done.** Vendored under the MIT modification grant and shipped as Belt Runner, attribution intact — see DECISIONS #21 |

## Cover art provenance

Same audit-trail principle as the games themselves — a screenshot or promotional
image is only ours to use if the rights actually allow it, checked per game
rather than assumed.

| Game | Cover source | Evidence |
|---|---|---|
| 2048, Hextris | `captured` | Screenshot of our own build, `scripts/capture-covers.ts`, 2026-08-21. Inherits the game's own licence. |
| Snake | `captured` | Screenshot of our own self-hosted build in its Nexus theme, 2026-08-22. Inherits the game's MIT licence. |
| Space Huggers, Radius Raid, Star Battle, Astray, Belt Runner | `captured` | Screenshot of our own self-hosted build, `scripts/capture-covers.ts`; Radius Raid, Star Battle and Belt Runner re-captured 2026-08-22 after the player-fit work. Each inherits its game's own licence; Astray's is public domain. |
| Flappy | `captured` | Screenshot of our own self-hosted build, 2026-08-22. Every sprite in shot is original to Nexus (`scripts/make-flappy-art.ts`); the code is Apache-2.0. No third-party rights question. |
| HexGL, Classic 8-Ball, Racer | `captured` | Screenshot of our own self-hosted build, `scripts/capture-covers.ts`, 2026-08-21; Racer re-captured 2026-08-22 after the player-fit work. Each inherits its game's own MIT licence. |
| A Dark Room | `original` | Hand-authored (`scripts/make-original-covers.ts`), 2026-08-21. MPL-2.0 would have permitted a screenshot; the game is small serif text on near-black and a real capture is unreadable at capsule size, so it was drawn from the game's own opening vocabulary instead. |
| Sandboxels, Micropolis, Untrusted, Cube Composer, Candy Box 2, Universal Paperclips, Slope | `original` | Hand-authored (`scripts/make-original-covers.ts`), 2026-08-22. Built from each game's real vocabulary and checked against the live game. None of these grant asset redistribution, and Cube Composer's MIT grant was not leaned on for art either. |
| Cookie Clicker, Run 3, Duck Life | `original` | Hand-authored (`scripts/make-original-covers.ts`), 2026-08-22. All three are proprietary; the covers use each game's real vocabulary — Cookie Clicker's cookies-per-second, Run 3's tunnel, Duck Life's four training stats — and copy nothing. |
| Antimatter Dimensions | `upstream-official` | Official loading-screen art, MIT source repo (`public/images/loading.png`), fetched via jsDelivr 2026-08-21. |
| Bitburner | `upstream-official` | Official Steam Library capsule/hero art, Apache-2.0 source repo, fetched via jsDelivr 2026-08-21. Apache-2.0 covers the repo's assets; it does not grant trademark rights, so this is nominative use to identify the game, not a brand claim. |
| Kittens Game, Trimps, The Prestige Tree, Distance Incremental | `original` | Hand-authored UI mock-up (`scripts/make-original-covers.ts`), built from each game's real terminology and checked against the live game, 2026-08-21. No screenshot or art copied — none of these four grant redistribution rights. |

## A note on framing

Absence of `X-Frame-Options` means framing is **not technically blocked**. That
is not the same as express permission. For games we feature prominently, ask the
developer where they are reachable. If a developer asks to be removed or hosted
differently, do it — no argument, no delay.

## Third-party assets inside a licensed bundle

A permissive licence on a repository does not automatically cover every file
in it. Classic 8-Ball is the worked example: MIT code, and a 9MB background track
licensed separately under CC-BY 3.0 with its attribution buried in a source
comment. Redistributing it would have meant taking on an attribution
obligation for an asset the game does not need, so it was removed.

When a bundle contains music, fonts or art with their own credits, check them
separately from the repository's licence file.

## Roadmap — recorded, not built

None of the below is implemented. They are written down so the intent survives
the next context loss, in the same spirit as DECISIONS #25.

**Nexus originals.** *Nexus Elements* is a planned Little-Alchemy-style
original: combine two elements, discover a third. It is architected so it can
later evolve into *Nexus Infinite*, an LLM-driven successor where the
combination table is generated rather than authored. **Nexus Elements is that
one game — it is not an umbrella name for all Nexus originals.**

**Games assessed and wanted, not yet added.** PolyTrack (a browser track-racer;
rights not yet established). More classic arcade. More sandbox. More racing and
3D-ball games — the racing band currently holds three.

**Future self-hosting candidates.** Both are working authorised embeds today
and neither is urgent; the ladder is a preference weighed against engineering
cost (DECISIONS #34).

| Game | Licence | What it would take |
|---|---|---|
| Cube Composer | MIT | PureScript source; the live site serves compiled output, but the repo commits none, so it would need a build |
| Antimatter Dimensions | MIT | A large Vue app; `master` serves a built `index.html`, so worth re-checking, but it is the biggest bundle in the catalogue |

The catalogue should keep growing well past 29.
