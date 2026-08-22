import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';

/**
 * Licenses under which WE are permitted to redistribute a game from our own
 * origin. `original` means we wrote it ourselves.
 *
 * This list is the teeth behind the project's legal policy: a manifest entry
 * with `delivery.mode: selfhost` whose license is not on this list FAILS THE
 * BUILD. See docs/ADDING-A-GAME.md. Do not widen this list without recording
 * an ADR in docs/DECISIONS.md.
 */
export const REDISTRIBUTABLE_LICENSES = [
  'MIT',
  'Apache-2.0',
  'GPL-2.0',
  'GPL-3.0',
  'AGPL-3.0',
  'LGPL-3.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'MPL-2.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'Unlicense',
  'Zlib',
  'original',
] as const;

export const CATEGORIES = [
  'incremental',
  'puzzle',
  'arcade',
  'action',
  'racing',
  'strategy',
  'sandbox',
  'classic',
] as const;

export type Category = (typeof CATEGORIES)[number];

const source = z.object({
  author: z.string(),
  homepage: z.url().optional(),
  repo: z.url().optional(),
  /** SPDX identifier, or `proprietary` / `unlicensed` (= all rights reserved). */
  license: z.string(),
  licenseUrl: z.url().optional(),
  /** ISO date we last read the actual licence text with our own eyes. */
  verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** How we established the rights. Required — forces the check to be real. */
  rightsNote: z.string().min(10),
});

/**
 * Cover art provenance — the same enforcement pattern as game licensing.
 *
 *  - upstream-official: real art shipped in a licence that permits reuse
 *    (e.g. an MIT source repo, or an Apache-2.0 repo's Steam asset set).
 *    Requires the licence and the exact source URL, because 'it was in
 *    their repo' is not by itself a rights claim.
 *  - captured: a screenshot we took ourselves of a game we already have the
 *    right to run (self-hosted or embedded). No separate licence question —
 *    it inherits the game's own rights — but still dated and noted, so the
 *    audit trail is uniform.
 *  - original: drawn for this project. No third-party rights question.
 *
 * Every game gets both a capsule (3:4, the library grid) and a hero (16:9,
 * the Continue row), matching Steam's own Library asset convention.
 */
const coverBase = {
  capsule: z.string().startsWith('/covers/'),
  hero: z.string().startsWith('/covers/'),
  verifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rightsNote: z.string().min(10),
};

const cover = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('upstream-official'),
    ...coverBase,
    license: z.string(),
    sourceUrl: z.url(),
  }),
  z.object({ source: z.literal('captured'), ...coverBase }),
  z.object({ source: z.literal('original'), ...coverBase }),
]);

const delivery = z.discriminatedUnion('mode', [
  /** Served from our own origin out of public/games/<slug>/. */
  z.object({
    mode: z.literal('selfhost'),
    path: z.string().startsWith('/play/'),
  }),
  /** Author's official build, in an iframe, because they permit framing. */
  z.object({
    mode: z.literal('embed'),
    url: z.url(),
    /** ISO date we last confirmed no X-Frame-Options / CSP frame-ancestors block. */
    embedVerifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Evidence string from scripts/verify-embed.ts. */
    embedNote: z.string().min(10),
  }),
  /** Opens the author's site in a new tab. Always legal, always available. */
  z.object({
    mode: z.literal('external'),
    url: z.url(),
    /** Why we can't self-host or embed — keeps the decision auditable. */
    reason: z.string().min(10),
  }),
]);

const games = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/games' }),
  schema: z
    .object({
      title: z.string(),
      tagline: z.string().max(120),
      description: z.string().optional(),
      categories: z.array(z.enum(CATEGORIES)).min(1),
      tags: z.array(z.string()).default([]),
      delivery,
      cover,
      /**
       * Drives the card glow and the galaxy nebula's hover tint — required,
       * not cosmetic. Every capsule needs one for the signature interaction
       * to work at all.
       */
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      /** Higher sorts earlier in the library grid. */
      weight: z.number().default(0),
      added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      controls: z.array(z.enum(['mouse', 'keyboard', 'touch'])).default(['mouse']),
      fullscreen: z.enum(['supported', 'unsupported']).default('supported'),
      /**
       * Where the game's save data lands.
       *  - origin:      our origin (self-hosted) — durable, we can back it up
       *  - thirdparty:  the author's origin (embedded) — may be blocked by
       *                 third-party storage partitioning in some browsers
       *  - none:        no save state
       */
      savesTo: z.enum(['origin', 'thirdparty', 'none']).default('none'),
      source,
    })
    .superRefine((game, ctx) => {
      // ── The core legal invariant ────────────────────────────────────────
      if (game.delivery.mode === 'selfhost') {
        const ok = (REDISTRIBUTABLE_LICENSES as readonly string[]).includes(
          game.source.license,
        );
        if (!ok) {
          ctx.addIssue({
            code: 'custom',
            path: ['delivery', 'mode'],
            message:
              `Cannot self-host "${game.title}": license "${game.source.license}" ` +
              `is not in REDISTRIBUTABLE_LICENSES. Use mode "embed" or "external" ` +
              `instead, or verify the licence and add it to the allowlist with an ADR.`,
          });
        }
      }

      // Self-hosted games persist to our origin; embedded ones cannot.
      if (game.delivery.mode === 'selfhost' && game.savesTo === 'thirdparty') {
        ctx.addIssue({
          code: 'custom',
          path: ['savesTo'],
          message: 'A self-hosted game saves to our own origin, not thirdparty.',
        });
      }
      if (game.delivery.mode === 'embed' && game.savesTo === 'origin') {
        ctx.addIssue({
          code: 'custom',
          path: ['savesTo'],
          message:
            'An embedded game saves to the author\'s origin. Use "thirdparty" so ' +
            'the save-persistence warning renders.',
        });
      }

      // An external card is never playable in-site, so it has no save story here.
      if (game.delivery.mode === 'external' && game.savesTo !== 'none') {
        ctx.addIssue({
          code: 'custom',
          path: ['savesTo'],
          message: 'External games are not played in-site; savesTo must be "none".',
        });
      }

      // Cover art gets the same enforcement as the game itself: 'we found it in
      // their repo' only counts if that repo's licence actually permits reuse.
      if (game.cover.source === 'upstream-official') {
        const ok = (REDISTRIBUTABLE_LICENSES as readonly string[]).includes(game.cover.license);
        if (!ok) {
          ctx.addIssue({
            code: 'custom',
            path: ['cover', 'license'],
            message:
              `Cover art for "${game.title}" claims licence "${game.cover.license}", ` +
              `which is not in REDISTRIBUTABLE_LICENSES. Use cover source "original" ` +
              `instead, or verify the licence and add it to the allowlist with an ADR.`,
          });
        }
      }
    }),
});

export const collections = { games };
