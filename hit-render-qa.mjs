import {checkHitRendering} from './game.mjs?v=7.1';
const panel=document.createElement('dialog');
panel.style.cssText='width:780px;max-width:95vw;background:#132720;color:#eee;padding:24px';
panel.innerHTML='<h2>受击轮廓像素验收</h2><p>正在检查 8 类小兵 × 8 个方向…</p>';
document.body.append(panel);panel.showModal();
try{
  const result=await checkHitRendering();
  panel.querySelector('p').textContent=`${result.pass?'PASS':'FAIL'} · ${result.reports.length} 项 · 轮廓外发生变化的像素：${result.reports.reduce((sum,r)=>sum+r.outsideChangedPixels,0)}`;
  panel.append(result.preview);
  const details=document.createElement('details');details.innerHTML='<summary>逐项数据</summary>';
  const pre=document.createElement('pre');pre.textContent=JSON.stringify(result.reports,null,2);details.append(pre);panel.append(details);
}catch(error){panel.querySelector('p').textContent='FAIL · '+error.message;}
