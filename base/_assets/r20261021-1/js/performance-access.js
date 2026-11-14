(function () {
  'use strict';

  var accessButton = document.querySelector('.aim-performance-button');
  if (!accessButton) return;

  function originalButton() {
    return document.querySelector('.hall-topnav-right .hall-lat-btn');
  }

  function syncState() {
    var source = originalButton();
    if (!source) {
      var unavailable = !window.AimPerformanceDiagnostics;
      if (accessButton.disabled !== unavailable) accessButton.disabled = unavailable;
      accessButton.removeAttribute('data-state');
      accessButton.removeAttribute('data-count');
      return;
    }

    if (accessButton.disabled) accessButton.disabled = false;
    // Setting the same attribute still queues a MutationObserver notification.
    // The local controls live inside #app, so writes must be idempotent.
    var state = source.dataset.state || 'idle';
    if (accessButton.dataset.state !== state) accessButton.dataset.state = state;
    var count = source.querySelector('.hall-lat-count');
    if (count && count.textContent.trim()) {
      if (accessButton.dataset.count !== count.textContent.trim()) accessButton.dataset.count = count.textContent.trim();
    }
    else accessButton.removeAttribute('data-count');
    var open = source.classList.contains('is-open');
    if (accessButton.classList.contains('is-open') !== open) accessButton.classList.toggle('is-open', open);
  }

  accessButton.addEventListener('click', function (event) {
    if (window.AimPerformanceDiagnostics) { window.AimPerformanceDiagnostics.open(event); return; }
    var source = originalButton();
    if (source) source.click();
  });
  window.addEventListener?.('aim-diagnostics-ready', syncState);

  window.AimDom.watch(document.querySelector('#app') || document.body, '.hall-topnav-right .hall-lat-btn', syncState, {
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'data-state'],
  });
  syncState();
}());
