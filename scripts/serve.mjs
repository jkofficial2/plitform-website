import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1] || 4321);
const root = resolve(args.includes('--live') ? '.qa-live/dist' : 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    let file = path;
    const info = await stat(file).catch(() => undefined);
    if (info?.isDirectory()) {
      if (!url.pathname.endsWith('/')) { response.writeHead(301, { Location: `${url.pathname}/${url.search}` }).end(); return; }
      file = resolve(file, 'index.html');
    }
    const content = await readFile(file).catch(() => undefined);
    if (!content) {
      response.writeHead(404, { 'Content-Type': types['.html'] });
      response.end(await readFile(resolve(root, '404.html')));
      return;
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(content);
  } catch { response.writeHead(400).end('Bad request'); }
}).listen(port, '127.0.0.1', () => console.log(`Static ${args.includes('--live') ? 'live fixture' : 'demo'}: http://127.0.0.1:${port}`));
