(function () {
  var plan = null;
  var timer = 0;
  var tracked = [];
  var syncFrame = 0;

  function shuffle(values) {
    for (var index = values.length - 1; index > 0; index -= 1) {
      var swap = Math.floor(Math.random() * (index + 1));
      var value = values[index];
      values[index] = values[swap];
      values[swap] = value;
    }
    return values;
  }

  function candidates() {
    return Array.from(document.querySelectorAll('.al-wk-sec[data-section]')).map(function (section) {
      var grids = section.querySelectorAll('.al-wk-pages > .al-wk-grid');
      var grid = grids[0];
      var cards = grid ? grid.querySelectorAll(':scope > .al-wk-card:not(.al-wk-ad-card)') : [];
      return grid && cards.length >= 3
        ? { key: section.dataset.section, count: cards.length, capacity: cards.length }
        : null;
    }).filter(Boolean);
  }

  function makePlan(options) {
    var selected = shuffle(options.slice()).slice(0, Math.min(4, options.length));
    return selected.map(function (item) {
      return {
        key: item.key,
        after: 1 + Math.floor(Math.random() * Math.max(1, item.count - 2)),
        capacity: item.capacity
      };
    });
  }

  function rebalance(grids, capacity) {
    for (var index = 0; index < grids.length - 1; index += 1) {
      while (grids[index].children.length > capacity) {
        var cards = grids[index].querySelectorAll(':scope > .al-wk-card:not(.al-wk-ad-card)');
        var card = cards[cards.length - 1];
        if (!card) break;
        grids[index + 1].prepend(card);
      }
    }
  }

  function removeAdCards() {
    document.querySelectorAll('.al-wk-ad-card').forEach(function (card) {
      var section = card.closest('.al-wk-sec[data-section]');
      var placement = plan && plan.find(function (item) { return section && item.key === section.dataset.section; });
      var grids = section ? section.querySelectorAll('.al-wk-pages > .al-wk-grid') : [];
      card.remove();
      if (placement) {
        for (var index = 0; index < grids.length - 1; index += 1) {
          while (grids[index].children.length < placement.capacity) {
            var next = grids[index + 1].querySelector(':scope > .al-wk-card:not(.al-wk-ad-card)');
            if (!next) break;
            grids[index].append(next);
          }
        }
      }
    });
    tracked.forEach(function (item) { item.unit.style.cssText = ''; delete item.unit.dataset.mapAdUsed; });
    tracked = [];
  }

  function createCard() {
    var unit = document.querySelector('body > iframe.map-ad-unit:not([data-map-ad-used])');
    if (!unit) return null;
    unit.dataset.mapAdUsed = 'true';
    var card = document.createElement('article');
    card.className = 'al-wk-card al-wk-ad-card';
    card.setAttribute('aria-label', 'Quảng cáo');
    var label = document.createElement('span');
    label.className = 'al-wk-ad-card-label';
    label.textContent = 'Quảng cáo';
    var anchor = document.createElement('span');
    anchor.className = 'map-ad-anchor';
    anchor.setAttribute('aria-hidden', 'true');
    card.append(label, anchor);
    return { card: card, anchor: anchor, unit: unit };
  }

  function syncUnits() {
    syncFrame = 0;
    if (document.documentElement.classList.contains('aim-gameplay-active')) {
      document.querySelectorAll('body > iframe.map-ad-unit').forEach(function (unit) {
        if (unit.style.visibility !== 'hidden') unit.style.visibility = 'hidden';
        if (unit.style.pointerEvents !== 'none') unit.style.pointerEvents = 'none';
      });
      return;
    }
    var resultAnchor = document.querySelector('.aim-result-ad .map-ad-anchor');
    var resultUnit = document.querySelector('body > iframe.map-ad-unit');
    if (resultAnchor && resultUnit) {
      applyPosition(positionUnit(resultUnit, resultAnchor));
      return;
    }
    var positions = [];
    tracked = tracked.filter(function (item) {
      if (!item.card.isConnected) {
        item.unit.style.cssText = '';
        delete item.unit.dataset.mapAdUsed;
        return false;
      }
      positions.push(positionUnit(item.unit, item.anchor));
      return true;
    });
    // Read every anchor before writing iframe styles. Alternating them forces
    // layout once per advertisement during scroll and result transitions.
    positions.forEach(applyPosition);
  }

  function positionUnit(unit, anchor) {
    var bounds = anchor.getBoundingClientRect();
    var scale = bounds.width > 0 ? bounds.width / 160 : 1;
    var visible = bounds.top >= 0 && bounds.left >= 0 &&
      bounds.bottom <= window.innerHeight && bounds.right <= window.innerWidth;
    return {unit:unit,style:{
      position: 'fixed',
      left: bounds.left + 'px',
      top: bounds.top + 'px',
      zIndex: '2147482000',
      visibility: visible ? 'visible' : 'hidden',
      pointerEvents: visible ? 'auto' : 'none',
      transform: 'scale(' + scale + ')',
      transformOrigin: 'top left'
    }};
  }

  function applyPosition(position) {
    Object.keys(position.style).forEach(function (key) {
      if (position.unit.style[key] !== position.style[key]) position.unit.style[key] = position.style[key];
    });
  }

  function scheduleSync() {
    if (!syncFrame) syncFrame = window.requestAnimationFrame(syncUnits);
  }

  function render() {
    scheduleSync();
    if (document.documentElement.classList.contains('aim-gameplay-active')) { removeAdCards(); return; }
    if (document.documentElement.classList.contains('account-ad-free')) { removeAdCards(); return; }
    if (!document.querySelector('.al-wk-card')) return;
    if (!plan) plan = makePlan(candidates());
    plan.forEach(function (placement) {
      var section = Array.from(document.querySelectorAll('.al-wk-sec[data-section]')).find(function (node) {
        return node.dataset.section === placement.key;
      });
      if (!section || section.querySelector('.al-wk-ad-card')) return;
      var grids = section.querySelectorAll('.al-wk-pages > .al-wk-grid');
      var grid = grids[0];
      if (!grid) return;
      var cards = grid.querySelectorAll(':scope > .al-wk-card:not(.al-wk-ad-card)');
      var anchor = cards[Math.min(placement.after, cards.length - 1)];
      var placementCard = createCard();
      if (anchor && placementCard) {
        anchor.after(placementCard.card);
        tracked.push(placementCard);
        rebalance(grids, placement.capacity);
        scheduleSync();
      }
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(render, 120);
  }

  window.AimDom.watch(document.getElementById('app'), '.al-wk-card,.al-wk-sec', schedule);
  window.addEventListener('resize', scheduleSync);
  window.addEventListener('scroll', scheduleSync, true);
  window.addEventListener('aim-account-ready', schedule);
  window.addEventListener('aim-ad-unit-ready', schedule);
  window.addEventListener('aim-gameplay-state', schedule);
  window.addEventListener('aim-ad-layout', scheduleSync);
  schedule();
}());
