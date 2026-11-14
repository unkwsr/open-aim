// Scope fixes, 13 Nov 2026 (marker aim-scope-zoom2). Safe to run again. Originals: backups/scope-zoom2-2026-11-13/.
//  1. Toggle mode: a scope press can't step 1x -> 2x until the scope has been open 0.2 s (stops a fast/double
//     click from landing on 2x). A deliberate second click after that still goes to 2x.
//  2. Hold mode: the hidden "re-press within 0.5 s -> 2x" rule is gone; re-scoping fast always gives 1x.
//  3. New keybind "Scope 2x zoom" (adsZoom2), unbound by default. Hold: hold it for 2x (back to 1x when released
//     if Scope is still held). Toggle: press for 2x, press again to unscope. On one-zoom weapons it acts as Scope.
//   node tools/patch-scope-zoom2.cjs
const fs = require("fs"), path = require("path");
const app = path.join(__dirname, "..", "app", "site");
const copies = ["next/js", "_assets/r20261021-1/next/js"];
const MARK = "aim-scope-zoom2";

function patch(file, edits) {
  for (const dir of copies) {
    const p = path.join(app, dir, file);
    let s = fs.readFileSync(p, "utf8");
    if (s.includes(MARK)) { console.log("already patched:", path.join(dir, file)); continue; }
    for (const [from, to] of edits) {
      const n = s.split(from).length - 1;
      if (n !== 1) throw Error(`${file}: expected 1 match, found ${n}: ${from.slice(0, 80)}`);
      s = s.replace(from, () => to);
    }
    fs.writeFileSync(p, s);
    console.log("patched:", path.join(dir, file));
  }
}

// Input layer (jh) in OkAdunfX.js
const z2 = '(!!s.adsZoom2&&re("adsZoom2"))';
patch("OkAdunfX.js", [
  [`__aimLastHoldRelease=-Infinity,__aimLastHoldLevel=0;const o=new Set`,
   `__aimLastHoldRelease=-Infinity,__aimLastHoldLevel=0,__aimScopeOpenedAt=-Infinity/* ${MARK} */;const o=new Set`],
  // Scope press: toggle guard for 1x->2x; hold always 1x.
  [`K=()=>{l+=1,!C&&!__aimEquipZoomBlocked&&(b<=0||(A=e==="toggle"?(A+1)%(b+1):b>1&&performance.now()-__aimLastHoldRelease<500?(__aimLastHoldLevel%b)+1:1))}`,
   `K=()=>{l+=1,!C&&!__aimEquipZoomBlocked&&(b<=0||(e==="toggle"?A===1&&b>1&&performance.now()-__aimScopeOpenedAt<200||(A=(A+1)%(b+1),A===1&&(__aimScopeOpenedAt=performance.now())):(A=1,__aimScopeOpenedAt=performance.now())))},__aimZoom2=()=>{if(C||__aimEquipZoomBlocked||b<=0)return;const z=Math.min(2,b);A=e==="toggle"&&A===z?0:z}`],
  // Key down: the 2x key.
  [`Ct(s,"ads",$)&&(aimAlt+=1,K()))}`,
   `Ct(s,"ads",$)&&(aimAlt+=1,K()),Ct(s,"adsZoom2",$)&&__aimZoom2())}`],
  // Key up (hold): letting go of Scope keeps 2x if the 2x key is still held; letting go of the 2x key returns to 1x / off.
  [`e==="hold"&&Ct(s,"ads",$)&&(__aimLastHoldRelease=performance.now(),__aimLastHoldLevel=A,A=0)}`,
   `e==="hold"&&Ct(s,"ads",$)&&(__aimLastHoldRelease=performance.now(),__aimLastHoldLevel=A,A=${z2}&&b>0&&!C&&!__aimEquipZoomBlocked?Math.min(2,b):0),e==="hold"&&Ct(s,"adsZoom2",$)&&(A=re("ads")&&A>0?1:0)}`],
  // Focus loss reset (hold): keep zoom only while a scope key is held.
  [`e==="hold"&&!re("ads")&&(A=0)}`, `e==="hold"&&!re("ads")&&!${z2}&&(A=0)}`],
  // Ability block ends (hold): restore 2x if the 2x key is held.
  [`else if(was&&e==="hold"&&re("ads")&&!C&&b>0)A=1;`,
   `else if(was&&e==="hold"&&(re("ads")||${z2})&&!C&&b>0)A=${z2}?Math.min(2,b):1;`],
]);

// Keybind defaults and the Settings > Controls list in Dc2Dm9E6.js
patch("Dc2Dm9E6.js", [
  [`'ads':['Mouse2',null],'reload'`, `'ads':['Mouse2',null],'adsZoom2':[null,null],'reload'`],
  [`{'id':'ads','group':'combat','label':'Scope','hint':'Hold or toggle scope is set in General › Mouse'},`,
   `{'id':'ads','group':'combat','label':'Scope','hint':'Hold or toggle scope is set in General › Mouse'},/* ${MARK} */{'id':'adsZoom2','group':'combat','label':'Scope 2x zoom','hint':'Goes straight to the second zoom on snipers that have one (Operator). Hold mode: hold for 2x; letting go returns to 1x while Scope is still held. Toggle mode: press for 2x, press again to unscope. Unbound by default.'},`],
]);
