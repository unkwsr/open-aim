// Chamber (13 Nov 2026): Headhunter on the Updraft key (Q) and Tour de Force on the Blade Storm key (X).
// Both are abilities, not bought guns: pressing the key takes the gun out on top of your loadout (a
// Vandal stays a Vandal), pressing it again or pressing a weapon key (1 / 2 / 3) puts it away and gives
// your gun back. Like Jett's kit here, uses are unlimited; each one keeps its own magazine while away.
// The swap itself lives in the simulation (CnrSARj_.js, marker chamber-kit-v1), next to Blade Storm.
// Player fields (all primitive, so they survive checkpoints): chActive 1 while either is out,
// chPrevWeapon / chPrevKnife what to give back, chAmmo_headhunter / chAmmo_tourdeforce magazines.
export const chamberWeapons = { q: 'headhunter', x: 'tourdeforce' };
export const chamberFields = ['chActive', 'chPrevWeapon', 'chPrevKnife', 'chAmmo_headhunter', 'chAmmo_tourdeforce'];
export const chamberAmmoKey = weapon => 'chAmmo_' + weapon;

// Any round with a gun (not knife-only rounds).
export function chamberRules(rules) {
  return rules && rules.weapon !== 'melee' ? { headhunter: true, tourdeforce: true, unlimited: true } : null;
}

export function chamberSnapshot(p) {
  return { active: p.chActive === 1 ? p.weapon ?? null : null };
}
