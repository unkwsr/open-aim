const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function replace(source, before, after) {
  assert.equal(source.split(before).length, 2, 'Hook changed: ' + before.slice(0, 100));
  return source.replace(before, () => after);
}

function viewmodel(source) {
  if (source.includes('/* blade-storm-montage-motion */')) return source;
  const edit = (a,b) => { source = replace(source,a,b); };
  edit("if(__aimBladeThrows)ab.frustumCulled=false;",
    "if(__aimBladeThrows){ab.frustumCulled=false;af.frustumCulled=false;}");
  const start = source.indexOf('if(__aimBladeThrows){const clips=');
  const end = source.indexOf('if(__aimBuckyAlt)', start);
  assert(start >= 0 && end > start, 'Old Blade Storm fire selector missing');
  source = source.slice(0,start) + source.slice(end);
  edit("bH=bG===null&&bD>=0x0", "bH=!__aimBladeThrows&&bG===null&&bD>=0x0");
  edit('bd=(bz,bA)=>{if(kuronamiMotion||[', 'bd=(bz,bA)=>{if(__aimBladeThrows||kuronamiMotion||[');
  edit('bf=(bz,bA,bB)=>{if(kuronamiMotion||[', 'bf=(bz,bA,bB)=>{if(__aimBladeThrows||kuronamiMotion||[');
  edit('const __aimCopyJettScale=[', 'const __aimCopyJettScale=!!__aimBladeThrows||[');
  edit("if(J.skin?.id==='bladestorm'){const count=bz.jett?.knives??5;for(let i=0;i<af.material.length;i++)af.material[i].visible=i<count;}", '');
  edit('let b7=H[', `/* blade-storm-montage-motion */
 const bladeMotion=J.bladeStormMotion;
 const bladeMarkers=bladeMotion?Array.from({length:5},(_,i)=>ad.bones[ad.index.get('Knife'+(i+1))]):null;
 const bladeState=bladeMotion?{
   armsBase:new Float32Array(a9.bones.length*10), gunBase:new Float32Array(ad.bones.length*10),
   lastArms:new Float32Array(a9.bones.length*10), lastGun:new Float32Array(ad.bones.length*10),
   fromArms:new Float32Array(a9.bones.length*10), fromGun:new Float32Array(ad.bones.length*10),
   shot:null, lastTime:-Infinity, transition:false
 }:null;
 const applyBladeThrow=(state,shot,elapsed,equipping)=>{
   const motion=bladeState;
   if(!motion)return;
   const count=state.jett?.knives??5;
   for(let i=0;i<af.material.length;i++)af.material[i].visible=i<count;
   if(equipping||state.seconds<motion.lastTime||state.seconds-motion.lastTime>.2){
     motion.transition=false;
     motion.shot=null;
     motion.lastTime=-Infinity;
   }
   if(!equipping&&elapsed>=0&&Number.isFinite(shot)&&shot>=(state.equipAt??-Infinity)){
     const index=Math.max(0,Math.min(4,(state.jett?.throwIndex??1)-1));
     const burst=state.jett?.burst===true, pair=__aimBladeThrows[index], timing=bladeMotion.throws[index];
     if(motion.shot!==shot){
       motion.transition=Number.isFinite(motion.shot)&&Number.isFinite(motion.lastTime);
       if(motion.transition){motion.fromArms.set(motion.lastArms);motion.fromGun.set(motion.lastGun);}
       motion.shot=shot;
     }
     const overlay=(clip,spec,bones,base)=>{
       if(elapsed>=spec.seconds)return;
       const weight=Math.min(1,spec.in?elapsed/spec.in:1,spec.out?(spec.seconds-elapsed)/spec.out:1);
       __dCapture(bones,base);
       clip.sample(elapsed,bones);
       if(weight<1)__dBlend(bones,base,1-weight);
     };
     overlay(burst?__aimBladeBurst:pair[0],burst?bladeMotion.burst:timing.arms,a9.bones,motion.armsBase);
     // The exported burst controller has an arm montage only. Its knife
     // disappearance comes from the ammo count, independently of throw index.
     if(!burst)overlay(pair[1],timing.knives,ad.bones,motion.gunBase);
     if(motion.transition&&elapsed<.08){
       const weight=1-elapsed/.08;
       __dBlend(a9.bones,motion.fromArms,weight);
       __dBlend(ad.bones,motion.fromGun,weight);
     }
   }
   __dCapture(a9.bones,motion.lastArms);
   __dCapture(ad.bones,motion.lastGun);
   motion.lastTime=state.seconds;
 };
 let b7=H[`);
  edit("const bQ=__aimButterflyJett(aX(bz,bA?.['detained']===!0x0));",
    "applyBladeThrow(bz,bC,bD,bG!==null);const bQ=__aimButterflyJett(aX(bz,bA?.['detained']===!0x0));");
  edit("'scene':R,'camera':a0,'muzzle':al,", "'scene':R,'camera':a0,'muzzle':al,knifeMarker:index=>bladeMarkers?.[index],");
  return source;
}

function game(source) {
  if (source.includes('/* blade-storm-world-trails */')) return source;
  const edit = (a,b) => { source = replace(source,a,b); };
  source = "/* blade-storm-world-trails */import {createBladeStormTracer as __aimCreateBladeStormTracer} from '/aim-tracers/bladestorm.mjs';\n" + source;
  edit('function K1(e={}){const __aimTour=', 'function K1(e={}){const bladeTrails=__aimCreateBladeStormTracer({muzzle:(camera,index)=>E(camera,true,index),rayBlocked:e.rayBlocked});const __aimTour=');
  edit('function E(x,z){const M=r?.viewModel?.fxLayer?.()??null,w=M?.muzzle??null;',
    'function E(x,z,knife){const M=r?.viewModel?.fxLayer?.()??null,w=knife===undefined?M?.muzzle??null:M?.knifeMarker?.(knife)??null;');
  edit('shoot(x){if(x.weapon==="tourdeforce"', 'shoot(x){if(x.weapon==="bladestorm"&&x.source!=="enemy"){bladeTrails.shoot(x);return;}if(x.weapon==="tourdeforce"');
  edit('frame(x){__aimTour.frame(x);', 'frame(x){bladeTrails.frame(x);__aimTour.frame(x);');
  edit('renderWorld(x,z){__aimTour.render(x,z);', 'renderWorld(x,z){bladeTrails.render(x,z);__aimTour.render(x,z);');
  edit('clear(){__aimTour.clear();', 'clear(){bladeTrails.clear();__aimTour.clear();');
  edit('dispose(){__aimTour.dispose();', 'dispose(){bladeTrails.dispose();__aimTour.dispose();');
  edit('stability:xa,seed:he.tick*64+ba++',
    'stability:xa,burst:Ye()==="bladestorm"&&Ae.player.bsLastBurst===he.tick,knifeIndex:Ye()==="bladestorm"?(Ae.player.bsLastBurst===he.tick?ba:Math.max(0,5-(Ae.player.bsLastThrow??1))):undefined,seed:he.tick*64+ba++');
  return source;
}

const root = path.resolve(__dirname, '..');
const output = [];
for (const [name, patch] of [['DXHU7cEs.js', viewmodel], ['OkAdunfX.js', game]]) {
  const routes = ['next/js', '_assets/r20261021-1/next/js'].map(route => {
    const file = path.join(root, 'app/site', route, name);
    const source = fs.readFileSync(file, 'utf8');
    return { file, route, name, source, patched: patch(source) };
  });
  assert.equal(routes[0].patched, routes[1].patched, name + ' routes differ');
  output.push(...routes);
}
for (const { file, route, name, source, patched } of output) {
  if (source === patched) continue;
  const saved = path.join(root, 'previews/bladestorm-motion/before', route, name);
  fs.mkdirSync(path.dirname(saved), { recursive: true });
  if (!fs.existsSync(saved)) fs.copyFileSync(file, saved);
  fs.writeFileSync(file, patched);
}
console.log('Patched Blade Storm on both game routes.');
