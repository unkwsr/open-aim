const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse, crosshair } = require('../app/valorant-import');
const file = (text, name = 'RiotUserSettings.ini') => ({ name, text });
test('imports explicit settings only, preserving missing values and zero volume', () => {
  const result = parse([file('[Settings]\nEAresFloatSettingName::MouseSensitivity=0.390079945\nEAresFloatSettingName::OverallVolume=0\nEAresBoolSettingName::LeftHanded=True\nEAresIntSettingName::ColorBlindMode=2')]);
  assert.deepEqual(result.changes.map(c => [c.field, c.value]), [['value', .390079945], ['volume', 0], ['viewModelHand', 'left'], ['enemyHighlightColor', '#ffec03']]);
  assert.equal(result.changes.some(c => c.field === 'maxFps'), false);
});
test('rejects duplicate accounts, unrecognized files, oversized data and invalid numbers', () => {
  assert.throws(() => parse([file(''), file('')]), /one copy/);
  assert.throws(() => parse([file('', 'other.ini')]), /Select/);
  assert.throws(() => parse([file('a'.repeat(2097153))]), /2 MB/);
  const r = parse([file('[Settings]\nEAresFloatSettingName::MouseSensitivity=Infinity\nEAresBoolSettingName::LeftHanded=0')]);
  assert.equal(r.changes.length, 0); assert.ok(r.warnings.length >= 2);
});
test('reads quoted profile JSON and selects the active profile, escaping names only in UI', () => {
  const p = { profileName: '<img src=x>', bUseAdvancedOptions: true, bUsePrimaryCrosshairForADS: false, primary: { color: { r: 0, g: 255, b: 255 }, bHasOutline: false, innerLines: { lineLength: 3, lineLengthVertical: 4, bAllowVertScaling: true, bShowLines: true } }, aDS: { bDisplayCenterDot: true }, sniper: { centerDotSize: .8, bDisplayCenterDot: true } };
  const data = JSON.stringify(JSON.stringify({ currentProfile: 1, profiles: [{ ...p, profileName: 'Other' }, p] }));
  const r = parse([file('[Settings]\nEAresStringSettingName::SavedCrosshairProfileData=' + data)]);
  assert.equal(r.profiles[1].selected, true); assert.equal(r.profiles[0].selected, false);
  assert.match(r.profiles[1].code, /^0;p;0;s;1;P;c;8;b;1;u;00ffffff;h;0/);
  assert.match(r.profiles[1].code, /0v;4;0g;1/); assert.match(r.profiles[1].code, /A;d;1;S;d;1;s;0.8/);
  assert.throws(() => crosshair(null));
});
test('broken crosshair data does not prevent independent sensitivity import', () => {
  const r = parse([file('[Settings]\nEAresStringSettingName::SavedCrosshairProfileData=bad\nEAresFloatSettingName::MouseSensitivity=0.5')]);
  assert.equal(r.profiles.length, 0); assert.equal(r.changes.length, 1);
  assert.ok(r.warnings.some(w => w.includes('could not be read')));
});
test('preserves explicit unbinds and skips chords, agent profiles and unknown keys', () => {
  const b = (name, key, extra = {}) => ({ name, key, bindIndex: 1, characterName: 'None', ...extra });
  const r = parse([file(JSON.stringify({ actionMappings: [b('Jump', 'MouseScrollUp'), b('Inspect', 'None'), b('Fire', 'LeftMouseButton', { ctrl: true }), b('Jump', 'A', { characterName: 'Jett' }), b('__proto__', 'A'), b('Jump', 'Unknown')] }), 'BackupKeybinds.json')]);
  assert.deepEqual(r.changes.map(c => [c.field, c.value]), [['jump:1', 'WheelUp'], ['inspect:1', null]]);
  assert.equal(r.unhandled, 4);
});
test('maps display resolution and VSync without copying stale FPS caps', () => {
  const r = parse([file('[/Script/ShooterGame.ShooterGameUserSettings]\nResolutionSizeX=1920\nResolutionSizeY=1080\nbUseVSync=False\nbShouldLetterbox=True\nFrameRateLimit=20', 'GameUserSettings.ini')]);
  assert.deepEqual(r.changes.map(c => [c.field, c.value]), [['vsync', false], ['aspectMethod', 'letterbox'], ['resolution', '1920x1080']]);
});
