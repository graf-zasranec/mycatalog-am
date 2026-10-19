export function canonicalColors(id, colors, aliases) {
  if (!Array.isArray(colors)) return colors;
  const map = aliases[id] || {};
  return [...new Set(colors.map(original => {
    let color = original; const seen = new Set();
    while (map[color]) {
      if (seen.has(color)) return original; // Preserve ambiguous cycles instead of merging them.
      seen.add(color); color = map[color];
    }
    return color;
  }))];
}

export function canonicalColorPhotos(id, photos, aliases) {
  const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Normalize lookup keys, never asset paths: Linux filenames remain case-sensitive.
  // Prefer an explicitly canonical key if both legacy and normalized entries exist.
  const normalized = {};
  for (const [key, photo] of Object.entries(photos)) {
    const canonical = slug(key);
    if (key === canonical || !Object.hasOwn(normalized, canonical)) normalized[canonical] = photo;
  }
  const result = {...normalized};
  for (const label of Object.keys(aliases[id] || {})) {
    const old = slug(label), target = slug(canonicalColors(id, [label], aliases)[0]);
    if (old === target) continue; // Ambiguous cycles keep their original entries.
    for (const [key, photo] of Object.entries(normalized)) {
      if (key !== old && !new RegExp('^' + old + '-\\d+$').test(key)) continue;
      const canonical = target + key.slice(old.length);
      result[canonical] ||= photo;
      delete result[key];
    }
  }
  return result;
}
