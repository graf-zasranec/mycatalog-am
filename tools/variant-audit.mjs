// Check every stored offer against explicit shop-title evidence; --write repairs
// unambiguous RAM contradictions and adds configurations backed by those offers.
// No network and no speculative RAM inferred from relative prices.
import fs from 'node:fs';
const src = fs.readFileSync('scrape.mjs', 'utf8');
const marker = src.indexOf('const report = [];');
if (marker < 0) throw new Error('Scraper parser marker missing');
const { ramOf, capacitiesOf } = await import('data:text/javascript;base64,' + Buffer.from(
  src.slice(0, marker).replace('process.argv.slice(2)', '[]') + '\nexport { ramOf, capacitiesOf };').toString('base64'));
const phones = JSON.parse(fs.readFileSync('data/phones.json', 'utf8'));
const prices = JSON.parse(fs.readFileSync('data/prices.json', 'utf8'));
const report = { checkedOffers: 0, titledOffers: 0, explicitRAMOffers: 0, repairs: [], unsupportedPairs: [], addedConfigurations: [] };
const write = process.argv.includes('--write');
for (const p of phones) {
  if (!['phone', 'tablet', 'laptop', 'desktop'].includes(p.category)) continue;
  for (const o of prices.offers[p.id] || []) {
    report.checkedOffers++;
    if (!o.title) continue;
    report.titledOffers++;
    const candidates = capacitiesOf(o.title).filter(v => v < (['phone', 'tablet'].includes(p.category) ? 32 : 128));
    const parsed = ramOf(o.title);
    // Multiple RAM choices in a heading are not the selected child configuration.
    const unambiguous = parsed != null && new Set(candidates).size <= 1;
    if (unambiguous) {
      report.explicitRAMOffers++;
      if (o.ram !== parsed) {
        report.repairs.push({ id: p.id, shop: o.shop, url: o.url, title: o.title, before: o.ram ?? null, after: parsed });
        if (write) o.ram = parsed;
      }
    }
    if (o.ram != null && o.storage >= 32 && !(p.variants || []).some(v => v.ram === o.ram && v.storage === o.storage && (o.size == null || v.size == null || v.size === o.size))) {
      const evidence = { id: p.id, ram: o.ram, storage: o.storage, ...(o.size != null ? { size: o.size } : {}), url: o.url, title: o.title };
      report.unsupportedPairs.push(evidence);
      if (unambiguous && o.ram === parsed) {
        report.addedConfigurations.push(evidence);
        if (write) (p.variants ||= []).push({ ram: o.ram, storage: o.storage, ...(o.size != null ? { size: o.size } : {}), priceAmd: o.price });
      }
    }
  }
}
if (write) {
  fs.writeFileSync('data/prices.json', JSON.stringify(prices, null, 2) + '\n');
  fs.writeFileSync('data/phones.json', JSON.stringify(phones, null, 2) + '\n');
}
const output = process.argv.find(a => a.startsWith('--report='))?.slice(9);
if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ checkedOffers: report.checkedOffers, titledOffers: report.titledOffers,
  explicitRAMOffers: report.explicitRAMOffers, repairs: report.repairs.length,
  unsupportedPairs: report.unsupportedPairs.length, addedConfigurations: report.addedConfigurations.length, written: write }));
