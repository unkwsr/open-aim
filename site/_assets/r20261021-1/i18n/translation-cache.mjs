export function memoizeTranslation(translate, limit = 1024) {
  const cache = new Map();
  return value => {
    if (typeof value !== 'string' || value.length > 512) return translate(value);
    if (cache.has(value)) return cache.get(value);
    const result = translate(value);
    if (cache.size >= limit) cache.delete(cache.keys().next().value);
    cache.set(value, result);
    return result;
  };
}
