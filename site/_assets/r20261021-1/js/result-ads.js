(function () {
  var timer = 0;
  function removeCurrent() {
    var current = document.querySelector('.aim-result-ad');
    if (!current) return;
    current.remove();
    window.dispatchEvent(new Event('aim-ad-layout'));
  }

  function render() {
    if (document.documentElement.classList.contains('account-ad-free')) {
      removeCurrent();
      return;
    }
    var stage = document.querySelector('.al-mr-stage');
    var current = document.querySelector('.aim-result-ad');

    if (!stage) {
      removeCurrent();
      return;
    }
    if (current && current.parentElement === stage) return;
    if (current) current.remove();

    var ad = document.createElement('aside');
    ad.className = 'aim-result-ad';
    ad.setAttribute('aria-label', 'Quảng cáo sau khi kết thúc lượt chơi');

    var label = document.createElement('span');
    label.className = 'aim-ad-label';
    label.textContent = 'Quảng cáo';

    var anchor = document.createElement('span');
    anchor.className = 'map-ad-anchor';
    anchor.setAttribute('aria-hidden', 'true');
    ad.append(label, anchor);
    stage.append(ad);
    window.dispatchEvent(new Event('aim-ad-layout'));
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(render, 80);
  }

  window.AimDom.watch(document.body, '.al-mr-stage', schedule, {inside:false});
  window.addEventListener('aim-account-ready', schedule);
  schedule();
}());
