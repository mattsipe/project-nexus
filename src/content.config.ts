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
      thumb: z.string().startsWith('/thumbs/'),
      /** Accent used for the card glow + detail hero. Hex. */
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      featured: z.boolean().default(false),
      /** Higher sorts earlier within a section. */
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
    }),
});

export const collections = { games };
