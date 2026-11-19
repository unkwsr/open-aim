// Jett glide = ForceModule_Wushu_Glide Blueprint (FModel export with ReadScriptData, 2026-11-16), cm -> m.
// glide-bp-v1. Decompiled with tools/kismet/decompile.cjs:
//  DetermineCanGlide: BounceOffDisableTimeRemaining <= 0 && jump held && !Disarmed && !Suppressed
//                     && MovementMode == Falling && Velocity.Z <= GlideMaxVerticalSpeed (0)
//  TickForceModule:   modifiers (Gravity x0.06, MaxSpeed x0.8) are on whenever CanGlide
//  ShouldApplyForce:  CanGlide && FindFloor distance >= MinimumFloorDistance (35 cm)
//  GetDesiredVelocity: (CurrentAcceleration * BaseGlideSpeed).xy, FMax(Velocity.Z, MaxDownwardSpeed)
//  GetAppliedForce:   ClampVectorSize((desired - Velocity) * ForceMultiplier, 0, MaxForce)
// Not in the Blueprint (native ShooterCharacterMovement, assumed): acceleration = input direction (unit),
// force is applied as velocity += force * dt after gravity.
export const glideTuning=Object.freeze({gravityScale:.06,maxSpeedRatio:.8,baseSpeed:5.2,
 maxDownwardSpeed:-2.1,maxAcceleration:5.5,response:30,minimumFloorDistance:.35,wallDisableSeconds:.1});
export function stepGlideVelocity(p,input,dt,runSpeed,_gravity,_previousVertical){
 if(p.glideForce===0)return; // under 35 cm: modifiers only, no force
 const t=glideTuning,speed=Math.min(t.baseSpeed,Math.max(0,runSpeed)*t.maxSpeedRatio);
 const length=Math.hypot(input.strafe,input.forward);
 let wx=0,wy=0;
 if(length>0){const right=input.strafe/length,forward=input.forward/length;
  wx=(Math.cos(p.yaw)*right-Math.sin(p.yaw)*forward)*speed;
  wy=(-Math.sin(p.yaw)*right-Math.cos(p.yaw)*forward)*speed;
 }
 const wz=Math.max(p.verticalVelocity,t.maxDownwardSpeed);
 let fx=(wx-p.velocity.x)*t.response,fy=(wy-p.velocity.y)*t.response,fz=(wz-p.verticalVelocity)*t.response;
 const size=Math.hypot(fx,fy,fz);
 if(size>t.maxAcceleration){const k=t.maxAcceleration/size;fx*=k;fy*=k;fz*=k;}
 const k=Math.min(dt,1/t.response); // response * dt < 1 at the game's tick rate: never steps past the target
 p.velocity.x+=fx*k;p.velocity.y+=fy*k;p.verticalVelocity+=fz*k;
}
