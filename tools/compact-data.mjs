// Lossless shared schemas and repeated strings reduce catalogue download/parse work.
export function pack(value) {
  const schemas = [], schemaIds = new Map(), strings = [], counts = new Map(), stringIds = new Map();
  const count = v => {
    if (typeof v === 'string') counts.set(v, (counts.get(v) || 0) + 1);
    else if (Array.isArray(v)) v.forEach(count);
    else if (v && typeof v === 'object') Object.values(v).forEach(count);
  };
  count(value);
  const encode = v => {
    if (typeof v === 'string' && v.length > 8 && counts.get(v) > 1) {
      if (!stringIds.has(v)) { stringIds.set(v, strings.length); strings.push(v); }
      return [-2, stringIds.get(v)];
    }
    if (Array.isArray(v)) return [-1, ...v.map(encode)];
    if (!v || typeof v !== 'object') return v;
    const keys = Object.keys(v), key = JSON.stringify(keys);
    if (!schemaIds.has(key)) { schemaIds.set(key, schemas.length); schemas.push(keys); }
    return [schemaIds.get(key), ...keys.map(k => encode(v[k]))];
  };
  const data = encode(value);
  return [schemas, strings, data];
}

export function unpack([schemas, strings, data]) {
  const read = v => {
    if (!Array.isArray(v)) return v;
    if (v[0] === -2) return strings[v[1]];
    if (v[0] === -1) return v.slice(1).map(read);
    return Object.fromEntries(schemas[v[0]].map((k, i) => [k, read(v[i + 1])]));
  };
  return read(data);
}

export const unpackSource = `const betterUnpack=${unpack.toString()};\n`;

// Keep each model beside its image paths: gzip can reuse the model name in the
// filenames within its dictionary window instead of receiving distant maps.
export function groupCatalogue(products, maps) {
  const ids = new Set(products.map(p => p.id));
  const encode = (value, id) => {
    if (typeof value === 'string') {
      if (value.startsWith('images/cut/' + id)) return '\u0001' + value.slice(('images/cut/' + id).length);
      if (value.startsWith('images/thumb/' + id)) return '\u0002' + value.slice(('images/thumb/' + id).length);
      return /^[\u0000-\u0002]/.test(value) ? '\u0000' + value : value;
    }
    if (Array.isArray(value)) return value.map(v => encode(v, id));
    return value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k,encode(v,id)])) : value;
  };
  return {
    paths: 1,
    rows: products.map(p => [p, Object.fromEntries(Object.entries(maps)
      .filter(([, map]) => Object.hasOwn(map, p.id)).map(([key, map]) => [key, encode(map[p.id],p.id)]))]),
    extra: Object.fromEntries(Object.entries(maps).map(([key, map]) =>
      [key, Object.fromEntries(Object.entries(map).filter(([id]) => !ids.has(id)))]))
  };
}

export function restoreCatalogue({rows, extra, paths}) {
  const decode = (value, id) => {
    if (typeof value === 'string') {
      if (value[0] === '\u0000') return value.slice(1);
      if (value[0] === '\u0001') return 'images/cut/' + id + value.slice(1);
      if (value[0] === '\u0002') return 'images/thumb/' + id + value.slice(1);
      return value;
    }
    if (Array.isArray(value)) return value.map(v => decode(v, id));
    return value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k,decode(v,id)])) : value;
  };
  const maps = Object.fromEntries(Object.entries(extra).map(([key, map]) => [key, {...map}]));
  const DATA = rows.map(([product, assets]) => {
    for (const [key, value] of Object.entries(assets))
      Object.defineProperty(maps[key], product.id, {value:paths ? decode(value,product.id) : value, enumerable:true, writable:true, configurable:true});
    return product;
  });
  return {DATA, ...maps};
}

export const catalogueSource = `const betterCatalogue=${restoreCatalogue.toString()};\n`;
