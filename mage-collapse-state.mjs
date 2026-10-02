// One deterministic timeline is consumed by gameplay and by the inspection UI.
// Ground coordinates use the existing game's pixels; height is independent.
export const MAGE_COLLAPSE_BUILD='8.4-mage-hybrid-1';
export const MAGE_COLLAPSE_DURATION=2.7;
export const MAGE_COLLAPSE_IMPACT=.82*8/10;
export const clamp01=x=>Math.max(0,Math.min(1,x));
export const smooth=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
export function seededRandom(seed=1){let n=(seed|0)||1;return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};}
export function collapseLayout(radius=165,seed=1,quality=0){
  const random=seededRandom(seed),crystals=[],chips=[],plates=[];
  for(let i=0;i<30;i++){
    const outer=i<18,major=outer&&i%3===0;
    const angle=outer?Math.floor(i/3)*Math.PI/3+(i%3-1)*.14+(random()-.5)*.1:(i-18)*Math.PI/6+.29+(random()-.5)*.2;
    const distance=radius*(outer?.62+random()*.2:.16+random()*.35),width=major?13+random()*8:5+random()*6;
    const back=Math.max(0,-Math.sin(angle)),height=outer?(major?88:52)+back*40+random()*30:39+random()*48;
    crystals.push({x:Math.cos(angle)*distance,y:Math.sin(angle)*distance,angle,width,depth:width*(.58+random()*.25),height,lean:.035+random()*.14,start:.09+distance/radius*.22+random()*.09,fall:.91+random()*.29,turn:(random()-.5)*.38,variant:i%4});
  }
  for(let i=0;i<34;i++){const angle=random()*Math.PI*2,distance=radius*(.09+random()*.77);plates.push({x:Math.cos(angle)*distance,y:Math.sin(angle)*distance,angle,width:8+random()*13,depth:7+random()*11,height:1.8+random()*3.4,start:.04+distance/radius*.32,variant:i%4});}
  const count=48+Math.max(0,Math.min(3,quality))*8;
  for(let i=0;i<count;i++){
    const angle=random()*Math.PI*2,distance=radius*(.12+random()*.69);
    chips.push({x:Math.cos(angle)*distance,y:Math.sin(angle)*distance,angle,delay:random()*.11,width:2.5+random()*5.5,height:7+random()*15,speed:14+random()*28,lift:48+random()*70,spin:(random()-.5)*5,variant:i%4});
  }
  for(let i=0;i<crystals.length;i++){
    const c=crystals[i];chips.push({x:c.x,y:c.y,angle:c.angle,delay:c.fall-MAGE_COLLAPSE_IMPACT+.02,width:c.width*.58,height:c.height*.3,originHeight:c.height*.55,speed:18+random()*35,lift:14+random()*30,spin:(random()-.5)*5,variant:c.variant});
  }
  return {radius,seed,quality,crystals,chips,plates};
}
export function collapsePhase(age){
  return {age,ground:smooth(.02,.52,age)*(1-smooth(1.6,MAGE_COLLAPSE_DURATION,age)),pressure:smooth(.08,.58,age),impact:smooth(MAGE_COLLAPSE_IMPACT-.025,MAGE_COLLAPSE_IMPACT+.06,age),release:1-smooth(1.35,1.95,age),mist:smooth(MAGE_COLLAPSE_IMPACT,MAGE_COLLAPSE_IMPACT+.12,age)*(1-smooth(1.0,1.68,age)),finished:age>=MAGE_COLLAPSE_DURATION};
}
export function crystalPose(c,age){
  const grow=smooth(c.start,c.start+.3,age),fall=smooth(c.fall,c.fall+.62,age);
  const collapse=1-smooth(c.fall+.35,c.fall+.82,age);
  return {x:c.x+Math.cos(c.angle)*fall*14,y:c.y+Math.sin(c.angle)*fall*14,height:c.height*grow*collapse,width:c.width*(.86+.14*grow)*collapse,depth:c.depth*collapse,lean:c.lean+fall*.68,angle:c.angle+c.turn*fall,visible:grow>.004&&collapse>.003};
}
export function chipPose(c,age){
  const t=Math.max(0,age-MAGE_COLLAPSE_IMPACT-c.delay),flight=clamp01(t/.9),fade=1-smooth(.55,1.3,t);
  const groundShift=c.speed*(1-Math.exp(-t*2))/2;
  const vertical=(c.originHeight||0)+c.lift*t-145*t*t,height=Math.max(0,vertical);
  return {x:c.x+Math.cos(c.angle)*groundShift,y:c.y+Math.sin(c.angle)*groundShift,height,width:c.width*fade,scale:fade,angle:c.angle+c.spin*flight,tilt:height>0?t*2.4:.95,visible:age>MAGE_COLLAPSE_IMPACT+c.delay&&fade>.005};
}
// Orthographic 2.5D calibration: the floor projects identically to Canvas2D.
export const FLOOR_COS=.8,HEIGHT_SIN=.6;
export function projectCollapsePoint(x,y,height=0){return {x,y:y-height*HEIGHT_SIN};}
export function collapseCameraShift(x,y){return {x:-x,y:y*.6,z:-y*.8};}
export function billboardDepth(footY,screenY){return .6*((footY-360)/FLOOR_COS)+.8*((footY-screenY)/HEIGHT_SIN);}
export function encodeFootY(y){const v=Math.round(clamp01(y/1024)*65535);return [v>>8,v&255,255];}
export function decodeFootY(r,g){return ((r<<8)|g)/65535*1024;}
