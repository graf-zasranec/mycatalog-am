import fs from 'node:fs';
import {modelEsimOnly} from './sim-hardware.mjs';
import {specOfferAllowed} from './allsell-specs.mjs';
import { cpu, storageGB } from './spec-values.mjs';
// The same source cache used by shop-specs.mjs. Configuration facts belong to
// the offer whose page stated them, rather than every build of a model family.
// Exact browser-verified axes fill omitted source metadata; they never change a
// price/check date or overwrite an axis explicitly stated by the merchant.
export function attachVerifiedOfferAxes(offers, verified) {
  if (!verified) verified = fs.existsSync('data/config-specs.json') ? JSON.parse(fs.readFileSync('data/config-specs.json','utf8')) : {};
  const key = value => { try { const url=new URL(value); url.hash=''; url.searchParams.sort(); return url.href; } catch { return null; } };
  let count=0;
  for (const [id, rows] of Object.entries(verified)) for (const fact of rows) {
    if (!fact.offerAxes || !fact.url || !fact.shop || !/^\d{4}-\d{2}-\d{2}$/.test(fact.checked||'')) continue;
    const target=key(fact.url); if(!target) continue;
    for(const offer of offers[id]||[]) if(offer.shop===fact.shop && key(offer.url)===target) {
      // Shared product pages can sell different RAM at each storage capacity.
      if (fact.matchAxes && !Object.entries(fact.matchAxes).every(([axis,value]) =>
        ['storage','ram','size'].includes(axis) && Number.isFinite(value) && value>0 && offer[axis]===value)) continue;
      // An explicit source-verified correction must match the erroneous configuration first.
      if (fact.matchAxes && Object.keys(fact.matchAxes).length) for (const axis of ['storage','ram']) {
        const value=fact.correctAxes?.[axis];
        if (Number.isFinite(value) && value>0) offer[axis]=value;
      }
      for(const axis of ['storage','ram']) if(offer[axis]==null && Number.isFinite(fact.offerAxes[axis]) && fact.offerAxes[axis]>0) { offer[axis]=fact.offerAxes[axis]; count++; }
    }
  }
  return count;
}

export function attachOfferConfigs(products, offers) {
  attachVerifiedOfferAxes(offers);
  // Fixed worldwide hardware takes precedence over a retailer's default SIM policy.
  for (const p of products) {
    const hardware = modelEsimOnly(p.id);
    if (hardware !== undefined) for (const o of offers[p.id] || []) o.esim = hardware;
  }
  const holdFile = 'data/price-review-holds.json';
  const holds = fs.existsSync(holdFile) ? JSON.parse(fs.readFileSync(holdFile, 'utf8')) : [];
  for (const id of Object.keys(offers)) offers[id] = offers[id].filter(o => specOfferAllowed(o, holds, id));
  // Some retailers put the watch case diameter in the shared capacity field.
  // Selectable-case families already print that field as mm. Fixed-case watches
  // must keep it separate from actual 32/64GB flash and from strap variants.
  const diameters = new Set([38, 40, 41, 42, 43, 44, 45, 46, 47, 49]);
  for (const p of products) if (p.category === 'watch' && p.variantUnit !== 'mm') {
    for (const o of offers[p.id] || []) if (diameters.has(o.storage)) {
      o.caseSize = o.storage;
      o.storage = null;
    }
  }
  const file = 'data/specs/shop-laptop.json';
  if (!fs.existsSync(file)) return 0;
  const pages = JSON.parse(fs.readFileSync(file, 'utf8'));
  let n = 0;
  for (const p of products) {
    if (p.category !== 'laptop') continue;
    const codes = `${p.name} ${(p.aliases || []).join(' ')}`.split(/[\s_(),/]+/)
      .map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(t => t.length >= 5 && /\d/.test(t) && /[a-z]/.test(t) && !/^\d+(gb|tb|inch)$/.test(t));
    for (const o of offers[p.id] || []) {
      const e = pages[o.url];
      if (!e?.spec || e.id !== p.id || e.status !== 200) continue;
      const url = String(o.url).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!e.maker && codes.length && !codes.some(c => url.includes(c))) continue;
      const s = e.spec, model = cpu(s.CPU);
      if (!model) continue;
      // A page with several listed capacities may describe only its default build.
      // Keep the child configurations instead of assigning that RAM to every child.
      const builds = new Set((offers[p.id] || []).filter(row => row.url === o.url).map(row => [row.ram, row.storage, row.size].join('|')));
      if (builds.size === 1) {
        const ram = /^\s*(\d+)\s*GB\s*$/i.exec(String(s.RAM || ''));
        const storage = storageGB(s.Memory);
        if (ram) o.ram = +ram[1];
        if (storage != null) o.storage = storage;
      }
      o.cpu = model;
      const display = {};
      const resolution = /^(\d{3,4})\s*[x×х*]\s*(\d{3,4})/.exec(String(s['Screen Resolution'] || ''));
      if (resolution) display.resolution = `${resolution[1]}x${resolution[2]}`;
      const size = parseFloat(String(s['Screen Size'] || '').replace(',', '.'));
      if (size >= 10 && size <= 19) display.size = size;
      const type = /^(IPS|TN|OLED|VA|WVA)\b/.exec(String(s['Display type'] || ''))?.[1];
      if (type) display.type = type;
      const refresh = +(String(s['Refresh rate'] || '').match(/(\d{2,3})\s*Hz/i) || [])[1];
      if (refresh) display.refresh = refresh;
      const gpu = String(s.GPU || '').trim();
      o.configSpecs = { chipset: { name: model }, ...(Object.keys(display).length ? { display } : {}),
        ...(gpu && !/^(none|n\/a|-)$/i.test(gpu) ? { graphics: { name: gpu, type: /RTX|GTX|Radeon RX|Arc A\d/i.test(gpu) ? 'discrete' : 'integrated' } } : {}) };
      n++;
    }
  }
  const verifiedFile = 'data/config-specs.json';
  const verified = fs.existsSync(verifiedFile) ? JSON.parse(fs.readFileSync(verifiedFile, 'utf8')) : {};
  const pageKey = url => String(url || '').replace(/\/+$/, '').replace(/^(https?:\/\/[^/]+)\/(?:am|en|ru)\//, '$1/');
  for (const p of products) for (const o of offers[p.id] || []) {
    const facts = verified[p.id]?.find(row => (row.size == null || row.size === o.size)
      && (!row.url || pageKey(row.url) === pageKey(o.url)));
    if (facts) {
      if (facts.url && facts.specs?.chipset?.name) o.cpu = facts.specs.chipset.name;
      const previous = o.configSpecs || {};
      o.configSpecs = { ...previous };
      for (const [block, values] of Object.entries(facts.specs || {})) o.configSpecs[block] = { ...previous[block], ...values };
      if (facts.allowedDisplayResolutions && !facts.allowedDisplayResolutions.includes(o.configSpecs.display?.resolution)) {
        o.configSpecs.display = { ...o.configSpecs.display, resolution: null, ppi: null };
      }
    }
  }
  return n;
}
