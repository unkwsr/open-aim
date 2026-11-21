// tools/collection-stills.mjs: Collection previews rendered from each skin's own model.
//
// The Collection shows app/site/aim-ui/collection/<weapon>--<skin>.webp. Skins imported in bulk only
// have a colour atlas, so this draws the gun mesh with that atlas from the side, as the hand-made
// previews show it, and saves a 1200x520 transparent WebP.
//
// Needs the app running with a debugging port (it renders in the app's own page, with its three.js):
//   cd app && npx electron . --port=8146 --remote-debugging-port=9227
//   node tools/collection-stills.mjs            every skin whose preview is missing or is a raw atlas
//   node tools/collection-stills.mjs a30-classic afterglow3-sheriff   only these
//   --port=9227  --out=<folder>  --sheet=<folder> (also saves contact sheets of the batch there)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = name => (args.find(a => a.startsWith(`--${name}=`)) || '').split('=')[1];
const port = opt('port') || '9227';
const out = path.resolve(opt('out') || path.join(root, 'app/site/aim-ui/collection'));
const sheets = opt('sheet') && path.resolve(opt('sheet'));
const only = args.filter(a => !a.startsWith('--'));
const W = 1200, H = 520;

// Weapons and skins as the Collection lists them.
const source = fs.readFileSync(path.join(root, 'app/collection.js'), 'utf8');
const weapons = [...source.matchAll(/\{ id: "([a-z]+)", label: "[^"]+", key: "[^"]+", global: "[^"]+", fallback: "[^"]+", skins: \[([\s\S]*?)\n\s*\] \}/g)]
  .map(m => ({ weapon: m[1], skins: [...m[2].matchAll(/\{ id: "([^"]+)"/g)].map(s => s[1]) }));
// ...and the imported skins, which the Collection reads from its list (docs/imported-skins.md).
const imported = JSON.parse(fs.readFileSync(path.join(root, 'app/site/aim-ui/collection/imported.json'), 'utf8'));
for (const [weapon, skins] of Object.entries(imported)) {
  let entry = weapons.find(w => w.weapon === weapon);
  if (!entry) weapons.push(entry = { weapon, skins: ['default'] });
  for (const skin of skins) if (!entry.skins.includes(skin.id)) entry.skins.push(skin.id);
}

function webpSize(file) {
  const b = fs.readFileSync(file), kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  const v = b.readUInt32LE(21);
  return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)];
}

// The model a skin id loads: "<id>.json", or the weapon's own for its default skin.
const models = path.join(root, 'app/site/aim-viewmodel'), base = path.join(root, 'base/aim-viewmodel');
function modelOf(weapon, id) {
  for (const stem of [id, weapon]) {
    for (const dir of [models, base]) {
      const file = path.join(dir, `${stem}.json`);
      if (!fs.existsSync(file)) continue;
      const gun = JSON.parse(fs.readFileSync(file, 'utf8')).gun;
      return gun && gun.texture ? stem : null;
    }
    if (id !== 'default' && !id.startsWith('default-')) break;
  }
  return null;
}

const jobs = [];
for (const { weapon, skins } of weapons) {
  if (weapon === 'melee') continue; // knives are not framed like guns; their previews are made by hand
  for (const id of skins) {
    const file = path.join(out, `${weapon}--${id}.webp`);
    if (only.length ? !only.includes(id) && !only.includes(`${weapon}--${id}`) : fs.existsSync(file) && String(webpSize(file)) === `${W},${H}`) continue;
    const stem = modelOf(weapon, id);
    if (stem) jobs.push({ weapon, id, stem });
    else if (only.length || !fs.existsSync(file)) console.log(`skipped ${weapon}--${id}: no model with a texture to draw`);
  }
}
if (!jobs.length) { console.log('nothing to render'); process.exit(0); }

// Runs in the app's page.
const inPage = async (list, W, H) => {
  const THREE = await import('/studio/vendor/three.module.js');
  const S = 2; // supersampling
  const state = window.__stills || (window.__stills = (() => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(W * S, H * S, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    return { renderer, canvas };
  })());
  const { renderer, canvas } = state;
  const results = {};
  for (const job of list) {
    try {
      const fresh = { cache: 'reload' }; // a re-imported skin keeps its file names
      const j = await (await fetch(`/aim-viewmodel/${job.stem}.json`, fresh)).json();
      const bin = new Uint8Array(await (await fetch(`/aim-viewmodel/${job.stem}.bin`, fresh)).arrayBuffer());
      const spec = j.gun, verts = spec.verts;
      let p = j.offsets['gun.mesh'][0];
      const floats = n => { const a = new Float32Array(bin.buffer.slice(p, p + n * 4)); p += n * 4; return a; };
      const pos = floats(verts * 3), nrm = floats(verts * 3), uv = floats(verts * 2);
      const skinIndex = bin.slice(p, p + verts * 4); p += verts * 4;
      const skinWeight = Float32Array.from(bin.slice(p, p + verts * 4), v => v / 255); p += verts * 4;
      const index = new Uint16Array(bin.buffer.slice(p, p + spec.tris * 6));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
      geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
      geometry.setIndex(new THREE.BufferAttribute(index, 1));

      const sk = spec.skeleton;
      const bones = sk.names.map((name, i) => {
        const b = new THREE.Bone();
        b.name = name;
        b.position.fromArray(sk.t, i * 3);
        b.quaternion.fromArray(sk.q, i * 4);
        return b;
      });
      let rootBone = bones[0];
      bones.forEach((b, i) => { if (sk.parents[i] < 0) rootBone = b; else bones[sk.parents[i]].add(b); });

      const map = await new THREE.TextureLoader().loadAsync(`/aim-viewmodel/${spec.texture}?v=${Date.now()}`);
      map.colorSpace = THREE.SRGBColorSpace;
      map.flipY = false;
      map.wrapS = map.wrapT = THREE.RepeatWrapping; // as the game samples it: some skins tile their atlas
      map.anisotropy = 8;
      const material = new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
      const mesh = new THREE.SkinnedMesh(geometry, material);
      rootBone.add(mesh);
      rootBone.updateMatrixWorld(true);
      mesh.bind(new THREE.Skeleton(bones));

      // Frame it from its left side, barrel pointing left, turned a little towards the viewer.
      // Every gun mesh shares the same axes once it hangs from its root bone: +Y along the barrel,
      // +X up, Z across.
      const scene = new THREE.Scene();
      scene.add(rootBone);
      scene.updateMatrixWorld(true);
      mesh.skeleton.update();
      const up = new THREE.Vector3(1, 0, 0), right = new THREE.Vector3(0, -1, 0), toCamera = new THREE.Vector3(0, 0, 1);
      toCamera.applyAxisAngle(up, -0.24).applyAxisAngle(right, -0.1);
      const camera = new THREE.OrthographicCamera();
      camera.up.copy(up);
      camera.position.copy(toCamera);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      const view = new THREE.Box3(), v = new THREE.Vector3();
      for (let i = 0; i < verts; i++) view.expandByPoint(mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse));
      const size = view.getSize(new THREE.Vector3()), middle = view.getCenter(new THREE.Vector3());
      const fit = Math.max(size.x / (W * 0.88), size.y / (H * 0.8));
      camera.left = middle.x - W * fit / 2; camera.right = middle.x + W * fit / 2;
      camera.top = middle.y + H * fit / 2; camera.bottom = middle.y - H * fit / 2;
      const reach = size.length();
      camera.position.multiplyScalar(reach * 2);
      camera.near = 0.01; camera.far = reach * 6;
      camera.updateProjectionMatrix();

      scene.add(new THREE.HemisphereLight(0xffffff, 0x59616e, 1.9));
      const key = new THREE.DirectionalLight(0xffffff, 1.9);
      key.position.copy(toCamera).addScaledVector(up, 1.1).addScaledVector(right, -0.5);
      const rim = new THREE.DirectionalLight(0xcfe0ff, 1.2);
      rim.position.copy(toCamera).multiplyScalar(-0.6).addScaledVector(up, 0.8).addScaledVector(right, 0.6);
      scene.add(key, rim);

      // Near-black guns vanish on the dark page: when the picture is too dark, expose it up once.
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingQuality = 'high';
      const draw = exposure => {
        renderer.toneMappingExposure = exposure;
        renderer.render(scene, camera);
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(renderer.domElement, 0, 0, W, H);
      };
      draw(1);
      const px = ctx.getImageData(0, 0, W, H).data;
      let light = 0, count = 0;
      for (let i = 0; i < px.length; i += 16) if (px[i + 3] > 128) { light += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; count++; }
      const mean = count ? light / count : 255;
      if (mean < 62) draw(Math.min(3, 62 / Math.max(mean, 1)));
      results[job.id + '@' + job.weapon] = canvas.toDataURL('image/webp', 0.9);
      (state.done || (state.done = {}))[job.id + '@' + job.weapon] = results[job.id + '@' + job.weapon];
      geometry.dispose(); material.dispose(); map.dispose();
    } catch (error) {
      results[job.id + '@' + job.weapon] = 'ERR:' + (error && error.message || error);
    }
  }
  return results;
};

const getJson = url => new Promise((resolve, reject) => {
  http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject);
});
const targets = await getJson(`http://127.0.0.1:${port}/json`).catch(() => null);
const target = targets && targets.find(t => t.type === 'page' && t.url.includes('/aim'));
if (!target) { console.error(`No app page on debugging port ${port}. Start the app with --remote-debugging-port=${port}.`); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
ws.onmessage = event => { const m = JSON.parse(event.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const evaluate = expression => new Promise(resolve => {
  const id = ++nextId;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
});

fs.mkdirSync(out, { recursive: true });
let saved = 0;
const failed = [];
for (let i = 0; i < jobs.length; i += 6) {
  const chunk = jobs.slice(i, i + 6);
  const reply = await evaluate(`(${inPage})(${JSON.stringify(chunk)}, ${W}, ${H})`);
  const values = reply.result?.result?.value || {};
  if (reply.result?.exceptionDetails) console.log('page error:', reply.result.exceptionDetails.exception?.description?.slice(0, 300));
  for (const job of chunk) {
    const data = values[job.id + '@' + job.weapon];
    if (typeof data === 'string' && data.startsWith('data:image/webp')) {
      fs.writeFileSync(path.join(out, `${job.weapon}--${job.id}.webp`), Buffer.from(data.split(',')[1], 'base64'));
      saved++;
    } else failed.push(`${job.weapon}--${job.id}: ${String(data).slice(0, 80)}`);
  }
  process.stdout.write(`\r${Math.min(i + 6, jobs.length)}/${jobs.length}`);
}
console.log(`\nsaved ${saved} previews to ${out}${failed.length ? `, ${failed.length} failed:\n  ${failed.join('\n  ')}` : ''}`);

// Contact sheets, to look over the whole batch.
if (sheets) {
  fs.mkdirSync(sheets, { recursive: true });
  for (let n = 0; n * 40 < jobs.length; n++) {
    const part = jobs.slice(n * 40, n * 40 + 40);
    const reply = await evaluate(`(async (list) => {
      const c = document.createElement('canvas'); c.width = 5 * 320; c.height = Math.ceil(list.length / 5) * 156;
      const x = c.getContext('2d'); x.fillStyle = '#0d1016'; x.fillRect(0, 0, c.width, c.height); x.font = '12px sans-serif';
      for (let i = 0; i < list.length; i++) {
        const img = new Image(); img.src = (window.__stills.done || {})[list[i].id + '@' + list[i].weapon] || '';
        try { await img.decode(); x.drawImage(img, (i % 5) * 320, Math.floor(i / 5) * 156, 320, 139); } catch {}
        x.fillStyle = '#9aa5b3'; x.fillText(list[i].weapon + ' / ' + list[i].id, (i % 5) * 320 + 8, Math.floor(i / 5) * 156 + 150);
      }
      return c.toDataURL('image/jpeg', 0.8);
    })(${JSON.stringify(part)})`);
    const data = reply.result?.result?.value;
    if (data) fs.writeFileSync(path.join(sheets, `sheet-${String(n + 1).padStart(2, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
  }
  await evaluate('window.__stills.done = {}');
  console.log(`contact sheets in ${sheets}`);
}
ws.close();
