// Collection: a lobby tab for weapon skins (option B, full-screen picker).
// Pictures are pre-rendered stills in /aim-ui/collection/ (made once from the game's own
// skin models by previews/skin-renders/), so the page draws no 3D and costs no frame time.
// It is only built while open and is removed when closed or when a round starts.
// Equip writes the same keys the old Settings > Visuals rows used (local-customization.js).
// Skins imported from the game files in bulk are not listed here: they come from
// /aim-ui/collection/imported.json (docs/imported-skins.md).
(() => {
  if (window.__aimCollection) return;
  window.__aimCollection = true;

  const IMG = (weapon, id) => `/aim-ui/collection/${weapon}--${id}.webp`;
  // family: skins shown as one tile with a variant picker
  const WEAPONS = [
    { id: "ghost", label: "Ghost", key: "es-ghost-skin", global: "__aimGhostSkin", fallback: "default", skins: [
      { id: "default", name: "Ghost" },
      { id: "smite-ghost", name: "Smite Ghost" },
    ] },
    { id: "sheriff", label: "Sheriff", key: "es-sheriff-skin", global: "__aimSheriffSkin", fallback: "default", skins: [
      { id: "default", name: "Sheriff" },
      { id: "singularity-sheriff", name: "Singularity Sheriff" },
      { id: "arcane-sheriff", name: "Arcane Sheriff" },
    ] },
    { id: "vandal", label: "Vandal", key: "es-vandal-skin", global: "__aimVandalSkin", fallback: "rgx-vandal-yellow", skins: [
      { id: "default-vandal", name: "Vandal" },
      { id: "champions-vandal", name: "Champions 2021 Vandal" },
      { id: "rgx-vandal-yellow", name: "RGX 11z Pro Vandal", family: "rgx", swatch: "#f2c200", variant: "Yellow" },
      { id: "rgx-vandal-blue", name: "RGX 11z Pro Vandal", family: "rgx", swatch: "#2f7bff", variant: "Blue" },
      { id: "gaia-vandal-orange", name: "Gaia's Vengeance Vandal", family: "gaia", swatch: "#e2551d", variant: "Orange" },
      { id: "gaia-vandal-white", name: "Gaia's Vengeance Vandal", family: "gaia", swatch: "#e9ecf2", variant: "White" },
      { id: "gaia-vandal-blue", name: "Gaia's Vengeance Vandal", family: "gaia", swatch: "#36bde9", variant: "Blue" },
      { id: "primordium-vandal", name: "Primordium Vandal", family: "primordium", swatch: "#c9a45a", variant: "Base" },
      { id: "primordium-vandal-cobalt", name: "Primordium Vandal", family: "primordium", swatch: "#3e64d8", variant: "Cobalt" },
      { id: "kuronami-vandal-standard", name: "Kuronami Vandal", family: "kuronami-vandal", swatch: "#306a93", variant: "Standard" },
      { id: "kuronami-vandal-black-red", name: "Kuronami Vandal", family: "kuronami-vandal", swatch: "#8f343b", variant: "Black" },
    ] },
    { id: "phantom", label: "Phantom", key: "es-phantom-skin", global: "__aimPhantomSkin", fallback: "blastx-phantom", skins: [
      { id: "default", name: "Phantom" },
      { id: "blastx-phantom", name: "BlastX Phantom" },
      { id: "recon-phantom", name: "Recon Phantom", family: "recon", swatch: "#d9cfb4", variant: "Base" },
      { id: "recon-phantom-red", name: "Recon Phantom", family: "recon", swatch: "#b8303a", variant: "Red Camo" },
      { id: "helix-phantom-purple", name: "Helix Phantom" },
    ] },
    { id: "guardian", label: "Guardian", key: "es-guardian-skin", global: "__aimGuardianSkin", fallback: "default", skins: [
      { id: "default", name: "Guardian" },
      { id: "prime-guardian", name: "Prime Guardian" },
    ] },
    { id: "operator", label: "Operator", key: "es-operator-skin", global: "__aimOperatorSkin", fallback: "default", skins: [
      { id: "default", name: "Operator" },
      { id: "rogue-operator", name: "Rogue Operator" },
    ] },
    { id: "melee", label: "Melee", key: "es-melee-skin", global: "__aimMeleeSkin", fallback: "default", skins: [
      { id: "default", name: "Tactical Knife" },
      { id: "blackmarket-butterfly", name: "Black Market Butterfly Knife" },
      { id: "prime-axe", name: "Prime Axe" },
      { id: "soulstrife", name: "Soulstrife Scythe" },
      { id: "kuronami", name: "Kuronami no Yaiba" },
      /* xenohunter-knife */
      { id: "xenohunter-knife", name: "Xenohunter Knife" },
      { id: "champions-2024-blade", name: "Champions 2024 Blade" },
      ...[
        ["standard", "Standard", "#ebd2a2"],
        ["purple-red", "CN", "#a72c64"],
        ["pacific", "Pacific", "#1ebca8"],
        ["americas", "Americas", "#dd542b"],
        ["green", "EMEA", "#87b623"]
      ].flatMap(([color, label, swatch]) => {
        const family = "vct-2026-sigil";
        const id = family + "-" + color;
        return [
          { id, name: "VCT 2026 Sigil", family, swatch, variant: label },
          { id: id + "-mvp", name: "VCT 2026 Sigil", family, variant: label + " MVP" }
        ];
      }),
      { id: "half-life-crowbar", name: "Half Life Crowbar" },
      { id: "damascus-karambit", name: "Champions 2021 Karambit", family: "champions-2021-karambit", variant: "Normal" },
      { id: "champions-2021-karambit-mvp", name: "Champions 2021 Karambit", family: "champions-2021-karambit", variant: "MVP" },
    ] },
  ];

  // imported-skins-v1: skins imported from the game files in bulk. Each has a model and a colour atlas in
  // /aim-viewmodel/ and a still made from them (tools/collection-stills.mjs). /aim-ui/collection/imported.json
  // lists the ones installed, as { weapon: [{ id, name }] }. This repository carries a few of them; the full
  // set is a separate download that brings its own list. A weapon that has no tab above gets one.
  const IMPORTED_ONLY = { frenzy: "Frenzy", classic: "Classic", shorty: "Shorty", bulldog: "Bulldog", bucky: "Bucky", judge: "Judge", ares: "Ares", odin: "Odin", spectre: "Spectre", stinger: "Stinger", marshal: "Marshal", outlaw: "Outlaw" };
  fetch("/aim-ui/collection/imported.json").then((r) => (r.ok ? r.json() : {})).then((list) => {
    for (const [weapon, skins] of Object.entries(list)) {
      if (!Array.isArray(skins) || !skins.length) continue;
      let w = WEAPONS.find((x) => x.id === weapon);
      if (!w) {
        const label = IMPORTED_ONLY[weapon];
        if (!label) continue;
        w = { id: weapon, label, key: `es-${weapon}-skin`, global: `__aim${label}Skin`, fallback: "default", skins: [{ id: "default", name: label }] };
        WEAPONS.splice(WEAPONS.findIndex((x) => x.id === "melee"), 0, w);   // Melee stays last
      }
      for (const s of skins) {
        // the names go into the page as markup, so they are kept to plain text
        if (s && /^[a-z0-9-]+$/.test(s.id) && !w.skins.some((x) => x.id === s.id)) w.skins.push({ id: s.id, name: String(s.name || s.id).replace(/[<>&"]/g, "") });
      }
    }
    if (page) render();
  }).catch(() => {});

  const equipped = (w) => {
    let v = null;
    try { v = localStorage.getItem(w.key); } catch {}
    return w.skins.some((s) => s.id === v) ? v : w.fallback;
  };
  function equip(w, id) {
    try { localStorage.setItem(w.key, id); } catch {}
    window[w.global] = id;
    try { window.__aimPrepareSkinAudio?.(); } catch {}
    try { window.__aimLocalAudio?.warmSkinFire?.(id); } catch {}
    dispatchEvent(new CustomEvent("aim-skin-change", { detail: { weapon: w.id, skin: id } }));
  }

  let page = null, tabButton = null, deactivated = null;
  const state = { weapon: "vandal", preview: null };

  function tiles(w) {
    // one tile per family; a family tile shows the equipped or first variant
    const out = [], seen = new Map();
    for (const s of w.skins) {
      if (!s.family) { out.push([s]); continue; }
      if (!seen.has(s.family)) { const group = []; seen.set(s.family, group); out.push(group); }
      seen.get(s.family).push(s);
    }
    return out;
  }

  function enableDragScroll(row) {
    let drag = null;
    let suppressClick = false;

    row.addEventListener("pointerdown", (event) => {
      suppressClick = false;
      if (!event.isPrimary || event.pointerType === "touch" || event.button !== 0 ||
          row.scrollWidth <= row.clientWidth) return;
      drag = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: row.scrollLeft };
    });
    row.addEventListener("pointermove", (event) => {
      if (drag?.pointerId !== event.pointerId) return;
      const distance = event.clientX - drag.startX;
      if (!suppressClick) {
        if (Math.abs(distance) < 6) return;
        suppressClick = true;
        row.setPointerCapture(event.pointerId);
        row.classList.add("is-dragging");
      }
      row.scrollLeft = drag.scrollLeft - distance;
    });

    function stopDrag(event) {
      if (drag?.pointerId !== event.pointerId) return;
      drag = null;
      row.classList.remove("is-dragging");
    }
    row.addEventListener("pointerup", stopDrag);
    row.addEventListener("pointercancel", stopDrag);
    row.addEventListener("lostpointercapture", stopDrag);
    row.addEventListener("pointerleave", (event) => {
      if (!suppressClick) stopDrag(event);
    });
    row.addEventListener("click", (event) => {
      if (suppressClick && event.detail > 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  function render() {
    if (!page) return;
    const w = WEAPONS.find((x) => x.id === state.weapon);
    const previousRow = page.querySelector(".es-col-row");
    const scrollLeft = previousRow?.dataset.weapon === w.id ? previousRow.scrollLeft : 0;
    const on = equipped(w);
    const cur = w.skins.find((s) => s.id === state.preview) || w.skins.find((s) => s.id === on);
    state.preview = cur.id;
    const fam = cur.family ? w.skins.filter((s) => s.family === cur.family) : [];
    const isOn = cur.id === on;
    page.innerHTML = `
      <div class="es-col-head"><span class="es-col-kicker">Collection</span><h1>${w.label}</h1>
        <p>${w.skins.length} skin${w.skins.length === 1 ? "" : "s"} · applied the next time you start a round</p></div>
      <div class="es-col-stage"><img class="es-col-hero" alt="" src="${IMG(w.id, cur.id)}" decoding="async"></div>
      <div class="es-col-info">
        <b>${cur.name}</b>
        ${fam.length ? `<small>Variant · ${cur.variant}</small><div class="es-col-swatches" role="radiogroup" aria-label="Variant">${fam.map((s) => `<button type="button" role="radio" aria-checked="${s.id === cur.id}" class="${s.id === cur.id ? "is-on " : ""}${s.swatch ? "" : "es-col-variant-text"}" data-skin="${s.id}" title="${s.variant}"${s.swatch ? ` style="--sw:${s.swatch}"` : ""}>${s.swatch ? "" : s.variant}</button>`).join("")}</div>` : `<small>${isOn ? "Equipped" : "Not equipped"}</small>`}
        <button type="button" class="es-col-equip${isOn ? " is-equipped" : ""}" ${isOn ? "disabled" : ""}>${isOn ? "Equipped" : "Equip"}</button>
      </div>
      <div class="es-col-strip">
        <div class="es-col-tabs" role="tablist">${WEAPONS.map((x) => `<button type="button" role="tab" aria-selected="${x.id === w.id}" class="${x.id === w.id ? "is-on" : ""}" data-weapon="${x.id}">${x.label}</button>`).join("")}</div>
        <div class="es-col-row" data-weapon="${w.id}">${tiles(w).map((group) => {
          const show = group.find((s) => s.id === cur.id) || group.find((s) => s.id === on) || group[0];
          const sel = group.some((s) => s.id === cur.id), eq = group.some((s) => s.id === on);
          const label = group[0].family ? group[0].name : show.name;
          return `<button type="button" class="es-col-tile${sel ? " is-on" : ""}${eq ? " is-eq" : ""}" data-skin="${show.id}"><img alt="" draggable="false" loading="lazy" decoding="async" src="${IMG(w.id, show.id)}"><span>${label}</span>${group.length > 1 ? `<i>${group.length} variants</i>` : ""}</button>`;
        }).join("")}</div>
      </div>`;
    const row = page.querySelector(".es-col-row");
    row.scrollLeft = scrollLeft;
    enableDragScroll(row);
  }

  function onPageClick(e) {
    const t = e.target.closest("button");
    if (!t || !page.contains(t)) return;
    const w = WEAPONS.find((x) => x.id === state.weapon);
    if (t.dataset.weapon) { state.weapon = t.dataset.weapon; state.preview = null; render(); return; }
    if (t.dataset.skin) { state.preview = t.dataset.skin; render(); return; }
    if (t.classList.contains("es-col-equip") && !t.disabled) { equip(w, state.preview); render(); }
  }

  function open(weapon) {
    if (weapon) { state.weapon = weapon; state.preview = null; }
    if (page) { render(); return; }
    page = document.createElement("section");
    page.className = "es-col";
    page.setAttribute("aria-label", "Collection");
    page.addEventListener("click", onPageClick);
    document.body.append(page);
    deactivated = [...document.querySelectorAll(".hall-tabs .hall-tab.is-active")].filter((b) => b !== tabButton);
    for (const b of deactivated) b.classList.remove("is-active");
    tabButton?.classList.add("is-active");
    render();
  }
  function close() {
    if (!page) return;
    page.remove(); page = null;
    tabButton?.classList.remove("is-active");
    for (const b of deactivated || []) if (b.isConnected) b.classList.add("is-active");
    deactivated = null;
  }
  window.__aimOpenCollection = open;

  function mountTab() {
    const nav = document.querySelector(".hall-topnav .hall-tabs");
    if (!nav) return;
    if (tabButton && tabButton.isConnected) return;
    const settings = [...nav.querySelectorAll(".hall-tab")].find((b) => /settings/i.test(b.textContent));
    tabButton = document.createElement("button");
    tabButton.type = "button";
    tabButton.className = "hall-tab es-col-tab";
    tabButton.textContent = "Collection";
    tabButton.addEventListener("click", (e) => { e.stopPropagation(); page ? close() : open(); });
    nav.insertBefore(tabButton, settings || null);
    // any other tab closes the Collection
    nav.addEventListener("click", (e) => { if (e.target.closest(".hall-tab") && !e.target.closest(".es-col-tab")) close(); }, true);
  }

  // Settings > Visuals: the old skin rows are hidden by theme-esports.css; one line points here.
  function mountNote() {
    const vandal = document.querySelector(".es-vandal-row");
    if (!vandal || document.querySelector(".es-col-note")) return;
    const inLobby = !!vandal.closest(".st-view");
    const note = document.createElement("div");
    note.className = "hall-field es-col-note";
    note.innerHTML = `<span class="hall-field-text"><b>Weapon skins</b><small>${inLobby ? "Skins are chosen in Collection, in the lobby's top bar." : "Skins are chosen in Collection, in the lobby's top bar. Applied the next time you start a round."}</small></span>${inLobby ? '<button type="button" class="es-col-note-open">Open Collection</button>' : ""}`;
    note.querySelector(".es-col-note-open")?.addEventListener("click", () => open());
    vandal.before(note);
  }

  // a round started (or the lobby is gone): close
  function check() {
    mountTab();
    mountNote();
    if (page && (!document.querySelector(".hall-root") || document.querySelector(".al-trainer-shell.al-session-active"))) close();
  }
  addEventListener("keydown", (e) => { if (e.key === "Escape" && page) close(); });
  let queued = false;
  window.__aimWatchPage?.(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; check(); }); }, { subtree: true, childList: true });
  check();
})();
