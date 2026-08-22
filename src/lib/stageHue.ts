/**
 * Drives the nebula's hover-tint. A capsule calls `setStageHue(accentHex)` on
 * hover/focus; the Galaxy background never has to know which game is hovered
 * — it just reads the CSS custom property everything already flows through.
 *
 * The actual tween is CSS's job (`@property --stage-hue` in theme.css makes
 * the browser interpolate it natively), so this module does one thing: turn
 * a hex accent into a hue angle and write it to .nebula.
 *
 * Written to `.nebula` specifically, not `document.documentElement` — an
 * earlier version set it on the root with `inherits: true`, which meant the
 * 900ms tween invalidated style for the whole document every frame (~4s of
 * recalc during a hover sweep, measured). Scoping both the property write
 * and its `transition` to the one element that actually uses it dropped that
 * to the cost of recalculating .nebula alone.
 */

// The sky's resting hue — matches @property's initial-value in theme.css.
// Was 262 (violet), which put the most-seen state of the environment outside
// the emerald identity entirely; a hover then read as "leaving the house
// colour" rather than "arriving at this game's colour". 168 sits in the same
// teal-green family as --color-emerald (hue ~151) without matching it
// exactly — close enough to read as "at home", distinct enough that a hover
// still visibly moves.
const DEFAULT_HUE = 168;

export function setStageHue(hex: string | null): void {
  const nebula = document.querySelector<HTMLElement>('.nebula');
  nebula?.style.setProperty('--stage-hue', String(hex ? hexToHue(hex) : DEFAULT_HUE));
}

function hexToHue(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return DEFAULT_HUE; // grey accents fall back rather than jump to red (hue 0)

  let h: number;
  switch (max) {
    case r: h = ((g - b) / d) % 6; break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  h *= 60;
  return h < 0 ? h + 360 : h;
}
