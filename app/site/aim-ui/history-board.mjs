// Training History board. Replaces the records page's calendar, "This week", latest-run card,
// run table and task tiles with its own take on the same parts. The records component
// (ChJ6FlD4.js, RecordsOverview) computes the data with its own helpers and calls render()
// whenever it changes. Clicks go back to the component through `actions`, so the task drawer,
// delete dialog, play and paging work as before.
//
//   top:    latest run (wide) · this week as 7 day bars · month calendar
//   middle: run timeline, newest first, grouped by day
//   bottom: your tasks

const FEED_STEP = 10;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const fmt = n => Math.round(n).toLocaleString('en-US');
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const ICON = {
  play: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.2v9.6L10.5 6z"/></svg>',
  crown: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5l3.6 3 2.9-5 2.9 5 3.6-3-1.3 8H2.8z"/></svg>',
  trash: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1.5h4l.6 1.5H14v1.5H2V3h3.4zM3.5 5.5h9l-.7 9H4.2z"/></svg>',
  left: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2L3.5 6l4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  right: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

function chip(v) {
  if (!v) return '';
  if (v.kind === 'best') return `<span class="hx-chip is-best">${ICON.crown}Personal best</span>`;
  if (v.kind === 'first') return '<span class="hx-chip is-first">First run</span>';
  if (v.kind === 'dnf') return `<span class="hx-chip is-dnf" title="${esc(v.text)}">Unfinished</span>`;
  const arrow = v.kind === 'up' ? '▲ ' : v.kind === 'down' ? '▼ ' : '';
  return `<span class="hx-chip is-${esc(v.kind)}" title="${esc(v.title ?? v.text)}">${arrow}${esc(v.text ?? '')}</span>`;
}

// ---------------------------------------------------------------- top row

function latestCard(d) {
  const latest = d.latest;
  if (!latest) return '<section class="hx-card hx-latest is-empty"><span class="hx-kicker">Latest run</span><h2>Nothing played yet</h2></section>';
  const row = latest.row, tile = d.tiles.find(t => t.code === row.code), best = tile?.best ?? null;
  const isTime = (best?.unit ?? row.score.unit) === 'sec';
  const mine = num(row.score.value), top = num(best?.value);
  let gap = '', pct = null;
  if (mine !== null && top !== null && top > 0) {
    pct = Math.max(3, Math.min(100, isTime ? top / mine * 100 : mine / top * 100));
    const diff = isTime ? mine - top : top - mine;
    gap = row.verdict?.kind === 'best' ? 'This is your best' : diff > 0 ? `${isTime ? `${diff.toFixed(2)} s` : `${fmt(diff)} pts`} short of your best` : 'Level with your best';
  }
  const facts = (latest.facts ?? []).map(f => `<div><dt>${esc(f.label)}</dt><dd class="${f.died ? 'is-died' : ''}">${esc(f.value)}<small>${esc(f.unit)}</small></dd></div>`).join('');
  return `<section class="hx-card hx-latest ${row.verdict?.kind === 'best' ? 'is-best' : ''}">
    <span class="hx-kicker">Latest run · ${esc(latest.when)}</span>
    <div class="hx-latest-head">
      <div class="hx-latest-name"><h2>${esc(row.name)}</h2><p>${esc(row.sub)}</p></div>
      <div class="hx-latest-score"><b>${esc(row.score.value)}<small>${esc(row.score.unit || 'pts')}</small></b>${chip(row.verdict)}</div>
    </div>
    ${pct !== null ? `<div class="hx-vsbest"><div class="hx-vsbest-bar"><i style="width:${pct.toFixed(1)}%"></i></div><span>${esc(gap)}</span><span class="hx-vsbest-best">${ICON.crown}${esc(best.value)}${best.unit ? ` ${esc(best.unit)}` : ''}</span></div>` : ''}
    <dl class="hx-facts">${facts}</dl>
    <div class="hx-actions">
      <button type="button" class="hx-btn" data-run="${esc(row.id)}">Records for this task</button>
      ${latest.playable ? `<button type="button" class="hx-btn is-go" data-play="${esc(row.code)}">${ICON.play}<span>Play again</span></button>` : ''}
    </div>
  </section>`;
}

function weekCard(d) {
  if (!d.today) return '<section class="hx-card hx-week"><span class="hx-kicker">This week</span><p class="hx-none">Loading…</p></section>';
  const t = parseDay(d.today), monday = new Date(t); monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const days = WEEKDAYS.map((name, i) => {
    const day = new Date(monday); day.setDate(monday.getDate() + i);
    const key = dayKey(day), info = d.dayMap.get(key);
    return { name, key, runs: info?.runs ?? 0, pbs: info?.pbs ?? 0, today: key === d.today, future: key > d.today };
  });
  const max = Math.max(1, ...days.map(x => x.runs));
  const bars = days.map(x => `<div class="hx-wday ${x.today ? 'is-today' : ''} ${x.future ? 'is-future' : ''}" title="${esc(`${x.key}: ${plural(x.runs, 'run')}${x.pbs ? `, ${plural(x.pbs, 'personal best')}` : ''}`)}">
      <em>${x.runs || ''}</em><div class="hx-wbar"><i class="${x.pbs ? 'is-pb' : ''}" style="height:${x.runs ? Math.max(6, x.runs / max * 100) : 0}%"></i></div><span>${x.name[0]}</span></div>`).join('');
  const w = d.week ?? { runs: 0, pbs: 0, days: 0 };
  return `<section class="hx-card hx-week">
    <span class="hx-kicker">This week</span>
    <div class="hx-wbars">${bars}</div>
    <dl class="hx-wnums"><div><dt>Runs</dt><dd>${w.runs}</dd></div><div><dt>Personal bests</dt><dd class="hx-gold">${w.pbs}</dd></div><div><dt>Days trained</dt><dd>${w.days}<small>/7</small></dd></div></dl>
    <p class="hx-week-note">${d.latestPb ? `${ICON.crown}<span>Latest best: <b>${esc(d.latestPb.name)}</b> · ${esc(d.latestPb.when)} · ${esc(d.latestPb.value)}</span>` : '<span>No personal best this week yet</span>'}</p>
  </section>`;
}

function calendarCard(d, monthShift) {
  if (!d.today) return '<section class="hx-card hx-cal"></section>';
  const t = parseDay(d.today);
  const first = new Date(t.getFullYear(), t.getMonth() + monthShift, 1);
  const y = first.getFullYear(), m = first.getMonth();
  const lead = (first.getDay() + 6) % 7, count = new Date(y, m + 1, 0).getDate();
  let cells = '', monthRuns = 0;
  for (let i = 0; i < lead; i += 1) cells += '<i class="is-blank"></i>';
  for (let n = 1; n <= count; n += 1) {
    const key = `${y}-${pad(m + 1)}-${pad(n)}`, info = d.dayMap.get(key), runs = info?.runs ?? 0;
    monthRuns += runs;
    const lvl = runs <= 0 ? 0 : runs < 8 ? 1 : runs < 16 ? 2 : runs < 22 ? 3 : 4;
    cells += `<i class="l${lvl} ${info?.pbs ? 'is-pb' : ''} ${key === d.today ? 'is-today' : ''} ${key > d.today ? 'is-future' : ''}" title="${esc(`${m + 1}/${n}: ${plural(runs, 'run')}${info?.pbs ? `, ${plural(info.pbs, 'personal best')}` : ''}`)}"><b>${n}</b></i>`;
  }
  return `<section class="hx-card hx-cal">
    <header>
      <button type="button" class="hx-nav" data-month="-1" aria-label="Previous month">${ICON.left}</button>
      <b>${MONTHS[m]}${y !== t.getFullYear() ? ` ${y}` : ''}</b>
      <button type="button" class="hx-nav" data-month="1" aria-label="Next month" ${monthShift >= 0 ? 'disabled' : ''}>${ICON.right}</button>
      <span class="hx-kicker">${plural(monthRuns, 'run')}</span>
    </header>
    <div class="hx-cal-week">${WEEKDAYS.map(w => `<span>${w[0]}</span>`).join('')}</div>
    <div class="hx-cal-grid">${cells}</div>
    <footer><span><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> more runs</span><span><i class="is-pb"></i> personal best</span></footer>
  </section>`;
}

// ---------------------------------------------------------------- run timeline

function timeline(d, shown) {
  let left = shown, html = '';
  for (const day of d.days) {
    if (left <= 0) break;
    const rows = day.rows.slice(0, left); left -= rows.length;
    html += `<div class="hx-tday"><b>${esc(day.main)}</b><span>${esc(day.sub)}</span><em>${plural(day.count, 'run')}${day.bests ? ` · <span class="hx-gold">${plural(day.bests, 'personal best')}</span>` : ''}</em></div>`;
    for (const row of rows) {
      const kind = row.verdict?.kind ?? 'none';
      const stats = row.stats.map(s => `<span class="${s.died ? 'is-died' : ''}"><small>${esc(s.label)}</small><b>${esc(s.value)}<em>${esc(s.unit)}</em></b></span>`).join('');
      const form = (row.form ?? []).map(b => `<i class="${b.self ? 'is-self' : ''} ${b.best ? 'is-best' : ''} ${b.empty ? 'is-empty' : ''}" style="height:${b.empty ? 6 : b.height}%"></i>`).join('');
      html += `<article class="hx-trow is-${esc(kind)} ${row.id === d.activeId ? 'is-active' : ''}" data-run="${esc(row.id)}" tabindex="0">
        <time>${esc(row.time)}</time><span class="hx-node"></span>
        <div class="hx-ticket">
          <div class="hx-tname"><b>${esc(row.name)}</b><small>${esc(row.sub)}</small></div>
          <div class="hx-tstats">${stats}</div>
          <div class="hx-form" title="${esc(row.formTitle)}">${form}<small>Last 5</small></div>
          <div class="hx-tscore"><b>${esc(row.score.value)}<em>${esc(row.score.unit)}</em></b><small>${esc(row.note)}</small></div>
          <div class="hx-tchip">${chip(row.verdict)}</div>
          <button type="button" class="hx-del" data-del="${esc(row.id)}" title="Delete this record" aria-label="Delete this record">${ICON.trash}</button>
        </div>
      </article>`;
    }
  }
  const more = shown < d.rows.length || d.hasMore;
  const count = Math.min(shown, d.rows.length);
  return `<section class="hx-runs">
    <header class="hx-sec"><h3>Last ${count} runs</h3><span class="hx-kicker">All tasks, newest first · select a run to see every record for its task</span></header>
    <div class="hx-timeline">${html || `<p class="hx-none">${d.loading ? 'Loading…' : 'No runs yet. Finish a run and it shows up here.'}</p>`}</div>
    ${more ? `<button type="button" class="hx-more" data-more ${d.loading ? 'disabled' : ''}>${d.loading ? 'Loading…' : `Show ${FEED_STEP} more`}</button>` : ''}
  </section>`;
}

// ---------------------------------------------------------------- tasks

function taskCards(d) {
  if (!d.tiles.length) return '';
  const cards = [...d.tiles].sort((a, b) => b.lastAt - a.lastAt).map(t => {
    const trend = t.trend?.kind === 'need' ? `${plural(t.trend.need, 'more run')} for a trend` : t.trend?.text ?? '';
    const spark = t.spark?.path ? `<svg class="hx-spark" viewBox="0 0 116 34" preserveAspectRatio="none"><path d="${esc(t.spark.path)}"/>${t.spark.best ? `<circle cx="${t.spark.best.x}" cy="${t.spark.best.y}" r="3"/>` : ''}</svg>` : '<div class="hx-spark is-empty"></div>';
    return `<article class="hx-task ${t.recentPb ? 'is-hot' : ''}" data-task="${esc(t.code)}" tabindex="0">
      <div class="hx-tname"><b>${esc(t.name)}</b><small>${esc(t.sub)}</small></div>
      <div class="hx-task-mid">${spark}<div class="hx-task-best"><small>${t.recentPb ? 'New best' : 'Best'}</small><b>${esc(t.best?.value ?? '—')}<em>${esc(t.best?.unit ?? '')}</em></b></div></div>
      <div class="hx-task-foot"><span>${plural(t.attempts, 'run')}</span><span class="is-${esc(t.trend?.kind ?? 'flat')}">${esc(trend)}</span></div>
      ${t.type ? `<button type="button" class="hx-task-play" data-play="${esc(t.code)}" aria-label="Play ${esc(t.name)}">${ICON.play}</button>` : ''}
    </article>`;
  }).join('');
  return `<section class="hx-tasks-sec"><header class="hx-sec"><h3>Your tasks</h3><span class="hx-kicker">${plural(d.tiles.length, 'task')} · select one for all its records</span></header><div class="hx-tasks">${cards}</div></section>`;
}

// ---------------------------------------------------------------- render + events

const states = new WeakMap();

function bind(el, st) {
  const openRun = id => { st.activeId = id; st.data?.actions?.openRun?.(id); };
  el.addEventListener('click', event => {
    const a = st.data?.actions; if (!a) return;
    const t = event.target;
    const nav = t.closest('[data-month]');
    if (nav) { st.month = Math.min(0, st.month + Number(nav.dataset.month)); draw(el, st); return; }
    const del = t.closest('[data-del]');
    if (del) { event.stopPropagation(); a.deleteRun?.(del.dataset.del); return; }
    const play = t.closest('[data-play]');
    if (play) { a.play?.(play.dataset.play); return; }
    if (t.closest('[data-more]')) {
      st.shown += FEED_STEP;
      if (st.shown > st.data.rows.length && st.data.hasMore) a.loadMore?.();
      draw(el, st); return;
    }
    const task = t.closest('[data-task]');
    if (task) { a.openTask?.(task.dataset.task); return; }
    const run = t.closest('[data-run]');
    if (run) openRun(run.dataset.run);
  });
  el.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.target.closest?.('button')) return;
    const run = event.target.closest?.('[data-run]'), task = event.target.closest?.('[data-task]');
    if (run) openRun(run.dataset.run);
    else if (task) st.data?.actions?.openTask?.(task.dataset.task);
  });
}

function draw(el, st) {
  const d = { ...st.data, activeId: st.activeId };
  el.innerHTML = `<div class="hx ${st.drawn ? '' : 'is-entering'}">
    <div class="hx-top">${latestCard(d)}${weekCard(d)}${calendarCard(d, st.month)}</div>
    ${timeline(d, st.shown)}
    ${taskCards(d)}
  </div>`;
  st.drawn = true;
}

function render(el, input) {
  if (!el) return;
  let st = states.get(el);
  if (!st) { st = { shown: FEED_STEP, drawn: false, activeId: '', month: 0 }; states.set(el, st); bind(el, st); ensureStyle(); }
  const days = input.days ?? [];
  st.data = {
    ...input, days, rows: days.flatMap(day => day.rows), tiles: input.tiles ?? [],
    dayMap: new Map((input.overviewDays ?? []).map(x => [x.day, x])),
  };
  if (!input.drawerOpen) st.activeId = '';
  draw(el, st);
}

let styled = false;
function ensureStyle() {
  if (styled || document.getElementById('hx-style')) { styled = true; return; }
  const link = document.createElement('link');
  link.id = 'hx-style'; link.rel = 'stylesheet'; link.href = new URL('./history-board.css', import.meta.url).href;
  document.head.appendChild(link); styled = true;
}

globalThis.__aimHistoryBoard = { render };
export { render };
