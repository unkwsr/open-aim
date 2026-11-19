// dash-bp-v1 / updraft-bp-v1 (16 Nov 2026): Dash and Updraft follow the decompiled Blueprints; old wiki gains gone.
// dash-short-v1 (17 Nov 2026): dashGain = Dash speed multiplier (like the Blueprint's DashVelocityMultiplier), user asked
// for Updraft -> Dash about 11 % shorter after an in-game comparison (sim: 18.09 -> 16.08 m), then +5 % (17 Nov):
// dashGain .945, sim 16.91 m. updraftGain is unused.
// Recovery times = State_Dashing .45 s, Updraft .35 + .25 s.
export const jettMovementTuning={dashGain:0.945,updraftGain:1,updraftRecovery:.6,dashRecovery:.45};
