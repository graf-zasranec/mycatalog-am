// Says what kind of headphone each headphone is, the way e-catalog's filter column does.
//
//   node tools/audio.mjs            what it would set
//   node tools/audio.mjs --write    write it into data/phones.json
//
// There used to be two sections, "earbuds" and "headphones", and which one a product landed in
// depended on the word a shop happened to use: Tune 125 TWS, Beats Fit Pro and Redmi Buds 8 sat
// among the over-ear headsets. One section and a Type filter answers the question a buyer asks.
//
// Everything is read off the product's own name and the titles the shops list it under. A field
// already filled in phones.json is never overwritten - a person's correction outranks a pattern -
// and a product the patterns cannot place is left without that field and printed, rather than
// guessed. The app treats a missing field as "unknown": it drops out only while that filter is on.
import fs from 'node:fs';

const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const offers = JSON.parse(fs.readFileSync('data/prices.json', 'utf8')).offers || {};
const write = process.argv.includes('--write');

const AUDIO = new Set(['headphones', 'earbuds']);
// Form factor, most specific first. The first rule that matches wins.
const FORM = [
  ['open',     /\bclip\b|\bear open\b|\bopen\s?ear\b|\bopenrun\b|\bbone\b/i],
  ['neckband', /\bbeats flex\b|\btune 125bt\b|\bneckband\b/i],
  ['wired-in', /\bearpods\b|\bearphones\b|\beo-ic100\b/i],
  ['tws',      /\btws\b|\btwc\b|\btrue wireless\b|\bearbuds?\b|\bbuds\b|\bairpods(?! max)\b|\bwf-\w|\bear \(a\)|\bpulse explore\b|\bfit pro\b|\bsoundsport free\b|\bmomentum sport\b|\bbeoplay ex\b|\bquietcomfort (ii|earbuds)\b|\baccentum true\b|\bsport earbuds\b|\bflex\b|\bbeam\b/i],
  ['full',     /\bheadphones?\b|\bheadset\b|\bmax\b|\bwh-\w|\bath-\w|\bhd \d|\brs \d|\bmajor\b|\bsolo \d|\bstudio pro\b|\bbeoplay h|\blive \d{3}|\btune \d{3}(?!.*tws)|\bquantum\b|\bgaming\b|\brog\b|\btuf\b|\bzone\b|\bace\b|\baccentum\b|\bmomentum 4\b|\bquietcomfort 45\b|\bheadphone \(1\)/i],
];
const WIRED = /\bwired\b(?!\s*\/)|\bearpods\b|\beo-ic100\b|\btype-c earphones\b/i;
const WIRED_MODELS = /\bhd 599\b|\bhd 620s\b|\brog delta s\b|\bstrix go core\b|\btuf gaming h3\b|\btuf gaming h7 core\b|\bquantum 300\b|\btune 500\b/i;
const GAMING = /\bgaming\b|\brog\b|\btuf\b|\bquantum\b|\bpulse\b|\bxbox\b|\binzone\b|\bg900n\b|\bstrix\b/i;
const ANC = /\b(anc|nc)\b|\d+\s?nc\b|noise[- ]cancell?ing|\bquietcomfort\b|\b1000xm\d\b/i;

// the connector is on the spec sheet, not in the shop's title
const PLUG_MODELS = [[/\brog delta s\b/i, 'usb-c']];
const plugOf = t => (PLUG_MODELS.find(([re]) => re.test(t)) || [])[1] || /usb[- ]?c|type-c/i.test(t) ? 'usb-c' : /lightning/i.test(t) ? 'lightning' : '3.5';

const unsure = [], changes = [];
for (const p of phones) {
  if (!AUDIO.has(p.category)) continue;
  // the product's own name decides first; the shops' titles only fill in what it leaves open
  const own = p.brand + ' ' + p.name + ' ' + (p.aliases || []).join(' ');
  const titles = (offers[p.id] || []).map(o => o.title || '').join(' | ');
  const both = own + ' | ' + titles;
  const a = p.audio = p.audio || {};
  const was = JSON.stringify([p.category, a]);
  p.category = 'headphones';

  if (!a.form) {
    const f = (FORM.find(([, re]) => re.test(own)) || FORM.find(([, re]) => re.test(titles)) || [])[0];
    if (f) a.form = f; else unsure.push(`${p.id}  (${p.name}) - no form`);
  }
  if (!a.conn) a.conn = WIRED.test(own) || WIRED_MODELS.test(own) || (/\bwired\b/i.test(titles) && !/wireless/i.test(both)) ? 'wired' : 'wireless';
  if (a.conn === 'wired' && !a.plug) a.plug = plugOf(both);
  if (a.form === 'wired-in') a.form = 'in-ear';
  if (a.gaming == null && GAMING.test(own)) a.gaming = true;
  if (a.anc == null && ANC.test(both)) a.anc = true;
  if (JSON.stringify([p.category, a]) !== was) changes.push(p);
}

const tally = k => Object.entries(changes.concat(phones.filter(p => p.category === 'headphones' && !changes.includes(p)))
  .reduce((m, p) => (m[p.audio?.[k] ?? '-'] = (m[p.audio?.[k] ?? '-'] || 0) + 1, m), {})).map(([v, n]) => `${v} ${n}`).join(', ');
console.log(`${changes.length} product(s) changed`);
console.log(`  form:   ${tally('form')}\n  conn:   ${tally('conn')}\n  plug:   ${tally('plug')}\n  gaming: ${tally('gaming')}\n  anc:    ${tally('anc')}`);
if (process.argv.includes('-v')) for (const p of changes) console.log(`  ${p.id.padEnd(48)} ${JSON.stringify(p.audio)}`);
if (unsure.length) console.log('\ncould not place (set audio.form by hand):\n  ' + unsure.join('\n  '));
if (!write) { console.log('\npass --write'); process.exit(0); }
fs.writeFileSync('data/phones.json', JSON.stringify(phones, null, 1));
console.log('written');
