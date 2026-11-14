// Builds an enemy-view flash effect pack (flashfx.<key>.json, read by the game's flash renderer in OkAdunfX.js)
// from FModel JSON exports of Valorant Cascade particle systems. Replaces the other dev's
// tools/flashfx/build_assets.py, which is not in this repo.
//
//   node build-pack.mjs list <ParticleSystem.json> ...        print every emitter (material, type, modules)
//   node build-pack.mjs build <recipe.json> <out-dir>          write flashfx.<key>.json + flashfx.tex.<name>.png
//
// Recipe: { key, exports: "<FModel Exports dir>", systems: { <name>: ["<ps json path rel. to exports>", ...] },
//           materials: { <Unreal material name>: "<front-end mat>" | { mat, decal?, cameraOffset? } },
//           textures: { <front-end texture name>: "<png path rel. to exports>" } }
// Emitters whose material is not in `materials`, disabled LODs and disabled modules are left out.
// Pack format (see bm/xm/et in OkAdunfX.js): values are {c: [...]} constant, {r: [lo, hi]} random per particle,
// {k: [33 samples], kHi?} over the particle's life. Units as in Unreal (cm, turns).
import fs from 'node:fs';
import path from 'node:path';
import { readGlb } from './glb.mjs';

// FModel glTF (metres, Y up) -> pack mesh (Unreal cm, Z up): [x, z, y] * 100, same triangles and UVs
// (checked against SDOME_Cutout2_Mesh in the other dev's flashfx.sky.json).
export function packMesh(file) {
  const m = readGlb(file), r = (v, d) => Math.round(v * d) / d;
  const swap = (a, s, d) => { const o = []; for (let i = 0; i < a.length; i += 3) o.push(r(a[i] * s, d), r(a[i + 2] * s, d), r(a[i + 1] * s, d)); return o; };
  return { pos: swap(m.pos, 100, 100), nrm: swap(m.nrm, 1, 1000), uv: m.uv.map((v) => r(v, 10000)), idx: m.idx };
}

const SAMPLES = 33; // OkAdunfX `ui`
const suffix = (v) => (typeof v === 'string' ? v.split('::').pop() : v);

export function loadSystem(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  // References look like {ObjectName: "Type'pkg:Outer.Name'", ObjectPath: "/Game/....<array index>"}.
  const get = (ref) => {
    if (!ref || typeof ref !== 'object' || !ref.ObjectPath) return null;
    const idx = Number(ref.ObjectPath.split('.').pop());
    const name = (ref.ObjectName.match(/'([^']+)'/)?.[1] ?? ref.ObjectName).split(/[:.]/).pop();
    if (Number.isInteger(idx) && j[idx]?.Name === name) return j[idx];
    return j.find((e) => e.Name === name) ?? null;
  };
  const refName = (ref) => (ref?.ObjectName ? (ref.ObjectName.match(/'([^']+)'/)?.[1] ?? ref.ObjectName).split(/[:.]/).pop() : null);
  const ps = j.find((e) => e.Type === 'ParticleSystem');
  if (!ps) throw new Error(`${file}: no ParticleSystem export`);
  const emitters = (ps.Properties.Emitters ?? []).map((ref) => {
    const em = get(ref);
    if (!em) return null;
    const lod = get(em.Properties?.LODLevels?.[0]);
    const P = lod?.Properties ?? {};
    const req = get(P.RequiredModule), spawn = get(P.SpawnModule), td = get(P.TypeDataModule);
    const modules = (P.Modules ?? []).map(get).filter(Boolean);
    return {
      object: em.Name, name: (em.Properties.EmitterName ?? em.Name).trim(), type: em.Type,
      enabled: lod && P.bEnabled !== false && em.Properties.EmitterRenderMode !== 'EEmitterRenderMode::ERM_None',
      material: refName(req?.Properties?.Material), req: req?.Properties ?? {}, spawn: spawn?.Properties ?? {},
      typeData: td ? { type: td.Type, props: td.Properties ?? {}, mesh: refName(td.Properties?.Mesh) } : null,
      modules: modules.map((m) => ({ type: m.Type.replace('ParticleModule', ''), on: m.Properties?.bEnabled !== false, props: m.Properties ?? {} })),
    };
  }).filter(Boolean);
  return { file, name: path.basename(file, '.json'), emitters, get };
}

// Unreal raw distribution -> pack value. `table` is the baked lookup table FModel writes next to the Distribution.
function dist(prop, sys) {
  if (prop == null) return null;
  const T = prop.Table;
  if (T && Array.isArray(T.Values) && T.Values.length) {
    const op = T.Op ?? 1, n = Math.max(1, T.EntryCount ?? 1), stride = T.EntryStride ?? T.Values.length;
    const sub = op >= 2 ? (T.SubEntryStride || stride / 2) : stride;
    const lo = (i) => T.Values.slice(i * stride, i * stride + sub);
    const hi = (i) => (op >= 2 ? T.Values.slice(i * stride + sub, i * stride + 2 * sub) : lo(i));
    if (n === 1) return op >= 2 ? { r: [lo(0), hi(0)] } : { c: lo(0) };
    // curve: entry i sits at TimeBias + i / TimeScale (life fraction); resample to SAMPLES points over 0..1
    const t0 = T.TimeBias ?? 0, step = T.TimeScale ? 1 / T.TimeScale : 1 / (n - 1);
    const at = (f, u) => { const x = (u - t0) / step; const a = Math.max(0, Math.min(n - 1, Math.floor(x))), b = Math.min(n - 1, a + 1), w = Math.max(0, Math.min(1, x - a)); const A = f(a), B = f(b); return A.map((v, i) => round(v + (B[i] - v) * w)); };
    const us = Array.from({ length: SAMPLES }, (_, i) => i / (SAMPLES - 1));
    const out = { k: us.map((u) => at(lo, u)), x: [round(t0), round(t0 + step * (n - 1))] };
    if (op >= 2) out.kHi = us.map((u) => at(hi, u));
    return out;
  }
  // No baked table: plain Min/Max values or an inline distribution object.
  const D = prop.Distribution && typeof prop.Distribution === 'object' && !prop.Distribution.ObjectPath ? prop.Distribution : sys?.get(prop.Distribution)?.Properties;
  const v3 = (v) => (v && typeof v === 'object' ? [v.X, v.Y, v.Z] : [v]);
  if (D) {
    if ('Constant' in D) return { c: v3(D.Constant) };
    if ('Min' in D && 'Max' in D) return { r: [v3(D.Min), v3(D.Max)] };
    if (D.ConstantCurve?.Points?.length) {
      const pts = D.ConstantCurve.Points.map((p) => ({ t: p.InVal, v: v3(p.OutVal) }));
      const us = Array.from({ length: SAMPLES }, (_, i) => i / (SAMPLES - 1));
      const at = (u) => { if (u <= pts[0].t) return pts[0].v; const last = pts.at(-1); if (u >= last.t) return last.v; const b = pts.findIndex((p) => p.t >= u), a = b - 1, w = (u - pts[a].t) / ((pts[b].t - pts[a].t) || 1); return pts[a].v.map((x, i) => round(x + (pts[b].v[i] - x) * w)); };
      return { k: us.map(at), x: [0, 1] };
    }
  }
  if ('MinValueVec' in prop && 'MaxValueVec' in prop) return { r: [v3(prop.MinValueVec), v3(prop.MaxValueVec)] };
  if ('MinValue' in prop && 'MaxValue' in prop) return prop.MinValue === prop.MaxValue ? { c: [prop.MinValue] } : { r: [[prop.MinValue], [prop.MaxValue]] };
  return null;
}
const round = (v) => Math.round(v * 1e6) / 1e6;
const constOf = (d, fallback = 0) => (d?.c ? d.c[0] : d?.r ? (d.r[0][0] + d.r[1][0]) / 2 : fallback);

export function convertEmitter(e, index, choice, sys) {
  const R = e.req, S = e.spawn;
  const out = {
    name: e.name, mat: choice.mat, material: e.material, delay: R.EmitterDelay ?? 0, duration: R.EmitterDuration ?? 1,
    loops: R.EmitterLoops ?? 0, local: R.bUseLocalSpace === true, align: suffix(R.ScreenAlignment ?? 'PSA_Square'),
    subUV: [R.SubImages_Horizontal ?? 1, R.SubImages_Vertical ?? 1], subInterp: suffix(R.InterpolationMethod ?? 'PSUVIM_None'),
    origin: R.EmitterOrigin ? [R.EmitterOrigin.X, R.EmitterOrigin.Y, R.EmitterOrigin.Z] : null,
    uvFlip: R.UVFlippingMode && suffix(R.UVFlippingMode) !== 'None' ? suffix(R.UVFlippingMode) : null,
    spawnRate: round(constOf(dist(S.Rate, sys)) * constOf(dist(S.RateScale, sys), 1)),
    bursts: (S.BurstList ?? []).map((b) => [b.Count, b.Time ?? 0]),
  };
  if (e.typeData?.type === 'ParticleModuleTypeDataMesh') {
    const t = e.typeData.props;
    Object.assign(out, { mesh: e.typeData.mesh, cameraFacing: t.bCameraFacing === true, facing: suffix(t.CameraFacingOption ?? 'XAxisFacing_NoUp'), faceDir: false, spin: t.bApplyParticleRotationAsSpin === true });
  }
  if (choice.decal === true) out.decal = true;
  if (choice.cameraOffset !== undefined) out.cameraOffset = choice.cameraOffset;
  const set = (k, v) => { if (v) out[k] = v; };
  for (const m of e.modules) {
    if (!m.on) continue;
    const p = m.props;
    switch (m.type) {
      case 'Lifetime': set('life', dist(p.Lifetime, sys)); break;
      case 'Size': set('size', dist(p.StartSize, sys)); break;
      case 'SizeScale': set('sizeScale', dist(p.SizeScale, sys)); break;
      case 'SizeMultiplyLife': set('sizeLife', dist(p.LifeMultiplier, sys)); break;
      case 'Rotation': set('rot', dist(p.StartRotation, sys)); break;
      case 'RotationRate': set('rotRate', dist(p.StartRotationRate, sys)); break;
      case 'MeshRotation': set('meshRot', dist(p.StartRotation, sys)); break;
      case 'Color': set('color', dist(p.StartColor, sys)); set('alpha', dist(p.StartAlpha, sys)); break;
      case 'ColorOverLife': set('colorOver', dist(p.ColorOverLife, sys)); set('alphaOver', dist(p.AlphaOverLife, sys)); break;
      case 'ColorScaleOverLife': set('colorLife', dist(p.ColorScaleOverLife, sys)); set('alphaLife', dist(p.AlphaScaleOverLife, sys)); break;
      case 'Location': set('loc', dist(p.StartLocation, sys)); break;
      case 'Velocity': set('vel', dist(p.StartVelocity, sys)); break;
      case 'LocationPrimitiveSphere':
        out.sphere = { r: constOf(dist(p.StartRadius, sys), 50), surface: p.SurfaceOnly === true, vel: p.Velocity === true, velScale: constOf(dist(p.VelocityScale, sys), 1) };
        break;
      case 'AccelerationDrag': out.drag = constOf(dist(p.DragCoefficientRaw ?? p.DragCoefficient, sys)); break;
      case 'Acceleration': set('accel', dist(p.Acceleration, sys)); break;
      case 'AccelerationConstant': if (p.Acceleration) out.accelC = [p.Acceleration.X ?? 0, p.Acceleration.Y ?? 0, p.Acceleration.Z ?? 0]; break;
      case 'Orbit': out.orbit = { offset: dist(p.OffsetAmount, sys) ?? { c: [0, 0, 0] }, rot: dist(p.RotationAmount, sys) ?? { c: [0, 0, 0] }, rate: dist(p.RotationRateAmount, sys) ?? { c: [0, 0, 0] } }; break;
      case 'SubUV': set('subIndex', dist(p.SubImageIndex, sys)); break;
      case 'CameraOffset': if (choice.cameraOffset === undefined) out.cameraOffset = constOf(dist(p.CameraOffset, sys)); break;
      case 'ParameterDynamic': out.dyn = (p.DynamicParams ?? []).slice(0, 4).map((d) => [d.ParamName ?? '', dist(d.ParamValue, sys) ?? { c: [0] }]); break;
      default: break; // PivotOffset, Kill*, Light, Collision, ... are not drawn by the game
    }
  }
  out.index = index;
  return out;
}

function list(files) {
  for (const f of files) {
    const s = loadSystem(f);
    console.log(`=== ${s.name} (${s.emitters.length} emitters)`);
    s.emitters.forEach((e) => {
      const life = e.modules.find((m) => m.type === 'Lifetime');
      console.log(`  ${e.enabled ? '  ' : 'x '}${e.object.padEnd(26)} "${e.name}"`.padEnd(64) +
        ` mat ${e.material}${e.typeData ? ' ' + e.typeData.type.replace('ParticleModuleTypeData', 'TD:') + (e.typeData.mesh ? '(' + e.typeData.mesh + ')' : '') : ''}` +
        ` | bursts ${JSON.stringify((e.spawn.BurstList ?? []).map((b) => b.Count))} rate ${e.spawn.Rate?.Table?.Values?.[0] ?? 0}` +
        ` | life ${JSON.stringify(life?.props.Lifetime?.Table?.Values ?? null)} | dur ${e.req.EmitterDuration ?? 1} loops ${e.req.EmitterLoops ?? 0}` +
        ` | ${e.modules.map((m) => m.type + (m.on ? '' : '(off)')).join(',')}`);
    });
  }
}

function build(recipeFile, outDir) {
  const recipe = JSON.parse(fs.readFileSync(recipeFile, 'utf8'));
  const base = recipe.exports;
  const pack = { note: `Enemy-view flash effect (generated by tools/flashfx/build-pack.mjs from FModel exports, do not edit by hand): particle systems come from the game files, mat is the front-end shader name`, systems: {}, meshes: {} };
  const report = [];
  for (const [sysName, files] of Object.entries(recipe.systems)) {
    const emitters = [];
    for (const rel of files) {
      const s = loadSystem(path.join(base, rel));
      for (const e of s.emitters) {
        const choice = recipe.materials[e.material];
        if (!e.enabled) { report.push(`${sysName}: skip ${e.name} (${e.object}) disabled`); continue; }
        if (!choice) { report.push(`${sysName}: skip ${e.name} (${e.object}) material ${e.material} not mapped`); continue; }
        const c = typeof choice === 'string' ? { mat: choice } : choice;
        if (e.typeData?.mesh && !c.decal) {
          const rel = recipe.meshes?.[e.typeData.mesh];
          if (!rel || !fs.existsSync(path.join(base, rel))) { report.push(`${sysName}: skip ${e.name} (${e.object}) mesh ${e.typeData.mesh} not exported`); continue; }
          pack.meshes[e.typeData.mesh] ??= packMesh(path.join(base, rel));
        }
        const out = convertEmitter(e, emitters.length, c, s);
        if (e.typeData?.type === 'ParticleModuleTypeDataRibbon') {
          // The game has no ribbons: a ribbon becomes a stream of world-space sprites left along the flight path
          // (the flash renderer places non-local emitters on the item's trail). Rate from SpawnPerUnit at the
          // projectile speed when present.
          const spu = e.modules.find((m) => m.type === 'SpawnPerUnit' && m.on)?.props;
          const perCm = spu ? constOf(dist(spu.SpawnPerUnit, s), 1) / (spu.UnitScalar || 50) : 0;
          Object.assign(out, { local: false, align: 'PSA_Square', spawnRate: round(Math.min(240, Math.max(60, perCm * (recipe.trailSpeedCm ?? 2900)))), duration: 1, loops: 0 });
          report.push(`${sysName}: ribbon ${e.name} -> trail sprites at ${out.spawnRate}/s`);
        }
        emitters.push(out);
      }
    }
    pack.systems[sysName] = { rate: 1, emitters };
    report.push(`${sysName}: ${emitters.length} emitters`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `flashfx.${recipe.key}.json`);
  fs.writeFileSync(out, JSON.stringify(pack));
  for (const [name, rel] of Object.entries(recipe.textures ?? {})) {
    const src = path.join(base, rel), dst = path.join(outDir, `flashfx.tex.${name}.png`);
    if (!fs.existsSync(src)) { report.push(`texture ${name}: MISSING ${rel}`); continue; }
    if (fs.existsSync(dst)) { report.push(`texture ${name}: already there, kept`); continue; }
    fs.copyFileSync(src, dst); report.push(`texture ${name}: copied`);
  }
  console.log(report.join('\n'));
  console.log(`wrote ${out} (${fs.statSync(out).size} bytes)`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'list') list(args);
else if (cmd === 'build') build(args[0], args[1]);
else if (cmd) { console.error('usage: node build-pack.mjs list <ps.json>... | build <recipe.json> <out-dir>'); process.exit(1); }
