const TAU=Math.PI*2;
const clamp01=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp01(value);return t*t*(3-2*t);};

export const OPENING_STORY=Object.freeze([
  {kicker:'THE LAST LIGHT',title:'太阳熄灭后的第七百年',text:'人们把炼金炉里最后的火种送进王城，用黑金与血维持黎明。可每点燃一盏灯，城市便向无底深渊下沉一寸。'},
  {kicker:'THE BROKEN THRONE',title:'王座破碎，六层遗迹沉入大地',text:'末代君王试图把深渊封入王冠。仪式失败的那一夜，王座碎成六块，连同宫殿、矿坑、圣所与整座王城坠入黑暗。'},
  {kicker:'THE SIX KEEPERS',title:'守墓者吞下碎片，成为不死首领',text:'裂壳巨兽、深渊骑士、星骸法王、血肉吞噬者、时空猎手与最终的模仿者，各自守着一层遗迹，也被王座的力量反复重塑。'},
  {kicker:'THE SCAVENGER',title:'只有拾荒者仍愿意向下走',text:'你没有军队，也没有神谕。只有一件旧兵器、几枚符文，以及从亡者手中夺取装备的本领。每次远征，都会让后来者离真相更近一步。'},
  {kicker:'THE DESCENT AWAITS',title:'今晚，王座再次呼唤你的名字',text:'穿过六层遗迹，击败十八场以上的守卫，带回碎片——或者在最深处面对一个拥有你全部力量、却比你更强的自己。'}
]);

function seededPoint(index,seed,width,height){return {x:(index*193+seed*71)%width,y:(index*109+seed*43)%height};}

function backdrop(ctx,w,h,time,scene){
  const palettes=[['#16221d','#030504','#8fb77a'],['#24140d','#040202','#d69754'],['#12152c','#03030a','#9ea9ef'],['#24070d','#050102','#d96d79'],['#071823','#010407','#6bd1e8']],palette=palettes[scene]||palettes[4],sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,palette[0]);sky.addColorStop(.62,palette[1]);sky.addColorStop(1,'#010101');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w*.68,h*.27,4,w*.68,h*.27,w*.43);glow.addColorStop(0,palette[2]+'33');glow.addColorStop(.45,palette[2]+'0d');glow.addColorStop(1,palette[2]+'00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=palette[2];for(let i=0;i<80;i++){const point=seededPoint(i,scene+3,w,h*.72),alpha=.04+(i%7)*.018;ctx.globalAlpha=alpha*(.7+.3*Math.sin(time*.28+i));ctx.fillRect(point.x,point.y,1+i%2,1+i%2);}ctx.globalAlpha=1;
  const vignette=ctx.createRadialGradient(w/2,h*.46,w*.13,w/2,h*.46,w*.72);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.76)');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
}

function ruins(ctx,w,h,time,scene){
  const horizon=h*.67,drift=Math.sin(time*.08)*12;ctx.fillStyle='#030303';ctx.beginPath();ctx.moveTo(0,horizon);for(let x=0;x<=w;x+=72){const tower=(x/72+scene*3)%5===0?145:40+(x*7%80);ctx.lineTo(x+drift,horizon-tower);ctx.lineTo(x+28+drift,horizon-tower-(tower>100?28:0));ctx.lineTo(x+51+drift,horizon);}ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(208,171,100,.12)';ctx.lineWidth=2;for(let i=0;i<11;i++){const x=i*w/10+drift*.3;ctx.beginPath();ctx.moveTo(x,horizon);ctx.lineTo(x+(i%2?18:-18),h);ctx.stroke();}
}

function drawEclipse(ctx,w,h,time){
  const x=w*.68,y=h*.28,r=h*.105;ctx.save();ctx.translate(x,y);const corona=ctx.createRadialGradient(0,0,r*.86,0,0,r*1.48);corona.addColorStop(0,'rgba(218,185,112,.76)');corona.addColorStop(.2,'rgba(180,128,52,.18)');corona.addColorStop(1,'rgba(180,128,52,0)');ctx.fillStyle=corona;ctx.beginPath();ctx.arc(0,0,r*1.48,0,TAU);ctx.fill();ctx.fillStyle='#010101';ctx.beginPath();ctx.arc(Math.sin(time*.05)*3,0,r*.88,0,TAU);ctx.fill();ctx.strokeStyle='rgba(246,213,149,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();ctx.restore();
}

function drawBrokenCrown(ctx,w,h,time,local){
  const x=w*.68,y=h*.43,r=h*.18,pulse=.96+.025*Math.sin(time*.8);ctx.save();ctx.translate(x,y);ctx.scale(pulse,pulse);ctx.globalCompositeOperation='lighter';ctx.shadowColor='#e3aa54';ctx.shadowBlur=22;ctx.strokeStyle='rgba(247,211,139,.78)';ctx.fillStyle='rgba(132,79,24,.2)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-r*.72,r*.25);ctx.lineTo(-r*.6,-r*.48);ctx.lineTo(-r*.2,-r*.12);ctx.lineTo(0,-r*.7);ctx.lineTo(r*.2,-r*.12);ctx.lineTo(r*.6,-r*.48);ctx.lineTo(r*.72,r*.25);ctx.quadraticCurveTo(0,r*.48,-r*.72,r*.25);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='rgba(255,237,190,.82)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-r*.05,-r*.58);ctx.lineTo(r*.09,-r*.22);ctx.lineTo(-r*.12,r*.04);ctx.lineTo(r*.16,r*.31);ctx.stroke();
  for(let i=0;i<6;i++){const a=i*TAU/6+time*.08,d=r*(.8+.35*smooth(local));ctx.save();ctx.translate(Math.cos(a)*d,Math.sin(a)*d*.58);ctx.rotate(a+time*.12);ctx.fillStyle=i%2?'rgba(219,157,68,.38)':'rgba(255,225,158,.5)';ctx.strokeStyle='rgba(255,235,189,.75)';ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(10,0);ctx.lineTo(0,14);ctx.lineTo(-8,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}ctx.restore();
}

function drawKeepers(ctx,w,h,time){
  const colors=['#90bd79','#db8d72','#9ea9ef','#e0787f','#74c7df','#ffd66e'],cx=w*.67,cy=h*.43;ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const a=-Math.PI*.9+i*Math.PI*.36,x=cx+Math.cos(a)*w*.24,y=cy+Math.sin(a)*h*.22+(i%2)*42,r=46+(i%3)*8;ctx.save();ctx.translate(x,y);ctx.rotate(time*(i%2?.08:-.065)+i);ctx.strokeStyle=colors[i];ctx.shadowColor=colors[i];ctx.shadowBlur=14;ctx.globalAlpha=.6;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();ctx.setLineDash([8+i*2,6]);ctx.beginPath();ctx.arc(0,0,r*.72,0,TAU);ctx.stroke();ctx.setLineDash([]);for(let n=0;n<6;n++){ctx.rotate(TAU/6);ctx.beginPath();ctx.moveTo(r*.25,0);ctx.lineTo(r*.9,0);ctx.stroke();}ctx.fillStyle=colors[i]+'33';ctx.beginPath();ctx.moveTo(0,-r*.52);ctx.lineTo(r*.36,r*.34);ctx.lineTo(-r*.36,r*.34);ctx.closePath();ctx.fill();ctx.restore();}ctx.restore();
}

function drawScavenger(ctx,w,h,time){
  const x=w*.72,y=h*.77,scale=h/900;ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#020202';ctx.strokeStyle='rgba(224,182,101,.55)';ctx.lineWidth=3;ctx.shadowColor='#bf7932';ctx.shadowBlur=16;ctx.beginPath();ctx.ellipse(0,-215,42,48,0,0,TAU);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-34,-184);ctx.quadraticCurveTo(-92,-66,-74,22);ctx.lineTo(72,22);ctx.quadraticCurveTo(93,-82,34,-184);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#c58d43';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(30,-166);ctx.lineTo(126,-60);ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#ffe2a1';ctx.beginPath();ctx.moveTo(119,-68);ctx.lineTo(141,-45);ctx.stroke();const lamp=ctx.createRadialGradient(-39,-80,1,-39,-80,74);lamp.addColorStop(0,'rgba(255,213,131,.62)');lamp.addColorStop(.2,'rgba(210,122,43,.2)');lamp.addColorStop(1,'rgba(210,122,43,0)');ctx.fillStyle=lamp;ctx.beginPath();ctx.arc(-39,-80,74,0,TAU);ctx.fill();ctx.restore();
  ctx.strokeStyle='rgba(213,174,102,.18)';ctx.lineWidth=2;for(let i=0;i<9;i++){const y=h*.69+i*34,width=w*(.12+i*.055);ctx.beginPath();ctx.moveTo(w*.72-width,y);ctx.lineTo(w*.72+width,y);ctx.stroke();}
}

function drawFinalThrone(ctx,w,h,time){
  const x=w*.69,y=h*.6,r=h*.21;ctx.save();ctx.translate(x,y);const aura=ctx.createRadialGradient(0,-r*.1,4,0,-r*.1,r*1.5);aura.addColorStop(0,'rgba(245,204,112,.25)');aura.addColorStop(.48,'rgba(111,76,27,.1)');aura.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,-r*.1,r*1.5,0,TAU);ctx.fill();ctx.fillStyle='#020202';ctx.strokeStyle='rgba(235,193,104,.58)';ctx.shadowColor='#d5943c';ctx.shadowBlur=20;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-r*.58,r*.64);ctx.lineTo(-r*.52,-r*.48);ctx.lineTo(-r*.23,-r*.7);ctx.lineTo(0,-r*.46);ctx.lineTo(r*.24,-r*.72);ctx.lineTo(r*.52,-r*.48);ctx.lineTo(r*.58,r*.64);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='rgba(255,229,163,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-r*.43);ctx.lineTo(0,r*.46);ctx.moveTo(-r*.36,-r*.28);ctx.lineTo(r*.36,-r*.28);ctx.stroke();for(let i=0;i<6;i++){const a=i*TAU/6+time*.1,d=r*(.8+.04*Math.sin(time+i));ctx.save();ctx.translate(Math.cos(a)*d,Math.sin(a)*d*.5);ctx.rotate(a);ctx.strokeRect(-7,-12,14,24);ctx.restore();}ctx.restore();
}

export function drawOpeningStoryFrame(ctx,time,scene,local){
  const w=ctx.canvas.width||1600,h=ctx.canvas.height||900;ctx.clearRect(0,0,w,h);backdrop(ctx,w,h,time,scene);ruins(ctx,w,h,time,scene);
  if(scene===0)drawEclipse(ctx,w,h,time);
  if(scene===1)drawBrokenCrown(ctx,w,h,time,local);
  if(scene===2)drawKeepers(ctx,w,h,time);
  if(scene===3)drawScavenger(ctx,w,h,time);
  if(scene===4){drawFinalThrone(ctx,w,h,time);drawScavenger(ctx,w,h,time);}
  const fadeIn=smooth(local/.16),fadeOut=1-smooth((local-.84)/.16);ctx.fillStyle=`rgba(0,0,0,${1-fadeIn*fadeOut})`;ctx.fillRect(0,0,w,h);
}
