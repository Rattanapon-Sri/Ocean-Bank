import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml' };
const publicFiles = new Set(['index.html', 'styles.css', 'app.js', 'bank.mjs', 'config.js', 'favicon.svg']);
http.createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
    if (!publicFiles.has(name)) { response.writeHead(404); response.end('Not found'); return; }
    const body = await readFile(path.join(root, name));
    response.writeHead(200, { 'Content-Type': `${types[path.extname(name)]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(500); response.end('Unable to read file'); }
}).listen(Number(process.env.PORT || 5173), '127.0.0.1', () => console.log(`Ocean Bank: http://127.0.0.1:${process.env.PORT || 5173}`));
