import {jettMovementTuning} from './jett-movement-tuning.mjs';
import {glideTuning} from './jett-glide.mjs';
// Deterministic extra Jett state. Positions and velocities are in metres.
export const jettFields=['upCharges','upAt','upY','upZ','upUntil','bsActive','bsKnives','bsPrevWeapon','bsPrevKnife','bsBurst','bsLastBurst','bsLastThrow','gliding','glideForce','glideBlockedUntil'];
export function jettRules(rules){return rules.playerMovable&&rules.weapon!=='melee'?{tailwind:true,cloudburst:true,updraft:true,bladestorm:true,...rules.jett,unlimited:true}:rules.jett?{...rules.jett,unlimited:true}:null;}
export function stepJettMovement(p,rules,tick,dt,input,edges,blocked,floorDistance=Infinity,glideBlocked=blocked){
 if(!rules){p.gliding=0;p.glideForce=0;return;}
 if(edges.updraft&&rules.updraft&&!blocked&&(rules.unlimited||(p.upCharges??1)>0)&&tick>=(p.upUntil??0)){
  if(!rules.unlimited)p.upCharges=(p.upCharges??1)-1;
  p.upAt=tick;p.upY=p.position.y;p.upUntil=tick+Math.ceil(jettMovementTuning.updraftRecovery/dt);
  // updraft-bp-v1 (ForceModule_Wushu_Q_SelfBoost, decompiled): DesiredZVelocity is read ONCE at the start from
  // GetJumpHeight (height above the jump start): 1150 cm/s on the ground -> 700 cm/s at 200 cm.
  const jumpHeight=p.grounded?0:Math.max(0,p.position.y-(p.jumpY0??p.position.y));
  p.upZ=11.5-4.5*Math.min(1,jumpHeight/2);
 }
 const upTime=p.upAt===undefined?-1:(tick-p.upAt)*dt;
 if(upTime>=.1&&upTime<.35){
  // Module lasts .35 s (ApplyForceModuleState), force from StartDelay .1 s. Module time is 0-1 of the module.
  // Vertical: lift to desired = curve(module time) x DesiredZVelocity, only ever up (FClamp 0..MaxImpulse 20 m/s).
  // Horizontal: Normal(move input) x HorizontalForce (10 m/s^2), no braking.
  const desired=updraftTimeCurve(upTime/.35)*(p.upZ??11.5);
  p.verticalVelocity+=Math.min(20,Math.max(0,desired-p.verticalVelocity));
  const length=Math.hypot(input.strafe,input.forward);
  if(length>0){const r=input.strafe/length,f=input.forward/length,k=10*dt;
   p.velocity={x:p.velocity.x+(Math.cos(p.yaw)*r-Math.sin(p.yaw)*f)*k,y:p.velocity.y+(-Math.sin(p.yaw)*r-Math.cos(p.yaw)*f)*k};}
  p.grounded=false;p.airSpeedCap=Math.max(p.airSpeedCap??0,Math.hypot(p.velocity.x,p.velocity.y));
 }
 // glide-bp-v1: CanGlide (gravity x0.06) does not look at the floor; only the force stops under 35 cm.
 // dash-glide-v1: glide waits only for the Dash push (0.25 s), not the whole 0.45 s Dash state.
 p.gliding=!glideBlocked&&input.glide&&!p.grounded&&p.verticalVelocity<=0&&tick>=(p.glideBlockedUntil??0)?1:0;
 p.glideForce=p.gliding&&floorDistance>=glideTuning.minimumFloorDistance?1:0;
}
function updraftTimeCurve(t){
 // Curve_Wushu_Q_CycloneBoost_VelocityZ (ExternalCurve of ZVelocityByModuleTime): cubic (0,0)->(.35,.1), linear ->(1,1).
 t=Math.min(1,Math.max(0,t));
 if(t>=.35)return .1+(t-.35)/.65*.9;
 const u=t/.35,u2=u*u,u3=u2*u;
 return (u3-2*u2+u)*.35*.5681018+(-2*u3+3*u2)*.1+(u3-u2)*.35*.6187686;
}
export function jettExtraSnapshot(p,rules,tick){return{updraft:{charges:rules.unlimited?1:p.upCharges??1,at:p.upAt??null,active:tick<(p.upUntil??0)},bladestorm:{active:p.bsActive===1,knives:p.bsKnives??5},gliding:p.gliding===1};}
