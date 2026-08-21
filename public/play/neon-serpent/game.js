/**
 * Neon Serpent — an original game written for Project Nexus.
 * No dependencies, no network, no tracking. Saves only a high score.
 *
 * The one design decision worth explaining: the snake moves on a discrete grid
 * (so collision is exact and fair) but is *drawn* with interpolation between
 * ticks, so it reads as smooth motion rather than the stuttery step of a
 * classic grid snake. Logic ticks and frames are fully decoupled.
 */
(() => {
  'use strict';

  const GRID = 21;
  const BASE_TICK = 150;      // ms per step at speed 1
  const MIN_TICK = 62;        // fastest the snake will ever move
  const SPEED_EVERY = 4;      // pellets per speed increment
  const HIGH_SCORE_KEY = 'neon-serpent:best';

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const speedEl = document.getElementById('speed');
  const overlay = document.getElementById('overlay');
  const overlayText = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start');
  const titleEl = overlay.querySelector('h1');

  /** @type {'idle'|'running'|'paused'|'over'} */
  let state = 'idle';
  let snake, dir, queuedDir, pellet, score, tickMs, lastTick, prevSnake;

  // ── storage is best-effort: a blocked localStorage must not break the game ──
  const store = {
    get() {
      try { return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0; } catch { return 0; }
    },
    set(v) {
      try { localStorage.setItem(HIGH_SCORE_KEY, String(v)); } catch { /* ignore */ }
    },
  };
  let best = store.get();
  bestEl.textContent = best;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  function reset() {
    const mid = Math.floor(GRID / 2);
    snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];
    prevSnake = snake.map((s) => ({ ...s }));
    dir = { x: 1, y: 0 };
    queuedDir = null;
    score = 0;
    tickMs = BASE_TICK;
    lastTick = performance.now();
    placePellet();
    updateHud();
  }

  function placePellet() {
    const free = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    // A full board means the player has genuinely won.
    pellet = free.length ? free[(Math.random() * free.length) | 0] : null;
  }

  function updateHud() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    speedEl.textContent = Math.floor(score / SPEED_EVERY) + 1;
  }

  function step() {
    if (queuedDir) { dir = queuedDir; queuedDir = null; }
    prevSnake = snake.map((s) => ({ ...s }));

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    // The tail tip vacates this tick, so colliding with it is legal.
    const hitSelf = snake.slice(0, -1).some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) return gameOver();

    snake.unshift(head);

    if (pellet && head.x === pellet.x && head.y === pellet.y) {
      score++;
      if (score > best) { best = score; store.set(best); }
      tickMs = Math.max(MIN_TICK, BASE_TICK - Math.floor(score / SPEED_EVERY) * 9);
      placePellet();
      if (!pellet) return win();
      updateHud();
    } else {
      snake.pop();
    }
  }

  function gameOver() {
    state = 'over';
    titleEl.textContent = 'Caught yourself';
    overlayText.textContent = `You scored ${score}. Best is ${best}.`;
    startBtn.textContent = 'Play again';
    overlay.hidden = false;
    startBtn.focus();
  }

  function win() {
    state = 'over';
    titleEl.textContent = 'Board cleared';
    overlayText.textContent = `Every square filled, at ${score}. That is the whole board.`;
    startBtn.textContent = 'Play again';
    overlay.hidden = false;
  }

  // ── rendering ────────────────────────────────────────────────────────────
  function draw(now) {
    const rect = canvas.getBoundingClientRect();
    const cell = rect.width / GRID;
    // 0→1 progress through the current tick, for interpolated drawing.
    const t = state === 'running' ? Math.min(1, (now - lastTick) / tickMs) : 1;

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Lattice
    ctx.strokeStyle = 'rgba(36,40,56,0.55)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, rect.height);
      ctx.moveTo(0, i * cell); ctx.lineTo(rect.width, i * cell);
      ctx.stroke();
    }

    // Pellet, with a gentle pulse so the eye finds it fast.
    if (pellet) {
      const pulse = 1 + Math.sin(now / 260) * 0.13;
      const cx = (pellet.x + 0.5) * cell;
      const cy = (pellet.y + 0.5) * cell;
      ctx.fillStyle = '#ffb020';
      ctx.shadowColor = '#ffb020';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.3 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Body, head brightest and tapering toward the tail.
    ctx.shadowColor = '#35e0d4';
    for (let i = snake.length - 1; i >= 0; i--) {
      const cur = snake[i];
      const prev = prevSnake[i] || cur;
      const x = (prev.x + (cur.x - prev.x) * t) * cell;
      const y = (prev.y + (cur.y - prev.y) * t) * cell;
      const fade = 1 - (i / snake.length) * 0.62;
      ctx.fillStyle = `rgba(53,224,212,${fade})`;
      ctx.shadowBlur = i === 0 ? 20 : 0;
      const pad = cell * 0.09;
      const r = cell * 0.26;
      roundRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2, r);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loop(now) {
    if (state === 'running' && now - lastTick >= tickMs) {
      lastTick = now;
      step();
    }
    draw(now);
    requestAnimationFrame(loop);
  }

  // ── input ────────────────────────────────────────────────────────────────
  const KEYS = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
  };

  function steer(next) {
    // Compare against the direction that will actually apply this tick, so a
    // fast double-tap cannot fold the snake back into its own neck.
    const ref = queuedDir || dir;
    if (next.x === -ref.x && next.y === -ref.y) return;
    queuedDir = next;
  }

  window.addEventListener('keydown', (e) => {
    if (KEYS[e.key]) {
      e.preventDefault();
      if (state === 'running') steer(KEYS[e.key]);
      else if (state === 'idle' || state === 'over') start();
    } else if (e.key === 'p' || e.key === 'P') {
      togglePause();
    } else if (e.key === ' ' && state !== 'running') {
      e.preventDefault();
      start();
    }
  });

  function togglePause() {
    if (state === 'running') {
      state = 'paused';
      titleEl.textContent = 'Paused';
      overlayText.textContent = 'Take your time.';
      startBtn.textContent = 'Resume';
      overlay.hidden = false;
    } else if (state === 'paused') {
      overlay.hidden = true;
      state = 'running';
      lastTick = performance.now();
    }
  }

  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!touchStart || state !== 'running') return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    if (Math.hypot(dx, dy) < 24) return;
    steer(Math.abs(dx) > Math.abs(dy)
      ? { x: Math.sign(dx), y: 0 }
      : { x: 0, y: Math.sign(dy) });
    touchStart = null;
  }, { passive: true });

  function start() {
    if (state === 'paused') return togglePause();
    reset();
    overlay.hidden = true;
    state = 'running';
    lastTick = performance.now();
  }

  startBtn.addEventListener('click', start);

  resize();
  reset();
  requestAnimationFrame(loop);
})();
