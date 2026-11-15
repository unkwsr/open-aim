// Exit button: a small X in the top-right corner of the lobby that closes the app.
// There is no window frame or menu, so until now the only ways out were Alt+F4 or the taskbar.
// Hidden during a round and on the startup screen. main.js handles "aim:app:quit" (app.quit()).
(() => {
  if (window.__aimExitButton || !window.__aimDesktop?.quit) return;
  window.__aimExitButton = true;

  const css = document.createElement("style");
  css.textContent = `
.es-exit{position:fixed;top:0;right:0;z-index:2147482000;width:40px;height:40px;padding:0;border:0;
  background:transparent;color:#aeb2ba;cursor:pointer;display:grid;place-items:center}
.es-exit:hover,.es-exit:focus-visible{background:#ff4655;color:#fff;outline:none}
.es-exit svg{pointer-events:none}
body.al-training-active .es-exit{display:none}
/* Leave room so the top bar's right edge (Sens box) is not under the button. */
.hall-topnav{padding-right:44px!important;box-sizing:border-box}`;
  document.head.append(css);

  function mount() {
    if (!document.body || document.querySelector(".es-exit")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "es-exit";
    button.title = "Exit openVaim";
    button.setAttribute("aria-label", "Exit openVaim");
    button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    button.addEventListener("click", () => window.__aimDesktop.quit());
    document.body.append(button);
  }
  mount();
  window.__aimWatchPage?.(mount, { childList: true });
})();
