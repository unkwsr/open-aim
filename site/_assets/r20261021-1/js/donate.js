(function () {
  'use strict';
  var card = document.querySelector('.aim-donate');
  if (!card) return;
  var narrow = window.matchMedia('(max-width: 1080px)');
  var previousMode = null;

  function mount() {
    var destination = document.querySelector(narrow.matches ? '.hall-bottombar' : '.hall-rail');
    if (!destination) return;
    if (previousMode !== narrow.matches) {
      card.open = !narrow.matches;
      previousMode = narrow.matches;
    }
    if (narrow.matches) {
      if (card.parentElement !== destination) destination.prepend(card);
    } else {
      if (card.parentElement !== destination || destination.lastElementChild !== card) destination.append(card);
    }
  }

  mount();
  window.AimDom.watch(document.querySelector('#app') || document.body, '.hall-rail,.hall-bottombar', mount);
  narrow.addEventListener('change', mount);
  document.addEventListener('click', function (event) {
    if (narrow.matches && card.open && !card.contains(event.target)) card.open = false;
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && narrow.matches && card.open) {
      card.open = false;
      card.querySelector('summary').focus();
    }
  });
}());
