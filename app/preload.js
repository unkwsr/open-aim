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
  },
});

webFrame.executeJavaScript(`(() => {
  const request = function () { window.__aimDesktop.fullscreen(); return Promise.resolve(); };
  Element.prototype.requestFullscreen = request;
  if (Element.prototype.webkitRequestFullscreen) Element.prototype.webkitRequestFullscreen = request;
})()`);
