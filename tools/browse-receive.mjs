// A doorway for pictures that can only come through a browser.
//
//   node tools/browse-receive.mjs [port]        default 8787
//
// eldorado and zigzag answer this project's fetcher with 403 on their pages and on their image
// CDNs alike, so the bytes have to travel from a browser a person already has open. Downloading
// them is the obvious way and it does not work: a browser lets a site save one file by itself and
// blocks the rest, and a blob much over 6MB never arrives at all. Reading them back through the
// console does not work either - base64 is enormous and would go through the model's context.
//
// So the browser POSTs each picture here instead, and this writes it straight into images/_src
// where the ordinary pipeline picks it up. Nothing is downloaded, nothing is pasted, and the
// bytes never leave the machine.
//
// It listens on localhost only, accepts nothing but images, and stops when you stop it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = +(process.argv[2] || 8787);
const SRC = 'images/_src';
fs.mkdirSync(SRC, { recursive: true });

const EXT = b => (b[0] === 0x89 && b[1] === 0x50) ? 'png'
              : (b[0] === 0xFF && b[1] === 0xD8) ? 'jpg'
              : (b.slice(8, 12).toString('latin1') === 'WEBP') ? 'webp' : null;

let saved = 0, refused = 0;
http.createServer((req, res) => {
  // The page doing the posting is on the shop's origin, so the browser asks first.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method !== 'POST') return res.writeHead(200).end(`saved ${saved}, refused ${refused}`);

  const id = decodeURIComponent((req.url || '').replace(/^\//, ''));
  // A filename is the one thing a remote page could use to write where it should not.
  if (!/^[a-z0-9][a-z0-9._-]{0,90}$/i.test(id) || id.includes('..')) {
    refused++; return res.writeHead(400).end('bad name');
  }
  const chunks = [];
  let size = 0;
  req.on('data', c => {
    size += c.length;
    if (size > 25 * 1024 * 1024) { req.destroy(); refused++; return; }   // a photograph, not a film
    chunks.push(c);
  });
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    const ext = EXT(buf);
    if (!ext) { refused++; return res.writeHead(415).end('not an image'); }
    for (const old of fs.readdirSync(SRC).filter(f => f.startsWith(id + '.'))) fs.unlinkSync(path.join(SRC, old));
    fs.writeFileSync(path.join(SRC, `${id}.${ext}`), buf);
    saved++;
    if (saved % 20 === 0) console.log(`  ${saved} saved`);
    res.writeHead(200).end('ok');
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`listening on http://127.0.0.1:${port} - POST /<product-id>__<slot> with the image bytes`);
  console.log('writing into images/_src ; stop with ctrl-c');
});
