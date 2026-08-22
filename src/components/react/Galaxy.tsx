import { useEffect, useRef } from 'react';
import { isPlaying, subscribePlaying } from '../../lib/playerState.ts';

/**
 * The environment behind the console, not a decoration on top of it.
 *
 * Two layers:
 *  1. A CSS nebula (theme.css `.nebula`) — zero runtime cost, and the
 *     fallback every other layer degrades to. Its hue reads `--stage-hue`,
 *     which capsules update on hover (src/lib/stageHue.ts); the browser
 *     tweens it natively via `@property`, so nothing here has to.
 *  2. Two star layers, each a <canvas> drawn ONCE on mount and then only
 *     ever moved with `transform: translate3d(...)` — a compositor-only
 *     operation. There is no per-frame redraw of stars at all.
 *
 * This used to be three layers sized at 1.5x the viewport in both
 * dimensions (~7 Mpx / 27MB of permanently GPU-resident texture, for a
 * parallax range that never exceeds ~120px). Measured under a 4x CPU
 * throttle, that alone cost the difference between 20fps and 60fps during a
 * hover sweep — two layers sized to just cover the parallax travel
 * (viewport + a fixed overscan margin) removed it. See docs/DECISIONS.md.
 *
 * A handful of bright "twinkle" stars are separate elements animated by
 * CSS `@keyframes`, which the compositor also runs off the main thread —
 * cheaper than redrawing pixels in canvas for the same visual effect.
 *
 * Degrades to the static nebula alone under `prefers-reduced-motion`, if
 * `getContext('2d')` is unavailable, and — via `playerState` — while a game
 * is actually running, so a Chromebook's spare cycles go to the game. The
 * rAF loop also idles itself out once the pointer/scroll settle, rather
 * than ticking forever at a fixed cost regardless of whether anything is
 * actually moving.
 */
const LAYERS = [
  // Back: numerous, dim, slow — the bulk of the field.
  { count: 170, min: 0.6, max: 1.4, opMin: 0.2, opMax: 0.55, parX: 18, parY: 12 },
  // Near: fewer, brighter, faster — reads as depth against the back layer.
  { count: 70, min: 1.2, max: 2.2, opMin: 0.4, opMax: 0.85, parX: 46, parY: 30 },
] as const;

// How far past the viewport each canvas extends, so the parallax travel
// (bounded by the largest layer's parX/parY above) never exposes an edge.
const OVERSCAN_X = 64;
const OVERSCAN_Y = 128;

const TWINKLE_COUNT = 20;
const SETTLE_EPSILON = 0.03; // below this, pointer/scroll motion counts as "stopped"
const SETTLE_FRAMES = 10; // consecutive still frames before the loop idles out

export default function Galaxy() {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const twinkleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return; // static nebula only

    const dpr = 1; // stars don't benefit from retina; capped regardless of device

    const sizeAndDraw = () => {
      const w = Math.ceil(window.innerWidth + OVERSCAN_X * 2);
      const h = Math.ceil(window.innerHeight + OVERSCAN_Y * 2);
      let allOk = true;
      LAYERS.forEach((layer, i) => {
        const canvas = canvasRefs.current[i];
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) { allOk = false; return; }
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.left = `${-OVERSCAN_X}px`;
        canvas.style.right = `${-OVERSCAN_X}px`;
        canvas.style.top = `${-OVERSCAN_Y}px`;
        canvas.style.bottom = `${-OVERSCAN_Y}px`;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let n = 0; n < layer.count; n++) {
          const x = Math.random() * w;
          const y = Math.random() * h;
          const size = layer.min + Math.random() * (layer.max - layer.min);
          const op = layer.opMin + Math.random() * (layer.opMax - layer.opMin);
          ctx.beginPath();
          ctx.fillStyle = `rgba(236,235,245,${op.toFixed(2)})`;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      return allOk;
    };

    if (!sizeAndDraw()) return; // CSS nebula still renders; nothing else to do

    // Re-lay-out on resize (orientation change, window resize, DevTools
    // docking). A plain debounced `resize` listener is enough here — this
    // reads window.innerWidth/innerHeight directly rather than observing a
    // specific element's box, so a ResizeObserver would be watching the
    // wrong thing.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(sizeAndDraw, 150);
    };
    window.addEventListener('resize', onResize);

    // Twinkle stars: built imperatively (not JSX) so their randomised
    // positions never have to round-trip through server-rendered HTML.
    if (twinkleRef.current) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < TWINKLE_COUNT; i++) {
        const star = document.createElement('span');
        star.className = 'twinkle-star';
        star.style.top = `${Math.random() * 100}%`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.animationDelay = `${-Math.random() * 6}s`;
        frag.appendChild(star);
      }
      twinkleRef.current.appendChild(frag);
    }

    const pointer = { x: 0, y: 0 };
    const smoothed = { x: 0, y: 0, scroll: 0 };
    let scrollY = window.scrollY;

    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
      maybeStart();
    };
    const onScroll = () => { scrollY = window.scrollY; maybeStart(); };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    // Start/stop rather than "loop forever but skip work": while a game is
    // running, the tab is hidden, or the scene has visibly settled, no rAF
    // callback fires at all.
    let rafId = 0;
    let stillFrames = 0;
    const tick = () => {
      const dx = pointer.x - smoothed.x;
      const dy = pointer.y - smoothed.y;
      const dScroll = scrollY - smoothed.scroll;
      smoothed.x += dx * 0.04;
      smoothed.y += dy * 0.04;
      smoothed.scroll += dScroll * 0.06;

      LAYERS.forEach((layer, i) => {
        const canvas = canvasRefs.current[i];
        if (!canvas) return;
        const tx = smoothed.x * layer.parX;
        const ty = smoothed.y * layer.parY - smoothed.scroll * (0.01 + i * 0.02);
        canvas.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      });

      const settled = Math.abs(dx) < SETTLE_EPSILON && Math.abs(dy) < SETTLE_EPSILON && Math.abs(dScroll) < 0.5;
      stillFrames = settled ? stillFrames + 1 : 0;
      if (stillFrames >= SETTLE_FRAMES) { rafId = 0; return; } // idle out — a pointermove/scroll restarts it
      rafId = requestAnimationFrame(tick);
    };
    const start = () => { if (!rafId) { stillFrames = 0; rafId = requestAnimationFrame(tick); } };
    const stop = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } };
    const maybeStart = () => { if (!document.hidden && !isPlaying()) start(); };

    const sync = () => ((!document.hidden && !isPlaying()) ? start() : stop());
    document.addEventListener('visibilitychange', sync);
    const unsubPlaying = subscribePlaying(sync);
    sync();

    return () => {
      stop();
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', sync);
      unsubPlaying();
    };
  }, []);

  return (
    <div className="sky fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="nebula absolute inset-0" />
      {LAYERS.map((_, i) => (
        <canvas
          key={i}
          ref={(el) => { canvasRefs.current[i] = el; }}
          className="absolute"
          style={{ willChange: 'transform' }}
        />
      ))}
      <div ref={twinkleRef} className="absolute inset-0" />
    </div>
  );
}
