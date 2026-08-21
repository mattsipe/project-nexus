/**
 * Generate original SVG cover art for every game in the catalog.
 *
 * We draw our own covers rather than reusing each game's promotional art:
 * that art is copyrighted, and scraping it is exactly the shortcut this
 * project exists not to take. Generated covers are also more useful — the
 * grid reads as one designed system instead of a ransom note of borrowed
 * screenshots.
 *
 * Each motif encodes something true about its game: 2048 gets a merge grid,
 * Hextris gets stacked rings, an incremental gets a curve that runs off the
 * top of the frame.
 *
 * Usage: node --experimental-strip-types scripts/make-covers.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';

const W = 640;
const H = 400;

type Motif =
  | 'grid'        // discrete cells that combine — 2048
  | 'rings'       // stacked concentric rings — Hextris
  | 'exponent'    // a curve leaving the frame — incrementals
  | 'tree'        // branching nodes — prestige trees
  | 'distance'    // receding horizontal rule — distance
  | 'terminal'    // monospace glyph field — Bitburner
  | 'colony'      // clustered cells — Trimps / Kittens
  | 'serpent';    // a path on a lattice — Snake

interface Cover {
  slug: string;
  accent: string;
  motif: Motif;
  mark: string; // 1–2 characters, set in the display face
}

/** Mix `hex` toward black by `amount` (0–1). Keeps covers dark enough for white type. */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Deterministic PRNG so covers are stable across runs — no diff churn in git. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function motifShapes(motif: Motif, accent: string, seed: string): string {
  const r = rng(seed);
  const a = accent;
  const parts: string[] = [];

  switch (motif) {
    case 'grid': {
      // A 4×4 field where a few cells have merged into larger ones.
      const cell = 62;
      const gap = 10;
      const ox = W - 4 * (cell + gap) - 40;
      const oy = H - 4 * (cell + gap) - 36;
      const merged = new Set([5, 6, 9]);
      for (let i = 0; i < 16; i++) {
        if (merged.has(i) && i !== 5) continue;
        const col = i % 4;
        const row = Math.floor(i / 4);
        const big = i === 5;
        const size = big ? cell * 2 + gap : cell;
        parts.push(
          `<rect x="${ox + col * (cell + gap)}" y="${oy + row * (cell + gap)}" ` +
            `width="${size}" height="${size}" rx="8" fill="${a}" ` +
            `opacity="${big ? 0.9 : 0.1 + r() * 0.28}"/>`,
        );
      }
      break;
    }
    case 'rings': {
      const cx = W - 190;
      const cy = H / 2;
      for (let i = 6; i >= 1; i--) {
        const rad = i * 26;
        parts.push(
          `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${a}" ` +
            `stroke-width="${i === 3 ? 10 : 5}" opacity="${0.12 + i * 0.1}" ` +
            `stroke-dasharray="${rad * 1.4} ${rad * 5}" transform="rotate(${i * 37} ${cx} ${cy})"/>`,
        );
      }
      break;
    }
    case 'exponent': {
      // A curve that accelerates out of the top of the frame — the whole
      // emotional premise of an incremental game in one line.
      const pts: string[] = [];
      for (let x = 0; x <= 62; x++) {
        const t = x / 62;
        pts.push(`${60 + t * (W - 60)},${H - 30 - Math.pow(t, 3.1) * (H + 40)}`);
      }
      parts.push(
        `<polyline points="${pts.join(' ')}" fill="none" stroke="${a}" stroke-width="9" ` +
          `stroke-linecap="round" opacity="0.92"/>`,
      );
      for (let i = 1; i <= 5; i++) {
        parts.push(
          `<line x1="60" y1="${H - 30 - i * 62}" x2="${W - 40}" y2="${H - 30 - i * 62}" ` +
            `stroke="${a}" stroke-width="1.5" opacity="0.12"/>`,
        );
      }
      break;
    }
    case 'tree': {
      const draw = (x: number, y: number, depth: number, spread: number) => {
        if (depth === 0) return;
        for (const dir of [-1, 1]) {
          const nx = x + dir * spread;
          const ny = y - 62;
          parts.push(
            `<line x1="${x}" y1="${y}" x2="${nx}" y2="${ny}" stroke="${a}" ` +
              `stroke-width="${depth * 1.6}" opacity="${0.18 + depth * 0.14}"/>`,
          );
          parts.push(
            `<circle cx="${nx}" cy="${ny}" r="${3 + depth * 2.2}" fill="${a}" ` +
              `opacity="${0.3 + depth * 0.15}"/>`,
          );
          draw(nx, ny, depth - 1, spread * 0.52);
        }
      };
      const rootX = W - 200;
      parts.push(`<circle cx="${rootX}" cy="${H - 40}" r="10" fill="${a}" opacity="0.95"/>`);
      draw(rootX, H - 40, 4, 116);
      break;
    }
    case 'distance': {
      // Marks that compress toward a vanishing point — travelled ground.
      for (let i = 0; i < 30; i++) {
        const t = i / 29;
        const x = 40 + Math.pow(t, 2.4) * (W - 80);
        parts.push(
          `<rect x="${x}" y="${H / 2 - 46 + t * 30}" width="${Math.max(2, 16 - t * 14)}" ` +
            `height="${92 - t * 60}" rx="2" fill="${a}" opacity="${0.85 - t * 0.7}"/>`,
        );
      }
      break;
    }
    case 'terminal': {
      // Escaped for XML: raw < and > in SVG text content produce a malformed
      // document, and the browser silently renders nothing at all.
      const glyphs = ['0', '1', '&lt;', '&gt;', '$', '#', '/', '_', '[', ']', '{', '}', '|', '&amp;'];
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 22; col++) {
          if (r() > 0.42) continue;
          parts.push(
            `<text x="${52 + col * 26}" y="${58 + row * 38}" font-family="monospace" ` +
              `font-size="26" fill="${a}" opacity="${0.1 + r() * 0.6}">` +
              `${glyphs[Math.floor(r() * glyphs.length)]}</text>`,
          );
        }
      }
      break;
    }
    case 'colony': {
      // A population that clusters and thins — growth without a straight line.
      for (let i = 0; i < 46; i++) {
        const ang = r() * Math.PI * 2;
        const dist = Math.pow(r(), 0.55) * 150;
        parts.push(
          `<circle cx="${W - 180 + Math.cos(ang) * dist}" cy="${H / 2 + Math.sin(ang) * dist * 0.8}" ` +
            `r="${4 + r() * 15}" fill="${a}" opacity="${0.12 + r() * 0.55}"/>`,
        );
      }
      break;
    }
    case 'serpent': {
      const cell = 44;
      const ox = W - 9 * cell - 44;
      const oy = H - 6 * cell - 40;
      for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 6; y++) {
          parts.push(
            `<rect x="${ox + x * cell}" y="${oy + y * cell}" width="${cell - 5}" ` +
              `height="${cell - 5}" rx="3" fill="${a}" opacity="0.06"/>`,
          );
        }
      }
      const path = [
        [0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [3, 2], [4, 2],
        [4, 1], [5, 1], [6, 1], [6, 2], [6, 3], [7, 3],
      ];
      path.forEach(([x, y], i) => {
        parts.push(
          `<rect x="${ox + x! * cell}" y="${oy + y! * cell}" width="${cell - 5}" ` +
            `height="${cell - 5}" rx="3" fill="${a}" opacity="${0.28 + (i / path.length) * 0.68}"/>`,
        );
      });
      parts.push(`<circle cx="${ox + 8 * cell + 19}" cy="${oy + 5 * cell + 19}" r="9" fill="${a}"/>`);
      break;
    }
  }
  return parts.join('\n    ');
}

function cover({ slug, accent, motif, mark }: Cover): string {
  const bg = darken(accent, 0.88);
  const bg2 = darken(accent, 0.96);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${slug} cover art">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="72%" cy="46%" r="62%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    ${motifShapes(motif, accent, slug)}
    <text x="40" y="${H - 38}" font-family="Archivo, Arial Narrow, sans-serif" font-size="132"
          font-weight="800" fill="#ffffff" opacity="0.10" letter-spacing="-6">${mark}</text>
  </g>
</svg>`;
}

const COVERS: Cover[] = [
  { slug: 'antimatter-dimensions', accent: '#7c6cff', motif: 'exponent', mark: 'AD' },
  { slug: '2048',                  accent: '#f0a93b', motif: 'grid',     mark: '20' },
  { slug: 'hextris',               accent: '#2fc4d6', motif: 'rings',    mark: 'HX' },
  { slug: 'the-prestige-tree',     accent: '#5ad17e', motif: 'tree',     mark: 'PT' },
  { slug: 'distance-incremental',  accent: '#ff7a4d', motif: 'distance', mark: 'DI' },
  { slug: 'bitburner',             accent: '#3ddc84', motif: 'terminal', mark: 'BB' },
  { slug: 'trimps',                accent: '#c96bd6', motif: 'colony',   mark: 'TR' },
  { slug: 'kittens-game',          accent: '#e8b04b', motif: 'colony',   mark: 'KG' },
  { slug: 'neon-serpent',          accent: '#35e0d4', motif: 'serpent',  mark: 'NS' },
];

await mkdir('public/thumbs', { recursive: true });
for (const c of COVERS) {
  await writeFile(`public/thumbs/${c.slug}.svg`, cover(c), 'utf8');
}
console.log(`  ✓ ${COVERS.length} covers written to public/thumbs/`);
