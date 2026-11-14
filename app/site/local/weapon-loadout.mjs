// Primitive player fields survive snapshots, checkpoints and deterministic replay.
const sidearms=new Set(['classic','shorty','frenzy','ghost','sheriff','headhunter']);
export const weaponSlot=weapon=>sidearms.has(weapon)?'secondary':'primary';
export const loadoutFields=['slotPrimary','slotSecondary','slotPrimaryAmmo','slotSecondaryAmmo','slotActive'];
export function createWeaponLoadout(player,initial,spec){
 const key=slot=>slot==='secondary'?'slotSecondary':'slotPrimary';
 const ammoKey=slot=>slot==='secondary'?'slotSecondaryAmmo':'slotPrimaryAmmo';
 function ensure(){
  if(player.slotActive!==undefined)return;
  const current=player.weapon??initial,side=sidearms.has(current);
  player.slotPrimary=side||current==='melee'?null:current;
  player.slotSecondary=current==='melee'?null:side?current:'classic';
  player.slotPrimaryAmmo=player.slotPrimary?spec(player.slotPrimary).magazineSize:0;
  player.slotSecondaryAmmo=player.slotSecondary?spec(player.slotSecondary).magazineSize:0;
  player.slotActive=side?'secondary':'primary';
 }
 ensure();
 return {
  ensure,
  held(){ensure();return player.knife===1?'melee':player.slotActive;},
  weapon(slot){ensure();return player[key(slot)];},
  store(weapon,ammo){ensure();if(weapon==='bladestorm'||player.chActive===1/* chamber-kit-v1: Headhunter / Tour de Force out */||weapon==='melee'||player.knife===1)return;player[ammoKey(weaponSlot(weapon))]=ammo;},
  buy(weapon,current,ammo){this.store(current,ammo);const slot=weaponSlot(weapon);player[key(slot)]=weapon;player[ammoKey(slot)]=spec(weapon).magazineSize;player.slotActive=slot;return player[ammoKey(slot)];},
  select(slot,current,ammo){ensure();const weapon=player[key(slot)];if(!weapon)return null;this.store(current,ammo);player.slotActive=slot;return{weapon,ammo:player[ammoKey(slot)]};}
 };
}
