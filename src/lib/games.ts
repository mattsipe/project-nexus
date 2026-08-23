import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES, type Category } from '../content.config.ts';
import { frameSrc, officialUrl, type LibraryDoc } from './gameMeta.ts';

// Re-exported so server-side .astro pages can import everything from one
// place. Client islands must import gameMeta.ts directly instead — this
// module pulls in `astro:content`, which is server-only and fails the build
// if it reaches a client bundle even transitively. See gameMeta.ts.
export {
  CATEGORY_LABELS, frameSrc, officialUrl, isPlayableInSite, rightsLabel,
  licenseLabel, type GameData, type LibraryDoc,
} from './gameMeta.ts';

export type Game = CollectionEntry<'games'>;

/** Build-time only. Sorted so every surface has a stable, intentional order. */
export async function allGames(): Promise<Game[]> {
  const games = await getCollection('games');
  return games.sort(
    (a, b) => b.data.weight - a.data.weight || a.data.title.localeCompare(b.data.title),
  );
}

export async function gamesByCategory(): Promise<{ category: Category; games: Game[] }[]> {
  const games = await allGames();
  return CATEGORIES.map((category) => ({
    category,
    games: games.filter((g) => g.data.categories.includes(category)),
  })).filter((group) => group.games.length > 0);
}

export async function libraryDocs(): Promise<LibraryDoc[]> {
  return (await allGames()).map((g) => ({
    slug: g.id,
    title: g.data.title,
    tagline: g.data.tagline,
    categories: g.data.categories,
    tags: g.data.tags,
    capsule: g.data.cover.capsule,
    hero: g.data.cover.hero,
    accent: g.data.accent,
    mode: g.data.delivery.mode,
    src: frameSrc(g.data),
    sameOrigin: g.data.delivery.mode === 'selfhost',
    officialUrl: officialUrl(g.data),
    savesThirdParty: g.data.savesTo === 'thirdparty',
    player: g.data.player,
  }));
}
