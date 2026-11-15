// First-pass translation of English interface lines with a local Ollama model.
//
//   node scripts/translate-ollama.mjs <ko|ja|zh> <lines.json>
//   options: --model gpt-oss:20b  --batch 10  --host http://127.0.0.1:11434
//
// <lines.json> is an array of English lines, for example the lines still shown in English
// (window.__aimMissing in the game window, see app/i18n/runtime.js). Lines that already have
// a translation in app/i18n/<lang>.json are skipped; new ones are added to it. The file is
// saved after every batch, so a stopped run picks up where it left off.
// The output is a first draft: review it before shipping, especially names and short labels.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const [lang, linesFile] = args;
const opt = (name, fallback) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : fallback; };
const MODEL = opt("model", "gpt-oss:20b");
const HOST = opt("host", "http://127.0.0.1:11434");
// Small batches: past ~10 longer lines, the model starts looping ("token repeat limit").
const BATCH = Number(opt("batch", 10));
const MAX_CHARS = 800;

const LANGS = {
  ko: {
    name: "Korean",
    style: `Write natural Korean that a Korean VALORANT player would actually read in a game client, not stiff machine translation.
- Buttons, tabs, labels, headings: short noun phrases (e.g. "설정", "다시 하기", "빠른 시작"), no sentence endings.
- Full sentences and hints: friendly polite 해요체 (e.g. "~해요", "~할 수 있어요", "~하세요"). Never 합니다체 or 반말.
- Common gamer terms: 프리에임, 각 잡기 (angle holding), 섬광 대응 (anti-flash), 에임, 감도, 정조준 (scope/ADS), 헤드샷, 스프레이, 트래킹, 플릭, 조준선 (crosshair), 봇, 드릴, 맵, 라운드, 킬, 리플레이, FPS, 랭크.`,
    forbid: /\p{Script=Han}|[぀-ヿ]/u,
  },
  ja: {
    name: "Japanese",
    style: `Write natural Japanese as used in the Japanese VALORANT client, not stiff machine translation.
- Buttons, tabs, labels, headings: short noun phrases (e.g. "設定", "もう一度", "クイックスタート").
- Full sentences and hints: polite です・ます form, concise and friendly.
- Gamer terms: プリエイム, アングルホールド, アンチフラッシュ, エイム, 感度, スコープ/ADS, ヘッドショット, スプレー, トラッキング, フリック, クロスヘア, ボット, ドリル, マップ, ラウンド, キル, リプレイ, FPS, ランク.
- Use Japanese kanji forms, never Simplified Chinese characters (e.g. 設定 not 设置, 練習 not 练习).`,
    forbid: /[가-힯]|[这们说时间设练习开关击图选择项还]/u,
  },
  zh: {
    name: "Simplified Chinese",
    style: `Write natural Simplified Chinese as used in the Chinese VALORANT (无畏契约) client and its player community.
- Buttons, tabs, labels, headings: short phrases. Sentences: concise and friendly.
- Gamer terms: 预瞄, 架枪, 反闪, 定位, 跟枪, 拉枪, 急停, 爆头, 准星, bot, 段位.`,
    forbid: /[가-힯]|[぀-ヿ]/u,
  },
};
// Official localized names, which the model otherwise guesses.
const NAMES = {
  ko: {
    Ascent: "어센트", Split: "스플릿", Haven: "헤이븐", Lotus: "로터스", Bind: "바인드", Corrode: "코로드", Abyss: "어비스", Summit: "서밋", Sunset: "선셋", Icebox: "아이스박스", Breeze: "브리즈", Fracture: "프랙처", Pearl: "펄",
    Vandal: "밴달", Phantom: "팬텀", Operator: "오퍼레이터", Marshal: "마샬", Outlaw: "아웃로", Guardian: "가디언", Sheriff: "셰리프", Ghost: "고스트", Spectre: "스펙터", Bulldog: "불독", Odin: "오딘", Ares: "아레스", Stinger: "스팅어", Classic: "클래식", Shorty: "쇼티", Judge: "저지",
    Jett: "제트", Neon: "네온", Chamber: "체임버", Phoenix: "피닉스", Reyna: "레이나", "KAY/O": "케이/오", Updraft: "상승 기류", Tailwind: "순풍", Cloudburst: "연막 폭발", "Blade Storm": "칼날 폭풍", "High Gear": "고속 기어", Headhunter: "헤드헌터", "Tour de Force": "역작",
    Iron: "아이언", Bronze: "브론즈", Silver: "실버", Gold: "골드", Platinum: "플래티넘", Diamond: "다이아몬드", Ascendant: "초월자", Immortal: "불멸", Radiant: "레디언트",
    "Training Creator": "트레이닝 크리에이터", "Community Workshop": "커뮤니티 워크숍", "Target Workshop": "타깃 워크숍", "VALORANT Training": "VALORANT 훈련",
  },
  ja: {
    Ascent: "アセント", Split: "スプリット", Haven: "ヘイヴン", Lotus: "ロータス", Bind: "バインド", Corrode: "カロード", Abyss: "アビス", Summit: "サミット", Sunset: "サンセット", Icebox: "アイスボックス", Breeze: "ブリーズ", Fracture: "フラクチャー", Pearl: "パール",
    Vandal: "ヴァンダル", Phantom: "ファントム", Operator: "オペレーター", Marshal: "マーシャル", Outlaw: "アウトロー", Guardian: "ガーディアン", Sheriff: "シェリフ", Ghost: "ゴースト", Spectre: "スペクター", Bulldog: "ブルドッグ", Odin: "オーディン", Ares: "アレス", Stinger: "スティンガー", Classic: "クラシック", Shorty: "ショーティー", Judge: "ジャッジ",
    Jett: "ジェット", Neon: "ネオン", Chamber: "チェンバー", Phoenix: "フェニックス", Reyna: "レイナ", "KAY/O": "KAY/O", Updraft: "アップドラフト", Tailwind: "テイルウィンド", Cloudburst: "クラウドバースト", "Blade Storm": "ブレードストーム", "High Gear": "ハイギア", Headhunter: "ヘッドハンター", "Tour de Force": "トゥール・ド・フォース",
    Iron: "アイアン", Bronze: "ブロンズ", Silver: "シルバー", Gold: "ゴールド", Platinum: "プラチナ", Diamond: "ダイヤモンド", Ascendant: "アセンダント", Immortal: "イモータル", Radiant: "レディアント",
    "Training Creator": "トレーニングクリエイター", "Community Workshop": "コミュニティワークショップ", "Target Workshop": "ターゲットワークショップ", "VALORANT Training": "VALORANTトレーニング",
  },
  zh: {
    Ascent: "亚海悬城", Split: "霓虹町", Haven: "隐世修所", Lotus: "莲花古城", Bind: "源工重镇", Corrode: "盐海矿镇", Abyss: "幽邃地窟", Summit: "Summit", Sunset: "日落之城", Icebox: "森寒冬港", Breeze: "微风岛屿", Fracture: "裂变峡谷", Pearl: "深海明珠",
    Vandal: "狂徒", Phantom: "幻影", Operator: "冥驹", Marshal: "莽侠", Outlaw: "逃犯", Guardian: "捍卫者", Sheriff: "警长", Ghost: "鬼魅", Spectre: "骇灵", Bulldog: "斗牛犬", Odin: "奥丁", Ares: "战神", Stinger: "毒蜂", Classic: "标配", Shorty: "短炮", Judge: "判官",
    Jett: "捷风", Neon: "霓虹", Chamber: "尚博勒", Phoenix: "不死鸟", Reyna: "芮娜", "KAY/O": "K/O", Updraft: "逐风", Tailwind: "顺风", Cloudburst: "云爆", "Blade Storm": "剑刃风暴", "High Gear": "高速档位", Headhunter: "猎头者", "Tour de Force": "鼎力之作",
    Iron: "黑铁", Bronze: "青铜", Silver: "白银", Gold: "黄金", Platinum: "铂金", Diamond: "钻石", Ascendant: "超凡", Immortal: "神话", Radiant: "辐能战魂",
    "Training Creator": "瓦创意工坊", "Community Workshop": "玩家创意工坊", "Target Workshop": "小球工坊", "VALORANT Training": "瓦工坊",
  },
};

if (!LANGS[lang] || !linesFile) {
  console.error("Usage: node scripts/translate-ollama.mjs <ko|ja|zh> <lines.json> [--batch N] [--model name] [--host url]");
  process.exit(1);
}
const L = LANGS[lang];
const OUT = path.join(ROOT, "app", "i18n", `${lang}.json`);
let done = {};
try { done = JSON.parse(fs.readFileSync(OUT, "utf-8")); } catch {}
const norm = s => String(s).trim().replace(/\s+/g, " ");
const todo = [...new Set(JSON.parse(fs.readFileSync(path.resolve(linesFile), "utf-8")).map(norm))]
  .filter(en => /[A-Za-z]{2}/.test(en) && !(en in done))
  .sort((a, b) => a.length - b.length);
console.log(`${lang}: ${Object.keys(done).length} in ${path.relative(ROOT, OUT)}, ${todo.length} to translate with ${MODEL}`);

const SYSTEM = `You localize openVaim, an offline aim trainer for VALORANT, into ${L.name}. Each item is one English line from the app: menu and settings text, drill names, drill descriptions, loading and result screens.
${L.style}
Fixed names (always use these): ${Object.entries(NAMES[lang]).map(([en, t]) => `${en} = ${t}`).join(", ")}.
Rules:
- Drill names are short titles: keep callouts (A Short, B Main, Mid, CT, Heaven, Garage) readable, translated the way players say them.
- Keep numbers, units, key names (Esc, Tab, Shift, Ctrl, N, B), "{}" placeholders, punctuation and symbols (·, ›, →, %, ×, /) as they are. Keep product names (VALORANT, openVaim, Discord, GitHub, eDPI, FPS, SMAA, MSAA, RGX, KTX2) in Latin letters.
- Some lines are fragments joined with others on screen (they may start with "," or "·"); translate them as fragments.
- Do not add explanations, quotes or notes.
Reply with only a JSON object mapping each item id to its translation, for every id.`;

function batches(list) {
  const out = [];
  let cur = [], size = 0;
  for (const en of list) {
    if (cur.length && (cur.length >= BATCH || size + en.length > MAX_CHARS)) { out.push(cur); cur = []; size = 0; }
    cur.push(en); size += en.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function chat(body) {
  const res = await fetch(HOST + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: false, think: "low", ...body }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()).message.content;
}
const ask = async items => JSON.parse(await chat({
  format: "json",
  options: { temperature: 0.2, num_ctx: 8192, repeat_penalty: 1.15 },
  messages: [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(items.map((en, i) => ({ id: String(i + 1), en }))) }],
}));
// Last try for one line: plain text instead of JSON.
const askPlain = async en => ({ "1": (await chat({
  options: { temperature: 0.3, num_ctx: 8192, repeat_penalty: 1.2, num_predict: Math.max(256, en.length * 4) },
  messages: [{ role: "system", content: SYSTEM.replace(/Reply with only a JSON object[^\n]*/, "Reply with only the translation of the one line, nothing else.") }, { role: "user", content: en }],
})).trim() });

function accept(en, value) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (L.forbid.test(value)) return false;
  // The English handed back unchanged (a sentence, not a code or a name).
  if (value.trim() === en && (en.match(/[A-Za-z]+/g) || []).length >= 3) return false;
  // Placeholders must survive.
  if ((en.match(/\{\}/g) || []).length !== (value.match(/\{\}/g) || []).length) return false;
  return true;
}

function save() {
  const sorted = Object.fromEntries(Object.entries(done).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(OUT + ".tmp", JSON.stringify(sorted, null, 1) + "\n");
  fs.renameSync(OUT + ".tmp", OUT);
}

const started = Date.now();
let translated = 0, failed = 0;
const groups = batches(todo);
for (let g = 0; g < groups.length; g++) {
  let items = groups[g];
  for (let attempt = 0; attempt < 3 && items.length; attempt++) {
    let reply = {};
    try { reply = await ask(items); } catch (err) { console.log(`batch ${g + 1}: ${err.message}`); }
    const retry = [];
    items.forEach((en, i) => {
      const value = reply[String(i + 1)];
      if (accept(en, value)) { done[en] = norm(value); translated++; } else retry.push(en);
    });
    items = retry;
    // Stragglers one by one, which small models handle better.
    if (items.length && attempt >= 1) {
      for (const en of items.splice(0)) {
        let ok = false;
        for (const fn of attempt === 1 ? [one => ask([one]), askPlain] : [askPlain]) {
          try {
            const r = await fn(en);
            if (accept(en, r["1"])) { done[en] = norm(r["1"]); translated++; ok = true; break; }
          } catch {}
        }
        if (!ok) items.push(en);
      }
    }
  }
  failed += items.length;
  save();
  const secs = (Date.now() - started) / 1000;
  console.log(`batch ${g + 1}/${groups.length}: ${translated} translated, ${failed} skipped, ~${Math.round((secs / (g + 1)) * (groups.length - g - 1) / 60)} min left`);
}
console.log(`Done: ${translated} translated, ${failed} skipped (they stay in English). Output: ${OUT}`);
