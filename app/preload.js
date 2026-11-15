// The game asks for browser (HTML) fullscreen whenever a map starts, and Chromium
// always leaves that mode on Esc. Turn those requests into window fullscreen
// instead, which only F11 toggles, so Esc can be used in-game without dropping
// out of fullscreen.
const { contextBridge, ipcRenderer, webFrame } = require("electron");

// new-player-defaults-v1 (14 Nov 2026): a brand-new player (nothing saved yet for the game's address)
// starts with Kuronami melee, Champions 2021 Vandal, Recon Phantom and every pre-aim aid off. Runs before
// any page script; a player with saved data (e.g. updating from 1.3.0) is left exactly as they were.
try {
  if (/^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
      && localStorage.length === 0) {
    const aidsOff = { headLines: false, killOrder: false, aimLine: false, minimapBots: false };
    localStorage.setItem("al-aim-aids-v1", JSON.stringify({ easy: aidsOff, other: aidsOff }));
    localStorage.setItem("al-preaim-assist-v1", JSON.stringify({ line: false, easyLine: false, spots: false }));
  }
  // skin-defaults-v1 (14 Nov 2026): once per player, new AND updating (e.g. from 1.3.0): Kuronami melee,
  // Champions 2021 Vandal, Recon Phantom (red), Arcane Sheriff. The flag stops it running again, so a skin the
  // player picks afterwards stays.
  if (/^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
      && !localStorage.getItem("ov-skin-defaults-v1")) {
    localStorage.setItem("es-melee-skin", "kuronami");
    localStorage.setItem("es-vandal-skin", "champions-vandal");
    localStorage.setItem("es-phantom-skin", "recon-phantom-red");
    localStorage.setItem("es-sheriff-skin", "arcane-sheriff");
    localStorage.setItem("ov-skin-defaults-v1", "1");
  }
} catch (error) { console.warn("New player defaults:", error); }

contextBridge.exposeInMainWorld("__aimDesktop", {
  // From release 1.3.0: in-app updater (release-updates.js) and VALORANT settings import (valorant-import-ipc.js).
  updates: {
    state: () => ipcRenderer.invoke("aim:updates:state"),
    check: () => ipcRenderer.invoke("aim:updates:check"),
    skip: () => ipcRenderer.invoke("aim:updates:skip"),
    snooze: () => ipcRenderer.invoke("aim:updates:snooze"),
    directory: () => ipcRenderer.invoke("aim:updates:directory"),
    install: () => ipcRenderer.invoke("aim:updates:install"),
    cancel: () => ipcRenderer.invoke("aim:updates:cancel"),
    releases: () => ipcRenderer.invoke("aim:updates:releases"),
    onState: callback => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("aim:updates:state", listener);
      return () => ipcRenderer.removeListener("aim:updates:state", listener);
    },
  },
  valorant: {
    choose: () => ipcRenderer.invoke("aim:valorant:choose"),
    setVsync: on => ipcRenderer.invoke("aim:valorant:vsync", on),
  },
  fullscreen: () => ipcRenderer.send("aim:fullscreen"),
  // Exit button (exit-button.js).
  quit: () => ipcRenderer.send("aim:app:quit"),
  // Backups panel (lobby-bar.js); see backups.js.
  backups: {
    list: () => ipcRenderer.invoke("aim:backups:list"),
    create: () => ipcRenderer.invoke("aim:backups:create"),
    restore: (id) => ipcRenderer.invoke("aim:backups:restore", id),
    exportTo: (id) => ipcRenderer.invoke("aim:backups:export", id),
    importFrom: () => ipcRenderer.invoke("aim:backups:import"),
    openFolder: () => ipcRenderer.invoke("aim:backups:open"),
  },
  // Studio drills, also listed in VALORANT Training (studio-store.js).
  studio: {
    list: () => ipcRenderer.invoke("aim:studio:list"),
    get: (code) => ipcRenderer.invoke("aim:studio:get", code),
    save: (payload) => ipcRenderer.invoke("aim:studio:save", payload),
    remove: (code) => ipcRenderer.invoke("aim:studio:remove", code),
    record: (payload) => ipcRenderer.invoke("aim:studio:record", payload),
    clearRecording: () => ipcRenderer.invoke("aim:studio:clearRecording"),
    // Run library (copycat runs to reuse).
    runs: () => ipcRenderer.invoke("aim:studio:runs"),
    saveRun: (payload) => ipcRenderer.invoke("aim:studio:saveRun", payload),
    renameRun: (payload) => ipcRenderer.invoke("aim:studio:renameRun", payload),
    removeRun: (id) => ipcRenderer.invoke("aim:studio:removeRun", id),
    // Bot library: saved bot settings, by bot type (studio-store.js).
    bots: () => ipcRenderer.invoke("aim:studio:bots"),
    saveBot: (payload) => ipcRenderer.invoke("aim:studio:saveBot", payload),
    renameBot: (payload) => ipcRenderer.invoke("aim:studio:renameBot", payload),
    removeBot: (id) => ipcRenderer.invoke("aim:studio:removeBot", id),
  },
  hitSound: {
    pick: () => ipcRenderer.invoke("aim:hitsound:pick"),
    read: () => ipcRenderer.invoke("aim:hitsound:read"),
  },
  workshop: {
    login: () => ipcRenderer.invoke("aim:workshop:login"),
    status: () => ipcRenderer.invoke("aim:workshop:status"),
    logout: () => ipcRenderer.invoke("aim:workshop:logout"),
    avatar: () => ipcRenderer.invoke("aim:workshop:avatar"),
    like: (code, on) => ipcRenderer.invoke("aim:workshop:like", code, on),
    likeState: (code) => ipcRenderer.invoke("aim:workshop:likeState", code),
    scores: (code) => ipcRenderer.invoke("aim:workshop:scores", code),
    refresh: () => ipcRenderer.invoke("aim:workshop:refresh"),
    submitScore: (code, round) => ipcRenderer.invoke("aim:workshop:submitScore", code, round),
    setCover: (code, image, type) => ipcRenderer.invoke("aim:workshop:cover", code, image, type),
    publish: (code) => ipcRenderer.invoke("aim:workshop:publish", code),
    pending: () => ipcRenderer.invoke("aim:workshop:pending"),
    moderate: (code, action) => ipcRenderer.invoke("aim:workshop:moderate", code, action),
    published: () => ipcRenderer.invoke("aim:workshop:published"),
    banned: () => ipcRenderer.invoke("aim:workshop:banned"),
    unban: (accountId) => ipcRenderer.invoke("aim:workshop:unban", accountId),
    preview: (code) => ipcRenderer.invoke("aim:workshop:preview", code),
    onAuth: (callback) => {
      const listener = (_event, result) => callback(result);
      ipcRenderer.on("aim:workshop:auth", listener);
      return () => ipcRenderer.removeListener("aim:workshop:auth", listener);
    },
  },
  // Desktop frame settings (window.aimDesktop below); see main.js.
  setVsync: (on) => ipcRenderer.send("aim:shell:vsync", on === true),
  // Slow-frame report for the round that just ended (frame-log.js).
  frameLog: (report) => ipcRenderer.send("aim:frame-log", report),
  logPreparationError: (report) => ipcRenderer.invoke("aim:preparation:error", report),
  performance: {
    start: (description) => ipcRenderer.invoke("aim:performance:start", description),
    append: (packet) => ipcRenderer.invoke("aim:performance:append", packet),
    last: (packet) => ipcRenderer.send("aim:performance:last", packet),
    stop: () => ipcRenderer.invoke("aim:performance:stop"),
    profile: (request) => ipcRenderer.invoke("aim:performance:profile", request),
    onFlush: (callback) => ipcRenderer.on("aim:performance:flush", () => {
      Promise.resolve().then(callback).finally(() => ipcRenderer.send("aim:performance:flushed")).catch(() => {});
    }),
  },
  restart: () => ipcRenderer.send("aim:shell:restart"),
});

const shellInfo = ipcRenderer.sendSync("aim:shell:info");

webFrame.executeJavaScript(`(() => {
  const request = function () { window.__aimDesktop.fullscreen(); return Promise.resolve(); };
  Element.prototype.requestFullscreen = request;
  if (Element.prototype.webkitRequestFullscreen) Element.prototype.webkitRequestFullscreen = request;

  // The game shows its desktop-only video settings (Frame mode: Unlimited, FPS cap,
  // VSync) when it finds its desktop shell as window.aimDesktop. A plain page object,
  // so vsyncSaved can follow the toggle until the restart.
  const info = ${JSON.stringify(shellInfo)};
  window.aimDesktop = {
    shell: "electron",
    version: info.version,
    vsync: info.vsync,
    vsyncSaved: info.vsyncSaved,
    displays: info.displays,
    setVsync(on) { this.vsyncSaved = on === true; window.__aimDesktop.setVsync(on === true); },
    restart() { window.__aimDesktop.restart(); },
    pageReady() {},
    pointerLock() {},
  };
})()`);
