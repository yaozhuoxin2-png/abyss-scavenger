// Frame synthesis for key-pose atlases. Hero locomotion now uses dedicated
// hand-authored six-frame strips in game.mjs; this module handles other actions.
export const MOTION_FRAMES={idle:4,walk:6,attack:6,hit:3,death:7,execute:6};
const cache=new WeakMap();

export function motionFrame(base,action,index,direction=0){
  let frames=cache.get(base);if(!frames){frames=new Map();cache.set(base,frames);}
  const count=MOTION_FRAMES[action]||4,frame=Math.max(0,Math.min(count-1,index)),key=`${action}:${frame}:${direction}`;
  if(frames.has(key))return frames.get(key);
  const out=document.createElement('canvas');out.width=256;out.height=256;const ctx=out.getContext('2d');
  const phase=frame/count*Math.PI*2,progress=frame/Math.max(1,count-1),angle=Math.PI/2+direction*Math.PI/4;
  if(action==='death'){
    const fall=progress*progress*(3-2*progress),side=Math.cos(angle)>=0?1:-1;
    ctx.translate(128-side*fall*72,240-fall*44);ctx.rotate(side*fall*Math.PI/2);ctx.scale(1-.35*fall,1-.35*fall);
    // Shift the hip onto the ground as the body falls, retaining the foot anchor.
    ctx.translate(0,fall*8);ctx.drawImage(base,-128,-240);
  }else{
    const gait=action==='walk',attack=action==='attack'||action==='execute',hurt=action==='hit';
    const swing=attack?[-.18,-.36,-.12,.38,.2,0][frame]:hurt?[.2,-.13,0][frame]:0;
    const amplitude=action==='execute'?1.3:1;
    // Restrained deformation for non-humanoid atlases and non-walk actions.
    for(let y=0;y<256;y+=2){
      const leg=Math.max(0,Math.min(1,(y-176)/64)),torso=Math.max(0,1-Math.abs(y-105)/135);
      const shoulderShift=swing*torso*44*amplitude;
      const sway=gait?Math.sin(phase)*torso*.75:0;
      if(!gait||leg<=0){ctx.drawImage(base,0,y,256,2,sway+shoulderShift,y,256,2);continue;}
      for(let side=0;side<2;side++){
        const footPhase=phase+side*Math.PI,stride=Math.sin(footPhase)*leg*5.5;
        const lift=Math.max(0,Math.sin(footPhase))*leg*1.8;
        const lateral=.38+.32*Math.abs(Math.cos(angle));
        const dx=sway+stride*lateral;
        // Never extend a foot below the shared y=240 ground anchor.
        const dy=-lift;
        ctx.drawImage(base,side*128,y,128,2,side*128+dx,y+dy,128,2);
      }
    }
  }
  frames.set(key,out);return out;
}

export function motionSample(action,progress){
  // Idle must be visually stable. Cycling identical-looking generated frames and
  // cross-fading their antialiased edges caused a subtle but constant shimmer.
  if(action==='idle')return {first:0,next:0,blend:0};
  const count=MOTION_FRAMES[action]||4,loop=action==='walk'||action==='idle';
  const value=Math.max(0,Math.min(.999999,progress))*(loop?count:count-1),first=Math.floor(value);
  return {first,next:loop?(first+1)%count:Math.min(count-1,first+1),blend:value-first};
}
