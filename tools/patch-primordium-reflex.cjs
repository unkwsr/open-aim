const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const route of ['app/site/next/js/','app/site/_assets/r20261021-1/next/js/']){
 const file=path.join(root,route,'DXHU7cEs.js');let text=fs.readFileSync(file,'utf8');if(text.includes('/* primordium-reflex-v1 */'))continue;
 const backup=path.join(root,'backups/primordium-ads',route,'DXHU7cEs.js');fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.copyFileSync(file,backup);
 function replace(from,to){assert.equal(text.split(from).length-1,1,from);text=text.replace(from,to);}
 replace('!H.reflex?.data.gaiaReflex','!(H.reflex?.data.gaiaReflex||H.reflex?.data.primordiumReflex)');
 replace('H.reflex?.data.gaiaReflex?bz.hidden!==true','(H.reflex?.data.gaiaReflex||H.reflex?.data.primordiumReflex)?bz.hidden!==true');
 replace("'reflexStats'(){return {gaia:","'reflexStats'(){return {primordium:__aimReflexDevice?.primordiumStats?.()??null,gaia:");
 fs.writeFileSync(file,'/* primordium-reflex-v1 */'+text);
}
