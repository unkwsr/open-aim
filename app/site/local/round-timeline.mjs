// Round timeline capture. Runs where the simulation runs (the game worker, or the page
// in the non-worker build) and keeps a coarse top-down trace of the live round:
// the player's position and facing, enemy positions, kills and shots.
//
// Cost: one counter check per tick. Every SAMPLE_TICKS ticks (about 10 per second) it
// writes a few floats per visible enemy into preallocated typed arrays. Nothing is
// allocated per tick, and nothing is written to disk. The previous round is dropped
// when the next one starts.

const SAMPLE_TICKS = 13;          // 128 ticks/s / 13 = ~9.8 samples per second

function growFloat(array, need) {
  if (need <= array.length) return array;
  const next = new Float32Array(Math.max(need, array.length * 2));
  next.set(array);
  return next;
}
function growUint(array, need) {
  if (need <= array.length) return array;
  const next = new Uint32Array(Math.max(need, array.length * 2));
  next.set(array);
  return next;
}

function createCapture() {
  // Per sample: tick, x, z, yaw (player). Enemy rows: id, x, z, indexed by sample.
  let sampleTick = new Uint32Array(1024);
  let player = new Float32Array(1024 * 3);
  let enemyStart = new Uint32Array(1025);
  let enemies = new Float32Array(1024 * 3 * 8);
  let kills = new Float32Array(64 * 4);       // tick, id, x, z
  let shots = new Uint32Array(512);           // tick
  let samples = 0, enemyRows = 0, killCount = 0, shotCount = 0;
  let firstTick = -1, lastTick = -1, countdown = 0, active = false;

  const sample = snapshot => {
    const p = snapshot.player, pos = p.position;
    const n = samples;
    sampleTick = growUint(sampleTick, n + 1);
    player = growFloat(player, (n + 1) * 3);
    enemyStart = growUint(enemyStart, n + 2);
    sampleTick[n] = snapshot.tick;
    player[n * 3] = pos.x;
    player[n * 3 + 1] = pos.z;
    player[n * 3 + 2] = p.yaw;
    enemyStart[n] = enemyRows;
    const actors = snapshot.actors;
    for (let i = 0; i < actors.length; i += 1) {
      const a = actors[i];
      if (!a.alive || !a.visible || !a.position) continue;
      enemies = growFloat(enemies, (enemyRows + 1) * 3);
      enemies[enemyRows * 3] = a.id;
      enemies[enemyRows * 3 + 1] = a.position.x;
      enemies[enemyRows * 3 + 2] = a.position.z;
      enemyRows += 1;
    }
    enemyStart[n + 1] = enemyRows;
    samples = n + 1;
  };

  return {
    // The round's first running tick.
    reset() {
      samples = 0; enemyRows = 0; killCount = 0; shotCount = 0;
      firstTick = -1; lastTick = -1; countdown = 0; active = true;
    },

    // After every simulated tick of a live round, with its snapshot and events.
    tick(snapshot, events) {
      if (!active) return;
      if (firstTick < 0) firstTick = snapshot.tick;
      lastTick = snapshot.tick;
      for (let i = 0; i < events.length; i += 1) {
        const e = events[i];
        if (e.kind === 'shot') {
          shots = growUint(shots, shotCount + 1);
          shots[shotCount++] = snapshot.tick;
        } else if (e.kind === 'kill') {
          const actor = snapshot.actors.find(a => a.id === e.actorId);
          kills = growFloat(kills, (killCount + 1) * 4);
          kills[killCount * 4] = snapshot.tick;
          kills[killCount * 4 + 1] = e.actorId;
          kills[killCount * 4 + 2] = actor?.position?.x ?? NaN;
          kills[killCount * 4 + 3] = actor?.position?.z ?? NaN;
          killCount += 1;
        }
      }
      if (countdown <= 0) { sample(snapshot); countdown = SAMPLE_TICKS; }
      countdown -= 1;
    },

    // The round ended normally. Returns compact copies sized to what was used.
    finish(snapshot, tickSeconds) {
      if (!active) return null;
      active = false;
      if (snapshot && snapshot.tick !== sampleTick[samples - 1]) sample(snapshot);
      if (samples < 2) return null;
      return {
        version: 1,
        tickSeconds,
        firstTick,
        lastTick: snapshot?.tick ?? lastTick,
        sampleTick: sampleTick.slice(0, samples),
        player: player.slice(0, samples * 3),
        enemyStart: enemyStart.slice(0, samples + 1),
        enemies: enemies.slice(0, enemyRows * 3),
        kills: kills.slice(0, killCount * 4),
        shots: shots.slice(0, shotCount),
      };
    },

    // The round was abandoned (restart, quit, new scene).
    cancel() { active = false; },
  };
}

export const roundTimeline = globalThis.__aimRoundTimelineCapture ??= createCapture();

// Typed-array buffers of a finished timeline, for a zero-copy postMessage transfer.
export const timelineBuffers = data => data ? [data.sampleTick, data.player, data.enemyStart, data.enemies, data.kills, data.shots].map(a => a.buffer) : [];
