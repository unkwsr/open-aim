const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function replace(source, before, after) {
  assert.equal(source.split(before).length, 2, 'Hook changed: ' + before.slice(0, 110));
  return source.replace(before, () => after);
}

function loader(source) {
  if (source.includes('/* kuronami-vandal-native-motion */')) return source;
  const edit = (a, b) => { source = replace(source, a, b); };
  edit(
    "if((H==='viewmodel'||H==='vandal')&&(window.__aimVandalSkin||localStorage.getItem('es-vandal-skin'))==='kuronami-vandal-white')return null;",
    "/* kuronami-vandal-native-motion */if(H==='viewmodel'||H==='vandal'){const skin=window.__aimVandalSkin||localStorage.getItem('es-vandal-skin');if(skin==='kuronami-vandal-white')H=skin;}"
  );
  edit("J.skin?.id==='kuronami-vandal-white'?a9.bones[ai]:__aimFrame?", '__aimFrame?');
  const fakeStart = "if(J.skin?.id==='kuronami-vandal-white'){\n  const elapsed=bz.equipAt";
  const start = source.indexOf(fakeStart);
  const end = source.indexOf('__aimReconGrip?.update', start);
  assert(start >= 0 && end > start, 'Procedural equip hook changed');
  source = source.slice(0, start) + source.slice(end);
  edit('const __aimArcane=', `const kuronamiMotion=J.kuronamiVandalMotion;
 const kuronamiInspect=kuronamiMotion?fe(K,L('armsInspect.anim'),J.anims.armsInspect,'once'):null;
 const kuronamiArmBase=kuronamiMotion?new Float32Array(a9.bones.length*7):null;
 const __aimArcane=`);
  edit('bd=(bz,bA)=>{if([', 'bd=(bz,bA)=>{if(kuronamiMotion||[');
  edit('bf=(bz,bA,bB)=>{if([', 'bf=(bz,bA,bB)=>{if(kuronamiMotion||[');
  edit(
    'const elapsed=bb(bz,bC);if(elapsed!==null&&(__aimPose||__aimHH)&&(bz.fpGun?.alt||(__aimHH&&(bz.adsBlend??0)>0))&&elapsed>=(b7.spec.readySeconds??b7.length))',
    `const firedDuringEquip=kuronamiMotion&&bz.equipAt!=null&&bC>=bz.equipAt;
 const elapsed=bb(bz,firedDuringEquip?-Infinity:bC);
 const interrupt= bz.fpGun?.alt||(__aimHH&&(bz.adsBlend??0)>0)||firedDuringEquip;
 if(elapsed!==null&&(__aimPose||__aimHH||kuronamiMotion)&&interrupt&&elapsed>=(b7.spec.readySeconds??b7.length))`
  );
  edit(
    'const __aimFrame=__aimPose&&bz.fpGun&&!bL&&bG===null&&bo===null&&bI===null?bz.fpGun:null;',
    `const inspectEvent=kuronamiInspect?bz.melee?.at(-1):null;
 const inspectTime=inspectEvent?.inspect?bz.seconds-inspectEvent.at:-1;
 const inspecting=!!kuronamiInspect&&inspectTime>=0&&inspectTime<kuronamiInspect.duration&&
   bC<inspectEvent.at&&!bL&&bG===null&&!bA&&!(bz.adsBlend>0)&&!bz.fpGun?.alt;
 const __aimFrame=__aimPose&&bz.fpGun&&!bL&&!inspecting&&bG===null&&bo===null&&bI===null?bz.fpGun:null;`
  );
  edit(
    "if(bL){const __aimReloadTime=J.skin?.id==='prime-guardian'?bK*(aA.armsReload.duration/2.5):bK;aA['armsReload']['sample'](__aimReloadTime,a9['bones']);aA['gunReload']['sample'](__aimReloadTime,ad['bones']);}",
    `if(kuronamiMotion){
   for(const bone of a9.bones)bone.scale.set(1,1,1);
   if(ax)ax.visible=bL;
 }
 if(bL){
   const reloadSeconds=kuronamiMotion?.reloadSeconds??(J.skin?.id==='prime-guardian'?2.5:null);
   const reloadTime=reloadSeconds?bK*aA.armsReload.duration/reloadSeconds:bK;
   aA.armsReload.sample(reloadTime,a9.bones);
   aA.gunReload.sample(reloadTime,ad.bones);
 }`
  );
  edit(
    "if((__aimFrame||__aimHH)&&bz.seconds<__aimEquipBlendAt+__aimEquipBlendSeconds){const u=Math.min(1,Math.max(0,(bz.seconds-__aimEquipBlendAt)/__aimEquipBlendSeconds));bf(a9.bones",
    "if((__aimFrame||__aimHH||kuronamiMotion)&&bz.seconds<__aimEquipBlendAt+__aimEquipBlendSeconds){const u=Math.min(1,Math.max(0,(bz.seconds-__aimEquipBlendAt)/__aimEquipBlendSeconds));bf(a9.bones"
  );
  edit(
    "if((__aimFrame||__aimHH)&&bz.seconds<__aimEquipBlendAt+__aimEquipBlendSeconds){const u=Math.min(1,Math.max(0,(bz.seconds-__aimEquipBlendAt)/__aimEquipBlendSeconds));if(__aimHH)bf",
    "if((__aimFrame||__aimHH||kuronamiMotion)&&bz.seconds<__aimEquipBlendAt+__aimEquipBlendSeconds){const u=Math.min(1,Math.max(0,(bz.seconds-__aimEquipBlendAt)/__aimEquipBlendSeconds));if(__aimHH)bf"
  );
  edit(
    'if(__aimArcane&&!bL&&bG===null&&!bA){',
    `if(inspecting){
   const weight=Math.min(1,inspectTime/kuronamiMotion.inspectBlendIn,
     (kuronamiInspect.duration-inspectTime)/kuronamiMotion.inspectBlendOut);
   bd(a9.bones,kuronamiArmBase);
   kuronamiInspect.sample(inspectTime,a9.bones);
   bf(a9.bones,kuronamiArmBase,1-weight);
 }
 if(__aimArcane&&!bL&&bG===null&&!bA){`
  );
  return source;
}

function runtime(source) {
  if (source.includes('/* kuronami-vandal-inspect */')) return source;
  source = replace(source,
    "Ye()==='vandal'&&window.__aimVandalSkin?.startsWith('primordium-vandal')",
    "Ye()==='vandal'&&(window.__aimVandalSkin?.startsWith('primordium-vandal')||window.__aimVandalSkin==='kuronami-vandal-white'&&!je.fire&&at===0)"
  );
  return replace(source, 'const Ae=__aimTime("snapshot",()=>hs(de));',
    'const Ae=__aimTime("snapshot",()=>hs(de));/* kuronami-vandal-inspect */if(window.__aimVandalSkin==="kuronami-vandal-white"&&Ye()==="vandal"&&(Ae.reloadSince!=null||at>0)&&en.at(-1)?.inspect)en.length=0;');
}

const root = path.resolve(__dirname, '..');
const routes = ['next/js', '_assets/r20261021-1/next/js'];
const updates = [];
for (const [name, patch] of [['DXHU7cEs.js', loader], ['OkAdunfX.js', runtime]]) {
  for (const route of routes) {
    const file = path.join(root, 'app/site', route, name);
    const original = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
    updates.push({ file, route, name, patched: patch(original) });
  }
  assert.equal(updates.at(-1).patched, updates.at(-2).patched, name + ' routes differ');
}
for (const { file, route, name, patched } of updates) {
  const backup = path.join(root, 'previews/kuronami-vandal/before', route, name);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  fs.writeFileSync(file, patched);
}
console.log('Kuronami Vandal motion installed on both game routes.');
