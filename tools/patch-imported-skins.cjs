// Imported skins in the first-person view, 21 Nov 2026 (marker imported-skins-v1). Safe to run again.
// A skin imported from the game files in bulk is called <line>-<weapon> (dragon-vandal, oni2-frenzy) and has
// its own model next to the others in app/site/aim-viewmodel/. Three places in the compiled game need to know:
//   1. Renderer (DXHU7cEs.js), the main model loader: a weapon whose saved skin (es-<weapon>-skin) is named
//      that way loads that skin's model. The skins wired by hand keep their own lines right after it.
//   2. Renderer, the equip-preview loader: the same for the Frenzy, whose own model also comes with this change.
//   3. Game loop (OkAdunfX.js): the key that says which model a weapon is showing now counts the skin of the
//      weapons that had none before, so changing one of them reloads the model.
//   node tools/patch-imported-skins.cjs
const fs = require("fs"), path = require("path");
const app = path.join(__dirname, "..", "app", "site");
const copies = ["next/js", "_assets/r20261021-1/next/js"];
const MARK = "imported-skins-v1";

const WEAPONS = ["vandal", "phantom", "classic", "ghost", "sheriff", "guardian", "operator", "shorty", "bulldog", "bucky", "judge", "ares", "odin", "spectre", "stinger", "marshal", "outlaw"];
const cap = (w) => w[0].toUpperCase() + w.slice(1);
// weapons whose skin was not part of the model key yet
const KEYED = ["frenzy", "shorty", "bulldog", "bucky", "judge", "ares", "odin", "spectre", "stinger", "marshal", "outlaw"];

const edits = {
  "DXHU7cEs.js": [
    [`if(H==='viewmodel'){let choice;try{`,
     `/* ${MARK} */{const __aimGenSkin={viewmodel:'vandal',${WEAPONS.map((w) => `${w}:'${w}'`).join(",")}};const __aimGenW=__aimGenSkin[H];if(__aimGenW){let __aimGenC;try{__aimGenC=localStorage.getItem('es-'+__aimGenW+'-skin')}catch{}if(__aimGenC&&__aimGenC!=='default'&&__aimGenC.endsWith('-'+__aimGenW))H=__aimGenC;}}` +
     `if(H==='viewmodel'){let choice;try{`],
    [`if(isKuronamiVandal(skin))H=skin;}`,
     `if(isKuronamiVandal(skin))H=skin;}if(H==='frenzy'){const __aimFrenzySkinId=window.__aimFrenzySkin||localStorage.getItem('es-frenzy-skin');if(__aimFrenzySkinId&&__aimFrenzySkinId!=='default')H=__aimFrenzySkinId;}`],
  ],
  "OkAdunfX.js": [
    [`(window.__aimVandalSkin||"rgx-vandal-yellow"):""}\${`,
     `(window.__aimVandalSkin||"rgx-vandal-yellow"):""}\${/* ${MARK} */""}\${` + KEYED.map((w) => `F==="${w}"?"+"+(window.__aim${cap(w)}Skin||"default"):""}\${`).join("")],
  ],
};

for (const dir of copies) {
  for (const [file, list] of Object.entries(edits)) {
    const p = path.join(app, dir, file);
    let s = fs.readFileSync(p, "utf8");
    if (s.includes(MARK)) { console.log("already patched:", path.join(dir, file)); continue; }
    for (const [from, to] of list) {
      const n = s.split(from).length - 1;
      if (n !== 1) throw Error(`${file}: expected 1 match, found ${n}: ${from.slice(0, 80)}`);
      s = s.replace(from, () => to);
    }
    fs.writeFileSync(p, s);
    console.log("patched:", path.join(dir, file));
  }
}
