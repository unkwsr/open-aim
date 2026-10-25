(() => {
  const api = window.__aimDesktop?.updates;
  if (!api || window.__aimReleaseUpdates) return;
  let state = null, panel = null, toast = null, dismissed = false;
  const button = (text, action) => {
    const el = document.createElement("button"); el.type = "button"; el.textContent = text; el.onclick = action; return el;
  };
  async function run(action) {
    try { const next = await action(); if (next?.status) receive(next); return true; }
    catch (error) { if (!panel) open(); panel.querySelector("[role=status]").textContent = error.message; return false; }
  }
  function close() {
    if (!panel) return;
    const previous = panel.previousFocus; panel.remove(); panel = null;
    if (previous?.isConnected) previous.focus();
  }
  function open() {
    toast?.remove(); toast = null; dismissed = true;
    if (panel) return;
    panel = document.createElement("div"); panel.className = "aim-update-shade";
    panel.previousFocus = document.activeElement;
    panel.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="aim-update-title" class="aim-update-panel">
      <header><h2 id="aim-update-title">AimTrainer updates</h2><button type="button" data-close aria-label="Close">×</button></header>
      <p data-version></p><p data-description></p>
      <div data-folder><label>Installation folder</label><div class="aim-update-folder"><output></output><button type="button" data-browse>Change folder…</button></div>
      <p>Your current installation is selected by default. Updating replaces the app and keeps your settings and training data.</p></div>
      <progress max="100" value="0" aria-label="Installer download progress" hidden></progress>
      <p role="status" aria-live="polite"></p><div class="aim-update-actions"></div>
    </section>`;
    panel.querySelector("[data-close]").onclick = close;
    panel.querySelector("[data-browse]").onclick = () => run(api.directory);
    panel.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const targets = [...panel.querySelectorAll("button:not(:disabled)")].filter(el => el.getClientRects().length);
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    for (const type of ["keyup", "keypress", "pointerdown"]) panel.addEventListener(type, e => e.stopPropagation());
    document.body.appendChild(panel); render(); panel.querySelector("[data-close]").focus();
    if (!state || ["idle", "latest", "error"].includes(state.status)) run(api.check);
  }
  function render() {
    if (!panel || !state) return;
    const busy = ["downloading", "installing", "checking"].includes(state.status);
    panel.querySelector("[data-version]").textContent = `Installed version: ${state.currentVersion}${state.release ? ` · Available: ${state.release.version}` : ""}`;
    panel.querySelector("[data-description]").textContent = state.supported
      ? "Updates come from published releases on the official open-aim GitHub repository. Installing closes the app and opens the new version."
      : "Portable and development builds can check for updates here. Download their replacement from the official releases page. In-app installation is available in the installed Windows app.";
    panel.querySelector("[data-folder]").hidden = !state.supported || !state.release;
    panel.querySelector("output").textContent = state.directory;
    panel.querySelector("[data-browse]").disabled = busy;
    const progress = panel.querySelector("progress"); progress.hidden = state.status !== "downloading"; progress.value = state.progress;
    panel.querySelector("[role=status]").textContent = state.error || ({ checking: "Checking GitHub…", latest: "No newer release is available.", downloading: `Downloading and verifying installer… ${state.progress}%`, installing: "Opening the installer. AimTrainer will close to finish updating." }[state.status] || "");
    const actions = panel.querySelector(".aim-update-actions");
    // Leave focused action buttons intact when download progress changes.
    const mode = `${state.status}:${!!state.release}:${state.supported}`;
    if (actions.dataset.mode === mode) return;
    actions.dataset.mode = mode; actions.replaceChildren();
    if (state.status === "downloading") actions.append(button("Cancel download", () => run(api.cancel)));
    else if (!busy) {
      if (state.release) {
        if (state.supported) {
          const install = button("Update and restart now", () => run(api.install)); install.className = "aim-update-primary"; actions.append(install);
        }
        actions.append(button("Remind me in 7 days", () => run(api.snooze).then(ok => ok && close())), button("Skip this version", () => run(api.skip).then(ok => ok && close())));
      }
      actions.append(button("Check for updates", () => run(api.check)), button("View GitHub releases", () => run(api.releases)));
    }
  }
  function mount() {
    if (toast && !toast.isConnected) toast = null;
    // .sd-searchrow is the settings window in a round, .st-searchrow the lobby's Settings page.
    for (const settings of document.querySelectorAll(".sd-searchrow, .st-searchrow")) {
      if (settings.querySelector(".aim-update-settings")) continue;
      const el = button("Check for updates", open); el.className = "hall-dialog-btn aim-update-settings"; settings.appendChild(el);
    }
    if (state?.status !== "available" || dismissed || panel) { toast?.remove(); toast = null; return; }
    const lobby = document.querySelector(".hall-root");
    if (!lobby || !lobby.getClientRects().length || document.pointerLockElement ||
        document.querySelector('[role="dialog"], .hall-dialog, .es-tool-shade')) { toast?.remove(); toast = null; return; }
    if (toast) return;
    toast = document.createElement("aside"); toast.className = "aim-update-toast"; toast.setAttribute("aria-label", "Update available");
    const text = document.createElement("p"); text.textContent = `AimTrainer ${state.release.version} is available.`;
    toast.append(text, button("Update now…", open), button("Remind me in 7 days", () => run(api.snooze)), button("Skip this version", () => run(api.skip)));
    lobby.appendChild(toast);
  }
  function receive(next) {
    if (next.release?.version !== state?.release?.version) dismissed = false;
    state = next; render(); mount();
  }
  let scheduled = false;
  new MutationObserver(records => {
    const relevant = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
      (node.matches('.hall-root, .sd-searchrow, .st-searchrow, [role="dialog"], .hall-dialog, .es-tool-shade') || node.querySelector('.hall-root, .sd-searchrow, .st-searchrow'))));
    if (!relevant || scheduled) return;
    scheduled = true; setTimeout(() => { scheduled = false; mount(); }, 100);
  }).observe(document.body, { childList: true, subtree: true });
  api.onState(receive); run(api.state); mount();
  window.__aimReleaseUpdates = { open };
})();
