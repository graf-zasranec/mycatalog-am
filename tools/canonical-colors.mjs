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
