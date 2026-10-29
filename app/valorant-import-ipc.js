// File picker for the renderer importer; only selected settings files are read.
const { app, dialog, ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const NAMES = ["riotusersettings.ini", "gameusersettings.ini", "backupkeybinds.json"];
function register(getWindow, saveVsync) {
  function check(event) {
    const window = getWindow();
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error("Import is only available in the trainer window.");
  }
  ipcMain.handle("aim:valorant:choose", async event => {
    check(event);
    const selection = await dialog.showOpenDialog(getWindow(), {
      title: "Choose VALORANT settings from one account",
      defaultPath: path.join(process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local"), "VALORANT", "Saved", "Config"),
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "VALORANT settings", extensions: ["ini", "json"] }],
    });
    if (selection.canceled) return null;
    if (selection.filePaths.length > 3) throw new Error("Choose up to three settings files from one account.");
    const files = [];
    for (const file of selection.filePaths) {
      const name = path.basename(file);
      if (!NAMES.includes(name.toLowerCase())) throw new Error("Choose RiotUserSettings.ini, GameUserSettings.ini or BackupKeybinds.json.");
      const handle = await fs.open(file, "r");
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error("Settings files must be smaller than 2 MB.");
        files.push({ name, text: await handle.readFile("utf8") });
      } finally { await handle.close(); }
    }
    return files;
  });
  ipcMain.handle("aim:valorant:vsync", (event, on) => { check(event); if (typeof on !== "boolean") throw new Error("Invalid VSync value."); saveVsync(on); });
}
module.exports = { register };
