/**
 * Hand-authored cover art. Two reasons a game ends up here:
 *
 *  1. No reusable licence, so a screenshot is not ours to ship — Kittens Game
 * ("WET PAWS", no derivatives/commercial use), Trimps and The Prestige Tree
 * and Distance Incremental (no public licence at all). We may not use their
 * screenshots or promotional art, so these are original UI mock-ups built
 *     ("WET PAWS", no derivatives or commercial use), Trimps, The Prestige
 *     Tree and Distance Incremental (no public licence at all).
 *  2. The screenshot is rights-clean but unreadable at capsule size — A Dark
 *     Room is a text game in 14px serif; at 235px wide, a real capture of it
 *     is a grey smudge.
 *
 * Either way these are original mock-ups built from each game's real
 * terminology and colour language — checked against the live game, not copied
 * from it — so someone who plays it recognises it immediately without a
 * single borrowed pixel.
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

// ── A Dark Room — one fire in the dark, and the log beside it ──────────────
// The only game here whose art is withheld by legibility rather than by
// licence: it is self-hosted under MPL-2.0, so a screenshot would be ours to
// use, but the game is 14px serif text on a near-black field and a real
// capture reads as a grey smudge on a 235px card. Drawn instead from what the
// game actually puts on screen in its first minute — the fire's states, the
// stores panel, and the notification log's own sentences.
function aDarkRoom(w: number, h: number): string {
  const accent = '#d9cdb8';
  const cx = w / 2;
  const fireY = h * 0.46;
  const r = Math.min(w, h) * 0.2;
  // A fire built out of three nested triangles — the game never draws one, so
  // there is nothing to copy; this is the idea of a fire, in its palette.
  // Warm, and bright enough to survive a 235px card. The first pass drew the
  // flame at 0.13-0.6 opacity in the parchment accent, which on a near-black
  // ground left the whole cover reading as an empty rectangle.
  const emberFor = (scale: number) => (scale > 0.9 ? '#c2551f' : scale > 0.5 ? '#e08b2a' : '#ffd27a');
  const flame = (scale: number, opacity: number) => {
    const s = r * scale;
    const accent = emberFor(scale);
    return `<path d="M ${cx} ${fireY - s} C ${cx + s * 0.75} ${fireY - s * 0.15} ${cx + s * 0.62} ${fireY + s * 0.8} ${cx} ${fireY + s * 0.8} C ${cx - s * 0.62} ${fireY + s * 0.8} ${cx - s * 0.75} ${fireY - s * 0.15} ${cx} ${fireY - s} Z" fill="${accent}" opacity="${opacity}"/>`;
  };
  const rows: [string, string][] = [
    ['wood', '74'],
    ['fur', '12'],
    ['meat', '5'],
  ];
  const rowY = h * 0.72;
  const stores = rows
    .map(([k, v], i) => {
      const y = rowY + i * h * 0.052;
      return `<text x="${w * 0.1}" y="${y}" ${mono} font-size="${w * 0.026}" fill="#8f877c">${k}</text>
        <text x="${w * 0.42}" y="${y}" ${mono} font-size="${w * 0.026}" fill="${accent}" text-anchor="end">${v}</text>`;
    })
    .join('');
  return shell(
    w, h, accent,
    `<text x="${w * 0.1}" y="${h * 0.15}" ${disp} font-size="${w * 0.05}" fill="#efe7da">A DARK ROOM</text>
     <text x="${w * 0.1}" y="${h * 0.15 + w * 0.042}" ${mono} font-size="${w * 0.022}" fill="${accent}">the fire is burning.</text>
     <circle cx="${cx}" cy="${fireY + r * 0.3}" r="${r * 1.9}" fill="#b8632a" opacity="0.14"/>
     <circle cx="${cx}" cy="${fireY + r * 0.3}" r="${r * 1.1}" fill="#d4772e" opacity="0.18"/>
     ${flame(1.05, 0.55)}
     ${flame(0.66, 0.85)}
     ${flame(0.32, 1)}
     <line x1="${w * 0.1}" y1="${rowY - h * 0.045}" x2="${w * 0.55}" y2="${rowY - h * 0.045}" stroke="#3a3630" stroke-width="2"/>
     <text x="${w * 0.1}" y="${rowY - h * 0.062}" ${mono} font-size="${w * 0.02}" fill="#6d665d">STORES</text>
     ${stores}`,
  );
}

// ── Sandboxels — a column of elements falling into a pile ──────────────────
// The game is a grid of one-pixel elements reacting with each other, so the
// cover is a grid of elements: sand settling on stone, water above it, a seam
// of lava. Colours are chosen here, not sampled from the game.
function sandboxels(w: number, h: number): string {
  const accent = '#c9d93c';
  const cols = 16;
  const cell = (w * 0.82) / cols;
  const x0 = w * 0.09;
  const y0 = h * 0.3;
  const rows = Math.round((h * 0.46) / cell);
  const palette = ['#c9d93c', '#d8b45c', '#5f8fd9', '#d94f2b', '#6b6f72', '#4c8f4c'];
  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // A settled pile: dense low and to the middle, sparse at the top.
      const depth = r / (rows - 1);
      const centre = 1 - Math.abs(c / (cols - 1) - 0.5) * 2;
      const fill = depth * 0.75 + centre * 0.3;
      if (((c * 7 + r * 13) % 11) / 11 > fill) continue;
      const colour = palette[(c * 3 + r * 5) % palette.length]!;
      cells.push(
        `<rect x="${x0 + c * cell}" y="${y0 + r * cell}" width="${cell * 0.9}" height="${cell * 0.9}" fill="${colour}" opacity="${0.32 + depth * 0.5}"/>`,
      );
    }
  }
  return shell(
    w, h, accent,
    `<text x="${w * 0.09}" y="${h * 0.15}" ${disp} font-size="${w * 0.048}" fill="#eef3d6">SANDBOXELS</text>
     <text x="${w * 0.09}" y="${h * 0.15 + w * 0.04}" ${mono} font-size="${w * 0.021}" fill="${accent}">sand · water · lava · plant · steam</text>
     ${cells.join('')}`,
  );
}

// ── Micropolis — the city as a zoning grid ─────────────────────────────────
// Residential, commercial and industrial blocks on a road grid, which is
// literally what the player paints. The trademark attribution the Micropolis
// Public Name Licence requires lives on the game's page and in /credits, not
// on a 235px card.
function micropolisJs(w: number, h: number): string {
  const accent = '#4a86e8';
  const zoneColours = ['#4a86e8', '#3fb98a', '#e0b13d'];
  const cols = 9, rows = 7;
  const padX = w * 0.1;
  const gridW = w - padX * 2;
  const cw = gridW / cols;
  const top = h * 0.32;
  const ch = (h * 0.5) / rows;
  const blocks: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = (c * 5 + r * 11) % 13;
      if (seed < 3) continue; // roads and parks
      const colour = zoneColours[seed % 3]!;
      const bh = ch * (0.35 + (seed % 5) * 0.13);
      blocks.push(
        `<rect x="${padX + c * cw + cw * 0.12}" y="${top + r * ch + (ch - bh)}" width="${cw * 0.76}" height="${bh}" rx="2" fill="${colour}" opacity="${0.28 + (seed % 5) * 0.13}"/>`,
      );
    }
  }
  const roads = Array.from({ length: rows + 1 }, (_, r) =>
    `<line x1="${padX}" y1="${top + r * ch}" x2="${w - padX}" y2="${top + r * ch}" stroke="#1d2a3d" stroke-width="1.5"/>`,
  ).concat(Array.from({ length: cols + 1 }, (_, c) =>
    `<line x1="${padX + c * cw}" y1="${top}" x2="${padX + c * cw}" y2="${top + rows * ch}" stroke="#1d2a3d" stroke-width="1.5"/>`,
  )).join('');
  return shell(
    w, h, accent,
    `<text x="${padX}" y="${h * 0.15}" ${disp} font-size="${w * 0.048}" fill="#dfe8f7">MICROPOLIS</text>
     <text x="${padX}" y="${h * 0.15 + w * 0.04}" ${mono} font-size="${w * 0.021}" fill="${accent}">Pop. 41,220 · Funds $18,400 · R C I</text>
     ${roads}${blocks.join('')}`,
  );
}

// ── Untrusted — the level as source, the source as the level ──────────────
// The whole game is an ASCII map beside the JavaScript that generated it, and
// you edit the source to escape. Both halves, drawn.
function untrusted(w: number, h: number): string {
  const accent = '#e8c33d';
  const map = [
    '########################',
    '#@.....#...........#...#',
    '#.####.#.#########.#.#.#',
    '#.#....#.........#...#.#',
    '#.#.############.#####.#',
    '#...#..........#.......#',
    '###.#.########.#######.#',
    '#...#.#......#.......#Ø#',
    '########################',
  ];
  const size = Math.min(w / 30, h / 22);
  const mx = w * 0.09;
  const my = h * 0.34;
  const rows = map
    .map((row, r) =>
      `<text x="${mx}" y="${my + r * size * 1.5}" ${mono} font-size="${size * 1.25}" fill="#8a7f4d" xml:space="preserve">${row
        .replace(/@/g, ' ')
        .replace(/Ø/g, ' ')}</text>`,
    )
    .join('');
  // The player and the exit, picked out of the wall glyphs.
  const glyph = (ch: string, col: number, row: number, colour: string) =>
    `<text x="${mx + col * size * 0.6}" y="${my + row * size * 1.5}" ${mono} font-size="${size * 1.25}" fill="${colour}">${ch}</text>`;
  return shell(
    w, h, accent,
    `<text x="${w * 0.09}" y="${h * 0.15}" ${disp} font-size="${w * 0.048}" fill="#f3ecd6">UNTRUSTED</text>
     <text x="${w * 0.09}" y="${h * 0.15 + w * 0.04}" ${mono} font-size="${w * 0.021}" fill="${accent}">// rewrite the level to escape it</text>
     ${rows}
     ${glyph('@', 1, 1, accent)}
     ${glyph('Ø', 22, 7, '#7fd4a0')}`,
  );
}

// ── Cube Composer — one transformation, before and after ──────────────────
function cubeComposer(w: number, h: number): string {
  const accent = '#e85c9e';
  const colours = ['#e85c9e', '#f0b23d', '#4ac2e0', '#8f6fe0'];
  const stack = (x: number, baseY: number, heights: number[], cw: number, chh: number) =>
    heights
      .map((n, i) =>
        Array.from({ length: n }, (_, k) =>
          `<rect x="${x + i * (cw + cw * 0.18)}" y="${baseY - (k + 1) * chh}" width="${cw}" height="${chh * 0.86}" rx="2" fill="${colours[(i + k) % colours.length]}" opacity="0.78"/>`,
        ).join(''),
      )
      .join('');
  const cw = w * 0.062;
  const chh = h * 0.05;
  const rowA = h * 0.52;
  const rowB = h * 0.86;
  return shell(
    w, h, accent,
    `<text x="${w * 0.09}" y="${h * 0.15}" ${disp} font-size="${w * 0.044}" fill="#f8dfec">CUBE COMPOSER</text>
     <text x="${w * 0.09}" y="${h * 0.15 + w * 0.038}" ${mono} font-size="${w * 0.021}" fill="${accent}">map · filter · fold</text>
     ${stack(w * 0.11, rowA, [2, 1, 3, 1, 2], cw, chh)}
     <text x="${w * 0.11}" y="${rowA + h * 0.075}" ${mono} font-size="${w * 0.026}" fill="#8f7385">↓ map (stack)</text>
     ${stack(w * 0.11, rowB, [3, 2, 4, 2, 3], cw, chh)}`,
  );
}

// ── Candy Box 2 — the counter, and the candies falling into it ────────────
function candyBox2(w: number, h: number): string {
  const accent = '#e8546a';
  const drops = Array.from({ length: 26 }, (_, i) => {
    const x = w * 0.08 + ((i * 137) % 84) / 100 * w * 0.84;
    const y = h * 0.3 + ((i * 71) % 55) / 100 * h * 0.5;
    const r = w * (0.008 + ((i * 29) % 7) / 700);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${accent}" opacity="${0.2 + ((i * 13) % 6) / 12}"/>`;
  }).join('');
  return shell(
    w, h, accent,
    `${drops}
     <text x="${w / 2}" y="${h * 0.56}" ${disp} font-size="${w * 0.13}" fill="#fbe6ea" text-anchor="middle">1 048 576</text>
     <text x="${w / 2}" y="${h * 0.56 + w * 0.055}" ${mono} font-size="${w * 0.026}" fill="${accent}" text-anchor="middle">candies</text>
     <text x="${w * 0.09}" y="${h * 0.15}" ${disp} font-size="${w * 0.044}" fill="#fbe6ea">CANDY BOX 2</text>
     <text x="${w * 0.09}" y="${h * 0.15 + w * 0.038}" ${mono} font-size="${w * 0.021}" fill="${accent}">eat them · or throw them on the ground</text>`,
  );
}

// ── Universal Paperclips — one paperclip, drawn very large ─────────────────
function universalPaperclips(w: number, h: number): string {
  const accent = '#b8c2cc';
  const cx = w / 2, cy = h * 0.52;
  const s = Math.min(w, h) * 0.3;
  // Three nested rounded rectangles open at alternating ends: a paperclip.
  const clip = `
    <g fill="none" stroke="${accent}" stroke-linecap="round" stroke-width="${s * 0.14}">
      <path d="M ${cx - s * 0.44} ${cy + s * 0.72}
               L ${cx - s * 0.44} ${cy - s * 0.5}
               A ${s * 0.44} ${s * 0.44} 0 0 1 ${cx + s * 0.44} ${cy - s * 0.5}
               L ${cx + s * 0.44} ${cy + s * 0.34}
               A ${s * 0.26} ${s * 0.26} 0 0 1 ${cx - s * 0.08} ${cy + s * 0.34}
               L ${cx - s * 0.08} ${cy - s * 0.24}"
            opacity="0.85"/>
    </g>`;
  return shell(
    w, h, accent,
    `<text x="${w * 0.09}" y="${h * 0.15}" ${disp} font-size="${w * 0.04}" fill="#eef2f6">UNIVERSAL PAPERCLIPS</text>
     <text x="${w * 0.09}" y="${h * 0.15 + w * 0.035}" ${mono} font-size="${w * 0.021}" fill="${accent}">Clips 30,142 · Wire 998 · Funds $12.41</text>
     ${clip}`,
  );
}

// ── Slope — the corridor, receding ────────────────────────────────────────
function slope(w: number, h: number): string {
  const accent = '#ff3b3b';
  const cx = w / 2;
  const horizon = h * 0.36;
  const floor = h * 0.98;
  const laneCount = 7;
  const lanes = Array.from({ length: laneCount + 1 }, (_, i) => {
    const t = i / laneCount;
    const xNear = w * -0.15 + t * w * 1.3;
    const xFar = cx + (t - 0.5) * w * 0.11;
    return `<line x1="${xNear}" y1="${floor}" x2="${xFar}" y2="${horizon}" stroke="#2b3742" stroke-width="2"/>`;
  }).join('');
  const rungs = Array.from({ length: 7 }, (_, i) => {
    const t = (i + 1) / 8;
    const y = horizon + (floor - horizon) * t ** 2.3;
    const halfW = (w * 0.055) + (w * 0.72 - w * 0.055) * t ** 2.3;
    return `<line x1="${cx - halfW}" y1="${y}" x2="${cx + halfW}" y2="${y}" stroke="#37454f" stroke-width="${1 + t * 3}"/>`;
  }).join('');
  const blocks = [[-0.22, 0.62], [0.3, 0.5], [0.05, 0.78]]
    .map(([off, t]) => {
      const y = horizon + (floor - horizon) * (t as number) ** 2.3;
      const halfW = (w * 0.055) + (w * 0.72 - w * 0.055) * (t as number) ** 2.3;
      const size = w * 0.03 + w * 0.075 * (t as number);
      return `<rect x="${cx + (off as number) * halfW * 2 - size / 2}" y="${y - size}" width="${size}" height="${size}" fill="${accent}" opacity="0.75"/>`;
    })
    .join('');
  return shell(
    w, h, accent,
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#0a1015"/>
     <rect x="0" y="${horizon}" width="${w}" height="${h - horizon}" fill="#101a22"/>
     <rect x="0" y="0" width="${w}" height="${horizon}" fill="#070c10"/>
     ${lanes}${rungs}${blocks}
     <circle cx="${cx}" cy="${floor - h * 0.14}" r="${Math.min(w, h) * 0.055}" fill="#eef4f8"/>
     <text x="${w * 0.09}" y="${h * 0.15}" ${disp} font-size="${w * 0.05}" fill="#eef4f8">SLOPE</text>
     <text x="${w * 0.09}" y="${h * 0.15 + w * 0.042}" ${mono} font-size="${w * 0.021}" fill="${accent}">it only gets faster</text>`,
  );
}

// ── Cookie Clicker — the cookie, and the rate under it ────────────────────
function cookieClicker(w: number, h: number): string {
  const accent = '#c98b4a';
  // The real screen is a cookie on the left and a buy list on the right, and
  // it is the buy list that makes it a game rather than a button. The first
  // version drew only the cookie, which read as a flat brown disc.
  const cx = w * 0.31, cy = h * 0.46;
  const r = Math.min(w, h) * 0.2;
  const chips = Array.from({ length: 11 }, (_, i) => {
    const a = i * 2.399;
    const d = r * 0.72 * Math.sqrt(i / 11);
    return `<circle cx="${cx + Math.cos(a) * d}" cy="${cy + Math.sin(a) * d}" r="${r * (0.075 + (i % 3) * 0.022)}" fill="#5c3a1e"/>`;
  }).join('');

  const shop: [string, string, string][] = [
    ['cursor', '218', '15'],
    ['grandma', '1.1K', '8'],
    ['farm', '12K', '3'],
    ['mine', '130K', '1'],
  ];
  const sx = w * 0.56;
  const sw = w * 0.36;
  const top = h * 0.34;
  const rowH = h * 0.082;
  const rows = shop
    .map(([name, price, owned], i) => {
      const y = top + i * rowH;
      return `<rect x="${sx}" y="${y}" width="${sw}" height="${rowH * 0.82}" rx="${w * 0.008}" fill="#2a1a0d" stroke="#4a3018" stroke-width="1"/>
        <rect x="${sx}" y="${y}" width="${w * 0.006}" height="${rowH * 0.82}" fill="${accent}" opacity="0.8"/>
        <text x="${sx + w * 0.028}" y="${y + rowH * 0.36}" ${mono} font-size="${w * 0.021}" fill="#f3e3cf">${name}</text>
        <text x="${sx + w * 0.028}" y="${y + rowH * 0.66}" ${mono} font-size="${w * 0.017}" fill="${accent}">${price}</text>
        <text x="${sx + sw - w * 0.022}" y="${y + rowH * 0.52}" ${mono} font-size="${w * 0.027}" fill="#8a5c2c" text-anchor="end">${owned}</text>`;
    })
    .join('');

  return shell(
    w, h, accent,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}" opacity="0.92"/>
     <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#8a5c2c" stroke-width="${r * 0.07}"/>
     ${chips}
     ${rows}
     <text x="${w * 0.09}" y="${h * 0.15}" ${disp} font-size="${w * 0.046}" fill="#f3e3cf">COOKIE CLICKER</text>
     <text x="${w * 0.09}" y="${h * 0.15 + w * 0.04}" ${mono} font-size="${w * 0.02}" fill="${accent}">1.4 million per second</text>
     <text x="${cx}" y="${cy + r + h * 0.075}" ${mono} font-size="${w * 0.022}" fill="#8a5c2c" text-anchor="middle">click</text>`,
  );
}

// ── Run 3 — the tunnel floor, and the holes you have to go round ─────────
// The first version drew concentric hexagon outlines, which said "abstract
// tunnel" but nothing about the game. Run 3 is a perspective floor of square
// tiles with gaps in it: fall through one and you lose. So: the floor, the
// gaps, and the runner about to meet them.
function run3(w: number, h: number): string {
  const accent = '#a06ff0';
  const vx = w * 0.5;          // vanishing point
  const vy = h * 0.34;
  const cols = 7;
  const rows = 8;
  // Missing tiles, fixed rather than random so the cover is reproducible.
  const holes = new Set(['2,1', '4,2', '1,3', '5,4', '3,5', '6,5', '2,6']);

  // Each row is a horizontal band of the floor; nearer rows are taller and
  // wider, which is the whole of the perspective.
  const tiles: string[] = [];
  for (let r = 0; r < rows; r++) {
    const t0 = r / rows;
    const t1 = (r + 1) / rows;
    const scale = (t: number) => Math.pow(t, 1.9);
    const y0 = vy + (h * 0.62) * scale(t0);
    const y1 = vy + (h * 0.62) * scale(t1);
    const halfW0 = (w * 0.52) * scale(t0);
    const halfW1 = (w * 0.52) * scale(t1);
    for (let c = 0; c < cols; c++) {
      if (holes.has(`${c},${r}`)) continue;
      const f0 = c / cols - 0.5;
      const f1 = (c + 1) / cols - 0.5;
      const pts = [
        `${vx + halfW0 * f0 * 2},${y0}`,
        `${vx + halfW0 * f1 * 2},${y0}`,
        `${vx + halfW1 * f1 * 2},${y1}`,
        `${vx + halfW1 * f0 * 2},${y1}`,
      ].join(' ');
      const lit = 0.16 + t1 * 0.5 + ((c + r) % 2) * 0.1;
      tiles.push(
        `<polygon points="${pts}" fill="${accent}" opacity="${lit.toFixed(3)}" stroke="#d9c8ff" stroke-opacity="${(0.1 + t1 * 0.28).toFixed(3)}" stroke-width="1"/>`,
      );
    }
  }

  // The runner, a few rows in, mid-stride.
  const rx = vx - w * 0.1;
  const ry = vy + h * 0.62 * Math.pow(0.62, 1.9);
  const s = Math.min(w, h) * 0.05;
  const runner = `
    <ellipse cx="${rx}" cy="${ry + s * 0.15}" rx="${s * 0.8}" ry="${s * 0.2}" fill="#000" opacity="0.45"/>
    <circle cx="${rx}" cy="${ry - s * 1.55}" r="${s * 0.42}" fill="#f0ecfa"/>
    <rect x="${rx - s * 0.3}" y="${ry - s * 1.15}" width="${s * 0.6}" height="${s * 0.85}" rx="${s * 0.2}" fill="#f0ecfa"/>
    <rect x="${rx - s * 0.5}" y="${ry - s * 0.3}" width="${s * 0.26}" height="${s * 0.42}" fill="#c9b6ef"/>
    <rect x="${rx + s * 0.2}" y="${ry - s * 0.32}" width="${s * 0.26}" height="${s * 0.44}" fill="#c9b6ef"/>`;

  return shell(
    w, h, accent,
    `${tiles.join('')}
     ${runner}
     <text x="${w * 0.09}" y="${h * 0.15}" ${disp} font-size="${w * 0.05}" fill="#efe7fb">RUN 3</text>
     <text x="${w * 0.09}" y="${h * 0.15 + w * 0.042}" ${mono} font-size="${w * 0.021}" fill="${accent}">the floor is optional</text>`,
  );
}

// ── Duck Life — the four things you train ─────────────────────────────────
function duckLife(w: number, h: number): string {
  const accent = '#a8d13c';
  const stats: [string, number][] = [
    ['running', 0.86],
    ['flying', 0.62],
    ['swimming', 0.41],
    ['jumping', 0.73],
  ];
  const barX = w * 0.1;
  const barW = w * 0.8;
  const top = h * 0.6;
  const rowH = h * 0.075;
  const bars = stats
    .map(([label, v], i) => {
      const y = top + i * rowH;
      return `<text x="${barX}" y="${y - h * 0.012}" ${mono} font-size="${w * 0.02}" fill="#9aa87a">${label}</text>
        <rect x="${barX}" y="${y}" width="${barW}" height="${h * 0.018}" rx="${h * 0.009}" fill="#2b3320"/>
        <rect x="${barX}" y="${y}" width="${barW * v}" height="${h * 0.018}" rx="${h * 0.009}" fill="${accent}" opacity="${0.55 + v * 0.4}"/>`;
    })
    .join('');
  // The training screen, not a mascot portrait: the duck is running on a
  // track with hurdles behind it and the stat panel below, which is what the
  // player actually looks at. The first version was a flat cartoon duck
  // floating on the accent colour, which read as clip art next to the rest of
  // the shelf.
  const groundY = h * 0.5;
  const bx = w * 0.34, by = groundY - Math.min(w, h) * 0.08, s = Math.min(w, h) * 0.1;
  const track = `
    <rect x="0" y="${groundY}" width="${w}" height="${h * 0.06}" fill="#2b3320"/>
    <rect x="0" y="${groundY}" width="${w}" height="${h * 0.006}" fill="${accent}" opacity="0.7"/>
    ${Array.from({ length: 8 }, (_, i) =>
      `<rect x="${w * (0.04 + i * 0.125)}" y="${groundY + h * 0.024}" width="${w * 0.05}" height="${h * 0.006}" fill="${accent}" opacity="0.22"/>`).join('')}
    ${[0.62, 0.82].map((fx) =>
      `<rect x="${w * fx}" y="${groundY - h * 0.075}" width="${w * 0.012}" height="${h * 0.075}" fill="#5d6b3f"/>
       <rect x="${w * fx - w * 0.016}" y="${groundY - h * 0.078}" width="${w * 0.044}" height="${h * 0.011}" fill="#8ea355"/>`).join('')}`;
  const duck = `
    <ellipse cx="${bx}" cy="${groundY + h * 0.004}" rx="${s * 1.1}" ry="${s * 0.16}" fill="#000" opacity="0.4"/>
    <ellipse cx="${bx}" cy="${by + s * 0.35}" rx="${s * 1.05}" ry="${s * 0.7}" fill="${accent}"/>
    <path d="M ${bx - s * 0.9} ${by + s * 0.3} q ${s * 0.5} ${s * 0.5} ${s * 1.1} ${s * 0.2}" fill="none" stroke="#7f9a34" stroke-width="${s * 0.16}"/>
    <circle cx="${bx + s * 0.74}" cy="${by - s * 0.42}" r="${s * 0.5}" fill="${accent}"/>
    <circle cx="${bx + s * 0.9}" cy="${by - s * 0.54}" r="${s * 0.09}" fill="#1f2714"/>
    <path d="M ${bx + s * 1.18} ${by - s * 0.4} L ${bx + s * 1.66} ${by - s * 0.28} L ${bx + s * 1.16} ${by - s * 0.1} Z" fill="#e0a53d"/>
    <rect x="${bx - s * 0.32}" y="${by + s * 0.95}" width="${s * 0.16}" height="${s * 0.5}" fill="#e0a53d"/>
    <rect x="${bx + s * 0.24}" y="${by + s * 0.95}" width="${s * 0.16}" height="${s * 0.34}" fill="#c98f2f"/>`;
  return shell(
    w, h, accent,
    `${track}
     ${duck}
     <text x="${w * 0.09}" y="${h * 0.15}" ${disp} font-size="${w * 0.05}" fill="#eef5dc">DUCK LIFE</text>
     <text x="${w * 0.09}" y="${h * 0.15 + w * 0.042}" ${mono} font-size="${w * 0.021}" fill="${accent}">train it, race it, win the cup</text>
     ${bars}`,
  );
}

const GAMES: { slug: string; draw: (w: number, h: number) => string }[] = [
  { slug: 'kittens-game', draw: kittensGame },
  { slug: 'trimps', draw: trimps },
  { slug: 'the-prestige-tree', draw: prestigeTree },
  { slug: 'distance-incremental', draw: distanceIncremental },
  { slug: 'a-dark-room', draw: aDarkRoom },
  { slug: 'sandboxels', draw: sandboxels },
  { slug: 'micropolis-js', draw: micropolisJs },
  { slug: 'untrusted', draw: untrusted },
  { slug: 'cube-composer', draw: cubeComposer },
  { slug: 'candy-box-2', draw: candyBox2 },
  { slug: 'universal-paperclips', draw: universalPaperclips },
  { slug: 'slope', draw: slope },
  { slug: 'cookie-clicker', draw: cookieClicker },
  { slug: 'run-3', draw: run3 },
  { slug: 'duck-life', draw: duckLife },
];

await mkdir('public/covers', { recursive: true });
for (const g of GAMES) {
  await writeFile(`public/covers/${g.slug}-capsule.svg`, g.draw(CW, CH), 'utf8');
  await writeFile(`public/covers/${g.slug}-hero.svg`, g.draw(HW, HH), 'utf8');
}
console.log(`  ✓ ${GAMES.length * 2} original covers written to public/covers/`);
