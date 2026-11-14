// Flyable FModel drafts inside the normal game window. Their engine and map assets
// are scoped to /flyable/ so no draft can replace a playable map or drill.
const fs = require("fs");
const path = require("path");

const MAPS = {
  haven: { id: "triad", label: "Haven", spawn: [-19, 3, -15], adapter: "haven" },
  sunset: { id: "juliett", label: "Sunset", spawn: [-6.6, 8, 41.3], adapter: "split" },
  lotus: { id: "jam", label: "Lotus", spawn: [18.4, 8, -21.5], adapter: "split" },
  ascent: { id: "ascent", label: "Ascent", spawn: [-40, 3, -20], adapter: "ascent" },
  split: { id: "bonsai", label: "Split", spawn: [-40, 3, -20], adapter: "split" },
  bind: { id: "duality", label: "Bind", spawn: [0.78, 1, -1.62], adapter: "split" },
};
const ORDER = ["haven", "sunset", "lotus", "ascent", "split", "bind"];

function page(title, body, script = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · AimTrainer</title><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0c0e12;color:#f3f4f6;font:14px Segoe UI,Arial,sans-serif}
a{color:inherit;text-decoration:none}button{font:inherit;cursor:pointer}#view{position:absolute;inset:0}
.nav{position:absolute;z-index:20;top:0;left:0;right:0;display:flex;align-items:center;gap:8px;min-height:52px;padding:0 16px;background:#0e1118ed;border-bottom:1px solid #842634}
.nav a{padding:8px 10px;border-radius:3px;color:#cbd1d8}.nav a:hover,.nav a.current{background:#a92335;color:white}.nav strong{margin-right:12px;letter-spacing:.08em}
#panel{position:absolute;z-index:10;top:68px;left:16px;max-width:630px;padding:14px 18px;background:#10151dde;border:1px solid #71303a;border-radius:6px}
#panel strong{font-size:18px}#panel p{margin:7px 0;color:#c9d0d8}#panel button{margin:5px 5px 0 0;padding:7px 10px;background:#292127;color:#fff;border:1px solid #74313b;border-radius:3px}#panel button:hover{background:#a92335}
#status{color:#a6d6c7!important}#cross{position:absolute;left:50%;top:50%;width:4px;height:4px;background:#fff9;border-radius:50%;pointer-events:none}
.gallery{height:100%;overflow:auto;padding:90px 5vw 50px}.gallery h1{font-size:36px;margin:0 0 8px}.gallery p{color:#b9c0c9;margin:0 0 28px}.cards{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:14px;max-width:1100px}.card{display:block;padding:26px;min-height:120px;background:linear-gradient(135deg,#1d222b,#11151b);border:1px solid #74313b;clip-path:polygon(0 0,100% 0,100% 85%,92% 100%,0 100%)}.card:hover{background:linear-gradient(135deg,#50202c,#21151b);border-color:#d53c50}.card b{display:block;font-size:24px;margin-bottom:12px}.card small{color:#b9c0c9}
@media(max-width:760px){.nav{flex-wrap:wrap;padding:8px}.cards{grid-template-columns:repeat(2,minmax(140px,1fr))}#panel{top:105px;max-width:calc(100vw - 70px)}}
</style></head><body>${body}${script}</body></html>`;
}

module.exports = function createFlyableRoute({ root, mods, site, mime }) {
  const adapters = {
    haven: require("../tools/map-import/haven-preview-adapter.cjs"),
    ascent: require("../tools/map-import/ascent-preview-adapter.cjs"),
    split: require("../tools/map-import/split-preview-adapter.cjs"),
  };
  const send = (req, res, value, type = "text/html") => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    res.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length, "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : bytes);
  };
  const missing = (res) => { res.writeHead(404).end(); };
  const nav = (current = "") => `<nav class="nav"><strong>AIMTRAINER · FLYABLE MAPS</strong><a href="/aim">Back to game</a><a href="/flyable/"${current ? "" : ' class="current"'}>All maps</a>${ORDER.map(name => `<a href="/flyable/${name}/"${name === current ? ' class="current"' : ""}>${MAPS[name].label}</a>`).join("")}</nav>`;

  return function handleFlyable(req, res, requested) {
    if (requested !== "/flyable" && !requested.startsWith("/flyable/")) return false;
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return true; }
    if (requested === "/flyable") { res.writeHead(302, { Location: "/flyable/" }).end(); return true; }
    if (requested === "/flyable/") {
      const cards = ORDER.map(name => `<a class="card" href="/flyable/${name}/"><b>${MAPS[name].label}</b><small>FModel visual draft · Fly through</small></a>`).join("");
      send(req, res, page("Flyable maps", `${nav()}<main class="gallery"><h1>Flyable maps</h1><p>Explore your six FModel drafts inside the game. Collision, bots, and drills are still being built.</p><div class="cards">${cards}</div></main>`));
      return true;
    }
    const match = /^\/flyable\/(haven|sunset|lotus|ascent|split|bind)(\/.*)?$/.exec(requested);
    if (!match) { missing(res); return true; }
    const name = match[1], map = MAPS[name], base = `/flyable/${name}/`, tail = match[2] || "";
    const here = path.join(root, "flyable", name);
    const draft = path.join(here, "draft");
    if (!tail) { res.writeHead(302, { Location: base }).end(); return true; }
    if (tail === "/") {
      const controls = `<div id="view"></div>${nav(name)}<section id="panel"><strong>${map.label} · flyable draft</strong><p>Click the map to look around. WASD fly · Q/E down/up · Shift faster · Esc release mouse.</p><div id="views"></div>${name === "haven" ? "" : '<button id="lighting-mode">Texture check</button>'}<p id="status">Loading the draft…</p></section><div id="cross"></div>`;
      send(req, res, page(map.label, controls, `<script type="module" src="${base}preview-page.mjs"></script>`));
      return true;
    }
    if (tail === "/map-registry.mjs") {
      const bytes = fs.statSync(path.join(draft, `${map.id}.glb`)).size;
      const entry = { id: map.id, label: `${map.label} draft`, spawn: { x: map.spawn[0], y: map.spawn[1], z: map.spawn[2] }, ropes: false, bytes, order: 0 };
      send(req, res, `export const maps=${JSON.stringify([entry])};export const mapIds=maps.map(map=>map.id);export const mapById=id=>maps.find(map=>map.id===id);`, "text/javascript");
      return true;
    }
    if (tail === "/preview-page.mjs") {
      let source = fs.readFileSync(path.join(here, "preview-page.mjs"), "utf8");
      source = source.replaceAll("/_assets/r20261021-1/next/js/", `${base}engine/`)
        .replaceAll("/preview-settings.json", `${base}preview-settings.json`)
        .replaceAll("/haven-surface-overrides.mjs", `${base}haven-surface-overrides.mjs`)
        .replaceAll("location.href=textureCheck?'/':'/?mode=texture'", `location.href=textureCheck?'${base}':'${base}?mode=texture'`);
      send(req, res, source, "text/javascript");
      return true;
    }
    if (tail === "/preview-settings.json" || tail === "/haven-surface-overrides.mjs") {
      const file = path.join(here, tail === "/haven-surface-overrides.mjs" ? "surface-overrides.mjs" : "preview-settings.json");
      if (!fs.existsSync(file)) missing(res);
      else send(req, res, fs.readFileSync(file), mime[path.extname(file)] || "application/octet-stream");
      return true;
    }
    if (tail.startsWith("/aim-maps/")) {
      const fileName = tail.slice("/aim-maps/".length);
      if (!/^[a-zA-Z0-9_.-]+$/.test(fileName) || !fileName.startsWith(map.id + ".") || fileName.includes("..")) { missing(res); return true; }
      const file = path.join(draft, fileName);
      if (!fs.existsSync(file)) missing(res);
      else send(req, res, fs.readFileSync(file), mime[path.extname(file)] || "application/octet-stream");
      return true;
    }
    if (tail.startsWith("/engine/")) {
      let fileName = tail.slice("/engine/".length);
      if (!/^[a-zA-Z0-9_.-]+$/.test(fileName) || fileName.includes("..")) { missing(res); return true; }
      const textureCheck = fileName === "BiMsX6Xn-texture-check.js";
      if (textureCheck) fileName = "BiMsX6Xn.js";
      const relative = path.join("_assets", "r20261021-1", "next", "js", fileName);
      const override = path.join(mods, relative), fallback = path.join(site, relative);
      const file = fs.existsSync(override) ? override : fallback;
      if (!fs.existsSync(file)) { missing(res); return true; }
      let bytes = fs.readFileSync(file);
      if (fileName === "BiMsX6Xn.js") {
        bytes = adapters[map.adapter](bytes, { textureCheck });
        const source = bytes.toString("utf8");
        if (!source.includes('const di="/aim-maps"')) throw Error("Flyable asset base changed");
        bytes = Buffer.from(source.replace('const di="/aim-maps"', `const di="${base}aim-maps"`));
      }
      let source = bytes.toString("utf8");
      source = source.replaceAll('"/local/map-registry.mjs"', `"${base}map-registry.mjs"`)
        .replaceAll("'/local/map-registry.mjs'", `'${base}map-registry.mjs'`);
      send(req, res, source, "text/javascript");
      return true;
    }
    missing(res);
    return true;
  };
};
