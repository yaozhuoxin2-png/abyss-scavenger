export const TILE=40, COLS=26, ROWS=18;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const center=(x,y)=>({x:x*TILE+TILE/2,y:y*TILE+TILE/2});
export function createMap(floor=1,room='ruins'){
  const map=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>x===0||y===0||x===COLS-1||y===ROWS-1?1:0));
  const layouts={
    ruins:floor===1?[[6,5,2,3],[17,5,2,3],[6,12,2,2],[17,12,2,2]]:floor===2?[[5,4,3,2],[18,4,3,2],[5,11,3,3],[18,11,3,3],[11,8,4,2]]:[[5,5,2,3],[19,5,2,3],[5,12,2,2],[19,12,2,2],[11,5,4,1]],
    garden:[[5,4,2,2],[19,4,2,2],[5,11,2,2],[19,11,2,2],[12,6,2,1],[12,11,2,1],[8,8,1,2],[17,8,1,2]],
    forge:[[4,5,4,1],[18,5,4,1],[4,12,4,1],[18,12,4,1],[12,8,2,2],[8,8,1,2],[17,8,1,2]],
    library:[[5,4,1,4],[9,4,1,4],[17,10,1,4],[21,10,1,4],[12,5,2,1],[14,12,2,1]],
    sanctum:[[6,5,2,2],[18,5,2,2],[6,11,2,2],[18,11,2,2],[12,8,2,2]],
    observatory:[[12,4,2,2],[7,8,2,2],[19,8,2,2],[12,11,2,2],[5,5,1,1],[20,5,1,1]]
  };
  const blocks=layouts[room]||layouts.ruins;
  for(const [x,y,w,h] of blocks)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)map[j][i]=1;
  return map;
}
export function walkable(map,x,y,r=12){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r)||r<0)return false;
  const left=Math.floor((x-r)/TILE),right=Math.floor((x+r)/TILE),top=Math.floor((y-r)/TILE),bottom=Math.floor((y+r)/TILE);
  for(let cy=top;cy<=bottom;cy++)for(let cx=left;cx<=right;cx++)if(map[cy]?.[cx]!==0)return false;
  return true;
}
export function findPath(map,start,end,r=start.r||12){
  const sx=Math.floor(start.x/TILE),sy=Math.floor(start.y/TILE),tx=Math.floor(end.x/TILE),ty=Math.floor(end.y/TILE);
  if(!map[ty]||map[ty][tx]!==0||!map[sy]||map[sy][sx]!==0)return [];
  if(sx===tx&&sy===ty)return walkable(map,end.x,end.y,r)?[{...end}]:[];
  const startKey=sy*COLS+sx,targetKey=ty*COLS+tx,queue=[startKey],prev=new Map([[startKey,null]]);
  for(let n=0;n<queue.length;n++){const key=queue[n],x=key%COLS,y=Math.floor(key/COLS);if(key===targetKey)break;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=ny*COLS+nx,pos=center(nx,ny);if(walkable(map,pos.x,pos.y,r)&&!prev.has(k)){prev.set(k,key);queue.push(k);}}}
  if(!prev.has(targetKey))return [];
  const result=[];for(let key=targetKey;key!==startKey;key=prev.get(key))result.push(center(key%COLS,Math.floor(key/COLS)));result.reverse();if(walkable(map,end.x,end.y,r))result.push({...end});return result;
}
export function lineOfSight(map,a,b){const d=distance(a,b),n=Math.max(1,Math.ceil(d/10));for(let i=1;i<=n;i++)if(!walkable(map,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,2))return false;return true;}
export function moveBody(map,body,dx,dy){
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/6));
  for(let i=0;i<steps;i++){if(walkable(map,body.x+dx/steps,body.y,body.r||12))body.x+=dx/steps;if(walkable(map,body.x,body.y+dy/steps,body.r||12))body.y+=dy/steps;}
}
export const rarities=[{name:'普通',color:'#b8c8bb',mult:1},{name:'精良',color:'#73cbb1',mult:1.3},{name:'稀有',color:'#82b8fa',mult:1.7},{name:'史诗',color:'#cc98eb',mult:2.2},{name:'黄金限定',color:'#ffd66e',mult:4.5},{name:'至高',color:'#fff2b3',mult:7.5}];
export const weaponInfo={sword:{name:'长剑',symbol:'†',range:76,delay:.48,speed:1,power:1.944},bow:{name:'猎弓',symbol:'⌁',range:330,delay:.62,speed:1.04,power:.87},staff:{name:'法杖',symbol:'✧',range:280,delay:.8,speed:.97,power:1.2}};
export function enemyScale(floor=1){const depth=Math.max(0,floor-1);return {health:1+depth*.7+depth*depth*.2,attack:1+depth*.22+depth*depth*.04};}
export function makeItem(floor=1,forced=null,rng=Math.random){
  const roll=rng(),rarity=forced??(roll<.08?3:roll<.3?2:roll<.65?1:0),slot=['weapon','armor','ring'][Math.floor(rng()*3)],kind=slot==='weapon'?['sword','bow','staff'][Math.floor(rng()*3)]:null,m=rarities[rarity].mult;
  const item={id:Math.floor(rng()*1e12).toString(36),slot,kind,rarity,attack:0,armor:0,crit:0,leech:0};
  if(slot==='weapon')item.attack=Math.round((9+floor*5)*m);if(slot==='armor')item.armor=Math.round((2+floor*2)*m);if(slot==='ring'){item.crit=Math.round((4+floor*2)*m);if(rarity>=2)item.leech=3+floor;}
  item.name=['旧誓','苔影','星陨','永夜'][rarity]+(slot==='weapon'?weaponInfo[kind].name:slot==='armor'?'胸甲':'指环');return item;
}
export function makeGoldenItem(floor=1,rng=Math.random){
  const slot=['weapon','armor','ring'][Math.floor(rng()*3)],kind=slot==='weapon'?['sword','bow','staff'][Math.floor(rng()*3)]:null;
  const item={id:Math.floor(rng()*1e12).toString(36),slot,kind,rarity:4,golden:true,shopOnly:true,attack:0,armor:0,crit:0,leech:0,shopPrice:360};
  if(slot==='weapon'){item.attack=45+floor*18;item.crit=8+floor*2;item.leech=4+floor;item.name='黄金·'+({sword:'裁决长剑',bow:'逐日猎弓',staff:'星铸法杖'}[kind]);}
  if(slot==='armor'){item.attack=20+floor*8;item.armor=16+floor*6;item.crit=5+floor;item.name='黄金·不灭胸甲';}
  if(slot==='ring'){item.attack=28+floor*10;item.crit=14+floor*3;item.leech=7+floor*2;item.name='黄金·王权指环';}
  return item;
}
export function makeSupremeWeapon(floor=1,rng=Math.random){
  const kind=['sword','bow','staff'][Math.floor(rng()*3)],names={sword:'至高·终焉裁决',bow:'至高·破晓神弓',staff:'至高·万象权杖'};
  return {id:Math.floor(rng()*1e12).toString(36),name:names[kind],slot:'weapon',kind,rarity:5,supreme:true,shopOnly:true,attack:90+floor*25,armor:0,crit:14+floor*2,leech:8+floor,shopPrice:1280};
}
export function makeSupremeItem(floor=1,slot=null,rng=Math.random){
  const selected=slot||['weapon','armor','ring'][Math.floor(rng()*3)];
  if(selected==='weapon')return makeSupremeWeapon(floor,rng);
  if(selected==='armor'){
    const names=['至高·永恒壁垒','至高·星渊圣铠','至高·终末甲胄'];
    return {id:Math.floor(rng()*1e12).toString(36),name:names[Math.floor(rng()*names.length)],slot:'armor',kind:null,rarity:5,supreme:true,shopOnly:true,attack:45+floor*9,armor:90+floor*18,crit:8+floor,leech:0,shopPrice:1280};
  }
  const names=['至高·万王之环','至高·深渊指印','至高·创世轮回'];
  return {id:Math.floor(rng()*1e12).toString(36),name:names[Math.floor(rng()*names.length)],slot:'ring',kind:null,rarity:5,supreme:true,shopOnly:true,attack:68+floor*16,armor:18+floor*5,crit:20+floor*3,leech:12+floor*2,shopPrice:1280};
}
export function playerStats(player){
  let attack=9+player.level*3+(player.bonusAttack||0),armor=0,crit=8,leech=0;
  for(const item of Object.values(player.equipment)){if(!item)continue;attack+=item.attack;armor+=item.armor;crit+=item.crit;leech+=item.leech;}
  armor+=player.bonusArmor||0;crit+=player.bonusCrit||0;leech+=player.bonusLeech||0;
  const global=player.globalStatMultiplier||1;
  return {attack:Math.round(attack*global),armor:Math.round(armor*global),crit:Math.min(crit*global,60),leech:leech*.5*global,weapon:weaponInfo[player.equipment.weapon?.kind||'sword'],mana:player.mana,maxMana:player.maxMana,manaRegen:player.manaRegen};
}
export function makePlayer(kind='sword'){
  const starter={id:'starter',name:'旅人'+weaponInfo[kind].name,slot:'weapon',kind,rarity:0,attack:9,armor:0,crit:0,leech:0};
  return {...center(12,14),r:12,hp:1200,maxHp:1200,mana:80,maxMana:80,manaRegen:1.6,level:1,xp:0,xpGoal:55,gold:0,potions:3,elixirs:{haste:0,fury:0,ward:0},buffs:{haste:0,fury:0,ward:0},talents:[],nextAttackBonus:0,attackBuffer:0,comboTarget:null,comboBonus:0,comboCrit:0,comboLeech:0,comboTimer:0,secondWindUsed:false,kills:0,bonusAttack:0,bonusArmor:0,bonusCrit:0,bonusLeech:0,bonusSpeed:0,weapons:[starter,null],weaponIndex:0,equipment:{weapon:starter,armor:null,ring:null,relic:null},inventory:[],cd:{attack:0,dash:0,spin:0,frost:0,potion:0},invuln:0,facing:-Math.PI/2};
}
