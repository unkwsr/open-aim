# Import VALORANT settings

Open **Settings → Import VALORANT settings**, or use the optional startup prompt.
The **Don't show this on startup again** checkbox hides only the startup prompt;
the Settings button remains available. Uncheck it in the importer to restore the
prompt on the next launch.

Close VALORANT, paste `%LOCALAPPDATA%\VALORANT\Saved\Config` into File Explorer,
and open your account folder. `RiotUserSettings.ini` is commonly in `Windows`,
while the video and bindings files are in `WindowsClient`. This is the settings
folder, not the game installation under `C:\Riot Games\VALORANT`. For multiple
accounts, check which files changed after saving your settings in VALORANT.
Add files in separate selections or drops when they are in different folders.
The preview combines the files; adding the same filename again replaces that file.
Use **Clear selected files** before switching accounts. Select or drag any available
files from the same account:

- `RiotUserSettings.ini`: sensitivity, ADS/scoped multipliers, volume, weapon hand,
  enemy highlight and supported general settings. Crosshair profiles can be
  selected in the preview; the active VALORANT profile is selected initially.
- `GameUserSettings.ini`: render resolution, letterboxing and VSync.
- `BackupKeybinds.json`: saved overrides for supported shared actions. Only
  explicit slots are changed; unbound slots are preserved as unbound.

Review the values, then choose **Apply and reload**. This ends the current drill.
VSync is saved for the next app restart. A normal trainer backup is created before
applying or undoing. **Undo last import** restores the previous imported settings;
full backups are also available from the existing Backups panel.

These files may contain only non-default values. Missing settings keep the current
trainer values; the importer does not guess VALORANT defaults. Agent profiles,
modifier chords, focus-mode crosshairs, minimap scale and settings without an exact
trainer equivalent are skipped. FPS caps, GPU/monitor selection and graphics
quality are retained because the games use different rendering and limiter
controls. The preview reports unsupported entries and limitations. This is a
settings importer, not an asset importer: skins, audio and game assets are not
copied. All processing is local and the selected files are read without changes.

For contributors: run `npm run test:import` in `app/`. The parser has no Electron
dependency. It accepts only the three filenames above (up to 2 MB each), parses
INI/JSON without executing data, and rejects duplicate filenames so settings from
two accounts are not silently combined.
