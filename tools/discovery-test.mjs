import assert from 'node:assert/strict';import fs from 'node:fs';
const cats=fs.readdirSync('c',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name);let checks=0;
for(const lang of ['hy','ru','en']){const pre=lang==='hy'?'/':`/${lang}/`,file=lang==='hy'?'index.html':`${lang}/index.html`,html=fs.readFileSync(file,'utf8');
 for(const target of ['/', '/ru/','/en/']){assert.ok(new RegExp(`<a\\b[^>]*href="${target}"[^>]*data-lang=`).test(html),`${file} has ordinary language link ${target}`);checks++}
 for(const cat of cats){assert.ok(html.includes(`href="${pre}c/${cat}/"`),`${file} exposes category ${cat}`);checks++}
 assert.ok(html.includes(`href="${pre}b/"`),`${file} exposes translated blog`);checks++;
}
console.log(`DISCOVERY_PASS: ${checks} ordinary category, language and blog anchors`);
