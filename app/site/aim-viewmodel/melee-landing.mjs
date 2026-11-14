const LAND_BLEND = 0.1;
const GROUND_BLEND = 0.3;
const AIR_RESPONSE = 0.045;

const isIdle = state => state === 'idle' || state === 'crouchIdle';

export function createMeleeLanding() {
  let airborne = false;
  let landingAt = -Infinity;
  let lastTime = -Infinity;
  let compactBlendSince = -Infinity;
  let compactBlendStart = 0;
  const blend = { state: 'idle', since: 0, prev: null, prevSince: 0, blendSeconds: LAND_BLEND, blendStart: 0 };
  const motion = { lift: 0, pitch: 0 };

  return {
    motion,
    update({ grounded, verticalVelocity, seconds }) {
      const dt = seconds - lastTime;
      if (dt < 0 || dt > 0.5 || grounded == null) {
        airborne = false;
        landingAt = -Infinity;
        compactBlendSince = -Infinity;
        motion.lift = 0;
        motion.pitch = 0;
      }
      lastTime = seconds;
      if (grounded == null) return;
      if (grounded && airborne) landingAt = seconds;
      airborne = !grounded;

      // Let the hands follow the jump with a short lag. The same filter
      // settles the residual motion on landing without a pose snap.
      const velocity = airborne && Number.isFinite(verticalVelocity)
        ? Math.max(-1, Math.min(1, verticalVelocity / 5))
        : 0;
      const weight = dt > 0 && dt <= 0.5 ? 1 - Math.exp(-dt / AIR_RESPONSE) : 0;
      motion.lift += (-0.024 * velocity - motion.lift) * weight;
      motion.pitch += (-0.045 * velocity - motion.pitch) * weight;
    },
    locomotion(loco) {
      if (loco.prev == null || (isIdle(loco.state) && isIdle(loco.prev))) return loco;

      // Speed can drop on the first grounded tick or just after it.
      // Keep both clips' sample phases and shorten just the blend.
      const fromLanding = loco.since - landingAt;
      if (!airborne && loco.since !== compactBlendSince && fromLanding > -GROUND_BLEND && fromLanding < LAND_BLEND) {
        const progress = Math.max(0, landingAt - loco.since) / GROUND_BLEND;
        compactBlendSince = loco.since;
        compactBlendStart = Math.max(loco.since, landingAt) - progress * LAND_BLEND;
      }
      if (loco.since !== compactBlendSince) return loco;
      blend.state = loco.state;
      blend.since = loco.since;
      blend.prev = loco.prev;
      blend.prevSince = loco.prevSince;
      blend.blendStart = compactBlendStart;
      return blend;
    }
  };
}
