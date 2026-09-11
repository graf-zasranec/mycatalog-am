// Local preview only. Static file server for the built site.  node serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// fileURLToPath handles the drive letter and percent-encoding; the hand-rolled regex broke on
// any path containing a space, which is most of them on Windows.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.txt':'text/plain', '.svg':'image/svg+xml' };
http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(ROOT, rel);
  // ROOT + separator, or a sibling folder named MyCatalogSomething would pass the prefix test
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end('no'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(Number(process.env.PORT || process.argv[2]) || 8814, () => console.log('serving', ROOT, 'on', Number(process.env.PORT || process.argv[2]) || 8814));
