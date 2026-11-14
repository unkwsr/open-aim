// Neon (game name "Sprinter") kit for the player: High Gear sprint and slide. Overdrive comes later.
// Numbers from the FModel exports (previews/neon/NEON-EXPORT.md):
//   Buff_Sprinter_E_Sprint_SpeedBoost  run speed x1.35
//   Ability_Sprinter_E_Sprint_Production  equip 0.6 s, unequip 0.2 s, slide input buffer 0.1 s,
//     slide needs 300 cm/s, slide state 0.6 s
//   FM_Sprinter_SlideDash  1200 cm/s in a fixed direction
//   Buff_Sprinter_CrouchSlide  forced crouch, no jump while sliding
// Like Jett here, fuel and slides are unlimited. Only plain numbers live on the player (checkpoints).
// unarmedRunSpeed: BasePlayerCharacter MaxSpeed 675 cm/s; High Gear holsters the gun, so the sprint is 6.75 x 1.35.
export const neonTuning = { sprintSpeed: 1.35, unarmedRunSpeed: 6.75, equipSeconds: .6, unequipSeconds: .2, slideSpeed: 12, slideSeconds: .6, slideMinSpeed: 3, slideBufferSeconds: .1 };
export const neonFields = ['neOn', 'neAt', 'neOff', 'neAwayAt', 'neSlide', 'neSx', 'neSz', 'neCrouch', 'neBuf', 'neGround', 'neJumpAt', 'neLandAt', 'neCrouchAt'];

// Same conditions as Jett's kit (movable player, not knife-only rounds).
export function neonRules(rules) {
  return rules.playerMovable && rules.weapon !== 'melee' ? { sprint: true, slide: true, unlimited: true, ...rules.neon } : rules.neon ? { ...rules.neon, unlimited: true } : null;
}

// Which agent the player picked in the lobby (lobby-bar.js); an explicit option wins (tests).
export function pickedAgent(option) {
  // chamber-kit-v1: Chamber added 13 Nov 2026 (site/local/chamber-kit.mjs).
  if (option === 'neon' || option === 'jett' || option === 'chamber') return option;
  try { const v = globalThis.localStorage?.getItem('aim-agent'); return v === 'neon' || v === 'chamber' ? v : 'jett'; } catch { return 'jett'; }
}

// One tick, before movement. edges.neonE: E was pressed this tick.
// p: neOn 1 while High Gear is out, neAt tick it came out, neOff tick the gun is back after putting it
// away, neSlide tick a slide started (neSx/neSz its direction), neCrouch crouch held last tick, neBuf tick
// crouch was pressed while High Gear was out (0.1 s buffer).
// Returns the input to use (fire blocked while the gun is away; crouch forced, no jump while sliding),
// whether movement is forced this tick (slide) and the run speed factor.
export function stepNeon(p, rules, tick, dt, input, edges) {
  const T = neonTuning, ticks = s => Math.round(s / dt);
  let speed = 1, forced = false;
  const crouchEdge = input.crouch && p.neCrouch !== 1;
  p.neCrouch = input.crouch ? 1 : 0;
  // Ground contact as of the last movement step, for the first-person jump / land arms.
  const grounded = p.grounded === true ? 1 : 0;
  if (p.neGround !== undefined && grounded !== p.neGround) { if (grounded) p.neLandAt = tick; else p.neJumpAt = tick; }
  p.neGround = grounded;
  if (crouchEdge) p.neCrouchAt = tick;
  const putAway = () => { p.neOn = 0; p.neOff = tick + ticks(T.unequipSeconds); p.neAwayAt = tick; };
  if (edges.neonE && rules.sprint) {
    if (p.neOn === 1) putAway();
    else if (p.neSlide === undefined) { p.neOn = 1; p.neAt = tick; delete p.neOff; }
  }
  // Firing puts High Gear away; the gun is back after the unequip time.
  if (p.neOn === 1 && input.fire) putAway();
  const sprinting = p.neOn === 1 && tick - p.neAt >= ticks(T.equipSeconds);
  // Like Valorant: the slide is on alt fire (right-click, edges.neonSlide) while High Gear is out, not crouch.
  if (edges.neonSlide && p.neOn === 1) p.neBuf = tick;
  if (rules.slide && p.neSlide === undefined && sprinting && p.grounded && p.neBuf !== undefined && tick - p.neBuf <= ticks(T.slideBufferSeconds)) {
    const v = Math.hypot(p.velocity.x, p.velocity.y);
    if (v >= T.slideMinSpeed) {
      // The slide ends High Gear: the gun comes out with it.
      p.neSlide = tick; p.neSx = p.velocity.x / v; p.neSz = p.velocity.y / v;
      p.neOn = 0; delete p.neOff; delete p.neBuf;
    }
  }
  if (p.neBuf !== undefined && tick - p.neBuf > ticks(T.slideBufferSeconds)) delete p.neBuf;
  if (p.neSlide !== undefined) {
    if (tick - p.neSlide < ticks(T.slideSeconds)) {
      forced = true;
      p.velocity = { x: p.neSx * T.slideSpeed, y: p.neSz * T.slideSpeed };
      input = { ...input, crouch: true, jump: false };
    } else delete p.neSlide;
  }
  if (p.neOff !== undefined && tick >= p.neOff) delete p.neOff;
  const holstered = p.neOn === 1 || p.neOff !== undefined;
  if (holstered && input.fire) input = { ...input, fire: false };
  let runSpeed;
  if (p.neOn === 1 && tick - p.neAt >= ticks(T.equipSeconds)) { speed = T.sprintSpeed; runSpeed = T.unarmedRunSpeed * T.sprintSpeed; }
  return { input, forced, speed, runSpeed, holstered };
}

export function neonSnapshot(p, rules, tick, dt) {
  const sprinting = p.neOn === 1 && tick - p.neAt >= Math.round(neonTuning.equipSeconds / dt);
  // equipAt / awayAt: seconds (tick * dt) High Gear came out / was put away, for the first-person arms.
  return { highGear: p.neOn === 1, sprinting, sliding: p.neSlide !== undefined, holstered: p.neOn === 1 || p.neOff !== undefined, slideAge: p.neSlide === undefined ? null : tick - p.neSlide,
    equipAt: p.neAt === undefined ? null : p.neAt * dt, awayAt: p.neAwayAt === undefined ? null : p.neAwayAt * dt, unequipSeconds: neonTuning.unequipSeconds,
    // jumpAt / landAt: seconds she last left / touched the ground; crouchAt: last crouch press; crouching: held.
    // A ground change from this tick's movement is only stored on the next step: count it now.
    airborne: p.grounded !== true,
    jumpAt: p.grounded !== true && p.neGround === 1 ? tick * dt : p.neJumpAt === undefined ? null : p.neJumpAt * dt,
    landAt: p.grounded === true && p.neGround === 0 ? tick * dt : p.neLandAt === undefined ? null : p.neLandAt * dt,
    crouching: p.neCrouch === 1 && p.neSlide === undefined, crouchAt: p.neCrouchAt === undefined ? null : p.neCrouchAt * dt };
}
