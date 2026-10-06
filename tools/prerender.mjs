// Render the initial catalogue with the same functions as the interactive app.
// This keeps useful content visible before JavaScript loads and avoids a second layout.
import fs from 'node:fs';
export function prerender(data) {
  const noop = () => {};
  const nodes = new Map();
  const element = () => ({innerHTML:'',textContent:'',value:'',dataset:{},style:{},classList:{add:noop,remove:noop,contains:()=>false},setAttribute:noop,removeAttribute:noop,addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[]});
  const node = key => { if (!nodes.has(key)) nodes.set(key,element()); return nodes.get(key); };
  const stub = {
    document:{querySelector:node,querySelectorAll:()=>[],getElementById:node,addEventListener:noop,documentElement:element(),body:element(),createElement:element,head:element()},
    window:{addEventListener:noop,scrollTo:noop,scrollY:0,innerHeight:800,matchMedia:()=>({matches:false,addEventListener:noop})},
    localStorage:{getItem:()=>null,setItem:noop},matchMedia:()=>({matches:false,addEventListener:noop}),
    performance:{now:()=>0},setInterval:noop,setTimeout:noop,clearTimeout:noop,requestAnimationFrame:noop,
    location:{hash:'#/',href:''},history:{scrollRestoration:'auto',replaceState:noop,pushState:noop},
  };
  const whole = fs.readFileSync('_app.js','utf8');
  const src = whole.slice(0,whole.lastIndexOf('\nrender();'));
  const vars = {...data,...stub};
  return new Function(...Object.keys(vars),src + `;
    paintChrome();
    const all=results();
    return {hero:mastHero(), main:catalogView()
      .replace('<div class="grid" id="gridbox" data-nosnippet></div>','<div class="grid" id="gridbox" data-nosnippet>'+all.slice(0,PAGE).map(card).join('')+'</div>')
      .replace('<div id="pager"></div>','<div id="pager">'+pager(all.length)+'</div>')
      .replace('id="rescnt"></span>','id="rescnt">'+all.length+'</span>')
      .replace('id="mbarn"></span>','id="mbarn">'+all.length+'</span>'),
      nav:document.querySelector('#nav').innerHTML, langs:document.querySelector('#langs').innerHTML,
      foot:document.querySelector('#foot').innerHTML};
  `)(...Object.values(vars));
}
