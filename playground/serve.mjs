// A small static server for the playground: `node serve.mjs [folder] [port]` (default dist 5199).
// Binds 127.0.0.1 only and never serves a file outside the folder.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, sep, extname, join } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 5199);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
// The same policy as the page's own meta tag, read from it so the two never drift.
const page = readFileSync(join(root, 'index.html'), 'utf8');
const CSP = page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
if (!CSP) throw new Error(`no Content-Security-Policy meta in ${join(root, 'index.html')}`);

async function fileFor(url) {
  let path;
  try { path = decodeURIComponent(String(url).split(/[?#]/)[0]); } catch { return null; }
  if (path.includes('\0')) return null;
  let file = resolve(root, '.' + path);
  if (file !== root && !file.startsWith(root + sep)) return null;
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { return null; }
  return TYPES[extname(file)] ? file : null;
}

createServer(async (req, res) => {
  const file = req.method === 'GET' || req.method === 'HEAD' ? await fileFor(req.url) : null;
  const body = file ? await readFile(file).catch(() => null) : null;
  const head = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
  if (!body) { res.writeHead(404, { ...head, 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
  res.writeHead(200, { ...head, 'Content-Type': TYPES[extname(file)] });
  res.end(req.method === 'HEAD' ? undefined : body);
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`));
