// Preserve the simulation's ADS rules; this module owns presentation state only.
import {Controller,tuning,blendSpaces,clipStates} from './graph-runtime.mjs';
import {by as getGun,Y as getStats,F as defaultFov,eg as defaultViewFov,aK as getMovement} from '/_assets/r20261021-1/next/js/BiMsX6Xn.js';
const stemOf=weapon=>weapon==='vandal'?'viewmodel':weapon;
const clamp=x=>Math.min(1,Math.max(0,x));
export class AdsSession {
 constructor(){this.crosshair={x:0,y:0};this.sight={x:0,y:0};this.offsetResult={crosshair:undefined,sight:undefined};this.reset();}
 reset(){this.visualShots=[];this.weapon=null;this.controller=null;this.lastTick=-1;this.level=0;this.world={from:defaultFov,to:defaultFov,now:defaultFov,progress:1,seconds:0,delay:0};this.first={from:1,to:1,now:1,progress:1,seconds:0,delay:0};}
 get enabled(){return globalThis.__aimAdsMode!=='legacy';}
 get frame(){return this.enabled?this.controller?.frame??null:null;}
 advance(snapshot,events,input,level,dt,settings,fallbackWeapon=null,perfectAccuracy=false){
  const p=snapshot.player,weapon=p.knife===1?null:p.weapon??fallbackWeapon,stem=stemOf(weapon),config=tuning(stem);
  if(!this.enabled||!config){if(this.weapon!==null||this.controller!==null)this.reset();return;}
  if(this.weapon!==weapon||snapshot.tick<=this.lastTick){this.reset();this.weapon=weapon;if(blendSpaces[stem]&&clipStates[stem])this.controller=new Controller(config,blendSpaces[stem],getGun(weapon),clipStates[stem]);}
  this.lastTick=snapshot.tick;
  const stats=getStats(weapon),ads=stats.ads;
  const targetLevel=Math.min(Math.max(0,level),ads.levels.length),entry=targetLevel?ads.levels[targetLevel-1]:null;
  if(targetLevel!==this.level){
   const seconds=targetLevel===0?ads.zoomOutSeconds:this.level===0?ads.transitionSeconds:ads.zoomSuccessiveSeconds;
   const curve=config.worldFovZoomInCurve,delay=targetLevel>0&&this.level===0&&curve?.length?curve[0][0]:0;
   for(const [channel,value,wait]of [[this.world,entry?defaultFov/entry.zoomMultiplier:defaultFov,delay],[this.first,entry?(entry.fov1PDegrees??defaultViewFov)/defaultViewFov:1,0]]){channel.from=channel.now;channel.to=value;channel.progress=0;channel.seconds=seconds;channel.delay=wait;}
   this.level=targetLevel;
  }
  for(const c of [this.world,this.first]){c.progress=c.seconds>0?Math.min(1,c.progress+dt/c.seconds):1;const u=clamp((c.progress-c.delay)/Math.max(1e-8,1-c.delay));c.now=c.from+(c.to-c.from)*u;}
  if(!this.controller)return;
  let shot=null;for(const event of events)if(event.kind==='shot'){const rate=stats.firingRatePerSecond*(targetLevel?ads.fireRateMultiplier:1);shot={tick:event.tick,totalErrorDeg:event.spreadDeg??0,kernelSeconds:rate>0?Math.round((1/dt)/rate)*dt:0};}
  const movement=getMovement(weapon),maxSpeed=(input.crouch?movement.crouchSpeed:movement.runSpeed*(input.walk?movement.walkMultiplier:1))*(targetLevel?ads.movementRatio:1);
  const degrees=180/Math.PI,speed=Math.hypot(p.velocity.x,p.velocity.y);
  this.controller.advance({seconds:snapshot.tick*dt,dt,yawDeg:-p.yaw*degrees,pitchDeg:p.pitch*degrees,recoilYawDeg:-p.recoilYaw*degrees,recoilPitchDeg:p.recoilPitch*degrees,camRecoilYawDeg:-(p.camRecoilYaw??p.recoilYaw)*degrees,camRecoilPitchDeg:(p.camRecoilPitch??p.recoilPitch)*degrees,trigger:!!input.fire,canFire:snapshot.reloadSince==null,shot,zoomed:targetLevel>0,unscopesOnShot:!!ads.unscopeAfterShot,moveType:p.grounded?input.crouch?3:input.walk?0:1:2,moving:input.forward!==0||input.strafe!==0,speed,maxSpeed:Math.max(.001,maxSpeed),verticalSpeed:p.verticalVelocity??0,crouchAmount:p.crouchAmount??0,leftHanded:settings.viewModelHand.current==='left',worldFovDeg:this.world.now,defaultWorldFovDeg:defaultFov});
  // Perfect-accuracy drills suppress simulation angles, but the weapon still needs its visual pitch animation.
  const frame=this.controller.frame;frame.adsTransitionSeconds=ads.transitionSeconds;frame.visualPitchFallback=perfectAccuracy;frame.visualPitchDegrees=0;
  if(perfectAccuracy){
   const now=snapshot.tick*dt,shots=this.visualShots;if(shot){shots.push(now);if(shots.length>25)shots.shift();}
   if(shots.length){let start=shots.length-1;while(start>0&&shots[start]-shots[start-1]<=.25)start--;const first=shots[start],last=shots.at(-1),interval=shots.length-1>start?last-shots.at(-2):0,end=Math.max(last+interval,first+.02);let pulse=now<first+.02?clamp((now-first)/.02):now<=end?1:Math.pow(Math.max(0,1-(now-end)/.25),2);frame.visualPitchDegrees=1.15*pulse;const half=frame.visualPitchDegrees*Math.PI/360,sin=Math.sin(half),cos=Math.cos(half),q=frame.adsMeshQ,x=q[0],y=q[1],z=q[2],w=q[3];q[0]=cos*x+sin*w;q[1]=cos*y-sin*z;q[2]=cos*z+sin*y;q[3]=cos*w-sin*x;}
  }
 }
 offsets(aspect,viewFov,active){const f=this.frame,result=this.offsetResult;if(!f||!active){result.crosshair=result.sight=undefined;return result;}const project=(q,alpha,hfov,out)=>{const sign=q[3]>=0?1:-1;let x=q[0]*alpha,y=q[1]*alpha,z=q[2]*alpha,w=q[3]*alpha+(1-alpha)*sign;const len=Math.hypot(x,y,z,w)||1;x/=len;y/=len;z/=len;w/=len;const dx=-2*(x*z+w*y),dy=-2*(y*z-w*x),dz=-(1-2*(x*x+y*y)),tanH=Math.tan(hfov*Math.PI/360);out.x=dz<-1e-6?dx/-dz/tanH/2:0;out.y=dz<-1e-6?-dy/-dz/(tanH/aspect)/2:0;};project(f.adsReticleQ,1,this.world.now,this.crosshair);project(f.adsMeshQ,f.zoomedAlpha,viewFov,this.sight);result.crosshair=this.crosshair;result.sight=this.sight;return result;}
 zoom(fallback){return this.enabled&&this.weapon?defaultFov/this.world.now:fallback;}
 viewFov(base,fallback){return this.enabled&&this.weapon?base*this.first.now:fallback;}
}
