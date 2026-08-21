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
| Neon Serpent | Project Nexus | original (MIT) | selfhost | Written for this project from scratch | 2026-08-21 |
| Bitburner | Bitburner contributors | Apache-2.0 + Commons Clause | embed | `license.txt`; Commons Clause forbids *selling* the software, not free hosting — self-hosting would be permissible but the build is heavy | 2026-08-21 |
| Kittens Game | nuclear-unicorn (Bloodrizer) | "WET PAWS" | embed | `license.txt`: personal/educational changes allowed, **no commercial use, no derivative works**. Embedding creates neither a copy nor a derivative. | 2026-08-21 |
| The Prestige Tree | Jacorb / Acamaeda | none found | embed | No `LICENSE` file upstream ⇒ all rights reserved | 2026-08-21 |
| Distance Incremental | Jacorb | none found | embed | No `LICENSE` file upstream ⇒ all rights reserved | 2026-08-21 |
| Trimps | Greensatellite | proprietary | embed | No public redistribution grant | 2026-08-21 |

## Assessed, not yet added

| Game | Finding | Disposition |
|---|---|---|
| Cookie Clicker | `orteil.dashnet.org` returns 403 to non-browser clients; Orteil has historically objected to embedding | `external` — needs a real-browser check before adding |
| Run 3, Slope, Duck Life | Coolmath sends `X-Frame-Options: SAMEORIGIN`; proprietary | Build originals in the genre |
| DodecaDragons | No `LICENSE` upstream; official URL not yet resolved | Resolve URL, then embed if permitted |
| Incremental Mass Rewritten | No `LICENSE` upstream; official URL not yet resolved | Resolve URL, then embed if permitted |
| One Trillion Free Draws, Calculator Evolution, Fundamental, Celestial Incremental | Author-uploaded to **galaxy.click**, which permits framing (verified 2026-08-21) | Embed via galaxy.click — a legitimate upstream, authors upload their own games |
| Minecraft-style | Eaglercraft and similar are infringing repackagings | Build an original three.js voxel sandbox |
| Tetris-style | "Tetris" is a trademark of the Tetris Company | Build an original block-stacker under a different name |

## Cover art provenance

Same audit-trail principle as the games themselves — a screenshot or promotional
image is only ours to use if the rights actually allow it, checked per game
rather than assumed.

| Game | Cover source | Evidence |
|---|---|---|
| 2048, Hextris, Neon Serpent | `captured` | Screenshot of our own build, `scripts/capture-covers.ts`, 2026-08-21. Inherits the game's own licence. |
| Antimatter Dimensions | `upstream-official` | Official loading-screen art, MIT source repo (`public/images/loading.png`), fetched via jsDelivr 2026-08-21. |
| Bitburner | `upstream-official` | Official Steam Library capsule/hero art, Apache-2.0 source repo, fetched via jsDelivr 2026-08-21. Apache-2.0 covers the repo's assets; it does not grant trademark rights, so this is nominative use to identify the game, not a brand claim. |
| Kittens Game, Trimps, The Prestige Tree, Distance Incremental | `original` | Hand-authored UI mock-up (`scripts/make-original-covers.ts`), built from each game's real terminology and checked against the live game, 2026-08-21. No screenshot or art copied — none of these four grant redistribution rights. |

## A note on framing

Absence of `X-Frame-Options` means framing is **not technically blocked**. That
is not the same as express permission. For games we feature prominently, ask the
developer where they are reachable. If a developer asks to be removed or hosted
differently, do it — no argument, no delay.
