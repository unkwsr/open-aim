// Shooter media from Play_Hit_Confirm_Head / Play_Hit_Confirm_Body.
const FILES = {
  head: ['head1.wav', 'head2.wav', 'head3.wav'],
  body: ['body1.wav', 'body2.wav', 'body3.wav', 'body4.wav'],
};
const GAIN = { head: 0.35, body: 0.4 };
const bytes = new Map();
const contexts = new WeakMap();

function state(context) {
  let value = contexts.get(context);
  if (!value) {
    value = { buffers: null, pending: null, previous: { head: -1, body: -1 }, voices: new Set() };
    contexts.set(context, value);
  }
  return value;
}

export function warmHitFeedback(context) {
  const value = state(context);
  if (value.buffers) return Promise.resolve(value.buffers);
  if (!value.pending) {
    value.pending = Promise.all(Object.entries(FILES).map(async ([part, files]) => [part,
      await Promise.all(files.map(async file => {
        if (!bytes.has(file)) {
          bytes.set(file, fetch('/aim-audio/hit-feedback/' + file).then(response => {
            if (!response.ok) throw Error('Hit feedback unavailable: ' + file);
            return response.arrayBuffer();
          }).catch(error => { bytes.delete(file); throw error; }));
        }
        return context.decodeAudioData((await bytes.get(file)).slice(0));
      })),
    ])).then(entries => value.buffers = Object.fromEntries(entries)).catch(error => {
      value.pending = null;
      throw error;
    });
  }
  return value.pending;
}

export function playHitFeedback(context, destination, part) {
  if (context.state === 'closed') return false;
  const value = state(context);
  if (!value.buffers) {
    warmHitFeedback(context).catch(() => {});
    return false;
  }
  const kind = part === 'head' ? 'head' : 'body';
  const buffers = value.buffers[kind], previous = value.previous[kind];
  // Uniform choice excluding the last variant, matching the bank's avoid-repeat setting.
  let index = Math.floor(Math.random() * (buffers.length - (previous < 0 ? 0 : 1)));
  if (previous >= 0 && index >= previous) index++;
  value.previous[kind] = index;
  while (value.voices.size >= 16) value.voices.values().next().value.finish(true);
  const source = context.createBufferSource(), gain = context.createGain();
  source.buffer = buffers[index];
  source.__aimHitVariant = kind + (index + 1);
  gain.gain.value = GAIN[kind];
  source.connect(gain);
  gain.connect(destination);
  const voice = { finish(stop = false) {
    if (!value.voices.delete(voice)) return;
    source.onended = null;
    if (stop) { try { source.stop(); } catch {} }
    source.disconnect();
    gain.disconnect();
  } };
  value.voices.add(voice);
  source.onended = () => voice.finish();
  source.start(context.currentTime);
  return true;
}

export function clearHitFeedback(context) {
  const value = contexts.get(context);
  if (!value) return;
  for (const voice of value.voices) voice.finish(true);
  value.previous.head = value.previous.body = -1;
}

export function characterHitParts(shot, actors, dotTemplates) {
  const hits = new Map();
  function add(id, part) {
    if (id == null) return;
    const actor = actors.find(actor => actor.id === id);
    if (!actor || dotTemplates.has(actor.templateId)) return;
    if (!hits.has(id) || part === 'head') hits.set(id, part === 'head' ? 'head' : 'body');
  }
  for (const hit of shot.pellets ?? [shot]) {
    add(hit.hitActorId, hit.hitPart);
    for (const also of hit.also ?? []) add(also.actorId, also.part);
  }
  // Classify the entire shot first: a lethal head pellet must not fall back to
  // a body variant just because another pellet hit the same actor's body.
  for (const [id, part] of hits) {
    if (part === 'head' && actors.find(actor => actor.id === id)?.alive !== true) hits.delete(id);
  }
  return hits.values();
}
