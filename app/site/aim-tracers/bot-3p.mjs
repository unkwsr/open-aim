// bot-tracer-3p-v1 (17 Nov 2026): VALORANT's third-person bullet tracer for bot shots.
// Source (FModel export, ShooterGame/Content):
//   Equippables/Guns/_Core/Projectile_Gun      -> TracerEffects[1] = Tracer_3P (shots you see from someone else)
//   Equippables/Guns/_Core/Tracers/Tracer_3P   -> InitialSpeed 30000 cm/s, BeamLength 10000, PostImpactLife 0.1 s,
//                                                 IntensityCycleArray [1, 0.1, 0.6, 0.1]
//   VFX/1PSmokes_Tracers/Tracer_3P_VFX         -> one Beam2 emitter: width 8 cm, taper 1 -> 0, distance 500 cm,
//                                                 StartAlpha 0.5-0.8, AlphaScaleOverLife 0.5 -> 0
//   VFX/Materials/Tracer3P_MI                  -> unlit, Emissive_Base = VFX/Textures/ColorGradient/ColorGradientTracer
// The texture is baked below (16 samples along its centre row, white head first; gaussian cross-section from its
// columns), so no image has to load (works the same in Worker mode).
// Assumptions (not in the files): the 5 m streak flies head-first at 300 m/s from the bot gun muzzle (OkAdunfX bot-muzzle-v1) to the
// hit / miss point, at alpha x 0.5 (AlphaScaleOverLife start), then fades out over PostImpactLife while the tail
// catches up. Misses fly 30 m past you. Colour and blending: see bot-tracer-fire-v1 below.
const SPEED = 300, STREAK = 5, POST_IMPACT = 0.1, WIDTH = 0.2, MISS_PAST = 30, START_AHEAD = 0.05, MIN_PX = 5, MAX_PX = 10; // WIDTH 0.08 (VALORANT's 8 cm) looked too thin in play (17 Nov): 0.2 m quad, at least 5 px (solid core ~2 px)
// bot-tracer-sharp-v1 (17 Nov 2026, user: "looks like it fades, make it sharp so we see where it goes"): VALORANT's
// cycle [1, 0.1, 0.6, 0.1] raised to [1, .45, .75, .45], full alpha scale, solid core with a hard edge, little taper/fade.
const CYCLE = [1, 0.45, 0.75, 0.45], ALPHA_MIN = 0.5, ALPHA_MAX = 0.8, ALPHA_SCALE = 1, GAIN = 1.35;
// bot-tracer-fire-v1 (17 Nov 2026, user): orange/red like the muzzle fire instead of VALORANT's white-yellow
// ColorGradientTracer. Head -> tail: hot yellow, orange, red, deep red; a yellow core runs down the middle.
// Normal (not additive) blending, so the colour stays orange/red over bright walls instead of washing to white.
const RAMP = [[255,200,110],[255,170,70],[255,146,46],[255,126,34],[254,118,30],[252,108,26],[246,94,22],[238,76,18],
  [228,60,14],[216,46,12],[202,36,10],[188,28,9],[172,22,8],[156,18,7],[140,15,6],[124,12,5]];
const LEVEL = RAMP.map(() => 1);
const CORE = [1, 0.72, 0.3]; // orange-yellow centre line

export function createBotTracer(T, options = {}) {
  const capacity = 48, positions = new Float32Array(capacity * 12), uv = new Float32Array(capacity * 8), params = new Float32Array(capacity * 4), indices = new Uint16Array(capacity * 6);
  for (let i = 0; i < capacity; i++) { const v = i * 4; indices.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6); uv.set([0, 0, 0, 1, 1, 0, 1, 1], i * 8); }
  const geometry = new T.BufferGeometry(), position = new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage), alphaAttr = new T.BufferAttribute(params, 1).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', position); geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); geometry.setAttribute('beamAlpha', alphaAttr); geometry.setIndex(new T.BufferAttribute(indices, 1)); geometry.setDrawRange(0, 0);
  const ramp = RAMP.map((c, i) => `vec3(${(c[0] / 255 * LEVEL[i]).toFixed(4)},${(c[1] / 255 * LEVEL[i]).toFixed(4)},${(c[2] / 255 * LEVEL[i]).toFixed(4)})`).join(',');
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, blending: 1, side: 2, toneMapped: false,
    vertexShader: 'attribute float beamAlpha;varying vec2 vUv;varying float vA;void main(){vUv=uv;vA=beamAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv;varying float vA;
      const vec3 R[16]=vec3[16](${ramp});
      void main(){float x=clamp(vUv.x,0.,1.)*15.;int i=int(floor(x));int j=min(i+1,15);vec3 c=mix(R[i],R[j],fract(x));
        float e=abs(vUv.y-.5);float taper=mix(1.,.7,vUv.x);float hw=.2*taper,aa=max(fwidth(vUv.y)*1.2,.015);float prof=max(1.-smoothstep(hw-aa,hw+aa,e),.25*exp(-e*e/(2.*.16*.16)));
        float core=(1.-smoothstep(.06*taper-aa,.06*taper+aa,e))*(1.-.5*vUv.x);c=mix(c,vec3(${CORE.join(',')}),core*.55);
        float a=clamp(prof*vA*${GAIN.toFixed(2)}*mix(1.,.88,vUv.x),0.,1.);gl_FragColor=vec4(c,a);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(geometry, material), scene = new T.Scene(); mesh.frustumCulled = false; scene.add(mesh);
  const pool = Array.from({ length: capacity }, () => ({ live: false, start: new T.Vector3(), end: new T.Vector3(), dir: new T.Vector3(), len: 0, at: 0, alpha: 0 }));
  const shotCount = new Map(), eye = new T.Vector3(), view = new T.Vector3(), side = new T.Vector3(), up = new T.Vector3(), head = new T.Vector3(), tail = new T.Vector3();
  let state = null, cursor = 0, previousTime = null, disposed = false, drawn = 0, live = 0;
  const rand = (seed) => { let h = Math.imul((seed | 0) ^ 0x9e3779b9, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  function clear() { pool.forEach((p) => (p.live = false)); live = 0; geometry.setDrawRange(0, 0); drawn = 0; }
  return {
    // shot: { source:'enemy', actorId, at, origin, hitPoint, hit, seed }
    shoot(shot) {
      if (disposed || shot.source !== 'enemy' || !shot.origin || !shot.hitPoint) return;
      const n = shotCount.get(shot.actorId) ?? 0; shotCount.set(shot.actorId, n + 1);
      const p = pool[cursor++ % capacity];
      p.dir.set(shot.hitPoint.x - shot.origin.x, shot.hitPoint.y - shot.origin.y, shot.hitPoint.z - shot.origin.z);
      const dist = p.dir.length(); if (dist < START_AHEAD + 0.5) return; p.dir.multiplyScalar(1 / dist);
      p.start.set(shot.origin.x, shot.origin.y, shot.origin.z).addScaledVector(p.dir, START_AHEAD);
      p.len = dist - START_AHEAD + (shot.hit === false ? MISS_PAST : 0);
      p.end.copy(p.start).addScaledVector(p.dir, p.len);
      p.alpha = (ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * rand(shot.seed ?? n)) * CYCLE[n % CYCLE.length] * ALPHA_SCALE;
      p.at = shot.at; if (!p.live) live++; p.live = true;
    },
    frame(next) { if ((previousTime !== null && next.time < previousTime) || !next.enabled) clear(); previousTime = next.time; state = next; },
    render(renderer, camera) {
      // bot-tracer-perf-v1: nothing alive -> no work at all; no allocations per frame (no closures / array literals);
      // screen size read once per frame; only the used part of the buffers is uploaded.
      if (disposed || !state?.enabled || live === 0) { if (drawn) { drawn = 0; geometry.setDrawRange(0, 0); } return; }
      const now = state.time;
      eye.setFromMatrixPosition(camera.matrixWorld); up.setFromMatrixColumn(camera.matrixWorld, 1); let n = 0;
      const pxPerM = Math.max(1, renderer.getSize ? renderer.getSize(__size).y : 1080) / (2 * Math.tan((camera.fov ?? 70) * Math.PI / 360));
      const minK = MIN_PX * 0.5 / pxPerM, maxK = MAX_PX * 0.5 / pxPerM, halfW = WIDTH * 0.5;
      for (let k = 0; k < capacity; k++) {
        const p = pool[k];
        if (!p.live) continue; const age = now - p.at; if (age < 0) continue;
        const flight = p.len / SPEED; if (age >= flight + POST_IMPACT) { p.live = false; live--; continue; }
        const travelled = Math.min(p.len, age * SPEED);
        const tailAt = age <= flight ? Math.max(0, travelled - STREAK) : Math.min(p.len, Math.max(0, p.len - STREAK) + (age - flight) / POST_IMPACT * STREAK);
        if (travelled - tailAt < 0.05) continue;
        const fade = age <= flight ? 1 : 1 - (age - flight) / POST_IMPACT, alpha = p.alpha * fade; if (alpha < 0.002) continue;
        head.copy(p.start).addScaledVector(p.dir, travelled); tail.copy(p.start).addScaledVector(p.dir, tailAt);
        view.subVectors(eye, head); side.crossVectors(p.dir, view); if (side.lengthSq() < 1e-9) side.copy(up); side.normalize();
        // Width per end: WIDTH far away, never thinner than MIN_PX pixels (far tracers stay visible) and never wider than
        // MAX_PX pixels (bot-tracer-near-v1: a tracer passing next to your camera stays a thin line, not a 20 cm band).
        const dh = Math.max(0.05, eye.distanceTo(head)), dt = Math.max(0.05, eye.distanceTo(tail));
        const hh = Math.max(minK * dh, Math.min(halfW, maxK * dh)), ht = Math.max(minK * dt, Math.min(halfW, maxK * dt));
        const a = n * 12; // uv.x = 0 at the head, 1 at the tail
        const sx = side.x, sy = side.y, sz = side.z;
        positions[a] = head.x + sx * hh; positions[a + 1] = head.y + sy * hh; positions[a + 2] = head.z + sz * hh;
        positions[a + 3] = head.x - sx * hh; positions[a + 4] = head.y - sy * hh; positions[a + 5] = head.z - sz * hh;
        positions[a + 6] = tail.x + sx * ht; positions[a + 7] = tail.y + sy * ht; positions[a + 8] = tail.z + sz * ht;
        positions[a + 9] = tail.x - sx * ht; positions[a + 10] = tail.y - sy * ht; positions[a + 11] = tail.z - sz * ht;
        const b = n * 4; params[b] = params[b + 1] = params[b + 2] = params[b + 3] = alpha; n++;
      }
      drawn = n; geometry.setDrawRange(0, n * 6); if (!n) return;
      if (position.clearUpdateRanges) { position.clearUpdateRanges(); position.addUpdateRange(0, n * 12); alphaAttr.clearUpdateRanges(); alphaAttr.addUpdateRange(0, n * 4); }
      position.needsUpdate = true; alphaAttr.needsUpdate = true;
      const auto = renderer.autoClear; renderer.autoClear = false; try { renderer.render(scene, camera); } finally { renderer.autoClear = auto; }
    },
    clear() { clear(); shotCount.clear(); },
    stats: () => ({ live: pool.filter((p) => p.live).length, drawn }),
    dispose() { disposed = true; clear(); geometry.dispose(); material.dispose(); },
  };
}
const __size = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; return this; } };
