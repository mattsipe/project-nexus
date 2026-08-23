/**
 * Generate the complete sprite set for public/play/flappy/.
 *
 * Why this exists: nebez/floppybird is Apache-2.0 on Nebez's *code*, and its
 * physics is the reason we vendored it — gravity, flap impulse, pipe gap and
 * scroll speed are the faithful part, and those are code. Its assets/ folder,
 * though, is the original Flappy Bird sprite and sound set. Its own README
 * calls the project a "vintage knockoff". Dong Nguyen never granted
 * redistribution rights to that art, and an Apache-2.0 licence on a repository
 * cannot grant rights to material its author did not own. Shipping it would
 * break hard rule 2 in CLAUDE.md.
 *
 * So every sprite the game loads is drawn here instead, in Project Nexus's own
 * palette, at exactly the dimensions css/main.css and js/main.js expect. The
 * result is the same game, legitimately.
 *
 * Digits are drawn as seven-segment glyphs rather than set in a typeface: no
 * font dependency at render time, and they read as instrument data, which is
 * the same reason the site sets every number in IBM Plex Mono.
 *
 * Usage:  node --experimental-strip-types scripts/make-flappy-art.ts
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = join('public', 'play', 'flappy', 'assets');

// src/styles/theme.css, inlined — this art ships inside an iframe that never
// sees the parent document's custom properties.
const INK = '#060e0f';
const SURFACE = '#0b1416';
const RAISED = '#122220';
const EDGE = '#1f3330';
const EDGE_STRONG = '#2d4a45';
const EMERALD = '#2ada86';
const EMERALD_DIM = '#1ea968';
const AMBER = '#ffb020';
const TEXT = '#d6e5e2';
const TEXT_DIM = '#7c9490';
const GROUND = '#020a09';

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`;

async function png(name: string, w: number, h: number, body: string): Promise<void> {
  await sharp(Buffer.from(svg(w, h, body))).png().toFile(join(OUT, name));
}

/* ── the bird ──────────────────────────────────────────────────────────────
   34x96: four 34x24 frames stacked, cycled by the CSS `animation` keyframes.
   Not a bird — a small emerald craft, which is what the rest of the site's
   world is made of. The wing is the only thing that moves between frames, so
   the flap still reads at 34px. */
function craft(wingY: number, wingH: number): string {
  return `
    <rect x="4" y="7" width="23" height="11" rx="3" fill="${EMERALD}"/>
    <rect x="4" y="14" width="23" height="4" rx="2" fill="${EMERALD_DIM}"/>
    <rect x="24" y="6" width="8" height="9" rx="3" fill="${EMERALD}"/>
    <rect x="28" y="8" width="3" height="4" fill="${INK}"/>
    <rect x="31" y="10" width="3" height="3" fill="${AMBER}"/>
    <rect x="1" y="9" width="6" height="7" rx="2" fill="${EMERALD_DIM}"/>
    <rect x="9" y="${wingY}" width="13" height="${wingH}" rx="2" fill="${TEXT}"/>
    <rect x="10" y="${wingY + 1}" width="11" height="${Math.max(1, wingH - 2)}" fill="${EMERALD_DIM}"/>`;
}

async function bird(): Promise<void> {
  // wing up → level → down → level, so the loop reads as a flap not a jitter
  const frames = [[1, 8], [9, 5], [17, 6], [9, 5]] as const;
  const body = frames
    .map(([y, h], i) => `<g transform="translate(0 ${i * 24})">${craft(y, h)}</g>`)
    .join('');
  await png('bird.png', 34, 96, body);
}

/* ── scrolling scenery ─────────────────────────────────────────────────────
   Each of these tiles horizontally and is scrolled by CSS keyframes, so the
   left and right edges have to meet. Everything is drawn to repeat at the
   width the existing keyframes already scroll by (336 land, 276 sky, 64
   ceiling) — changing those sizes would desynchronise the animation. */
async function scenery(): Promise<void> {
  // Sky: the galaxy, seen from inside it. Fixed star positions rather than
  // random ones, so re-running this script produces an identical file.
  const stars = [
    [14, 18], [47, 61], [78, 12], [103, 44], [131, 77], [158, 25],
    [186, 55], [204, 15], [231, 68], [252, 34], [268, 88], [92, 92],
    [39, 96], [172, 100], [122, 8], [219, 96],
  ]
    .map(([x, y], i) => `<rect x="${x}" y="${y}" width="${i % 3 ? 1 : 2}" height="${i % 3 ? 1 : 2}" fill="${i % 4 ? EDGE_STRONG : TEXT_DIM}"/>`)
    .join('');
  await png('sky.png', 276, 109, `
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK}"/><stop offset="1" stop-color="${SURFACE}"/>
    </linearGradient></defs>
    <rect width="276" height="109" fill="url(#s)"/>${stars}`);

  // Ceiling: a machined edge, so the top of the play area reads as a limit.
  const rivets = Array.from({ length: 4 }, (_, i) =>
    `<rect x="${8 + i * 16}" y="6" width="3" height="3" fill="${EDGE_STRONG}"/>`).join('');
  await png('ceiling.png', 64, 16, `
    <rect width="64" height="16" fill="${SURFACE}"/>
    <rect y="13" width="64" height="3" fill="${EDGE}"/>${rivets}`);

  // Land: the horizon plane the galaxy already uses, with an emerald rim-light
  // along its leading edge.
  const hatch = Array.from({ length: 14 }, (_, i) =>
    `<rect x="${i * 24}" y="16" width="12" height="4" fill="${EDGE}"/>`).join('');
  await png('land.png', 336, 112, `
    <rect width="336" height="112" fill="${GROUND}"/>
    <rect width="336" height="3" fill="${EMERALD_DIM}"/>
    <rect y="3" width="336" height="10" fill="${RAISED}"/>${hatch}`);
}

/* ── pipes ─────────────────────────────────────────────────────────────────
   pipe.png is a 52x1 sliver stretched to whatever height the gap needs, so it
   can only be a horizontal cross-section. The caps are 52x26. */
async function pipes(): Promise<void> {
  const BODY = '#24413c';   // lighter than --color-raised: a pipe has to read
  const SHEEN = '#37605a';  // as a solid object against the night sky
  const column = `
    <rect width="52" height="1" fill="${BODY}"/>
    <rect x="6" width="4" height="1" fill="${SHEEN}"/>
    <rect x="44" width="4" height="1" fill="${INK}"/>`;
  await png('pipe.png', 52, 1, column);

  const cap = (rimAtTop: boolean) => `
    <rect width="52" height="26" fill="${BODY}"/>
    <rect x="6" width="4" height="26" fill="${SHEEN}"/>
    <rect x="44" width="4" height="26" fill="${INK}"/>
    <rect x="0" y="${rimAtTop ? 0 : 22}" width="52" height="4" fill="${EMERALD}"/>
    <rect x="0" y="${rimAtTop ? 4 : 19}" width="52" height="3" fill="${INK}"/>`;
  // pipe-down caps the pipe hanging from the ceiling: its rim is at the bottom.
  await png('pipe-down.png', 52, 26, cap(false));
  // pipe-up caps the pipe rising from the ground: its rim is at the top.
  await png('pipe-up.png', 52, 26, cap(true));
}

/* ── seven-segment digits ──────────────────────────────────────────────────
   font_big_N.png is 24x36 and font_small_N.png is 12x14; js/main.js builds
   score readouts by concatenating these as <img>. */
const SEGMENTS: Record<string, string[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
};

function digit(n: string, w: number, h: number, t: number, colour: string): string {
  const p = t; // padding equals stroke thickness, which keeps corners square
  const midY = (h - t) / 2;
  const rects: Record<string, [number, number, number, number]> = {
    a: [p, 0, w - 2 * p, t],
    b: [w - t, p, t, midY - p],
    c: [w - t, midY + t, t, midY - p],
    d: [p, h - t, w - 2 * p, t],
    e: [0, midY + t, t, midY - p],
    f: [0, p, t, midY - p],
    g: [p, midY, w - 2 * p, t],
  };
  return SEGMENTS[n]!
    .map((s) => {
      const [x, y, rw, rh] = rects[s]!;
      return `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${colour}"/>`;
    })
    .join('');
}

async function digits(): Promise<void> {
  for (const n of Object.keys(SEGMENTS)) {
    await png(`font_big_${n}.png`, 24, 36, digit(n, 24, 36, 5, TEXT));
    await png(`font_small_${n}.png`, 12, 14, digit(n, 12, 14, 2, EMERALD));
  }
}

/* ── panels ────────────────────────────────────────────────────────────────
   These carry words, and the words are the game's own UI copy. Drawn as
   shapes plus seven-segment-free lettering would be unreadable, so the two
   that need text use simple block letterforms built from rectangles. */

/** Tiny 5x7 block alphabet — enough for the handful of words the UI needs. */
const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '10000', '10000', '11111'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  F: ['11111', '10000', '11110', '10000', '10000', '10000', '10000'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  ' ': ['0', '0', '0', '0', '0', '0', '0'],
};

/** Render `text` at `scale` px per cell, returning svg and its pixel width. */
function label(text: string, x: number, y: number, scale: number, colour: string): { svg: string; width: number } {
  let cursor = 0;
  const parts: string[] = [];
  for (const ch of text.toUpperCase()) {
    const rows = GLYPHS[ch] ?? GLYPHS[' ']!;
    rows.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell === '1') {
          parts.push(
            `<rect x="${x + (cursor + rx) * scale}" y="${y + ry * scale}" width="${scale}" height="${scale}" fill="${colour}"/>`,
          );
        }
      });
    });
    cursor += (rows[0]!.length) + 1;
  }
  return { svg: parts.join(''), width: cursor * scale };
}

/**
 * Centre `text` inside a box of width `boxW`.
 *
 * Throws rather than overflowing: these sprites are fixed-size, so a string
 * that is too wide for its panel is silently clipped at both ends, and
 * "GET READY" arrives as "ET READ". Better to fail the build.
 */
function centred(text: string, boxW: number, y: number, scale: number, colour: string): string {
  const measured = label(text, 0, 0, scale, colour).width - scale;
  if (measured > boxW - 8) {
    throw new Error(
      `"${text}" is ${measured}px at scale ${scale}, too wide for a ${boxW}px panel. ` +
        'Shorten it or drop a scale step.',
    );
  }
  return label(text, Math.round((boxW - measured) / 2), y, scale, colour).svg;
}

async function panels(): Promise<void> {
  // Splash — the "get ready" card.
  await png('splash.png', 188, 170, `
    <rect x="2" y="2" width="184" height="166" rx="8" fill="${SURFACE}" stroke="${EDGE_STRONG}" stroke-width="2"/>
    ${centred('GET READY', 188, 26, 3, TEXT)}
    ${centred('PRESS SPACE', 188, 126, 2, TEXT_DIM)}
    ${centred('OR TAP', 188, 146, 2, TEXT_DIM)}
    <g transform="translate(77 66) scale(1.1)">${craft(10, 4)}</g>
    <rect x="60" y="106" width="68" height="2" fill="${EMERALD_DIM}"/>`);

  // Scoreboard — shown on death. main.js positions #currentscore, #highscore
  // and #medal over this, so those areas are left clear.
  await png('scoreboard.png', 236, 280, `
    <rect x="2" y="2" width="232" height="276" rx="10" fill="${SURFACE}" stroke="${EDGE_STRONG}" stroke-width="2"/>
    ${centred('GAME OVER', 236, 24, 3, TEXT)}
    <rect x="24" y="62" width="188" height="2" fill="${EDGE}"/>
    ${label('SCORE', 34, 92, 2, TEXT_DIM).svg}
    ${label('BEST', 34, 140, 2, TEXT_DIM).svg}
    <rect x="24" y="188" width="188" height="2" fill="${EDGE}"/>`);

  // Replay button. CSS sizes this box 70 wide by 115 tall; the source image is
  // 115x70 and is scaled into it, so the artwork is drawn to the file's own
  // proportions and simply reads as a wide button.
  await png('replay.png', 115, 70, `
    <rect x="3" y="3" width="109" height="64" rx="10" fill="${EMERALD}"/>
    <rect x="3" y="3" width="109" height="60" rx="10" fill="${EMERALD}"/>
    ${centred('REPLAY', 115, 27, 3, INK)}`);

  // Medals. Four tiers, distinguished by rim colour and pip count rather than
  // by a metal gradient, which would not survive 44px.
  const medals: [string, string, number][] = [
    ['bronze', '#b0714a', 1],
    ['silver', '#9fb0b3', 2],
    ['gold', AMBER, 3],
    ['platinum', EMERALD, 4],
  ];
  for (const [name, colour, pips] of medals) {
    const dots = Array.from({ length: pips }, (_, i) =>
      `<rect x="${22 - pips * 3 + i * 6}" y="21" width="3" height="3" fill="${colour}"/>`).join('');
    await png(`medal_${name}.png`, 44, 44, `
      <circle cx="22" cy="22" r="19" fill="${RAISED}" stroke="${colour}" stroke-width="3"/>
      <circle cx="22" cy="22" r="12" fill="none" stroke="${EDGE_STRONG}" stroke-width="1"/>
      ${dots}`);
  }

  // thumb.png is the repo's social-preview image, not used by the game, but
  // index.html links it — redrawn rather than left as the original artwork.
  await png('thumb.png', 200, 200, `
    <rect width="200" height="200" fill="${INK}"/>
    <rect y="150" width="200" height="50" fill="${GROUND}"/>
    <rect y="150" width="200" height="2" fill="${EMERALD_DIM}"/>
    <g transform="translate(70 80) scale(2)">${craft(10, 4)}</g>`);
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  await bird();
  await scenery();
  await pipes();
  await digits();
  await panels();
  // A silent placeholder is not needed: main.js is patched to skip audio
  // entirely, so no sound files are written. See NEXUS-MODIFICATIONS.txt.
  await writeFile(
    join(OUT, 'README-NEXUS.txt'),
    'Every image in this directory is generated by scripts/make-flappy-art.ts\n' +
      'and is original to Project Nexus. The upstream repository\'s own assets\n' +
      'were the original Flappy Bird sprite and audio set, which carries no\n' +
      'redistribution grant; none of it ships here. Re-run the script to\n' +
      'regenerate this directory.\n',
  );
  console.log('\n  ✓ flappy sprite set written to ' + OUT + '\n');
}

main().catch((err: unknown) => {
  console.error(`\n  ✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
