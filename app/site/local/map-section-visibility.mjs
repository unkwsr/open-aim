import {createBotVisibility} from '../aim-ui/bot-visibility.mjs';
import {getMapSections,applyMapSections,restoreMapSection,mapSectionStateValid,releaseMapSections} from './map-sections.mjs';
export function attachMapSectionVisibility(stage,{proof=createBotVisibility({queryBudget:4,retestFrames:30})}={}){
 const original={setMapVisual:stage.setMapVisual,render:stage.render,dispose:stage.dispose};
 // Opt in with F9: player comparison found smoother motion without this work.
 let currentMap=null,states=[],entries=[],generation=0,cursor=0,ready=false,enabled=false;
 let stats={hidden:0,sections:0,frustumHidden:0,occlusionHidden:0,indexUploadBytes:0};
 const view=stage.camera.projectionMatrix.clone(),planes=new Float64Array(24),planeLengths=new Float64Array(6);
 function inView(sphere){const {center:c,radius:r}=sphere;for(let i=0;i<24;i+=4)if(planes[i]*c.x+planes[i+1]*c.y+planes[i+2]*c.z+planes[i+3]<-(r+.02)*planeLengths[i>>2])return false;return true;}
 function restore(){for(const state of states)restoreMapSection(state);stats.hidden=0;}
 stage.setMapVisual=function(map){
  restore();if(currentMap&&map!==currentMap)releaseMapSections(currentMap,states);currentMap=map;
  const token=++generation;ready=false;original.setMapVisual.call(stage,map);
  states=getMapSections(map);entries=states.flatMap(state=>state.sections.map(section=>({...section,state})));
  for(const state of states)state.nextHidden=[];
  stats={hidden:0,sections:entries.length,frustumHidden:0,occlusionHidden:0,indexUploadBytes:0};
  proof.setMap(null);proof.setMap(map).then(()=>{if(token===generation)ready=proof.snapshot().ready}).catch(()=>{});
 };
 stage.render=function(){
  const capture=globalThis.__aimDetailedPerformance,measure=capture?.enabled,started=measure?performance.now():0;
  stats.hidden=0;stats.frustumHidden=0;stats.occlusionHidden=0;stats.indexUploadBytes=0;
  // A shadow refresh needs off-camera casters too. Native shadows are cached;
  // restore full topology for their refresh, then cull only normal camera draws.
  const shadows=stage.renderer.shadowMap,shadowRefresh=shadows.enabled&&(shadows.autoUpdate!==false||shadows.needsUpdate);
  if(!enabled||shadowRefresh)restore();
  else{
   stage.updateMapVisibility(stage.camera,false);proof.begin(stage.camera);
   const m=view.multiplyMatrices(stage.camera.projectionMatrix,stage.camera.matrixWorldInverse).elements;
   for(let axis=0;axis<3;axis++)for(let sign=-1;sign<=1;sign+=2){const at=(axis*2+(sign===1?1:0))*4;for(let column=0;column<4;column++)planes[at+column]=m[column*4+3]+sign*m[column*4+axis];planeLengths[at>>2]=Math.hypot(planes[at],planes[at+1],planes[at+2])}
   for(const state of states){state.frameValid=mapSectionStateValid(state);state.nextHidden.length=0;}
   for(let n=0;n<entries.length;n++){
    const entry=entries[(cursor+n)%entries.length],state=entry.state;
    if(!state.frameValid||!state.object.visible)continue;
    const {center,radius}=entry.sphere;
    const outside=!inView(entry.sphere),occluded=ready&&!outside&&proof.hidden(entry,center.x,center.y,center.z,radius);
    if(outside||occluded){state.nextHidden.push(entry.id);stats.hidden++;if(outside)stats.frustumHidden++;else stats.occlusionHidden++;}
   }
   cursor=(cursor+4)%Math.max(1,entries.length);
   for(const state of states){
    if(state.frameValid)stats.indexUploadBytes+=applyMapSections(state,state.nextHidden.sort((a,b)=>a-b));
    else restoreMapSection(state);
   }
  }
  if(measure)capture.measure('mapCullingCpuMs',performance.now()-started);
  return original.render.call(stage);
 };
 stage.mapSectionVisibility={get metrics(){return stats},get enabled(){return enabled},setEnabled(value){restore();enabled=!!value},snapshot:()=>({...proof.snapshot(),...stats,ready,enabled})};
 stage.dispose=function(){restore();generation++;proof.setMap(null);if(currentMap)releaseMapSections(currentMap,states);states=[];entries=[];return original.dispose.call(stage)};
 return stage;
}
