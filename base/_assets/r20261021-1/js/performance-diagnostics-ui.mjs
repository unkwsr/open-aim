import { performanceDiagnostics as monitor, diagnosticErrorLocation } from '../next/js/performance-diagnostics.mjs';
import { createDiagnosticDelivery } from './diagnostic-delivery.mjs';

const root = document.documentElement;
const english = () => root.lang === 'en';
const t = (vi, en) => english() ? en : vi;
const capabilities = {};
let panel, reportField, feedback, opener;
let collecting = false;
const sessionId = crypto.randomUUID();
let storage, autoSend = true;
try { storage = localStorage; autoSend = storage.getItem('aim-debug-auto-send') !== 'off'; } catch { /* Storage may be disabled. */ }
const delivery = createDiagnosticDelivery({ storage, send: async data => {
  const response = await fetch('/api/diagnostics', { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-aim-diagnostics': '1' }, body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error('Report delivery failed');
  return response.json();
} });
let savedStamp = '';
function checkpoint(force = false) {
  if (collecting || document.hidden) return;
  const data = report();
  const stamp = `${data.scene}:${data.lastSampleMs}:${data.events.at(-1)?.at}`;
  if (stamp !== savedStamp && (data.frames || data.events.length || data.history.some(item => item.ready))) { delivery.capture(data); savedStamp = stamp; }
  if (force || (autoSend && delivery.status().pending)) {
    const task = delivery.flush({ force }); task.then(() => render()); return task;
  }
}

function observe(type, callback, options = {}) {
  capabilities[type] = false;
  if (!globalThis.PerformanceObserver?.supportedEntryTypes?.includes(type)) return;
  try {
    const observer = new PerformanceObserver(list => {
      try { for (const entry of list.getEntries()) callback(entry); } catch { /* Optional diagnostics. */ }
    });
    observer.observe({ type, buffered: false, ...options });
    capabilities[type] = true;
  } catch { /* Unsupported browser/version: frame and error diagnostics still work. */ }
}

observe('longtask', entry => monitor.record('long-task', { duration: entry.duration }, entry.startTime));
observe('long-animation-frame', entry => {
  // Keep only the slowest script location, not function names/invokers (may contain user data).
  let slowest;
  for (const script of entry.scripts || []) if (!slowest || script.duration > slowest.duration) slowest = script;
  monitor.record('long-frame', { duration: entry.duration, script: slowest?.sourceURL,
    line: slowest?.sourceLine, sourceOffset: slowest?.sourceCharPosition, fn: slowest?.sourceFunctionName, includeOutside: true,
    scripts: [...(entry.scripts || [])].sort((a,b) => b.duration - a.duration).slice(0,5).map(script => ({
      script: script.sourceURL, fn: script.sourceFunctionName, line: script.sourceLine, sourceOffset: script.sourceCharPosition,
      duration: script.duration, forcedLayoutMs: script.forcedStyleAndLayoutDuration,
    })),
    scriptMs: (entry.scripts || []).reduce((sum, script) => sum + script.duration, 0),
    styleLayoutMs: entry.styleAndLayoutStart > 0 ? entry.startTime + entry.duration - entry.styleAndLayoutStart : 0,
    renderPhaseMs: entry.renderStart > 0 ? entry.startTime + entry.duration - entry.renderStart : 0,
    blockingMs: entry.blockingDuration,
    // Forced synchronous style/layout time is directly attributed by the browser.
    layout: (entry.scripts || []).reduce((sum, script) => sum + (script.forcedStyleAndLayoutDuration || 0), 0)
  }, entry.startTime);
});
observe('event', entry => monitor.record('input-delay', { duration: entry.duration,
  handler: entry.processingEnd - entry.processingStart, queueMs: entry.processingStart - entry.startTime,
  presentationMs: Math.max(0, entry.startTime + entry.duration - entry.processingEnd) }, entry.startTime), { durationThreshold: 104 });
observe('resource', entry => {
  if (entry.responseStatus >= 400) monitor.record('asset', { asset: entry.name, status: entry.responseStatus, duration: entry.duration }, entry.startTime);
});

monitor.setVisible(!document.hidden);
document.addEventListener('visibilitychange', () => { monitor.setVisible(!document.hidden); if (!document.hidden) checkpoint(); });
window.addEventListener('pagehide', () => { monitor.stop(); const data = report(); if (data.frames || data.events.length || data.history.some(item => item.ready)) delivery.capture(data); });
window.addEventListener('error', event => {
  if (event.target !== window) {
    const target = event.target;
    if (['SCRIPT', 'LINK', 'IMG'].includes(target?.tagName)) monitor.record('asset', { asset: target.src || target.href });
  } else monitor.record('javascript', { error: event.error?.name, script: event.filename, line: event.lineno, column: event.colno });
}, true);
window.addEventListener('unhandledrejection', event => monitor.record('javascript', { error: event.reason?.name, ...diagnosticErrorLocation(event.reason?.stack) }));
document.addEventListener('webglcontextlost', () => monitor.record('context-lost'), true);
document.addEventListener('webglcontextrestored', () => monitor.record('context-restored'), true);
window.addEventListener('aim-local-round-start', event => monitor.setScene(event.detail?.id));
window.addEventListener('aim-local-scene', event => monitor.setScene(event.detail?.id));
window.addEventListener('aim-gameplay-state', event => monitor.setPhase(event.detail?.active ? 'gameplay' : root.classList.contains('aim-round-finished') ? 'result' : root.classList.contains('aim-trainer-open') ? 'paused' : 'menu'));

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function button(text, handler, className) {
  const element = node('button', text, className);
  element.type = 'button'; element.addEventListener('click', handler); return element;
}
function browserName() {
  const ua = navigator.userAgent;
  const found = ua.match(/(?:Edg|Firefox|Chrome|Version)\/[\d.]+/g);
  return found?.slice(-2).join(' ') || 'Other';
}
function report() {
  const state = monitor.snapshot();
  const previous = delivery.previous().flatMap(item => [...(item.history || []), item]).filter(item => item.ready).at(-1);
  if (!state.ready && previous && !state.history.some(item => item.scene === previous.scene && item.lastSampleMs === previous.lastSampleMs)) {
    const { events, timeline, history, notes, ...sample } = previous;
    state.history = [sample, ...state.history].slice(-6);
  }
  return {
    schema: 'aim-performance-v2', reportId: crypto.randomUUID(), sessionId,
    release: import.meta.url.match(/\/_assets\/(r[\d-]+)\//)?.[1] || 'development',
    capturedAt: new Date().toISOString(), browser: browserName(),
    viewport: [innerWidth, innerHeight], devicePixelRatio,
    logicalCores: navigator.hardwareConcurrency || null,
    capabilities, ...state,
    notes: t(
      'Debug nhẹ luôn bật: nhịp render, tick/render/HUD CPU, bộ đếm renderer, 60 giây diễn biến và 6 lượt/map trước. 1% low = 1000 / p99. Mẫu FPS bỏ qua menu/pause/tab ẩn và 1,5 giây đầu; sự kiện có nhãn riêng. Giữ tối đa 3 báo cáo trên máy trong 7 ngày; có thể tự gửi báo cáo lỗi ẩn danh khi dừng chơi, server giữ tối đa 7 ngày. Không thu tài khoản, email, nội dung nhập, token, query URL hay quay màn hình. Không trực tiếp đo GPU hoặc bước Layerize; script timing/layout tùy trình duyệt hỗ trợ. Tương quan không chứng minh nguyên nhân.',
      'Lightweight diagnostics are always on: render cadence, tick/render/HUD CPU, renderer counters, 60 seconds of context and 6 previous rounds/maps. 1% low = 1000 / p99. FPS excludes menus/pauses/hidden tabs and the first 1.5 seconds; events are phase-labelled. Up to 3 reports are kept locally for 7 days; anonymous error reports can be sent automatically after play and retained on the server for up to 7 days. No accounts, email, entered text, tokens, URL queries or screen recording. GPU time and Layerize are not directly measured; script/layout attribution requires browser support. Correlation does not prove causation.'
    )
  };
}

function explanation(state) {
  const items = [];
  if (!state.ready) items.push(t('Chưa đủ mẫu FPS. Chơi ít nhất vài giây rồi mở lại bảng này.', 'Not enough FPS samples yet. Play for a few seconds, then reopen this panel.'));
  else if (state.dropped) items.push(t(
    `Có ${state.slow} frame chậm bất thường so với nhịp thông thường ${state.typicalMs} ms. Đây là dấu hiệu giật, chưa xác định nguyên nhân.`,
    `${state.slow} unusually slow frames compared with the typical ${state.typicalMs} ms cadence. Stuttering observed; cause not yet established.`));
  else items.push(t('Chưa thấy nhiều frame chậm bất thường trong mẫu gần nhất. Không có nghĩa là mọi vấn đề hiệu năng đã được loại trừ.', 'No repeated unusual frame stalls in the latest sample. This does not rule out all performance problems.'));
  if (state.events.some(e => e.kind === 'long-task' && e.gameplay)) items.push(t('Có tác vụ chiếm luồng chính ≥50 ms khi chơi. JavaScript hoặc công việc trình duyệt có thể làm chậm xử lý input; gửi báo cáo để kiểm tra.', 'Main-thread tasks ≥50 ms occurred during play. JavaScript or browser work may delay input; share the report for investigation.'));
  if (state.events.some(e => e.kind === 'long-frame' && e.layout >= 8)) items.push(t('Trình duyệt ghi nhận tính style/layout đồng bộ trong frame chậm. Báo cáo có vị trí script nếu trình duyệt cung cấp.', 'The browser measured forced synchronous style/layout in a slow frame. Script locations are included when available.'));
  if (state.events.some(e => e.kind === 'input-delay')) items.push(t('Có tương tác phản hồi chậm. Tổng thời gian gồm chờ xử lý và chờ vẽ, không chỉ thời gian input handler. Không đo được mọi mousemove/pointer-lock.', 'Slow interactions detected. Total latency includes queueing and presentation, not just handler time. Not all mousemove/pointer-lock input is observable.'));
  if (state.events.some(e => e.kind === 'asset')) items.push(t('Có tài nguyên tải lỗi. HTTP 404/410 là file thiếu; mã 0 có thể do mạng, tiện ích chặn hoặc yêu cầu bị hủy. Chưa thể quy lỗi cho adblock hay coi đây là nguyên nhân tụt FPS.', 'Some resources failed to load. HTTP 404/410 means missing files; status 0 may mean network failure, an extension or a cancelled request. This alone does not establish an adblock or FPS cause.'));
  if (state.events.some(e => e.kind === 'javascript')) items.push(t('Có lỗi JavaScript. Gửi vị trí file/dòng trong báo cáo cho hỗ trợ; không cần xóa toàn bộ dữ liệu trình duyệt.', 'JavaScript errors were observed. Send the file/line from the report to support; clearing all browser data is not required.'));
  if (state.contextLost) items.push(t('WebGL đã mất context và chưa báo phục hồi. Thử đóng bớt tab dùng GPU, kiểm tra tăng tốc phần cứng/driver rồi tải lại sau khi sao chép báo cáo.', 'WebGL context was lost and has not reported recovery. Try closing GPU-heavy tabs, checking hardware acceleration/drivers, then reloading after copying the report.'));
  return items;
}
const labels = () => ({
  'frame-stall': t('Nhịp render game bị khựng', 'Game render cadence stall'),
  'long-task': t('Tác vụ dài', 'Long task'), 'long-frame': t('Frame trình duyệt chậm', 'Long browser frame'),
  'input-delay': t('Tương tác chậm', 'Slow interaction'), asset: t('Tải tài nguyên lỗi', 'Resource failure'),
  javascript: t('Lỗi JavaScript', 'JavaScript error'), 'context-lost': 'WebGL context lost', 'context-restored': 'WebGL context restored'
});

function render() {
  if (!panel?.open) return;
  const current = report();
  const archived = current.history.filter(item => item.ready).at(-1) || delivery.previous().reverse().find(item => item.ready);
  const older = !current.ready && Boolean(archived);
  const data = older ? { ...archived, events: [...(archived.events || []), ...current.events].slice(-60) } : current;
  panel.querySelector('.aim-diagnostics-summary').textContent = !data.ready ? t('Đang chờ mẫu chơi', 'Waiting for gameplay samples')
    : (older ? t('Mẫu lượt trước · ', 'Previous gameplay sample · ') : '') + (data.dropped ? t('Đã ghi nhận frame bị khựng', 'Frame stalls observed') : t('Đã có mẫu đo', 'Gameplay sample available')) + (data.scene ? ` · ${data.scene}` : '');
  const metrics = panel.querySelector('.aim-diagnostics-metrics'); metrics.replaceChildren();
  for (const [label, value] of [
    ['FPS', data.ready ? data.fps : '—'], ['1% low', data.ready ? data.onePercentLow : '—'],
    [t('Frame tệ nhất', 'Worst frame'), data.frames ? `${data.worstMs} ms` : '—'],
    [t('Mẫu đã lưu', 'Retained sample'), `${data.sampledSeconds} s`]
  ]) { const cell = node('div'); cell.append(node('strong', String(value)), node('span', label)); metrics.append(cell); }
  const findings = panel.querySelector('.aim-diagnostics-findings'); findings.replaceChildren();
  for (const text of explanation(data)) findings.append(node('li', text));
  for (const [stage, value] of Object.entries(data.work || {})) if (value.count) findings.append(node('li',
    `${stage.toUpperCase()} CPU: ${value.meanMs} ms ${t('trung bình', 'average')} · ${value.worstMs} ms ${t('cao nhất', 'maximum')}`));
  const recent = panel.querySelector('.aim-diagnostics-events'); recent.replaceChildren();
  const names = labels();
  for (const event of data.events.slice(-8).reverse()) {
    const parts = [names[event.kind], event.gameplay ? t('trong game', 'gameplay') : t('ngoài lượt chơi', 'outside gameplay')];
    if (event.duration) parts.push(`${event.duration} ms`);
    if (event.kind === 'asset') parts.push(`HTTP ${event.status || '?'}`, event.asset);
    if (event.kind === 'javascript') parts.push(event.error);
    if (event.kind === 'javascript' || event.script !== '[redacted]') parts.push(`${event.script}:${event.line}`);
    if (event.layout) parts.push(`forced layout: ${event.layout} ms`);
    if (event.handler) parts.push(`handler: ${event.handler} ms`);
    if (event.fn) parts.push(event.fn);
    if (event.styleLayoutMs) parts.push(`style/layout phase: ${event.styleLayoutMs} ms`);
    if (event.count > 1) parts.push(`×${event.count}`);
    recent.append(node('li', parts.join(' · ')));
  }
  if (!data.events.length) recent.append(node('li', t('Chưa có sự kiện lỗi được ghi nhận.', 'No error events recorded yet.')));
  // Do not disturb manual text selection when clipboard access is unavailable.
  if (document.activeElement !== reportField) reportField.value = JSON.stringify({ ...current, previousReports: delivery.previous() }, null, 2);
  const receipt = panel.querySelector('.aim-diagnostics-receipt');
  const status = delivery.status();
  receipt.textContent = status.sending ? t('Đang gửi debug…', 'Sending diagnostics…') : status.error
    ? t('Chưa gửi được. Báo cáo vẫn ở máy bạn; thử lại hoặc tải file JSON.', 'Not sent. The report is still saved locally; retry or download JSON.')
    : status.id ? `${status.pending ? t('Mã debug gần nhất; có bản mới chờ gửi', 'Latest submitted debug ID; newer report pending') : t('Mã debug đã gửi', 'Submitted debug ID')}: ${status.id}`
    : t('Chưa có mã debug. Bạn có thể gửi ngay hoặc tải báo cáo.', 'No submitted debug ID yet. You can send or download the report.');
}

function close() { panel?.close(); }
function buildPanel() {
  panel = node('dialog', undefined, 'aim-diagnostics-panel');
  panel.setAttribute('aria-labelledby', 'aim-diagnostics-title');
  panel.setAttribute('aria-describedby', 'aim-diagnostics-privacy');
  const header = node('header'); const heading = node('h2', t('Chẩn đoán FPS & lỗi', 'FPS & error diagnostics'));
  heading.id = 'aim-diagnostics-title';
  header.append(heading, button(t('Đóng', 'Close'), close));
  const summary = node('p', '', 'aim-diagnostics-summary');
  const privacy = node('p', t('Debug nhẹ được ghi sẵn, không cần quay/record. Tối đa 3 báo cáo được giữ trên máy 7 ngày, kể cả sau reload. Khi bật gửi tự động, báo cáo ẩn danh được gửi lúc dừng chơi và chỉ xem được trong admin riêng; lưu tối đa 7 ngày. Không gửi tài khoản, email, nội dung nhập hay token.', 'Lightweight diagnostics are already running; no recording needed. Up to 3 reports survive reloads locally for 7 days. When automatic sending is enabled, anonymous reports are sent after play and are visible only in the private admin for up to 7 days. No accounts, email, entered text or tokens are sent.'), 'aim-diagnostics-muted');
  privacy.id = 'aim-diagnostics-privacy';
  const metrics = node('div', undefined, 'aim-diagnostics-metrics');
  const findings = node('ul', undefined, 'aim-diagnostics-findings');
  const events = node('ul', undefined, 'aim-diagnostics-events');
  const unsupported = Object.entries(capabilities).filter(([, supported]) => !supported).map(([name]) => name);
  const limits = node('p', t('1% low = 1000 / p99 thời gian frame. Chỉ đo lúc đang chơi; bỏ qua 1,5 giây đầu. Không đo trực tiếp GPU và không thay thế Chrome trace.', '1% low = 1000 / p99 frame interval. Gameplay only; first 1.5 seconds excluded. Does not directly measure the GPU or replace a Chrome trace.'), 'aim-diagnostics-muted');
  if (unsupported.length) limits.append(document.createTextNode(t(' Trình duyệt không hỗ trợ: ', ' Unsupported in this browser: ') + unsupported.join(', ') + '.'));
  const details = node('details'); details.append(node('summary', t('Xem báo cáo kỹ thuật', 'View technical report')));
  reportField = node('textarea'); reportField.readOnly = true; reportField.spellcheck = false;
  reportField.setAttribute('aria-label', t('Báo cáo chẩn đoán để sao chép', 'Diagnostic report to copy')); details.append(reportField);
  feedback = node('p', '', 'aim-diagnostics-muted'); feedback.setAttribute('role', 'status');
  const actions = node('footer');
  const send = button(t('Gửi debug cho hỗ trợ', 'Send diagnostics to support'), async () => {
    send.disabled = true;
    try { await checkpoint(true); } finally { send.disabled = false; render(); }
  }, 'is-primary');
  const receipt = node('p', '', 'aim-diagnostics-receipt'); receipt.setAttribute('role', 'status');
  const consent = node('label', undefined, 'aim-diagnostics-consent');
  const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = autoSend;
  checkbox.addEventListener('change', () => {
    autoSend = checkbox.checked;
    try { storage?.setItem('aim-debug-auto-send', autoSend ? 'on' : 'off'); } catch { /* Memory-only setting. */ }
    if (autoSend) checkpoint();
  });
  consent.append(checkbox, node('span', t('Tự gửi debug ẩn danh khi dừng chơi (không gửi trong lúc chơi)', 'Automatically send anonymous diagnostics after play (never during gameplay)')));
  actions.append(send, button(t('Sao chép báo cáo', 'Copy report'), async () => {
    render(); const text = reportField.value;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      feedback.textContent = t('Đã sao chép. Gửi nội dung này hoặc mã debug cho người hỗ trợ; không cần file nén.', 'Copied. Send this text or the debug ID to support; no archive needed.');
    } catch {
      details.open = true; reportField.focus(); reportField.select();
      feedback.textContent = t('Trình duyệt chặn clipboard. Báo cáo đã được chọn: nhấn Ctrl/Cmd+C hoặc dùng “Tải debug JSON”.', 'Clipboard blocked. The report is selected: press Ctrl/Cmd+C or use “Download debug JSON”.');
    }
  }), button(t('Tải debug JSON', 'Download debug JSON'), () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...report(), previousReports: delivery.previous() }, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = node('a'); link.href = url; link.download = 'aim-debug-report.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedback.textContent = t('Đã tạo một file JSON để gửi; không cần nén hoặc record.', 'One JSON file created; no archive or recording needed.');
  }), button(t('Xóa debug trên máy', 'Clear local diagnostics'), () => {
    monitor.clear(); delivery.clear(); savedStamp = ''; render();
    feedback.textContent = t('Đã xóa bản lưu trên máy. Bản đã gửi tự hết hạn sau tối đa 7 ngày.', 'Local reports cleared. Submitted reports expire after up to 7 days.');
  }));
  const originalTest = button(t('Mở kiểm tra phản hồi trình duyệt', 'Open browser responsiveness test'), () => {
    const original = document.querySelector('.hall-topnav-right .hall-lat-btn');
    if (original) { close(); original.click(); }
  });
  originalTest.disabled = !document.querySelector('.hall-topnav-right .hall-lat-btn') || root.classList.contains('aim-trainer-open');
  panel.append(header, privacy, summary, metrics, findings, limits, node('h3', t('Sự kiện gần đây', 'Recent events')), events, consent, receipt, actions, details, originalTest, feedback);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } });
  panel.addEventListener('close', () => { root.classList.remove('aim-diagnostics-open'); opener?.focus(); });
  document.body.append(panel);
}
function open(event) {
  // Never unlock the pointer or interrupt a live run to open diagnostics.
  if (monitor.snapshot().running || document.pointerLockElement) return;
  opener = event.currentTarget; panel?.remove(); buildPanel();
  root.classList.add('aim-diagnostics-open'); panel.showModal(); render();
}

// Reuse the existing performance control; no extra crowded header button.
const launcher = document.querySelector('.aim-performance-button');
if (launcher) {
  launcher.disabled = false;
  launcher.title = t('Chẩn đoán FPS & lỗi', 'FPS & error diagnostics');
  launcher.setAttribute('aria-label', launcher.title);
  launcher.setAttribute('aria-haspopup', 'dialog');
}
window.AimPerformanceDiagnostics = Object.freeze({ open });
window.dispatchEvent(new Event('aim-diagnostics-ready'));
const gameLauncher = button(t('Chẩn đoán FPS', 'FPS diagnostics'), open, 'aim-diagnostics-game-button');
gameLauncher.setAttribute('aria-haspopup', 'dialog');
gameLauncher.hidden = true;
document.querySelector('.aim-game-credit nav')?.append(gameLauncher);
const notice = node('p', '', 'aim-diagnostics-notice'); notice.hidden = true;
document.querySelector('.aim-game-credit')?.append(notice);
monitor.onIssue(kind => {
  if (!collecting || !notice.hidden) return;
  notice.textContent = kind === 'context-lost' ? t('WebGL bị gián đoạn · Esc để xem chẩn đoán', 'WebGL interrupted · Esc for diagnostics')
    : kind === 'javascript' ? t('Có lỗi JavaScript · Esc để xem chẩn đoán', 'JavaScript error · Esc for diagnostics')
    : t('Đã ghi nhận giật/chậm · Esc để xem chẩn đoán', 'Stall/delay recorded · Esc for diagnostics');
  notice.hidden = false;
});
function syncPhase(active) {
  collecting = active;
  gameLauncher.hidden = active;
  if (active && !notice.hidden) notice.hidden = true;
  if (active && panel?.open) close();
}
monitor.onPhase(syncPhase);
syncPhase(monitor.snapshot().running);
// No animation loop or per-frame DOM scan. UI updates only outside gameplay.
setInterval(() => {
  if (document.hidden || collecting) return;
  checkpoint(); render();
  const data = monitor.snapshot();
  const warning = data.dropped || data.contextLost || data.events.some(e => e.gameplay && ['javascript', 'frame-stall', 'long-task', 'long-frame', 'input-delay'].includes(e.kind));
  for (const element of [launcher, gameLauncher].filter(Boolean)) {
    if (element.classList.contains('has-warning') !== warning) element.classList.toggle('has-warning', warning);
  }
}, 2000);
