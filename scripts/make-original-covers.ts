/**
 * Hand-authored cover art for games with no reusable licence: Kittens Game
 * ("WET PAWS", no derivatives/commercial use), Trimps and The Prestige Tree
 * and Distance Incremental (no public licence at all). We may not use their
 * screenshots or promotional art, so these are original UI mock-ups built
 * from each game's real terminology and colour language — checked against
 * the live game, not copied from it — so someone who plays it recognises it
 * immediately without a single borrowed pixel.
 *
 * Usage: node --experimental-strip-types scripts/make-original-covers.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';

const CW = 600, CH = 800; // capsule, 3:4
const HW = 1280, HH = 720; // hero, 16:9

const mono = 'font-family="IBM Plex Mono, ui-monospace, monospace"';
const disp = 'font-family="Archivo, Arial Narrow, sans-serif" font-weight="800"';

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** The base every cover sits on: a full-bleed glow so the frame reads as
 * considered even wherever the foreground content is sparse. */
function base(w: number, h: number, accent: string): string {
  return `<rect width="${w}" height="${h}" fill="${darken(accent, 0.9)}"/>
    <radialGradient id="g" cx="72%" cy="18%" r="75%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <rect width="${w}" height="${h}" fill="url(#g)"/>`;
}

function shell(w: number, h: number, accent: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${base(w, h, accent)}
  ${body}
</svg>`;
}

// ── Kittens Game — the kitten count as a headline, not a ledger ────────────
// The first version was a dense 6-row resource ledger at ~15px font — legible
// at the 164px cards it was built for, illegible at the bigger cards this
// pass introduced (proportionally tiny text is still proportionally tiny
// text no matter how crisp the vector is). Verified against the live game:
// "kittens" (population vs. shelter capacity) is the number the whole game
// pivots on, so it becomes the bold graphic-first headline — the same
// pattern as Distance Incremental's gauge and Trimps' zone bars — with a
// couple of the classic early resources kept underneath as supporting
// detail, not the whole picture.
function kittensGame(w: number, h: number): string {
  const accent = '#e8b04b';
  const midY = h * 0.46;
  // Radius keys off the smaller dimension, not `w` alone — the capsule is
  // 3:4 (h is bigger) but the hero is 16:9 (h is much smaller), and a
  // w-derived radius pushed the ear tips off the top of the hero canvas.
  // Distance Incremental's gauge below uses the same min(w,h) approach for
  // the same reason.
  const catR = Math.min(w, h) * 0.24;
  // A simple geometric cat-ear motif behind the headline number — two
  // triangles on a soft circle — evoking the game's own mascot without
  // tracing or copying any of its actual art.
  const ears = `
    <circle cx="${w / 2}" cy="${midY}" r="${catR}" fill="${accent}" opacity="0.07"/>
    <path d="M ${w / 2 - catR * 0.6} ${midY - catR * 0.62} L ${w / 2 - catR * 0.92} ${midY - catR * 1.28} L ${w / 2 - catR * 0.16} ${midY - catR * 0.86} Z" fill="${accent}" opacity="0.1"/>
    <path d="M ${w / 2 + catR * 0.6} ${midY - catR * 0.62} L ${w / 2 + catR * 0.92} ${midY - catR * 1.28} L ${w / 2 + catR * 0.16} ${midY - catR * 0.86} Z" fill="${accent}" opacity="0.1"/>`;
  const headline = w * 0.11;
  const resources: [string, string][] = [
    ['Catnip', '4,021 (+3.8/s)'],
    ['Wood', '812 (+1.1/s)'],
    ['Minerals', '96 (+0.4/s)'],
  ];
  const rowFont = w * 0.026;
  const rowH = rowFont * 2;
  const rowsTop = midY + catR * 0.62;
  const rows = resources
    .map(([label, val], i) => `
    <text x="${w * 0.1}" y="${rowsTop + i * rowH}" ${mono} font-size="${rowFont}" fill="#cdbf94">${label}</text>
    <text x="${w * 0.9}" y="${rowsTop + i * rowH}" ${mono} font-size="${rowFont}" fill="#f2e6bf" text-anchor="end">${val}</text>`)
    .join('');
  return shell(
    w, h, accent,
    `<text x="${w * 0.1}" y="${h * 0.115}" ${disp} font-size="${w * 0.032}" fill="${accent}" letter-spacing="2">BONFIRE</text>
     ${ears}
     <text x="${w / 2}" y="${midY + headline * 0.14}" ${disp} font-size="${headline}" fill="#f2e6bf" text-anchor="middle">11 / 15</text>
     <text x="${w / 2}" y="${midY + headline * 0.62}" ${mono} font-size="${rowFont * 0.86}" fill="${accent}" text-anchor="middle" letter-spacing="3">KITTENS</text>
     <line x1="${w * 0.1}" y1="${rowsTop - rowFont * 1.35}" x2="${w * 0.9}" y2="${rowsTop - rowFont * 1.35}" stroke="#4a4223"/>
     ${rows}
     <text x="${w * 0.1}" y="${h - h * 0.045}" ${mono} font-size="${rowFont * 0.8}" fill="#8b7f52">Winter, year 7</text>`,
  );
}

// ── Trimps — the zone ladder, its central piece of UI ───────────────────────
function trimps(w: number, h: number): string {
  const accent = '#c96bd6';
  const zones = 10;
  const padX = w * 0.09;
  const gap = w * 0.012;
  const barW = (w - padX * 2 - (zones - 1) * gap) / zones;
  const baseY = h * 0.82;
  const maxH = h * 0.52;
  const bars = Array.from({ length: zones }, (_, i) => {
    const bh = maxH * (0.22 + (i / (zones - 1)) ** 1.3 * 0.78);
    const x = padX + i * (barW + gap);
    const y = baseY - bh;
    const active = i <= 6;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="5"
      fill="${active ? accent : darken(accent, 0.7)}" opacity="${active ? 0.5 + (i / zones) * 0.5 : 0.5}"/>
      <text x="${x + barW / 2}" y="${baseY + h * 0.028}" ${mono} font-size="${w * 0.016}" fill="#a98fb0" text-anchor="middle">Z${i + 1}</text>`;
  }).join('');
  return shell(
    w, h, accent,
    `<text x="${w * 0.09}" y="${h * 0.14}" ${disp} font-size="${w * 0.036}" fill="#e9d9ee">Trimps</text>
     <text x="${w * 0.09}" y="${h * 0.14 + w * 0.032}" ${mono} font-size="${w * 0.022}" fill="${accent}">Population 8,412 · Breeding</text>
     <text x="${w * 0.09}" y="${h * 0.14 + w * 0.064}" ${mono} font-size="${w * 0.019}" fill="#8a7891">Helium banked 1.2M</text>
     ${bars}
     <line x1="${padX}" y1="${baseY}" x2="${w - padX}" y2="${baseY}" stroke="#3a2a40" stroke-width="2"/>`,
  );
}

// ── The Prestige Tree — the literal branching node tree ─────────────────────
function prestigeTree(w: number, h: number): string {
  // Nudged off the system's emerald hue in the visual-design pass — see
  // src/content/games/the-prestige-tree.yaml's accent field, which this
  // must stay in sync with (the cover and the card glow are meant to be
  // the same colour).
  const accent = '#8cd15a';
  const rootX = w / 2, rootY = h * 0.94;
  const parts: string[] = [];
  const draw = (x: number, y: number, depth: number, spread: number, ang: number) => {
    if (depth === 0) return;
    for (const dir of [-1, 1]) {
      const a = ang + dir * (0.48 + depth * 0.075);
      const nx = x + Math.sin(a) * spread;
      const ny = y - Math.cos(a) * spread;
      parts.push(
        `<line x1="${x}" y1="${y}" x2="${nx}" y2="${ny}" stroke="${accent}" stroke-width="${depth * 1.8}" opacity="${0.22 + depth * 0.11}"/>`,
        `<circle cx="${nx}" cy="${ny}" r="${3 + depth * 2.3}" fill="${accent}" opacity="${0.3 + depth * 0.12}"/>`,
      );
      draw(nx, ny, depth - 1, spread * 0.74, a);
    }
  };
  parts.push(`<circle cx="${rootX}" cy="${rootY}" r="${w * 0.017}" fill="${accent}"/>`);
  draw(rootX, rootY, 6, h * 0.135, 0);
  return shell(
    w, h, accent,
    parts.join('\n') +
      `<text x="${w * 0.1}" y="${h * 0.1}" ${disp} font-size="${w * 0.034}" fill="#dff5e4">The Prestige Tree</text>
       <text x="${w * 0.1}" y="${h * 0.1 + w * 0.03}" ${mono} font-size="${w * 0.023}" fill="${accent}">Prestige Points 2.4K — Layer 3</text>`,
  );
}

// ── Distance Incremental — the velocity gauge ────────────────────────────────
// The first version used thin, low-opacity speed lines as the whole graphic
// — legible in a hero at full size, but they read as almost nothing at
// capsule/thumbnail size, which is most of where this art actually appears.
// A gauge is the real HUD element this game is built around (velocity is
// the thing you're maximising), reads instantly at any size, and gives the
// card the same bold-graphic-first weight as its siblings here (Trimps'
// zone bars, the Prestige Tree's literal tree) instead of being the one
// cover that's mostly empty space with faint lines in it.
function distanceIncremental(w: number, h: number): string {
  const accent = '#ff7a4d';
  const cx = w / 2, cy = h * 0.46;
  const r = Math.min(w, h) * 0.3;
  const startA = 145, endA = 395; // degrees, gauge sweep
  const needleA = 300; // most of the way round — "going fast"
  const pt = (a: number, radius: number) => {
    const rad = (a * Math.PI) / 180;
    return [cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius];
  };
  const arc = (a0: number, a1: number, radius: number) => {
    const [x0, y0] = pt(a0, radius);
    const [x1, y1] = pt(a1, radius);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${x0} ${y0} A${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
  };
  // Tick marks around the sweep — coarse, so they read as "gauge" at a glance.
  const ticks = Array.from({ length: 13 }, (_, i) => {
    const a = startA + ((endA - startA) / 12) * i;
    const [ix, iy] = pt(a, r * 0.86);
    const [ox, oy] = pt(a, r * 1.0);
    const lit = a <= needleA;
    return `<line x1="${ix}" y1="${iy}" x2="${ox}" y2="${oy}" stroke="${lit ? accent : darken(accent, 0.7)}" stroke-width="${w * 0.008}" stroke-linecap="round" opacity="${lit ? 0.9 : 0.4}"/>`;
  }).join('');
  const [needleX, needleY] = pt(needleA, r * 0.82);
  // Motion streaks trailing off the right edge — kept, but much bolder:
  // fewer, thicker, higher-opacity, so they still register at thumbnail size.
  const streaks = Array.from({ length: 6 }, (_, i) => {
    const y = h * 0.76 + i * (h * 0.028);
    const len = w * (0.22 + ((6 - i) / 6) * 0.5);
    return `<line x1="${w}" y1="${y}" x2="${w - len}" y2="${y}" stroke="${accent}" stroke-width="${h * 0.014}" opacity="${0.14 + (i / 6) * 0.14}" stroke-linecap="round"/>`;
  }).join('');
  return shell(
    w, h,
    accent,
    `${streaks}
     <path d="${arc(startA, endA, r)}" fill="none" stroke="${darken(accent, 0.75)}" stroke-width="${w * 0.017}" stroke-linecap="round"/>
     <path d="${arc(startA, needleA, r)}" fill="none" stroke="${accent}" stroke-width="${w * 0.017}" stroke-linecap="round"/>
     ${ticks}
     <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="#ffdac6" stroke-width="${w * 0.012}" stroke-linecap="round"/>
     <circle cx="${cx}" cy="${cy}" r="${w * 0.02}" fill="#ffdac6"/>
     <text x="${cx}" y="${cy + r * 0.42}" ${disp} font-size="${w * 0.062}" fill="#ffdac6" text-anchor="middle">1.24 Gm</text>
     <text x="${cx}" y="${cy + r * 0.42 + w * 0.032}" ${mono} font-size="${w * 0.016}" fill="${accent}" text-anchor="middle" letter-spacing="2">DISTANCE TRAVELLED</text>
     <text x="${w * 0.08}" y="${h - h * 0.06}" ${mono} font-size="${w * 0.017}" fill="#8a5c48">Rank 4 — reset for Time Shards</text>`,
  );
}

const GAMES: { slug: string; draw: (w: number, h: number) => string }[] = [
  { slug: 'kittens-game', draw: kittensGame },
  { slug: 'trimps', draw: trimps },
  { slug: 'the-prestige-tree', draw: prestigeTree },
  { slug: 'distance-incremental', draw: distanceIncremental },
];

await mkdir('public/covers', { recursive: true });
for (const g of GAMES) {
  await writeFile(`public/covers/${g.slug}-capsule.svg`, g.draw(CW, CH), 'utf8');
  await writeFile(`public/covers/${g.slug}-hero.svg`, g.draw(HW, HH), 'utf8');
}
console.log(`  ✓ ${GAMES.length * 2} original covers written to public/covers/`);
