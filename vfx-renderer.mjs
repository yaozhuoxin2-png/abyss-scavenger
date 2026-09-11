const TAU=Math.PI*2;
const clamp01=value=>Math.max(0,Math.min(1,value));
const easeOut=value=>1-Math.pow(1-clamp01(value),3);

function alphaColor(color,alpha){
  const match=/^#([0-9a-f]{6})$/i.exec(color||'');
  if(!match)return color||'#ffffff';
  const value=parseInt(match[1],16);
  return `rgba(${value>>16},${value>>8&255},${value&255},${clamp01(alpha)})`;
}

function seeded(seed=1){let state=(Math.abs(Math.floor(seed*9973))||1)>>>0;return()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};}

function softDisc(ctx,x,y,r,color,alpha=.7,core=.05){
  const gradient=ctx.createRadialGradient(x,y,r*core,x,y,r);
  gradient.addColorStop(0,alphaColor('#ffffff',alpha));
  gradient.addColorStop(.16,alphaColor(color,alpha*.88));
  gradient.addColorStop(.55,alphaColor(color,alpha*.24));
  gradient.addColorStop(1,alphaColor(color,0));
  ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
}

function lensRay(ctx,length,width,color,alpha){
  const gradient=ctx.createLinearGradient(0,0,length,0);
  gradient.addColorStop(0,alphaColor('#ffffff',alpha));
  gradient.addColorStop(.22,alphaColor(color,alpha*.78));
  gradient.addColorStop(1,alphaColor(color,0));
  ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(0,-width);ctx.quadraticCurveTo(length*.55,-width*.22,length,0);ctx.quadraticCurveTo(length*.55,width*.22,0,width);ctx.closePath();ctx.fill();
}

function motif(ctx,name,r,color,accent,phase){
  ctx.strokeStyle=accent;ctx.fillStyle=alphaColor(color,.16);ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(1.2,r*.025);
  if(name==='blade'){
    for(const side of [-1,1]){ctx.save();ctx.rotate(side*(.48+.08*Math.sin(phase*TAU)));ctx.beginPath();ctx.moveTo(-r*.48,side*r*.06);ctx.bezierCurveTo(-r*.05,-side*r*.33,r*.24,-side*r*.27,r*.52,side*r*.02);ctx.bezierCurveTo(r*.18,-side*r*.08,-r*.08,side*r*.08,-r*.48,side*r*.06);ctx.fill();ctx.stroke();ctx.restore();}
  }else if(name==='arrow'){
    for(const spread of [-.34,0,.34]){ctx.save();ctx.rotate(spread);ctx.beginPath();ctx.moveTo(-r*.48,0);ctx.bezierCurveTo(-r*.12,-r*.04,r*.18,r*.04,r*.42,0);ctx.stroke();ctx.beginPath();ctx.moveTo(r*.42,0);ctx.lineTo(r*.18,-r*.13);ctx.lineTo(r*.24,0);ctx.lineTo(r*.18,r*.13);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
  }else if(name==='clock'){
    ctx.beginPath();ctx.arc(0,0,r*.39,0,TAU);ctx.stroke();for(let i=0;i<12;i++){ctx.save();ctx.rotate(i*TAU/12);ctx.beginPath();ctx.moveTo(0,-r*.32);ctx.lineTo(0,-r*.39);ctx.stroke();ctx.restore();}ctx.lineWidth=r*.045;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-r*.26);ctx.moveTo(0,0);ctx.lineTo(r*.22,r*.1);ctx.stroke();
  }else if(name==='ember'){
    for(let i=0;i<7;i++){ctx.save();ctx.rotate(i*TAU/7+phase*.4);ctx.beginPath();ctx.moveTo(r*.12,r*.04);ctx.bezierCurveTo(r*.28,-r*.28,r*.42,-r*.08,r*.55,0);ctx.bezierCurveTo(r*.36,r*.05,r*.27,r*.18,r*.12,r*.04);ctx.fill();ctx.stroke();ctx.restore();}
  }else if(name==='thorn'||name==='bone'||name==='stone'){
    for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*TAU/6);ctx.beginPath();ctx.moveTo(r*.12,-r*.09);ctx.bezierCurveTo(r*.24,-r*.22,r*.38,-r*.13,r*.58,0);ctx.bezierCurveTo(r*.39,r*.12,r*.26,r*.2,r*.12,r*.09);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
  }else if(name==='crown'){
    ctx.beginPath();ctx.moveTo(-r*.5,r*.24);ctx.lineTo(-r*.42,-r*.28);ctx.lineTo(-r*.14,-r*.06);ctx.lineTo(0,-r*.43);ctx.lineTo(r*.14,-r*.06);ctx.lineTo(r*.42,-r*.28);ctx.lineTo(r*.5,r*.24);ctx.quadraticCurveTo(0,r*.42,-r*.5,r*.24);ctx.closePath();ctx.fill();ctx.stroke();
  }else{
    ctx.beginPath();for(let i=0;i<16;i++){const angle=-Math.PI/2+i*TAU/16,radius=i%2?r*.18:r*.49;ctx.lineTo(Math.cos(angle)*radius,Math.sin(angle)*radius);}ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*.12,0,TAU);ctx.stroke();
  }
}

export function drawModernSigil(ctx,e,progress){
  const p=clamp01(progress),reveal=e.phase==='cast'?easeOut(p/.62):easeOut(p/.32),fade=e.phase==='cast'?1-clamp01((p-.72)/.28):1-clamp01((p-.6)/.4),r=e.r*(.58+.42*reveal),color=e.color||'#9b8cf2',accent=e.accent||'#f1eaff';
  ctx.save();ctx.translate(e.x,e.y);ctx.scale(1,.56);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;
  softDisc(ctx,0,0,r*1.22,color,e.phase==='cast'?.3:.52,.1);
  ctx.shadowColor=color;ctx.shadowBlur=18;ctx.lineCap='round';
  for(let layer=0;layer<3;layer++){
    ctx.save();ctx.rotate((layer%2?1:-1)*p*(1.1+layer*.55)+(e.angle||0));ctx.strokeStyle=layer===1?accent:color;ctx.lineWidth=layer===1?1.2:2.4-layer*.45;ctx.setLineDash(layer===0?[r*.27,r*.07,r*.035,r*.08]:layer===1?[r*.065,r*.045]:[r*.18,r*.12]);ctx.lineDashOffset=-p*r*(1.3+layer*.7);ctx.beginPath();ctx.arc(0,0,r*(1-layer*.16),0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }
  for(let i=0;i<12;i++){ctx.save();ctx.rotate(i*TAU/12-p*.7);const pulse=.82+.18*Math.sin(p*TAU*2+i);ctx.strokeStyle=i%3===0?accent:alphaColor(color,.8);ctx.lineWidth=i%3===0?2:1;ctx.beginPath();ctx.moveTo(r*.67,-r*.035);ctx.quadraticCurveTo(r*.8*pulse,-r*.09,r*.95,0);ctx.quadraticCurveTo(r*.8*pulse,r*.09,r*.67,r*.035);ctx.stroke();ctx.restore();}
  ctx.save();ctx.rotate(-p*1.8+(e.angle||0)*.15);motif(ctx,e.motif||'star',r*.78,color,accent,p);ctx.restore();
  ctx.globalAlpha=fade*(e.phase==='cast'?.45:.8);for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*TAU/5+p*1.3);lensRay(ctx,r*(.42+.09*i),r*.018,color,.42);ctx.restore();}
  ctx.restore();
}

export function drawImpactBloom(ctx,e,progress){
  const p=clamp01(progress),color=e.color||'#9b8cf2',accent=e.accent||'#ffffff',r=(e.r||80)*( .38+easeOut(p)*.88),fade=1-easeOut(Math.max(0,(p-.48)/.52));
  ctx.save();ctx.translate(e.x,e.y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;softDisc(ctx,0,0,r,color,.9,.015);softDisc(ctx,0,0,r*.36,accent,.95,.02);
  const random=seeded(e.seed||e.x*3+e.y*7);for(let i=0;i<14;i++){ctx.save();ctx.rotate(i*TAU/14+(random()-.5)*.12);lensRay(ctx,r*(.62+random()*.7),r*(.008+random()*.026),i%4===0?accent:color,.72);ctx.restore();}
  ctx.strokeStyle=alphaColor(accent,.9);ctx.shadowColor=color;ctx.shadowBlur=22;ctx.lineWidth=Math.max(1,7*(1-p));ctx.beginPath();ctx.ellipse(0,0,r*1.08,r*.58,0,0,TAU);ctx.stroke();ctx.strokeStyle=alphaColor(color,.7);ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,r*1.33,r*.71,0,0,TAU);ctx.stroke();ctx.restore();
}

export function drawEnergyRibbon(ctx,e,progress){
  const p=clamp01(progress),fade=1-easeOut(Math.max(0,(p-.44)/.56)),length=(e.r||110)*(.35+easeOut(p)),color=e.color||'#9b8cf2',accent=e.accent||'#ffffff',random=seeded(e.seed||1);
  ctx.save();ctx.translate(e.x,e.y);ctx.rotate((e.angle||0)+(random()-.5)*.08);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.lineCap='round';
  for(let layer=0;layer<3;layer++){const width=(7-layer*2.2)*(1-p*.55),bend=(random()-.5)*length*.35;ctx.strokeStyle=layer===2?alphaColor(accent,.92):alphaColor(color,.25+layer*.24);ctx.lineWidth=Math.max(.7,width);ctx.shadowColor=color;ctx.shadowBlur=layer===0?22:9;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(length*.24,bend,length*.68,-bend*.7,length,Math.sin(p*TAU+e.seed)*8);ctx.stroke();}
  ctx.restore();
}

export function drawArcLightning(ctx,e,progress){
  const p=clamp01(progress),fade=1-easeOut(Math.max(0,(p-.5)/.5)),length=e.r||100,color=e.color||'#8bcfff',accent=e.accent||'#ffffff',random=seeded(e.seed||1);
  ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.lineCap='round';
  for(let branch=0;branch<3;branch++){ctx.beginPath();ctx.moveTo(0,0);for(let i=1;i<=9;i++){const x=length*i/9,y=(random()-.5)*(17+branch*6)*(1-i/12);ctx.lineTo(x,y);}ctx.strokeStyle=branch===0?alphaColor(accent,.95):alphaColor(color,.62);ctx.lineWidth=branch===0?1.7:4.5;ctx.shadowColor=color;ctx.shadowBlur=branch===0?7:16;ctx.stroke();}
  ctx.restore();
}

export function drawVolumetricPillar(ctx,e,progress){
  const p=clamp01(progress),fade=1-easeOut(Math.max(0,(p-.58)/.42)),height=(e.height||145)*(1-p*.28),r=e.r||70,color=e.color||'#9b8cf2',accent=e.accent||'#ffffff';
  ctx.save();ctx.translate(e.x,e.y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;
  for(let i=0;i<7;i++){const offset=(i-3)*r*.075,gradient=ctx.createLinearGradient(offset,-height,offset,8);gradient.addColorStop(0,alphaColor(color,0));gradient.addColorStop(.26,alphaColor(i%2?accent:color,.13));gradient.addColorStop(.76,alphaColor(color,.34));gradient.addColorStop(1,alphaColor(accent,0));ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(offset-r*.05,3);ctx.quadraticCurveTo(offset-r*.16,-height*.46,offset-r*.03,-height);ctx.lineTo(offset+r*.03,-height);ctx.quadraticCurveTo(offset+r*.16,-height*.46,offset+r*.05,3);ctx.closePath();ctx.fill();}
  softDisc(ctx,0,-height*.08,r*.78,color,.48,.02);ctx.strokeStyle=alphaColor(accent,.8);ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,2,r*(.28+.38*p),r*(.08+.1*p),0,0,TAU);ctx.stroke();ctx.restore();
}

export function drawModernShard(ctx,e,progress){
  const p=clamp01(progress),fade=1-easeOut(Math.max(0,(p-.52)/.48)),size=e.size||6,color=e.color||'#ffffff',heading=Math.atan2(e.vy||0,e.vx||1);
  ctx.save();ctx.translate(e.x,e.y);ctx.rotate(heading);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.shadowColor=color;ctx.shadowBlur=13;
  const gradient=ctx.createLinearGradient(-size*5,0,size,0);gradient.addColorStop(0,alphaColor(color,0));gradient.addColorStop(.72,alphaColor(color,.5));gradient.addColorStop(1,alphaColor('#ffffff',.95));ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(-size*5,0);ctx.quadraticCurveTo(-size,-size*.6,size,0);ctx.quadraticCurveTo(-size,size*.6,-size*5,0);ctx.fill();ctx.restore();
}

export function drawModernSlash(ctx,e,progress){
  const p=clamp01(progress),r=e.r||80,color=e.color||'#f3d891',fade=1-easeOut(Math.max(0,(p-.5)/.5));ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.lineCap='round';
  for(let i=0;i<4;i++){ctx.strokeStyle=i===3?alphaColor('#ffffff',.92):alphaColor(color,.18+i*.17);ctx.lineWidth=(14-i*3.6)*(1-p*.45);ctx.shadowColor=color;ctx.shadowBlur=i?8:22;ctx.beginPath();ctx.arc(0,0,r*(.58+p*.42)+i*2,-1.28+p*.18,1.28+p*.24);ctx.stroke();}
  ctx.restore();
}

export function drawModernProjectile(ctx,s,t){
  const color=s.color||(s.magic?'#9b8cf2':'#65d9af'),accent=s.magic?'#f5ecff':'#f3fff7',speed=Math.max(1,Math.hypot(s.vx||0,s.vy||0)),angle=Math.atan2(s.vy||0,s.vx||1),trail=Math.min(98,28+speed*.11+(s.rarity||0)*7);
  ctx.save();ctx.translate(s.x,s.y);ctx.rotate(angle);ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
  const gradient=ctx.createLinearGradient(-trail,0,8,0);gradient.addColorStop(0,alphaColor(color,0));gradient.addColorStop(.55,alphaColor(color,.24));gradient.addColorStop(.9,alphaColor(color,.82));gradient.addColorStop(1,alphaColor(accent,.95));ctx.strokeStyle=gradient;ctx.shadowColor=color;ctx.shadowBlur=14+(s.rarity||0)*2;ctx.lineWidth=(s.magic?8:4)+(s.rarity||0)*.7;ctx.beginPath();ctx.moveTo(-trail,Math.sin(t*12+s.x)*3);ctx.bezierCurveTo(-trail*.68,-5,-trail*.28,4,2,0);ctx.stroke();
  if(s.magic){softDisc(ctx,2,0,10+(s.rarity||0)*1.5,color,.9,.03);ctx.strokeStyle=accent;ctx.lineWidth=1.3;for(let i=0;i<3;i++){ctx.save();ctx.rotate(t*4+i*TAU/3);ctx.beginPath();ctx.arc(0,0,7+i*2,-.42,.42);ctx.stroke();ctx.restore();}}
  else{ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-2,-5);ctx.lineTo(1,0);ctx.lineTo(-2,5);ctx.closePath();ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-1,0);ctx.lineTo(-15,0);ctx.moveTo(-10,0);ctx.lineTo(-15,-5);ctx.moveTo(-10,0);ctx.lineTo(-15,5);ctx.stroke();}
  ctx.restore();
}

export function drawModernTargeting(ctx,x,y,r,color,t,kind,accent='#ffffff',motifName=null){
  ctx.save();ctx.translate(x,y);ctx.scale(1,.56);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=.88;const field=ctx.createRadialGradient(0,0,r*.08,0,0,r*1.04);field.addColorStop(0,alphaColor(color,.1));field.addColorStop(.72,alphaColor(color,.035));field.addColorStop(1,alphaColor(color,0));ctx.fillStyle=field;ctx.beginPath();ctx.arc(0,0,r*1.04,0,TAU);ctx.fill();ctx.globalCompositeOperation='lighter';ctx.shadowColor=color;ctx.shadowBlur=12;ctx.lineCap='round';
  for(let layer=0;layer<3;layer++){ctx.save();ctx.rotate((layer%2?1:-1)*t*(.5+layer*.22));ctx.strokeStyle=layer===1?alphaColor(accent,.72):color;ctx.lineWidth=layer===0?2.8:1.25;ctx.setLineDash(layer===0?[r*.22,r*.055,r*.035,r*.06]:[r*.07,r*.05]);ctx.lineDashOffset=-t*r*(.8+layer*.3);ctx.beginPath();ctx.arc(0,0,r*(1-layer*.16),0,TAU);ctx.stroke();ctx.restore();}
  motif(ctx,motifName||(kind==='sword'?'blade':kind==='bow'?'arrow':'star'),r*.67,color,accent,t%1);for(let i=0;i<8;i++){ctx.save();ctx.rotate(i*TAU/8-t*.35);lensRay(ctx,r*.45,r*.015,color,.48);ctx.restore();}ctx.restore();
}

export function drawAbilityAccent(ctx,e,progress){
  const p=clamp01(progress),fade=1-easeOut(Math.max(0,(p-.5)/.5)),r=e.r||86,color=e.color||'#8fcbe8',accent=e.accent||'#ffffff',angle=e.angle||0;
  ctx.save();ctx.translate(e.x,e.y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.shadowColor=color;ctx.shadowBlur=14;ctx.lineCap='round';ctx.lineJoin='round';
  if(e.name==='dash'){
    ctx.rotate(angle+Math.PI);for(let side=-1;side<=1;side++){ctx.strokeStyle=side?alphaColor(color,.52):alphaColor(accent,.92);ctx.lineWidth=side?8:2;ctx.beginPath();ctx.moveTo(-r*.08,side*8);ctx.bezierCurveTo(r*.28,side*22,r*.72,-side*18,r*(.85+p*.55),side*3);ctx.stroke();}
    for(let i=0;i<5;i++){ctx.save();ctx.translate(r*(.18+i*.19),Math.sin(i*2.1+p*TAU)*12);ctx.rotate(Math.PI/4+p*.8);ctx.strokeStyle=i%2?color:accent;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(0,-6);ctx.lineTo(6,0);ctx.lineTo(0,6);ctx.closePath();ctx.stroke();ctx.restore();}
  }else if(e.name==='spin'){
    const arms=e.kind==='bow'?7:e.kind==='staff'?5:3;for(let i=0;i<arms;i++){ctx.save();ctx.rotate(angle+i*TAU/arms+p*(e.kind==='staff'?2.4:1.25));ctx.strokeStyle=i%2?alphaColor(color,.6):alphaColor(accent,.92);ctx.lineWidth=e.kind==='sword'?9:3;ctx.beginPath();ctx.arc(0,0,r*(.48+.5*p),-.82,.58);ctx.stroke();if(e.kind==='bow'){ctx.translate(r*(.72+.22*p),0);ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-5,-4);ctx.lineTo(-1,0);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();}ctx.restore();}
    ctx.strokeStyle=alphaColor(accent,.78);ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,r*(.55+.55*p),r*(.2+.26*p),angle-p,0,TAU);ctx.stroke();
  }else{
    if(e.kind==='staff'){
      for(const side of [-1,1]){ctx.save();ctx.rotate(angle+side*(.3+p*.65));const second=side<0?color:accent;for(let i=0;i<4;i++){ctx.strokeStyle=alphaColor(second,.3+i*.14);ctx.lineWidth=7-i*1.5;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(side*r*.18,-r*.22,side*r*.38,-r*.6,side*r*(.12+p*.42),-r*(.75+p*.4));ctx.stroke();ctx.rotate(side*.13);}ctx.restore();}
      softDisc(ctx,-r*.2,-r*.16,r*.2,color,.75,.03);softDisc(ctx,r*.2,-r*.16,r*.2,accent,.62,.03);
    }else if(e.kind==='bow'){
      for(let i=-3;i<=3;i++){ctx.save();ctx.translate(i*r*.16,-r*(.78+Math.abs(i)*.08));ctx.rotate(Math.PI/2+(i*.04));ctx.strokeStyle=i===0?accent:color;ctx.lineWidth=i===0?3:1.6;ctx.beginPath();ctx.moveTo(-r*.28,0);ctx.lineTo(r*.28,0);ctx.moveTo(r*.28,0);ctx.lineTo(r*.13,-5);ctx.moveTo(r*.28,0);ctx.lineTo(r*.13,5);ctx.stroke();ctx.restore();}
      ctx.strokeStyle=alphaColor(accent,.85);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*(.38+.48*p),0,TAU);ctx.stroke();
    }else{
      ctx.rotate(angle);for(let i=-2;i<=2;i++){ctx.strokeStyle=i===0?accent:alphaColor(color,.72);ctx.lineWidth=i===0?3:7-Math.abs(i);ctx.beginPath();ctx.moveTo(-r*.18,i*8);ctx.bezierCurveTo(r*.18,i*14,r*.58,-i*11,r*(.75+p*.55),i*4);ctx.stroke();}
    }
  }
  ctx.restore();
}

export function drawFrozenStatus(ctx,e,t){
  const radius=e.boss?52:Math.max(24,(e.r||12)*2.05),height=e.boss?124:78,phase=t*1.35+(e.id||0)*.73;
  ctx.save();ctx.translate(e.x,e.y);ctx.globalCompositeOperation='source-over';
  const frost=ctx.createRadialGradient(0,-height*.42,3,0,-height*.42,radius*.9);frost.addColorStop(0,'rgba(226,250,255,.18)');frost.addColorStop(.55,'rgba(113,204,231,.075)');frost.addColorStop(1,'rgba(89,170,211,0)');ctx.fillStyle=frost;ctx.beginPath();ctx.ellipse(0,-height*.42,radius*.9,height*.5,0,0,TAU);ctx.fill();
  ctx.globalCompositeOperation='lighter';ctx.shadowColor='#78d9f2';ctx.shadowBlur=10;ctx.strokeStyle='rgba(191,239,250,.74)';ctx.fillStyle='rgba(105,202,231,.2)';ctx.lineCap='round';
  ctx.save();ctx.scale(1,.34);ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,8,radius*(.72+.035*Math.sin(phase)),radius,0,0,TAU);ctx.stroke();for(let i=0;i<8;i++){const a=i*TAU/8+.13*Math.sin(phase);ctx.beginPath();ctx.moveTo(Math.cos(a)*radius*.22,Math.sin(a)*radius*.22);ctx.lineTo(Math.cos(a)*radius*.82,Math.sin(a)*radius*.82);ctx.stroke();}ctx.restore();
  for(let i=0;i<8;i++){const side=i%2?-1:1,y=-8-(i%4)*height*.19,x=side*(radius*(.44+.1*(i%3))),size=7+(i%3)*3,wave=Math.sin(phase+i*1.9)*1.6;ctx.save();ctx.translate(x+wave,y);ctx.rotate(side*(.22+.06*i));ctx.beginPath();ctx.moveTo(0,-size*1.7);ctx.lineTo(size*.55,0);ctx.lineTo(0,size*.72);ctx.lineTo(-size*.48,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
  for(let i=0;i<5;i++){const a=phase*.34+i*1.71,x=Math.cos(a)*radius*.54,y=-height*.26+Math.sin(a*1.7)*height*.24,r=5+(i%2)*3;softDisc(ctx,x,y,r,'#9be7f5',.22,.04);}
  ctx.restore();
}

export function drawFrostBurst(ctx,e,progress){
  const p=clamp01(progress),fade=1-easeOut(Math.max(0,(p-.55)/.45)),r=(e.r||34)*(.35+easeOut(p)*1.1);ctx.save();ctx.translate(e.x,e.y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.shadowColor='#8ee8ff';ctx.shadowBlur=13;
  for(let i=0;i<12;i++){ctx.save();ctx.rotate(i*TAU/12+(e.seed||0)*.01);ctx.translate(r*(.3+.7*p),0);ctx.fillStyle=i%3?'rgba(118,211,239,.62)':'rgba(229,251,255,.9)';ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-4,-3);ctx.lineTo(-1,0);ctx.lineTo(-4,3);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.strokeStyle='rgba(208,248,255,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,r,r*.34,0,0,TAU);ctx.stroke();ctx.restore();
}

export function drawBossSignature(ctx,e,progress){
  const p=clamp01(progress),floor=e.floor||1,r=e.r||78,color=e.color||['#90bd79','#db8d72','#9ea9ef','#e0787f','#74c7df','#ffd66e'][floor-1]||'#ffd66e',accent=e.accent||['#d8f1b2','#ffd08b','#f1efff','#ffc0c1','#baf5ff','#fff1a8'][floor-1]||'#fff1a8',fade=(e.opacity??1)*(1-easeOut(Math.max(0,(p-.62)/.38))),spin=(e.seed||0)*.007+p*(e.phase==='cast'?.7:1.35);
  ctx.save();ctx.translate(e.x,e.y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;ctx.shadowColor=color;ctx.shadowBlur=16;ctx.lineCap='round';ctx.lineJoin='round';
  if(floor===1){
    // Living stone: heavy seismic rings, roots and angular rock plates.
    ctx.strokeStyle=alphaColor(accent,.72);for(let i=0;i<10;i++){ctx.save();ctx.rotate(i*TAU/10+.13*Math.sin(spin+i));ctx.lineWidth=i%3===0?3:1.4;ctx.beginPath();ctx.moveTo(r*.16,0);ctx.bezierCurveTo(r*.34,-9,r*.54,12,r*(.76+.22*p),0);ctx.lineTo(r*(.94+.2*p),i%2?5:-4);ctx.stroke();ctx.restore();}for(let i=0;i<7;i++){ctx.save();ctx.rotate(i*TAU/7-spin*.22);ctx.translate(r*(.42+.25*p),0);ctx.fillStyle=alphaColor(i%2?color:accent,.28);ctx.strokeStyle=alphaColor(accent,.8);ctx.rotate(Math.PI/4);ctx.beginPath();ctx.moveTo(-8,-6);ctx.lineTo(9,-4);ctx.lineTo(12,6);ctx.lineTo(-4,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
  }else if(floor===2){
    // Forge fire: molten petals, heat tongues and flying embers.
    for(let i=0;i<9;i++){ctx.save();ctx.rotate(i*TAU/9+spin*.34);ctx.fillStyle=alphaColor(i%3===0?accent:color,.2+i%2*.09);ctx.strokeStyle=alphaColor(accent,.78);ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(r*.12,0);ctx.bezierCurveTo(r*.34,-r*.18,r*.57,-r*.12,r*(.9+.2*p),0);ctx.bezierCurveTo(r*.58,r*.15,r*.35,r*.22,r*.12,0);ctx.fill();ctx.stroke();ctx.restore();}for(let i=0;i<14;i++){const a=i*2.399+spin,d=r*(.26+.64*((i%5)/4));softDisc(ctx,Math.cos(a)*d,Math.sin(a)*d*.62,2+i%3,i%4===0?accent:color,.62,.06);}
  }else if(floor===3){
    // Astral court: orbitals, constellations and comet chords.
    ctx.strokeStyle=alphaColor(color,.62);ctx.lineWidth=1.4;for(let i=0;i<3;i++){ctx.save();ctx.rotate(spin*(i%2?-.5:.7)+i*.8);ctx.beginPath();ctx.ellipse(0,0,r*(.62+i*.13),r*(.2+i*.055),0,0,TAU);ctx.stroke();ctx.restore();}const stars=[];for(let i=0;i<8;i++){const a=i*TAU/8+spin*(i%2?.25:-.18),d=r*(.42+(i%3)*.19),x=Math.cos(a)*d,y=Math.sin(a)*d*.64;stars.push([x,y]);softDisc(ctx,x,y,4+i%3,i%3===0?accent:color,.78,.03);}ctx.strokeStyle=alphaColor(accent,.52);ctx.beginPath();for(let i=0;i<stars.length;i++){const [x,y]=stars[(i*3)%stars.length];if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();
  }else if(floor===4){
    // Blood and bone: rib arcs with organic tendrils, never a generic circle.
    ctx.strokeStyle=alphaColor(accent,.72);for(const side of [-1,1])for(let i=0;i<5;i++){ctx.save();ctx.scale(side,1);ctx.lineWidth=2.8-i*.25;ctx.beginPath();ctx.moveTo(r*.08,-r*.42+i*r*.2);ctx.bezierCurveTo(r*.42,-r*.55+i*r*.22,r*.78,-r*.32+i*r*.19,r*(.86+.12*p),-r*.14+i*r*.12);ctx.stroke();ctx.restore();}ctx.strokeStyle=alphaColor(color,.75);for(let i=0;i<7;i++){ctx.save();ctx.rotate(i*TAU/7+spin*.18);ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(r*.12,0);ctx.bezierCurveTo(r*.34,-18,r*.58,20,r*(.88+.12*p),Math.sin(i+spin)*9);ctx.stroke();ctx.restore();}
  }else if(floor===5){
    // Time hunter: concentric mechanisms, split hands and delayed echoes.
    for(let ring=0;ring<3;ring++){ctx.save();ctx.rotate((ring%2?1:-1)*spin*(.8+ring*.25));ctx.strokeStyle=alphaColor(ring===1?accent:color,.72);ctx.lineWidth=ring===1?1.2:2;ctx.setLineDash(ring===0?[10,5,2,5]:[3+ring*3,5]);ctx.beginPath();ctx.arc(0,0,r*(.46+ring*.2),0,TAU);ctx.stroke();ctx.restore();}ctx.setLineDash([]);for(let i=0;i<12;i++){ctx.save();ctx.rotate(i*TAU/12);ctx.strokeStyle=alphaColor(accent,.76);ctx.lineWidth=i%3===0?3:1;ctx.beginPath();ctx.moveTo(0,-r*.64);ctx.lineTo(0,-r*(i%3===0?.9:.78));ctx.stroke();ctx.restore();}ctx.strokeStyle=accent;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(-1.2+spin)*r*.55,Math.sin(-1.2+spin)*r*.55);ctx.moveTo(0,0);ctx.lineTo(Math.cos(.35-spin*.35)*r*.38,Math.sin(.35-spin*.35)*r*.38);ctx.stroke();
  }else{
    // Final mirror: crown geometry and three weapon echoes refracting outward.
    ctx.strokeStyle=alphaColor(accent,.86);ctx.fillStyle=alphaColor(color,.12);ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(-r*.62,r*.2);ctx.lineTo(-r*.5,-r*.35);ctx.lineTo(-r*.18,-r*.08);ctx.lineTo(0,-r*.56);ctx.lineTo(r*.18,-r*.08);ctx.lineTo(r*.5,-r*.35);ctx.lineTo(r*.62,r*.2);ctx.quadraticCurveTo(0,r*.42,-r*.62,r*.2);ctx.closePath();ctx.fill();ctx.stroke();for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*TAU/6-spin*.38);ctx.translate(r*(.52+.22*p),0);ctx.rotate(i%3===0?.2:i%3===1?Math.PI/2:-.55);ctx.strokeStyle=i%2?color:accent;ctx.lineWidth=i%3===0?5:2;ctx.beginPath();if(i%3===0){ctx.moveTo(-17,0);ctx.lineTo(19,0);ctx.lineTo(12,-5);ctx.moveTo(19,0);ctx.lineTo(12,5);}else if(i%3===1){ctx.arc(0,0,12,-1.1,1.1);ctx.moveTo(6,-10);ctx.lineTo(-7,0);ctx.lineTo(6,10);}else{ctx.moveTo(-18,0);ctx.lineTo(17,0);ctx.arc(20,0,5,0,TAU);}ctx.stroke();ctx.restore();}
  }
  ctx.restore();
}

export function drawBossHazardOverlay(ctx,h,t,floor){
  const accents=['#c9efa4','#ffbd72','#daddff','#ff9ba7','#92efff','#f7d16d'],accent=accents[floor-1]||accents[5],color=h.color||accent,progress=clamp01(1-h.life/h.max);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.34+.42*progress;ctx.shadowColor=color;ctx.shadowBlur=15;ctx.lineCap='round';
  if(h.kind==='line'){ctx.translate(h.x,h.y);ctx.rotate(h.angle);for(let i=0;i<8;i++){const x=-h.length/2+(i+progress)*h.length/8;ctx.strokeStyle=i%2?color:accent;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x-18,-h.width*.32);ctx.quadraticCurveTo(x,-h.width*.08,x+18,0);ctx.quadraticCurveTo(x,h.width*.08,x-18,h.width*.32);ctx.stroke();}}
  else if(h.kind==='cone'){ctx.translate(h.x,h.y);for(let i=0;i<9;i++){const angle=h.angle-h.arc*.46+h.arc*.92*i/8;ctx.save();ctx.rotate(angle);ctx.translate(h.range*(.24+.7*progress),0);ctx.rotate(Math.PI/4);ctx.strokeStyle=i%3?color:accent;ctx.strokeRect(-5,-5,10,10);ctx.restore();}}
  else{ctx.translate(h.x,h.y);for(let i=0;i<10;i++){ctx.save();ctx.rotate(i*TAU/10+t*(i%2?.35:-.25));ctx.strokeStyle=i%3?color:accent;ctx.beginPath();ctx.moveTo(h.r*.48,-4);ctx.bezierCurveTo(h.r*.7,-11,h.r*.88,8,h.r*1.04,0);ctx.stroke();ctx.restore();}}
  ctx.restore();drawBossSignature(ctx,{x:h.x,y:h.y,r:Math.min(88,h.r||h.range||h.width||54),color,accent,floor,phase:'telegraph',opacity:.24,seed:h.x+h.y},progress);
}

export function drawBossImpact(ctx,e,progress){
  if(e.kind==='line'){
    const p=clamp01(progress),fade=1-easeOut(Math.max(0,(p-.42)/.58)),length=e.length||380,width=(e.width||36)*(1+p*1.8);ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade;const gradient=ctx.createLinearGradient(0,-width/2,0,width/2);gradient.addColorStop(0,alphaColor(e.color,0));gradient.addColorStop(.35,alphaColor(e.color,.42));gradient.addColorStop(.5,alphaColor('#ffffff',.92));gradient.addColorStop(.65,alphaColor(e.color,.42));gradient.addColorStop(1,alphaColor(e.color,0));ctx.fillStyle=gradient;ctx.shadowColor=e.color;ctx.shadowBlur=28;ctx.fillRect(-length/2,-width/2,length,width);for(let i=0;i<7;i++){ctx.save();ctx.translate(-length/2+i*length/6,0);lensRay(ctx,length*.22,width*.035,e.color,.72);ctx.restore();}ctx.restore();drawBossSignature(ctx,{...e,r:Math.max(62,width*1.4),phase:'impact'},progress);return;
  }
  drawImpactBloom(ctx,e,progress);drawBossSignature(ctx,{...e,phase:'impact'},progress);
}
