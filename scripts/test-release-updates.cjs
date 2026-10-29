const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createUpdater, parseRelease, newer, installerArguments, WEEK } = require('../app/release-updates');
const payload = Buffer.from('a test installer, never executed');
function release(tag = 'v1.2.0') {
  return { tag_name: tag, draft: false, prerelease: false, assets: [{ name: 'AimTrainer-Setup.exe', state: 'uploaded', size: payload.length,
    digest: 'sha256:' + crypto.createHash('sha256').update(payload).digest('hex'),
    browser_download_url: 'https://github.com/unkwsr/open-aim/releases/download/' + tag + '/AimTrainer-Setup.exe' }] };
}
function fixture(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aim-update-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, 'Aim Trainer installed'); fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'AimTrainer.exe'), 'old app');
  const data = path.join(root, 'profile'); fs.mkdirSync(data);
  fs.writeFileSync(path.join(data, 'settings.json'), 'keep these settings');
  const calls = []; let launched;
  const options = { currentVersion: '1.1.1', userData: data, installDirectory: target, supported: true,
    fetchImpl: async url => { calls.push(url); return new Response(url.includes('api.github.com') ? JSON.stringify(release()) : payload); },
    launch: async (file, directory) => { launched = { file, directory }; assert.deepEqual(fs.readFileSync(file), payload); },
    quit: () => calls.push('quit'), ...overrides };
  return { options, updater: createUpdater(options), calls, data, target, get launched() { return launched; } };
}
test('stable versions and official uploaded installer with SHA-256 only', () => {
  assert(newer('v1.10.0', '1.9.9')); assert(!newer('v1.1.1', '1.1.1')); assert(!newer('v1.0.0', '1.1.1'));
  assert(!newer('v2.0.0-beta', '1.1.1')); assert(!newer('main', '1.1.1'));
  assert.equal(parseRelease(release('v1.1.1'), '1.1.1'), null);
  for (const field of ['prerelease', 'draft']) assert.equal(parseRelease({ ...release(), [field]: true }, '1.1.1'), null);
  for (const change of [{ digest: null }, { size: 0 }, { browser_download_url: 'https://example.com/setup.exe' }]) {
    const r = release(); Object.assign(r.assets[0], change); assert.throws(() => parseRelease(r, '1.1.1'), /verified Windows installer/);
  }
});
test('skip survives restart, applies to one version, manual check overrides it', async t => {
  const f = fixture(t); await f.updater.check(); f.updater.dismiss('skip');
  const restarted = createUpdater(f.options); assert.equal((await restarted.check()).release, null);
  assert.equal((await restarted.check(true)).release.version, '1.2.0');
  const next = createUpdater({ ...f.options, fetchImpl: async () => new Response(JSON.stringify(release('v1.3.0'))) });
  assert.equal((await next.check()).release.version, '1.3.0');
});
test('seven-day snooze survives restart, expires, and manual checks bypass it', async t => {
  let time = 1000000; const f = fixture(t, { now: () => time });
  await f.updater.check(); f.updater.dismiss('snooze');
  const restarted = createUpdater(f.options), count = f.calls.length;
  time += WEEK - 1; await restarted.check(); assert.equal(f.calls.length, count);
  assert.equal((await restarted.check(true)).status, 'available');
  time++; assert.equal((await restarted.check()).status, 'available');
});
test('verified update uses selected folder, flushes before launching, preserves settings', async t => {
  const f = fixture(t, { beforeInstall: async () => f.calls.push('flush') });
  const selected = path.join(f.target, 'another folder'); fs.mkdirSync(selected);
  await f.updater.check(); f.updater.selectDirectory(selected); await f.updater.install();
  assert.equal(f.launched.directory, selected); assert(f.calls.indexOf('flush') < f.calls.indexOf('quit'));
  assert.equal(fs.readFileSync(path.join(f.data, 'settings.json'), 'utf8'), 'keep these settings');
  fs.rmSync(path.dirname(f.launched.file), { recursive: true, force: true });
  assert.deepEqual(installerArguments('C:\\My Apps\\AimTrainer'), ['/S', '--updated', '--force-run', '/D=C:\\My Apps\\AimTrainer']);
});
test('corrupt, truncated, oversized and failed downloads never launch or quit', async t => {
  for (const response of [() => new Response(Buffer.alloc(payload.length)), () => new Response('short'), () => new Response(Buffer.alloc(payload.length + 1)), () => new Response('', { status: 503 })]) {
    const f = fixture(t, { fetchImpl: async url => url.includes('api.github.com') ? new Response(JSON.stringify(release())) : response() });
    await f.updater.check(); const result = await f.updater.install(); assert(result.error); assert(!f.launched); assert(!f.calls.includes('quit'));
  }
});
test('cancel is safe and an install can be retried', async t => {
  const f = fixture(t); let first = true;
  f.options.fetchImpl = async (url, options) => {
    if (url.includes('api.github.com')) return new Response(JSON.stringify(release()));
    if (!first) return new Response(payload);
    first = false;
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  };
  const updater = createUpdater(f.options); await updater.check(); const pending = updater.install(); updater.cancel();
  assert.match((await pending).error, /cancelled/); assert(!f.launched);
  await updater.install(); assert(f.launched); fs.rmSync(path.dirname(f.launched.file), { recursive: true, force: true });
});
test('offline, rate limit, missing release, invalid preferences and unsupported build are recoverable', async t => {
  for (const fetchImpl of [async () => { throw Error('fetch failed'); }, async () => new Response('', { status: 403 })]) {
    const f = fixture(t, { fetchImpl }); assert.equal((await f.updater.check()).status, 'error'); assert(!f.launched);
  }
  const f = fixture(t, { supported: false });
  fs.writeFileSync(path.join(f.data, 'release-updates.json'), 'null');
  const updater = createUpdater(f.options); await updater.check(); await assert.rejects(updater.install(), /installed Windows app/);
  const none = createUpdater({ ...f.options, fetchImpl: async () => new Response('', { status: 404 }) });
  assert.equal((await none.check()).status, 'latest');
});
test('rejects unrelated nonempty folders and does not alter their contents', t => {
  const f = fixture(t), folder = path.join(f.target, 'documents'); fs.mkdirSync(folder); fs.writeFileSync(path.join(folder, 'important.txt'), 'keep');
  assert.throws(() => f.updater.selectDirectory(folder), /existing AimTrainer/);
  assert.throws(() => f.updater.selectDirectory(path.parse(f.target).root), /root/);
  assert.equal(fs.readFileSync(path.join(folder, 'important.txt'), 'utf8'), 'keep');
});
test('a blocked installer leaves the app open with a retryable error', async t => {
  const f = fixture(t, { launch: async () => { throw Error('Windows blocked the installer'); } });
  await f.updater.check(); const state = await f.updater.install();
  assert.equal(state.status, 'available'); assert.match(state.error, /Windows blocked/); assert(!f.calls.includes('quit'));
  assert.equal(fs.readdirSync(path.join(f.data, 'update-downloads')).length, 0);
});
test('stale download cleanup keeps recent installers and unrelated data', t => {
  const f = fixture(t), cache = path.join(f.data, 'update-downloads');
  for (const name of ['installer-old', 'installer-recent', 'unrelated']) {
    const directory = path.join(cache, name); fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'file'), 'keep');
    if (name !== 'installer-recent') fs.utimesSync(directory, new Date(0), new Date(0));
  }
  createUpdater(f.options);
  assert(!fs.existsSync(path.join(cache, 'installer-old')));
  assert(fs.existsSync(path.join(cache, 'installer-recent', 'file')));
  assert(fs.existsSync(path.join(cache, 'unrelated', 'file')));
});
test('a failed recheck clears the previous release instead of offering an unusable update', async t => {
  let offline = false;
  const f = fixture(t, { fetchImpl: async () => { if (offline) throw Error('fetch failed'); return new Response(JSON.stringify(release())); } });
  assert.equal((await f.updater.check()).status, 'available'); offline = true;
  const state = await f.updater.check(true);
  assert.equal(state.status, 'error'); assert.equal(state.release, null);
  await assert.rejects(f.updater.install(), /Check for an update/);
});
test('a locked failed download does not leave the UI stuck or start the installer', async t => {
  const f = fixture(t, { fetchImpl: async url => new Response(url.includes('api.github.com') ? JSON.stringify(release()) : 'corrupt') });
  await f.updater.check();
  const remove = fs.rmSync;
  t.mock.method(fs, 'rmSync', (directory, options) => {
    if (String(directory).startsWith(path.join(f.data, 'update-downloads') + path.sep)) throw Object.assign(Error('File locked'), { code: 'EBUSY' });
    return remove(directory, options);
  });
  const state = await f.updater.install();
  assert.equal(state.status, 'available'); assert.match(state.error, /verification failed/); assert(!f.launched);
});
