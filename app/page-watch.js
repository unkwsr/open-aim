// Page watchers for the injected UI scripts. Each script watches the page for the menus
// it adds rows and buttons to. While the mouse is locked in a round no menu can open,
// but the HUD (timer, score) changes the page constantly and woke every watcher, so all
// of them sleep while locked. On unlock (pause, results, lobby) each watcher runs once
// to catch up on what changed meanwhile.
(() => {
  if (window.__aimWatchPage) return;
  const watchers = [];
  const locked = () => !!document.pointerLockElement;

  window.__aimWatchPage = (callback, options) => {
    const observer = new MutationObserver(callback);
    watchers.push({ observer, callback, options });
    if (!locked()) observer.observe(document.documentElement, options);
    return observer;
  };

  document.addEventListener("pointerlockchange", () => {
    const sleep = locked();
    for (const w of watchers) {
      if (sleep) {
        w.observer.disconnect();
      } else {
        w.observer.observe(document.documentElement, w.options);
        w.callback([], w.observer);
      }
    }
  });
})();
