// Local preview only. Static file server for the built site.  node serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
// fileURLToPath handles the drive letter and percent-encoding; the hand-rolled regex broke on
// any path containing a space, which is most of them on Windows.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.txt':'text/plain', '.svg':'image/svg+xml', '.css':'text/css', '.woff2':'font/woff2',
  '.xml':'application/xml' };
http.createServer((req, res) => {
  // a bare % makes decodeURIComponent throw, the handler rejects and the request never gets a
  // reply - the browser just hangs. Answer 400 instead.
  let rel;
  // Pages serves dir/ as dir/index.html, and the share pages under p/<id>/ are only reachable
  // that way. A preview server that does not do the same hides a broken link until it is live.
  try { rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'; }
  catch { res.writeHead(400); return res.end('bad url'); }
  if (rel.split(/[\\/]/).some(p => p.startsWith('.') || ['node_modules', '_src', '_cand'].includes(p))) {
    res.writeHead(403).end('private path'); return;
  }
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, rel);
  // ROOT + separator, or a sibling folder whose name merely starts with ROOT's would pass the prefix test
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end('no'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /\.(html|js|json|css|svg|xml)$/.test(file);
    if (gzip) buf = gzipSync(buf);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'x-content-type-options':'nosniff', 'referrer-policy':'strict-origin-when-cross-origin',
      ...(gzip ? {'content-encoding':'gzip','vary':'Accept-Encoding'} : {}) });
    res.end(buf);
  });
}).listen(Number(process.env.PORT || process.argv[2]) || 8814, '127.0.0.1', () => console.log('serving', ROOT, 'on', Number(process.env.PORT || process.argv[2]) || 8814));
