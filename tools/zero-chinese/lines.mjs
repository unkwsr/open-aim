// List distinct Chinese-bearing segments of a JS file, splitting literals at real newlines and at the escape texts
// backslash-n and backslash-x0a (shader sources inside minified strings). Read-only helper.
//   node tools/zero-chinese/lines.mjs <file> [--count]
import fs from "node:fs";

const ch = (n) => String.fromCharCode(n);
const HAN = new RegExp(`[${ch(0x3000)}-${ch(0x303f)}${ch(0x3400)}-${ch(0x9fff)}${ch(0xf900)}-${ch(0xfaff)}${ch(0xff00)}-${ch(0xffef)}]`);
const BS = ch(92);
const s = fs.readFileSync(process.argv[2], "utf8");
const parts = s.split("\n").flatMap((l) => l.split(BS + "n")).flatMap((l) => l.split(BS + "x0a"));
const seen = new Map();
for (const p of parts) if (HAN.test(p)) seen.set(p, (seen.get(p) || 0) + 1);
for (const [p, n] of seen) console.log(process.argv.includes("--count") ? `${n}\t${p.slice(0, 300)}` : p.length > 300 ? p.slice(0, 300) + " …[" + p.length + "]" : p);
console.error(`segments ${seen.size}`);
