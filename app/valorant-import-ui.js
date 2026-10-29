/* Desktop importer UI. Parsing and preview stay local to the renderer. */
(() => {
  if (window.__aimValorantImporter || !window.__aimDesktop?.valorant) return;
  const api = window.__aimDesktop.valorant, converter = window.aimValorantImport;
  const HIDE = "aim-valorant-import-hide-startup-v1", SHOWN = "aim-valorant-import-shown", UNDO = "aim-valorant-import-undo-v1";
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let shade = null;
  let startupDone = localStorage.getItem(HIDE) === "1" || !!sessionStorage.getItem(SHOWN);
  function open() {
    if (shade) { shade.querySelector("button").focus(); return; }
    const previousFocus = document.activeElement;
    shade = document.createElement("div"); shade.className = "es-tool-shade valorant-import-shade";
    shade.innerHTML = String.raw`<section class="es-tool valorant-import" role="dialog" aria-modal="true" aria-labelledby="valorant-import-title">
      <header class="es-tool-head"><div><h2 id="valorant-import-title">Import VALORANT settings</h2><p>Choose your files, review the changes, then apply.</p></div><button type="button" class="es-tool-x" aria-label="Close">×</button></header>
      <div class="es-tool-body">
        <details open><summary>Where to find your settings</summary><ol>
          <li>Close VALORANT so its latest settings are saved.</li>
          <li>In File Explorer, paste <code>%LOCALAPPDATA%\VALORANT\Saved\Config</code> in the address bar. This folder is separate from the game installation (usually <code>C:\Riot Games\VALORANT</code>).</li>
          <li>Open the account folder whose files changed when you last saved settings. Look in <code>Windows</code> for <code>RiotUserSettings.ini</code> (mouse, crosshair and general settings).</li>
          <li>Look in the same account's <code>WindowsClient</code> folder for <code>GameUserSettings.ini</code> (display) and optionally <code>BackupKeybinds.json</code> (saved key overrides). Folder layouts can vary.</li>
          <li>Add the files in separate selections or drops if they are in different folders. Review the combined list before applying. Use files from one account only.</li>
        </ol><p>Files stay on this computer. VALORANT files are never changed. Settings without a trainer equivalent are skipped.</p></details>
        <div class="valorant-import-drop" tabindex="0" role="button" aria-label="Choose or drop VALORANT settings files">Drop settings files here, or click to choose</div>
        <div class="es-tool-actions"><button type="button" data-action="choose" class="es-tool-primary">Add files…</button><button type="button" data-action="clear">Clear selected files</button><button type="button" data-action="undo">Undo last import</button></div>
        <div data-preview></div><p class="es-tool-status" role="status" aria-live="polite"></p>
        <label class="valorant-import-hide"><input type="checkbox" data-hide> Don't show this on startup again</label>
      </div></section>`;
    const panel = shade.querySelector("section"), status = shade.querySelector('[role="status"]'), preview = shade.querySelector("[data-preview]");
    const hide = shade.querySelector("[data-hide]");
    hide.checked = localStorage.getItem(HIDE) === "1";
    hide.onchange = () => { try { localStorage.setItem(HIDE, hide.checked ? "1" : "0"); } catch { status.textContent = "Could not save startup preference."; } };
    function close() { shade.remove(); shade = null; if (previousFocus?.isConnected) previousFocus.focus(); }
    shade.querySelector(".es-tool-x").onclick = close;
    shade.onclick = e => { if (e.target === shade) close(); };
    shade.addEventListener("keydown", e => {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Tab") {
        const targets = [...panel.querySelectorAll('button:not(:disabled), input, select, summary, [tabindex="0"]')].filter(el => el.getClientRects().length);
        const first = targets[0], last = targets[targets.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    for (const type of ["keyup", "keypress", "pointerdown"]) shade.addEventListener(type, e => e.stopPropagation());
    const message = (text, bad = false) => { status.textContent = text; status.classList.toggle("is-bad", bad); };
    let result = null, busy = false, pendingFiles = [];
    const undoButton = shade.querySelector('[data-action="undo"]');
    undoButton.disabled = !localStorage.getItem(UNDO);
    async function showFiles(files) {
      if (busy) return;
      result = null; preview.replaceChildren(); message("");
      try {
        const batch = new Set(), combined = new Map(pendingFiles.map(f => [f.name.toLowerCase(), f]));
        for (const file of files) {
          const name = String(file.name).toLowerCase();
          if (batch.has(name)) throw new Error("Choose only one copy of each file, from the same account.");
          batch.add(name); combined.set(name, file);
        }
        files = [...combined.values()];
        result = converter.parse(files);
        pendingFiles = files;
        shade.querySelector("details").open = false;
        const selected = result.profiles.findIndex(p => p.selected);
        preview.innerHTML = `<h3>Review import</h3><p>${files.map(f => escape(f.name)).join(", ")}</p>
          ${result.profiles.length ? `<label>Crosshair profile <select data-profile>${result.profiles.map((p, i) => `<option value="${i}" ${i === selected ? "selected" : ""}>${escape(p.name)}${p.selected ? " (active in VALORANT)" : ""}</option>`).join("")}</select></label>` : ""}
          <ul>${result.changes.map(c => `<li>${escape(c.label)}: <b>${escape(c.value === null ? "Unbound" : c.value)}</b></li>`).join("")}</ul>
          <details><summary>Skipped settings and limitations (${result.unhandled} other saved entries)</summary><ul>${result.warnings.map(w => `<li>${escape(w)}</li>`).join("")}</ul></details>
          <p>Other trainer settings will keep their current values. Applying reloads the trainer and ends any current drill. VSync changes also require an app restart.</p>
          <button type="button" data-apply class="es-tool-primary" ${!result.changes.length && !result.profiles.length ? "disabled" : ""}>Apply and reload</button>`;
        if (!result.changes.length && !result.profiles.length) message("No supported settings found in these files.", true);
        preview.querySelector("[data-apply]").onclick = () => apply();
      } catch (e) { message("Could not read settings: " + e.message, true); }
    }
    async function choose() {
      try { const files = await api.choose(); if (files) await showFiles(files); } catch (e) { message(e.message, true); }
    }
    shade.querySelector('[data-action="choose"]').onclick = choose;
    shade.querySelector('[data-action="clear"]').onclick = () => {
      if (busy) return;
      pendingFiles = []; result = null; preview.replaceChildren(); message("");
    };
    const drop = shade.querySelector(".valorant-import-drop"); drop.onclick = choose;
    drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } };
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("is-over"); };
    drop.ondragleave = () => drop.classList.remove("is-over");
    drop.ondrop = async e => {
      e.preventDefault(); drop.classList.remove("is-over");
      try {
        const files = [...e.dataTransfer.files];
        if (!files.length || files.length > 3 || files.some(f => f.size > 2 * 1024 * 1024)) throw new Error("Drop up to three settings files, each under 2 MB.");
        await showFiles(await Promise.all(files.map(async f => ({ name: f.name, text: await f.text() }))));
      } catch (err) { message(err.message, true); }
    };
    // Prevent dropping a file outside the target from navigating away from the app.
    shade.addEventListener("dragover", e => e.preventDefault()); shade.addEventListener("drop", e => e.preventDefault());
    const storageKeys = Object.values(converter.keys);
    function snapshot() { return Object.fromEntries(storageKeys.map(k => [k, localStorage.getItem(k)])); }
    function restore(values) { for (const k of storageKeys) { if (values[k] === null) localStorage.removeItem(k); else if (typeof values[k] === "string") localStorage.setItem(k, values[k]); } }
    async function apply() {
      if (!result || busy) return;
      busy = true; const button = preview.querySelector("[data-apply]"); button.disabled = true;
      const before = snapshot(), previousUndo = localStorage.getItem(UNDO);
      const oldVsync = window.aimDesktop.vsyncSaved;
      try {
        message("Saving backup…"); await window.__aimDesktop.backups.create();
        const pending = Object.create(null);
        let vsync;
        for (const c of result.changes) {
          if (c.group === "shell") { vsync = c.value; continue; }
          const key = converter.keys[c.group];
          if (c.group === "sensitivity") { pending[key] = String(c.value); continue; }
          if (!pending[key]) {
            const saved = JSON.parse(localStorage.getItem(key) || "{}");
            pending[key] = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
          }
          if (c.group === "bindings") {
            const [action, index] = c.field.split(":");
            // Do not clear an absent secondary slot: bindings files can be partial.
            if (!Array.isArray(pending[key][action])) pending[key][action] = defaultBindings[action].slice();
            pending[key][action][Number(index)] = c.value;
          } else pending[key][c.field] = c.value;
        }
        // Clear keys that moved to a different action so the trainer's loader cannot
        // discard an imported binding in favor of an older action earlier in its list.
        const bindings = pending[converter.keys.bindings];
        if (bindings) for (const c of result.changes.filter(c => c.group === "bindings" && c.value !== null)) {
          const [action] = c.field.split(":");
          for (const [other, defaults] of Object.entries(defaultBindings)) {
            if (other === action) continue;
            const pair = bindings[other] || defaults;
            if (pair.includes(c.value)) bindings[other] = pair.map(v => v === c.value ? null : v);
          }
        }
        if (result.profiles.length) pending[converter.keys.crosshair] = result.profiles[Number(preview.querySelector("[data-profile]").value)].code;
        localStorage.setItem(UNDO, JSON.stringify({ values: before, vsync: oldVsync }));
        for (const [key, value] of Object.entries(pending)) localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
        if (typeof vsync === "boolean") await api.setVsync(vsync);
        location.reload();
      } catch (e) {
        restore(before); if (previousUndo === null) localStorage.removeItem(UNDO); else localStorage.setItem(UNDO, previousUndo);
        message("Import was not applied: " + e.message, true); busy = false; button.disabled = false;
      }
    }
    undoButton.onclick = async () => {
      if (busy) return;
      busy = true; undoButton.disabled = true;
      try {
        const saved = JSON.parse(localStorage.getItem(UNDO));
        if (!saved?.values || !storageKeys.every(k => saved.values[k] === null || typeof saved.values[k] === "string")) throw new Error("No valid import backup found.");
        await window.__aimDesktop.backups.create();
        if (typeof saved.vsync === "boolean") await api.setVsync(saved.vsync);
        restore(saved.values); localStorage.removeItem(UNDO); location.reload();
      } catch (e) { message("Could not undo import: " + e.message, true); busy = false; undoButton.disabled = false; }
    };
    document.body.appendChild(shade); shade.querySelector(".es-tool-x").focus();
  }
  const defaultBindings = { moveForward:["KeyW",null],moveBack:["KeyS",null],moveLeft:["KeyA",null],moveRight:["KeyD",null],jump:["Space",null],crouch:["ControlLeft","ControlRight"],walk:["ShiftLeft","ShiftRight"],use:["KeyF",null],fire:["Mouse0",null],ads:["Mouse2",null],reload:["KeyR",null],equipPrimary:["Digit1",null],equipMelee:["Digit3",null],inspect:["KeyY",null],tailwind:["KeyE",null],cloudburst:["KeyC",null],restart:["KeyT",null],bigMap:["KeyM",null],buyMenu:["KeyB",null] };
  window.__aimValorantImporter = { open };
  function mount() {
    // .sd-searchrow is the settings window in a round, .st-searchrow the lobby's Settings page.
    for (const settings of document.querySelectorAll(".sd-searchrow, .st-searchrow")) {
      if (settings.querySelector(".valorant-import-button")) continue;
      const button = document.createElement("button"); button.type = "button"; button.className = "hall-dialog-btn valorant-import-button";
      button.textContent = "Import VALORANT settings"; button.onclick = open; settings.appendChild(button);
    }
    if (!startupDone && document.querySelector(".hall-root") && !document.querySelector('[role="dialog"], .hall-dialog, .es-tool-shade')) {
      startupDone = true; sessionStorage.setItem(SHOWN, "1"); open();
    }
  }
  let scheduled = false;
  new MutationObserver(records => {
    const settingsAdded = records.some(r => [...r.addedNodes].some(n => n.nodeType === 1 &&
      (n.matches(".sd-searchrow, .st-searchrow") || n.querySelector(".sd-searchrow, .st-searchrow"))));
    if (scheduled || (startupDone && !settingsAdded)) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; mount(); }, 100);
  }).observe(document.body, { childList: true, subtree: true }); mount();
})();
