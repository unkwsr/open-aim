import * as T from '/studio/vendor/three.module.js';
import swirl from './bladestorm-swirl.mjs';

const capacity = 24;
const lifetime = .4; // Midpoint of the enabled Wushu BeamTrail's .3–.5 s range.
const root = new URL('.', import.meta.url);
let windTexture;
function getWindTexture() {
  return windTexture ??= new T.TextureLoader().load(new URL('bladestorm-wind.png', root).href);
}

export function createBladeStormTracer({ muzzle, rayBlocked } = {}) {
  const scene = new T.Scene();
  const positions = new Float32Array(capacity * 12), params = new Float32Array(capacity * 12);
  const uv = new Float32Array(capacity * 8), indices = new Uint16Array(capacity * 6);
  for (let i = 0; i < capacity; i++) {
    const v = i * 4;
    uv.set([0,0,0,1,1,0,1,1], i * 8);
    indices.set([v,v+1,v+2,v+2,v+1,v+3], i * 6);
  }
  const beamGeometry = new T.BufferGeometry();
  beamGeometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
  beamGeometry.setAttribute('beamParams', new T.BufferAttribute(params, 3).setUsage(T.DynamicDrawUsage));
  beamGeometry.setAttribute('uv', new T.BufferAttribute(uv, 2));
  beamGeometry.setIndex(new T.BufferAttribute(indices, 1));
  const wind = getWindTexture();
  const common = { transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false };
  const beamMaterial = new T.ShaderMaterial({
    ...common, uniforms: { wind: { value: wind } },
    vertexShader: `
      attribute vec3 beamParams;
      varying vec3 vBeam;
      varying vec2 vUv;
      void main(){vUv=uv;vBeam=beamParams;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader: `
      uniform sampler2D wind;
      varying vec3 vBeam;
      varying vec2 vUv;
      void main(){
        float edge=abs(vUv.y-.5);
        float taper=smoothstep(0.,.06,vUv.x)*(1.-smoothstep(.75,1.,vUv.x));
        float pattern=texture2D(wind,vec2(fract(vUv.x*vBeam.z-vBeam.x*4.),vUv.y)).r;
        float core=1.-smoothstep(.015,.09,edge);
        float ribbon=pattern*(1.-smoothstep(.08,.5,edge));
        float alpha=(core*.85+ribbon*.65)*vBeam.y*taper;
        gl_FragColor=vec4(mix(vec3(.30,.63,1.),vec3(.88,.97,1.),core),alpha);
      }
    `
  });
  const beam = new T.Mesh(beamGeometry, beamMaterial);
  beam.frustumCulled = false;
  scene.add(beam);

  const swirlGeometry = new T.BufferGeometry();
  const normalized = swirl.positions.map((value, i) => i % 3 === 2 ? (value - 70) / 160 : value / 150);
  swirlGeometry.setAttribute('position', new T.Float32BufferAttribute(normalized, 3));
  swirlGeometry.setAttribute('uv', new T.Float32BufferAttribute(swirl.uvs, 2));
  swirlGeometry.setIndex(swirl.indices);
  const fades = new Float32Array(capacity);
  swirlGeometry.setAttribute('fade', new T.InstancedBufferAttribute(fades, 1).setUsage(T.DynamicDrawUsage));
  const swirlMaterial = new T.ShaderMaterial({
    ...common, uniforms: { wind: { value: wind } },
    vertexShader: `
      attribute float fade;
      varying float vFade;
      varying vec2 vUv;
      void main(){vFade=fade;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}
    `,
    fragmentShader: `
      uniform sampler2D wind;
      varying float vFade;
      varying vec2 vUv;
      void main(){float mask=texture2D(wind,vUv).r;gl_FragColor=vec4(.38,.73,1.,mask*vFade*.42);}
    `
  });
  const twists = new T.InstancedMesh(swirlGeometry, swirlMaterial, capacity);
  twists.instanceMatrix.setUsage(T.DynamicDrawUsage);
  twists.frustumCulled = false;
  scene.add(twists);

  const pool = Array.from({ length: capacity }, () => ({
    start: new T.Vector3(), end: new T.Vector3(), axis: new T.Vector3(), at: 0, live: false, burst: false
  }));
  const pending = [], eye = new T.Vector3(), side = new T.Vector3(), near = new T.Vector3();
  const object = new T.Object3D(), forward = new T.Vector3(0, 0, 1);
  let state, cursor = 0, drawn = 0, disposed = false;
  function clear() {
    pending.length = 0;
    for (const trail of pool) trail.live = false;
    beamGeometry.setDrawRange(0, 0);
    twists.count = drawn = 0;
  }
  clear();

  return {
    shoot(shot) {
      if (disposed || shot.source === 'enemy' || shot.weapon !== 'bladestorm') return;
      if (pending.length === capacity) pending.shift();
      pending.push(shot);
    },
    frame(next) {
      if (!next.enabled || state && next.time < state.time) clear();
      state = next;
    },
    render(renderer, camera) {
      if (disposed || !state?.enabled) return;
      const now = state.time;
      for (let i = 0; i < pending.length;) {
        const shot = pending[i];
        if (shot.at > now) { i++; continue; }
        pending.splice(i, 1);
        if (now - shot.at >= lifetime) continue;
        const trail = pool[cursor++ % capacity];
        trail.live = false;
        trail.start.copy(state.weapon === 'bladestorm' ? muzzle?.(camera, shot.knifeIndex) ?? shot.origin : shot.origin);
        if (shot.hitPoint) trail.end.copy(shot.hitPoint);
        else trail.end.copy(shot.origin).addScaledVector(near.copy(shot.direction).normalize(), 100);
        trail.axis.subVectors(trail.end, trail.start);
        if (trail.axis.lengthSq() < .001) continue;
        trail.axis.normalize();
        near.copy(trail.start).addScaledVector(trail.axis, .1);
        if (rayBlocked?.(trail.start, near)) continue;
        trail.at = shot.at;
        trail.burst = shot.burst === true;
        trail.live = true;
      }
      eye.setFromMatrixPosition(camera.matrixWorld);
      let count = 0;
      for (const trail of pool) {
        if (!trail.live) continue;
        const age = now - trail.at;
        if (age < 0 || age >= lifetime) { trail.live = false; continue; }
        const fade = (1 - age / lifetime) ** 2;
        side.crossVectors(trail.axis, near.subVectors(eye, trail.start));
        if (side.lengthSq() < 1e-9) side.setFromMatrixColumn(camera.matrixWorld, 1);
        side.normalize().multiplyScalar(trail.burst ? .04 : .075);
        for (let vertex = 0; vertex < 4; vertex++) {
          const point = vertex < 2 ? trail.start : trail.end;
          near.copy(point).addScaledVector(side, vertex % 2 ? -1 : 1).toArray(positions, count * 12 + vertex * 3);
          params.set([age, fade * (trail.burst ? .72 : 1), Math.max(1, trail.start.distanceTo(trail.end) / 4)], count * 12 + vertex * 3);
        }
        object.position.copy(trail.start).addScaledVector(trail.axis, .34 + age * 2);
        object.quaternion.setFromUnitVectors(forward, trail.axis);
        object.rotateZ(age * 12);
        object.scale.set(.22 + age * .4, .22 + age * .4, .85);
        object.updateMatrix();
        twists.setMatrixAt(count, object.matrix);
        fades[count] = fade;
        count++;
      }
      drawn = count;
      beamGeometry.setDrawRange(0, count * 6);
      twists.count = count;
      if (!count) return;
      beamGeometry.attributes.position.needsUpdate = beamGeometry.attributes.beamParams.needsUpdate = true;
      swirlGeometry.attributes.fade.needsUpdate = twists.instanceMatrix.needsUpdate = true;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      try { renderer.render(scene, camera); }
      finally { renderer.autoClear = autoClear; }
    },
    clear,
    stats: () => ({ drawn, pending: pending.length, capacity }),
    dispose() {
      disposed = true;
      clear();
      beamGeometry.dispose(); beamMaterial.dispose();
      twists.dispose(); swirlGeometry.dispose(); swirlMaterial.dispose();
    }
  };
}
