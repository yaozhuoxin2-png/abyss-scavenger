const classes={sword:'剑士',bow:'猎手',staff:'法师'};
const directions={down:'正面',downRight:'右前斜向',right:'右侧',upRight:'右后斜向',up:'背面'};
const fileDirection={down:'down',downRight:'down-right',right:'right',upRight:'up-right',up:'up'};

const panel=document.createElement('dialog');
panel.className='motion-qa';
panel.style.cssText='width:1100px;max-width:96vw;background:#081313;color:#efe7d2;padding:22px;border:1px solid #8e6d32';
panel.innerHTML='<h2 style="margin-top:0">v7.1 真实双脚步态验收</h2><p>每个职业拥有五个独立朝向，左侧方向由对应右侧动画无损镜像。六帧依次完成左脚着地、交换、蹬地、右脚着地、交换、蹬地；触地姿势停留更久，完整步态约 '+ANIMATION_CLIPS.walk.duration.toFixed(2)+' 秒。</p><div class="qa-controls" style="display:flex;gap:12px;margin:12px 0"></div><div class="qa-frames" style="display:grid;grid-template-columns:repeat(6,1fr);gap:7px"></div><canvas class="qa-live" width="360" height="320" style="display:block;width:360px;max-width:90%;margin:16px auto 0;background:radial-gradient(ellipse at bottom,#244038,#0b1717 68%)"></canvas>';
document.body.append(panel);panel.showModal();

const controls=panel.querySelector('.qa-controls'),frames=panel.querySelector('.qa-frames'),live=panel.querySelector('.qa-live'),liveCtx=live.getContext('2d');
const classSelect=document.createElement('select'),directionSelect=document.createElement('select');
for(const [value,label] of Object.entries(classes))classSelect.append(new Option(label,value));
for(const [value,label] of Object.entries(directions))directionSelect.append(new Option(label,value));
classSelect.value='staff';directionSelect.value='right';controls.append('职业：',classSelect,'方向：',directionSelect);

let image=null,token=0,start=performance.now();
function drawFrame(context,frame,width,height){
  if(!image)return;const sw=image.naturalWidth/6,sh=image.naturalHeight,dw=Math.min(width*.72,height*.47),dh=dw*2,x=(width-dw)/2,y=height-dh-20;
  context.drawImage(image,frame*sw,0,sw,sh,x,y,dw,dh);context.strokeStyle='#d5b46288';context.lineWidth=1;context.beginPath();context.moveTo(10,height-20);context.lineTo(width-10,height-20);context.stroke();
}
async function reload(){
  const current=++token,next=new Image(),kind=classSelect.value,direction=fileDirection[directionSelect.value];next.src=`./hero-walk-${kind}-${direction}-v8.png`;await next.decode();if(current!==token)return;image=next;frames.replaceChildren();
  for(let frame=0;frame<6;frame++){const card=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');card.style.cssText='margin:0;background:#102424;border:1px solid #2f4b45;text-align:center;padding:4px';canvas.width=180;canvas.height=260;canvas.style.cssText='width:100%;image-rendering:auto';caption.textContent=`步态 ${frame+1}`;drawFrame(canvas.getContext('2d'),frame,180,260);card.append(canvas,caption);frames.append(card);}start=performance.now();
}
classSelect.onchange=reload;directionSelect.onchange=reload;await reload();
function animate(now){liveCtx.clearRect(0,0,live.width,live.height);drawFrame(liveCtx,walkFrameAt((now-start)/1000),live.width,live.height);requestAnimationFrame(animate);}requestAnimationFrame(animate);
import {ANIMATION_CLIPS,walkFrameAt} from './animation.mjs';
