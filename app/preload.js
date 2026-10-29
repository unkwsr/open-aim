// The game asks for browser (HTML) fullscreen whenever a map starts, and Chromium
// always leaves that mode on Esc. Turn those requests into window fullscreen
// instead, which only F11 toggles, so Esc can be used in-game without dropping
// out of fullscreen.
const { contextBridge, ipcRenderer, webFrame } = require("electron");

contextBridge.exposeInMainWorld("__aimDesktop", {
  fullscreen: () => ipcRenderer.send("aim:fullscreen"),
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
  },
  // Desktop frame settings (window.aimDesktop below); see main.js.
  setVsync: (on) => ipcRenderer.send("aim:shell:vsync", on === true),
  // Slow-frame report for the round that just ended (frame-log.js).
  frameLog: (report) => ipcRenderer.send("aim:frame-log", report),
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
