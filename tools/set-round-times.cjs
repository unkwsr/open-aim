// round-times-v1 (user, 14 Nov 2026): VALORANT Training round length by kind of drill.
//   - New pre-aim drills from the Creator (spots picked per round): 2:00.
//   - Hold-site drills and any map drill with 4-8 bots (not pre-aim): 1:30.
// Written into the scenarios/ files only (creator-lobby-split-v1: the Creator drills are not touched).
//   node tools/set-round-times.cjs [--dry]
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const er = require(path.join(ROOT, "app/enemy-rank.js"));
const SRC = process.env.SRC || path.join(ROOT, "test-data/worker-test/AimTrainer/studio-drills");
const DRY = process.argv.includes("--dry");
const PRE_AIM = 120, HOLD = 90;
const lobbyCodeOf = (c) => crypto.createHash("sha256").update(`creator-to-lobby:${c}`).digest("hex").slice(0, 16);
const exportCodes = [];
for (const f of fs.readdirSync(path.join(ROOT, "scenarios")).filter((f) => f.endsWith(".json")).sort()) {
  const file = path.join(ROOT, "scenarios", f), text = fs.readFileSync(file, "utf8"), data = JSON.parse(text);
  const { item, scene } = data;
  const doc = typeof scene.doc === "string" ? JSON.parse(scene.doc) : scene.doc;
  const map = doc.environment && doc.environment.map && doc.environment.map !== "range";
  if (!map) continue;
  const bots = scene.aimShuffle ? scene.aimShuffle.groups.length : doc.actors.filter((a) => a.body && a.body.shape === "humanoid").length;
  const preAim = !!(scene.aimShuffle && doc.rules.spawnerPick);
  const want = preAim ? PRE_AIM : (er.isHoldSite(scene, item.type) || (bots >= 4 && bots <= 8)) ? HOLD : null;
  if (!want || doc.rules.duration === want) continue;
  console.log(`${String(doc.rules.duration).padStart(4)} s -> ${want} s  ${item.name}`);
  if (DRY) continue;
  doc.rules.duration = want;
  scene.doc = typeof scene.doc === "string" ? JSON.stringify(doc) : doc;
  const indent = (/\n( +|\t)"/.exec(text) || [, ""])[1];
  fs.writeFileSync(file, JSON.stringify(data, null, indent) + (text.endsWith("\n") ? "\n" : ""));
}
if (!DRY) console.log("Now run: node scripts/build-scenarios.mjs");
