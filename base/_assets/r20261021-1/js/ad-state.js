(function () {
  var root = document.documentElement;
  var previousActive = null;
  var previousFinished = null;
  var previousOpen = null;
  function hasFinishedRound() {
    return Boolean(document.querySelector(
      '[data-role="moment-result"], [data-role="moment-finale"], .al-result-overlay, .al-blind-result-overlay, .al-cloud-ranked-result'
    ));
  }

  function sync() {
    var session = document.querySelector('.al-trainer-shell.al-session-active');
    var open = Boolean(document.querySelector('.al-trainer-shell'));
    var active = Boolean(session) && !hasFinishedRound();
    var finished = Boolean(session) && !active;
    if (active === previousActive && finished === previousFinished && open === previousOpen) return;
    previousActive = active;
    previousFinished = finished;
    previousOpen = open;
    root.classList.toggle('aim-trainer-open', open);
    root.classList.toggle('aim-gameplay-active', active);
    root.classList.toggle('aim-round-finished', finished);
    window.dispatchEvent(new CustomEvent('aim-gameplay-state', { detail: { active: active } }));
  }

  function schedule() {
    sync();
  }

  // The trainer is teleported outside #app; observe its actual body host.
  window.AimDom.watch(document.body,
    '.al-trainer-shell,[data-role="moment-result"],[data-role="moment-finale"],.al-result-overlay,.al-blind-result-overlay,.al-cloud-ranked-result', schedule, {
    inside: false,
    attributes: true,
    attributeFilter: ['class', 'data-role']
  });
  document.addEventListener('pointerlockchange', schedule);
  window.addEventListener('popstate', schedule);
  sync();
}());
