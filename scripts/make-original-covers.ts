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

// ── Kittens Game — a plain resource ledger, exactly its own aesthetic ──────
// Verified against the live game: a spare, text-first UI (no flashy chrome),
// a running resource list, and a season/year readout. Nothing here is drawn
// from a screenshot; the layout is our own reading of that same idea.
function kittensGame(w: number, h: number): string {
  const accent = '#e8b04b';
  const resources: [string, string][] = [
    ['Catnip', '4,021 (+3.8/s)'],
    ['Wood', '812 (+1.1/s)'],
    ['Minerals', '96 (+0.4/s)'],
    ['Furs', '204'],
    ['Ivory', '40'],
    ['Kittens', '11 / 15'],
  ];
  // Two, not six — a single row that reliably clears the footer at both
  // aspect ratios beats a multi-row grid that only fit at one of them.
  const buildings: [string, string][] = [['Catnip Field', '×6'], ['Hut', '×11']];
  // Row rhythm is derived from the font size itself, not scaled against `h`
  // independently — capsule (3:4) and hero (16:9) have very different w:h
  // ratios, and sizing text from `w` while spacing rows from `h` overlapped
  // badly on the wide hero canvas. Deriving both from `w` keeps them in step
  // at any aspect ratio.
  const fontSize = w * 0.026;
  const rowH = fontSize * 1.8;
  const top = h * 0.12;
  const rows = resources
    .map(([label, val], i) => `
    <text x="${w * 0.1}" y="${top + i * rowH}" ${mono} font-size="${fontSize}" fill="#cdbf94">${label}</text>
    <text x="${w * 0.9}" y="${top + i * rowH}" ${mono} font-size="${fontSize}" fill="#f2e6bf" text-anchor="end">${val}</text>`)
    .join('');
  const gridTop = top + resources.length * rowH + fontSize * 1.4;
  const cell = w * 0.27;
  const gap = w * 0.03;
  const cellH = fontSize * 3.4;
  const buildingCells = buildings
    .map(([label, count], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = w * 0.1 + col * (cell + gap);
      const y = gridTop + row * (cellH + gap);
      return `
    <rect x="${x}" y="${y}" width="${cell}" height="${cellH}" rx="6" fill="#2a2410" stroke="#4a4223"/>
    <text x="${x + 12}" y="${y + cellH - fontSize * 0.9}" ${mono} font-size="${fontSize * 0.82}" fill="#cdbf94">${label}</text>
    <text x="${x + 12}" y="${y + cellH - fontSize * 0.25}" ${mono} font-size="${fontSize * 0.82}" fill="${accent}">${count}</text>`;
    })
    .join('');
  return shell(
    w, h, accent,
    `<text x="${w * 0.1}" y="${top - fontSize * 1.1}" ${disp} font-size="${fontSize * 0.92}" fill="${accent}" letter-spacing="2">BONFIRE</text>
     <line x1="${w * 0.1}" y1="${top - fontSize * 0.7}" x2="${w * 0.9}" y2="${top - fontSize * 0.7}" stroke="#4a4223"/>
     ${rows}
     <line x1="${w * 0.1}" y1="${top + resources.length * rowH - fontSize * 0.6}" x2="${w * 0.9}" y2="${top + resources.length * rowH - fontSize * 0.6}" stroke="#4a4223"/>
     ${buildingCells}
     <text x="${w * 0.1}" y="${h - fontSize * 1.8}" ${mono} font-size="${fontSize * 0.82}" fill="#8b7f52">Winter, year 7</text>
     <rect x="${w * 0.1}" y="${h - fontSize * 1.1}" width="${w * 0.8}" height="${h * 0.008}" rx="3" fill="#2a2410"/>
     <rect x="${w * 0.1}" y="${h - fontSize * 1.1}" width="${w * 0.8 * 0.62}" height="${h * 0.008}" rx="3" fill="${accent}"/>`,
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
  const accent = '#5ad17e';
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

// ── Distance Incremental — the velocity HUD ──────────────────────────────────
function distanceIncremental(w: number, h: number): string {
  const accent = '#ff7a4d';
  const lineCount = 26;
  const lines = Array.from({ length: lineCount }, (_, i) => {
    const y = (h / lineCount) * i + (h / lineCount) / 2;
    const t = i / lineCount;
    const len = w * (0.18 + Math.pow(Math.abs(Math.sin(t * 7)), 1.4) * 0.62);
    return `<line x1="${w}" y1="${y}" x2="${w - len}" y2="${y}" stroke="${accent}" stroke-width="${h * 0.006}" opacity="${0.08 + (1 - t) * 0.22}" stroke-linecap="round"/>`;
  }).join('');
  return shell(
    w, h, accent,
    `${lines}
     <text x="${w * 0.08}" y="${h * 0.42}" ${mono} font-size="${w * 0.015}" fill="#c98462" letter-spacing="3">DISTANCE TRAVELLED</text>
     <text x="${w * 0.08}" y="${h * 0.42 + w * 0.06}" ${disp} font-size="${w * 0.075}" fill="#ffdac6">1.24 Gm</text>
     <text x="${w * 0.08}" y="${h * 0.42 + w * 0.1}" ${mono} font-size="${w * 0.02}" fill="${accent}">velocity 8.9 Mm/s   ·   acceleration 220 km/s²</text>
     <line x1="${w * 0.08}" y1="${h * 0.42 + w * 0.13}" x2="${w * 0.5}" y2="${h * 0.42 + w * 0.13}" stroke="#5c3b2c"/>
     <text x="${w * 0.08}" y="${h - h * 0.08}" ${mono} font-size="${w * 0.017}" fill="#8a5c48">Rank 4 — reset for Time Shards</text>`,
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
