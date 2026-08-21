import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, type Category } from '../content.config.ts';

export type Game = CollectionEntry<'games'>;
export type GameData = Game['data'];

/** Build-time only. Sorted so every surface has a stable, intentional order. */
export async function allGames(): Promise<Game[]> {
  const games = await getCollection('games');
  return games.sort(
    (a, b) => b.data.weight - a.data.weight || a.data.title.localeCompare(b.data.title),
  );
}

export async function featuredGames(): Promise<Game[]> {
  return (await allGames()).filter((g) => g.data.featured);
}

export async function gamesByCategory(): Promise<{ category: Category; games: Game[] }[]> {
  const games = await allGames();
  return CATEGORIES.map((category) => ({
    category,
    games: games.filter((g) => g.data.categories.includes(category)),
  })).filter((group) => group.games.length > 0);
}

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
  if (data.delivery.mode !== 'selfhost') return data.delivery.url;
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

export const CATEGORY_LABELS: Record<Category, string> = {
  incremental: 'Incremental',
  puzzle: 'Puzzle',
  arcade: 'Arcade',
  action: 'Action',
  strategy: 'Strategy',
  sandbox: 'Sandbox',
  classic: 'Classic',
};

/**
 * The search index, inlined into the page at build time.
 * It is small (a few KB for a catalog this size), so shipping it beats a
 * runtime fetch — search is instant on first keypress, even on school wifi.
 */
export interface SearchDoc {
  slug: string;
  title: string;
  tagline: string;
  categories: string[];
  tags: string[];
  thumb: string;
  mode: GameData['delivery']['mode'];
  accent?: string;
}

export async function searchIndex(): Promise<SearchDoc[]> {
  return (await allGames()).map((g) => ({
    slug: g.id,
    title: g.data.title,
    tagline: g.data.tagline,
    categories: g.data.categories,
    tags: g.data.tags,
    thumb: g.data.thumb,
    mode: g.data.delivery.mode,
    ...(g.data.accent ? { accent: g.data.accent } : {}),
  }));
}
