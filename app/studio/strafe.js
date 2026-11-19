// The native strafe behavior samples a new distance, speed and pause each leg.
// Unpredictable (8 Nov 2026, matched to a recorded player run): always full speed (variety comes from
// distance and timing), short pauses, and a mix of short taps and longer strafes.
// tap: [chance, min m, max m] - a tap moves a short distance from where the bot stands (the game's
// counter-strafe reads it, /* aim-strafe-taps */ in BiMsX6Xn.js); other legs cross to the far side.
// bot-speed-v1 (19 Nov 2026): every moving bot (not copycat) has a speed slider like copycat's, 0.75x-3x of Walk / Run.
export const SPEED_SCALE = [0.75, 3];
// bot-speed-default-v1: speedScale null = default: 1.25x with no gun (your own knife speed, 6.75 m/s), 1x with a gun
// in hand (5.4 m/s, your Vandal speed). A value the user picks on the slider is kept as it is.
export const defaultSpeedScale = (bot) => (bot.weapon ? 1 : 1.25);
export const speedScale = (bot) => Math.max(SPEED_SCALE[0], Math.min(SPEED_SCALE[1], Number.isFinite(bot.speedScale) ? bot.speedScale : defaultSpeedScale(bot)));
export const botSpeed = (bot) => Math.round((bot.speed === 'walk' ? 2.97 : 5.4) * speedScale(bot) * 100) / 100;
export function strafeSettings(bot) {
  const speed = botSpeed(bot);
  const width = Math.max(.4, Math.min(12, bot.width || 3));
  const round = n => Math.round(n * 100) / 100;
  return bot.unpredictable === true
    ? { speed: [speed, speed], dwell: [.03, .25], travel: [round(width * .45), round(width)], tap: [.35, round(Math.min(.5, width * .5)), round(Math.min(1.2, width))] }
    : { speed: [speed, speed], dwell: [.15, .6], travel: [round(width * .6), round(width)] };
}

// The next stop of a leg, like the game's counter-strafe: a tap moves a short distance from `at`
// (turning around at the edge), any other leg goes to a random point on the far side (the `direction`
// side when it stands in the middle).
export function nextStrafePoint(settings, at, direction, random) {
  const range = pair => pair[0] + random() * (pair[1] - pair[0]);
  if (settings.tap && random() < settings.tap[0]) {
    const half = settings.travel[1] / 2, step = range([settings.tap[1], settings.tap[2]]);
    let point = at + direction * step;
    if (Math.abs(point) > half) { direction = -direction; point = at + direction * step; }
    return { point: Math.max(-half, Math.min(half, point)), direction };
  }
  // a longer strafe always crosses to the other side of the spot
  if (settings.tap && at !== 0) direction = -Math.sign(at);
  return { point: direction * range(settings.travel) / 2, direction };
}

// Game-like motion for one leg: speeds up to full speed, runs, then counter-strafes to a stop.
// Rates from the game sim (8 Nov 2026): 0 -> 90% in ~0.37 s, 90% -> 0 in ~0.14 s.
const ACCEL = 13.5, DECEL = 34;
function legMotion(dist, vmax) {
  const dUp = vmax * vmax / (2 * ACCEL), dDown = vmax * vmax / (2 * DECEL);
  if (dist >= dUp + dDown) {
    const tUp = vmax / ACCEL, tRun = (dist - dUp - dDown) / vmax, tDown = vmax / DECEL;
    return { secs: tUp + tRun + tDown, at: t => t < tUp ? .5 * ACCEL * t * t : t < tUp + tRun ? dUp + vmax * (t - tUp)
      : (s => dUp + vmax * tRun + vmax * s - .5 * DECEL * s * s)(Math.min(tDown, t - tUp - tRun)) };
  }
  // short tap: never reaches full speed
  const peak = Math.sqrt(2 * dist * ACCEL * DECEL / (ACCEL + DECEL)), tUp = peak / ACCEL, tDown = peak / DECEL;
  return { secs: tUp + tDown, at: t => t < tUp ? .5 * ACCEL * t * t : (s => peak * peak / (2 * ACCEL) + peak * s - .5 * DECEL * s * s)(Math.min(tDown, t - tUp)) };
}

// A stable illustrative preview using the same ranges and the game's speed-up and stop; gameplay
// keeps the native acceleration, collision and seeded randomness.
const previews = new Map();
export function unpredictableOffset(bot, seconds) {
  const settings = strafeSettings(bot), key = JSON.stringify([bot.id, settings]);
  let legs = previews.get(key);
  if (!legs) {
    let seed = 2166136261;
    for (const c of String(bot.id)) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    const range = pair => pair[0] + random() * (pair[1] - pair[0]);
    const vmax = settings.speed[1];
    let from = 0, direction = random() < .5 ? -1 : 1, end = 0; legs = [];
    const move = (to) => { const m = legMotion(Math.abs(to - from), vmax); legs.push({ from, to, start: end, end: end + Math.max(.01, m.secs), m }); end += Math.max(.01, m.secs); };
    while (end < 120) {
      const next = nextStrafePoint(settings, from, direction, random);
      move(next.point);
      const pause = range(settings.dwell); legs.push({ from: next.point, to: next.point, start: end, end: end + pause }); end += pause;
      from = next.point; direction = -next.direction;
    }
    move(0);
    if (previews.size >= 64) previews.delete(previews.keys().next().value);
    previews.set(key, legs);
  }
  const time = Math.max(0, seconds) % legs.at(-1).end;
  let low = 0, high = legs.length - 1;
  while (low < high) { const mid = (low + high) >>> 1; if (legs[mid].end <= time) low = mid + 1; else high = mid; }
  const leg = legs[low];
  if (!leg.m || leg.to === leg.from) return leg.to;
  const done = Math.min(Math.abs(leg.to - leg.from), leg.m.at(Math.max(0, time - leg.start)));
  return leg.from + Math.sign(leg.to - leg.from) * done;
}
