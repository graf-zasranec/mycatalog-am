// Read-only review queue. Run from the repository root, optionally redirecting
// the JSON into a private report for Ego Lite to process in bounded batches.
// Example: node tools/catalogue-review.mjs --ego --types=ram-conflict,hidden-link
// Optional: --offset=8 --limit=8 --stale-days=2 --candidates=path/to/report.txt
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseCsv} from './hand-csv.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-review-'));
const run = (...args) => execFileSync(process.execPath, args, {encoding:'utf8'});
try {
  const products = new Map(JSON.parse(fs.readFileSync('data/phones.json')).map(p => [p.id,p]));
  const {offers} = JSON.parse(fs.readFileSync('data/prices.json'));
  const active = id => (offers[id] || []).filter(o => o.inStock !== false && o.price > 0).length;
  const jobs = [];
  const push = (type, priority, evidence) => jobs.push({type,priority,...evidence});
  const [header,...rows] = parseCsv(fs.readFileSync('data/listings.csv','utf8'));
  for (const row of rows) {
    const item = Object.fromEntries(header.map((key,i) => [key,row[i]]));
    if (item.inStock === 'link-hidden') {
      push('hidden-link',80,{shop:item.shop,url:item.url,title:item.title});
    }
  }

  const variantsFile = path.join(dir,'variants.json');
  run('tools/variant-audit.mjs', `--report=${variantsFile}`);
  const variants = JSON.parse(fs.readFileSync(variantsFile));
  for (const item of variants.titleConflicts) {
    const configurations = (offers[item.id] || []).filter(o => o.url===item.url && o.shop===item.shop)
      .map(o => ({color:o.color,rawColor:o.colorRaw,ram:o.ram,storage:o.storage,price:o.price}));
    push('ram-conflict',100,{...item,configurations});
  }
  for (const item of variants.unsupportedPairs) push('variant-missing',70,item);
  for (const item of variants.repairs) push('ram-missing',75,item);
  const option = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const staleDays = option('stale-days');
  if (staleDays !== undefined) {
    const days = Number(staleDays);
    if (!Number.isInteger(days) || days < 1) throw new Error('--stale-days must be a positive integer');
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0,10);
    for (const [id,items] of Object.entries(offers)) for (const item of items) {
      if (item.inStock === false || !item.url || !item.price) continue;
      const seen = (item.checkedAt || item.seen || '').slice(0,10);
      if (seen && seen >= cutoff) continue;
      push('offer-freshness',45,{id,shop:item.shop,title:item.title,url:item.url,seen:seen || null});
    }
  }
  const candidates = option('candidates') || 'data/new-products.txt';
  if (fs.existsSync(candidates)) {
    let shop;
    for (const line of fs.readFileSync(candidates,'utf8').split('\n')) {
      const heading = line.match(/^== (\S+) \(\d+\)$/);
      if (heading) { shop = heading[1]; continue; }
      const [title,...rest] = line.split(' | ');
      const url = rest.find(value => /^https?:\/\//i.test(value));
      if (shop && title && url) push('new-product',55,{shop,title,url});
    }
  }

  const required = new Set(run('tools/spec-gaps.mjs','--all-categories').split('\n'));
  for (const line of run('tools/spec-gaps.mjs','--all','--all-categories').split('\n')) {
    const [id,field] = line.split(' ');
    const p = products.get(id);
    if (!p || !field) continue;
    push('spec-gap',required.has(line) ? 90 : 35,{id,field,title:`${p.brand} ${p.name}`,sources:p.sources || []});
  }
  for (const item of jobs) {
    if (!item.id) continue;
    item.activeOffers = active(item.id);
    item.priority += Math.min(item.activeOffers, 20);
  }
  jobs.sort((a,b) => b.priority-a.priority || a.type.localeCompare(b.type) || (a.id || a.url).localeCompare(b.id || b.url));
  const counts = {};
  for (const item of jobs) counts[item.type] = (counts[item.type] || 0) + 1;
  if (process.argv.includes('--ego')) {
    const types = option('types')?.split(',');
    const offset = Number(option('offset') || 0);
    const limit = Number(option('limit') || 8);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new Error('Expected a nonnegative --offset and --limit between 1 and 20');
    }
    const eligible = jobs
      .filter(item => !types || types.includes(item.type))
      .map(item => ({...item,url:item.url || item.sources?.find(url => /^https?:\/\//i.test(url))}))
      .filter(item => /^https?:\/\//i.test(item.url || ''));
    const batch = eligible.slice(offset,offset+limit);
    const script = `
const batch = ${JSON.stringify(batch)};
const task = await taskSpace("Better.am catalogue review batch");
console.log({spaceId:task.spaceId,offset:${offset},eligible:${eligible.length},nextOffset:${offset+batch.length}});
const page = task.page("p1"), results = [];
for (const item of batch) {
  try {
    await page.goto(item.url,{timeout:15000});
    try {
      await page.waitForFunction(() => document.querySelector("h1")?.innerText.trim() ||
        /not found|no such product|just a moment/i.test(document.title),
        undefined,{timeout:4000});
    } catch (error) {
      if (!/timed out|timeout/i.test(String(error))) throw error;
    }
    const pageEvidence = await page.evaluate(() => ({
      url:location.href,
      status:performance.getEntriesByType("navigation")[0]?.responseStatus,
      title:document.title,
      product:document.querySelector("h1")?.innerText.trim(),
      lines:document.body.innerText.split("\\n").map(line=>line.trim()).filter(line =>
        /AMD|֏|GB|ГБ|ԳԲ|RAM|stock|առկա|not found|Cloudflare|product code/i.test(line) &&
        line.length<200).slice(0,24)
    }));
    results.push({item,pageEvidence});
  } catch (error) {
    if (/control|inactive|unassigned/i.test(String(error))) throw error;
    results.push({item,error:String(error).slice(0,300)});
  }
}
console.log(JSON.stringify(results,null,2));
await task.finish({keep:[]});`;
    process.stdout.write(execFileSync('ego-browser',['nodejs'],{input:script,encoding:'utf8'}));
  } else {
    console.log(JSON.stringify({generatedAt:new Date().toISOString(),counts,jobs},null,2));
  }
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
