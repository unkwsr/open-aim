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
  const HTML_LANG = { en: "en", ko: "ko", ja: "ja", zh: "zh-CN" }[code] || "en";
  const setHtmlLang = () => { if (document.documentElement.lang !== HTML_LANG) document.documentElement.lang = HTML_LANG; };
  setHtmlLang();

  // Flags drawn inline (Windows has no flag emoji).
  const star = (cx, cy, r, turn = 0) => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const a = turn - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.382 : r;
      points.push((cx + rr * Math.cos(a)).toFixed(2) + "," + (cy + rr * Math.sin(a)).toFixed(2));
    }
    return `<polygon points="${points.join(" ")}" fill="#ffde00"/>`;
  };
  const stripes = Array.from({ length: 7 }, (_, i) => `<rect y="${(i * 2 * 20) / 13}" width="30" height="${20 / 13}" fill="#b22234"/>`).join("");
  const dots = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) dots.push(`<circle cx="${1.1 + c * 2 + (r % 2)}" cy="${1.1 + r * 2.05}" r=".38" fill="#fff"/>`);
  // Trigram: bars across the diagonal; "b" marks a broken bar.
  const trigram = (x, y, angle, bars) =>
    `<g transform="translate(${x} ${y}) rotate(${angle})" fill="#000">` +
    bars.map((b, i) => {
      const yy = -1.55 + i * 1.1;
      return b === "b"
        ? `<rect x="-2.5" y="${yy}" width="2.2" height=".75"/><rect x=".3" y="${yy}" width="2.2" height=".75"/>`
        : `<rect x="-2.5" y="${yy}" width="5" height=".75"/>`;
    }).join("") + "</g>";
  const FLAGS = {
    en: `<rect width="30" height="20" fill="#fff"/>${stripes}<rect width="12.6" height="${(7 * 20) / 13}" fill="#3c3b6e"/>${dots.join("")}`,
    ko: `<rect width="30" height="20" fill="#fff"/>` +
      `<g transform="rotate(33.69 15 10)"><circle cx="15" cy="10" r="5" fill="#0047a0"/>` +
      `<path d="M10 10a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0z" fill="#cd2e3a"/></g>` +
      trigram(7.6, 5.1, -56.31, ["s", "s", "s"]) + trigram(22.4, 14.9, -56.31, ["b", "b", "b"]) +
      trigram(22.4, 5.1, 56.31, ["b", "s", "b"]) + trigram(7.6, 14.9, 56.31, ["s", "b", "s"]),
    ja: `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>`,
    zh: `<rect width="30" height="20" fill="#de2910"/>${star(5, 5, 3)}${star(10, 2, 1, 0.9)}${star(12, 4, 1, 0.5)}${star(12, 7, 1, 0)}${star(10, 9, 1, -0.5)}`,
  };
  const flag = id => `<svg class="aim-lang-flag" viewBox="0 0 30 20" aria-hidden="true">${FLAGS[id]}</svg>`;

  const LANGUAGES = [
    { id: "en", name: "English" },
    { id: "ko", name: "한국어" },
    { id: "ja", name: "日本語" },
    { id: "zh", name: "中文" },
  ];
  const TEXT = {
    en: { tab: "Language", title: "Interface language", lead: "Choose the language for menus, settings and training.", reload: "The screen reloads to apply the change.", lobby: "Change the language from the lobby: switching reloads the screen and would end this run.", current: "In use", studio: "The Studio editor stays in English." },
    ko: { tab: "언어", title: "표시 언어", lead: "메뉴, 설정, 훈련 화면에 쓸 언어를 골라 주세요.", reload: "언어를 바꾸면 화면을 다시 불러와요.", lobby: "언어는 로비에서 바꿔 주세요. 바꾸면 화면을 다시 불러와서 지금 하던 판이 끝나요.", current: "사용 중", studio: "스튜디오(드릴 편집기)는 영어로 표시돼요." },
    ja: { tab: "言語", title: "表示言語", lead: "メニュー、設定、トレーニング画面の言語を選んでください。", reload: "切り替えると画面が再読み込みされます。", lobby: "言語はロビーで切り替えてください。切り替えると画面が再読み込みされ、プレイ中のラウンドが終わってしまいます。", current: "使用中", studio: "スタジオ（ドリル作成画面）は英語で表示されます。" },
    zh: { tab: "语言", title: "界面语言", lead: "选择菜单、设置和训练界面使用的语言。", reload: "切换后会重新加载页面。", lobby: "请在大厅里切换语言：切换会重新加载页面，正在进行的这一局会结束。", current: "使用中", studio: "工作室（训练编辑器）仍显示英文。" },
  };
  const T = TEXT[code] || TEXT.en;
  // Keep these lines in their own language (the translator would otherwise touch them).
  // The translator also protects the language names itself, in case it loads later.
  const protect = () => window.__aimLang?.protect?.(...LANGUAGES.map(l => l.name), ...Object.values(T));
  protect();

  const GLOBE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';

  const style = document.createElement("style");
  style.textContent = `
    .aim-lang-on .aim-lang-main > :not(.aim-lang-panel) { display: none !important; }
    .aim-lang-panel { display: none; padding: 18px 4px 24px; max-width: 760px; }
    .aim-lang-on .aim-lang-panel { display: block; }
    .aim-lang-panel h3 { margin: 0 0 6px; font-size: 15px; letter-spacing: .04em; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
    .aim-lang-panel h3::before { content: ""; width: 4px; height: 14px; background: #ff4655; transform: skewX(-15deg); }
    .aim-lang-panel > p { margin: 0 0 16px; opacity: .72; font-size: 13px; }
    .aim-lang-list { margin-bottom: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    .aim-lang-option { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.12); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; }
    .aim-lang-option:hover:not(:disabled) { border-color: rgba(255,70,85,.7); background: rgba(255,70,85,.08); }
    .aim-lang-option:disabled { cursor: default; }
    .aim-lang-option.is-active { border-color: #ff4655; background: rgba(255,70,85,.14); }
    .aim-lang-flag { width: 42px; height: 28px; flex: none; box-shadow: 0 0 0 1px rgba(255,255,255,.25); }
    .aim-lang-option b { font-size: 16px; font-weight: 600; }
    .aim-lang-option small { margin-left: auto; font-size: 11px; color: #ff4655; text-transform: uppercase; letter-spacing: .05em; }
    .aim-lang-note { margin: 14px 0 0; font-size: 12px; opacity: .6; }
    .aim-lang-note.is-warn { opacity: 1; color: #ffb4ba; }
  `;
  document.head.append(style);

  const inLobby = () => !!document.querySelector(".hall-topnav");

  function choose(id) {
    if (id === code || !inLobby()) return;
    try { localStorage.setItem(KEY, id); } catch {}
    location.reload();
  }

  function buildPanel(scoped) {
    const panel = document.createElement("div");
    panel.className = "aim-lang-panel";
    panel.setAttribute("role", "tabpanel");
    panel.innerHTML = `<h3>${T.title}</h3><p>${T.lead}</p><div class="aim-lang-list" role="radiogroup" aria-label="${T.title}"></div>` +
      `<p class="aim-lang-note"></p><p class="aim-lang-note">${T.studio}</p>`;
    const list = panel.querySelector(".aim-lang-list");
    for (const lang of LANGUAGES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "aim-lang-option" + (lang.id === code ? " is-active" : "");
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(lang.id === code));
      b.lang = { en: "en", ko: "ko", ja: "ja", zh: "zh-CN" }[lang.id];
      b.innerHTML = flag(lang.id) + `<b>${lang.name}</b>` + (lang.id === code ? `<small>${T.current}</small>` : "");
      b.addEventListener("click", () => choose(lang.id));
      list.append(b);
    }
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
    });
  }, { childList: true, subtree: true });
  mount();
})();
