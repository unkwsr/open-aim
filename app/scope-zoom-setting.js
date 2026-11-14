// Settings › General › Mouse: "2x zoom (toggle scope)" row under Scope mode (13 Nov 2026, marker
// aim-scope-zoom2-toggle). Saved on this PC as localStorage "aim-scope-zoom2-v1":
//   "click" (default)  Scope click cycles 1x → 2x → off, as before; the Scope 2x zoom key also works.
//   "key"              Scope click only toggles 1x / off; 2x only with the Scope 2x zoom key (no accidental 2x).
// Read by the input layer (OkAdunfX.js jh, __aimZ2KeyOnly) on each Scope press; "key" only takes effect while
// the Scope 2x zoom key is bound, so 2x can never become unreachable. Shown only in toggle scope mode.
(() => {
  if (window.__aimScopeZoomSetting) return;
  window.__aimScopeZoomSetting = true;
  const KEY = "aim-scope-zoom2-v1";
  const read = () => { try { return localStorage.getItem(KEY) === "key" ? "key" : "click"; } catch { return "click"; } };
  const zoomKeyBound = () => {
    try { const s = JSON.parse(localStorage.getItem("al-keybinds-v1") ?? "null"); if (s && Array.isArray(s.adsZoom2)) return s.adsZoom2.some((k) => k !== null); } catch {}
    return Array.isArray(window.__aimKeybinds?.adsZoom2) && window.__aimKeybinds.adsZoom2.some((k) => k !== null);
  };
  // Scope mode from the game's own row: the active option's text.
  const toggleMode = (anchor) => !/hold/i.test(anchor.querySelector(".is-active, [aria-checked=true]")?.textContent ?? "toggle");

  function sync() {
    for (const anchor of document.querySelectorAll('[data-setting="adsMode"]')) {
      let row = anchor.nextElementSibling?.matches?.(".aim-zoom2-row") ? anchor.nextElementSibling : null;
      if (!row) {
        const scope = [...anchor.attributes].filter((a) => a.name.startsWith("data-v-")).map((a) => a.name);
        row = document.createElement("div");
        row.className = "hall-field hall-choice aim-zoom2-row"; row.dataset.setting = "scopeZoom2";
        row.innerHTML = '<span class="hall-field-text"><b>2x zoom (toggle scope)</b><small></small></span><div class="hall-choice-options" role="radiogroup" aria-label="2x zoom"></div>';
        for (const [value, label] of [["click", "Second click"], ["key", "2x key only"]]) {
          const b = document.createElement("button"); b.type = "button"; b.role = "radio"; b.dataset.zoom2 = value; b.textContent = label;
          b.onclick = () => {
            try { localStorage.setItem(KEY, value); } catch {}
            // Worker Test keeps its own copy of localStorage: send it the new value.
            try { window.__aimWorkerStorageEvent ? window.__aimWorkerStorageEvent(KEY) : window.__aimRefreshWorkerPreferences?.(); } catch {}
            sync();
          };
          row.lastElementChild.append(b);
        }
        for (const el of [row, ...row.querySelectorAll("*")]) for (const a of scope) el.setAttribute(a, "");
        anchor.after(row);
      }
      row.hidden = !toggleMode(anchor);
      const mode = read();
      for (const b of row.querySelectorAll("button")) { const on = b.dataset.zoom2 === mode; b.classList.toggle("is-active", on); b.setAttribute("aria-checked", String(on)); }
      row.querySelector("small").textContent = mode === "key"
        ? (zoomKeyBound() ? "Right-click toggles 1x on and off; 2x only with your Scope 2x zoom key (press again to leave 2x)."
                          : "Bind Scope 2x zoom in Controls first. Until then a second click still goes to 2x.")
        : "A second right-click goes to 2x (Operator), a third unscopes. The Scope 2x zoom key works too.";
    }
  }
  let queued = false;
  const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); };
  if (window.__aimWatchPage) window.__aimWatchPage(later, { childList: true, subtree: true });
  document.addEventListener("click", () => setTimeout(sync, 30), true);
  sync();
})();
