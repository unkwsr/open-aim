// The native strafe behavior samples a new distance, speed and pause each leg.
export function strafeSettings(bot) {
  const speed = bot.speed === 'walk' ? 2.97 : 5.4;
  const width = Math.max(.4, Math.min(12, bot.width || 3));
  const round = n => Math.round(n * 100) / 100;
  return bot.unpredictable === true
    ? { speed: [round(speed * .65), speed], dwell: [.02, .55], travel: [round(Math.max(.12, width * .12)), round(width)] }
    : { speed: [speed, speed], dwell: [.15, .6], travel: [round(width * .6), round(width)] };
}

// A stable illustrative preview using the same ranges; gameplay keeps the
// native acceleration, collision and seeded randomness rather than this tween.
const previews = new Map();
export function unpredictableOffset(bot, seconds) {
  const settings = strafeSettings(bot), key = JSON.stringify([bot.id, settings]);
  let legs = previews.get(key);
  if (!legs) {
    let seed = 2166136261;
    for (const c of String(bot.id)) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    const range = pair => pair[0] + random() * (pair[1] - pair[0]);
    let from = 0, direction = random() < .5 ? -1 : 1, end = 0; legs = [];
    while (end < 120) {
      const to = direction * range(settings.travel) / 2;
      const duration = Math.max(.1, 1.5 * Math.abs(to - from) / range(settings.speed));
      legs.push({ from, to, start: end, end: end + duration }); end += duration;
      const pause = range(settings.dwell); legs.push({ from: to, to, start: end, end: end + pause }); end += pause;
      from = to; direction = -direction;
    }
    const duration = Math.max(.1, 1.5 * Math.abs(from) / settings.speed[1]);
    legs.push({ from, to: 0, start: end, end: end + duration });
    if (previews.size >= 64) previews.delete(previews.keys().next().value);
    previews.set(key, legs);
  }
  const time = Math.max(0, seconds) % legs.at(-1).end;
  let low = 0, high = legs.length - 1;
  while (low < high) { const mid = (low + high) >>> 1; if (legs[mid].end <= time) low = mid + 1; else high = mid; }
  const leg = legs[low], u = Math.max(0, Math.min(1, (time - leg.start) / (leg.end - leg.start)));
  return leg.from + (leg.to - leg.from) * u * u * (3 - 2 * u);
}
