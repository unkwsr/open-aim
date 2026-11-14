(() => {
  let sortMode = 'default';
  let scheduled = false;

  const language = () => document.documentElement.lang === 'en'
    ? { easy: 'Easy', medium: 'Medium', hard: 'Hard', difficulty: 'Difficulty', easyFirst: 'Easy → Hard', hardFirst: 'Hard → Easy', sortLabel: 'Sort by difficulty' }
    : { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó', difficulty: 'Độ khó', easyFirst: 'Dễ → Khó', hardFirst: 'Khó → Dễ', sortLabel: 'Sắp xếp theo độ khó' };

  const makeMeter = (level, label) => {
    const badge = document.createElement('span');
    badge.className = `aim-vt-card-difficulty is-l${level}`;
    badge.dataset.aimDifficulty = level;
    for (let index = 1; index <= 3; index += 1) {
      const segment = document.createElement('i');
      if (index <= level) segment.className = 'is-on';
      segment.setAttribute('aria-hidden', 'true');
      badge.append(segment);
    }
    const text = document.createElement('span');
    text.textContent = label;
    badge.append(text);
    badge.setAttribute('aria-label', `${language().difficulty}: ${label}`);
    return badge;
  };

  const difficulty = (card) => {
    // The Performance face replaces .al-wk-body entirely. Read the map's
    // reactive metadata, not whether the front-face label happens to exist.
    const level = Number(card.dataset.mapDifficulty);
    if ([1, 2, 3].includes(level)) {
      const text = language();
      return { level, label: [text.easy, text.medium, text.hard][level - 1] };
    }
    const source = card.querySelector('.al-wk-body > .al-wk-diff');
    if (source?.classList.contains('is-l1')) return { level: 1, label: source.textContent.trim() };
    if (source?.classList.contains('is-l3')) return { level: 3, label: source.textContent.trim() };
    if (source?.classList.contains('is-l2')) return { level: 2, label: source.textContent.trim() };
    return { level: 2, label: language().medium };
  };

  const decorateCards = () => {
    document.querySelectorAll('.al-wk-card:not(.al-wk-ad-card)').forEach((card) => {
      const value = difficulty(card);
      let badge = card.querySelector(':scope > .aim-vt-card-difficulty');
      if (!badge || badge.dataset.aimDifficulty !== String(value.level)) {
        badge?.remove();
        badge = makeMeter(value.level, value.label);
        card.append(badge);
      } else if (badge.querySelector('span')?.textContent !== value.label) {
        badge.querySelector('span').textContent = value.label;
        badge.setAttribute('aria-label', `${language().difficulty}: ${value.label}`);
      }
      if (card.dataset.aimDifficulty !== String(value.level)) card.dataset.aimDifficulty = String(value.level);
    });
  };

  const resetOrders = () => document.querySelectorAll('.al-wk-card').forEach(card => { if (card.style.order) card.style.removeProperty('order'); });

  const applySort = () => {
    if (sortMode === 'default') { resetOrders(); return; }
    const direction = sortMode === 'easy-first' ? 1 : -1;
    const parents = new Set([...document.querySelectorAll('.al-wk-card')].map(card => card.parentElement).filter(Boolean));
    for (const parent of parents) {
      const items = [...parent.children].filter(item => item.classList?.contains('al-wk-card'));
      const maps = items.filter(item => !item.classList.contains('al-wk-ad-card'));
      const sortedMaps = maps.slice().sort((left, right) => direction * (Number(left.dataset.aimDifficulty || 2) - Number(right.dataset.aimDifficulty || 2)));
      let mapIndex = 0;
      items.forEach((item, index) => {
        const placed = item.classList.contains('al-wk-ad-card') ? item : sortedMaps[mapIndex++];
        if (placed.style.order !== String(index)) placed.style.order = String(index);
      });
    }
  };

  const makeSortButton = (mode, text) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'aim-vt-difficulty-sort';
    button.dataset.aimDifficultySort = mode;
    button.textContent = text;
    button.addEventListener('click', () => {
      sortMode = mode;
      update();
    });
    return button;
  };

  const decorateSort = () => {
    const sort = document.querySelector('.al-wk-tools .al-wk-sort');
    if (!sort) return;
    const text = language();
    if (sort.getAttribute('aria-label') !== text.sortLabel) sort.setAttribute('aria-label', text.sortLabel);
    let easy = sort.querySelector('[data-aim-difficulty-sort="easy-first"]');
    let hard = sort.querySelector('[data-aim-difficulty-sort="hard-first"]');
    if (!easy) { easy = makeSortButton('easy-first', text.easyFirst); sort.append(easy); }
    if (!hard) { hard = makeSortButton('hard-first', text.hardFirst); sort.append(hard); }
    if (easy.textContent !== text.easyFirst) easy.textContent = text.easyFirst;
    if (hard.textContent !== text.hardFirst) hard.textContent = text.hardFirst;
    [easy, hard].forEach(button => {
      const active = button.dataset.aimDifficultySort === sortMode;
      if (button.classList.contains('is-on') !== active) button.classList.toggle('is-on', active);
      if (button.getAttribute('aria-pressed') !== String(active)) button.setAttribute('aria-pressed', String(active));
    });
  };

  const update = () => {
    if (document.body.classList.contains('al-training-active')) return;
    document.querySelector('.aim-vt-difficulty-filter')?.remove();
    decorateCards();
    decorateSort();
    applySort();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; update(); });
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('.al-wk-tools .al-wk-sort [data-sort]')) {
      sortMode = 'default';
      schedule();
    }
  }, true);
  // Gameplay is teleported outside #app; only hall changes can affect its cards.
  const hall = document.getElementById('app');
  if (hall) window.AimDom.watch(hall, '.al-wk-card,.al-wk-tools', schedule);
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  schedule();
})();
