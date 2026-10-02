// Shared world geometry: rendering, pointer picking and traversal use the same anchors.
export const WORLD_BUILD='8.3-world-repair-1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function portalGeometry(gate){
  return {x:gate.x,y:gate.y,entry:{x:gate.x,y:gate.y+42},exit:{x:gate.x,y:gate.y+8},bounds:{left:gate.x-74,right:gate.x+74,top:gate.y-115,bottom:gate.y+66}};
}
export function merchantGeometry(anchor){
  const width=244,height=163,y=anchor.y+9;
  return {x:anchor.x,y,width,height,top:y-height+18,bounds:{left:anchor.x-width/2,right:anchor.x+width/2,top:y-height+18,bottom:y+37}};
}
export function pickWorldProp(point,gate,merchant){
  const inside=b=>point.x>=b.left&&point.x<=b.right&&point.y>=b.top&&point.y<=b.bottom;
  if(inside(portalGeometry(gate).bounds))return 'portal';
  if(inside(merchantGeometry(merchant).bounds))return 'merchant';
  return null;
}
export function portalOcclusion(body,transit,gate){
  if(!transit||transit.stage!=='enter')return 0;
  const {entry,exit}=portalGeometry(gate);
  // Occlusion follows actual penetration of the doorway, never time spent elsewhere.
  return clamp((entry.y-body.y)/(entry.y-exit.y));
}
export const WORLD_VFX_METHODS=['portalDepth','portalSurface','groundSeal','crackField','prism','collapseCore','collapseOrbit','collapseMist','assetStaffCollapseV9','assetStaffCollapseV10','assetStaffGroundV9','assetStaffBurstV9','assetStaffGleamV9'];
export function protectWorldRenderer(renderer){
  const missing=WORLD_VFX_METHODS.filter(name=>typeof renderer[name]!=='function');
  const api=Object.create(renderer);
  for(const name of missing)api[name]=()=>{};
  Object.defineProperties(api,{missingWorldMethods:{value:missing},portalAvailable:{value:renderer.available&&['portalDepth','portalSurface'].every(name=>typeof renderer[name]==='function')}});
  return api;
}
export function drawMerchantScene(ctx,source,anchor,t,{front=false,hover=0,greet=0}={}){
  const g=merchantGeometry(anchor),{x,y,width,height,top}=g;
  const iw=source.naturalWidth||source.width,ih=source.naturalHeight||source.height;
  if(!iw||!ih)return false;
  ctx.save();
  if(front){
    // The counter occupies a real foreground band; the merchant stays behind it.
    ctx.beginPath();ctx.rect(x-width*.54,y-30,width*1.08,51);ctx.clip();
    ctx.drawImage(source,x-width/2,top,width,height);ctx.restore();return true;
  }
  const pool=ctx.createRadialGradient(x+30,y-18,4,x+20,y-7,118);
  pool.addColorStop(0,`rgba(245,181,86,${.18+.07*hover})`);pool.addColorStop(.5,'rgba(149,79,27,.08)');pool.addColorStop(1,'rgba(75,37,12,0)');
  ctx.fillStyle=pool;ctx.fillRect(x-130,y-110,260,143);
  ctx.fillStyle='rgba(0,0,0,.65)';ctx.beginPath();ctx.ellipse(x,y+8,94,14,0,0,Math.PI*2);ctx.fill();
  ctx.translate(x-width/2,top);ctx.scale(width/iw,height/ih);
  // Authored illustration is split into anchored furniture, cloth, torso and lantern.
  // Unlike moving the whole picture, the counter and its contact shadow never bob.
  const sx=iw/768,sy=ih/512;
  const rect=(x,y,w,h)=>ctx.rect(x*sx,y*sy,w*sx,h*sy);
  ctx.save();ctx.beginPath();rect(-2,-2,772,516);rect(276,10,250,271);rect(146,0,122,150);ctx.clip('evenodd');
  ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=17;ctx.shadowOffsetY=8;ctx.drawImage(source,0,0);ctx.restore();
  const breath=Math.sin(t*1.55)*.72,nod=Math.sin(Math.min(1,greet)*Math.PI)*2.6;
  ctx.save();ctx.translate(393*sx,270*sy);ctx.rotate(Math.sin(t*.85)*.0025-hover*.004);ctx.translate(-393*sx,-270*sy+(-breath-nod)*sy);
  ctx.beginPath();rect(276,10,250,271);rect(467,52,54,128);ctx.clip('evenodd');ctx.drawImage(source,0,0);ctx.restore();
  // The suspended lantern pivots from the hand, with inertia, independently of the torso.
  ctx.save();ctx.translate(492*sx,(67-breath-nod)*sy);ctx.rotate(Math.sin(t*1.12)*.018+hover*.023);ctx.translate(-492*sx,-67*sy);ctx.beginPath();rect(467,52,54,128);ctx.clip();ctx.drawImage(source,0,0);ctx.restore();
  ctx.save();ctx.translate(202*sx,15*sy);ctx.transform(1,0,Math.sin(t*.63)*.012,1,0,0);ctx.translate(-202*sx,-15*sy);ctx.beginPath();rect(146,0,122,150);ctx.clip();ctx.drawImage(source,0,0);ctx.restore();
  const flames=[[486,140,16],[534,187,10],[519,212,9],[569,376,9]];
  ctx.globalCompositeOperation='screen';
  for(const [fx,fy,size] of flames){
    const lx=fx*sx,ly=(fy-(fx===486?breath+nod:0))*sy,r=size*sx;
    const light=ctx.createRadialGradient(lx,ly,1,lx,ly,r*2.1);light.addColorStop(0,`rgba(255,237,166,${.6+.12*hover})`);light.addColorStop(.26,'rgba(255,180,72,.28)');light.addColorStop(1,'rgba(255,154,40,0)');ctx.fillStyle=light;ctx.fillRect(lx-r*2.1,ly-r*2.1,r*4.2,r*4.2);
  }
  ctx.restore();
  ctx.save();ctx.strokeStyle=`rgba(242,204,136,${.35+.5*hover})`;ctx.fillStyle='rgba(29,17,9,.94)';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(x-69,y+19,138,23,4);ctx.fill();ctx.stroke();ctx.font='600 11px "Microsoft YaHei"';ctx.textAlign='center';ctx.fillStyle='#f4dba7';ctx.fillText(hover>.12?'查看货架  ·  B':'烛火商会  ·  B',x,y+34);ctx.restore();
  return true;
}
