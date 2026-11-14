const PREFIX='aim-score-outbox-v1:';
const LIMIT=200;
const keyFor=row=>PREFIX+row.userId+':'+row.runToken;
function valid(row) {
  return row&&Number.isSafeInteger(row.userId)&&row.userId>0&&typeof row.runToken==='string'&&/^[a-zA-Z0-9_-]{32,128}$/.test(row.runToken)
    &&typeof row.mapId==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(row.mapId)
    &&Number.isFinite(row.score)&&row.score>=0&&row.score<=1e9&&['asc','desc'].includes(row.sortMode)
    &&['success','fail','stopped'].includes(row.result)&&typeof row.displayScore==='string'&&/^[0-9 .,/%:+-]{1,40}$/.test(row.displayScore)
    &&Number.isFinite(row.queuedAt)&&Number.isFinite(row.expiresAt);
}

// Per-entry storage prevents one tab overwriting another tab's queued scores.
// Run tickets are account-bound, not login credentials. No cookies/passwords,
// email addresses, arbitrary history, or newly minted run tickets are retained.
export function createScoreOutbox({storage,now=()=>Date.now()}={}) {
  const active=new Map();let available=Boolean(storage);
  function rows(userId) {
    const result=[];
    try {
      if(!storage)return result;
      for(let i=0;i<storage.length;i++){
        const key=storage.key(i);if(!key?.startsWith(PREFIX))continue;
        let row;try{row=JSON.parse(storage.getItem(key));}catch{continue;}
        if(valid(row)&&key===keyFor(row)&&(userId===undefined||row.userId===userId))result.push(row);
        if(result.length>=LIMIT)break;
      }
    }catch{available=false;}
    return result.sort((a,b)=>a.queuedAt-b.queuedAt);
  }
  function write(row) {try{storage.setItem(keyFor(row),JSON.stringify(row));return true;}catch{available=false;return false;}}
  function enqueue(input) {
    const row={userId:input.userId,runToken:input.runToken,mapId:input.mapId,score:input.score,displayScore:input.displayScore,sortMode:input.sortMode,result:input.result,queuedAt:now(),expiresAt:input.expiresAt};
    if(!valid(row))return false;
    const all=rows(),existing=all.find(item=>keyFor(item)===keyFor(row));
    if(existing)return existing.score===row.score&&existing.sortMode===row.sortMode&&existing.result===row.result;
    if(all.length>=LIMIT)return false;
    return write(row);
  }
  function remove(userId,runToken) {try{storage?.removeItem(keyFor({userId,runToken}));}catch{available=false;}}
  function snapshot(userId) {const all=rows(userId);return {pending:all.filter(row=>!row.blocked).length,blocked:all.filter(row=>row.blocked).length,available};}
  function drain(userId,send,onSaved=()=>{},limit=5) {
    if(active.has(userId))return active.get(userId);
    const task=(async()=>{
      let saved=0,attempts=0,retryAfterMs=15000;
      for(const row of rows(userId)) {
        if(row.blocked)continue;
        // Ask the authoritative server even after the local deadline: clocks
        // can differ, and an earlier lost response may already have saved it.
        if(attempts>=limit)break;
        attempts++;
        let response;
        try {response=await send({runToken:row.runToken,score:row.score,displayScore:row.displayScore,sortMode:row.sortMode,result:row.result});}
        catch(error) {
          if(['INVALID_RUN','RUN_ALREADY_USED','INVALID_SCORE'].includes(error.code)) {write({...row,blocked:'invalid_run'});continue;}
          retryAfterMs=Math.max(15000,Math.min(600000,error.retryAfterMs||0));break;
        }
        if(!response?.success){break;}
        remove(userId,row.runToken);saved++;
        try{onSaved(row,response);}catch{/* Delivery is acknowledged independently of UI. */}
      }
      return {...snapshot(userId),saved,retryAfterMs};
    })().finally(()=>active.delete(userId));
    active.set(userId,task);return task;
  }
  return Object.freeze({enqueue,remove,snapshot,drain});
}
