// Local preview only. Static file server for the built site.  node serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.txt':'text/plain', '.svg':'image/svg+xml' };
http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }   // no path traversal
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(Number(process.env.PORT || process.argv[2]) || 8814, () => console.log('serving', ROOT, 'on', Number(process.env.PORT || process.argv[2]) || 8814));
