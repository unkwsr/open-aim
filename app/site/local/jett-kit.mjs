import {jettMovementTuning} from './jett-movement-tuning.mjs';
import {glideTuning} from './jett-glide.mjs';
// Deterministic extra Jett state. Positions and velocities are in metres.
export const jettFields=['upCharges','upAt','upY','upUntil','bsActive','bsKnives','bsPrevWeapon','bsPrevKnife','bsBurst','bsLastBurst','bsLastThrow','gliding','glideBlockedUntil'];
export function jettRules(rules){return rules.playerMovable&&rules.weapon!=='melee'?{tailwind:true,cloudburst:true,updraft:true,bladestorm:true,...rules.jett,unlimited:true}:rules.jett?{...rules.jett,unlimited:true}:null;}
export function stepJettMovement(p,rules,tick,dt,input,edges,blocked,floorDistance=Infinity){
 if(!rules){p.gliding=0;return;}
 if(edges.updraft&&rules.updraft&&!blocked&&(rules.unlimited||(p.upCharges??1)>0)&&tick>=(p.upUntil??0)){
  if(!rules.unlimited)p.upCharges=(p.upCharges??1)-1;
  p.upAt=tick;p.upY=p.position.y;p.upUntil=tick+Math.ceil(jettMovementTuning.updraftRecovery/dt);
 }
 const upTime=p.upAt===undefined?-1:(tick-p.upAt)*dt;
 if(upTime>=.1&&upTime<.35){
  // The native force module is active for .35 s, with a .1 s start delay.
  // Desired speed falls from 1150 to 700 cm/s over the first 200 cm gained.
  // This reconstructs the exposed force data; Blueprint execution is unavailable.
  const height=Math.max(0,p.position.y-(p.upY??p.position.y));
  const desired=11.5-4.5*Math.min(1,height/2);
  const timeScale=updraftTimeCurve(upTime);
  p.verticalVelocity=desired*(1-timeScale)*jettMovementTuning.updraftGain;
  p.grounded=false;p.airSpeedCap=Math.max(p.airSpeedCap??0,Math.hypot(p.velocity.x,p.velocity.y));
 }
 p.gliding=!blocked&&input.glide&&!p.grounded&&p.verticalVelocity<0&&
  floorDistance>glideTuning.minimumFloorDistance&&tick>=(p.glideBlockedUntil??0)?1:0;
}
function updraftTimeCurve(time){
 // First exported cubic segment of Curve_Wushu_Q_CycloneBoost_VelocityZ.
 const u=Math.min(1,Math.max(0,time/.35)),u2=u*u,u3=u2*u;
 return (u3-2*u2+u)*.35*.5681018+(-2*u3+3*u2)*.1+(u3-u2)*.35*.6187686;
}
export function jettExtraSnapshot(p,rules,tick){return{updraft:{charges:rules.unlimited?1:p.upCharges??1,at:p.upAt??null,active:tick<(p.upUntil??0)},bladestorm:{active:p.bsActive===1,knives:p.bsKnives??5},gliding:p.gliding===1};}
