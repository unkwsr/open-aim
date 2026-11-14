import {Matrix4,Vector3,Quaternion} from '/studio/vendor/three.module.js';

// Keep Recon's authored support-arm pose in gun space after native pose sampling.
// Animation buffers remain untouched; only reload releases the support hand.
// Equip keeps the grip so melee-to-Phantom switches do not change hand poses.
export function createReconGrip(manifest,scene,bones,gunRoot){
 if(!['recon-phantom','recon-phantom-red'].includes(manifest.skin?.id)||manifest.anims.armsIdle.source!=='FP_Core_Carbine_SpecOps_IdlePose_Foregrip02_Verticle')return null;
 const clavicle=bones.find(b=>b.name==='L_Clavicle');
 if(!clavicle||!gunRoot)return null;
 scene.updateMatrixWorld(true);
 const reference=new Matrix4().copy(gunRoot.matrixWorld).invert().multiply(clavicle.matrixWorld);
 const branch=[];clavicle.traverse(b=>{if(b.isBone)branch.push({bone:b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()});});
 const local=new Matrix4(),p=new Vector3(),q=new Quaternion(),s=new Vector3();
 let weight=1,lastTime=null,retarget=null;
 return {
  update(time,holding,releaseElapsed,retargetBones){
   const dt=lastTime===null||time<lastTime?0:Math.min(.05,time-lastTime);lastTime=time;
   if(holding)weight=Math.min(1,weight+dt/.10);
   else weight=Math.min(weight,Math.max(0,1-(releaseElapsed??.08)/.08));
   if(weight<=0)return;
   scene.updateMatrixWorld(true);
   local.copy(clavicle.parent.matrixWorld).invert().multiply(gunRoot.matrixWorld).multiply(reference);
   local.decompose(p,q,s);
   for(const entry of branch){
    const root=entry.bone===clavicle;
    entry.bone.position.lerp(root?p:entry.p,weight);
    entry.bone.quaternion.slerp(root?q:entry.q,weight);
    entry.bone.scale.lerp(root?s:entry.s,weight);
   }
   // Jett is retargeted before this pass; copy the corrected branch to her rig.
   if(retargetBones){
    retarget??=branch.map(entry=>({from:entry.bone,to:retargetBones.find(b=>b.name===entry.bone.name)}));
    for(const {from,to} of retarget)if(to){to.position.copy(from.position);to.quaternion.copy(from.quaternion);to.scale.copy(from.scale);}
   }
   // The loader refreshes both arm rigs and their skeletons immediately after
   // this pass; the renderer refreshes the scene before drawing.
  }
 };
}
