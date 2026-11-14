// Adapt the reflected Wushu Glide force settings to metre-based movement.
// Force-module execution is unavailable; these bounded-force semantics are
// a reconstruction, not recovered Blueprint code.
export const glideTuning=Object.freeze({gravityScale:.06,maxSpeedRatio:.8,baseSpeed:5.2,
 maxDownwardSpeed:-2.1,maxAcceleration:5.5,response:30,minimumFloorDistance:.35,wallDisableSeconds:.1});
export function stepGlideVelocity(p,input,dt,runSpeed,gravity,previousVertical){
 const t=glideTuning,verticalForce=Math.max(-t.maxAcceleration,Math.min(t.maxAcceleration,
  gravity+(t.maxDownwardSpeed-previousVertical)*t.response));
 // Gravity was integrated by the solver immediately before this force.
 p.verticalVelocity+=verticalForce*dt;
 const maxSpeed=Math.min(t.baseSpeed,Math.max(0,runSpeed)*t.maxSpeedRatio);
 const length=Math.hypot(input.strafe,input.forward),speed=Math.hypot(p.velocity.x,p.velocity.y);
 let x=p.velocity.x,y=p.velocity.y;
 if(length>0){const right=input.strafe/length,forward=input.forward/length;
  x=(Math.cos(p.yaw)*right-Math.sin(p.yaw)*forward)*maxSpeed;
  y=(-Math.sin(p.yaw)*right-Math.cos(p.yaw)*forward)*maxSpeed;
 }else if(speed>maxSpeed&&speed>0){x*=maxSpeed/speed;y*=maxSpeed/speed;}
 const dx=x-p.velocity.x,dy=y-p.velocity.y,distance=Math.hypot(dx,dy),step=Math.min(1,
  t.response*dt,distance>0?t.maxAcceleration*dt/distance:1);
 p.velocity.x+=dx*step;p.velocity.y+=dy*step;
}
