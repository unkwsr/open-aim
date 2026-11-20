// Exit button (exit-button-v2, 18 Nov 2026): "Exit" at the right end of the lobby's top bar, closes the app.
// From open-aim PR 11 by s-bawaskar (https://github.com/unkwsr/open-aim/pull/11): the window has no frame or menu,
// so the only ways out were Alt+F4 or the taskbar. Changes here:
//  - v1 added a confirm step (one click on the X quit at once, and it sat above every lobby panel);
//  - v2 (user screenshot: the bare X floated at the window edge, over the page's scroll bar column, and didn't look
//    like the rest of the bar): it is now a normal top-bar item after the Sens box, power icon + "Exit", in the same
//    style as Favorites / Creator / Sens tools (.es-bar-btn; up to 2400 px wide the label hides like theirs).
// Click Exit -> "Exit openVaim?" under it: Exit (or Enter) quits, Cancel / Esc / a click elsewhere closes it.
// Hidden during a round (body.al-training-active). main.js handles "aim:app:quit" (only from the game window).
(() => {
  if (window.__aimExitButton || !window.__aimDesktop?.quit) return;
  window.__aimExitButton = true;

  const css = document.createElement("style");
  css.textContent = `
.es-exit-btn{align-self:center;margin-left:8px!important;flex:none}
html[data-aim-local]:not(#es) body .es-bar-btn.es-exit-btn:hover,html[data-aim-local]:not(#es) body .es-bar-btn.es-exit-btn.is-open{color:#ff6b77!important}
.es-exit-ask{position:fixed;z-index:2147482001;width:220px;padding:12px;background:#10131a;
  border:1px solid #343b4a;border-top:2px solid #ff4655;box-shadow:0 12px 30px -10px #000;color:#f4f5f7;
  font:600 14px/1.3 "Bahnschrift","Segoe UI",sans-serif}
.es-exit-ask p{margin:0 0 10px}
.es-exit-ask div{display:flex;gap:8px}
.es-exit-ask button{flex:1;height:32px;border:1px solid #343b4a;background:#171b23;color:#f4f5f7;cursor:pointer;
  font:700 12px "Bahnschrift","Segoe UI",sans-serif;letter-spacing:.06em;text-transform:uppercase}
.es-exit-ask button:hover,.es-exit-ask button:focus-visible{border-color:#ff6b77;outline:none}
.es-exit-ask button.is-exit{background:#ff4655;border-color:#ff4655}
.es-exit-ask button.is-exit:hover,.es-exit-ask button.is-exit:focus-visible{background:#ff6b77}
body.al-training-active :is(.es-exit-btn,.es-exit-ask){display:none!important}`;
  document.head.append(css);

  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.3 6.6a8 8 0 1 0 11.4 0"/></svg>';
  let ask = null, button = null;
  const close = () => { ask?.remove(); ask = null; button?.classList.remove("is-open"); };
  function open() {
    if (ask) { close(); return; }
    ask = document.createElement("div");
    ask.className = "es-exit-ask";
    ask.setAttribute("role", "alertdialog");
    ask.setAttribute("aria-label", "Exit openVaim?");
    ask.innerHTML = '<p>Exit openVaim?</p><div><button type="button" class="is-exit">Exit</button><button type="button">Cancel</button></div>';
    // right under the button, its right edge on the button's (never past the window's right edge)
    const r = button.getBoundingClientRect();
    ask.style.top = `${Math.round(r.bottom + 6)}px`;
    ask.style.right = `${Math.max(8, Math.round(innerWidth - r.right))}px`;
    const [exit, cancel] = ask.querySelectorAll("button");
    exit.addEventListener("click", () => window.__aimDesktop.quit());
    cancel.addEventListener("click", close);
    document.body.append(ask);
    button.classList.add("is-open");
    exit.focus();
  }
  // Esc closes the box; Enter on its Exit button quits (the button's own click). A click anywhere else closes it.
  // Capture, so the lobby's own key and click handlers don't also react.
  document.addEventListener("keydown", (e) => { if (ask && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }, true);
  document.addEventListener("pointerdown", (e) => { if (ask && !e.target.closest?.(".es-exit-ask, .es-exit-btn")) close(); }, true);

  // Keep the item at the end of the top bar (the lobby re-renders the bar). Cheap: one query, no layout reads,
  // at most once per frame, nothing while a round runs.
  function mount() {
    if (document.body?.classList.contains("al-training-active")) return;
    const nav = document.querySelector(".hall-topnav");
    if (!nav) return;
    if (button && button.parentElement === nav && !button.nextElementSibling) return;
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "es-bar-btn es-exit-btn";
      button.title = "Exit openVaim";
      button.setAttribute("aria-label", "Exit openVaim");
      button.innerHTML = ICON + "<span>Exit</span>";
      button.addEventListener("click", open);
    }
    nav.append(button);
  }
  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; mount(); }); };
  mount();
  window.__aimWatchPage?.(schedule, { childList: true, subtree: true });
})();
