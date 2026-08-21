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
 *  2. Three star layers, each a <canvas> drawn ONCE on mount and then only
 *     ever moved with `transform: translate3d(...)` — a compositor-only
 *     operation. There is no per-frame redraw of stars at all, which is
 *     what keeps this cheap enough for a Chromebook: the rAF loop below
 *     does a handful of multiplications and three style writes, nothing
 *     that touches a pixel.
 *
 * A handful of bright "twinkle" stars are separate elements animated by
 * CSS `@keyframes`, which the compositor also runs off the main thread —
 * cheaper than redrawing pixels in canvas for the same visual effect.
 *
 * Degrades to the static nebula alone under `prefers-reduced-motion`, if
 * `getContext('2d')` is unavailable, and — via `playerState` — while a game
 * is actually running, so a Chromebook's spare cycles go to the game.
 */
const LAYERS = [
  { count: 130, min: 0.6, max: 1.3, opMin: 0.22, opMax: 0.5, parX: 14, parY: 10 },
  { count: 80, min: 1.0, max: 1.8, opMin: 0.32, opMax: 0.68, parX: 30, parY: 20 },
  { count: 36, min: 1.4, max: 2.4, opMin: 0.5, opMax: 0.9, parX: 52, parY: 34 },
] as const;

const TWINKLE_COUNT = 20;

export default function Galaxy() {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const twinkleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return; // static nebula only

    const dpr = 1; // stars don't benefit from retina; capped regardless of device
    const w = Math.ceil(window.innerWidth * 1.5);
    const h = Math.ceil(window.innerHeight * 1.5);

    let allContextsOk = true;
    LAYERS.forEach((layer, i) => {
      const canvas = canvasRefs.current[i];
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) { allContextsOk = false; return; }
      canvas.width = w * dpr;
      canvas.height = h * dpr;
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
    if (!allContextsOk) return; // CSS nebula still renders; nothing else to do

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
    };
    const onScroll = () => { scrollY = window.scrollY; };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    // Start/stop rather than "loop forever but skip work": while a game is
    // running or the tab is hidden, no rAF callback fires at all.
    let rafId = 0;
    const tick = () => {
      smoothed.x += (pointer.x - smoothed.x) * 0.04;
      smoothed.y += (pointer.y - smoothed.y) * 0.04;
      smoothed.scroll += (scrollY - smoothed.scroll) * 0.06;

      LAYERS.forEach((layer, i) => {
        const canvas = canvasRefs.current[i];
        if (!canvas) return;
        const dx = smoothed.x * layer.parX;
        const dy = smoothed.y * layer.parY - smoothed.scroll * (0.01 + i * 0.015);
        canvas.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      });
      rafId = requestAnimationFrame(tick);
    };
    const start = () => { if (!rafId) rafId = requestAnimationFrame(tick); };
    const stop = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } };

    const sync = () => ((!document.hidden && !isPlaying()) ? start() : stop());
    document.addEventListener('visibilitychange', sync);
    const unsubPlaying = subscribePlaying(sync);
    sync();

    return () => {
      stop();
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
          className="absolute -inset-[25%]"
          style={{ willChange: 'transform' }}
        />
      ))}
      <div ref={twinkleRef} className="absolute inset-0" />
    </div>
  );
}
