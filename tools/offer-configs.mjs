import fs from 'node:fs';
import { cpu } from './spec-values.mjs';
// The same source cache used by shop-specs.mjs. Configuration facts belong to
// the offer whose page stated them, rather than every build of a model family.
export function attachOfferConfigs(products, offers) {
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
        const storage = /^\s*(\d+(?:\.\d+)?)\s*(GB|TB)\s*$/i.exec(String(s.Memory || ''));
        if (ram) o.ram = +ram[1];
        if (storage) o.storage = +storage[1] * (storage[2].toUpperCase() === 'TB' ? 1024 : 1);
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
  for (const p of products) for (const o of offers[p.id] || []) {
    const facts = verified[p.id]?.find(row => row.size == null || row.size === o.size);
    if (facts) {
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
