// waves-trades-v1 (17 Nov 2026): trades inside Studio waves. On top of patch-studio-waves.cjs (+ v2).
// Patches both copies of CnrSARj_.js. Run once: node tools/patch-studio-waves-v3.cjs
// A wave bot that trades another (dispatcher.afterKill, from app/studio/drill.js) only comes after you kill that bot.
// When its group starts, its kill gate (runtime killSeen / killWait, aim-dispatch-gates in BiMsX6Xn.js) is reset to
// that tick, so only kills in this group count (not one from an earlier wave). plan bot { free: true } (its target
// isn't in this group): the gate is open at once, so it comes with the group like any wave bot.
// The group is not over while the trade is armed but hasn't come (studio-waves-v1 done check: armed.size).
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "app", "site");
const files = [path.join(root, "next", "js", "CnrSARj_.js"), path.join(root, "_assets", "r20261021-1", "next", "js", "CnrSARj_.js")];
const MARK = "waves-trades-v1";

const edits = [
  // Step start: remember which dispatchers need a fresh gate (and which are free).
  ["s.ids=new Set(s.pending.map(b=>b.d));",
   `s.ids=new Set(s.pending.map(b=>b.d));s.fresh=new Map(s.plans[k].bots.map(b=>[b.d,!!b.free]))/*${MARK}*/;`],
  // Dispatcher loop: reset the gate on the tick the step starts, before the armed check.
  ["if(h.wave&&!(__aimWv&&__aimWv.armed.has(h.id)))continue;",
   `if(h.wave&&__aimWv&&__aimWv.fresh&&__aimWv.fresh.has(h.id)){const fr=__aimWv.fresh.get(h.id);__aimWv.fresh.delete(h.id);if(h.afterKill){Z.killSeen=U;Z.killWait=fr?x.elapsed:null}}/*${MARK}*/if(h.wave&&!(__aimWv&&__aimWv.armed.has(h.id)))continue;`],
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARK)) { console.log("already patched:", f); continue; }
  if (!s.includes("waves-groups-v1")) throw new Error(`${f}: run patch-studio-waves.cjs and -v2 first`);
  for (const [from, to] of edits) {
    const n = s.split(from).length - 1;
    if (n !== 1) throw new Error(`${f}: expected 1 match, found ${n}: ${from.slice(0, 60)}`);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(f, s);
  console.log("patched:", f);
}
