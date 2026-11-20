// Settings > Language: a tab after Visuals with English, Korean, Japanese and Chinese,
// each with its flag and its own name. The choice is saved in localStorage
// ("aim-ui-lang") and read by the translator (i18n/runtime.js, loaded by main.js) when the
// page loads, so switching reloads the page. The tab is added next to the game's own
// tabs (copying their scoped-style attributes); its panel replaces the settings list
// while it is open.
(() => {
  if (window.__aimLanguageTab) return;
  window.__aimLanguageTab = true;

  const KEY = "aim-ui-lang";
  // Same setting the translator reads (this script can run before the translator has loaded).
  let code = "en";
  try { const saved = localStorage.getItem(KEY); if (["en", "ko", "ja", "zh"].includes(saved)) code = saved; } catch {}
  // The page language picks the right CJK glyphs (Japanese kanji vs Chinese hanzi). The
  // game's runtime sets "en" when it loads, so this is reapplied whenever the page changes.
  const HTML_LANGS = { en: "en", ko: "ko", ja: "ja", zh: "zh-CN" };
  const HTML_LANG = HTML_LANGS[code] || "en";
  const setHtmlLang = () => { if (document.documentElement.lang !== HTML_LANG) document.documentElement.lang = HTML_LANG; };
  setHtmlLang();

  // Flags drawn inline (Windows has no flag emoji). language-panel-v2: drawn on a 39×26 grid and
  // shown at 78×52 px, so every unit is exactly 2 px and stripe edges land on whole pixels (the old
  // 30×20 drawing at 42×28 put the US stripes between pixels, which looked blurry).
  const star = (cx, cy, r, turn = 0) => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const a = turn - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.382 : r;
      points.push((cx + rr * Math.cos(a)).toFixed(2) + "," + (cy + rr * Math.sin(a)).toFixed(2));
    }
    return `<polygon points="${points.join(" ")}" fill="#ffde00"/>`;
  };
  // 13 stripes of 2 units; blue canton over the top 7.
  const stripes = Array.from({ length: 7 }, (_, i) => `<rect y="${i * 4}" width="39" height="2" fill="#b22234"/>`).join("");
  const dots = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) dots.push(`<circle cx="${1.6 + c * 2.56 + (r % 2) * 1.28}" cy="${1.5 + r * 2.75}" r=".62" fill="#fff"/>`);
  // Trigram: bars across the diagonal; "b" marks a broken bar.
  const trigram = (x, y, angle, bars) =>
    `<g transform="translate(${x} ${y}) rotate(${angle})" fill="#000">` +
    bars.map((b, i) => {
      const yy = -1.55 + i * 1.1;
      return b === "b"
        ? `<rect x="-2.5" y="${yy}" width="2.2" height=".75"/><rect x=".3" y="${yy}" width="2.2" height=".75"/>`
        : `<rect x="-2.5" y="${yy}" width="5" height=".75"/>`;
    }).join("") + "</g>";
  // Korea and China keep their 30×20 drawing, scaled ×1.3 onto the 39×26 grid.
  const FLAGS = {
    en: `<rect width="39" height="26" fill="#fff"/>${stripes}<rect width="16" height="14" fill="#3c3b6e"/>${dots.join("")}`,
    ko: `<rect width="39" height="26" fill="#fff"/><g transform="scale(1.3)">` +
      `<g transform="rotate(33.69 15 10)"><circle cx="15" cy="10" r="5" fill="#0047a0"/>` +
      `<path d="M10 10a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0z" fill="#cd2e3a"/></g>` +
      trigram(7.6, 5.1, -56.31, ["s", "s", "s"]) + trigram(22.4, 14.9, -56.31, ["b", "b", "b"]) +
      trigram(22.4, 5.1, 56.31, ["b", "s", "b"]) + trigram(7.6, 14.9, 56.31, ["s", "b", "s"]) + `</g>`,
    ja: `<rect width="39" height="26" fill="#fff"/><circle cx="19.5" cy="13" r="7.8" fill="#bc002d"/>`,
    zh: `<rect width="39" height="26" fill="#de2910"/><g transform="scale(1.3)">${star(5, 5, 3)}${star(10, 2, 1, 0.9)}${star(12, 4, 1, 0.5)}${star(12, 7, 1, 0)}${star(10, 9, 1, -0.5)}</g>`,
  };
  const flag = (id, cls = "aim-lang-flag") => `<svg class="${cls}" viewBox="0 0 39 26" aria-hidden="true">${FLAGS[id]}</svg>`;

  const LANGUAGES = [
    { id: "en", name: "English" },
    { id: "ko", name: "한국어" },
    { id: "ja", name: "日本語" },
    { id: "zh", name: "中文" },
  ];
  const TEXT = {
    en: { tab: "Language", title: "Interface language", lead: "Choose the language for menus, settings and training.", reload: "The screen reloads to apply the change.", lobby: "Change the language from the lobby: switching reloads the screen and would end this run.", current: "In use", pick: "Switch",
      names: { en: "English", ko: "Korean", ja: "Japanese", zh: "Chinese (Simplified)" }, preview: "Preview", covers: "What is translated",
      items: ["Menus, settings and the lobby", "Training, results and history", "Studio drill editor", "Bot types in player terms (AD strafe, hold, peek)"], keeps: "Drill names written by players stay as they are." },
    ko: { tab: "언어", title: "표시 언어", lead: "메뉴, 설정, 훈련 화면에 쓸 언어를 골라 주세요.", reload: "언어를 바꾸면 화면을 다시 불러와요.", lobby: "언어는 로비에서 바꿔 주세요. 바꾸면 화면을 다시 불러와서 지금 하던 판이 끝나요.", current: "사용 중", pick: "바꾸기",
      names: { en: "영어", ko: "한국어", ja: "일본어", zh: "중국어 (간체)" }, preview: "미리 보기", covers: "번역되는 곳",
      items: ["메뉴, 설정, 로비", "훈련, 결과, 기록", "스튜디오 드릴 편집기", "플레이어 용어로 된 봇 종류 (AD 무빙, 홀딩, 피킹)"], keeps: "플레이어가 지은 드릴 이름은 그대로 표시돼요." },
    ja: { tab: "言語", title: "表示言語", lead: "メニュー、設定、トレーニング画面の言語を選んでください。", reload: "切り替えると画面が再読み込みされます。", lobby: "言語はロビーで切り替えてください。切り替えると画面が再読み込みされ、プレイ中のラウンドが終わってしまいます。", current: "使用中", pick: "切り替え",
      names: { en: "英語", ko: "韓国語", ja: "日本語", zh: "中国語（簡体字）" }, preview: "プレビュー", covers: "翻訳される場所",
      items: ["メニュー、設定、ロビー", "トレーニング、結果、履歴", "スタジオのドリル作成画面", "プレイヤー用語のボットの種類（レレレ、待ち、ピーク）"], keeps: "プレイヤーが付けたドリル名はそのまま表示されます。" },
    zh: { tab: "语言", title: "界面语言", lead: "选择菜单、设置和训练界面使用的语言。", reload: "切换后会重新加载页面。", lobby: "请在大厅里切换语言：切换会重新加载页面，正在进行的这一局会结束。", current: "使用中", pick: "切换",
      names: { en: "英语", ko: "韩语", ja: "日语", zh: "简体中文" }, preview: "预览", covers: "翻译范围",
      items: ["菜单、设置和大厅", "训练、成绩和记录", "工作室训练编辑器", "用玩家术语的 bot 类型（AD 拉扯、架枪、拉枪）"], keeps: "玩家起的训练名称保持原样。" },
  };
  const T = TEXT[code] || TEXT.en;
  // Sample lines for the preview, each in its own language (same words as the packs).
  const SAMPLES = {
    en: { tabs: ["VALORANT Training", "Target Workshop", "Settings"], stat: "Accuracy", start: "Start training", drill: "New drill", bot: "Strafer 2" },
    ko: { tabs: ["VALORANT 훈련", "타깃 워크숍", "설정"], stat: "정확도", start: "훈련 시작", drill: "새 드릴", bot: "AD 무빙 2" },
    ja: { tabs: ["VALORANTトレーニング", "ターゲットワークショップ", "設定"], stat: "精度", start: "トレーニング開始", drill: "新しいドリル", bot: "レレレ 2" },
    zh: { tabs: ["瓦工坊", "小球工坊", "设置"], stat: "准确率", start: "开始训练", drill: "新建训练", bot: "AD 拉扯 2" },
  };
  // Keep these lines in their own language (the translator would otherwise touch them).
  // The translator also protects the language names itself, in case it loads later.
  const protect = () => window.__aimLang?.protect?.(...LANGUAGES.map(l => l.name), ...Object.values(T).filter(v => typeof v === "string"),
    ...Object.values(T.names), ...T.items);
  protect();

  const GLOBE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';

  const style = document.createElement("style");
  style.textContent = `
    .aim-lang-on .aim-lang-main > :not(.aim-lang-panel) { display: none !important; }
    .aim-lang-panel { display: none; padding: 18px 4px 28px; max-width: 1120px; }
    .aim-lang-on .aim-lang-panel { display: block; }
    .aim-lang-panel h3 { margin: 0 0 6px; font-size: 15px; letter-spacing: .04em; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
    .aim-lang-panel h3::before { content: ""; width: 4px; height: 14px; background: #ff4655; transform: skewX(-15deg); }
    .aim-lang-panel > p { margin: 0 0 18px; opacity: .72; font-size: 13px; }
    .aim-lang-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .aim-lang-option { position: relative; display: flex; align-items: center; gap: 18px; min-height: 92px; padding: 18px 22px 18px 18px;
      background: linear-gradient(90deg, rgba(255,255,255,.055), rgba(255,255,255,.02)); border: 1px solid rgba(255,255,255,.1);
      color: inherit; font: inherit; text-align: left; cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
    .aim-lang-option::before { content: ""; position: absolute; left: -1px; top: -1px; bottom: -1px; width: 3px; background: transparent; transition: background .15s; }
    .aim-lang-option:hover:not(:disabled) { border-color: rgba(255,70,85,.55); background: linear-gradient(90deg, rgba(255,70,85,.12), rgba(255,255,255,.02)); }
    .aim-lang-option:hover:not(:disabled)::before { background: rgba(255,70,85,.7); }
    .aim-lang-option:disabled { cursor: default; opacity: .45; }
    .aim-lang-option.is-active { border-color: rgba(255,70,85,.8); background: linear-gradient(90deg, rgba(255,70,85,.2), rgba(255,70,85,.04)); opacity: 1; }
    .aim-lang-option.is-active::before { background: #ff4655; }
    .aim-lang-flag { width: 78px; height: 52px; flex: none; display: block; box-shadow: 0 0 0 1px rgba(255,255,255,.22), 0 6px 16px -8px #000; }
    .aim-lang-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .aim-lang-option b { font-size: 22px; font-weight: 700; line-height: 1.1; }
    .aim-lang-sub { font-size: 12px; opacity: .6; letter-spacing: .03em; }
    .aim-lang-mark { margin-left: auto; flex: none; display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.45); }
    .aim-lang-mark i { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.3); border-radius: 50%; box-sizing: border-box; display: grid; place-items: center; }
    .aim-lang-option:hover:not(:disabled) .aim-lang-mark { color: #fff; }
    .aim-lang-option.is-active .aim-lang-mark { color: #ff4655; }
    .aim-lang-option.is-active .aim-lang-mark i { border-color: #ff4655; }
    .aim-lang-option.is-active .aim-lang-mark i::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #ff4655; }
    .aim-lang-extra { margin-top: 18px; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 12px; }
    .aim-lang-box { border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.025); padding: 16px 18px; }
    .aim-lang-box h4 { margin: 0 0 12px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; opacity: .55; display: flex; align-items: center; gap: 8px; }
    .aim-lang-mini { width: 21px; height: 14px; box-shadow: 0 0 0 1px rgba(255,255,255,.2); }
    .aim-lang-pv-bar { display: flex; gap: 2px; background: #0b0d12; border-bottom: 2px solid #ff4655; margin-bottom: 14px; overflow: hidden; }
    .aim-lang-pv-bar span { padding: 9px 14px; font-size: 13px; font-weight: 700; text-transform: uppercase; white-space: nowrap; opacity: .7; }
    .aim-lang-pv-bar span.on { background: #ff4655; opacity: 1; transform: skewX(-12deg); margin: 0 4px; }
    .aim-lang-pv-bar span.on em { display: inline-block; transform: skewX(12deg); font-style: normal; }
    .aim-lang-pv-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .aim-lang-pv-stat { display: flex; flex-direction: column; padding: 8px 12px; border: 1px solid rgba(255,255,255,.1); min-width: 90px; }
    .aim-lang-pv-stat small { font-size: 11px; opacity: .55; }
    .aim-lang-pv-stat strong { font-size: 18px; }
    .aim-lang-pv-chip { padding: 8px 12px; border: 1px solid rgba(255,255,255,.14); font-size: 13px; }
    .aim-lang-pv-btn { margin-left: auto; padding: 10px 16px; background: #ff4655; font-size: 13px; font-weight: 700; text-transform: uppercase; }
    .aim-lang-covers { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; font-size: 13px; }
    .aim-lang-covers li { display: flex; gap: 10px; align-items: baseline; }
    .aim-lang-covers li::before { content: ""; flex: none; width: 10px; height: 5px; border-left: 2px solid #3ddc84; border-bottom: 2px solid #3ddc84; transform: rotate(-45deg) translateY(-2px); }
    .aim-lang-keeps { margin: 12px 0 0; font-size: 12px; opacity: .55; }
    .aim-lang-note { margin: 16px 0 0; font-size: 12px; opacity: .6; display: flex; align-items: center; gap: 8px; }
    .aim-lang-note::before { content: "↻"; font-size: 14px; }
    .aim-lang-note.is-warn { opacity: 1; color: #ffb4ba; }
    .aim-lang-note.is-warn::before { content: "!"; font-weight: 800; }
    @media (max-width: 1250px) { .aim-lang-extra { grid-template-columns: 1fr; } }
    @media (max-width: 900px) { .aim-lang-list { grid-template-columns: 1fr; } }
  `;
  document.head.append(style);

  const inLobby = () => !!document.querySelector(".hall-topnav");

  // language-reopen-v1: after switching, the reload comes back to Settings > Language instead of
  // the lobby's first page, so someone who picked a language they can't read can switch right back.
  const REOPEN = "aim-lang-reopen";
  function choose(id) {
    if (id === code || !inLobby()) return;
    try { localStorage.setItem(KEY, id); sessionStorage.setItem(REOPEN, String(Date.now())); } catch {}
    location.reload();
  }

  let reopenAt = 0;
  try { reopenAt = Number(sessionStorage.getItem(REOPEN)) || 0; } catch {}
  let settingsClicked = 0;
  function reopen() {
    if (!reopenAt) return;
    // Give up if the lobby never shows up (e.g. the page went somewhere else).
    if (Date.now() - reopenAt > 30000) { reopenAt = 0; try { sessionStorage.removeItem(REOPEN); } catch {} return; }
    const root = document.querySelector(".st-rows .st-tabs")?.closest(".st-rows");
    if (root?.querySelector(".aim-lang-panel")) {
      setOpen(root, true);
      root.querySelector(".aim-lang-tab")?.scrollIntoView({ block: "nearest" });
      reopenAt = 0;
      try { sessionStorage.removeItem(REOPEN); } catch {}
      return;
    }
    // Open the lobby's Settings page (its tab has no id; find it by its label, English or translated).
    if (Date.now() - settingsClicked < 1500) return;
    const labels = new Set(["settings", String(window.__aimLang?.t?.("Settings") || "").toLowerCase()]);
    const tab = [...document.querySelectorAll(".hall-topnav .hall-tab")].find(b => labels.has(b.textContent.trim().toLowerCase()));
    if (tab) { settingsClicked = Date.now(); tab.click(); }
  }

  function buildPanel(scoped) {
    const panel = document.createElement("div");
    panel.className = "aim-lang-panel";
    panel.setAttribute("role", "tabpanel");
    panel.innerHTML = `<h3>${T.title}</h3><p>${T.lead}</p><div class="aim-lang-list" role="radiogroup" aria-label="${T.title}"></div>` +
      `<div class="aim-lang-extra"><div class="aim-lang-box aim-lang-preview"></div>` +
      `<div class="aim-lang-box"><h4>${T.covers}</h4><ul class="aim-lang-covers">${T.items.map(i => `<li>${i}</li>`).join("")}</ul>` +
      `<p class="aim-lang-keeps">${T.keeps}</p></div></div>` +
      `<p class="aim-lang-note"></p>`;
    const list = panel.querySelector(".aim-lang-list");
    const preview = panel.querySelector(".aim-lang-preview");
    // The preview shows the menus in the language under the mouse (the one in use otherwise).
    const showPreview = (id) => {
      const s = SAMPLES[id];
      preview.lang = HTML_LANGS[id];
      preview.innerHTML = `<h4>${flag(id, "aim-lang-mini")}${T.preview} · ${LANGUAGES.find(l => l.id === id).name}</h4>` +
        `<div class="aim-lang-pv-bar">${s.tabs.map((t, i) => i === 0 ? `<span class="on"><em>${t}</em></span>` : `<span>${t}</span>`).join("")}</div>` +
        `<div class="aim-lang-pv-row"><div class="aim-lang-pv-stat"><small>${s.stat}</small><strong>87%</strong></div>` +
        `<span class="aim-lang-pv-chip">${s.drill}</span><span class="aim-lang-pv-chip">${s.bot}</span>` +
        `<span class="aim-lang-pv-btn">${s.start}</span></div>`;
      for (const el of [preview, ...preview.querySelectorAll("*")]) for (const a of scoped) el.setAttribute(a, "");
    };
    for (const lang of LANGUAGES) {
      const active = lang.id === code;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "aim-lang-option" + (active ? " is-active" : "");
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(active));
      b.lang = HTML_LANGS[lang.id];
      b.innerHTML = flag(lang.id) + `<span class="aim-lang-text"><b>${lang.name}</b><span class="aim-lang-sub">${T.names[lang.id]}</span></span>` +
        `<span class="aim-lang-mark">${active ? T.current : T.pick}<i></i></span>`;
      b.addEventListener("click", () => choose(lang.id));
      b.addEventListener("mouseenter", () => showPreview(lang.id));
      b.addEventListener("focus", () => showPreview(lang.id));
      list.append(b);
    }
    list.addEventListener("mouseleave", () => showPreview(code));
    showPreview(code);
    for (const el of [panel, ...panel.querySelectorAll("*")]) for (const a of scoped) el.setAttribute(a, "");
    return panel;
  }

  function refreshNote(panel) {
    const note = panel.querySelector(".aim-lang-note");
    const lobby = inLobby();
    note.textContent = lobby ? T.reload : T.lobby;
    note.classList.toggle("is-warn", !lobby);
    for (const b of panel.querySelectorAll(".aim-lang-option")) b.disabled = !lobby && !b.classList.contains("is-active");
  }

  function setOpen(root, open) {
    root.classList.toggle("aim-lang-on", open);
    const tab = root.querySelector(".aim-lang-tab");
    if (tab) {
      tab.classList.toggle("is-active", open);
      tab.setAttribute("aria-selected", String(open));
    }
    if (open) {
      for (const t of root.querySelectorAll(".st-tab:not(.aim-lang-tab)")) {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      }
      const panel = root.querySelector(".aim-lang-panel");
      if (panel) refreshNote(panel);
    }
  }

  function mount() {
    // Settings is a page (section.st-view) in the lobby and a dialog (.sd) during a run.
    const tabs = document.querySelector(".st-rows .st-tabs");
    const root = tabs?.closest(".st-rows");
    if (!root || !window.__aimLang) return;
    protect();
    const last = tabs.querySelector('.st-tab[data-tab="range"]') || tabs.querySelector(".st-tab:last-of-type");
    if (!last) return;
    const scoped = [...last.attributes].filter(a => a.name.startsWith("data-v-")).map(a => a.name);
    let tab = tabs.querySelector(".aim-lang-tab");
    if (!tab) {
      tab = document.createElement("button");
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.className = "st-tab aim-lang-tab";
      tab.dataset.tab = "language";
      tab.title = T.title;
      tab.innerHTML = GLOBE + `<span>${T.tab}</span>`;
      for (const el of [tab, ...tab.querySelectorAll("*")]) for (const a of scoped) el.setAttribute(a, "");
      tab.addEventListener("click", () => setOpen(root, true));
      // Any of the game's own tabs closes the Language panel and shows its own page.
      tabs.addEventListener("click", e => {
        const other = e.target.closest(".st-tab:not(.aim-lang-tab)");
        if (!other || !root.classList.contains("aim-lang-on")) return;
        setOpen(root, false);
        other.classList.add("is-active");
        other.setAttribute("aria-selected", "true");
      });
      // Typing a search shows the game's results again.
      root.addEventListener("input", e => { if (e.target.matches("input")) setOpen(root, false); });
    }
    if (tabs.lastElementChild !== tab) tabs.append(tab);
    // Searching shows result counts on the tabs; the Language tab has none.
    tab.hidden = !!tabs.querySelector(".st-tab-count");
    const main = root.querySelector(":scope > .st-main, .sd-main");
    if (!main) return;
    // Re-added each time: the game resets this element's classes when it re-renders.
    if (!main.classList.contains("aim-lang-main")) main.classList.add("aim-lang-main");
    if (!main.querySelector(".aim-lang-panel")) main.append(buildPanel(scoped));
  }

  let queued = false;
  window.__aimWatchPage(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      setHtmlLang();
      mount();
      reopen();
    });
  }, { childList: true, subtree: true });
  mount();
  reopen();
})();
