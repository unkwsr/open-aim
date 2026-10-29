// Preparation extends the workshop loader; warm restarts use a delayed compact status.
let active = null;
const labels = {'Loading scenario assets':'Preparing assets','Loading map, bots and effects':'Preparing map and bots','Preparing selected weapons':'Preparing loadout','Warming weapon shaders and textures':'Preparing visuals','Finishing GPU preparation':'Finishing up'};
export function runScenarioLoading(prepare, workshop = null) {
  if (active) return active.promise;
  const controller = new AbortController();
  const previous = document.activeElement;
  const panel = document.createElement('section');
  panel.className = 'aim-scenario-loading ' + (workshop ? 'aim-loading-integrated' : 'aim-loading-compact');
  panel.setAttribute('role', 'status');
  panel.hidden = true;
  // Spinner, timer and the moving current step show the game is still working during long loads.
  panel.innerHTML = `<div class="aim-loading-head"><span class="aim-loading-spinner" aria-hidden="true"></span><div class="aim-loading-title"><small>Loading drill</small><b class="aim-loading-name"></b></div><span class="aim-loading-time" aria-hidden="true">0.0s</span></div><div class="aim-loading-stage" aria-live="polite"></div><div class="aim-loading-track" role="progressbar" aria-label="Preparation stages" aria-valuemin="0" aria-valuemax="4"><i></i><i></i><i></i><i></i></div><div class="aim-loading-note"></div><div class="aim-loading-actions"><span class="aim-loading-key"><kbd>Esc</kbd> to go back</span><button type="button" data-cancel>Back</button><button type="button" data-retry hidden>Retry</button></div>`;
  const stage = panel.querySelector('.aim-loading-stage');
  const track = panel.querySelector('[role=progressbar]');
  const steps = [...track.children];
  const note = panel.querySelector('.aim-loading-note');
  const time = panel.querySelector('.aim-loading-time');
  const kicker = panel.querySelector('.aim-loading-title small');
  const startedAt = performance.now();
  const clock = setInterval(() => {
    if (panel.hidden || panel.classList.contains('is-failed')) return;
    const seconds = (performance.now() - startedAt) / 1000;
    time.textContent = seconds.toFixed(1) + 's';
    note.textContent = seconds > 8 ? 'Still working. The first load of a map takes longer.' : '';
  }, 100);
  const retry = panel.querySelector('[data-retry]');
  const cancel = panel.querySelector('[data-cancel]');
  let resolve, settled = false, reveal;
  const promise = new Promise(r => { resolve = r; });
  const close = ok => {
    if (settled) return;
    settled = true;
    clearTimeout(reveal);
    clearInterval(clock);
    controller.abort();
    panel.remove();
    document.removeEventListener('keydown', keys, true);
    workshop?.signal.removeEventListener('abort', aborted);
    active = null;
    if (!workshop && previous?.isConnected) previous.focus?.({ preventScroll: true });
    resolve(ok);
  };
  const aborted = () => close(false);
  const back = () => { close(false); workshop?.cancel?.(); };
  const keys = e => {
    if (panel.hidden) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); back(); }
    if (e.key === 'Tab' && !workshop) { e.preventDefault(); (document.activeElement === cancel && !retry.hidden ? retry : cancel).focus(); }
  };
  const report = (label, completed = 0) => {
    if (settled) return;
    const text = labels[label] ?? label;
    workshop?.report(text, completed);
    const done = Math.max(0, Math.min(4, completed));
    stage.textContent = text;
    stage.dataset.step = 'Step ' + Math.min(4, done + 1) + ' of 4';
    track.setAttribute('aria-valuenow', String(completed));
    steps.forEach((step, i) => { step.className = i < done ? 'is-done' : i === done ? 'is-active' : ''; });
  };
  const attempt = async () => {
    retry.hidden = true;
    panel.classList.remove('is-failed');
    kicker.textContent = 'Loading drill';
    report('Loading scenario assets', 0);
    try {
      await prepare(report, controller.signal);
      if (!settled) close(true);
    } catch (error) {
      if (settled) return;
      if (error?.name === 'AbortError') { back(); return; }
      console.error('Scenario preparation failed', error);
      clearTimeout(reveal);
      panel.hidden = false;
      panel.classList.add('is-failed');
      kicker.textContent = 'Loading failed';
      stage.textContent = 'Preparation failed. Retry or go back.';
      workshop?.report('Preparation failed', 0);
      retry.hidden = false;
      retry.focus();
    }
  };
  cancel.onclick = back;
  retry.onclick = attempt;
  active = { promise };
  if (workshop?.signal.aborted) { close(false); return promise; }
  workshop?.signal.addEventListener('abort', aborted, { once: true });
  document.addEventListener('keydown', keys, true);
  document.body.append(panel);
  // Wait for Vue's resolved workshop layer to paint before using its footer.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (settled) return;
    const footer = workshop && document.querySelector('.al-wkload-foot');
    (footer || document.body).append(panel);
    if (footer) panel.hidden = false;
    else reveal = setTimeout(() => {
      if (settled) return;
      panel.classList.remove('aim-loading-integrated');
      panel.classList.add('aim-loading-compact');
      panel.querySelector('.aim-loading-name').textContent = document.querySelector('.al-scene-start-inner > :first-child')?.textContent.trim() ?? '';
      panel.hidden = false;
      if (document.pointerLockElement) document.exitPointerLock();
      cancel.focus();
    }, 250);
    attempt();
  }));
  return promise;
}

export async function prepareWorkshop(workshop) {
  return runScenarioLoading((report, signal) => {
    // Suspense resolves before mounted hooks: look up the engine after painting.
    const preparation = globalThis.__aimDrillPreparation;
    if (!preparation) throw new Error('Drill engine unavailable');
    return preparation.prepare(report, signal);
  }, workshop);
}

export async function prepareSession(session) {
  const engine = session.engine.value;
  if (!engine) return false;
  session.mapLoading.value = true;
  try {
    return await runScenarioLoading((report, signal) => engine.prepareScenario(report, signal));
  } finally {
    session.mapLoading.value = false;
    if (session.engine.value === engine) session.phase.value = 'idle';
  }
}

export async function finishWarmupGPU(renderer, valid) {
  if (!valid()) throw new DOMException('Preparation cancelled', 'AbortError');
  const gl = renderer.getContext();
  if (gl.isContextLost()) throw new Error('Graphics context lost');
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!fence) throw new Error('Could not create GPU preparation fence');
  gl.flush();
  try {
    for (;;) {
      if (!valid()) throw new DOMException('Preparation cancelled', 'AbortError');
      if (gl.isContextLost()) throw new Error('Graphics context lost');
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return;
      if (status === gl.WAIT_FAILED) throw new Error('GPU preparation failed');
      await new Promise(r => setTimeout(r, 4));
    }
  } finally { gl.deleteSync(fence); }
}
