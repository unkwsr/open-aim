/* Read-only conversion of VALORANT's local settings. No game files are modified. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.aimValorantImport = factory();
})(globalThis, function () {
  "use strict";
  const names = ["riotusersettings.ini", "gameusersettings.ini", "backupkeybinds.json"];
  const keys = { display: "al-display-settings-v1", audio: "al-audio-settings-v1", sensitivity: "al-sensitivity-v1", crosshair: "al-crosshair-v1", bindings: "al-keybinds-v1" };
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function ini(text) {
    const values = Object.create(null);
    let section = "";
    for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const s = line.trim();
      if (!s || /^[;#]/.test(s)) continue;
      if (s.startsWith("[") && s.endsWith("]")) { section = s.slice(1, -1); continue; }
      const i = s.indexOf("=");
      if (i > 0) values[section + ":" + s.slice(0, i).trim()] = s.slice(i + 1).trim();
    }
    return values;
  }
  function decoded(s) {
    if (typeof s !== "string") return null;
    let value = JSON.parse(s);
    if (typeof value === "string") value = JSON.parse(value);
    return value;
  }
  function crosshair(profile) {
    if (!profile || !profile.primary || typeof profile.primary !== "object" || Array.isArray(profile.primary)) throw new Error("Missing primary crosshair.");
    const code = ["0"];
    const put = (key, value, min = 0, max = 40) => {
      if (typeof value === "boolean") code.push(key, value ? "1" : "0");
      else if (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max) code.push(key, String(+value.toFixed(3)));
    };
    const color = (c, custom, useCustom, hexKey) => {
      const rgb = useCustom ? custom : c;
      if (!rgb || ![rgb.r, rgb.g, rgb.b].every(v => Number.isInteger(v) && v >= 0 && v <= 255)) return;
      code.push("c", "8", "b", "1", hexKey, [rgb.r, rgb.g, rgb.b].map(v => v.toString(16).padStart(2, "0")).join("") + "ff");
    };
    put("p", profile.bUsePrimaryCrosshairForADS);
    put("c", profile.bUseCustomCrosshairOnAllPrimary);
    put("s", profile.bUseAdvancedOptions);
    for (const [tag, p] of [["P", profile.primary], ["A", profile.aDS]]) {
      if (!p || typeof p !== "object") continue;
      code.push(tag);
      color(p.color, p.colorCustom, p.bUseCustomColor, "u");
      for (const [k, field, max] of [["h", "bHasOutline"], ["t", "outlineThickness", 6], ["o", "outlineOpacity", 1], ["d", "bDisplayCenterDot"], ["z", "centerDotSize", 6], ["a", "centerDotOpacity", 1], ["m", "bFixMinErrorAcrossWeapons"]]) put(k, p[field], 0, max);
      if (tag === "P") { put("f", p.bFadeCrosshairWithFiringError); put("s", p.bShowSpectatedPlayerCrosshair); }
      for (const [prefix, lines] of [["0", p.innerLines], ["1", p.outerLines]]) {
        if (!lines || typeof lines !== "object") continue;
        for (const [k, field, max] of [["b", "bShowLines"], ["t", "lineThickness", 10], ["l", "lineLength", prefix === "0" ? 20 : 10], ["v", "lineLengthVertical", prefix === "0" ? 20 : 10], ["g", "bAllowVertScaling"], ["o", "lineOffset", prefix === "0" ? 20 : 40], ["a", "opacity", 1], ["m", "bShowMovementError"], ["f", "bShowShootingError"], ["s", "movementErrorScale", 3], ["e", "firingErrorScale", 3]]) put(prefix + k, lines[field], 0, max);
      }
    }
    const sniper = profile.sniper;
    if (sniper && typeof sniper === "object") {
      code.push("S");
      color(sniper.centerDotColor, sniper.centerDotColorCustom, sniper.bUseCustomCenterDotColor, "t");
      put("d", sniper.bDisplayCenterDot); put("s", sniper.centerDotSize, 0, 4); put("o", sniper.centerDotOpacity, 0, 1);
    }
    return code.join(";");
  }
  const actions = { Forward: "moveForward", Backward: "moveBack", Left: "moveLeft", Right: "moveRight", Jump: "jump", Crouch: "crouch", Walk: "walk", Use: "use", Fire: "fire", AltFire: "ads", Reload: "reload", EquipPrimary: "equipPrimary", EquipMelee: "equipMelee", Inspect: "inspect", ShowMap: "bigMap", BuyMenu: "buyMenu" };
  const keyNames = { None: null, LeftMouseButton: "Mouse0", MiddleMouseButton: "Mouse1", RightMouseButton: "Mouse2", ThumbMouseButton: "Mouse3", ThumbMouseButton2: "Mouse4", MouseScrollUp: "WheelUp", MouseScrollDown: "WheelDown", SpaceBar: "Space", LeftControl: "ControlLeft", RightControl: "ControlRight", LeftShift: "ShiftLeft", RightShift: "ShiftRight", LeftAlt: "AltLeft", RightAlt: "AltRight", Up: "ArrowUp", Down: "ArrowDown", Left: "ArrowLeft", Right: "ArrowRight", Apostrophe: "Quote", Tilde: "Backquote", CapsLock: "CapsLock", Enter: "Enter", Tab: "Tab", BackSpace: "Backspace", Hyphen: "Minus", Equals: "Equal", LeftBracket: "BracketLeft", RightBracket: "BracketRight", Backslash: "Backslash", Semicolon: "Semicolon", Comma: "Comma", Period: "Period", Slash: "Slash", Zero: "Digit0", One: "Digit1", Two: "Digit2", Three: "Digit3", Four: "Digit4", Five: "Digit5", Six: "Digit6", Seven: "Digit7", Eight: "Digit8", Nine: "Digit9" };
  function keyCode(k) { return own(keyNames, k) ? keyNames[k] : /^[A-Z]$/.test(k) ? "Key" + k : undefined; }
  function parse(files) {
    if (!Array.isArray(files) || files.length > 3) throw new Error("Select up to three settings files from one account.");
    const seen = new Set(), changes = [], warnings = [], profiles = [];
    let unhandled = 0;
    const add = (group, field, value, label) => changes.push({ group, field, value, label });
    for (const file of files) {
      const name = String(file.name).toLowerCase();
      if (!names.includes(name)) throw new Error("Select RiotUserSettings.ini, GameUserSettings.ini or BackupKeybinds.json.");
      if (seen.has(name)) throw new Error("Choose only one copy of each file, from the same account.");
      seen.add(name);
      if (typeof file.text !== "string" || file.text.length > 2 * 1024 * 1024) throw new Error("Settings file exceeds 2 MB.");
      if (name === "backupkeybinds.json") {
        const data = JSON.parse(file.text.replace(/^\uFEFF/, ""));
        if (!Array.isArray(data.actionMappings)) throw new Error("Invalid key bindings file.");
        for (const b of data.actionMappings) {
          if (!b || typeof b !== "object") { unhandled++; continue; }
          const action = own(actions, b.name) ? actions[b.name] : null;
          const value = typeof b.key === "string" ? keyCode(b.key) : undefined;
          if (!action || value === undefined || (b.characterName && b.characterName !== "None") || b.shift || b.ctrl || b.alt || b.cmd || (b.tapHoldType && b.tapHoldType !== "None") || ![0, 1].includes(b.bindIndex)) { unhandled++; continue; }
          add("bindings", action + ":" + b.bindIndex, value, "Key: " + action + " (" + (b.bindIndex + 1) + ")");
        }
        unhandled += Array.isArray(data.axisMappings) ? data.axisMappings.length : 0;
        warnings.push("Bindings files may contain only overrides. Agent-specific bindings, modifier combinations and unsupported actions are skipped.");
        continue;
      }
      const values = ini(file.text), consumed = new Set();
      const read = key => { if (own(values, key)) { consumed.add(key); return values[key]; } };
      const setting = key => {
        for (const type of ["Float", "Bool", "Int", "String"]) {
          const value = read("Settings:EAres" + type + "SettingName::" + key);
          if (value !== undefined) return value;
        }
      };
      const number = (source, group, field, label, min, max, transform = v => v) => {
        if (source === undefined) return;
        const v = Number(source);
        const converted = transform(v);
        if (source.trim() && Number.isFinite(v) && v >= min && v <= max && converted !== undefined) add(group, field, converted, label);
        else warnings.push(label + ": unsupported value; kept trainer setting.");
      };
      const bool = (source, group, field, label, transform = v => v) => {
        if (source === undefined) return;
        if (/^(true|false)$/i.test(source)) add(group, field, transform(source.toLowerCase() === "true"), label);
        else warnings.push(label + ": invalid boolean; kept trainer setting.");
      };
      if (name === "riotusersettings.ini") {
        number(setting("MouseSensitivity"), "sensitivity", "value", "Mouse sensitivity", .001, 10);
        number(setting("MouseSensitivityADS"), "display", "adsSensitivity", "ADS sensitivity", .01, 10, v => +v.toFixed(3));
        number(setting("MouseSensitivityZoomed"), "display", "scopedSensitivity", "Scoped sensitivity", .01, 10, v => +v.toFixed(3));
        number(setting("OverallVolume"), "audio", "volume", "Master volume", 0, 1);
        bool(setting("LeftHanded"), "display", "viewModelHand", "Weapon hand", v => v ? "left" : "right");
        bool(setting("InvertMouse"), "display", "invertMouseY", "Invert mouse Y");
        bool(setting("DefaultToWalk"), "display", "defaultToWalk", "Default movement: walk");
        bool(setting("MinimapRotates"), "display", "minimapRotates", "Rotate minimap");
        bool(setting("ShowBulletTracers"), "display", "tracers", "Bullet tracers");
        const colors = ["#ff1b00", "#ff00e7", "#ffec03", "#ffec03"];
        number(setting("ColorBlindMode"), "display", "enemyHighlightColor", "Enemy highlight color", 0, 3, v => colors[v]);
        const raw = setting("SavedCrosshairProfileData");
        if (raw !== undefined) {
          try {
            const data = decoded(raw);
            if (!Array.isArray(data?.profiles) || !Number.isInteger(data.currentProfile) || !data.profiles[data.currentProfile]) throw new Error();
            for (let i = 0; i < Math.min(data.profiles.length, 100); i++) {
              const p = data.profiles[i];
              try { profiles.push({ name: String(p.profileName || "Profile " + (i + 1)).slice(0, 100), code: crosshair(p), selected: i === data.currentProfile }); } catch { warnings.push("Skipped an invalid crosshair profile."); }
            }
          } catch { warnings.push("Crosshair profiles could not be read; kept trainer crosshair."); }
        }
        warnings.push("Only saved values are imported. Missing values keep your trainer settings. Minimap scale, blood, corpses, agent abilities, voice/chat, skins and graphics options without an exact trainer equivalent are not imported.");
        warnings.push("The trainer supports primary, ADS and sniper crosshairs. Focus-mode, spectator-only and resolution-scaling behavior are not reproduced.");
      } else {
        const section = "/Script/ShooterGame.ShooterGameUserSettings:";
        bool(read(section + "bUseVSync"), "shell", "vsync", "VSync (requires app restart)");
        bool(read(section + "bShouldLetterbox"), "display", "aspectMethod", "Aspect ratio method", v => v ? "letterbox" : "fill");
        const x = read(section + "ResolutionSizeX"), y = read(section + "ResolutionSizeY");
        if (x !== undefined && y !== undefined) {
          const w = Number(x), h = Number(y);
          if (Number.isInteger(w) && Number.isInteger(h) && w >= 640 && w <= 7680 && h >= 480 && h <= 4320 && w / h >= 1 && w / h <= 4) add("display", "resolution", w + "x" + h, "Render resolution");
          else warnings.push("Resolution is outside the trainer's supported range.");
        }
        // FrameRateLimit may be stale when VALORANT's separate limit switches are used.
        warnings.push("Monitor selection, window mode, graphics quality and FPS caps are kept as configured in the trainer; VALORANT uses different rendering and limiter controls.");
      }
      unhandled += Object.keys(values).filter(k => !consumed.has(k)).length;
    }
    return { changes, profiles, warnings, unhandled };
  }
  return { parse, crosshair, keys };
});
