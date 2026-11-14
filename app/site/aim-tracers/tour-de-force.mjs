import data from './tour-de-force-data.mjs';
// One reusable beam batch. Parameters come from the exported enabled Line emitter.
export function createTourTracer(T,options={}){
 const capacity=16,positions=new Float32Array(capacity*12),uv=new Float32Array(capacity*8),attributes=new Float32Array(capacity*12),indices=new Uint16Array(capacity*6);
 for(let i=0;i<capacity;i++){const v=i*4;indices.set([v,v+1,v+2,v+2,v+1,v+3],i*6);uv.set([0,0,0,1,1,0,1,1],i*8);}
 const geometry=new T.BufferGeometry(),position=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage),params=new T.BufferAttribute(attributes,3).setUsage(T.DynamicDrawUsage);
 geometry.setAttribute('position',position);geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setAttribute('beamParams',params);geometry.setIndex(new T.BufferAttribute(indices,1));geometry.setDrawRange(0,0);
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:2,side:2,toneMapped:false,
  uniforms:{teamColor:{value:new T.Vector3(data.teamColor.R,data.teamColor.G,data.teamColor.B)}},
  vertexShader:'attribute vec3 beamParams;varying vec2 vUv;varying vec3 vBeam;void main(){vUv=uv;vBeam=beamParams;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 vUv;varying vec3 vBeam;uniform vec3 teamColor;
   void main(){float edge=abs(vUv.y-.5);float core=1.-smoothstep(.008,.035,edge);
    float wave=sin(vUv.x*vBeam.z*6.283185+vBeam.x*8.)*.12;
    float ribbon=1.-smoothstep(.012,.055,abs(vUv.y-.5-wave));
    float halo=exp(-edge*edge*180.);float a=(core*.95+ribbon*.28+halo*.12)*vBeam.y;
    vec3 color=teamColor*(core*.8+ribbon*.5+halo*.15)+vec3(.5,.3,.7)*core;
    gl_FragColor=vec4(color,a);
    #include <colorspace_fragment>
   }`});
 const mesh=new T.Mesh(geometry,material),scene=new T.Scene();mesh.frustumCulled=false;scene.add(mesh);
 const pool=Array.from({length:capacity},()=>({live:false,start:new T.Vector3(),end:new T.Vector3(),dir:new T.Vector3(),at:0}));
 const pending=[],eye=new T.Vector3(),view=new T.Vector3(),side=new T.Vector3(),up=new T.Vector3();let state=null,cursor=0,previousTime=null,disposed=false,drawn=0;
 function sample(table,t,index=0){const x=Math.max(0,(t-(table.TimeBias??0))*(table.TimeScale??1)),a=Math.min(table.EntryCount-1,Math.floor(x)),b=Math.min(table.EntryCount-1,a+1),u=x-Math.floor(x),stride=table.EntryStride;return table.Values[a*stride+index]*(1-u)+table.Values[b*stride+index]*u;}
 function clear(){pending.length=0;pool.forEach(p=>p.live=false);geometry.setDrawRange(0,0);drawn=0;}
 return {
  shoot(shot){if(disposed||shot.source==='enemy'||shot.weapon!=='tourdeforce')return;pending.push(shot);if(pending.length>capacity)pending.shift();},
  frame(next){if(previousTime!==null&&next.time<previousTime||!next.enabled)clear();previousTime=next.time;state=next;},
  render(renderer,camera){if(disposed||!state?.enabled)return;const now=state.time;
   for(let i=0;i<pending.length;){const shot=pending[i];if(shot.at>now){i++;continue;}pending.splice(i,1);const muzzle=options.muzzle?.(camera);if(!muzzle)continue;
    const p=pool[cursor++%capacity];p.start.copy(muzzle);p.end.copy(shot.hitPoint??shot.origin);if(!shot.hitPoint)p.end.addScaledVector(p.dir.copy(shot.direction).normalize(),100);p.dir.subVectors(p.end,p.start);if(p.dir.lengthSq()<.001)continue;p.dir.normalize();
    if(options.rayBlocked?.(p.start,p.start.clone().addScaledVector(p.dir,.1)))continue;p.at=shot.at;p.live=true;
   }
   eye.setFromMatrixPosition(camera.matrixWorld);up.setFromMatrixColumn(camera.matrixWorld,1);let n=0;
   for(const p of pool){if(!p.live)continue;const age=now-p.at;if(age<0||age>=data.lifetime){p.live=false;continue;}const life=age/data.lifetime,alpha=sample(data.alpha,life);if(alpha<.001)continue;
    const width=data.width*.5*sample(data.size,life);view.subVectors(eye,p.start);side.crossVectors(p.dir,view);if(side.lengthSq()<1e-9)side.copy(up);side.normalize().multiplyScalar(width);
    const a=n*12;positions.set([p.start.x+side.x,p.start.y+side.y,p.start.z+side.z,p.start.x-side.x,p.start.y-side.y,p.start.z-side.z,p.end.x+side.x,p.end.y+side.y,p.end.z+side.z,p.end.x-side.x,p.end.y-side.y,p.end.z-side.z],a);
    const colorRamp=sample(data.color,life);for(let j=0;j<4;j++)attributes.set([age,alpha*colorRamp,p.start.distanceTo(p.end)/data.tileDistance],a+j*3);n++;
   }
   drawn=n;geometry.setDrawRange(0,n*6);if(!n)return;position.needsUpdate=true;params.needsUpdate=true;const auto=renderer.autoClear;renderer.autoClear=false;try{renderer.render(scene,camera);}finally{renderer.autoClear=auto;}
  },clear,stats:()=>({live:pool.filter(p=>p.live).length,pending:pending.length,drawn,source:data.source,lifetime:data.lifetime}),
  dispose(){disposed=true;clear();geometry.dispose();material.dispose();}
 };
}
