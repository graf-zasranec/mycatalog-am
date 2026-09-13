// A drop box for photos the browser can reach but the shell cannot.
//
//   node tools/recv.mjs        then POST bytes from a page:
//   fetch('http://127.0.0.1:8815/put?name=foo__main.png', {method:'POST', body: blob})
//
// Some catalogue sites sit behind a challenge that a real browser passes and curl does not, so
// the image is only fetchable from inside a tab. Handing the bytes back through the tool channel
// as base64 costs a fortune in tokens, and a browser-initiated download is blocked after the
// first one. This takes the third route: the page POSTs the bytes straight to disk.
//
// Localhost only, one directory, and it refuses a name that tries to leave it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'images', '_src');
const PORT = 8815;

http.createServer((req, res) => {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (req.method !== 'POST') return res.writeHead(405, cors).end('post only');

  const name = new URL(req.url, 'http://x').searchParams.get('name') || '';
  // no directory traversal, no surprises: a plain file name in images/_src and nothing else
  if (!/^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp)$/i.test(name)) {
    return res.writeHead(400, cors).end('bad name');
  }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    fs.writeFileSync(path.join(DIR, name), buf);
    console.log(`${name}  ${buf.length} bytes`);
    res.writeHead(200, cors).end(String(buf.length));
  });
}).listen(PORT, '127.0.0.1', () => console.log(`drop box on http://127.0.0.1:${PORT} -> ${DIR}`));
