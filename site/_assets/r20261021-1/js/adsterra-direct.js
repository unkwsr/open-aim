(function () {
  var units = {
    '728x90': { key: '93ade2096f3ecb46e3dc113bc5a040c3', width: 728, height: 90 },
    '320x50': { key: 'a6388c966443bee705c36b8bc373ab22', width: 320, height: 50 },
    '160x300': { key: '893ac009148c7931a933e3f4de099337', width: 160, height: 300 }
  };
  var started = false;

  function loadUnit(unit, className, done) {
    window.atOptions = {
      key: unit.key,
      format: 'iframe',
      height: unit.height,
      width: unit.width,
      params: {}
    };
    var existingFrames = new Set(document.querySelectorAll('body > iframe'));
    var vendor = document.createElement('script');
    vendor.src = 'https://bauval.org/22/' + unit.key;
    vendor.referrerPolicy = 'strict-origin-when-cross-origin';
    vendor.onload = function () {
      var attempts = 0;
      function attachFrame() {
      var frame = Array.from(document.querySelectorAll('body > iframe')).find(function (candidate) {
        return !existingFrames.has(candidate) && Number(candidate.width) === unit.width && Number(candidate.height) === unit.height;
      });
      if (frame) {
        frame.classList.add(className);
        frame.dataset.adSize = unit.width + 'x' + unit.height;
        frame.title = 'Quảng cáo';
        if (className === 'aim-ad-direct-banner') document.querySelector('.aim-ad-dock')?.classList.add('is-ready');
        window.dispatchEvent(new Event('aim-ad-unit-ready'));
        done();
        return;
      }
      attempts += 1;
      if (attempts < 20) window.setTimeout(attachFrame, 100);
      else done();
      }
      attachFrame();
    };
    vendor.onerror = done;
    document.body.appendChild(vendor);
  }

  function start() {
    if (started || document.documentElement.classList.contains('account-ad-free')) return;
    started = true;
    var banner = units[window.matchMedia('(max-width: 650px)').matches ? '320x50' : '728x90'];
    var queue = [[banner, 'aim-ad-direct-banner']];
    // Keep the approved compact creative available for the trainer overlay.
    // CSS switches existing frames, so pausing never reloads an advertisement.
    if (banner.width > 320) queue.push([units['320x50'], 'aim-ad-direct-banner']);
    for (var index = 0; index < 4; index += 1) queue.push([units['160x300'], 'map-ad-unit']);
    function next() {
      var item = queue.shift();
      if (item) loadUnit(item[0], item[1], next);
    }
    next();
  }

  window.addEventListener('aim-account-ready', start, { once: true });
  if (document.documentElement.classList.contains('ads-ready')) start();
}());
