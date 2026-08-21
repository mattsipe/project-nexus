/**
 * Drives the nebula's hover-tint. A capsule calls `setStageHue(accentHex)` on
 * hover/focus; the Galaxy background never has to know which game is hovered
 * — it just reads the CSS custom property everything already flows through.
 *
 * The actual tween is CSS's job (`@property --stage-hue` in theme.css makes
 * the browser interpolate it natively), so this module does one thing: turn
 * a hex accent into a hue angle and write it to the root element.
 */

const DEFAULT_HUE = 262; // the sky's resting violet, matches @property's initial-value

export function setStageHue(hex: string | null): void {
  document.documentElement.style.setProperty(
    '--stage-hue',
    String(hex ? hexToHue(hex) : DEFAULT_HUE),
  );
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
