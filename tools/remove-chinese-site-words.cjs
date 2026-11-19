// no-chinese-site-words-v1 (14 Nov 2026): removes the original web game's Chinese-site words from the game
// code in app/site/ and base/ (WeChat sign-in calls, zh-CN locales, Bilibili/Douyin icon names, the "Bilibili
// streamer" crosshair preset label, the ishoutu code comment). Same replacement in every file, so renamed
// methods, CSS classes and icons still match each other. Backs up each changed file to
// backups/no-chinese-site-words-2026-11-14/<same path>. Usage: node tools/remove-chinese-site-words.cjs [--dry]
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, ".."), dry = process.argv.includes("--dry");
const backup = path.join(root, "backups/no-chinese-site-words-2026-11-14");
const exact = [
  ['tag:"Bilibili streamer"', 'tag:""'],                                  // crosshair preset: name kept, label dropped
  ['toLocaleString("zh-CN",{year', 'toLocaleString("sv-SE",{year'],      // same 2026-11-14 13:55:00 layout
  ["['toLocaleString']('zh-CN')", "['toLocaleString']('en-US')"],        // play counts
  ['n=e||"zh-CN"', 'n=e||"en-US"'],
  ["adapted from ishoutu.har (offline capture)", "adapted from an offline capture of the original web trainer"],
];
const words = [[/ZH_CN/g, "EN_US"], [/"zh-cn"/g, '"en-us"'], [/WeChat/g, "Social"], [/Wechat/g, "Social"], [/wechat/g, "social"],
  [/bilibili/gi, "brand-video"], [/douyin/gi, "brand-short"]];
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(m?js|css|html)$/.test(e.name)) files.push(p); } };
walk(path.join(root, "app/site")); walk(path.join(root, "base"));
let changed = 0; const counts = {};
for (const f of files) {
  const before = fs.readFileSync(f, "utf8"); let s = before;
  for (const [a, b] of exact) { const n = s.split(a).length - 1; if (n) { counts[a] = (counts[a] || 0) + n; s = s.split(a).join(b); } }
  for (const [re, b] of words) { const n = (s.match(re) || []).length; if (n) { counts[re.source] = (counts[re.source] || 0) + n; s = s.replace(re, b); } }
  if (s === before) continue;
  changed++;
  if (!dry) {
    const to = path.join(backup, path.relative(root, f));
    if (!fs.existsSync(to)) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, before); }
    fs.writeFileSync(f, s);
  }
  console.log((dry ? "would change " : "changed ") + path.relative(root, f));
}
console.log(JSON.stringify(counts, null, 1));
console.log(`${changed} files${dry ? " (dry run)" : ""}`);
