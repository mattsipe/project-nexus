import type { SearchDoc } from './games.ts';

/**
 * Subsequence matching, not substring: "amdi" finds "AntiMatter DImensions".
 * That matters here because the catalog is full of long, awkward titles people
 * only half-remember, and typing four letters should be enough.
 */
function subsequenceScore(needle: string, haystack: string): number {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = haystack.toLowerCase();

  const direct = h.indexOf(n);
  if (direct === 0) return 1000 - h.length;        // prefix — the best signal
  if (direct > 0) return 700 - direct - h.length;  // substring

  let hi = 0;
  let score = 500;
  let lastMatch = -1;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return -1;
    // Reward adjacency so "amdi" beats a scattered coincidental match.
    if (lastMatch >= 0) score -= (found - lastMatch - 1) * 2;
    lastMatch = found;
    hi = found + 1;
  }
  return score - h.length;
}

export interface SearchResult {
  doc: SearchDoc;
  score: number;
}

export function searchGames(query: string, docs: SearchDoc[], limit = 8): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const results: SearchResult[] = [];
  for (const doc of docs) {
    // Title dominates; tags and categories are weaker signals but let people
    // find things by genre ("idle", "prestige") rather than by name.
    const title = subsequenceScore(q, doc.title);
    const tagline = subsequenceScore(q, doc.tagline);
    const meta = Math.max(
      ...doc.tags.map((t) => subsequenceScore(q, t)),
      ...doc.categories.map((c) => subsequenceScore(q, c)),
      -1,
    );

    const score = Math.max(title, meta - 150, tagline - 300);
    if (score > 0) results.push({ doc, score });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
