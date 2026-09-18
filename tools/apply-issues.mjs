// Applies a filled-in copy of data/issues.csv back to the catalogue.
//
//   node tools/apply-issues.mjs <decisions.csv> [--write]
//
// tools/issues.mjs asks the questions; this answers them. The fourth column is where a person
// wrote what they decided, and only three shapes of answer mean anything here:
//
//   name to check      -> the name to use, in quotes. Written verbatim; a person deciding what a
//                         product is called outranks anything derived from a shop's title.
//   maybe one product  -> an answer beginning "Same product" or "Same ... line" merges the two.
//                         Anything beginning "Different" is recorded as settled and left alone,
//                         so the next run stops asking.
//   anything else      -> read, reported, and acted on by hand. A price spread explained as two
//                         storage tiers is not a defect and needs no edit.
//
// A merge keeps the SHORTER, more specific name - "Redmi 14C" over "REDMI" - moves every listing
// row onto it, and pins the loser's urls so no crawl re-creates it.
import fs from 'node:fs';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const D = 'data/';
const phones = JSON.parse(fs.readFileSync(D + 'phones.json', 'utf8'));
const byId = new Map(phones.map(p => [p.id, p]));
const decisions = parseCsv(fs.readFileSync(process.argv[2], 'utf8')).slice(1).filter(r => r.length >= 4);

const renames = [], merges = [], settled = [], noted = [];
for (const [what, id, detail, answer] of decisions) {
  const a = (answer || '').trim();
  const p = byId.get((id || '').trim());
  if (!p) { noted.push(`no such product: ${id}`); continue; }

  if (what === 'name to check') {
    // the brand is already its own field; a person writing "ASUS Vivobook 15" means the Vivobook
    const nm = a.replace(new RegExp('^' + p.brand.replace(/[+&]/g, '\\$&') + '\\s+', 'i'), '').trim();
    if (nm && nm !== p.name) renames.push([p, nm]);
    continue;
  }

  if (what === 'maybe one product') {
    if (/^different/i.test(a)) { settled.push(p.id); continue; }
    if (!/^same/i.test(a)) { noted.push(`${id}: cannot read "${a}"`); continue; }
    // the other product is named after the "vs" in the detail column
    const other = (detail.split(/\s+vs\s+/i)[1] || '').trim();
    const twin = phones.find(q => q.id !== p.id && q.brand === p.brand && q.category === p.category
      && q.name.toLowerCase() === other.toLowerCase());
    if (!twin) { noted.push(`${id}: cannot find "${other}" to merge with`); continue; }
    // Which one survives is written in the answer, not guessable from the two names. "Use the
    // specific model name" means keep the one carrying a model number - "Redmi 14C" over the bare
    // "REDMI", where the shorter name is the emptier one. Every other answer here - one specifies
    // the RAM, the storage, the processor, a colour code, an extra digit - describes a QUALIFIER
    // on a name, and there the shorter of the two is the name itself.
    const hasModel = q => /\d/.test(q.name);
    // "Emberton 3" and "Emberton III" are one speaker written two ways, and this catalogue
    // already carries Woburn II, Major IV and SoundLink Revolve II - the Roman form is the
    // maker's, so it is the one that survives.
    const ROMAN = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v', 6: 'vi' };
    const deRoman = q => q.name.toLowerCase().replace(/\b(i{1,3}|iv|vi?)\b/g,
      m => String(Object.entries(ROMAN).find(([, r]) => r === m)?.[0] ?? m));
    if (deRoman(p) === deRoman(twin) && /\b(i{1,3}|iv|vi?)\b/i.test(p.name) !== /\b(i{1,3}|iv|vi?)\b/i.test(twin.name)) {
      const [k, l] = /\b(i{1,3}|iv|vi?)\b/i.test(p.name) ? [p, twin] : [twin, p];
      merges.push([k, l]);
      continue;
    }
    const [keep, lose] = /specific model/i.test(a)
      ? (hasModel(p) && !hasModel(twin) ? [p, twin] : !hasModel(p) && hasModel(twin) ? [twin, p]
         : p.name.length >= twin.name.length ? [p, twin] : [twin, p])
      : (p.name.length <= twin.name.length ? [p, twin] : [twin, p]);
    merges.push([keep, lose]);
    continue;
  }
  noted.push(`${what} / ${id}: ${a}`);
}

// A product that several answers call "the same as" several DIFFERENT products is not a duplicate
// of any of them - it is a bucket. "REDMI" held aliases for a Redmi 15 and a Redmi 17 at once,
// because a shop title lost its model number on the way in. Merging it into whichever of the four
// came first would have handed that product the other three's titles. It is deleted instead, and
// each alias then matches the model it actually names.
const losses = new Map();
for (const [keep, lose] of merges) (losses.get(lose.id) || losses.set(lose.id, new Set()).get(lose.id)).add(keep.id);
const buckets = new Set([...losses].filter(([, w]) => w.size > 1).map(([id]) => id));

console.log(`${renames.length} rename(s), ${merges.length - [...buckets].length} merge(s), ${buckets.size} bucket(s), ${settled.length} settled as different`);
for (const [p, nm] of renames) console.log(`   rename  ${p.id.padEnd(40)} ${p.name}  ->  ${nm}`);
for (const id of buckets) console.log(`   bucket  ${id.padEnd(40)} names ${losses.get(id).size} different products - deleted, not merged`);
for (const [k, l] of merges) if (!buckets.has(l.id)) console.log(`   merge   ${l.id.padEnd(40)} into ${k.id}`);
if (noted.length) { console.log('\nread but not applied:'); for (const n of noted) console.log('   ' + n); }

if (!process.argv.includes('--write')) { console.log('\npass --write'); process.exit(0); }

for (const [p, nm] of renames) p.name = nm;
// A question a person has answered is not asked again: the answer lives on the product.
for (const id of settled) { const p = byId.get(id); p.settled = [...new Set([...(p.settled || []), 'notADuplicate'])]; }

const gone = new Map();                      // losing id -> winning id, or '' to just delete
for (const id of buckets) gone.set(id, '');
for (const [keep, lose] of merges) {
  if (buckets.has(lose.id) || gone.has(keep.id) || gone.has(lose.id)) continue;
  gone.set(lose.id, keep.id);
  keep.aliases = [...new Set([...(keep.aliases || []), lose.name, ...(lose.aliases || [])])];
  const cap = v => v != null;
  const have = new Set((keep.variants || []).map(v => `${v.ram ?? ''}|${v.storage ?? ''}`));
  for (const v of lose.variants || []) if (!have.has(`${v.ram ?? ''}|${v.storage ?? ''}`)) keep.variants.push(v);
  keep.priceAmd = Math.min(keep.priceAmd || Infinity, lose.priceAmd || Infinity);
  keep.priceAmdMax = Math.max(keep.priceAmdMax || 0, lose.priceAmdMax || 0);
  if (!cap(keep.released) && lose.released) keep.released = lose.released;
}

fs.writeFileSync(D + 'phones.json', JSON.stringify(phones.filter(p => !gone.has(p.id)), null, 1));

const V = JSON.parse(fs.readFileSync(D + 'verdicts.json', 'utf8')).filter(v => v && !gone.has(v.id));
fs.writeFileSync(D + 'verdicts.json', JSON.stringify(V, null, 1));

// The merged-away product's listings belong to the survivor; its urls are pinned to the survivor
// so the next crawl files them there rather than re-creating what was just merged.
const links = fs.readFileSync(D + 'links.csv', 'utf8').replace(/\n+$/, '').split(/\r?\n/);
let pinned = 0;
const out = links.map((l, i) => {
  if (!i) return l;
  const c = l.split(',');
  if (!gone.has(c[0])) return l;
  const to = gone.get(c[0]);
  // a bucket has no successor: its rows go back to being matched from scratch
  if (!to) { c[0] = ''; c[1] = ''; pinned++; return c.join(','); }
  c[0] = to;
  c[1] = (byId.get(to) || {}).brand + ' ' + (byId.get(to) || {}).name;
  pinned++;
  return c.join(',');
});
fs.writeFileSync(D + 'links.csv', out.join('\n') + '\n');

console.log(`\nwritten: ${renames.length} renamed, ${gone.size} merged away, ${pinned} link row(s) repointed`);
console.log('now run:  node scrape.mjs --handonly && node tools/verdicts.mjs --write && node tools/links.mjs && node build.mjs');
