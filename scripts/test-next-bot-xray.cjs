const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { transform, EDITS, HELPER } = require('../tools/patch-next-bot-xray.cjs');
const DIRS = ['app/site/next/js', 'app/site/_assets/r20261021-1/next/js'];
const read = (dir, name) => fs.readFileSync(path.join(__dirname, '..', dir, name), 'utf8');
// The bundle before next-bot-xray-v1, rebuilt by undoing each edit (each must be there exactly once).
function unpatched(name, s) {
  for (const [a, b] of EDITS[name]) { assert.equal(s.split(b).length - 1, 1, `${name}: patched text missing: ${b.slice(0, 60)}`); s = s.replace(b, () => a); }
  return s;
}
for (const name of Object.keys(EDITS)) {
  test(`${name}: both copies carry the patch, and re-running it changes nothing`, () => {
    const s = read(DIRS[0], name);
    assert.equal(read(DIRS[1], name), s);
    assert.equal(transform(name, s), s);
    assert.equal(transform(name, unpatched(name, s)), s);
  });
  test(`${name}: the patched bundle still parses as a module`, t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aim-next-bot-xray-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, name.replace(/\.js$/, '.mjs')); fs.writeFileSync(file, read(DIRS[0], name));
    const run = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
  });
}
test('the aid is listed after the guide line, labelled, and off by default in Easy and other drills', () => {
  const s = read(DIRS[0], 'OkAdunfX.js');
  assert.ok(s.includes('fa=["killOrder","aimLine","nextBotXray","minimapBots"]'));
  assert.ok(s.includes('rs={headLines:!1,killOrder:!1,aimLine:!1,nextBotXray:!1,minimapBots:!1}'));
  assert.ok(s.includes('Vi={easy:{...ao,/* next-bot-xray-v1: off until asked for */nextBotXray:!1},other:rs}'));
  assert.ok(s.includes('default:return{easy:{...Vi.easy},other:{...rs}}'));
  assert.ok(s.includes('nextBotXray:{label:"Next bot through walls",hint:"'));
  for (const f of ['ja', 'ko', 'zh']) {
    const strings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'i18n', f + '.json'), 'utf8'));
    assert.ok(strings['Next bot through walls'], f + ': label');
    assert.ok(Object.keys(strings).some(k => k.startsWith('The next bot in the kill order glows through walls')), f + ': hint');
  }
});
// __aimXraySet / __aimXrayMaterial from the CnrSARj_ helper, with stand-ins for the three.js classes it uses.
function xray() {
  class Material { constructor(p = {}) { Object.assign(this, p); } }
  class Mesh { constructor(geometry, material) { Object.assign(this, { geometry, material, children: [], renderOrder: 0, visible: true }); } add(c) { this.children.push(c); c.parent = this; } }
  class SkinnedMesh extends Mesh { constructor(g, m) { super(g, m); this.isSkinnedMesh = true; } bind(skeleton, bindMatrix) { this.skeleton = skeleton; this.bindMatrix = bindMatrix; } }
  const wQ = shader => { shader.fragmentShader += '\n/* enemy highlight */'; };
  const make = new Function('zD', 'wQ', 'b8', 'RA', HELPER + '\nreturn { set: __aimXraySet, material: __aimXrayMaterial };');
  return { ...make(Material, wQ, SkinnedMesh, Mesh), Mesh, SkinnedMesh };
}
function bot(x) {
  const body = new x.SkinnedMesh('body', 'skin');
  body.skeleton = 'skeleton'; body.bindMatrix = 'bind';
  return { body, entry: { mesh: { parts: [body] } } };
}
test('the next bot gets an x-ray twin on its own pose, drawn between the map and the real bot', () => {
  const x = xray(), { body, entry } = bot(x);
  x.set(entry, false);
  assert.equal(body.children.length, 0);
  assert.equal(entry.__aimXray, false);
  x.set(entry, true);
  const [twin] = body.children;
  assert.ok(twin instanceof x.SkinnedMesh);
  assert.deepEqual([twin.geometry, twin.skeleton, twin.bindMatrix], ['body', 'skeleton', 'bind']);
  assert.deepEqual([twin.visible, twin.renderOrder, body.renderOrder, entry.__aimXray], [true, 1, 2, true]);
  assert.deepEqual([twin.frustumCulled, twin.castShadow, twin.receiveShadow], [false, false, false]);
  const m = twin.material;
  assert.deepEqual([m.depthTest, m.depthWrite, m.toneMapped, m.fog, !!m.transparent], [false, false, false, false, false]);
  assert.deepEqual([m.blending, m.blendSrc, m.blendDst], [5, 204, 205]);
});
test('switching it off hides the twin and restores the draw order; switching back on reuses the twin', () => {
  const x = xray(), { body, entry } = bot(x);
  x.set(entry, true);
  x.set(entry, false);
  assert.deepEqual([body.children[0].visible, body.renderOrder, entry.__aimXray], [false, 0, false]);
  x.set(entry, true);
  assert.equal(body.children.length, 1);
  assert.deepEqual([body.children[0].visible, body.renderOrder], [true, 2]);
});
test('the twin follows a body that loads its look later, and Dot bots get a plain mesh twin', () => {
  const x = xray(), { body, entry } = bot(x);
  x.set(entry, true);
  body.geometry = 'agent look';
  x.set(entry, true);
  assert.equal(body.children[0].geometry, 'agent look');
  const ball = new x.Mesh('sphere', 'glow'), dot = { mesh: { parts: [ball] } };
  x.set(dot, true);
  assert.ok(ball.children[0] instanceof x.Mesh && !ball.children[0].isSkinnedMesh);
  assert.equal(ball.children[0].geometry, 'sphere');
});
test('one shared material: the edge glow goes after tone mapping, then the enemy highlight patch adds its colour', () => {
  const x = xray(), a = x.material();
  assert.equal(x.material(), a);
  const shader = { fragmentShader: 'main {\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' };
  a.onBeforeCompile(shader);
  const s = shader.fragmentShader;
  assert.ok(s.indexOf('#include <tonemapping_fragment>') < s.indexOf('alXrEdge') && s.indexOf('alXrEdge') < s.indexOf('#include <colorspace_fragment>'));
  assert.ok(s.includes('gl_FragColor = vec4( alHlColor,'));
  assert.ok(s.includes('/* enemy highlight */'));
  assert.equal(a.customProgramCacheKey(), 'al-next-bot-xray');
});
