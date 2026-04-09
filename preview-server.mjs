#!/usr/bin/env node
// Serves site/ at /codi/ so the marketing page and docs both work locally.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_DIR = fileURLToPath(new URL('./site', import.meta.url));
const BASE = '/codi';
const PORT = 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};

async function tryFile(path) {
  for (const candidate of [path, `${path}/index.html`, `${path}.html`]) {
    try {
      const s = await stat(candidate);
      if (s.isFile()) return candidate;
    } catch { /* not found */ }
  }
  return null;
}

createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0];

  if (!url.startsWith(BASE)) {
    res.writeHead(301, { Location: `${BASE}/` });
    return res.end();
  }

  const localPath = url.slice(BASE.length) || '/';
  const resolved = await tryFile(join(SITE_DIR, localPath));

  if (!resolved) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404 Not Found');
  }

  const content = await readFile(resolved);
  res.writeHead(200, { 'Content-Type': MIME[extname(resolved)] ?? 'application/octet-stream' });
  res.end(content);
}).listen(PORT, () => {
  console.log(`\n  codi preview server\n`);
  console.log(`  Marketing  http://localhost:${PORT}${BASE}/`);
  console.log(`  Docs       http://localhost:${PORT}${BASE}/docs/`);
  console.log(`  Catalog    http://localhost:${PORT}${BASE}/docs/catalog/\n`);
});
