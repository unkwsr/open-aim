// flyable-option-removed-v1
// Lobby top bar: the left sidebar is hidden by theme-esports.css, and its Quick
// start and items (Favorites, Training Creator, Workshop manual, ...) are shown as
// buttons in the top bar instead. Each button clicks the hidden sidebar item, so
// the game's own handlers (and its links) keep working unchanged.
(() => {
  if (window.__aimLobbyBar) return;
  window.__aimLobbyBar = true;

  const SHORT_LABELS = { favorites: "Favorites", "open-studio": "Creator", "open-studio-guide": "Manual" };
  const GAUGE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 18a9 9 0 1 1 16 0"/><path d="M12 14l4-5"/></svg>';

  const SENS_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>';
  const UPDATE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 19h14"/></svg>';
  const BACKUP_ICON ='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v12H4z"/><path d="M3 4h18v3H3zM10 11h4"/></svg>';

  // The single game-render meter is owned by frame-meter.js.
  function meterOn() { return window.__aimFrameMeter?.enabled() ?? false; }
  function setMeter(enabled) { window.__aimFrameMeter?.setEnabled(enabled); }
  addEventListener('aim-frame-meter-change', () => {
    for (const button of document.querySelectorAll('.es-bar-fps')) button.classList.toggle('is-on', meterOn());
  });

  const PLAY_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l13-7.5z"/></svg>';

  // ---- Discord account (the same Community Workshop sign-in Publish uses) ----
  const DISCORD_LOGO = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M19.3 5.6A16.6 16.6 0 0 0 15.2 4.3l-.5 1a15.4 15.4 0 0 0-5.4 0l-.5-1A16.6 16.6 0 0 0 4.7 5.6C2.1 9.5 1.4 13.3 1.8 17a16.8 16.8 0 0 0 5 2.6l1.1-1.7c-.6-.2-1.2-.5-1.8-.9l.4-.3a11.9 11.9 0 0 0 11 0l.4.3c-.6.4-1.2.7-1.8.9l1.1 1.7a16.8 16.8 0 0 0 5-2.6c.5-4.3-.7-8.1-2.9-11.4ZM8.7 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>';
  const workshopApi = window.__aimDesktop?.workshop;
  let account = { user: null, offline: false };
  let avatarData = null;
  let signinWaiting = false;

  function accountControl() {
    const slot = document.createElement("div");
    slot.className = "es-account-slot";
    if (!workshopApi) return slot;
    if (!account.user) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "es-bar-btn es-account-signin";
      button.title = "Sign in with Discord: your name is shown on drills you publish";
      button.innerHTML = DISCORD_LOGO;
      const labelSpan = document.createElement("span");
      labelSpan.textContent = signinWaiting ? "Waiting…" : "Sign in";
      button.appendChild(labelSpan);
      button.disabled = signinWaiting;
      button.addEventListener("click", async () => {
        if (signinWaiting) return;
        signinWaiting = true;
        rerenderAccount();
        try { await workshopApi.login(); } // finishes in the browser; onAuth reports back
        catch (error) {
          signinWaiting = false;
          rerenderAccount();
          for (const failed of document.querySelectorAll(".es-account-signin")) {
            failed.title = error?.message || "Sign-in failed. Try again.";
          }
        }
      });
      slot.appendChild(button);
      return slot;
    }
    const box = document.createElement("div");
    box.className = "es-account";
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "es-account-chip";
    chip.title = account.offline
      ? "Signed in with Discord (workshop not reachable right now)"
      : account.user.moderator ? "Signed in with Discord (moderator)" : "Signed in with Discord";
    chip.setAttribute("aria-haspopup", "true");
    if (avatarData) {
      const img = document.createElement("img");
      img.className = "es-account-avatar";
      img.alt = "";
      img.src = avatarData;
      chip.appendChild(img);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "es-account-fallback";
      fallback.textContent = (account.user.name || "?").slice(0, 1).toUpperCase();
      chip.appendChild(fallback);
    }
    const name = document.createElement("span");
    name.className = "es-account-name";
    name.textContent = account.user.name;
    chip.appendChild(name);
    chip.insertAdjacentHTML("beforeend", '<svg class="es-account-caret" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg>');
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      box.classList.toggle("is-open");
    });
    const menu = document.createElement("div");
    menu.className = "es-account-menu";
    const who = document.createElement("div");
    who.className = "es-account-who";
    who.textContent = "Signed in with Discord";
    const whoName = document.createElement("b");
    whoName.textContent = account.user.name + (account.user.moderator ? " (moderator)" : "");
    who.appendChild(whoName);
    menu.appendChild(who);
    const signOut = document.createElement("button");
    signOut.type = "button";
    signOut.textContent = "Sign out";
    signOut.addEventListener("click", async (event) => {
      event.stopPropagation();
      try { await workshopApi.logout(); } catch {}
      account = { user: null, offline: false };
      avatarData = null;
      rerenderAccount();
    });
    menu.appendChild(signOut);
    box.append(chip, menu);
    slot.appendChild(box);
    return slot;
  }

  function rerenderAccount() {
    for (const slot of document.querySelectorAll(".es-account-slot")) slot.replaceWith(accountControl());
  }

  async function refreshAccount() {
    if (!workshopApi) return;
    try {
      const result = await workshopApi.status();
      account = { user: result?.user || null, offline: !!result?.offline };
    } catch { account = { user: null, offline: false }; }
    avatarData = null;
    if (account.user?.avatar && workshopApi.avatar) {
      try { avatarData = (await workshopApi.avatar())?.data || null; } catch {}
    }
    rerenderAccount();
  }

  workshopApi?.onAuth?.((result) => {
    signinWaiting = false;
    if (result?.ok) refreshAccount();
    else {
      rerenderAccount();
      for (const failed of document.querySelectorAll(".es-account-signin")) {
        failed.title = result?.message || "Sign-in failed. Try again.";
      }
    }
  });
  document.addEventListener("click", () => {
    for (const open of document.querySelectorAll(".es-account.is-open")) open.classList.remove("is-open");
  });
  refreshAccount();
  function sidebarItems() {
    const rail = document.querySelector(".hall-rail");
    // Items the sidebar itself kept hidden stay hidden (the rail is display:none, so check each item's own display).
    // The workshop guide page was never saved offline, so its link would open a 404.
    return rail
      ? [...rail.querySelectorAll(".hall-rail-item")].filter((item) => getComputedStyle(item).display !== "none" && item.dataset.action !== "open-studio-guide")
      : [];
  }

  function itemKey(item, index) {
    return item.dataset.action || `item-${index}`;
  }

  // The bar sits in the top nav just before the Sens box (.hall-topnav-right, whose
  // other children the site's overrides hide).
  function createBar(topnavRight) {
    const bar = document.createElement("div");
    bar.className = "es-bar";
    topnavRight.before(bar);
    return bar;
  }

  function syncDiscordContact() {
    if (!document.querySelector(".hall-bottombar") || document.querySelector(".es-discord-dock")) return;
    const link = document.createElement("a");
    link.className = "es-discord-panel";
    // discord-server-v1 (14 Nov 2026): the openVaim Discord server (permanent invite) instead of @xwvu's profile.
    link.href = "https://discord.gg/W2RWG392Rm";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Join the openVaim Discord server to report an issue or share feedback";
    link.setAttribute("aria-label", "Join the openVaim Discord server to report an issue or share feedback");
    link.innerHTML = '<span class="es-discord-panel-head"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 6.5A16 16 0 0 1 9 5l.5 1a12 12 0 0 1 5 0L15 5a16 16 0 0 1 4 1.5c1.4 2.3 2 5.5 1.7 8.5A15 15 0 0 1 16 18l-.8-1.3c.8-.3 1.4-.7 2-1.1-3.4 1.6-7 1.6-10.4 0 .6.4 1.2.8 2 1.1L8 18a15 15 0 0 1-4.7-3C3 12 3.6 8.8 5 6.5Z"/><path d="M8.5 11.5h.01M15.5 11.5h.01" stroke-width="2.8" stroke-linecap="round"/></svg><span>DISCORD SUPPORT</span></span><strong>Report an issue<br>or share feedback</strong><span class="es-discord-panel-action">JOIN THE DISCORD <span aria-hidden="true">↗</span></span>';
    // The panel sits in a dock with an arrow tab on its left edge: the arrow slides the panel
    // off the right edge, leaving only the tab, and the tab brings it back. Remembered.
    const dock = document.createElement("div");
    dock.className = "es-discord-dock";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "es-discord-toggle";
    toggle.innerHTML = '<svg class="es-discord-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M19.3 5.6A16.6 16.6 0 0 0 15.2 4.3l-.5 1a15.4 15.4 0 0 0-5.4 0l-.5-1A16.6 16.6 0 0 0 4.7 5.6C2.1 9.5 1.4 13.3 1.8 17a16.8 16.8 0 0 0 5 2.6l1.1-1.7c-.6-.2-1.2-.5-1.8-.9l.4-.3a11.9 11.9 0 0 0 11 0l.4.3c-.6.4-1.2.7-1.8.9l1.1 1.7a16.8 16.8 0 0 0 5-2.6c.5-4.3-.7-8.1-2.9-11.4ZM8.7 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>'
      + '<svg class="es-discord-toggle-arrow" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const setCollapsed = collapsed => {
      dock.classList.toggle("is-collapsed", collapsed);
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-label", collapsed ? "Show Discord support" : "Hide Discord support");
      toggle.title = collapsed ? "Show Discord support" : "Hide";
      link.tabIndex = collapsed ? -1 : 0;
    };
    let saved = false;
    try { saved = localStorage.getItem("es-discord-collapsed") === "1"; } catch {}
    setCollapsed(saved);
    toggle.addEventListener("click", () => {
      const collapsed = !dock.classList.contains("is-collapsed");
      setCollapsed(collapsed);
      try { localStorage.setItem("es-discord-collapsed", collapsed ? "1" : "0"); } catch {}
    });
    dock.append(toggle, link);
    document.body.appendChild(dock);
  }

  function syncBar() {

    syncDiscordContact();
    const topnavRight = document.querySelector(".hall-topnav > .hall-topnav-right");
    if (!topnavRight) return;
    const previousElement = topnavRight.previousElementSibling;
    const bar = previousElement && previousElement.classList.contains("es-bar") ? previousElement : createBar(topnavRight);

    // Signature of what the sidebar shows now; rebuild the buttons only when it changes.
    const quickStart = document.querySelector(".hall-rail-quick");
    const items = sidebarItems();
    const signature = [quickStart ? quickStart.querySelector("em")?.textContent || "q" : "", ...items.map((item, index) => itemKey(item, index) + ":" + item.textContent.trim() + ":" + item.classList.contains("is-active"))].join("|");
    if (bar.dataset.sig === signature) return;
    bar.dataset.sig = signature;
    bar.textContent = "";

    items.forEach((item, index) => {
      const key = itemKey(item, index);
      const label = item.textContent.trim();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "es-bar-btn" + (item.classList.contains("is-active") ? " is-on" : "");
      button.title = label;
      const icon = item.querySelector("svg");
      if (icon) button.appendChild(icon.cloneNode(true));
      const labelSpan = document.createElement("span");
      labelSpan.textContent = SHORT_LABELS[key] || label;
      button.appendChild(labelSpan);
      button.addEventListener("click", () => {
        // Creator opens the Studio (studio/), which replaces the site's editor.
        if (key === "open-studio") return location.assign("/studio/");
        const liveItem = sidebarItems().find((candidate, candidateIndex) => itemKey(candidate, candidateIndex) === key);
        if (liveItem) liveItem.click();
      });
      bar.appendChild(button);
    });

    // The FPS counter is set in Settings > Performance counter (Off / On / On + details).

    // The agent (Jett / Neon) is picked in game now: press N in a round (agent-picker.js).

    // Panels from player-tools.js.
    for (const [label, title, icon, toolMethod] of [
      ["Sens tools", "Sensitivity tools: eDPI, cm/360 and converter from other games", SENS_ICON, "openSens"],
      ["Backups", "Back up, restore, export or import your training data", BACKUP_ICON, "openBackups"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "es-bar-btn";
      button.title = title;
      button.innerHTML = icon;
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;
      button.appendChild(labelSpan);
      button.addEventListener("click", () => window.__aimTools?.[toolMethod]());
      bar.appendChild(button);
    }

    // Check for updates (release-updates-ui.js), in the installed and portable apps.
    if (window.__aimDesktop?.updates) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "es-bar-btn es-bar-updates";
      button.title = "Check for updates";
      button.innerHTML = UPDATE_ICON;
      const labelSpan = document.createElement("span");
      labelSpan.textContent = "Updates";
      button.appendChild(labelSpan);
      button.addEventListener("click", () => window.__aimReleaseUpdates?.open());
      bar.appendChild(button);
    }

    bar.appendChild(accountControl());

    // quick-start-removed-v1 (user, 14 Nov 2026): no Quick start button in the top bar.
    if (false && quickStart) {
      const quickStartName = quickStart.querySelector("em")?.textContent.trim() || "";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "es-bar-quick";
      button.title = quickStartName ? `Quick start: ${quickStartName}` : "Quick start";
      button.innerHTML = PLAY_ICON;
      const labelSpan = document.createElement("span");
      labelSpan.textContent = "Quick start";
      button.appendChild(labelSpan);
      button.addEventListener("click", () => document.querySelector(".hall-rail-quick")?.click());
      bar.appendChild(button);
    }
  }

  // Use native wheel scrolling and the active tab fill for direct feedback.

  let syncQueued = false;
  // Only page changes that touch the lobby bar, sidebar or bottom bar matter. The results screen
  // animates every frame (score count-up, chart); without this filter each frame ran syncBar(),
  // whose getComputedStyle forces a full style recalculation (65-180 ms UI freezes after a round).
  const BAR_PARTS = ".hall-rail, .hall-topnav, .hall-bottombar";
  const touchesBar = (node) => node && node.nodeType === 1 && (node === document.body || node === document.documentElement || node.closest?.(BAR_PARTS) || node.matches?.(BAR_PARTS) || node.querySelector?.(BAR_PARTS));
  const relevant = (records) => !records.length || records.some((r) => touchesBar(r.target.nodeType === 1 ? r.target : r.target.parentElement) && (r.type !== "childList" || r.target.closest?.(BAR_PARTS) || [...r.addedNodes, ...r.removedNodes].some(touchesBar)));
  window.__aimWatchPage((records) => {
    if (!relevant(records)) return;
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      // syncBar() forces a full style recalculation (130+ ms in a round) and the bar is hidden
      // then. The training class leaving the body wakes this watcher to catch up.
      if (document.body.classList.contains("al-training-active")) return;
      syncBar();
    });
  }, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  syncBar();

  // topbar-fit-v1: on narrow windows the tab strip scrolls sideways (theme-esports.css). The mouse wheel
  // scrolls it, and the selected tab is brought into view when it changes. Does nothing while it all fits.
  document.addEventListener("wheel", (event) => {
    const tabs = event.target.closest?.(".hall-topnav .hall-tabs");
    if (!tabs || tabs.scrollWidth <= tabs.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    tabs.scrollLeft += event.deltaY;
    event.preventDefault();
  }, { passive: false });
  document.addEventListener("click", (event) => {
    const tab = event.target.closest?.(".hall-topnav .hall-tab");
    const tabs = tab?.parentElement;
    if (!tabs || tabs.scrollWidth <= tabs.clientWidth) return;
    requestAnimationFrame(() => tab.scrollIntoView({ block: "nearest", inline: "nearest" }));
  });
  // Fade the edge that has hidden tabs. Only on resize / scroll of the strip, never per frame.
  let fadeTabs = null;
  const markTabs = () => {
    if (!fadeTabs?.isConnected) return;
    const more = fadeTabs.scrollWidth - fadeTabs.clientWidth;
    fadeTabs.classList.toggle("es-more-left", more > 1 && fadeTabs.scrollLeft > 1);
    fadeTabs.classList.toggle("es-more-right", more > 1 && fadeTabs.scrollLeft < more - 1);
  };
  const tabsObserver = new ResizeObserver(markTabs);
  const watchTabs = () => {
    const tabs = document.querySelector(".hall-topnav .hall-tabs");
    if (!tabs || tabs === fadeTabs) return;
    fadeTabs?.removeEventListener("scroll", markTabs);
    tabsObserver.disconnect();
    fadeTabs = tabs;
    tabs.addEventListener("scroll", markTabs, { passive: true });
    tabsObserver.observe(tabs);
    for (const tab of tabs.children) tabsObserver.observe(tab); // a translated label changes a tab's width
    markTabs();
  };
  window.__aimWatchPage(() => { if (!fadeTabs?.isConnected) watchTabs(); }, { childList: true, subtree: true });
  watchTabs();
})();
