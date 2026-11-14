// Player tools opened from the top bar (buttons added by lobby-bar.js):
// - Backups: list the automatic and manual backups of your data, back up now,
//   restore one, export to a folder, import from a folder (backups.js does the work).
// - Sens tools: eDPI and cm/360 for your VALORANT sensitivity, and a converter
//   between VALORANT and other games (same DPI), with a button to use the result here.
(() => {
  if (window.__aimTools) return;

  // ---------- shared panel ----------
  let currentPanel = null;

  function closePanel() {
    currentPanel?.remove();
    currentPanel = null;
  }

  function showPanel(title, subtitle) {
    closePanel();
    const shade = document.createElement("div");
    shade.className = "es-tool-shade";
    shade.innerHTML = `<section class="es-tool" role="dialog" aria-label="${title}">
      <header class="es-tool-head"><div><h2>${title}</h2><p>${subtitle}</p></div>
      <button type="button" class="es-tool-x" aria-label="Close">✕</button></header>
      <div class="es-tool-body"></div></section>`;
    shade.addEventListener("mousedown", (event) => { if (event.target === shade) closePanel(); });
    shade.querySelector(".es-tool-x").addEventListener("click", closePanel);
    // Keys typed here belong to the panel, not the game's shortcuts.
    for (const type of ["keydown", "keyup", "keypress"]) {
      shade.addEventListener(type, (event) => {
        if (type === "keydown" && event.key === "Escape") closePanel();
        event.stopPropagation();
      });
    }
    document.body.appendChild(shade);
    currentPanel = shade;
    return shade.querySelector(".es-tool-body");
  }

  // In-panel confirmation (instead of the browser's confirm popup).
  function confirmInPanel(body, text, confirmLabel) {
    return new Promise((resolve) => {
      body.querySelector(".es-tool-ask")?.remove();
      const confirmBar = document.createElement("div");
      confirmBar.className = "es-tool-ask";
      confirmBar.innerHTML = `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p><div><button type="button" class="es-tool-primary" data-ask="yes">${escapeHtml(confirmLabel)}</button><button type="button" data-ask="no">Cancel</button></div>`;
      confirmBar.addEventListener("click", (event) => {
        const choice = event.target.closest("[data-ask]");
        if (!choice) return;
        event.stopPropagation();
        confirmBar.remove();
        resolve(choice.dataset.ask === "yes");
      });
      body.prepend(confirmBar);
    });
  }

  const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);

  // ---------- backups ----------
  const backupsApi = () => window.__aimDesktop && window.__aimDesktop.backups;
  const BACKUP_REASON_LABELS = { launch: "Automatic (app start)", manual: "Saved by you", export: "Exported", imported: "Imported", "before restore": "Before a restore" };

  function formatBackupTime(ms) {
    const date = new Date(ms);
    const today = new Date();
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (date.toDateString() === today.toDateString()) return `Today ${time}`;
    return `${date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })} ${time}`;
  }

  async function openBackups() {
    const body = showPanel("Backups", "Your training history, personal bests, settings and studio scenes. A backup is made every time the app starts (the last 10 are kept).");
    if (!backupsApi()) {
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
    const backupList = body.querySelector(".es-tool-list");
    const showStatus = (text, isError) => { status.textContent = text; status.classList.toggle("is-bad", !!isError); };

    async function refreshBackupList() {
      const backups = await backupsApi().list();
      if (!backups.length) {
        backupList.innerHTML = `<p class="es-tool-note">No backups yet.</p>`;
        return;
      }
      backupList.innerHTML = backups.map((backup) => `<div class="es-tool-row">
          <div><b>${escapeHtml(formatBackupTime(backup.created))}</b><span>${escapeHtml(BACKUP_REASON_LABELS[backup.reason] || backup.reason)} · ${(backup.size / 1048576).toFixed(1)} MB</span></div>
          <button type="button" data-act="restore" data-id="${escapeHtml(backup.id)}">Restore</button>
          <button type="button" data-act="export-one" data-id="${escapeHtml(backup.id)}" title="Save a copy of this backup to a folder">Export</button>
        </div>`).join("");
    }

    body.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-act]");
      if (!button) return;
      const { act, id } = button.dataset;
      try {
        if (act === "create") {
          await backupsApi().create();
          showStatus("Backup saved.");
          await refreshBackupList();
        } else if (act === "folder") {
          await backupsApi().openFolder();
        } else if (act === "export" || act === "export-one") {
          const exportFolder = await backupsApi().exportTo(act === "export-one" ? id : undefined);
          if (exportFolder) showStatus(`Exported to ${exportFolder}`);
          await refreshBackupList();
        } else if (act === "import") {
          if (!(await confirmInPanel(body, "Import a backup folder?\nYour current data is backed up first, then the app restarts with the imported data.", "Choose folder"))) return;
          const imported = await backupsApi().importFrom();
          if (imported) showStatus("Imported. Restarting…");
        } else if (act === "restore") {
          const backupTime = button.closest(".es-tool-row").querySelector("b").textContent;
          if (!(await confirmInPanel(body, `Restore the backup from ${backupTime}?\nYour current data is backed up first, then the app restarts with this backup.`, "Restore and restart"))) return;
          await backupsApi().restore(id);
          showStatus("Restoring. Restarting…");
        }
      } catch (error) {
        showStatus(String((error && error.message) || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""), true);
      }
    });
    await refreshBackupList();
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

  function trainerSensInput() {
    return document.querySelector(".hall-sens input");
  }

  function currentTrainerSens() {
    const typedSens = parseFloat(trainerSensInput()?.value);
    if (typedSens > 0) return typedSens;
    try { const savedSens = parseFloat(localStorage.getItem("al-sensitivity-v1")); if (savedSens > 0) return savedSens; } catch {}
    return 0.4;
  }

  function setTrainerSens(value) {
    const input = trainerSensInput();
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    input.blur();
    return true;
  }

  const formatNumber = (value, digits = 3) => (Number.isFinite(value) ? String(+value.toFixed(digits)) : "–");

  function openSens() {
    const body = showPanel("Sensitivity tools", "Work out eDPI and cm/360, and convert your sensitivity from or to other games (same mouse DPI).");
    let dpi = 800;
    try { dpi = parseInt(localStorage.getItem(DPI_KEY), 10) || 800; } catch {}
    body.innerHTML = `<div class="es-sens-grid">
        <label>Mouse DPI<input type="number" min="50" max="32000" step="50" data-f="dpi" value="${dpi}"></label>
        <label>VALORANT sensitivity<input type="number" min="0.01" max="20" step="0.001" data-f="val" value="${currentTrainerSens()}"></label>
      </div>
      <div class="es-sens-stats">
        <div><span>eDPI</span><b data-o="edpi">–</b></div>
        <div><span>cm / 360°</span><b data-o="cm">–</b></div>
        <div><span>inches / 360°</span><b data-o="in">–</b></div>
      </div>
      <h3>Convert from another game</h3>
      <div class="es-sens-grid">
        <label>Game<select data-f="game">${GAMES.filter((game) => game.id !== "valorant").map((game) => `<option value="${game.id}">${game.name}</option>`).join("")}</select></label>
        <label>Sensitivity in that game<input type="number" min="0.001" max="100" step="0.001" data-f="other" placeholder="e.g. 1.2"></label>
      </div>
      <div class="es-sens-convert"><span>VALORANT equivalent</span><b data-o="conv">–</b><button type="button" class="es-tool-primary" data-act="use-conv">Use in trainer</button></div>
      <h3>Your VALORANT sensitivity in other games</h3>
      <div class="es-tool-list es-sens-table"></div>
      <div class="es-tool-actions"><button type="button" class="es-tool-primary" data-act="use-val">Use this sensitivity in the trainer</button></div>
      <p class="es-tool-status" role="status"></p>`;
    const field = (name) => body.querySelector(`[data-f="${name}"]`);
    const output = (name) => body.querySelector(`[data-o="${name}"]`);
    const status = body.querySelector(".es-tool-status");

    function updateResults() {
      const mouseDpi = parseFloat(field("dpi").value);
      const valorantSens = parseFloat(field("val").value);
      try { if (mouseDpi > 0) localStorage.setItem(DPI_KEY, String(Math.round(mouseDpi))); } catch {}
      const counts360 = 360 / (valorantSens * 0.07); // mouse counts for a full turn
      const inches = counts360 / mouseDpi;
      output("edpi").textContent = mouseDpi > 0 && valorantSens > 0 ? formatNumber(mouseDpi * valorantSens, 1) : "–";
      output("cm").textContent = mouseDpi > 0 && valorantSens > 0 ? formatNumber(inches * 2.54, 1) : "–";
      output("in").textContent = mouseDpi > 0 && valorantSens > 0 ? formatNumber(inches, 2) : "–";
      const selectedGame = GAMES.find((game) => game.id === field("game").value);
      const otherSens = parseFloat(field("other").value);
      output("conv").textContent = otherSens > 0 ? formatNumber((otherSens * selectedGame.yaw) / 0.07) : "–";
      body.querySelector(".es-sens-table").innerHTML = GAMES.filter((game) => game.id !== "valorant")
        .map((game) => `<div class="es-tool-row"><div><b>${game.name}</b></div><b class="es-sens-num">${valorantSens > 0 ? formatNumber((valorantSens * 0.07) / game.yaw) : "–"}</b></div>`)
        .join("");
    }

    body.addEventListener("input", updateResults);
    body.addEventListener("change", updateResults);
    body.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-act]");
      if (!button) return;
      const value = button.dataset.act === "use-conv" ? parseFloat(output("conv").textContent) : parseFloat(field("val").value);
      if (!(value > 0)) { status.textContent = "Enter a sensitivity first."; status.classList.add("is-bad"); return; }
      const rounded = +value.toFixed(3);
      if (setTrainerSens(rounded)) {
        status.textContent = `Trainer sensitivity set to ${rounded}.`;
        status.classList.remove("is-bad");
        field("val").value = rounded;
        updateResults();
      } else {
        status.textContent = "Open the lobby to change the trainer's sensitivity.";
        status.classList.add("is-bad");
      }
    });
    updateResults();
  }

  window.__aimTools = { openBackups, openSens, close: closePanel };
})();
