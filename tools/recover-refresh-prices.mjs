// Recover a failed run's successfully checked prices without replacing catalogue
// edits or importing unreviewed sources. Dry-run by default; originals stay intact.
import fs from'node:fs';
const file=process.argv.find((x,i)=>i>1&&!x.startsWith('--'));
if(!file)throw Error('Provide the saved data/prices.json path');
const currentPath=process.argv.find(x=>x.startsWith('--current='))?.slice(10)||'data/prices.json';
const incoming=JSON.parse(fs.readFileSync(file,'utf8')),current=JSON.parse(fs.readFileSync(currentPath,'utf8')),now=Date.now(),maxAge=12*3600000;
const generated=Date.parse(incoming.generated),age=now-generated;
if(!Number.isFinite(age)||age<0||age>maxAge||!incoming.offers||!current.offers)throw Error('Checkpoint must be a valid price snapshot from the last twelve hours');
const axes=['ram','storage','size','band','color','esim','cell','cpu','keyboardLayout','variant'];
const key=o=>JSON.stringify([o.shop,o.url,...axes.map(k=>o[k]??null)]),stamp=o=>Date.parse(o.checkedAt||o.seen||'')||0;
const report={updated:0,priceOrStockChanged:0,preserved:0,ambiguous:0,checkpointGenerated:incoming.generated,changes:[]};
for(const [id,list]of Object.entries(current.offers)){
 const candidates=new Map();
 for(const o of incoming.offers[id]||[]){const at=Date.parse(o.checkedAt);if(!Number.isFinite(at)||at>now||now-at>maxAge||o.seen!==new Date(at).toISOString().slice(0,10)||!Number.isFinite(o.price)||o.price<5000||typeof o.inStock!=='boolean')continue;const k=key(o),old=candidates.get(k);if(!old||at>stamp(old))candidates.set(k,o);else if(at===stamp(old)&&(o.price!==old.price||o.inStock!==old.inStock))candidates.set(k,{...old,ambiguous:true});}
 for(const o of list){const fresh=candidates.get(key(o));if(!fresh||fresh.ambiguous||stamp(fresh)<=stamp(o)){report.preserved++;if(fresh?.ambiguous)report.ambiguous++;continue;}
  const changed=o.price!==fresh.price||o.inStock!==fresh.inStock;report.updated++;if(changed)report.priceOrStockChanged++;
  report.changes.push({id,shop:o.shop,url:o.url,beforePrice:o.price,price:fresh.price,beforeStock:o.inStock,inStock:fresh.inStock,beforeCheckedAt:o.checkedAt,checkedAt:fresh.checkedAt});
  // All hardware, colours, configuration proofs and titles remain reviewed values.
  Object.assign(o,{price:fresh.price,inStock:fresh.inStock,seen:fresh.seen,checkedAt:fresh.checkedAt});
 }
}
if(process.argv.includes('--write')&&report.updated){current.generated=new Date().toISOString();const temporary=currentPath+'.recovery-tmp';fs.writeFileSync(temporary,JSON.stringify(current,null,2)+'\n');fs.renameSync(temporary,currentPath);}
const reportPath=process.argv.find(x=>x.startsWith('--report='))?.slice(9);if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,changes:report.changes.length,write:process.argv.includes('--write')}));
