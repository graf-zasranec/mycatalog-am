// Render the initial catalogue with the same functions as the interactive app.
// This keeps useful content visible before JavaScript loads and avoids a second layout.
import fs from 'node:fs';
// Native lazy-loading can fetch several screens ahead. Keep the first row
// native, and activate more distant initial photos near the viewport instead.
export function deferCataloguePhotos(html) {
  let index = 0;
  return html.replace(/<img class="pimg"[^>]*>/g, image => index++ < 4 ? image
    : `<template data-card-photo>${image}</template><noscript data-card-photo>${image}</noscript>`);
}
export function prerender(data, options) {
  return renderer(data, options)(null, 'hy');
}

export function productRenderer(data, options) {
  return renderer(data, options);
}

function renderer(data, {deferPhotos = false} = {}) {
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
  const render = new Function(...Object.keys(vars),src + String.raw`;
    return (product, lang) => {
    st.lang = lang;
    location.hash = product ? '#/p/' + product.id : '#/';
    paintChrome();
    if (product) {
      SEL = initialConfig(product);
      return {main:detailView(product), nav:document.querySelector('#nav').innerHTML,
        langs:document.querySelector('#langs').innerHTML, foot:document.querySelector('#foot').innerHTML};
    }
    const all=results();
    let renderedMain=catalogView()
      .replace('<div class="grid" id="gridbox" data-nosnippet></div>','<div class="grid" id="gridbox" data-nosnippet>'+all.slice(0,PAGE).map(card).join('')+'</div>')
      .replace('<div id="pager"></div>','<div id="pager">'+pager(all.length)+'</div>')
      .replace('id="rescnt"></span>','id="rescnt">'+all.length+'</span>')
      .replace('id="mbarn"></span>','id="mbarn">'+all.length+'</span>');
    if(typeof bxFilterForm==='function'){const sidebar='<aside class="bx-filter-sidebar" aria-label="'+esc(x('filtersT'))+'" data-signature="'+esc(bxFilterSignature())+'">'+bxFilterForm(filterBar())+'</aside>';renderedMain=renderedMain.replace('<div class="fbar',sidebar+'<div class="fbar');const sort=renderedMain.match(/<details class="fdrop r"[\s\S]*?<\/details>/)?.[0];if(sort)renderedMain=renderedMain.replace(sort,'').replace(/(id="rescnt">[\s\S]*?<\/span>)/,'$1'+sort);}
    return {hero:mastHero(),main:renderedMain,
      nav:document.querySelector('#nav').innerHTML, langs:document.querySelector('#langs').innerHTML,
      foot:document.querySelector('#foot').innerHTML};
    };
  `)(...Object.values(vars));
  return (product, lang) => {
    const result = render(product, lang);
    if (!product && deferPhotos) result.main = deferCataloguePhotos(result.main);
    return result;
  };
}
