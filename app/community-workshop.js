// Small controls on the game's existing Community Workshop tab. The page's
// creation cards and training actions remain owned by the original UI.
(() => {
  if (window.__aimCommunityControls) return;
  window.__aimCommunityControls = true;
  const api = window.__aimDesktop?.workshop;
  if (!api) return;
  let identity = null, checking = false, queued = false, sortOutsideBound = false;
  // Errors from the desktop side arrive wrapped ("Error invoking remote method '…': Error: …");
  // show only the part written for the player.
  const reason = (error, fallback) =>
    String(error?.message || "").replace(/^Error invoking remote method '[^']*': (?:Error: )?/, "") || fallback;

  async function checkIdentity() {
    if (checking) return;
    checking = true;
    try { identity = (await api.status()).user || null; }
    catch { identity = null; }
    checking = false;
    sync();
  }

  function active() {
    return [...document.querySelectorAll(".hall-tab")].some((tab) =>
      tab.classList.contains("is-active") && /community workshop/i.test(tab.textContent));
  }

  function heading() {
    return [...document.querySelectorAll("h1,h2")].find((node) =>
      node.textContent.trim().toUpperCase() === "COMMUNITY WORKSHOP");
  }

  function syncSortMenu() {
    const filters = document.querySelector(".pw .pw-filters");
    if (!filters || !active()) return;
    const select = [...filters.querySelectorAll(".pw-drop select")].find((node) =>
      [...node.options].some((option) => /popular this week/i.test(option.textContent)));
    if (!select) return;
    const wrap = select.closest(".pw-drop");
    if (wrap.querySelector(".es-sort-trigger")) return;
    select.classList.add("es-sort-native");
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;
    wrap.classList.add("es-sort-wrap");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "es-sort-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const menu = document.createElement("div");
    menu.className = "es-sort-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Sort creations");
    menu.hidden = true;
    const options = [...select.options];
    const close = () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      wrap.classList.remove("is-open");
    };
    const refresh = () => {
      trigger.textContent = select.selectedOptions[0]?.textContent.trim() || "Sort";
      for (const item of menu.children)
        item.setAttribute("aria-selected", String(item.dataset.value === select.value));
    };
    for (const option of options) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "es-sort-option";
      item.setAttribute("role", "option");
      item.dataset.value = option.value;
      item.textContent = option.textContent.trim();
      item.onclick = () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh();
        close();
        trigger.focus();
      };
      menu.append(item);
    }
    trigger.onclick = () => {
      menu.hidden = !menu.hidden;
      trigger.setAttribute("aria-expanded", String(!menu.hidden));
      wrap.classList.toggle("is-open", !menu.hidden);
      if (!menu.hidden) menu.querySelector('[aria-selected="true"]')?.focus();
    };
    wrap.onkeydown = (event) => {
      if (event.key === "Escape") { close(); trigger.focus(); }
      else if (!menu.hidden && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const items = [...menu.children];
        const index = items.indexOf(document.activeElement);
        items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }
    };
    if (!sortOutsideBound) {
      sortOutsideBound = true;
      document.addEventListener("pointerdown", (event) => {
        const open = document.querySelector(".es-sort-wrap.is-open");
        if (open && !open.contains(event.target)) {
          open.querySelector(".es-sort-menu").hidden = true;
          open.querySelector(".es-sort-trigger").setAttribute("aria-expanded", "false");
          open.classList.remove("is-open");
        }
      });
    }
    select.addEventListener("change", refresh);
    wrap.append(trigger, menu);
    refresh();
  }

  // "How it works" strip in the banner under "Share your scenario?": three steps
  // (build, publish, goes live) and buttons to the Creator and to the review rules.
  const ICONS = {
    build: '<path d="M4 20h16M6 16l9-9 3 3-9 9H6z"/><path d="M13 9l3 3"/>',
    send: '<path d="M4 12l16-8-6 16-3-7z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  };
  function syncHowTo() {
    const stage = document.querySelector(".pw .pw-stage");
    if (!stage || stage.querySelector(".es-howto")) return;
    const strip = document.createElement("div");
    strip.className = "es-howto";
    const steps = [
      ["build", "Build a drill", "Pick a map, place bots, set the rules in the Creator"],
      ["send", "Publish it", "Add a title and a note, sign in with Discord"],
      ["check", "Goes live", "After a quick review, usually the same day"],
    ];
    steps.forEach(([icon, title, text], index) => {
      const step = document.createElement("div");
      step.className = "es-howto-step";
      step.innerHTML = `<em>0${index + 1}</em><i><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
        stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg></i>`;
      const words = document.createElement("span");
      const name = document.createElement("b");
      name.textContent = title;
      const note = document.createElement("small");
      note.textContent = text;
      words.append(name, note);
      step.append(words);
      strip.append(step);
    });
    const go = document.createElement("div");
    go.className = "es-howto-go";
    const creator = document.createElement("button");
    creator.type = "button";
    creator.className = "is-primary";
    creator.textContent = "+ OPEN CREATOR";
    creator.onclick = () => location.assign("/studio/");
    // "How review works" button removed at the user's request (showReviewRules is kept, unused).
    go.append(creator);
    strip.append(go);
    stage.append(strip);
  }
  // What happens to an upload, in the service's own limits (workshop/worker.mjs).
  function showReviewRules() {
    if (document.querySelector(".es-workshop-scrim")) return;
    const scrim = document.createElement("div");
    scrim.className = "es-workshop-scrim";
    const panel = document.createElement("section");
    panel.className = "es-workshop-panel es-rules";
    const head = document.createElement("header");
    head.className = "es-review-head";
    const title = document.createElement("h2");
    title.textContent = "HOW REVIEW WORKS";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "CLOSE";
    const shut = () => { scrim.remove(); document.removeEventListener("keydown", onKey, true); };
    const onKey = (event) => { if (event.key === "Escape") { event.stopPropagation(); shut(); } };
    document.addEventListener("keydown", onKey, true);
    close.onclick = shut;
    scrim.onclick = (event) => { if (event.target === scrim) shut(); };
    head.append(title, close);
    const list = document.createElement("ol");
    for (const [name, text] of [
      ["Every upload is played first", "A moderator plays your drill before it goes public. Most are checked the same day."],
      ["Approved: it goes live", "It appears in Community Workshop for every player, with your Discord name as the creator."],
      ["Not approved: players never see it", "You can change the drill in the Creator and publish it again."],
      ["Limits", "Up to 10 uploads a day. Your Discord account must be at least 7 days old. A drill can be at most 100 KB (long recordings and many objects make it bigger)."],
      ["Taken down later", "A moderator can still hide or remove a published drill."],
    ]) {
      const item = document.createElement("li");
      const label = document.createElement("b");
      label.textContent = name;
      const note = document.createElement("p");
      note.textContent = text;
      item.append(label, note);
      list.append(item);
    }
    panel.append(head, list);
    scrim.append(panel);
    document.body.append(scrim);
    close.focus();
  }

  function sync() {
    syncSortMenu();
    syncHowTo();
    const old = document.querySelector(".es-workshop-toolbar");
    if (!active()) { old?.remove(); return; }
    const title = heading();
    if (!title) return;
    if (old && old.parentElement === title.parentElement &&
        old.dataset.identity === (identity?.id || "")) return;
    old?.remove();
    const bar = document.createElement("div");
    bar.className = "es-workshop-toolbar";
    bar.dataset.identity = identity?.id || "";
    const create = document.createElement("button");
    create.type = "button";
    create.textContent = "Create & Publish";
    create.className = "es-head-tab";
    create.onclick = () => location.assign("/studio/");
    bar.append(create);
    if (identity?.moderator) {
      const review = document.createElement("button");
      review.type = "button";
      review.textContent = "Review uploads";
      review.className = "es-head-tab es-workshop-review";
      review.onclick = showQueue;
      bar.append(review);
    }
    // No Sign out here: the lobby's account menu already has it.
    bar.append(refreshButton(), codeBox());
    title.parentElement.append(bar);
  }

  function message(panel, value) {
    panel.querySelector(".es-workshop-message").textContent = value;
  }

  // Share codes: the six characters printed on every card ("NO.5BDF31" -> 5BDF31).
  const shortCode = (code) => String(code || "").slice(0, 6).toUpperCase();
  const cleanCode = (text) => String(text || "").trim().replace(/^no\.?/i, "").replace(/[^0-9a-f]/gi, "").toUpperCase();
  async function findByCode(text) {
    const wanted = cleanCode(text);
    if (wanted.length < 4) return { wanted, found: [] };
    const value = await fetch("/prod-api/api/v1/public/val/aimlab/pw/items?pageNum=1&pageSize=100&sort=LATEST")
      .then((response) => response.json()).catch(() => null);
    const found = (value?.data?.list || []).filter((item) => String(item.code || "").toUpperCase().startsWith(wanted));
    return { wanted, found };
  }
  // Open a drill's panel in place: the game watches "?pw=<code>" on its own router, so handing the
  // code to the router opens the panel without reloading the page (a reload showed the loading
  // screen first). Falls back to the full link if the router can't be reached.
  function openDrill(code) {
    const link = "/aim?pw=" + encodeURIComponent(code);
    const router = document.querySelector("#app")?.__vue_app__?.config?.globalProperties?.$router;
    if (!router) { location.assign(link); return; }
    const query = { ...(router.currentRoute?.value?.query || {}), pw: code };
    // The router change would flash the game's blue page-loading bar (#nprogress) at the top;
    // hide it for this one change only (theme-esports.css "es-quiet-nav").
    const root = document.documentElement;
    root.classList.add("es-quiet-nav");
    clearTimeout(openDrill.timer);
    const done = () => { openDrill.timer = setTimeout(() => root.classList.remove("es-quiet-nav"), 1200); };
    router.push({ path: "/aim", query }).then(done, () => { done(); location.assign(link); });
  }
  // The clipboard API refuses when the window is not focused; the older copy command still works then.
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.append(area);
    area.select();
    let done = false;
    try { done = document.execCommand("copy"); } catch {}
    area.remove();
    return done;
  }
  const SHARE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';

  // Refresh: asks the workshop service again and redraws the shelves and list in place (the game's
  // own list reload, hooked as window.__aimPwReload in ChJ6FlD4.js), without reloading the page.
  function refreshButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "es-refresh";
    button.title = "Load the newest drills, likes and covers";
    button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg><span>Refresh</span>';
    button.onclick = async () => {
      if (button.classList.contains("is-busy")) return;
      button.classList.add("is-busy");
      const started = Date.now();
      try {
        await api.refresh?.();
        for (const key of Object.keys(boards)) delete boards[key];
        cardLikes = { at: 0, promise: null, byPrefix: null };
        loadCardLikes(true);
        if (typeof window.__aimPwReload === "function") window.__aimPwReload();
        else { location.reload(); return; }
      } catch {}
      setTimeout(() => button.classList.remove("is-busy"), Math.max(0, 700 - (Date.now() - started)));
    };
    return button;
  }

  // "Enter code" box in the Community Workshop header: opens the drill with that code.
  function codeBox() {
    const form = document.createElement("form");
    form.className = "es-code-box";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "ENTER CODE";
    input.maxLength = 24;
    input.spellcheck = false;
    input.setAttribute("aria-label", "Drill share code");
    const go = document.createElement("button");
    go.type = "submit";
    go.textContent = "GO";
    const note = document.createElement("div");
    note.className = "es-code-note";
    note.hidden = true;
    const say = (text) => { note.replaceChildren(text); note.hidden = !text; };
    input.oninput = () => say("");
    form.onsubmit = async (event) => {
      event.preventDefault();
      say("");
      const { wanted, found } = await findByCode(input.value);
      if (wanted.length < 4) { say("Type the code from the drill, for example 5BDF31."); return; }
      if (found.length === 1) { openDrill(found[0].code); return; }
      if (!found.length) { say("No published drill has code " + wanted + "."); return; }
      // Two drills share the start of their code: pick one.
      const pick = document.createElement("div");
      pick.className = "es-code-pick";
      pick.append("Several drills start with " + wanted + ":");
      for (const item of found.slice(0, 6)) {
        const choice = document.createElement("button");
        choice.type = "button";
        choice.textContent = item.title + " · " + (item.authorName || "Creator");
        choice.onclick = () => openDrill(item.code);
        pick.append(choice);
      }
      say(pick);
    };
    form.append(input, go, note);
    return form;
  }

  // Cover pictures: any size in, 640x360 JPEG out (cropped to fill), so it stays small.
  // The file input is kept in the page while the dialog is open (a detached one can be
  // dropped before the player picks a file).
  function chooseCover(done, failed) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.append(input);
    const cleanup = () => setTimeout(() => input.remove(), 0);
    input.addEventListener("cancel", cleanup);
    input.onchange = async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) return;
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = 640; canvas.height = 360;
        const scale = Math.max(640 / bitmap.width, 360 / bitmap.height);
        const w = bitmap.width * scale, h = bitmap.height * scale;
        canvas.getContext("2d").drawImage(bitmap, (640 - w) / 2, (360 - h) / 2, w, h);
        let quality = 0.86, data = "";
        do { data = canvas.toDataURL("image/jpeg", quality).split(",")[1]; quality -= 0.12; } while (data.length > 260000 && quality > 0.3);
        await done(data);
      } catch (error) { failed(error); }
    };
    input.click();
  }

  // Map ids as the uploads store them, with the names players know (same list as studio/drill.js MAPS).
  const MAP_NAMES = { ascent: "Ascent", bonsai: "Split", triad: "Haven", plummet: "Summit", jam: "Lotus",
    infinity: "Abyss", rook: "Corrode", duality: "Bind", juliett: "Sunset", pitt: "Pearl", port: "Icebox" };
  const mapName = (id) => id ? MAP_NAMES[id] || id : "Training range";
  // Uploads this moderator has opened with PLAY, kept on this computer (PLAY reloads the page).
  const PLAYED_KEY = "workshop-review-played";
  const playedList = () => { try { return JSON.parse(localStorage.getItem(PLAYED_KEY)) || {}; } catch { return {}; } };
  const markPlayed = (code) => {
    const all = playedList();
    all[code] = Date.now();
    try { localStorage.setItem(PLAYED_KEY, JSON.stringify(all)); } catch {}
  };
  const ago = (iso) => {
    const ms = Date.now() - Date.parse(iso || "");
    if (!Number.isFinite(ms)) return "";
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 60) return min <= 1 ? "just now" : min + " min ago";
    const hours = Math.round(min / 60);
    if (hours < 24) return hours + " h ago";
    const days = Math.round(hours / 24);
    return days === 1 ? "yesterday" : days + " days ago";
  };
  const length = (seconds) => !Number.isFinite(seconds) ? null :
    seconds < 60 ? seconds + " s" : Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0") + " min";
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  // Review panel: uploads waiting for a decision, and everything already published
  // (where an upload can be hidden from players, or shown again). Each upload is a
  // card with its map picture, the facts that tell drills apart, and whether it has
  // been played here; the list can be narrowed to one map or one author and sorted.
  function showQueue() {
    if (document.querySelector(".es-workshop-scrim")) return;
    const scrim = el("div", "es-workshop-scrim");
    const panel = el("section", "es-workshop-panel");
    const head = el("header", "es-review-head");
    const title = el("h2", null, "COMMUNITY UPLOADS");
    const close = el("button", "es-review-close", "CLOSE");
    close.type = "button";
    const shut = () => { scrim.remove(); document.removeEventListener("keydown", onKey, true); };
    const onKey = (event) => { if (event.key === "Escape" && scrim.isConnected) { event.stopPropagation(); shut(); } };
    document.addEventListener("keydown", onKey, true);
    close.onclick = shut;
    // auto-approve-v1: switch kept by the workshop service. On: new uploads are public at once (hide, delete
    // and ban still work). Turning it on can also publish what is waiting now. Hidden on an older service.
    const autoBox = el("div", "es-review-auto");
    const autoNote = el("span", "es-review-auto-note", "");
    const auto = el("button", null, "AUTO-APPROVE");
    auto.type = "button"; auto.disabled = true;
    autoBox.append(autoNote, auto);
    autoBox.style.cssText = "display:flex;align-items:center;gap:10px;margin-left:auto;font-size:13px;opacity:.95";
    let autoOn = false, waitingNow = 0;
    const paintAuto = () => {
      auto.textContent = "AUTO-APPROVE: " + (autoOn ? "ON" : "OFF");
      auto.className = autoOn ? "is-primary" : "";
      autoNote.replaceChildren(autoOn ? "New uploads go public about a minute after they are sent. You can still hide, delete or ban." : "New uploads wait here for you.");
    };
    const setAuto = async (on, approveWaiting) => {
      auto.disabled = true;
      try {
        const result = await api.setSettings({ autoApprove: on, approveWaiting });
        autoOn = result.autoApprove === true; paintAuto();
        if (result.approved) message(panel, `Auto-approve is on. Published ${result.approved} waiting upload${result.approved === 1 ? "" : "s"}.`);
        if (approveWaiting && current) open(current);
      } catch (error) { message(panel, reason(error, "Could not change auto-approve.")); }
      auto.disabled = false;
    };
    auto.onclick = () => {
      if (autoOn) return setAuto(false, false);
      if (!waitingNow) return setAuto(true, false);
      // Something is waiting: ask whether to publish it too.
      const yes = el("button", "is-primary", `YES, PUBLISH THE ${waitingNow} WAITING`), no = el("button", null, "ONLY NEW UPLOADS");
      yes.type = no.type = "button";
      yes.onclick = () => { waitingNow = 0; setAuto(true, true); };
      no.onclick = () => setAuto(true, false);
      autoNote.replaceChildren(`Turn on. Publish the ${waitingNow} upload${waitingNow === 1 ? "" : "s"} waiting now too?`, " ", yes, " ", no);
    };
    if (api.settings) api.settings().then((s) => { autoOn = s.autoApprove === true; waitingNow = s.waiting || 0; paintAuto(); auto.disabled = false; }, () => autoBox.remove());
    else autoBox.remove();
    head.append(title, autoBox, close);
    const tabs = el("div", "es-workshop-tabs");
    const status = el("p", "es-workshop-message");
    const tools = el("div", "es-review-tools");
    const list = el("div", "es-review-list");
    panel.append(head, tabs, status, tools, list);
    scrim.append(panel);
    scrim.onclick = (event) => { if (event.target === scrim) shut(); };
    document.body.append(scrim);

    let current = "", entries = [], intro = "";
    const filter = { map: "all", author: "all", sort: "oldest" };
    const SORTS = {
      pending: [["oldest", "Waiting longest"], ["newest", "Newest first"], ["unplayed", "Not played first"],
        ["map", "By map"], ["bots", "Most bots"], ["name", "Name A–Z"]],
      published: [["pinned", "Pinned first"], ["newest", "Newest first"], ["oldest", "Oldest first"], ["map", "By map"],
        ["bots", "Most bots"], ["name", "Name A–Z"]],
      // unban-v1: the Banned tab sorts by when the ban happened (createdAt holds the ban time there)
      banned: [["newest", "Banned most recently"], ["oldest", "Banned longest ago"], ["name", "Drill name A–Z"]],
    };
    // Same name, map, bot count and size as another upload: probably sent twice.
    const twinKey = (entry) => {
      const item = entry.item || {};
      return [String(item.name || "").trim().toLowerCase(), item.mapId || "", item.facts?.bots, item.docBytes].join("|");
    };

    const card = (entry, played, twins) => {
      const item = entry.item || {}, facts = item.facts || {};
      const row = el("article", "es-review-card");
      row.dataset.code = entry.shareCode;
      const thumb = el("div", "es-review-thumb" + (item.mapId ? "" : " is-range") + (item.coverVersion ? " has-cover" : ""));
      if (item.coverVersion) {
        const img = el("img");
        img.alt = "";
        img.src = "/prod-api/api/v1/public/val/aimlab/pw/covers/" + entry.shareCode + "-" + item.coverVersion + "-s.jpg";
        thumb.append(img);
      } else if (item.mapId) {
        const img = el("img");
        img.alt = "";
        img.loading = "lazy";
        img.src = "/aim-maps/" + encodeURIComponent(item.mapId) + ".cover.webp";
        img.onerror = () => img.remove();
        thumb.append(img);
      }
      thumb.append(el("span", null, mapName(item.mapId)));
      // unban-v1: the Banned tab is about the account, so no picture buttons there
      const change = el("button", "es-cover-change", item.coverVersion ? "CHANGE PICTURE" : "SET PICTURE");
      change.type = "button";
      change.title = "Choose the picture players see on this drill's card (JPEG, PNG or WebP)";
      change.onclick = () => pickCover(entry);
      if (current !== "banned") thumb.append(change);
      if (item.coverVersion && current !== "banned") {
        const reset = el("button", "es-cover-reset", "×");
        reset.type = "button";
        reset.title = "Back to the map picture";
        reset.onclick = () => saveCover(entry, null, null);
        thumb.append(reset);
      }
      const info = el("div", "es-review-info");
      const top = el("div", "es-review-title");
      const name = el("strong", null, item.name || "Untitled drill");
      top.append(name);
      const pinBadge = el("em", "es-review-badge is-pinned", "PINNED");
      pinBadge.hidden = !item.featured;
      top.append(pinBadge);
      // unban-v1: banned authors are marked; the Banned tab has no played / not played badges
      if (entry.banned) top.append(el("em", "es-review-badge is-banned", "AUTHOR BANNED"));
      if (current === "banned") {}
      else if (played) top.append(el("em", "es-review-badge is-played", "PLAYED"));
      else if (current === "pending") top.append(el("em", "es-review-badge", "NOT PLAYED YET"));
      if (twins > 1) {
        const twin = el("em", "es-review-badge is-twin", "SAME AS " + (twins - 1) + " OTHER");
        twin.title = "Another upload has the same name, map, bot count and size. It may have been sent twice.";
        top.append(twin);
      }
      const description = el("p", "es-review-desc" + (item.description ? "" : " is-empty"),
        item.description || "No description");
      const stats = el("div", "es-review-stats");
      for (const [label, value] of [
        ["Map", mapName(item.mapId)],
        ["Bots", Number.isFinite(facts.bots) ? String(facts.bots) : null],
        ["Length", length(facts.duration)],
        ["Weapon", facts.weapon ? facts.weapon[0].toUpperCase() + facts.weapon.slice(1) : null],
      ]) {
        if (!value) continue;
        const stat = el("span");
        stat.append(el("small", null, label), el("b", null, value));
        stats.append(stat);
      }
      const by = el("p", "es-review-by");
      by.append("By ", el("b", null, item.authorNickname || "Creator"));
      const when = ago(entry.createdAt);
      if (when) by.append("  ·  " + (current === "pending" ? "sent " : current === "banned" ? "banned " : "published ") + when);
      if (current === "banned") by.append("  ·  " + entry.drills + (entry.drills === 1 ? " drill" : " drills"));
      if (Number.isFinite(item.docBytes)) by.append("  ·  " + Math.ceil(item.docBytes / 1024) + " KB");
      const id = el("span", "es-review-id", "Discord ID " + entry.authorId);
      by.append(id);
      info.append(top, description, stats, by);
      const actions = el("div", "es-review-actions");
      const confirm = el("div", "es-review-confirm");
      confirm.hidden = true;
      row.append(thumb, info, actions, confirm);
      return { row, name, actions, confirm, pinBadge };
    };
    const button = (label, run, actions, className) => {
      const node = el("button", className || null, label);
      node.type = "button";
      node.onclick = async () => {
        // One action per upload at a time: every button in the row waits for the answer.
        const all = [...actions.closest(".es-review-card").querySelectorAll("button")];
        for (const other of all) other.disabled = true;
        try { await run(); }
        catch (error) { message(panel, reason(error, "That did not work. Try again.")); }
        for (const other of all) other.disabled = false;
      };
      actions.append(node);
      return node;
    };
    // A question under the card with Yes / Cancel; Yes runs the action.
    const ask = (parts, text, yesLabel, run) => {
      parts.confirm.replaceChildren(el("span", null, text));
      const yes = button(yesLabel, run, parts.confirm, "is-danger");
      const no = button("CANCEL", async () => { parts.confirm.hidden = true; parts.actions.hidden = false; }, parts.confirm);
      parts.actions.hidden = true;
      parts.confirm.hidden = false;
      no.focus();
      return yes;
    };
    const gone = (row, text) => {
      entries = entries.filter((entry) => entry.shareCode !== row.dataset.code);
      row.remove();
      message(panel, text);
      paintTools();
      if (!list.querySelector(".es-review-card")) render();
    };

    const play = (entry, parts, primary) => button("PLAY", async () => {
      const preview = await api.preview(entry.shareCode);
      markPlayed(entry.shareCode);
      // studio-launch.js starts this drill once the lobby has reloaded with it listed.
      sessionStorage.setItem("review-play", preview.code);
      location.reload();
    }, parts.actions, primary ? "is-primary" : null);
    // Delete works in both lists and cannot be undone: entry, scenario and likes are erased.
    const remove = (entry, parts) => button("DELETE", async () => {
      ask(parts, `Delete "${entry.item.name}" for good? Players lose it and it cannot be brought back.`, "YES, DELETE", async () => {
        await api.moderate(entry.shareCode, "delete");
        gone(parts.row, `Deleted "${entry.item.name}".`);
      });
    }, parts.actions, "is-quiet");
    // ban-list-v1: ban this drill's creator. Their published drills are hidden, waiting ones rejected,
    // their likes and leaderboard scores removed, and the account can no longer upload, like or post scores.
    const banAuthor = (entry, parts) => button("BAN AUTHOR", async () => {
      const who = entry.item.authorNickname ? `"${entry.item.authorNickname}"` : "this creator";
      ask(parts, `Ban ${who}? All their drills are taken down, their likes and scores are removed, and they can no longer upload, like or post scores.`, "YES, BAN", async () => {
        const result = await api.moderate(entry.shareCode, "ban");
        await open(current);
        message(panel, `Banned ${who}: ${result?.hidden || 0} published drill(s) hidden, ${result?.rejected || 0} waiting drill(s) rejected.`);
      });
    }, parts.actions, "is-quiet");
    // unban-v1: lift the ban (by Discord account). Their drills stay hidden / rejected; Show again puts a
    // published one back.
    const unbanAuthor = (entry, parts, label = "UNBAN AUTHOR") => button(label, async () => {
      const who = entry.item.authorNickname ? `"${entry.item.authorNickname}"` : "this creator";
      ask(parts, `Unban ${who}? They can upload, like and post scores again. Their drills stay hidden until you show them again.`, "YES, UNBAN", async () => {
        await api.unban(entry.authorId);
        if (current === "banned") { gone(parts.row, `Unbanned ${who}.`); return; }
        for (const other of entries) if (other.authorId === entry.authorId) other.banned = false;
        render();
        message(panel, `Unbanned ${who}. Their drills stay hidden until you show them again.`);
      });
    }, parts.actions, "is-primary");
    const banOrUnban = (entry, parts) => (entry.banned ? unbanAuthor : banAuthor)(entry, parts);

    const actionsFor = {
      banned: (entry, parts) => { unbanAuthor(entry, parts, "UNBAN"); },
      pending: (entry, parts, played) => {
        const approve = async () => {
          await api.moderate(entry.shareCode, "approve");
          gone(parts.row, `Approved "${entry.item.name}". It is in Published now (Hide there takes it back down).`);
        };
        play(entry, parts, !played);
        button("APPROVE", async () => {
          if (played) return approve();
          ask(parts, "Not played yet. Approve anyway?", "APPROVE ANYWAY", approve);
        }, parts.actions, played ? "is-primary" : null);
        button("REJECT", async () => {
          ask(parts, "Reject for good? It cannot be brought back.", "YES, REJECT", async () => {
            await api.moderate(entry.shareCode, "reject");
            gone(parts.row, `Rejected "${entry.item.name}".`);
          });
        }, parts.actions);
        remove(entry, parts);
        banOrUnban(entry, parts);
      },
      published: (entry, parts) => {
        let hidden = !!entry.hidden;
        const paint = () => {
          parts.row.classList.toggle("is-hidden", hidden);
          parts.row.classList.toggle("is-pinned", !!entry.item.featured);
          parts.name.textContent = (hidden ? "[HIDDEN] " : "") + entry.item.name;
          parts.pinBadge.hidden = !entry.item.featured;
          pin.textContent = entry.item.featured ? "UNPIN" : "PIN TO TOP";
          pin.className = entry.item.featured ? "" : "is-primary";
          toggle.textContent = hidden ? "SHOW AGAIN" : "HIDE";
        };
        const pin = button("", async () => {
          const on = !entry.item.featured;
          await api.moderate(entry.shareCode, on ? "pin" : "unpin");
          entry.item.featured = on;
          message(panel, on ? `Pinned "${entry.item.name}". It shows first in Community Workshop.` : `Unpinned "${entry.item.name}".`);
          paintTools();
          render();
        }, parts.actions);
        const toggle = button("", async () => {
          await api.moderate(entry.shareCode, hidden ? "unhide" : "hide");
          hidden = entry.hidden = !hidden;
          paint();
          message(panel, hidden ? "Hidden. Players no longer see it." : "Visible to players again.");
        }, parts.actions);
        play(entry, parts, false);
        remove(entry, parts);
        banOrUnban(entry, parts);
        paint();
      },
    };

    const pickCover = (entry) => chooseCover((data) => saveCover(entry, data, "image/jpeg"),
      (error) => message(panel, reason(error, "That file could not be read as a picture.")));
    const saveCover = async (entry, data, type) => {
      message(panel, data ? "Saving the picture…" : "Resetting the picture…");
      try {
        const result = await api.setCover(entry.shareCode, data, type);
        if (result?.coverVersion) entry.item.coverVersion = result.coverVersion; else delete entry.item.coverVersion;
        render();
        message(panel, data ? `New picture saved for "${entry.item.name}". Players see it once their list refreshes.` : `"${entry.item.name}" uses its map picture again.`);
      } catch (error) { message(panel, reason(error, "The picture could not be saved.")); }
    };

    const order = (shown, played) => {
      const time = (entry) => Date.parse(entry.createdAt || "") || 0;
      const by = {
        oldest: (a, b) => time(a) - time(b),
        newest: (a, b) => time(b) - time(a),
        pinned: (a, b) => (!!b.item.featured - !!a.item.featured) || time(b) - time(a),
        unplayed: (a, b) => (!!played[a.shareCode] - !!played[b.shareCode]) || time(a) - time(b),
        map: (a, b) => mapName(a.item.mapId).localeCompare(mapName(b.item.mapId)) || time(a) - time(b),
        bots: (a, b) => (b.item.facts?.bots || 0) - (a.item.facts?.bots || 0),
        name: (a, b) => String(a.item.name).localeCompare(String(b.item.name)),
      }[filter.sort] || (() => 0);
      return shown.slice().sort(by);
    };
    const render = () => {
      const played = playedList();
      const twins = {};
      for (const entry of entries) twins[twinKey(entry)] = (twins[twinKey(entry)] || 0) + 1;
      const shown = order(entries.filter((entry) =>
        (filter.map === "all" || (entry.item.mapId || "") === filter.map) &&
        (filter.author === "all" || entry.authorId === filter.author)), played);
      list.replaceChildren();
      if (!entries.length) {
        status.textContent = current === "pending" ? "No uploads waiting for review." :
          current === "banned" ? "Nobody is banned." : "Nothing has been published yet.";
        return;
      }
      const waiting = entries.filter((entry) => !played[entry.shareCode]).length;
      status.textContent = intro + (current === "pending" && entries.length
        ? `  ${waiting ? waiting + " not played yet." : "All played."}` : "");
      if (!shown.length) list.append(el("p", "es-review-empty", "Nothing matches these filters."));
      for (const entry of shown) {
        const isPlayed = !!played[entry.shareCode];
        const parts = card(entry, isPlayed, twins[twinKey(entry)]);
        actionsFor[current](entry, parts, isPlayed);
        list.append(parts.row);
      }
    };
    // Filter chips (one per map, one per author) and the sort menu, with counts.
    const paintTools = () => {
      tools.replaceChildren();
      if (entries.length < 2) return;
      const chips = (label, key, options) => {
        if (options.length < 2) { filter[key] = "all"; return; }
        if (filter[key] !== "all" && !options.some(([value]) => value === filter[key])) filter[key] = "all";
        const group = el("div", "es-review-chips");
        group.append(el("small", null, label));
        for (const [value, text, count] of [["all", "All", entries.length], ...options]) {
          const chip = el("button", null, text + " ");
          chip.type = "button";
          chip.append(el("i", null, String(count)));
          chip.setAttribute("aria-pressed", String(filter[key] === value));
          chip.onclick = () => { filter[key] = value; paintTools(); render(); };
          group.append(chip);
        }
        tools.append(group);
      };
      const count = (keyOf, labelOf) => {
        const seen = new Map();
        for (const entry of entries) {
          const key = keyOf(entry);
          const row = seen.get(key) || [key, labelOf(entry), 0];
          row[2]++;
          seen.set(key, row);
        }
        return [...seen.values()].sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1]));
      };
      chips("MAP", "map", count((entry) => entry.item.mapId || "", (entry) => mapName(entry.item.mapId)));
      chips("AUTHOR", "author", count((entry) => entry.authorId, (entry) => entry.item.authorNickname || "Creator"));
      const sort = el("label", "es-review-sort");
      sort.append(el("small", null, "SORT"));
      const select = el("select");
      for (const [value, text] of SORTS[current]) {
        const option = el("option", null, text);
        option.value = value;
        select.append(option);
      }
      select.value = filter.sort;
      select.onchange = () => { filter.sort = select.value; render(); };
      sort.append(select);
      tools.append(sort);
    };

    const sources = {
      pending: async () => {
        const result = await api.pending();
        const total = Math.max(Number(result.total) || 0, result.data.length);
        intro = total > result.data.length ? `${total} awaiting review, showing the oldest ${result.data.length}.` :
          `${result.data.length} awaiting review. Play an upload before you approve it.`;
        return result.data;
      },
      published: async () => {
        const result = await api.published();
        intro = `${result.data.length} published. Hide removes an upload from every player's catalog; Show puts it back.`;
        return result.data;
      },
      // unban-v1: one card per banned account, shown with their newest drill (if any is left).
      banned: async () => {
        const result = await api.banned();
        intro = `${result.data.length} banned. Unban lets them upload, like and post scores again; their drills stay hidden until you show them again.`;
        return result.data.map((row) => ({
          ...row, banned: true, createdAt: row.bannedAt,
          shareCode: row.shareCode || "account-" + row.authorId, // unique per card; drills may all be deleted
          item: row.item || { name: "No drills left", authorNickname: null },
        }));
      },
    };
    const open = async (view) => {
      current = view;
      filter.map = filter.author = "all";
      filter.sort = view === "pending" ? "oldest" : view === "banned" ? "newest" : "pinned";
      for (const tab of tabs.children) tab.setAttribute("aria-pressed", String(tab.dataset.view === view));
      entries = [];
      list.replaceChildren();
      tools.replaceChildren();
      status.textContent = "Loading…";
      try {
        const data = await sources[view]();
        if (!scrim.isConnected || current !== view) return;
        entries = data.filter((entry) => entry && entry.item);
        paintTools();
        render();
      } catch (error) {
        if (scrim.isConnected && current === view) message(panel, reason(error, "Could not load the uploads."));
      }
    };
    for (const [view, label] of [["pending", "WAITING FOR REVIEW"], ["published", "PUBLISHED"], ["banned", "BANNED"]]) {
      const tab = el("button", null, label);
      tab.type = "button";
      tab.dataset.view = view;
      tab.onclick = () => open(view);
      tabs.append(tab);
    }
    open("pending");
  }

  // Drill panel (the drawer that opens on a community drill): a Like button next to
  // Favorite (favorites stay on this computer; likes are counted by the workshop for
  // everyone), the like count in the stats, and the creator's Discord picture.
  const LIKE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11v9H4v-9z"/><path d="M7 11l4-7c1.7 0 2.6 1.2 2.2 2.8L12.5 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/></svg>';
  let cardLikes = { at: 0, promise: null, byPrefix: null };
  function loadCardLikes(force) {
    if (!force && cardLikes.promise && Date.now() - cardLikes.at < 20000) return cardLikes.promise;
    const promise = fetch("/prod-api/api/v1/public/val/aimlab/pw/items?pageNum=1&pageSize=100&sort=LATEST")
      .then((response) => response.json())
      .then((value) => {
        const byPrefix = {};
        for (const item of value?.data?.list || []) {
          const prefix = String(item.code || "").slice(0, 6).toUpperCase();
          byPrefix[prefix] = prefix in byPrefix ? null : { code: item.code, likes: Number(item.favorites) || 0 };
        }
        cardLikes.byPrefix = byPrefix;
        syncCardLikes();
        return byPrefix;
      })
      .catch(() => null);
    cardLikes = { at: Date.now(), promise, byPrefix: cardLikes.byPrefix };
    return promise;
  }
  function setCardLikes(code, likes) {
    const prefix = String(code).slice(0, 6).toUpperCase();
    if (cardLikes.byPrefix) cardLikes.byPrefix[prefix] = { code, likes };
    syncCardLikes();
  }
  function syncCardLikes() {
    const cards = document.querySelectorAll(".pw-card");
    if (!cards.length) return;
    if (!cardLikes.byPrefix || Date.now() - cardLikes.at > 20000) loadCardLikes(false);
    if (!cardLikes.byPrefix) return;
    for (const card of cards) {
      const printed = /NO\.([0-9A-F]{6})/.exec(card.querySelector(".pw-card-no")?.textContent || "");
      const found = printed && cardLikes.byPrefix[printed[1]];
      const line = card.querySelector(".pw-card-ln");
      let badge = card.querySelector(".es-card-likes");
      if (!found || !line) { badge?.remove(); continue; }
      const text = String(found.likes);
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "es-card-likes";
        badge.setAttribute("role", "button");
        badge.tabIndex = 0;
        badge.innerHTML = LIKE_ICON.replace('width="20" height="20"', 'width="14" height="14"') + "<b></b>";
        // Clicking the thumb likes the drill right on the card (does not open the panel).
        const stop = (event) => { event.stopPropagation(); };
        badge.addEventListener("pointerdown", stop);
        badge.addEventListener("mousedown", stop);
        badge.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); cardLikeClick(badge); });
        badge.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); cardLikeClick(badge); } });
        line.append(badge);
      }
      badge.dataset.code = found.code;
      const liked = likedByCode[found.code];
      if (liked === undefined && identity) loadLiked(found.code);
      badge.classList.toggle("is-on", liked === true);
      badge.title = (found.likes === 1 ? "1 like" : found.likes + " likes") + " · " +
        (!identity ? "sign in with Discord to like" : liked ? "click to remove your like" : "click to like");
      if (badge.lastElementChild.textContent !== text) badge.lastElementChild.textContent = text;
    }
  }
  // Whether you liked each drill (asked once per drill, shared by the cards and the panel).
  const likedByCode = {};
  const likedLoading = {};
  function loadLiked(code) {
    if (!likedLoading[code]) likedLoading[code] = api.likeState(code).then((result) => {
      likedByCode[code] = !!result?.liked;
      if (cardLikes.byPrefix && result?.likes != null) setCardLikes(code, Number(result.likes) || 0); else syncCardLikes();
      return likedByCode[code];
    }).catch(() => { delete likedLoading[code]; return false; });
    return likedLoading[code];
  }
  async function cardLikeClick(badge) {
    const code = badge.dataset.code;
    if (!code || badge.dataset.busy) return;
    if (!identity) { api.login().catch(() => {}); return; }
    badge.dataset.busy = "1";
    const was = likedByCode[code] ?? await loadLiked(code);
    const on = !was;
    const prefix = code.slice(0, 6).toUpperCase();
    const before = cardLikes.byPrefix?.[prefix]?.likes ?? 0;
    likedByCode[code] = on;
    setCardLikes(code, Math.max(0, before + (on ? 1 : -1)));
    // Pop every card of this drill (it can be on several shelves).
    if (on) document.querySelectorAll(".es-card-likes").forEach((node) => {
      if (node.dataset.code !== code) return;
      node.classList.remove("es-pop"); void node.offsetWidth; node.classList.add("es-pop");
    });
    try {
      const result = await api.like(code, on);
      setCardLikes(code, Number(result?.likes) || 0);
    } catch (error) {
      likedByCode[code] = was;
      setCardLikes(code, before);
    }
    delete badge.dataset.busy;
  }
  function drawerCode(drawer) {
    return (/Share code ([0-9a-f]{16})/i.exec(drawer.textContent || "") || [])[1]?.toLowerCase() || null;
  }
  function likeCountNode(drawer) {
    return [...drawer.querySelectorAll("span")].find((node) => node.children.length === 1 &&
      node.firstElementChild.tagName === "B" && /^\s*\S+\s+likes\s*$/.test(node.textContent) && !/Last 7 days/.test(node.textContent));
  }
  const el2 = (tag, text) => { const node = document.createElement(tag); node.textContent = text; return node; };
  function syncShare(drawer, code) {
    const flash = (button, label, text) => {
      button.querySelector(".es-share-word").textContent = text;
      button.classList.add("is-flash"); // the corner button shows its word only while it says Copied!
      clearTimeout(button._esTimer);
      button._esTimer = setTimeout(() => { button.querySelector(".es-share-word").textContent = label; button.classList.remove("is-flash"); }, 1800);
    };
    // Header line "NO.5BDF31 · Share code 5bdf…" stays hidden (the Share button copies the code).
    const line = [...drawer.querySelectorAll("*")].find((node) => node.children.length === 0 && /Share code/i.test(node.textContent));
    if (line) line.classList.add("es-code-line");
    // Bottom row: "Copy link" (an address that only works on this computer) becomes Share (copies the code).
    const copy = [...drawer.querySelectorAll(".pw-gbtn")].find((node) => !node.hasAttribute("aria-pressed") && !node.classList.contains("es-like"));
    if (!copy) return;
    copy.classList.add("es-copy-link");
    const wrap = document.createElement("span");
    wrap.className = "es-share";
    const main = document.createElement("button");
    main.type = "button";
    main.className = "pw-gbtn es-share-main";
    main.title = "Copy the code " + shortCode(code) + " (others type it in Enter code)";
    main.innerHTML = SHARE_ICON + '<span class="es-share-word">Share</span>';
    main.onclick = async () => flash(main, "Share", (await copyText(shortCode(code))) ? "Copied!" : "Could not copy");
    wrap.append(main);
    copy.after(wrap);
  }
  // Drill panel layout "D" (2026-11-19): Like / Save / Share as small buttons next to the close X, the
  // creator as a byline under the title, the facts as one segmented bar, then your standing and the
  // leaderboard, then a Rules card next to plays / likes / 7 days. Vue's own nodes stay where they are
  // (hidden or reordered in CSS); everything added here is our own. Styles: theme-esports.css "es-d-on".
  function prettySpot(raw) {
    if (/attacker/i.test(raw)) return "Attacker spawn";
    if (/defender/i.test(raw)) return "Defender spawn";
    return raw.replace(/^ShooterTeamStart_?/i, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  }
  const statNumber = (drawer, pattern) => {
    const node = [...drawer.querySelectorAll(".pw-meta .pw-stat")].find((span) => pattern.test(span.textContent));
    return node?.querySelector("b")?.textContent.trim() || "0";
  };
  function syncLayout(drawer, code, like) {
    drawer.classList.remove("es-rail-on");
    drawer.classList.add("es-d-on");
    // Top corner actions.
    const acts = document.createElement("div");
    acts.className = "es-acts";
    const favorite = () => drawer.querySelector(".pw-dr-foot .pw-gbtn[aria-pressed]:not(.es-like)");
    const save = document.createElement("button");
    save.type = "button";
    save.className = "pw-gbtn es-act-save";
    save.innerHTML = (favorite()?.querySelector("svg")?.outerHTML || "") + "<span>Save</span>";
    const paintSave = () => {
      const on = favorite()?.getAttribute("aria-pressed") === "true";
      save.classList.toggle("is-on", on);
      save.setAttribute("aria-pressed", String(on));
      save.lastElementChild.textContent = on ? "Saved" : "Save";
      save.title = on ? "Saved. Click to remove from Favorites" : "Save to Favorites (on this computer)";
    };
    save.onclick = () => { favorite()?.click(); requestAnimationFrame(() => requestAnimationFrame(paintSave)); setTimeout(paintSave, 300); };
    paintSave();
    const share = drawer.querySelector(".es-share-main");
    acts.append(like, save);
    if (share) { acts.append(share); drawer.querySelector(".es-share")?.remove(); }
    drawer.append(acts);
    // Readable spawn name in the red line above the title.
    const spot = drawer.querySelector(".pw-spot");
    if (spot && spot.textContent.trim()) {
      const pretty = document.createElement("span");
      pretty.className = "es-spot";
      pretty.textContent = prettySpot(spot.textContent.trim());
      spot.after(pretty);
    }
    // Byline: "by <name> · N creations", with the creator's Discord picture (no picture: just the text).
    const maker = drawer.querySelector(".pw-maker");
    const title = drawer.querySelector(".pw-dr-title");
    if (maker && title) {
      const name = maker.querySelector(":scope > b")?.textContent.trim() || "";
      const works = Number((/(\d+)\s+creations?/i.exec(maker.querySelector(":scope > small")?.textContent || "") || [])[1]) || 0;
      const byline = document.createElement("div");
      byline.className = "es-byline";
      const pic = document.createElement("img");
      pic.className = "es-byline-pic";
      pic.alt = "";
      pic.onerror = () => pic.remove();
      pic.src = "/api/local/workshop/avatar/" + code;
      byline.append(pic, el2("span", "by"), el2("b", name || "Unknown"));
      if (works) byline.append(el2("span", "· " + works + (works === 1 ? " creation" : " creations")));
      title.after(byline);
    }
    // Rules card + plays / likes / 7 days, and the dates on one quiet line (under the leaderboard).
    const grid = drawer.querySelector(".pw-dr-grid");
    const facts = grid?.querySelector(".pw-facts");
    if (grid && facts) {
      const value = (label) => {
        const dt = [...facts.querySelectorAll("dt")].find((node) => node.textContent.trim().toLowerCase() === label);
        return dt?.nextElementSibling?.textContent.trim() || "";
      };
      const split = document.createElement("div");
      split.className = "es-split";
      const rules = document.createElement("div");
      rules.className = "es-card es-rules";
      const list = document.createElement("dl");
      for (const [label, key] of [["Scoring", "scoring"], ["Movement", "movement"]]) {
        const text = value(key);
        if (text) list.append(el2("dt", label), el2("dd", text));
      }
      rules.append(el2("h3", "Rules"), list);
      const stats = document.createElement("div");
      stats.className = "es-card es-stats";
      const stat = (number, label, cls) => {
        const box = document.createElement("div");
        const b = el2("b", number);
        if (cls) b.className = cls;
        box.append(b, el2("small", label));
        return box;
      };
      stats.append(stat(statNumber(drawer, /plays/i), "Plays"),
        stat(statNumber(drawer, /^\s*\S+\s+likes\s*$/i), "Likes", "es-stat-likes"),
        stat(statNumber(drawer, /Last 7 days/i), "7 days"));
      split.append(rules, stats);
      const published = value("first published"), updated = value("last updated");
      const dates = el2("p", [published && published !== "—" ? "Published " + published : "",
        !updated || /never/i.test(updated) ? "never updated" : "updated " + updated.replace(/,\s*version.*$/i, "")].filter(Boolean).join(" · "));
      dates.className = "es-dates";
      grid.prepend(split, dates);
    }
  }
  function syncDrawer() {
    const drawer = document.querySelector(".pw-dr-x")?.parentElement;
    if (!drawer) return;
    const code = drawerCode(drawer);
    if (!code) return;
    if (drawer.dataset.esCode === code && drawer.querySelector(".es-like")) return;
    drawer.dataset.esCode = code;
    drawer.querySelectorAll(".es-like, .es-maker-pic, .es-mod-cover, .es-code-chip, .es-share, .es-rail, .es-cv-ghost, .es-spot, .es-board, .es-own-tools, .es-acts, .es-byline, .es-split, .es-dates, .es-go-goal, .es-title-edit, .es-edit-menu").forEach((node) => node.remove());
    syncShare(drawer, code);
    const favorite = drawer.querySelector(".pw-gbtn[aria-pressed]");
    if (!favorite) return;
    const like = document.createElement("button");
    like.type = "button";
    like.className = "pw-gbtn es-like";
    like.setAttribute("aria-pressed", "false");
    like.innerHTML = LIKE_ICON + '<span class="es-like-word">Like</span><b class="es-like-n"></b>';
    let state = { likes: null, liked: false };
    const paint = () => {
      like.classList.toggle("is-on", state.liked);
      like.setAttribute("aria-pressed", String(state.liked));
      like.querySelector(".es-like-word").textContent = state.liked ? "Liked" : "Like";
      like.querySelector(".es-like-n").textContent = state.likes == null ? "" : String(state.likes);
      like.title = identity ? (state.liked ? "Remove your like" : "Like this drill (everyone sees the count)") : "Sign in with Discord to like drills";
      const count = likeCountNode(drawer);
      if (count && state.likes != null) count.firstElementChild.textContent = String(state.likes);
      const stat = drawer.querySelector(".es-stat-likes");
      if (stat && state.likes != null) stat.textContent = String(state.likes);
    };
    like.onclick = async () => {
      if (!identity) { api.login().catch(() => {}); return; }
      like.disabled = true;
      const on = !state.liked;
      const before = state;
      // Show it at once (red fill + pop), then settle on the server's count.
      state = { likes: state.likes == null ? null : Math.max(0, state.likes + (on ? 1 : -1)), liked: on };
      paint();
      like.classList.remove("es-pop");
      if (on) { void like.offsetWidth; like.classList.add("es-pop"); }
      try {
        const result = await api.like(code, on);
        state = { likes: Number(result?.likes) || 0, liked: on }; likedByCode[code] = on;
        setCardLikes(code, state.likes);
      } catch (error) {
        state = before;
        like.classList.remove("es-pop");
        like.title = reason(error, "Could not save your like.");
      }
      like.disabled = false;
      paint();
    };
    syncLayout(drawer, code, like);
    paint();
    if (identity?.moderator) editMenu(drawer, code, true);
    api.likeState(code).then((result) => {
      if (drawer.dataset.esCode !== code) return;
      state = { likes: Number(result?.likes) || 0, liked: !!result?.liked }; likedByCode[code] = state.liked;
      paint();
      setCardLikes(code, state.likes);
      if (result?.own && !identity?.moderator) editMenu(drawer, code, false);
    }).catch(() => {});
    syncBoard(drawer, code);
  }

  // creator-tools-v2 (2026-11-19): an Edit button (pencil) next to Like / Save / Share, for the drill's
  // creator and the moderator. Its menu: Rename (the title becomes a name box), Change picture, Map
  // picture, and for the moderator Hide; Delete asks again inside the menu. Results show as a toast, and
  // the shelves reload so the cards show the change.
  const EDIT_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
  // Keys typed in our boxes belong to the box, not to the game's shortcuts.
  const keepKeys = (node) => { for (const type of ["keydown", "keyup", "keypress"]) node.addEventListener(type, (event) => event.stopPropagation()); };
  function reloadShelves() {
    Promise.resolve(api.refresh?.()).catch(() => {}).then(() => {
      cardLikes = { at: 0, promise: null, byPrefix: null };
      loadCardLikes(true);
      if (typeof window.__aimPwReload === "function") window.__aimPwReload();
    });
  }
  function hideCards(code) {
    const prefix = code.slice(0, 6).toUpperCase();
    document.querySelectorAll(".pw-card").forEach((card) => {
      if ((card.querySelector(".pw-card-no")?.textContent || "").toUpperCase().includes("NO." + prefix)) card.classList.add("es-gone");
    });
  }
  // Picture and delete go through the creator routes; the moderator's own routes are the fallback
  // for a game that has not been restarted since the update.
  const editCall = (code, action, value, moderator) => {
    if (api.own) return api.own(code, action, value);
    if (!moderator) throw new Error("Restart the game to change your drill.");
    if (action === "cover") return api.setCover(code, value ? value.image : null, value ? value.type : null);
    if (action === "delete") return api.moderate(code, "delete");
    throw new Error("Restart the game to rename drills.");
  };
  function startRename(drawer, code, moderator) {
    if (drawer.querySelector(".es-title-edit")) { drawer.querySelector(".es-title-edit input")?.focus(); return; }
    const title = drawer.querySelector(".pw-dr-title");
    if (!title) return;
    const box = document.createElement("div");
    box.className = "es-title-edit";
    keepKeys(box);
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 80;
    input.spellcheck = false;
    input.value = title.textContent.trim();
    input.setAttribute("aria-label", "Drill name");
    const save = Object.assign(document.createElement("button"), { type: "button", className: "es-title-save", textContent: "Save" });
    const cancel = Object.assign(document.createElement("button"), { type: "button", className: "es-title-cancel", textContent: "Cancel" });
    const hint = Object.assign(el2("small", "Enter to save · Esc to cancel"), { className: "es-title-hint" });
    const row = document.createElement("div");
    row.append(input, save, cancel);
    box.append(row, hint);
    const close = () => { box.remove(); drawer.classList.remove("es-renaming"); };
    const submit = async () => {
      const name = input.value.trim();
      if (!name) { hint.textContent = "The name can't be empty."; hint.classList.add("is-bad"); input.focus(); return; }
      if (/[<>]/.test(name)) { hint.textContent = "The name can't contain < or >."; hint.classList.add("is-bad"); input.focus(); return; }
      if (name === title.textContent.trim()) { close(); return; }
      save.disabled = cancel.disabled = input.disabled = true;
      hint.classList.remove("is-bad");
      hint.textContent = "Saving…";
      try {
        const result = await editCall(code, "rename", name, moderator);
        title.textContent = result?.name || name;
        close();
        scoreToast("Renamed to “" + (result?.name || name) + "”", true);
        reloadShelves();
      } catch (error) {
        save.disabled = cancel.disabled = input.disabled = false;
        hint.textContent = reason(error, "The name could not be saved.");
        hint.classList.add("is-bad");
        input.focus();
      }
    };
    save.onclick = submit;
    cancel.onclick = close;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); submit(); }
      if (event.key === "Escape") { event.preventDefault(); close(); }
    });
    title.after(box);
    drawer.classList.add("es-renaming");
    input.focus();
    input.select();
  }
  function editMenu(drawer, code, moderator) {
    const acts = drawer.querySelector(".es-acts");
    if (!acts || acts.querySelector(".es-act-edit")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pw-gbtn es-act-edit";
    button.title = moderator ? "Edit this drill (moderator)" : "Edit your drill";
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = EDIT_ICON;
    acts.prepend(button);
    let menu = null;
    const shut = () => {
      menu?.remove(); menu = null;
      button.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", outside, true);
    };
    const outside = (event) => { if (menu && !menu.contains(event.target) && !button.contains(event.target)) shut(); };
    const item = (label, note, run, extra = "") => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "es-edit-item" + extra;
      node.setAttribute("role", "menuitem");
      node.append(el2("b", label));
      if (note) node.append(el2("small", note));
      node.onclick = run;
      return node;
    };
    const savePicture = async (data) => {
      try {
        await editCall(code, "cover", data ? { image: data, type: "image/jpeg" } : null, moderator);
        scoreToast(data ? "Picture saved" : "Back to the map picture", true);
        reloadShelves();
      } catch (error) { scoreToast(reason(error, "The picture could not be saved."), false); }
    };
    const open = () => {
      if (menu) { shut(); return; }
      menu = document.createElement("div");
      menu.className = "es-edit-menu";
      menu.setAttribute("role", "menu");
      keepKeys(menu);
      menu.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); shut(); button.focus(); } });
      menu.append(el2("h4", moderator ? "Moderator" : "Your drill"));
      menu.append(item("Rename", null, () => { shut(); startRename(drawer, code, moderator); }));
      menu.append(item("Change picture", "JPEG, PNG or WebP", () => {
        shut();
        chooseCover(savePicture, (error) => scoreToast(reason(error, "That file could not be read as a picture."), false));
      }));
      menu.append(item("Use the map picture", null, () => { shut(); savePicture(null); }));
      if (moderator) {
        menu.append(item("Hide", "Show it again from Review uploads > Published", async () => {
          shut();
          try { await api.moderate(code, "hide"); hideCards(code); scoreToast("Hidden from the workshop", true); }
          catch (error) { scoreToast(reason(error, "The drill could not be hidden."), false); }
        }));
      }
      menu.append(Object.assign(document.createElement("hr"), { className: "es-edit-sep" }));
      const remove = item("Delete drill", "Erases it, its likes and its leaderboard", null, " is-danger");
      let armed = null;
      remove.onclick = async () => {
        if (!armed) {
          remove.classList.add("is-armed");
          remove.firstElementChild.textContent = "Click again to delete for good";
          remove.lastElementChild.textContent = "This can't be undone";
          armed = setTimeout(() => { armed = null; if (!remove.isConnected) return; remove.classList.remove("is-armed");
            remove.firstElementChild.textContent = "Delete drill"; remove.lastElementChild.textContent = "Erases it, its likes and its leaderboard"; }, 5000);
          return;
        }
        clearTimeout(armed);
        remove.disabled = true;
        remove.firstElementChild.textContent = "Deleting…";
        try {
          await editCall(code, "delete", null, moderator);
          shut();
          hideCards(code);
          scoreToast("Deleted. It's gone from the workshop.", true);
          drawer.querySelector(".pw-dr-x")?.click();
          reloadShelves();
        } catch (error) {
          shut();
          scoreToast(reason(error, "The drill could not be deleted."), false);
        }
      };
      menu.append(remove);
      acts.append(menu);
      button.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", outside, true);
      menu.querySelector(".es-edit-item")?.focus();
    };
    button.onclick = open;
  }

  // Leaderboard in the drill panel: top 5 and your own best (workshop server, best round per
  // Discord account). Rounds count when the game marks them eligible: no pre-aim aids, no pause,
  // no settings changed mid-round (the game's own "aim-local-result" check).
  const boards = {};
  const points = (value) => Math.round(value).toLocaleString("en-US");
  const time = (value) => (value < 60 ? value.toFixed(1) + " s" : Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0"));
  function boardRow(row, topScore) {
    const item = document.createElement("li");
    item.className = "es-board-row" + (row.mine ? " is-me" : "") + (row.rank <= 3 ? " is-top" + row.rank : "");
    // Score bar behind the row: this score against #1's.
    const bar = document.createElement("i");
    bar.className = "es-board-bar";
    bar.style.width = (topScore > 0 ? Math.max(2, Math.min(100, (row.score / topScore) * 100)) : 0).toFixed(1) + "%";
    const name = el2("b", row.name);
    if (row.mine) name.append(Object.assign(el2("span", " (you)"), { className: "es-board-you" }));
    item.append(bar, el2("em", "#" + row.rank), name, el2("strong", points(row.score)));
    const extra = [time(row.seconds)];
    if (row.accuracy != null) extra.push(row.accuracy.toFixed(1) + "%");
    item.append(el2("small", extra.join(" · ")));
    return item;
  }
  // "Your standing": your rank, your best and how much you need for #1 (only once you are on the board).
  function standCard(data) {
    const me = data.me, first = data.top[0];
    const card = document.createElement("div");
    card.className = "es-stand";
    const rank = el2("div", "#" + me.rank);
    rank.className = "es-stand-rank";
    rank.append(el2("small", " / " + data.players));
    const best = document.createElement("div");
    best.className = "es-stand-best";
    const extra = [time(me.seconds)];
    if (me.accuracy != null) extra.push(me.accuracy.toFixed(1) + "%");
    best.append(el2("small", "Your best"), el2("b", points(me.score)), el2("span", extra.join(" · ")));
    const gap = document.createElement("div");
    gap.className = "es-stand-gap";
    if (me.rank === 1) gap.append(el2("small", "You're"), el2("b", "#1"));
    else gap.append(el2("small", "To take #1"), el2("b", "+" + points(Math.max(1, first.score - me.score + 1))));
    card.append(rank, best, gap);
    return card;
  }
  // The line under Start training: the score to beat, or what to do to get on the board.
  function paintGoal(box, data) {
    const play = box.closest(".pw-drawer")?.querySelector(".pw-dr-foot .pw-lock");
    if (!play) return;
    let goal = play.querySelector(".es-go-goal");
    let text = "";
    if (data && identity) {
      const first = data.top[0];
      if (!first) text = "Be the first on the leaderboard";
      else if (!data.me) text = "Finish a round to get on the leaderboard";
      else if (data.me.rank === 1) text = "You're #1 · beat your " + points(data.me.score);
      else text = "Score " + points(first.score + 1) + " to take #1";
    }
    if (!text) { goal?.remove(); play.classList.remove("es-has-goal"); return; }
    if (!goal) { goal = Object.assign(document.createElement("small"), { className: "es-go-goal" }); play.append(goal); }
    goal.textContent = text;
    play.classList.add("es-has-goal");
  }
  function paintBoard(box, data) {
    const list = box.querySelector("ol");
    const note = box.querySelector(".es-board-note");
    list.replaceChildren();
    box.querySelector(".es-stand")?.remove();
    box.querySelector(".es-board-count").textContent = data ? (data.players === 1 ? "1 player" : data.players + " players") : "";
    paintGoal(box, data);
    if (!data) { note.textContent = "The leaderboard could not be loaded."; return; }
    const topScore = data.top[0]?.score || data.me?.score || 0;
    if (data.me && identity) box.prepend(standCard(data));
    for (const row of data.top) list.append(boardRow(row, topScore));
    if (data.me && !data.top.some((row) => row.mine)) {
      list.append(Object.assign(document.createElement("li"), { className: "es-board-gap", textContent: "···" }), boardRow(data.me, topScore));
    } else if (data.top.length && data.top.length < 5) {
      // One empty place under the last score, so a short board shows there's room on it.
      const open = document.createElement("li");
      open.className = "es-board-row is-open";
      open.append(el2("em", "#" + (data.top.length + 1)), el2("b", "Open spot"));
      list.append(open);
    }
    if (!data.top.length) note.textContent = identity ? "No scores yet. Finish a round to be first." : "No scores yet.";
    else if (!identity) note.textContent = "Sign in with Discord to get on the board.";
    else if (!data.me) note.textContent = "Finish a round to get on the board.";
    else note.textContent = "Rounds with pre-aim aids, a pause or changed settings don't count.";
  }
  function syncBoard(drawer, code) {
    const grid = drawer.querySelector(".pw-dr-grid");
    if (!grid || !api.scores) return;
    const box = document.createElement("section");
    box.className = "es-board";
    const head = document.createElement("header");
    head.append(el2("h3", "Leaderboard"), Object.assign(el2("span", ""), { className: "es-board-count" }));
    const list = document.createElement("ol");
    const note = Object.assign(el2("p", ""), { className: "es-board-note" });
    box.append(head, list, note);
    grid.prepend(box); // first in the grid: above the Rules card (layout D)
    if (boards[code]) paintBoard(box, boards[code]); else note.textContent = "Loading…";
    api.scores(code).then((data) => {
      boards[code] = data;
      if (drawer.dataset.esCode === code) paintBoard(box, data);
    }).catch(() => { if (drawer.dataset.esCode === code && !boards[code]) paintBoard(box, null); });
  }
  function scoreToast(text, good) {
    document.querySelector(".es-score-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "es-score-toast" + (good ? " is-good" : "");
    toast.textContent = text;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 4500);
  }
  window.addEventListener("aim-local-result", (event) => {
    const detail = event.detail, record = detail?.record;
    if (detail?.source !== "pw" || !/^[a-f0-9]{16}$/i.test(record?.shareCode || "") || !api.submitScore) return;
    if (!identity || detail.eligible !== true) return;
    const code = record.shareCode.toLowerCase();
    api.submitScore(code, record).then((data) => {
      boards[code] = data;
      if (data?.best && data.me) scoreToast("New best: " + points(data.me.score) + " · #" + data.me.rank + " on the leaderboard", true);
    }).catch((error) => scoreToast(reason(error, "Your score could not be sent to the leaderboard."), false));
  });

  api.onAuth(() => checkIdentity());
  window.__aimWatchPage?.((records) => {
    syncSortMenu();
    syncDrawer();
    syncCardLikes();
    syncHowTo();
    if (records.length && !records.some((record) =>
      record.target?.closest?.(".hall-topnav") ||
      [...record.addedNodes].some((node) => node.nodeType === 1 &&
        (node.matches?.("h1,h2,.hall-tab") || node.querySelector?.("h1,h2,.hall-tab"))))) return;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  checkIdentity();
  sync();
})();
