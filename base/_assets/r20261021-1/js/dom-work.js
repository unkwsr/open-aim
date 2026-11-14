(function () {
  'use strict';

  // Filter at the mutation boundary. HUD text/animations must not trigger a
  // fresh whole-document scan in every hall/account/advertising integration.
  function touches(records, selector, inside) {
    for (var record of records) {
      var target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
      if (record.type !== 'childList' || inside !== false) {
        if (target && (inside === false ? target.matches(selector) : target.closest(selector))) return true;
      }
      if (record.type !== 'childList') continue;
      for (var node of [...record.addedNodes, ...record.removedNodes]) {
        if (node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))) return true;
      }
    }
    return false;
  }

  function watch(root, selector, callback, options) {
    options = options || {};
    var observer = new MutationObserver(function (records) {
      if (touches(records, selector, options.inside)) callback(records);
    });
    var config = {childList:true,subtree:true};
    if (options.characterData) config.characterData = true;
    if (options.attributes) {
      config.attributes = true;
      if (options.attributeFilter) config.attributeFilter = options.attributeFilter;
    }
    observer.observe(root, config);
    return observer;
  }

  window.AimDom = Object.freeze({touches:touches,watch:watch});
}());
