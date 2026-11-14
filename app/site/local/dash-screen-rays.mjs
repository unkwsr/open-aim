// Native Tailwind streaks. The seeded pattern never changes, so compute its
// random constants and trigonometry once instead of on every rendered frame.
function pattern(sideways){
 let seed=11;const random=()=>((seed=seed*16807%2147483647)/2147483647),data=new Float64Array(70*6);
 for(let i=0;i<70;i++){
  const j=i*6;data[j]=.3+random()*.4;const angle=random()*Math.PI*2;data[j+1]=1+random()*2.5;
  if(sideways){data[j+2]=60+random()*780;data[j+3]=180+random()*260;}
  else{data[j+2]=Math.cos(angle);data[j+3]=Math.sin(angle);data[j+4]=.6+random();}
 }
 return data;
}
const longitudinal=pattern(false),lateral=pattern(true);
export function drawDashRays(ctx,width,height,scale,age,direction){
 if(!ctx)return;
 const cx=width/2,cy=height/2;ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
 const flash=Math.max(0,1-age/.35);
 if(flash>0){const gradient=ctx.createRadialGradient(cx,cy,100*scale,cx,cy,Math.hypot(cx,cy));gradient.addColorStop(0,'rgba(200,225,245,0)');gradient.addColorStop(1,`rgba(200,225,245,${.42*flash})`);ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);}
 const fade=1-age/.6,forward=direction==='N',axial=forward||direction==='S',data=axial?longitudinal:lateral;
 for(let i=0;i<70;i++){
  const j=i*6,phase=age/data[j]%1;ctx.strokeStyle=`rgba(200,225,245,${.55*fade*(1-phase)})`;ctx.lineWidth=data[j+1]*scale;ctx.beginPath();
  if(axial){const radius=(forward?180+phase*700:900-phase*700)*scale,end=radius+(forward?160:-160)*data[j+4]*scale;
   ctx.moveTo(cx+data[j+2]*radius,cy+data[j+3]*radius*.62);ctx.lineTo(cx+data[j+2]*end,cy+data[j+3]*end*.62);
  }else{const y=data[j+2]*scale+(height-900*scale)/2,sign=direction==='E'?-1:1,x=cx-sign*(width/2+100*scale)+sign*phase*(width+200*scale),length=data[j+3]*scale;
   ctx.moveTo(x,y);ctx.lineTo(x-sign*length,y);
  }
  ctx.stroke();
 }
 ctx.restore();
}
