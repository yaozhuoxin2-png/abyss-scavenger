const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const smooth=(a,b,value)=>{const x=clamp((value-a)/(b-a));return x*x*(3-2*x);};
const TAU=Math.PI*2;
function flipbook(renderer,method,x,y,size,rotation,alpha,progress,quality,start=0,end=7){
  const value=start+clamp(progress)*(end-start),frame=Math.floor(value),next=Math.min(end,frame+1),mix=value-frame;
  renderer[method](x,y,size,rotation,alpha*(1-mix),frame,quality);
  if(next!==frame&&mix>.01)renderer[method](x,y,size,rotation,alpha*mix,next,quality);
}

export const VFX_MATERIALS=Object.freeze({
  astral:['assetEclipse','assetEclipseEdge','assetEclipseVeil','assetCollapse','assetCollapseEdge','assetCollapseMist','iceTrailSurface','iceBurst','starCore','vortex','windWake'],
  steel:['swordRibbon','bladeFlash','royalArc','bladeArc','fissure','rock'],
  lunar:['arrow','crescent','windWake','starCore'],
  shared:['trail','beam','disc','ring','light','shard']
});

function eventFrame(event,time,provided={}){
  const rawAlpha=provided.rawAlpha??clamp((event.life??1)/(event.max??1));
  const progress=provided.progress??1-rawAlpha;
  const alpha=provided.alpha??Math.min(1,rawAlpha*1.5);
  const intro=smooth(0,.16,progress),release=1-smooth(.72,1,progress);
  return {...provided,event,time,progress,rawAlpha,alpha,energy:intro*release,phase:provided.phase??time*.55+(event.seed||0)*.001,color:event.color||provided.color||'#d7c28b',accent:event.accent||provided.accent||event.color||'#f4df9b'};
}

function geometry(c){
  const e=c.event,dx=e.x-e.ox,dy=e.y-e.oy,length=Math.max(1,Math.hypot(dx,dy));
  return {dx,dy,length,angle:Number.isFinite(e.angle)?e.angle:Math.atan2(dy,dx)};
}

function swordSpin(c,stage){
  const {event:e,progress:p,alpha:a,phase}=c,{angle}=geometry(c),r=c.renderer;
  const voidEdge='#251d68',spectral='#795dff',ion='#42d4ff',moon='#f5fdff';
  const quality=clamp(e.quality??3,0,3),assetScale=[.86,.94,1,1.08][quality];
  if(r.assetsReady){
    if(stage==='cast'){
      const frame=Math.min(2,Math.floor(p*3));r.assetSlash(e.ox,e.oy,166*assetScale,angle,.5*a,frame,quality);
      if(quality>=2)r.swordRibbon(e.ox,e.oy,137,angle,ion,.2*a,phase);
      return;
    }
    const forward=angle-.92+smooth(0,.6,p)*1.68,frame=Math.min(7,Math.floor(p*8));
    r.assetSlash(e.ox,e.oy,184*assetScale,forward,.82*a,frame,quality);
    if(quality>=3&&frame<6)r.assetSlash(e.ox,e.oy,196,forward-.08,.24*a,Math.max(0,frame-1),quality);
    const focusX=e.ox+Math.cos(forward)*112,focusY=e.oy+Math.sin(forward)*72;
    if(quality>=1&&p>.18){const sparkFrame=Math.min(7,Math.floor(clamp((p-.18)/.82)*8));r.assetSpark(focusX,focusY,quality>=3?73:59,forward,.66*a,sparkFrame,quality);}
    if(quality>=2)r.light(focusX,focusY,72,ion,.08*a,.62,phase);
    if(quality>=3)for(let i=0;i<5;i++){const side=forward-.62+i*.31,x=e.ox+Math.cos(side)*(105+i*5),y=e.oy+Math.sin(side)*(67+i*3);r.trail(x,y,29+i*6,1.5+i%2,side+Math.PI/2,i%2?moon:spectral,.24*a,phase+i*.17);}
    return;
  }
  if(stage==='cast'){
    r.swordRibbon(e.ox,e.oy,151,angle,voidEdge,.52*a,phase);
    r.swordRibbon(e.ox,e.oy,143,angle,spectral,.5*a,phase+.13);
    r.swordRibbon(e.ox,e.oy,135,angle,ion,.46*a,phase+.27);
    r.swordRibbon(e.ox,e.oy,127,angle,moon,.34*a,phase+.4);
    return;
  }
  const forward=angle-1.0+smooth(0,.58,p)*1.82,returnMix=smooth(.22,.58,p)*(1-smooth(.82,1,p)),rebound=angle+.78-smooth(.26,.82,p)*1.32;
  r.swordRibbon(e.ox,e.oy,161,forward,voidEdge,.72*a,phase);
  r.swordRibbon(e.ox,e.oy,153,forward,spectral,.74*a,phase+.11);
  r.swordRibbon(e.ox,e.oy,145,forward,ion,.82*a,phase+.24);
  r.swordRibbon(e.ox,e.oy,137,forward,moon,.78*a,phase+.39);
  r.swordRibbon(e.ox,e.oy,132,rebound,spectral,.56*a*returnMix,phase+.46);
  r.swordRibbon(e.ox,e.oy,124,rebound,ion,.58*a*returnMix,phase+.59);
  r.swordRibbon(e.ox,e.oy,116,rebound,moon,.48*a*returnMix,phase+.72);
  const focusX=e.ox+Math.cos(forward)*124,focusY=e.oy+Math.sin(forward)*79;
  r.bladeFlash(focusX,focusY,27,forward+Math.PI/2,moon,.78*a,phase+.4);
  r.bladeFlash(focusX,focusY,20,forward,ion,.54*a,phase+.65);
  r.light(focusX,focusY,64,ion,.1*a,.6,phase);
  for(let i=0;i<7;i++){
    const q=i/6,side=forward-.84+q*1.65,dist=104+i*3,x=e.ox+Math.cos(side)*dist,y=e.oy+Math.sin(side)*dist*.64,tangent=side+Math.PI/2;
    r.trail(x,y,32+i*5,1.8+i%2,tangent,i%3===0?moon:i%3===1?ion:spectral,(.28+i*.035)*a,phase+i*.12);
    if(i%2===0)r.shard(x,y,2.5+i%3,tangent+(i%4?-.28:.28),moon,.48*a,phase+i*.17);
  }
}

function swordFrost(c,stage){
  const {event:e,progress:p,alpha:a,phase}=c,{angle}=geometry(c),r=c.renderer;
  const chasm='#31080d',ember='#ff382d',gold='#ffad24',hot='#fff0a6';
  const pulse=.82+.18*Math.sin(p*Math.PI);
  if(stage==='cast'){
    r.fissure(e.x,e.y,258,angle,chasm,.76*a,.18,phase);
    r.fissure(e.x,e.y,244,angle,ember,.62*a,.58,phase+.2);
    r.beam(e.x,e.y,226,3,angle,hot,.5*a,phase);
    r.beam(e.x,e.y,226,3,angle+Math.PI/2,hot,.5*a,phase);
    return;
  }
  r.fissure(e.x,e.y,278*pulse,angle,chasm,.88*a,.08,phase);
  r.fissure(e.x,e.y,264*pulse,angle,ember,.86*a,.26,phase+.19);
  r.fissure(e.x,e.y,248*pulse,angle,gold,.82*a,.62,phase+.36);
  r.beam(e.x,e.y,232*pulse,5,angle,hot,.76*a,phase);
  r.beam(e.x,e.y,232*pulse,5,angle+Math.PI/2,hot,.76*a,phase+.1);
  r.light(e.x,e.y,125,gold,.16*a,.62,phase);
  for(let i=0;i<16;i++){
    const arm=i%4,rank=Math.floor(i/4),armAngle=angle+arm*Math.PI/2,dist=49+rank*25,side=i%2?1:-1;
    r.shard(e.x+Math.cos(armAngle)*dist+Math.cos(armAngle+Math.PI/2)*side*(5+rank*3),e.y+Math.sin(armAngle)*dist+Math.sin(armAngle+Math.PI/2)*side*(4+rank*2),3.5+rank*.8,armAngle+side*.55,rank<2?hot:rank===2?gold:ember,(.55+rank*.065)*a,phase+i*.09);
  }
}

function staffSpin(c,stage){
  const {event:e,progress:p,alpha:a,phase,color,accent}=c,{dx,dy,length,angle}=geometry(c),r=c.renderer;
  const quality=clamp(e.quality??3,0,3),detailScale=[.9,.95,1,1.05][quality],damageWidth=e.width||72,halfWidth=damageWidth*.5,explosionRadius=e.explosionRadius||78,visualAngle=-angle;
  if(r.assetsReady){
    if(stage==='cast'){
      const charge=smooth(0,.18,p)*(1-smooth(.25,.38,p)),travel=smooth(.25,.75,p),arrival=smooth(.75,.94,p),x=e.ox+dx*travel,y=e.oy+dy*travel;
      const size=halfWidth*(.34+.58*smooth(.16,.38,p))*(1-.46*arrival)*detailScale,frameProgress=travel*.7+p*.3,orbAlpha=1-smooth(.86,1,p);
      flipbook(r,'assetEclipseVeil',x-Math.cos(angle)*12,y-Math.sin(angle)*8,size*1.24,visualAngle,.2*a*orbAlpha,frameProgress,quality,0,5);
      flipbook(r,'assetEclipse',x,y,size,visualAngle,1.02*a*orbAlpha,frameProgress,quality,0,5);
      if(quality>=1)flipbook(r,'assetEclipseEdge',x,y,size*1.035,visualAngle,1.08*a*orbAlpha,frameProgress,quality,0,5);
      r.light(x,y,32+quality*4,'#168dff',(.07+quality*.012)*a,.72,phase);
      if(charge>.02){r.starCore(e.ox,e.oy,11+charge*25,visualAngle+p*2.2,'#e8fdff',.72*a*charge,phase);r.light(e.ox,e.oy,30+charge*22,'#557cff',.11*a*charge,.58,phase);}
      if(travel>.015){const frozenLength=Math.max(8,length*travel),midX=e.ox+dx*travel*.5,midY=e.oy+dy*travel*.5,visible=Math.min(frozenLength,188),wakeX=x-Math.cos(angle)*visible*.42,wakeY=y-Math.sin(angle)*visible*.42,handoff=(1-smooth(.8,1,p))*Math.max(a,.72*smooth(.34,.72,p));r.iceTrailSurface(midX,midY,frozenLength,damageWidth,visualAngle,.76*handoff,0,quality);r.windWake(wakeX,wakeY,visible,22,visualAngle,'#172557',.28*a*orbAlpha,phase);r.trail(wakeX,wakeY,visible,3.4,visualAngle,'#d5fbff',.52*a*orbAlpha,phase+.17);}
      const satellites=quality+2;for(let i=0;i<satellites;i++){const orbit=phase*1.8+i*TAU/satellites,dist=25+quality*3;r.shard(x+Math.cos(orbit)*dist,y+Math.sin(orbit)*dist*.58,4+i%2,orbit+angle,'#dffcff',(.42+quality*.055)*a,phase+i*.14);}
      return;
    }
    const impactIn=smooth(0,.1,p),impactOut=1-smooth(.68,1,p),impact=impactIn*impactOut,burst=smooth(0,.2,p)*(1-smooth(.72,1,p)),midX=(e.ox+e.x)*.5,midY=(e.oy+e.y)*.5;
    r.iceTrailSurface(midX,midY,length,damageWidth,visualAngle,.78*a*impact,p,quality);
    r.iceBurst(e.x,e.y,explosionRadius*(.5+.5*smooth(0,.28,p)),visualAngle-p*.08,.98*a*burst,p,quality);
    r.light(e.x,e.y,explosionRadius*.9,'#168dff',.09*a*burst,.72,phase);
    return;
  }
  const travel=stage==='cast'?1:Math.min(1,p*2.25),sx=e.ox+dx*travel,sy=e.oy+dy*travel;
  r.windWake(e.ox+dx*travel*.48,e.oy+dy*travel*.48,length*travel+22,34,angle,'#4c2e87',.62*a,phase);
  r.trail(e.ox+dx*travel*.5,e.oy+dy*travel*.5,length*travel,8,angle,accent,.62*a,phase+.1);
  r.starCore(sx,sy,stage==='cast'?34:47,angle+p*2.2,color,.84*a,phase);
  r.starCore(sx,sy,stage==='cast'?23:31,-angle-p*1.6,accent,.75*a,phase+.24);
  if(stage!=='cast'&&travel>.72){r.vortex(e.x,e.y,137,angle+p*.8,'#6e43ad',.56*a,phase);r.light(e.x,e.y,105,color,.16*a,.55,phase);}
}

function staffFrost(c,stage){
  const {event:e,progress:p,alpha:a,phase,color,accent}=c,r=c.renderer;
  const quality=clamp(e.quality??3,0,3),damageRadius=e.radius||165,cx=e.x,cy=e.y;
  if(r.assetsReady){
    const radius=damageRadius,angles=Array.from({length:6},(_,i)=>-Math.PI/2+i*TAU/6),radii=[.79,.75,.77,.79,.75,.77],nodes=[];
    if(stage==='cast'){
      const seed=smooth(.02,.2,p),spread=smooth(.12,.67,p),crystalReveal=smooth(.4,.88,p),form=smooth(.34,.92,p),scale=.16+.84*smooth(.1,.82,p),handoff=1-.18*smooth(.88,1,p),castAlpha=a*handoff;
      r.disc(cx,cy,radius,'#031b47',.11*castAlpha*seed,.86,0,phase);r.ring(cx,cy,18+radius*.83*spread,'#72ddff',.9*castAlpha*seed,.022,.9,p*.12,phase);r.starCore(cx,cy,10+31*seed,p*1.35,'#f4ffff',1.08*castAlpha*seed,phase+.11);r.light(cx,cy,42+42*seed,'#198cff',.16*castAlpha*seed,.74,phase);
      for(let i=0;i<6;i++){const pair=i%3,appear=smooth(.16+pair*.1,.42+pair*.1,p),distance=radius*radii[i]*spread,x=cx+Math.cos(angles[i])*distance,y=cy+Math.sin(angles[i])*distance;nodes.push([x,y,appear]);const rayLength=Math.hypot(x-cx,y-cy),rayAngle=angles[i];r.beam((cx+x)*.5,(cy+y)*.5,rayLength,5+quality*.45,rayAngle,'#07387b',.72*castAlpha*appear,phase+i*.07);r.beam((cx+x)*.5,(cy+y)*.5,rayLength,1.7+quality*.22,rayAngle,'#e9fdff',1.02*castAlpha*appear,phase+i*.07);r.starCore(x,y,4+(9+quality*1.5)*appear,angles[i],'#f3ffff',.96*castAlpha*appear,phase+i*.16);}
      const perimeter=smooth(.43,.78,p);for(let i=0;i<6;i++){const [x1,y1,a1]=nodes[i],[x2,y2,a2]=nodes[(i+1)%6],dx=x2-x1,dy=y2-y1,link=perimeter*Math.min(a1,a2),beamAngle=Math.atan2(dy,dx),beamLength=Math.hypot(dx,dy);r.beam((x1+x2)*.5,(y1+y2)*.5,beamLength,5.4+quality*.38,beamAngle,'#06245a',.84*castAlpha*link,phase+i*.08);r.beam((x1+x2)*.5,(y1+y2)*.5,beamLength,1.8+quality*.22,beamAngle,'#e5fcff',1.08*castAlpha*link,phase+i*.08);}
      flipbook(r,'assetCollapseMist',cx,cy,radius*.9*scale,-.05+p*.05,.2*castAlpha*crystalReveal,form,quality,0,3);flipbook(r,'assetCollapse',cx,cy,radius*.94*scale,-.05+p*.05,1.2*castAlpha*crystalReveal,form,quality,0,3);if(quality>=1)flipbook(r,'assetCollapseEdge',cx,cy,radius*.965*scale,-.05+p*.05,1.26*castAlpha*crystalReveal,form,quality,0,3);
      r.ring(cx,cy,radius,'#c7f9ff',.9*castAlpha*perimeter,.019,.92,0,phase);return;
    }
    const takeover=smooth(0,.12,p),collapse=smooth(.14,.58,p),release=1-smooth(.78,1,p),visual=(.72+.28*takeover)*release,drawRadius=radius*(1-.18*collapse);
    flipbook(r,'assetCollapseMist',cx,cy,drawRadius*.9,.04-p*.1,.22*a*visual,p,quality,3,7);flipbook(r,'assetCollapse',cx,cy,drawRadius*.94,.04-p*.1,1.2*a*visual,p,quality,3,7);flipbook(r,'assetCollapseEdge',cx,cy,drawRadius*.965,.04-p*.1,1.3*a*visual,p,quality,3,7);
    for(let i=0;i<6;i++){const distance=radius*radii[i]*(1-.74*collapse),x=cx+Math.cos(angles[i]+p*.06)*distance,y=cy+Math.sin(angles[i]+p*.06)*distance;nodes.push([x,y]);r.starCore(x,y,12+quality*1.5,angles[i]-p,'#efffff',.82*a*visual,phase+i*.16);}
    for(let i=0;i<nodes.length;i++){const [x1,y1]=nodes[i],[x2,y2]=nodes[(i+1)%nodes.length],sx=x2-x1,sy=y2-y1,beamAngle=Math.atan2(sy,sx),beamLength=Math.hypot(sx,sy);r.beam((x1+x2)*.5,(y1+y2)*.5,beamLength,4.4+quality*.32,beamAngle,'#041b4b',.86*a*visual,phase+i*.08);r.beam((x1+x2)*.5,(y1+y2)*.5,beamLength,1.55+quality*.18,beamAngle,'#d8fbff',1.02*a*visual,phase+i*.08);}
    const burst=smooth(.26,.56,p)*(1-smooth(.82,1,p));r.disc(cx,cy,radius,'#04265e',.13*a*visual,.86,0,phase);r.ring(cx,cy,radius,'#d8fdff',.96*a*visual,.02,.92,0,phase);r.starCore(cx,cy,24+42*burst,-p*2.1,'#f7ffff',1.04*a*visual,phase+.12);r.light(cx,cy,76+28*burst,'#188dff',.17*a*burst,.74,phase);
    for(let i=0;i<6+quality;i++){const shardAngle=angles[i%6]+(i>5?.34:0),dist=26+burst*(62+i*6);r.shard(cx+Math.cos(shardAngle)*dist,cy+Math.sin(shardAngle)*dist,6+i%4,shardAngle,'#f0ffff',(.5+quality*.05)*a*burst,phase+i*.12);}
    return;
  }
  const size=stage==='cast'?145:172*(.78+.22*p);
  r.vortex(e.x,e.y,size,p*1.25,'#170d2b',.86*a,phase);
  r.vortex(e.x,e.y,size*.88,-p*1.55,color,.72*a,phase+.28);
  r.starCore(e.x,e.y,stage==='cast'?48:64,p*2,accent,.86*a,phase+.14);
  if(stage==='cast')return;
  for(let i=0;i<9;i++){
    const q=i/9,ang=q*TAU-p*.75,dist=150*(1-p*.62);
    r.windWake(e.x+Math.cos(ang)*dist*.58,e.y+Math.sin(ang)*dist*.4,dist*.78+20,10,ang+Math.PI,color,.46*a,phase+i*.1);
    r.rock(e.x+Math.cos(ang)*dist,e.y+Math.sin(ang)*dist*.65,5+i%3,ang,accent,.5*a,phase+i*.13);
  }
}

function bowSpin(c,stage){
  const {event:e,progress:p,alpha:a,phase}=c,{dx,dy,length,angle}=geometry(c),r=c.renderer;
  const deep='#0b4137',jade='#25d7a4',mint='#a4ffe0',ivory='#fff1b6';
  const travel=stage==='cast'?1:Math.min(1,p*2.4),visible=Math.max(20,length*travel);
  r.windWake(e.ox+dx*travel*.5,e.oy+dy*travel*.5,visible,48,angle,deep,.76*a,phase);
  r.windWake(e.ox+dx*travel*.48,e.oy+dy*travel*.48,visible*.94,31,angle,jade,.7*a,phase+.32);
  r.windWake(e.ox+dx*travel*.46,e.oy+dy*travel*.46,visible*.87,18,angle,mint,.48*a,phase+.61);
  r.beam(e.ox+dx*travel*.5,e.oy+dy*travel*.5,visible,3.5,angle,ivory,.82*a,phase);
  const x=e.ox+dx*travel,y=e.oy+dy*travel;
  r.arrow(x-Math.cos(angle)*26,y-Math.sin(angle)*26,stage==='cast'?76:102,angle,deep,.82*a,phase);
  r.arrow(x-Math.cos(angle)*21,y-Math.sin(angle)*21,stage==='cast'?64:87,angle,jade,.86*a,phase+.2);
  r.arrow(x-Math.cos(angle)*16,y-Math.sin(angle)*16,stage==='cast'?52:70,angle,ivory,.78*a,phase+.35);
  if(stage!=='cast')for(let i=0;i<6;i++){const side=i%2?1:-1,back=35+i*16;r.shard(x-Math.cos(angle)*back+Math.cos(angle+Math.PI/2)*side*(8+i*2),y-Math.sin(angle)*back+Math.sin(angle+Math.PI/2)*side*(6+i),3+i%2,angle+side*.8,i%3===0?ivory:i%3===1?mint:jade,.58*a,phase+i*.13);}
  if(stage!=='cast'&&travel>.76){r.light(e.x,e.y,62,jade,.12*a,.62,phase);for(let i=-2;i<=2;i++){const fan=angle+i*.3;r.shard(e.x+Math.cos(fan)*24,e.y+Math.sin(fan)*16,4+Math.abs(i),fan,Math.abs(i)===2?jade:ivory,.7*a,phase+i*.2);}}
}

function bowFrost(c,stage){
  const {event:e,progress:p,alpha:a,phase,color,accent}=c,r=c.renderer;
  const radius=stage==='cast'?156:174;
  r.crescent(e.x,e.y,radius,-.1+p*.28,'#174f43',.82*a,phase);
  r.crescent(e.x,e.y,radius*.91,Math.PI+.08-p*.18,accent,.62*a,phase+.23);
  r.vortex(e.x,e.y,radius*.82,p*.4,color,.32*a,phase+.4);
  if(stage==='cast')return;
  for(const [i,mark] of (e.marks||[]).entries()){
    r.starCore(mark.x,mark.y,27,-Math.PI/2,accent,.78*a,phase+i*.17);
    r.windWake(mark.x,mark.y-28+p*35,78,13,Math.PI/2,color,.64*a,phase+i*.12);
    r.shard(mark.x,mark.y-35+p*38,14,Math.PI/2,accent,.88*a,phase);
  }
}

function hitCue(c){
  const {event:e,progress:p,alpha:a,phase,color,accent}=c,r=c.renderer,angle=e.angle||0;
  if(e.kind==='sword'){
    r.bladeArc(e.x,e.y,35+p*13,angle,color,.82*a,phase);r.fissure(e.x,e.y,52,angle,accent,.6*a,.28,phase);
    for(let i=-1;i<=1;i++)r.rock(e.x+Math.cos(angle+i*.6)*17,e.y+Math.sin(angle+i*.6)*11,4+i%2,angle+i*.5,accent,.68*a,phase+i);
  }else if(e.kind==='staff'){
    if(r.assetsReady)r.assetEclipse(e.x,e.y,35+p*14,angle,.82*a,Math.min(7,5+Math.floor(p*3)),clamp(e.quality??2,0,3));
    else{r.starCore(e.x,e.y,28+p*17,angle+p,accent,.84*a,phase);r.vortex(e.x,e.y,46+p*16,-p,color,.5*a,phase);}
  }else{
    r.crescent(e.x,e.y,37+p*11,angle+Math.PI/2,color,.76*a,phase);r.windWake(e.x,e.y,66,14,angle,accent,.65*a,phase);
  }
}

export function createCombatVfxSystem(renderer,{maxActive=160}={}){
  const recipes=new Map(),active=[];
  let serial=0;
  const registerCue=(id,recipe,meta={})=>{recipes.set(id,{recipe,meta:{duration:.8,priority:1,...meta,id}});return id;};
  for(const [kind,name,handler] of [['sword','spin',swordSpin],['sword','frost',swordFrost],['staff','spin',staffSpin],['staff','frost',staffFrost],['bow','spin',bowSpin],['bow','frost',bowFrost]]){
    registerCue(`hero.${kind}.${name}.cast`,c=>handler(c,'cast'),{owner:'hero',kind,name,stage:'cast'});
    registerCue(`hero.${kind}.${name}.impact`,c=>handler(c,'impact'),{owner:'hero',kind,name,stage:'impact'});
  }
  for(const kind of ['sword','staff','bow'])registerCue(`hero.${kind}.hit`,hitCue,{owner:'hero',kind,stage:'hit'});
  const eventCue=event=>event.type==='heroSkillHit'?`hero.${event.kind}.hit`:`hero.${event.kind}.${event.name}.${event.type==='heroSkillCast'?'cast':'impact'}`;
  const render=(event,time,provided={})=>{
    const id=event.cue||eventCue(event),entry=recipes.get(id);
    if(!entry)return false;
    entry.recipe({...eventFrame(event,time,provided),renderer,id,meta:entry.meta});
    return true;
  };
  const emit=(cue,payload={})=>{
    const entry=recipes.get(cue);if(!entry)return null;
    const max=payload.max??entry.meta.duration,effect={...payload,cue,id:++serial,life:max,max,priority:payload.priority??entry.meta.priority};
    active.push(effect);
    if(active.length>maxActive){active.sort((a,b)=>b.priority-a.priority||b.id-a.id);active.length=maxActive;}
    return effect;
  };
  const update=dt=>{for(let i=active.length-1;i>=0;i--){active[i].life-=dt;if(active[i].life<=0)active.splice(i,1);}return active.length;};
  const renderActive=(time,provided={})=>{for(const effect of active)render(effect,time,provided);return active.length;};
  const clear=()=>{active.length=0;};
  return {render,emit,update,renderActive,clear,registerCue,hasCue:id=>recipes.has(id),inspect:()=>[...recipes.values()].map(entry=>entry.meta),activeCount:()=>active.length};
}
