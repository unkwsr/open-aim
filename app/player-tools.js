// Player tools opened from the top bar (buttons added by lobby-bar.js):
// - Backups: list the automatic and manual backups of your data, back up now,
//   restore one, export to a folder, import from a folder (backups.js does the work).
// - Sens tools: eDPI and cm/360 for your VALORANT sensitivity, and a converter
//   between VALORANT and other games (same DPI), with a button to use the result here.
(() => {
  if (window.__aimTools) return;

  // ---------- shared panel ----------
  let open = null;

  function closePanel() {
    open?.remove();
    open = null;
  }

  function panel(title, subtitle) {
    closePanel();
    const shade = document.createElement("div");
    shade.className = "es-tool-shade";
    shade.innerHTML = `<section class="es-tool" role="dialog" aria-label="${title}">
      <header class="es-tool-head"><div><h2>${title}</h2><p>${subtitle}</p></div>
      <button type="button" class="es-tool-x" aria-label="Close">✕</button></header>
      <div class="es-tool-body"></div></section>`;
    shade.addEventListener("mousedown", (e) => { if (e.target === shade) closePanel(); });
    shade.querySelector(".es-tool-x").addEventListener("click", closePanel);
    // Keys typed here belong to the panel, not the game's shortcuts.
    for (const type of ["keydown", "keyup", "keypress"]) {
      shade.addEventListener(type, (e) => {
        if (type === "keydown" && e.key === "Escape") closePanel();
        e.stopPropagation();
      });
    }
    document.body.appendChild(shade);
    open = shade;
    return shade.querySelector(".es-tool-body");
  }

  // In-panel confirmation (instead of the browser's confirm popup).
  function ask(body, text, yes) {
    return new Promise((resolve) => {
      body.querySelector(".es-tool-ask")?.remove();
      const bar = document.createElement("div");
      bar.className = "es-tool-ask";
      bar.innerHTML = `<p>${esc(text).replace(/\n/g, "<br>")}</p><div><button type="button" class="es-tool-primary" data-ask="yes">${esc(yes)}</button><button type="button" data-ask="no">Cancel</button></div>`;
      bar.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ask]");
        if (!b) return;
        e.stopPropagation();
        bar.remove();
        resolve(b.dataset.ask === "yes");
      });
      body.prepend(bar);
    });
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------- backups ----------
  const api = () => window.__aimDesktop && window.__aimDesktop.backups;
  const REASONS = { launch: "Automatic (app start)", manual: "Saved by you", export: "Exported", imported: "Imported", "before restore": "Before a restore" };

  function when(ms) {
    const d = new Date(ms);
    const today = new Date();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === today.toDateString()) return `Today ${time}`;
    return `${d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })} ${time}`;
  }

  async function openBackups() {
    const body = panel("Backups", "Your training history, personal bests, settings and studio scenes. A backup is made every time the app starts (the last 10 are kept).");
    if (!api()) {
      body.innerHTML = `<p class="es-tool-note">Backups are only available in the desktop app.</p>`;
      return;
    }
    body.innerHTML = `<div class="es-tool-actions">
        <button type="button" class="es-tool-primary" data-act="create">Back up now</button>
        <button type="button" data-act="export">Export to folder…</button>
        <button type="button" data-act="import">Import from folder…</button>
        <button type="button" data-act="folder">Open backups folder</button>
      </div>
      <p class="es-tool-status" role="status"></p>
      <div class="es-tool-list"></div>`;
    const status = body.querySelector(".es-tool-status");
    const listEl = body.querySelector(".es-tool-list");
    const say = (text, bad) => { status.textContent = text; status.classList.toggle("is-bad", !!bad); };

    async function refresh() {
      const items = await api().list();
      if (!items.length) {
        listEl.innerHTML = `<p class="es-tool-note">No backups yet.</p>`;
        return;
      }
      listEl.innerHTML = items.map((b) => `<div class="es-tool-row">
          <div><b>${esc(when(b.created))}</b><span>${esc(REASONS[b.reason] || b.reason)} · ${(b.size / 1048576).toFixed(1)} MB</span></div>
          <button type="button" data-act="restore" data-id="${esc(b.id)}">Restore</button>
          <button type="button" data-act="export-one" data-id="${esc(b.id)}" title="Save a copy of this backup to a folder">Export</button>
        </div>`).join("");
    }

    body.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const { act, id } = btn.dataset;
      try {
        if (act === "create") {
          await api().create();
          say("Backup saved.");
          await refresh();
        } else if (act === "folder") {
          await api().openFolder();
        } else if (act === "export" || act === "export-one") {
          const dest = await api().exportTo(act === "export-one" ? id : undefined);
          if (dest) say(`Exported to ${dest}`);
          await refresh();
        } else if (act === "import") {
          if (!(await ask(body, "Import a backup folder?\nYour current data is backed up first, then the app restarts with the imported data.", "Choose folder"))) return;
          const done = await api().importFrom();
          if (done) say("Imported. Restarting…");
        } else if (act === "restore") {
          const row = btn.closest(".es-tool-row").querySelector("b").textContent;
          if (!(await ask(body, `Restore the backup from ${row}?\nYour current data is backed up first, then the app restarts with this backup.`, "Restore and restart"))) return;
          await api().restore(id);
          say("Restoring. Restarting…");
        }
      } catch (err) {
        say(String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""), true);
      }
    });
    await refresh();
  }

  // ---------- sensitivity ----------
  // Yaw = degrees turned per mouse count at sensitivity 1.
  const GAMES = [
    { id: "valorant", name: "VALORANT", yaw: 0.07 },
    { id: "cs2", name: "Counter-Strike 2 / CS:GO", yaw: 0.022 },
    { id: "apex", name: "Apex Legends", yaw: 0.022 },
    { id: "ow2", name: "Overwatch 2", yaw: 0.0066 },
    { id: "cod", name: "Call of Duty (MW / Warzone)", yaw: 0.0066 },
    { id: "destiny2", name: "Destiny 2", yaw: 0.0066 },
  ];
  const DPI_KEY = "es-mouse-dpi";

  function sensInput() {
    return document.querySelector(".hall-sens input");
  }

  function currentSens() {
    const v = parseFloat(sensInput()?.value);
    if (v > 0) return v;
    try { const s = parseFloat(localStorage.getItem("al-sensitivity-v1")); if (s > 0) return s; } catch {}
    return 0.4;
  }

  function useSens(value) {
    const input = sensInput();
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    input.blur();
    return true;
  }

  const fmt = (n, d = 3) => (Number.isFinite(n) ? String(+n.toFixed(d)) : "–");

  function openSens() {
    const body = panel("Sensitivity tools", "Work out eDPI and cm/360, and convert your sensitivity from or to other games (same mouse DPI).");
    let dpi = 800;
    try { dpi = parseInt(localStorage.getItem(DPI_KEY), 10) || 800; } catch {}
    body.innerHTML = `<div class="es-sens-grid">
        <label>Mouse DPI<input type="number" min="50" max="32000" step="50" data-f="dpi" value="${dpi}"></label>
        <label>VALORANT sensitivity<input type="number" min="0.01" max="20" step="0.001" data-f="val" value="${currentSens()}"></label>
      </div>
      <div class="es-sens-stats">
        <div><span>eDPI</span><b data-o="edpi">–</b></div>
        <div><span>cm / 360°</span><b data-o="cm">–</b></div>
        <div><span>inches / 360°</span><b data-o="in">–</b></div>
      </div>
      <h3>Convert from another game</h3>
      <div class="es-sens-grid">
        <label>Game<select data-f="game">${GAMES.filter((g) => g.id !== "valorant").map((g) => `<option value="${g.id}">${g.name}</option>`).join("")}</select></label>
        <label>Sensitivity in that game<input type="number" min="0.001" max="100" step="0.001" data-f="other" placeholder="e.g. 1.2"></label>
      </div>
      <div class="es-sens-convert"><span>VALORANT equivalent</span><b data-o="conv">–</b><button type="button" class="es-tool-primary" data-act="use-conv">Use in trainer</button></div>
      <h3>Your VALORANT sensitivity in other games</h3>
      <div class="es-tool-list es-sens-table"></div>
      <div class="es-tool-actions"><button type="button" class="es-tool-primary" data-act="use-val">Use this sensitivity in the trainer</button></div>
      <p class="es-tool-status" role="status"></p>`;
    const f = (name) => body.querySelector(`[data-f="${name}"]`);
    const o = (name) => body.querySelector(`[data-o="${name}"]`);
    const status = body.querySelector(".es-tool-status");

    function update() {
      const d = parseFloat(f("dpi").value);
      const v = parseFloat(f("val").value);
      try { if (d > 0) localStorage.setItem(DPI_KEY, String(Math.round(d))); } catch {}
      const counts360 = 360 / (v * 0.07); // mouse counts for a full turn
      const inches = counts360 / d;
      o("edpi").textContent = d > 0 && v > 0 ? fmt(d * v, 1) : "–";
      o("cm").textContent = d > 0 && v > 0 ? fmt(inches * 2.54, 1) : "–";
      o("in").textContent = d > 0 && v > 0 ? fmt(inches, 2) : "–";
      const game = GAMES.find((g) => g.id === f("game").value);
      const other = parseFloat(f("other").value);
      o("conv").textContent = other > 0 ? fmt((other * game.yaw) / 0.07) : "–";
      body.querySelector(".es-sens-table").innerHTML = GAMES.filter((g) => g.id !== "valorant")
        .map((g) => `<div class="es-tool-row"><div><b>${g.name}</b></div><b class="es-sens-num">${v > 0 ? fmt((v * 0.07) / g.yaw) : "–"}</b></div>`)
        .join("");
    }

    body.addEventListener("input", update);
    body.addEventListener("change", update);
    body.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const value = btn.dataset.act === "use-conv" ? parseFloat(o("conv").textContent) : parseFloat(f("val").value);
      if (!(value > 0)) { status.textContent = "Enter a sensitivity first."; status.classList.add("is-bad"); return; }
      const rounded = +value.toFixed(3);
      if (useSens(rounded)) {
        status.textContent = `Trainer sensitivity set to ${rounded}.`;
        status.classList.remove("is-bad");
        f("val").value = rounded;
        update();
      } else {
        status.textContent = "Open the lobby to change the trainer's sensitivity.";
        status.classList.add("is-bad");
      }
    });
    update();
  }

  window.__aimTools = { openBackups, openSens, close: closePanel };
})();
