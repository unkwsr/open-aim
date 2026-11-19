const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const route of ['app/site/next/js/','app/site/_assets/r20261021-1/next/js/']){
  const file=path.join(root,route,'DXHU7cEs.js');let text=fs.readFileSync(file,'utf8');
  if(text.includes('/* gaia-reflex-v1 */')){
    const old='__aimReflexDevice.pose(open,openAt,frame?.unzoomAt??null,bz.seconds);';
    if(text.includes(old))fs.writeFileSync(file,text.replace(old,'__aimReflexDevice.pose(open,openAt,frame?.unzoomAt??null,bz.seconds,bz.hidden!==true&&!bL&&!bA?.detained);'));
    continue;
  }
  const backup=path.join(root,'backups/gaia-ads',route,'DXHU7cEs.js');fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.copyFileSync(file,backup);
  function replace(from,to){assert.equal(text.split(from).length-1,1,from);text=text.replace(from,to);}
  text="/* gaia-reflex-v1 */import {loadSkinReflex as __aimLoadSkinReflex,createSkinReflex as __aimCreateSkinReflex} from '/aim-ads/reflex/gaia-runtime.mjs';\n"+text;
  replace('await __aimLoadReflex(__aimStem)', 'await __aimLoadSkinReflex(__aimStem,J.skin?.id)');
  replace('__aimCreateReflex(H.reflex,ac,Re)', '__aimCreateSkinReflex(H.reflex,ac,Re)');
  replace('__aimReflexGlow=__aimReflexDevice&&(H.fpGraph||__aimReflexVisible)?', '__aimReflexGlow=__aimReflexDevice&&!H.reflex?.data.gaiaReflex&&(H.fpGraph||__aimReflexVisible)?');
  replace('__aimReflexDevice.mesh.visible=H.fpGraph?!J.skin?.id:false;', '__aimReflexDevice.mesh.visible=H.reflex?.data.gaiaReflex?bz.hidden!==true:H.fpGraph?!J.skin?.id:false;');
  replace('__aimReflexDevice.pose(open,openAt,frame?.unzoomAt??null,bz.seconds);','__aimReflexDevice.pose(open,openAt,frame?.unzoomAt??null,bz.seconds,bz.hidden!==true&&!bL&&!bA?.detained);');
  replace("'reflexStats'(){return {device:!!__aimReflexDevice,", "'reflexStats'(){return {gaia:__aimReflexDevice?.gaiaStats?.()??null,device:!!__aimReflexDevice,");
  fs.writeFileSync(file,text);
}
