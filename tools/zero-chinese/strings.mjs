// List string literals / comments containing Chinese in a JS file (read-only helper for cleanup batches).
//   node tools/zero-chinese/strings.mjs <file> [--json]
// Output: one line per distinct literal: count, kind (' " ` or comment), text (escaped newlines).
import fs from "node:fs";

const ch = (n) => String.fromCharCode(n);
const HAN = new RegExp(`[${ch(0x3000)}-${ch(0x303f)}${ch(0x3400)}-${ch(0x9fff)}${ch(0xf900)}-${ch(0xfaff)}${ch(0xff00)}-${ch(0xffef)}]`);
const BS = ch(92);
export function literals(s) {
  const out = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === "/" && s[i + 1] === "/") { const j = s.indexOf("\n", i); const e = j < 0 ? n : j; out.push(["//", i, e]); i = e; continue; }
    if (c === "/" && s[i + 1] === "*") { const j = s.indexOf("*/", i + 2); const e = j < 0 ? n : j + 2; out.push(["/*", i, e]); i = e; continue; }
    if (c === "'" || c === '"' || c === "`") {
      let j = i + 1, depth = 0;
      while (j < n) {
        const d = s[j];
        if (d === BS) { j += 2; continue; }
        if (c === "`" && d === "$" && s[j + 1] === "{") { depth++; j += 2; continue; }
        if (c === "`" && depth && d === "}") { depth--; j++; continue; }
        if (!depth && d === c) break;
        if (c !== "`" && d === "\n") break;
        j++;
      }
      out.push([c, i, j + 1]); i = j + 1; continue;
    }
    i++;
  }
  return out;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  const f = process.argv[2];
  const s = fs.readFileSync(f, "utf8");
  const seen = new Map();
  for (const [k, a, b] of literals(s)) {
    const t = s.slice(a, b);
    if (!HAN.test(t)) continue;
    const key = k + " " + t;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  // Chinese outside any literal / comment (e.g. regex literals, identifiers)
  let outside = 0; const lits = literals(s); let p = 0;
  for (const [, a, b] of lits) { if (HAN.test(s.slice(p, a))) outside++; p = b; }
  if (process.argv.includes("--json")) console.log(JSON.stringify([...seen], null, 1));
  else for (const [k, v] of seen) console.log(v, k.replace(/\r?\n/g, "\\n").slice(0, 400));
  console.log(`distinct ${seen.size}; gaps with Chinese outside literals (regex literals etc.): ${outside}`);
}
