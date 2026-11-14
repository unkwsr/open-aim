// Render-completion intervals only. No animation loop, DOM or GPU synchronization.
export function createFrameMetrics(capacity=32768) {
  const times=new Float64Array(capacity), intervals=new Float64Array(capacity);
  let cursor=0,size=0,last=null,start=null;
  function reset(){cursor=0;size=0;last=null;start=null;}
  function frame(at){
    if(!Number.isFinite(at))return;
    if(last===null){start=last=at;return;}
    if(at<=last)return;
    times[cursor]=at;intervals[cursor]=at-last;last=at;
    cursor=(cursor+1)%capacity;size=Math.min(size+1,capacity);
  }
  function snapshot(at){
    if(!Number.isFinite(at)||last===null||!size)return null;
    const long=[];let total=0,worst=0,recent=0;
    for(let i=0;i<size;i++){
      const j=(cursor-1-i+capacity)%capacity,t=times[j],dt=intervals[j];
      if(t<=at-5000)break;
      long.push(dt);worst=Math.max(worst,dt);
      if(t>at-1000){recent++;total+=dt;}
    }
    // Do not silently substitute monitor callbacks when game frames stop.
    if(!recent)return null;
    long.sort((a,b)=>b-a);
    const count=Math.max(1,Math.ceil(long.length*.01));
    const slowMean=long.slice(0,count).reduce((a,b)=>a+b,0)/count;
    const retained=long.reduce((a,b)=>a+b,0);
    return {fps:recent*1000/total,frameMs:total/recent,
      onePercentLow:slowMean?1000/slowMean:null,p99Ms:long[Math.max(0,Math.ceil(long.length*.01)-1)]??null,
      worstMs:worst,frames:long.length,ready:at-start>=500&&total>=250,
      lowReady:at-start>=5000&&retained>=4500};
  }
  return {frame,snapshot,reset};
}
