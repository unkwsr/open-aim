import {jettRules} from './jett-kit.mjs';
import {pickedAgent} from './neon-kit.mjs';
import {chamberRules} from './chamber-kit.mjs';
// Plan from a snapshot that already includes opening buys. No simulation/RNG.
export function planLoadoutWarmup({player={},current,starting,scene={},pendingBuys=[],stemFor=w=>w}={}){
 const result=new Set();
 const add=weapon=>{if(typeof weapon!=='string'||weapon==='melee'||weapon==='knife')return;const stem=stemFor(weapon);if(stem&&stem!=='knife')result.add(stem);};
 add(current);add(starting);add(player.weapon);add(player.slotPrimary);add(player.slotSecondary);add(scene.rules?.weapon);
 for(const actor of scene.actors??[])add(actor.body?.weapon);
 for(const drop of scene.drops??[])add(drop.weapon);
 for(const prop of scene.props??[])if(prop.kind==='weapon'||prop.type==='weapon')add(prop.weapon);
 // Blade Storm is reachable through an ability, so it never appears in the
 // owned weapon slots before activation. Use the simulation's eligibility rule.
 // The caller also retains every planned key across weapon switches.
 if(pickedAgent()==='chamber'){if(chamberRules(scene.rules??{}))add('headhunter'),add('tourdeforce');}
 else if(jettRules(scene.rules??{})?.bladestorm)add('bladestorm');
 // Accepted buys are queued until a physics step; the paused snapshot still
 // reports the old weapon. Prepare the queued choice without advancing ticks.
 for(const weapon of pendingBuys)add(weapon);
 return [...result];
}
