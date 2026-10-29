// Lobby side of the Studio (studio/). Play in the Studio opens /aim#studio-play=<code>:
// this finds that drill's card in VALORANT Training and starts it. Leaving that
// session returns directly to the Studio drill library.
(() => {
  if (window.__aimStudioLaunch) return;
  window.__aimStudioLaunch = true;
  const KEY = "studio-return";
  let creatorLaunch = false;
  let enteredSession = false;
  let returning = false;
  // Set while recording a copycat's run (#studio-record=<code>): the game keeps your
  // movement in globalThis.__aimStudioTake, which goes back to the Studio as "studio-take".
  let recordingCode = null;
  // Called by the native drill exit before it reveals the main lobby.
  window.__aimReturnToStudio = () => {
    if (!creatorLaunch) return false;
    if (!returning) {
      returning = true;
      try { sessionStorage.removeItem(KEY); } catch {}
      if (recordingCode) keepTake();
      location.assign('/studio/');
    }
    return true;
  };
  function keepTake() {
    const take = globalThis.__aimStudioTake;
    if (!take || take.scene !== `studio-${recordingCode}`) return;
    try { sessionStorage.setItem("studio-take", JSON.stringify({ dt: take.dt, last: take.last, ticks: take.ticks.slice(0, take.last + 1) })); } catch {}
  }

  function check() {
    const params = new URLSearchParams(location.hash.slice(1));
    const record = params.get("studio-record");
    const code = record || params.get("studio-play");
    if (!code) return;
    creatorLaunch = true;
    enteredSession = false;
    recordingCode = record;
    delete globalThis.__aimStudioTake;
    history.replaceState(null, "", location.pathname + location.search);
    // A recording has no "Back to Studio" pill; leaving it always returns.
    if (!record) try { sessionStorage.setItem(KEY, code); } catch {}
    start(code);
  }
  check();
  addEventListener("hashchange", check);

  async function start(code) {
    const until = Date.now() + 15000;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // The first top tab is VALORANT Training.
    while (Date.now() < until && !document.querySelector(".hall-tab")) await wait(100);
    const tab = document.querySelector(".hall-tab");
    if (tab && !tab.classList.contains("is-active")) tab.click();
    while (Date.now() < until) {
      const card = document.querySelector(`[data-role="workshop-card"][data-share-code="${code}"]`);
      // The card's own "Start training" button (shown once the card is in view).
      const go = card && card.querySelector(".al-wk-split-go, .al-wk-go");
      if (card) card.scrollIntoView({ block: "center" });
      if (go) {
        go.click();
        return;
      }
      await wait(150);
    }
  }

  // "Back to Studio" pill, shown in the lobby (not during a round) after playing a drill from the Studio.
  let pill = null;
  function sync() {
    let back = null;
    try { back = sessionStorage.getItem(KEY); } catch {}
    // A round (and its start screen and results) is shown in .al-aimlab-root over the lobby.
    const inSession = !!document.querySelector(".al-aimlab-root");
    if (creatorLaunch && inSession) enteredSession = true;
    const inLobby = !!document.querySelector(".hall-topnav") && !inSession && !document.pointerLockElement;
    // Do not return during initial loading, or because a stale return code was
    // left by an earlier visit. Only a session launched here can arm this exit.
    if (creatorLaunch && enteredSession && inLobby && !returning) {
      window.__aimReturnToStudio();
      return;
    }
    if (back && inLobby) {
      if (!pill) {
        pill = document.createElement("button");
        pill.type = "button";
        pill.className = "es-studio-back";
        pill.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg><span>Back to Studio</span>';
        pill.addEventListener("click", () => {
          const c = sessionStorage.getItem(KEY);
          sessionStorage.removeItem(KEY);
          location.assign(`/studio/#edit=${c}`);
        });
        document.body.appendChild(pill);
      }
    } else if (pill) {
      pill.remove();
      pill = null;
    }
  }
  setInterval(sync, 500);
})();
