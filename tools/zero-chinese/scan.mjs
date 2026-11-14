// Zero-Chinese acceptance scan (batch 73). Repeatable, read-only.
//   node tools/zero-chinese/scan.mjs            summary + every in-scope hit; exit 1 when the claim fails
//   node tools/zero-chinese/scan.mjs --json     also writes tools/zero-chinese/last-scan.json
//   node tools/zero-chinese/scan.mjs --all      also lists exception / unclassified files with counts
// Scope: tools/zero-chinese/scope.json. Detects
//   raw     CJK ideographs (U+3400-U+9FFF, U+F900-U+FAFF) and CJK punctuation / full-width forms
//           (U+3000-U+303F, U+FF00-U+FFEF) in the file text;
//   escaped backslash-u XXXX / backslash-u{XXXX} escapes, HTML entities (&#x..; / &#..;), percent-encoded UTF-8 and
//           String.fromCharCode(...) arguments that decode to those ranges, and base64 runs (>= 24 chars) whose UTF-8
//           decoding contains ideographs.
// This file itself contains no such characters: every range is built from numbers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const scope = JSON.parse(fs.readFileSync(path.join(here, "scope.json"), "utf8"));

const ch = (n) => String.fromCharCode(n);
const BS = ch(92);
const isCjk = (c) => (c >= 0x3400 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff);
const isCjkPunct = (c) => (c >= 0x3000 && c <= 0x303f) || (c >= 0xff00 && c <= 0xffef);
const RAW = new RegExp(`[${ch(0x3400)}-${ch(0x9fff)}${ch(0xf900)}-${ch(0xfaff)}]`, "g");
const PUNCT = new RegExp(`[${ch(0x3000)}-${ch(0x303f)}${ch(0xff00)}-${ch(0xffef)}]`, "g");
const ESC_U = new RegExp(`${BS}${BS}u(?:([0-9a-fA-F]{4})|${BS}{([0-9a-fA-F]{4,6})${BS}})`, "g");
const ENT = /&#(?:x([0-9a-fA-F]{4,6})|(\d{4,7}));/g;
const PCT = /(?:%[eE][0-9a-fA-F]%[89abAB][0-9a-fA-F]%[89abAB][0-9a-fA-F])+/g;
const FCC = /fromCharCode\s*\(([^)]{1,400})\)/g;
const B64 = /[A-Za-z0-9+/]{24,}={0,2}/g;

const NUL = ch(0); // placeholder for '**' while building a glob regex
const toRe = (g) => {
  const parts = g.split("/").map((seg) => (seg === "**" ? NUL : seg.replace(/[.+^${}()|[\]]/g, (m) => BS + m).replace(/\*/g, "[^/]*")));
  let s = parts.join("/");
  s = s.split(NUL + "/").join("(?:.*/)?").split("/" + NUL).join("(?:/.*)?").split(NUL).join(".*");
  return new RegExp("^" + s + "$");
};
const args = new Set(process.argv.slice(2));
const classes = Object.entries(scope.maintained).map(([k, globs]) => [k, globs.map(toRe)]);
const exceptions = scope.exceptions.map((e) => ({ ...e, re: toRe(e.glob) }));
// Hit-level exceptions (added 6 Nov 2026): hits of `kind` that lie inside an exact occurrence of `text` in a file
// matching `glob` are outside the claim. Everything else in that file stays in the claim; a listed text that is no
// longer found in a matching file is reported as STALE (its hits, if any moved, then count again).
const hitExceptions = (scope.hitExceptions || []).map((e) => ({ ...e, re: toRe(e.glob) }));
const TEXT = /\.(m?js|cjs|ts|vue|css|html?|json|glsl|frag|vert|cmd|bat|ps1|md|txt|svg|xml|ya?ml)$/i;
const SKIP_DIRS = new Set([".git", "node_modules"]);

function scanText(s) {
  const hits = [];
  // line numbers only for the first few hits (computing them for every hit is quadratic on big bundles)
  const add = (kind, index, sample) => hits.push(hits.length < 5 ? { kind, at: index, line: s.slice(0, index).split("\n").length, sample: sample.slice(0, 80) } : { kind, at: index });
  for (const m of s.matchAll(RAW)) add("raw", m.index, s.slice(Math.max(0, m.index - 30), m.index + 40));
  for (const m of s.matchAll(PUNCT)) add("raw-punct", m.index, s.slice(Math.max(0, m.index - 30), m.index + 40));
  for (const m of s.matchAll(ESC_U)) { const c = parseInt(m[1] || m[2], 16); if (isCjk(c) || isCjkPunct(c)) add("escaped-u", m.index, m[0]); }
  for (const m of s.matchAll(ENT)) { const c = m[1] ? parseInt(m[1], 16) : parseInt(m[2], 10); if (isCjk(c) || isCjkPunct(c)) add("html-entity", m.index, m[0]); }
  for (const m of s.matchAll(PCT)) { try { const d = decodeURIComponent(m[0]); if ([...d].some((x) => isCjk(x.codePointAt(0)))) add("percent-encoded", m.index, m[0]); } catch {} }
  for (const m of s.matchAll(FCC)) {
    const nums = m[1].split(",").map((x) => x.trim()).map((x) => (/^0x[0-9a-f]+$/i.test(x) ? parseInt(x, 16) : /^\d+$/.test(x) ? parseInt(x, 10) : NaN));
    if (nums.some((c) => isCjk(c))) add("fromCharCode", m.index, m[0]);
  }
  for (const m of s.matchAll(B64)) {
    if (m[0].length % 4 !== 0 && !m[0].endsWith("=")) continue;
    const buf = Buffer.from(m[0], "base64"), d = buf.toString("utf8");
    if (!Buffer.from(d, "utf8").equals(buf)) continue; // not valid UTF-8: ordinary identifier text, not encoded Chinese
    const cjk = [...d].filter((x) => isCjk(x.codePointAt(0))).length;
    if (cjk >= 2) add("base64", m.index, m[0]);
  }
  return hits;
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue; // .git; node_modules = third-party (listed in scope.json exceptions)
    const abs = path.join(dir, e.name), rel = path.relative(root, abs).split(path.sep).join("/");
    // whole exception directories are only walked with --all (test-data / previews are very large)
    if (e.isDirectory()) { if (!args.has("--all") && exceptions.some((x) => x.re.test(rel + "/x"))) continue; walk(abs); }
    else if (TEXT.test(e.name) || /^[0-9a-f]{16}$/.test(e.name)) files.push({ rel, abs });
  }
})(root);

const report = { maintained: {}, exceptions: {}, unclassified: {} };
let claimHits = 0;
for (const f of files) {
  const exc = exceptions.find((e) => e.re.test(f.rel));
  const cls = exc ? null : classes.find(([, res]) => res.some((r) => r.test(f.rel)))?.[0];
  const s = fs.readFileSync(f.abs, "utf8");
  let hits = scanText(s);
  for (const he of hitExceptions) {
    if (!he.re.test(f.rel)) continue;
    const spans = []; for (let i = s.indexOf(he.text); i >= 0; i = s.indexOf(he.text, i + 1)) spans.push([i, i + he.text.length]);
    const key = "hit:" + he.glob + " · " + he.label;
    const r = (report.exceptions[key] ??= { reason: he.reason, files: 0, hits: 0, stale: [] });
    if (!spans.length) { r.stale.push(f.rel); console.log(`STALE hit exception "${he.label}": text not found in ${f.rel}`); continue; }
    const before = hits.length;
    hits = hits.filter((h) => !(h.kind === he.kind && spans.some(([a, b]) => h.at >= a && h.at < b)));
    r.files++; r.hits += before - hits.length;
  }
  if (!hits.length) { if (cls) (report.maintained[cls] ??= { files: 0, clean: 0, dirty: [] }).files++, report.maintained[cls].clean++; continue; }
  const byKind = {}; for (const h of hits) byKind[h.kind] = (byKind[h.kind] || 0) + 1;
  if (cls) {
    const r = (report.maintained[cls] ??= { files: 0, clean: 0, dirty: [] }); r.files++;
    r.dirty.push({ file: f.rel, total: hits.length, byKind, first: hits.slice(0, 3) }); claimHits += hits.length;
  } else if (exc) {
    (report.exceptions[exc.glob] ??= { reason: exc.reason, files: 0, hits: 0 }); report.exceptions[exc.glob].files++; report.exceptions[exc.glob].hits += hits.length;
  } else {
    report.unclassified[f.rel] = { total: hits.length, byKind };
  }
}
for (const [cls, r] of Object.entries(report.maintained)) {
  r.dirty.sort((a, b) => b.total - a.total);
  console.log(`[${cls}] files ${r.files}, clean ${r.clean}, with Chinese ${r.dirty.length}, hits ${r.dirty.reduce((n, d) => n + d.total, 0)}`);
  for (const d of r.dirty) console.log(`  ${String(d.total).padStart(6)}  ${d.file}  ${JSON.stringify(d.byKind)}`);
}
for (const [k, e] of Object.entries(report.exceptions)) if (k.startsWith("hit:")) console.log(`[hit exception] ${k.slice(4)}: ${e.hits} hits in ${e.files} files${e.stale.length ? ` — STALE in ${e.stale.join(", ")}` : ""}`);
if (args.has("--all")) {
  console.log("\n[exceptions] (not part of the claim)");
  for (const [g, e] of Object.entries(report.exceptions)) console.log(`  ${g}: ${e.files} files, ${e.hits} hits — ${e.reason}`);
  console.log("\n[unclassified] (neither maintained nor an exception)");
  for (const [f, u] of Object.entries(report.unclassified)) console.log(`  ${String(u.total).padStart(6)}  ${f}`);
}
console.log(`\nCLAIM ${claimHits === 0 ? "PASS" : "FAIL"}: ${claimHits} Chinese / escaped-Chinese hits in maintained files; unclassified files with Chinese: ${Object.keys(report.unclassified).length}`);
if (args.has("--json")) fs.writeFileSync(path.join(here, "last-scan.json"), JSON.stringify(report, null, 1));
process.exitCode = claimHits ? 1 : 0;
