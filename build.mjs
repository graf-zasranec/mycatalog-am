// Builds three outputs from _shell.html + _app.js + data/.
//   index.html           standalone page, loads images/ from disk  <- open this locally
//   index.embedded.html  standalone single file, images inlined    <- one file to email/host
//   artifact.html        head-less fragment, images inlined        <- for publishing as an Artifact
// Run: node build.mjs
import fs from 'node:fs';
const rd = f => fs.readFileSync(f, 'utf8');
const phones = JSON.parse(rd('data/phones.json'));
const STR = { hy: {}, ru: {}, en: {} };
for (const s of JSON.parse(rd('data/strings.json'))) { STR.hy[s.key] = s.hy; STR.ru[s.key] = s.ru; STR.en[s.key] = s.en; }
const VERD = {};
for (const { id, ...r } of JSON.parse(rd('data/verdicts.json'))) VERD[id] = r;
// real shop offers from scrape.mjs; optional, the site falls back to estimates without it
const HISTORY = fs.existsSync('data/history.json') ? JSON.parse(rd('data/history.json')) : { points: {} };
const PRICES = fs.existsSync('data/prices.json') ? JSON.parse(rd('data/prices.json')) : { shops: {}, offers: {} };

// transparent cutouts made by tools/cutout.mjs: images/cut/<phoneId>__<colourSlug>.webp
// "<id>__main.webp" is the default shot; the rest are per-colour.
const CUT = 'images/cut';
const cutFiles = fs.existsSync(CUT) ? fs.readdirSync(CUT).filter(f => f.endsWith('.webp')) : [];
function cutMap(inline) {
  const m = {};
  for (const f of cutFiles) {
    const [id, rest] = f.replace(/\.webp$/, '').split('__');
    if (!id || !rest) continue;
    (m[id] ||= {})[rest] = inline
      ? 'data:image/webp;base64,' + fs.readFileSync(`${CUT}/${f}`).toString('base64')
      : `${CUT}/${f}`;
  }
  return m;
}

const HEAD_OPEN = `<!doctype html>
<html lang="hy"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
`;
const HEAD_CLOSE = `</head><body>
`;

// The artifact platform supplies its own <head>, so the fragment build stays as-is. The
// standalone files are whole documents, and there <title>/<link>/<style> were landing in
// <body> - valid only because browsers hoist them, and it delays the webfont.
function splitShell(shell) {
  const i = shell.lastIndexOf('</style>');
  return i < 0 ? { head: '', body: shell } : { head: shell.slice(0, i + 8), body: shell.slice(i + 8) };
}

function build({ inline, standalone }) {
  const colors = cutMap(inline);
  // main shot: the transparent cutout when we have one, else the original photo
  const main = {};
  for (const p of phones) {
    const cut = `${CUT}/${p.id}__main.webp`;
    if (fs.existsSync(cut)) {
      main[p.id] = inline ? 'data:image/webp;base64,' + fs.readFileSync(cut).toString('base64') : cut;
    } else if (fs.existsSync(`images/${p.id}.jpg`)) {
      main[p.id] = inline ? 'data:image/jpeg;base64,' + fs.readFileSync(`images/${p.id}.jpg`).toString('base64') : `images/${p.id}.jpg`;
    } else console.warn('  ! missing image for', p.id);
  }
  const imgdata = `const IMGDATA=${JSON.stringify(main)};\nconst COLORIMG=${JSON.stringify(colors)};\n`;
  const shell = rd('_shell.html');
  const script = '\n<script>\n'
    + `const DATA=${JSON.stringify(phones)};\nconst STR=${JSON.stringify(STR)};\nconst VERD=${JSON.stringify(VERD)};\n`
    + `const PRICES=${JSON.stringify(PRICES)};\n`
    + `const HISTORY=${JSON.stringify(HISTORY)};\n`
    + imgdata + rd('_app.js') + '\n<\/script>\n';
  if (!standalone) return shell + script;          // the artifact platform supplies the <head>
  const { head, body } = splitShell(shell);
  return HEAD_OPEN + head + HEAD_CLOSE + body + script + '\n</body></html>\n';
}

fs.writeFileSync('index.html', build({ inline: false, standalone: true }));
fs.writeFileSync('index.embedded.html', build({ inline: true, standalone: true }));
fs.writeFileSync('artifact.html', build({ inline: true, standalone: false }));
const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
for (const f of ['index.html', 'index.embedded.html', 'artifact.html']) console.log(f.padEnd(22), kb(f));
