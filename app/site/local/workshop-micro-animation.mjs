// target-workshop-fast-drills-v2
// Fast, task-specific Target Workshop card previews. Visuals do not affect gameplay.
const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const easeOut = value => 1 - (1 - clamp(value, 0, 1)) ** 4;

export function workshopPreviewKind(plan) {
  if (plan?.kind === 'grid') return 'grid';
  if (plan?.kind === 'area' && plan.alive >= 5 && plan.aspect >= 1.65) return 'streak';
  if (plan?.kind === 'area' && plan.alive >= 5) return 'six';
  if (plan?.kind === 'area' && plan.alive <= 3) return 'three';
  return 'micro';
}

const areaPool = [
  [-.75,-.52],[-.35,-.61],[.18,-.55],[.71,-.47],
  [-.6,-.14],[-.06,-.2],[.52,-.12],[-.78,.25],
  [-.3,.34],[.25,.27],[.75,.36],[-.12,.59]
];
const widePool = [
  [-.79,-.45],[.72,.48],[.62,-.5],[-.68,.37],
  [.05,-.59],[-.08,.58],[.78,-.07],[-.77,.04],
  [.38,.37],[-.31,-.34]
];
const streakPool = [
  [-.76,-.13],[-.4,-.47],[.04,.34],[.69,-.37],
  [.37,.03],[-.56,.39],[.77,.29],[-.08,-.23],
  [.31,-.51],[-.35,.15],[.06,.55],[-.72,-.44]
];
const microPool = [[-.3,-.16],[-.07,-.2],[.18,-.12],[.32,.07],[.08,.19],[-.21,.1]];
const gridPool = Array.from({length:25}, (_, index) => [((index % 5) - 2) * .36, (Math.floor(index / 5) - 2) * .27]);

function config(plan) {
  const kind = workshopPreviewKind(plan);
  if (kind === 'grid') return {kind, pool:gridPool, count:3, initial:[2,11,18], stride:7, beat:.27, radius:6.3, title:'GRID / QUICK FLICKS'};
  if (kind === 'six') return {kind, pool:areaPool, count:6, initial:[0,2,4,6,8,10], stride:5, beat:.24, radius:6.1, title:'SIX / TARGET SWITCH'};
  if (kind === 'three') return {kind, pool:widePool, count:3, initial:[0,3,6], stride:4, beat:.34, radius:7.3, title:'THREE / WIDE FLICKS'};
  if (kind === 'streak') return {kind, pool:streakPool, count:6, beat:.2, radius:5.8, title:'STREAK / SPEED'};
  return {kind, pool:microPool, count:1, initial:[0], stride:1, beat:.48, radius:7, title:'MICRO / CONTROL'};
}

function targetSet(info, step) {
  if (info.kind === 'streak') {
    return Array.from({length:info.count}, (_, age) => {
      const shot = step - age;
      const index = ((shot * 5 % info.pool.length) + info.pool.length) % info.pool.length;
      return {spot:info.pool[index],age,slot:age};
    });
  }
  return Array.from({length:info.count}, (_, slot) => {
    const generation = Math.max(0, Math.ceil((step - slot) / info.count));
    const index = (info.initial[slot] + generation * info.stride) % info.pool.length;
    return {spot:info.pool[index],age:0,slot};
  });
}

function focusedTarget(info, step) {
  const targets = targetSet(info, step);
  return info.kind === 'streak' ? targets.at(-1) : targets[step % info.count];
}

function reticle(ctx, x, y, scale, locked) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = locked ? '#fff' : '#afe9f0';
  ctx.lineWidth = 1.25 * scale; ctx.shadowColor = '#b6f0f8'; ctx.shadowBlur = 4 * scale;
  const a = 4.3 * scale, b = 11.5 * scale;
  ctx.beginPath();
  ctx.moveTo(-b,0);ctx.lineTo(-a,0);ctx.moveTo(a,0);ctx.lineTo(b,0);
  ctx.moveTo(0,-b);ctx.lineTo(0,-a);ctx.moveTo(0,a);ctx.lineTo(0,b);
  ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,1.4*scale,0,TAU);ctx.fill();ctx.restore();
}

function target(ctx, x, y, radius, alpha, hit) {
  if (alpha <= 0) return;
  ctx.save();ctx.globalAlpha=alpha;
  const fill=ctx.createRadialGradient(x-radius*.28,y-radius*.33,1,x,y,radius);
  fill.addColorStop(0,'#ffe7e9');fill.addColorStop(.42,'#ff8390');fill.addColorStop(1,'#b72c43');
  ctx.fillStyle=fill;ctx.shadowColor='#ff536a';ctx.shadowBlur=hit?5:12;
  ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,220,226,.7)';ctx.lineWidth=1;ctx.stroke();ctx.restore();
}

export function createWorkshopMicroAnimation(plan) {
  const info=config(plan);
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  let start=0,elapsed=0;
  return {
    reset(now){start=now;elapsed=0;},
    step(now){elapsed=Math.max(0,now-start);},
    draw(ctx,width,height,now){
      if(!ctx||width<=0||height<=0)return;
      const scale=Math.min(width/360,height/196);
      const time=elapsed||Math.max(0,now-start);
      const beat=reduced?0:time/info.beat;
      const step=Math.floor(beat),phase=reduced?.7:beat-step;
      const box={x:width*.125,y:height*.13,w:width*.75,h:height*.74};
      const cx=width*.5,cy=height*.505;
      const pos=spot=>[cx+spot[0]*box.w*.43,cy+spot[1]*box.h*.47];
      ctx.clearRect(0,0,width,height);
      // The canvas stays transparent over the panel artwork; only task motion is drawn here.
      if(info.kind==='grid'){
        ctx.fillStyle='rgba(165,214,223,.19)';
        for(const spot of gridPool){const [x,y]=pos(spot);ctx.beginPath();ctx.arc(x,y,1.2*scale,0,TAU);ctx.fill();}
      }
      const visible=targetSet(info,step),focus=focusedTarget(info,step);
      const prior=focusedTarget(info,Math.max(0,step-1));
      const [tx,ty]=pos(focus.spot),[px,py]=pos(prior.spot);
      const shot=phase>=.7;
      for(const item of visible){
        const [x,y]=pos(item.spot),isFocus=item.slot===focus.slot;
        const ageScale=info.kind==='streak'?Math.max(.55,1-item.age*.085):1;
        const alpha=isFocus&&shot?Math.max(.22,1-(phase-.7)*2.45):1;
        target(ctx,x,y,info.radius*ageScale*scale,alpha,isFocus&&shot);
      }
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(tx,ty);
      ctx.setLineDash([2*scale,4*scale]);ctx.strokeStyle='rgba(143,226,233,.32)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      const travel=easeOut(phase/.55);
      const correction=phase>.44&&phase<.68?Math.sin((phase-.44)/.24*Math.PI)*1.4*scale:0;
      reticle(ctx,px+(tx-px)*travel+correction,py+(ty-py)*travel-correction*.3,scale,phase>.57);
      if(shot){const fade=clamp((phase-.7)/.3,0,1);ctx.beginPath();ctx.arc(tx,ty,(9+fade*20)*scale,0,TAU);ctx.strokeStyle=`rgba(255,218,224,${.75*(1-fade)})`;ctx.lineWidth=1.6*scale;ctx.stroke();}
      ctx.fillStyle='#a8c8d2';ctx.font=`700 ${Math.max(8,9*scale)}px Arial,sans-serif`;
      ctx.fillText(info.title,11*scale,16*scale);
      ctx.fillStyle=shot?'#ff7e8a':'#82c7d2';
      ctx.fillText(shot?'HIT':'FLICK',width-42*scale,height-10*scale);
      ctx.fillStyle='#829dab';ctx.fillText(`${info.count.toString().padStart(2,'0')} LIVE`,11*scale,height-10*scale);
      ctx.strokeStyle='#ff6171';ctx.lineWidth=2*scale;ctx.beginPath();
      ctx.moveTo(0,0);ctx.lineTo(17*scale,0);ctx.moveTo(0,0);ctx.lineTo(0,17*scale);
      ctx.moveTo(width,height);ctx.lineTo(width-17*scale,height);ctx.moveTo(width,height);ctx.lineTo(width,height-17*scale);ctx.stroke();
    }
  };
}
