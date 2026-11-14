// Runs the game's own flash-particle code (xm/bm and helpers, cut out of OkAdunfX.js) on a pack and reports, per system,
// how many particles are alive over time and whether any value is NaN/Infinity. Also checks every emitter's front-end
// material exists and its textures are present (site/ or app/site/ aim-viewmodel).
// Usage: node check-pack.mjs <key>   e.g. yru
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../../app');
const key = process.argv[2];
const src = fs.readFileSync(path.join(ROOT, 'site/next/js/OkAdunfX.js'), 'utf8');
const cut = src.slice(src.indexOf('Lr={'), src.indexOf('function km('));
const ui = 33, wn = 0.01;
const api = new Function('ui', 'wn', `const ${cut}; return {xm, bm};`)(ui, wn);
const drAt = src.indexOf('dr={'); let d = 0, k = drAt + 3; for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
const dr = new Function(`return ${src.slice(drAt + 3, k + 1)}`)();
const find = (rel) => [path.join(ROOT, 'site', rel), path.join(ROOT, '../base', rel)].find((f) => fs.existsSync(f));
const packFile = find(`aim-viewmodel/flashfx.${key}.json`);
const pack = JSON.parse(fs.readFileSync(packFile, 'utf8'));
console.log('pack', path.relative(path.join(ROOT, '..'), packFile));
let bad = 0;
for (const [name, sys] of Object.entries(pack.systems)) {
  const counts = [];
  for (let t = 0; t <= 1.5; t += 0.1) {
    let n = 0;
    sys.emitters.forEach((e) => { for (const p of api.xm(e, t, `${key}.${name}`)) { const st = api.bm(e, p, 1, `${key}.${name}`); n++; const flat = [...st.sz, ...st.col, st.alpha, ...st.off, st.rot, st.subIdx, ...st.dyn]; if (flat.some((v) => !Number.isFinite(v))) { bad++; if (bad < 6) console.log('  NaN in', name, e.name, JSON.stringify(st).slice(0, 200)); } } });
    counts.push(n);
  }
  const mats = [...new Set(sys.emitters.map((e) => e.mat))];
  const missingMat = mats.filter((m) => !dr[m]);
  const tex = [...new Set(mats.flatMap((m) => dr[m]?.tex ?? []).filter(Boolean))];
  const missingTex = tex.filter((t) => !find(`aim-viewmodel/flashfx.tex.${t}.png`) && !find(`aim-viewmodel/flashfx.tex.${t}.jpg`));
  const meshes = sys.emitters.filter((e) => e.mesh && !e.decal).map((e) => e.mesh).filter((m) => !pack.meshes[m]);
  console.log(`${name}: ${sys.emitters.length} emitters | alive particles at 0,0.1..1.5 s: ${counts.join(' ')} | mats ${mats.join(',')}${missingMat.length ? ' MISSING MAT ' + missingMat : ''}${missingTex.length ? ' MISSING TEX ' + missingTex : ''}${meshes.length ? ' MISSING MESH ' + meshes : ''}`);
}
console.log(bad ? `${bad} particles with bad numbers` : 'all particle values finite');
