import type { CollectionEntry } from 'astro:content';
import type { Category } from '../content.config.ts';

/**
 * Pure game-data helpers, deliberately split out of games.ts.
 *
 * games.ts imports `getCollection` from `astro:content`, which is a
 * server-only module — Astro's build fails outright if anything in a client
 * island's dependency graph reaches it, even transitively. This file exists
 * so client islands (Library.tsx, GameCapsule.tsx) can import `LibraryDoc`
 * and friends without ever touching that import chain. Only a type-only
 * import of `CollectionEntry` crosses the boundary here, which TypeScript
 * erases entirely at build time.
 */
export type GameData = CollectionEntry<'games'>['data'];

/**
 * Per-game player sizing, straight off the manifest. Undefined for the
 * majority of games, which size themselves correctly against a plain
 * full-bleed iframe — see the `player` block in content.config.ts.
 */
export type PlayerConfig = NonNullable<GameData['player']>;

/**
 * Key order is load-bearing: it sets the order of the genre tier and of the
 * category bands in Library.tsx. Roughly reflex-first to patience-last, which
 * also keeps the incremental games — the bulk of the early catalogue, and the
 * slowest thing to look at — off the top of the grid.
 */
export const CATEGORY_LABELS: Record<Category, string> = {
  arcade: 'Arcade',
  action: 'Action',
  racing: 'Racing',
  puzzle: 'Puzzle',
  strategy: 'Strategy',
  sandbox: 'Sandbox',
  classic: 'Classic',
  incremental: 'Incremental',
};

/**
 * Where the Play button goes.
 *
 * `selfhost` and `embed` both render in our in-page player, so they resolve to
 * the frame source. `external` has no in-site destination — the card opens the
 * author's site in a new tab instead, and callers must handle that case.
 */
export function frameSrc(data: GameData): string | null {
  switch (data.delivery.mode) {
    case 'selfhost':
      return data.delivery.path;
    case 'embed':
      return data.delivery.url;
    case 'external':
      return null;
  }
}

/** The author's own page, for attribution and the "Open official site" action. */
export function officialUrl(data: GameData): string | null {
  // The author's own page for the game, which is not always the URL we frame:
  // Slope is embedded from y8.com/embed/slope, a bare player, while the page a
  // person would actually want to visit is y8.com/games/slope. Prefer the
  // declared homepage and fall back to the delivery URL.
  if (data.delivery.mode !== 'selfhost') return data.source.homepage ?? data.delivery.url;
  return data.source.homepage ?? data.source.repo ?? null;
}

export function isPlayableInSite(data: GameData): boolean {
  return data.delivery.mode !== 'external';
}

/** Compact, human-readable rights summary for the card badge and credits page. */
export function rightsLabel(data: GameData): string {
  switch (data.delivery.mode) {
    case 'selfhost':
      return data.source.license === 'original'
        ? 'Original game'
        : `Self-hosted · ${data.source.license}`;
    case 'embed':
      return `Embedded · ${data.source.author}`;
    case 'external':
      return `Official site · ${data.source.author}`;
  }
}

/**
 * Licence identifiers as a reader should see them. SPDX ids pass through
 * unchanged - they are the precise answer and people who care know them - but
 * our internal sentinels are not words anyone should have to decode.
 */
export function licenseLabel(license: string): string {
  switch (license) {
    case 'original':
      return 'Original work · MIT';
    case 'unlicensed':
      return 'No licence granted · all rights reserved';
    case 'proprietary':
      return 'Proprietary';
    default:
      return license;
  }
}

/**
 * Everything the launcher needs about one game — rendering, filtering, and
 * launching it — flattened into one small object and inlined into the page at
 * build time. At this catalogue size that beats a runtime fetch: the library
 * is interactive (filterable, launchable) on the very first paint, with
 * nothing else to load.
 */
export interface LibraryDoc {
  slug: string;
  title: string;
  tagline: string;
  categories: Category[];
  tags: string[];
  capsule: string;
  hero: string;
  accent: string;
  mode: GameData['delivery']['mode'];
  /** null for `external` games, which have no in-site destination. */
  src: string | null;
  sameOrigin: boolean;
  officialUrl: string | null;
  savesThirdParty: boolean;
  /** Undefined means "the default full-bleed iframe is already correct". */
  player?: PlayerConfig;
}
