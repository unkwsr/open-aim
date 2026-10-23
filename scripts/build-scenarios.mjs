// Builds app/training-set.json from the scenario files in scenarios/.
// Each scenario is one file: { "item": <lobby list entry>, "scene": <scene served to the game> }.
//   node scripts/build-scenarios.mjs           check every file, then write app/training-set.json
//   node scripts/build-scenarios.mjs --check   check only (what CI runs on every pull request)
//   node scripts/build-scenarios.mjs --check examples   check another folder, such as examples/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FOLDER = process.argv.slice(2).find((a) => !a.startsWith("--")) || "scenarios";
const SCENARIOS = path.join(ROOT, FOLDER);
const OUT = path.join(ROOT, "app", "training-set.json");
const CHECK_ONLY = process.argv.includes("--check");

const errors = [];
const items = [];
const scenes = {};
const seenCodes = new Map();
const seenNames = new Map();

for (const file of fs.readdirSync(SCENARIOS).filter((f) => f.endsWith(".json")).sort()) {
  const fail = (msg) => errors.push(`${FOLDER}/${file}: ${msg}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*\.json$/.test(file)) fail("file name must be lowercase-with-dashes.json");
  let data;
  try {
    // Some Windows editors start files with a byte-order mark; JSON.parse rejects it.
    data = JSON.parse(fs.readFileSync(path.join(SCENARIOS, file), "utf-8").replace(/^﻿/, ""));
  } catch (err) {
    fail(`not valid JSON (${err.message})`);
    continue;
  }
  const { item, scene } = data || {};
  if (!item || typeof item !== "object") { fail('missing "item"'); continue; }
  if (!scene || typeof scene !== "object") { fail('missing "scene"'); continue; }

  for (const key of ["name", "description"]) {
    if (typeof item[key] !== "string" || !item[key].trim()) fail(`item.${key} must be a non-empty string`);
  }
  if (!/^[0-9a-f]{16}$/.test(item.shareCode || "")) fail("item.shareCode must be 16 lowercase hex characters");
  if (item.sceneKey !== `set-${item.shareCode}`) fail(`item.sceneKey must be "set-${item.shareCode}"`);
  if (scene.shareCode !== item.shareCode) fail("scene.shareCode must match item.shareCode");
  if (scene.doc === undefined) fail('scene has no "doc" (the scenario itself)');
  if (typeof item.sort !== "number") fail("item.sort must be a number (its position in the lobby list)");
  if (item.mapId !== null && typeof item.mapId !== "string") fail("item.mapId must be a map name or null for an empty arena");

  if (seenCodes.has(item.shareCode)) fail(`same shareCode as ${seenCodes.get(item.shareCode)}`);
  if (seenNames.has(item.name)) fail(`same name as ${seenNames.get(item.name)}`);
  seenCodes.set(item.shareCode, file);
  seenNames.set(item.name, file);

  items.push(item);
  scenes[item.shareCode] = scene;
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}

items.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
console.log(`${items.length} scenarios OK.`);
if (!CHECK_ONLY && FOLDER === "scenarios") {
  fs.writeFileSync(OUT, JSON.stringify({ items, scenes }, null, 1));
  console.log(`Wrote ${path.relative(ROOT, OUT)}`);
}
