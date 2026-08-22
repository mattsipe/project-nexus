/**
 * A foreground static server for dist/.
 *
 * `astro preview` daemonises itself in Astro 7, so Playwright's webServer
 * always sees it exit immediately and gives up. This serves the same files in
 * the foreground, with the same trailing-slash behaviour as Netlify, and no
 * extra dependency.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = 'dist';
const PORT = Number(process.env.PORT ?? 4321);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
  '.php': 'text/plain; charset=utf-8',
};

/**
 * Files are cached on first read — without it the server becomes the
 * bottleneck under parallel test workers, and slow responses look like
 * hydration bugs.
 *
 * The cache is keyed on mtime, not just path. Playwright's `reuseExistingServer`
 * is on locally, so a server left running from an earlier session survives the
 * next `npm run build` — and a cache that assumed dist/ was immutable then
 * served the *previous* build to the whole suite. That cost a full debugging
 * detour: nine games' worth of HTML answering a nineteen-game manifest, with
 * every symptom pointing at the site rather than at the server. A stat per
 * request is a rounding error next to a read; correctness is not.
 */
const cache = new Map<string, { mtimeMs: number; buf: Buffer }>();

async function load(file: string): Promise<Buffer> {
  const { mtimeMs } = await stat(file);
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.buf;
  const buf = await readFile(file);
  cache.set(file, { mtimeMs, buf });
  return buf;
}

/**
 * Path resolution is memoised the same way, but a rebuild can add or remove
 * routes as well as change them, so the memo is dropped whenever dist/ itself
 * changes — which it does on every build, since Astro rewrites the directory.
 */
const resolved = new Map<string, string | null>();
let rootMtime = 0;

async function resolve(urlPath: string): Promise<string | null> {
  const { mtimeMs } = await stat(ROOT);
  if (mtimeMs !== rootMtime) {
    resolved.clear();
    rootMtime = mtimeMs;
  }
  const memo = resolved.get(urlPath);
  if (memo !== undefined) return memo;
  const found = await resolveUncached(urlPath);
  resolved.set(urlPath, found);
  return found;
}

async function resolveUncached(urlPath: string): Promise<string | null> {
  // Block traversal above the root before touching the filesystem.
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0]!)).replace(/^(\.\.[/\\])+/, '');
  const candidates = clean.endsWith('/')
    ? [join(ROOT, clean, 'index.html')]
    : [join(ROOT, clean), join(ROOT, clean, 'index.html')];

  for (const c of candidates) {
    try {
      const s = await stat(c);
      if (s.isFile()) return c;
    } catch { /* try the next candidate */ }
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(req.url ?? '/');
  if (!file) {
    const notFound = await resolve('/404.html');
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(notFound ? await load(notFound) : 'Not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
  res.end(await load(file));
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
