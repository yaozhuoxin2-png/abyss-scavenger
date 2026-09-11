export const ANIMATION_CLIPS=Object.freeze({
  idle:{frames:4,duration:.9},
  walk:{frames:6,duration:1.05,loop:true},
  attack:{frames:6,duration:.42,hitFrame:3},
  hit:{frames:3,duration:.24},
  death:{frames:7,duration:.9},
  execute:{frames:6,duration:.48,hitFrame:3}
});

const POSES={
  idle:[{lean:-.008,sx:1,sy:1,forward:0},{lean:0,sx:.997,sy:1.006,forward:0},{lean:.008,sx:1,sy:1,forward:0},{lean:0,sx:1.003,sy:.996,forward:0}],
  walk:[{lean:-.035,sx:1.018,sy:.982,forward:-1,step:-1},{lean:0,sx:.985,sy:1.015,forward:1,step:0},{lean:.035,sx:1.018,sy:.982,forward:-1,step:1},{lean:0,sx:.985,sy:1.015,forward:1,step:0}],
  attack:[{lean:-.08,sx:1.02,sy:.98,forward:-4},{lean:-.16,sx:1.04,sy:.96,forward:-7},{lean:-.04,sx:.98,sy:1.02,forward:3},{lean:.12,sx:1.07,sy:.93,forward:15},{lean:.06,sx:1.025,sy:.98,forward:9},{lean:0,sx:1,sy:1,forward:1}],
  hit:[{lean:.1,sx:.96,sy:1.03,forward:-7},{lean:-.07,sx:1.04,sy:.96,forward:-11},{lean:0,sx:1,sy:1,forward:-2}],
  death:[{lean:0,sx:1,sy:1,forward:0,fall:0},{lean:.08,sx:1.03,sy:.97,forward:-2,fall:.08},{lean:.2,sx:1.05,sy:.92,forward:-4,fall:.23},{lean:.38,sx:1.08,sy:.82,forward:-5,fall:.45},{lean:.58,sx:1.12,sy:.7,forward:-5,fall:.68},{lean:.78,sx:1.16,sy:.56,forward:-4,fall:.87},{lean:.92,sx:1.2,sy:.44,forward:-3,fall:1}],
  execute:[{lean:-.13,sx:1.03,sy:.97,forward:-5},{lean:-.22,sx:1.05,sy:.94,forward:-8},{lean:-.05,sx:.98,sy:1.02,forward:4},{lean:.18,sx:1.09,sy:.91,forward:18},{lean:.1,sx:1.04,sy:.96,forward:12},{lean:0,sx:1,sy:1,forward:2}]
};

const clamp01=value=>Math.max(0,Math.min(1,value));
const mix=(a,b,t)=>a+(b-a)*t;

export function createAttackTimeline(kind,payload={},duration=ANIMATION_CLIPS.attack.duration,frames=ANIMATION_CLIPS.attack.frames,hitFrame=ANIMATION_CLIPS.attack.hitFrame){return {kind,payload,duration,frames,hitFrame,elapsed:0,frame:0,impact:false,finished:false};}

export function advanceAttackTimeline(timeline,dt){if(!timeline||timeline.finished)return {impact:false,finished:true,frame:timeline?.frame||0};timeline.elapsed=Math.min(timeline.duration,timeline.elapsed+Math.max(0,dt));const raw=Math.min(timeline.frames-1,Math.floor(timeline.elapsed/Math.max(.001,timeline.duration)*timeline.frames));timeline.frame=raw;const impact=!timeline.impact&&raw>=timeline.hitFrame;if(impact)timeline.impact=true;if(timeline.elapsed>=timeline.duration)timeline.finished=true;return {impact,finished:timeline.finished,frame:raw};}

export function actionProgress(body,action,elapsed=0){const clip=ANIMATION_CLIPS[action]||ANIMATION_CLIPS.idle;if(action==='walk'||action==='idle')return (elapsed%clip.duration)/clip.duration;if(action==='attack'&&body?.attackTimeline)return clamp01(body.attackTimeline.elapsed/body.attackTimeline.duration);if(action==='attack')return clamp01(1-(body?.attackAnim||0)/.48);if(action==='hit')return clamp01(1-(body?.hit||0)/clip.duration);if(action==='death')return clamp01(body?.deathProgress??(1-(body?.deathAnim||0)/clip.duration));if(action==='execute')return clamp01(1-(body?.executionAnim||0)/clip.duration);return 0;}

// Contact poses are deliberately held longer than passing poses. A six-frame
// strip therefore reads as a grounded human gait instead of six equally fast
// leg swaps. At the default duration this is roughly 114 steps per minute.
export function walkFrameAt(elapsed=0){
  const phase=((elapsed%ANIMATION_CLIPS.walk.duration)+ANIMATION_CLIPS.walk.duration)%ANIMATION_CLIPS.walk.duration/ANIMATION_CLIPS.walk.duration;
  const contacts=[.22,.36,.5,.72,.86,1];
  return contacts.findIndex(end=>phase<end);
}

export function sampleMotionPose(action,progress){const poses=POSES[action]||POSES.idle,clip=ANIMATION_CLIPS[action]||ANIMATION_CLIPS.idle;const scaled=clamp01(progress)*(clip.loop?poses.length:poses.length-1),base=Math.floor(scaled)%poses.length,next=clip.loop?(base+1)%poses.length:Math.min(poses.length-1,base+1),t=scaled-Math.floor(scaled),a=poses[base],b=poses[next];return {frame:Math.min(clip.frames-1,Math.floor(clamp01(progress)*clip.frames)),lean:mix(a.lean||0,b.lean||0,t),sx:mix(a.sx||1,b.sx||1,t),sy:mix(a.sy||1,b.sy||1,t),forward:mix(a.forward||0,b.forward||0,t),step:mix(a.step||0,b.step||0,t),fall:mix(a.fall||0,b.fall||0,t)};}

export function advanceActorAnimation(body,action,moving,grounded,dt){body.animClock=(body.animClock||0)+Math.max(0,dt);if(body.animState!==action){body.previousAnimState=body.animState||'idle';body.animState=action;body.animBlend=0;}body.animBlend=Math.min(1,(body.animBlend||0)+dt/.11);if(!moving||!grounded){body.lastFootFrame=-1;return false;}const frame=walkFrameAt(body.animClock),step=(frame===0||frame===3)&&frame!==body.lastFootFrame;body.lastFootFrame=frame;return step;}

export function clipFrameCount(action){return (ANIMATION_CLIPS[action]||ANIMATION_CLIPS.idle).frames;}
