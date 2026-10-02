const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const smooth=(a,b,value)=>{const x=clamp((value-a)/(b-a));return x*x*(3-2*x);};
const TAU=Math.PI*2;
function wake(renderer,...args){return typeof renderer.windWake==='function'?renderer.windWake(...args):renderer.trail(...args);}
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
  // Sustain detailed material faces, then release them. Do not brighten the whole screen.
  const alpha=provided.alpha??(1-smooth(.58,1,progress));
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
      if(travel>.015){const frozenLength=Math.max(8,length*travel),midX=e.ox+dx*travel*.5,midY=e.oy+dy*travel*.5,visible=Math.min(frozenLength,188),wakeX=x-Math.cos(angle)*visible*.42,wakeY=y-Math.sin(angle)*visible*.42,handoff=(1-smooth(.8,1,p))*Math.max(a,.72*smooth(.34,.72,p));r.iceTrailSurface(midX,midY,frozenLength,damageWidth,visualAngle,.76*handoff,0,quality);wake(r,wakeX,wakeY,visible,22,visualAngle,'#172557',.28*a*orbAlpha,phase);r.trail(wakeX,wakeY,visible,3.4,visualAngle,'#d5fbff',.52*a*orbAlpha,phase+.17);}
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
  wake(r,e.ox+dx*travel*.48,e.oy+dy*travel*.48,length*travel+22,34,angle,'#4c2e87',.62*a,phase);
  r.trail(e.ox+dx*travel*.5,e.oy+dy*travel*.5,length*travel,8,angle,accent,.62*a,phase+.1);
  r.starCore(sx,sy,stage==='cast'?34:47,angle+p*2.2,color,.84*a,phase);
  r.starCore(sx,sy,stage==='cast'?23:31,-angle-p*1.6,accent,.75*a,phase+.24);
  if(stage!=='cast'&&travel>.72){r.vortex(e.x,e.y,137,angle+p*.8,'#6e43ad',.56*a,phase);r.light(e.x,e.y,105,color,.16*a,.55,phase);}
}

function staffFrost(c,stage){
  const {event:e,progress:p,alpha:a,phase,color,accent}=c,r=c.renderer;
  const quality=clamp(e.quality??3,0,3),damageRadius=e.radius||165,cx=e.x,cy=e.y;
  const invoke=(name,...args)=>{if(typeof r[name]==='function')r[name](...args);};
  const angles=Array.from({length:6},(_,i)=>-Math.PI/2+i*TAU/6),radii=[.78,.75,.77,.78,.75,.77];
  const renderGround=(strength,rotation=0,progress=p)=>{
    // Keep the floor readable: a dark contact well, a beveled rim, then sparse fractures.
    invoke('groundSeal',cx,cy,damageRadius*1.04,rotation,'#061528',.46*strength,progress);
    invoke('crackField',cx,cy,damageRadius*1.01,rotation,'#1b6da5',.4*strength,progress);
    const fractureReveal=smooth(.12,.66,clamp(progress,0,1));
    for(let i=0;i<4;i++){
      const rayAngle=angles[(i+1)%angles.length]+Math.sin(progress*2.4+i)*.08;
      const distance=damageRadius*(.16+(i%2)*.09),length=damageRadius*(.11+(i%3)*.035),x=cx+Math.cos(rayAngle)*distance,y=cy+Math.sin(rayAngle)*distance*.58;
      invoke('beam',x,y,length,1.35+i%2*.45,rayAngle,'#c8f8ff',.24*strength*fractureReveal,phase+i*.17);
      if(i%2===0)invoke('shard',x+Math.cos(rayAngle)*length*.52,y+Math.sin(rayAngle)*length*.28,2.2+i*.45,rayAngle+.34,'#efffff',.34*strength*fractureReveal,phase+i*.17);
    }
    r.ring(cx,cy,damageRadius*.98,'#c9f8ff',.16*strength,.014,.62,rotation,phase);
  };
  const renderPrisms=(growth,strength,rotation=0)=>{
    const reveal=clamp(growth,0,1);
    for(let i=0;i<6;i++){
      const delay=(i%3)*.075,appear=smooth(delay,.52+delay,reveal),distance=damageRadius*radii[i]*(.96-.13*reveal),x=cx+Math.cos(angles[i]+rotation)*distance,y=cy+Math.sin(angles[i]+rotation)*distance*.58,lean=angles[i]+rotation+(i%2?-.1:.1);
      invoke('prism',x,y,21+quality*2.2,78+quality*7+reveal*28,lean,i%2?'#2d8bc9':'#bff7ff',(.7+quality*.06)*strength*appear,appear);
      r.starCore(x,y-2,4.5+(8+quality)*appear,lean-.18,'#efffff',.46*strength*appear,phase+i*.17);
      const beamLength=Math.hypot(x-cx,y-cy),rayAngle=Math.atan2(y-cy,x-cx);
      r.beam((cx+x)*.5,(cy+y)*.5,beamLength,4.4+quality*.32,rayAngle,'#0a3769',.48*strength*appear,phase+i*.08);
      r.beam((cx+x)*.5,(cy+y)*.5,beamLength,1.15+quality*.12,rayAngle,'#dffcff',.5*strength*appear,phase+i*.08);
    }
  };
  if(r.assetsReady){
    if(stage==='cast'){
      const seal=smooth(.02,.28,p),pressure=smooth(.08,.56,p),crystalReveal=smooth(.2,.78,p),fade=1-smooth(.9,1,p),castAlpha=a*fade,rotation=-.05+p*.035;
      renderGround(castAlpha*seal,rotation,p);
      renderPrisms(smooth(.16,.9,p),castAlpha*.28,rotation);
      if(typeof r.assetStaffGroundV9==='function')r.assetStaffGroundV9(cx,cy,damageRadius*1.02,rotation,.84*castAlpha,crystalReveal,quality);
      if(typeof r.assetStaffCollapseV9==='function')r.assetStaffCollapseV9(cx,cy-16,damageRadius*.84,rotation,.96*castAlpha,crystalReveal,quality);
      if(typeof r.assetStaffCollapseV10==='function'&&crystalReveal>.72)r.assetStaffCollapseV10(cx,cy-16,damageRadius*.84,rotation+.015,.94*castAlpha,(crystalReveal-.72)/.28,quality);
      if(typeof r.assetStaffGleamV9==='function')r.assetStaffGleamV9(cx,cy-18,damageRadius*.86,rotation+.08,.82*castAlpha,crystalReveal,quality);
      invoke('collapseMist',cx,cy-18,damageRadius*.7,rotation,'#2e8ed0',.05*castAlpha*crystalReveal,crystalReveal);
      r.ring(cx,cy,22+damageRadius*.7*pressure,'#74ddff',.58*castAlpha*pressure,.014,.82,rotation,phase);
      r.ring(cx,cy,damageRadius*(.58+.38*crystalReveal),'#e3fdff',.42*castAlpha*crystalReveal,.011,.8,-rotation,phase+.18);
      r.light(cx,cy-34,38+34*pressure,'#1d9dff',.08*castAlpha*pressure,.72,phase);
      return;
    }
    const seal=smooth(0,.12,p),pull=smooth(.1,.5,p),burst=smooth(.18,.48,p)*(1-smooth(.7,1,p)),fade=1-smooth(.78,1,p),visual=(.78+.22*seal)*fade,rotation=.04-p*.08,drawRadius=damageRadius*(1-.1*pull),perimeter=drawRadius*.98;
    renderGround(a*visual*.48,rotation,p);
    renderPrisms(.72+.28*pull,a*visual*.2,rotation);
    if(typeof r.assetStaffGroundV9==='function')r.assetStaffGroundV9(cx,cy,drawRadius*1.02,rotation,.68*a*visual,clamp(.22+.5*pull,0,.999),quality);
    if(typeof r.assetStaffCollapseV9==='function'&&pull<.74)r.assetStaffCollapseV9(cx,cy-14,drawRadius*.8,rotation,.42*a*visual,clamp(.12+.48*pull,0,.999),quality);
    if(typeof r.assetStaffCollapseV10==='function'&&pull>=.74)r.assetStaffCollapseV10(cx,cy-14,drawRadius*.8,rotation+.015,.9*a*visual,(pull-.74)/.26,quality);
    if(typeof r.assetStaffGleamV9==='function'&&pull<.74)r.assetStaffGleamV9(cx,cy-16,drawRadius*.82,rotation+.06,.76*a*visual,clamp(.16+.58*pull,0,.999),quality);
    invoke('collapseMist',cx,cy-20,drawRadius*.72,rotation,'#1d72b1',.06*a*visual,p);
    if(pull>=.74)invoke('prism',cx,cy-30,26+burst*8,62+burst*18,-p*1.3,'#167ccc',.52*a*visual,1);
    r.ring(cx,cy,perimeter,'#e4fdff',.62*a*visual,.012,.82,rotation,phase);
    if(burst>.01){
      if(typeof r.assetStaffBurstV9==='function')r.assetStaffBurstV9(cx,cy,damageRadius*(.56+.32*burst),rotation,.98*a*burst,clamp(.02+burst*.96,0,.999),quality);
      r.iceBurst(cx,cy,damageRadius*(.24+.3*burst),rotation,.18*a*burst,burst,quality);
      for(let i=0;i<8+quality;i++){const shardAngle=angles[i%6]+(i>5?.22:-.08),distance=24+burst*(48+i*4);r.shard(cx+Math.cos(shardAngle)*distance,cy+Math.sin(shardAngle)*distance*.68,5+i%4,shardAngle,'#f2ffff',(.36+quality*.035)*a*burst,phase+i*.12);}
      r.light(cx,cy-32,48+24*burst,'#2a9dff',.09*a*burst,.72,phase);
    }
    return;
  }
  const growth=stage==='cast'?smooth(.06,.82,p):smooth(.02,.56,p),rotation=stage==='cast'?p*.08:-p*.1;
  renderGround(a*(stage==='cast'?growth:.92),rotation,p);
  renderPrisms(growth,a*.78,rotation);
  invoke('prism',e.x,e.y-30,stage==='cast'?30:34*(1-.12*p),stage==='cast'?72:78,rotation*1.4,accent,.78*a,stage==='cast'?growth:1-p*.2);
  if(stage!=='cast'){for(let i=0;i<6;i++){const angle=angles[i]-p*.55,dist=30+p*62;r.shard(e.x+Math.cos(angle)*dist,e.y+Math.sin(angle)*dist*.66,5+i%3,angle,accent,.34*a,phase+i*.1);r.rock(e.x+Math.cos(angle)*dist*.82,e.y+Math.sin(angle)*dist*.54,3+i%2,angle,accent,.16*a,phase+i*.1);}}
}

function bowSpin(c,stage){
  const {event:e,progress:p,alpha:a,phase}=c,{dx,dy,length,angle}=geometry(c),r=c.renderer;
  const deep='#0b4137',jade='#25d7a4',mint='#a4ffe0',ivory='#fff1b6';
  const travel=stage==='cast'?1:Math.min(1,p*2.4),visible=Math.max(20,length*travel);
  wake(r,e.ox+dx*travel*.5,e.oy+dy*travel*.5,visible,48,angle,deep,.76*a,phase);
  wake(r,e.ox+dx*travel*.48,e.oy+dy*travel*.48,visible*.94,31,angle,jade,.7*a,phase+.32);
  wake(r,e.ox+dx*travel*.46,e.oy+dy*travel*.46,visible*.87,18,angle,mint,.48*a,phase+.61);
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
    wake(r,mark.x,mark.y-28+p*35,78,13,Math.PI/2,color,.64*a,phase+i*.12);
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
    r.crescent(e.x,e.y,37+p*11,angle+Math.PI/2,color,.76*a,phase);wake(r,e.x,e.y,66,14,angle,accent,.65*a,phase);
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
