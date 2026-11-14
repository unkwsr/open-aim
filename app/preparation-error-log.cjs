// Test-copy diagnostics only. The renderer cannot choose an output path.
const fs=require('node:fs/promises'),path=require('node:path');
exports.createPreparationErrorLog=function(root){
 let sequence=0;
 return async function write(report,source={}){
  if(!report||typeof report.error?.message!=='string'||typeof report.error?.stack!=='string')throw Error('Invalid preparation error report');
  const recordedAt=new Date().toISOString(),record={format:1,recordedAt,...report,source};
  const json=JSON.stringify(record,null,2);if(Buffer.byteLength(json)>1024*1024)throw Error('Preparation error report exceeds 1 MiB');
  await fs.mkdir(root,{recursive:true});
  const name=recordedAt.replace(/[:.]/g,'-')+'-'+process.pid+'-'+(++sequence)+'.json';
  await fs.writeFile(path.join(root,name),json+'\n',{flag:'wx'});return{name};
 };
};
exports.registerPreparationErrorLog=function({ipcMain,root,isLocal}){
 const write=exports.createPreparationErrorLog(root);
 ipcMain.handle('aim:preparation:error',(event,report)=>{
  const url=event.senderFrame?.url??event.sender.getURL();if(!isLocal(url))throw Error('Preparation diagnostics require the local test app');
  return write(report,{url});
 });
};
