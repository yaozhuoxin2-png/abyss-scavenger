// GPU-only combat VFX layer. Geometry, masks, trails and the restrained
// post-process are batched into two draw calls regardless of effect count.
export const MAX_GPU_INSTANCES=420;

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const hexCache=new Map();
function hexColor(value='#ffffff'){
  if(hexCache.has(value))return hexCache.get(value);
  let hex=String(value).replace('#','');
  if(hex.length===3)hex=hex.split('').map(part=>part+part).join('');
  const result=[parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255];
  if(result.some(Number.isNaN))result.splice(0,3,.8,.8,.8);
  hexCache.set(value,result);return result;
}
function compile(gl,type,source){
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const reason=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(reason||'shader compile failed');}
  return shader;
}
function program(gl,vertex,fragment){
  const result=gl.createProgram(),vs=compile(gl,gl.VERTEX_SHADER,vertex),fs=compile(gl,gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(result,vs);gl.attachShader(result,fs);gl.linkProgram(result);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(result,gl.LINK_STATUS)){const reason=gl.getProgramInfoLog(result);gl.deleteProgram(result);throw new Error(reason||'shader link failed');}
  return result;
}
const vertexSource=`#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_rect;
layout(location=2) in vec4 a_color;
layout(location=3) in vec4 a_params;
uniform vec2 u_resolution;
uniform vec3 u_camera;
out vec2 v_uv;
out vec4 v_color;
flat out int v_shape;
out float v_edge;
out float v_phase;
void main(){
  vec2 local=a_corner*a_rect.zw*.5;
  float cs=cos(a_params.x),sn=sin(a_params.x);
  vec2 world=a_rect.xy+mat2(cs,-sn,sn,cs)*local;
  world=(world-vec2(520.0,360.0))*u_camera.x+vec2(520.0,360.0)+u_camera.yz;
  vec2 clip=world/u_resolution*2.0-1.0;
  gl_Position=vec4(clip.x,-clip.y,0.0,1.0);
  v_uv=a_corner;v_color=a_color;v_shape=int(a_params.y+.5);v_edge=a_params.z;v_phase=a_params.w;
}`;
const fragmentSource=`#version 300 es
precision highp float;
uniform sampler2D u_slashAtlas;
uniform sampler2D u_flowMap;
uniform sampler2D u_normalMap;
uniform sampler2D u_distortionMap;
uniform sampler2D u_sparkAtlas;
uniform sampler2D u_eclipseAtlas;
uniform sampler2D u_collapseAtlas;
uniform sampler2D u_staffFlowMap;
uniform sampler2D u_staffNormalMap;
uniform sampler2D u_staffDistortionMap;
uniform sampler2D u_staffTrailMap;
uniform sampler2D u_staffBurstMap;
uniform sampler2D u_staffCollapseV9Map;
uniform sampler2D u_staffCollapseV10Map;
uniform sampler2D u_staffGroundV9Map;
uniform sampler2D u_staffBurstV9Map;
uniform float u_time;
uniform int u_assetsReady;
in vec2 v_uv;
in vec4 v_color;
flat in int v_shape;
in float v_edge;
in float v_phase;
out vec4 outColor;
float aa(float d){return 1.0-smoothstep(0.0,fwidth(d)*1.7,d);}
float band(float d,float width){return 1.0-smoothstep(width,width+fwidth(d)*1.5,abs(d));}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0)),f.x),f.y);
}
float fbm(vec2 p){float value=0.0,weight=.52;for(int i=0;i<4;i++){value+=noise2(p)*weight;p=mat2(1.62,-1.18,1.18,1.62)*p+3.7;weight*=.5;}return value;}
void main(){
  vec2 p=v_uv;float alpha=0.0;float material=1.0,textureMix=0.0;vec3 textureColor=vec3(0.0);
  if(v_shape==0){
    float d=length(p)-.78;alpha=band(d,max(.018,v_edge));
    float ticks=step(.70,fract((atan(p.y,p.x)/6.28318+.5)*12.0+v_phase));
    alpha=max(alpha,ticks*(1.0-smoothstep(.64,.68,length(p)))*smoothstep(.52,.57,length(p))*.72);
  }else if(v_shape==1){
    float body=max(abs(p.y)-.42,abs(p.x)-.98);float core=1.0-smoothstep(.02,.17,abs(p.y));
    float cut=.72+.28*sin((p.x*9.0-v_phase*7.0)+sin(p.y*5.0));
    alpha=aa(body)*(.22+core*.68)*cut;material=.82+core*.18;
  }else if(v_shape==2){
    float diamond=abs(p.x)+abs(p.y*.72)-.82;
    float vein=band(p.y+sin(p.x*5.0+v_phase)*.10,.035)*(1.0-smoothstep(.1,.82,abs(p.x)));
    alpha=max(aa(diamond)*.82,vein*.72);material=.72+vein*.28;
  }else if(v_shape==3){
    float r=length(p),a=atan(p.y,p.x);float outer=band(r-.76,.025),inner=band(r-.48,.018);
    float petals=band(abs(cos(a*3.0+v_phase))*.34+r-.62,.025)*(1.0-smoothstep(.58,.88,r));
    float runes=step(.58,fract(a/6.28318*16.0+v_phase))*(1.0-smoothstep(.70,.74,r))*smoothstep(.62,.65,r);
    alpha=max(max(outer,inner*.62),max(petals*.48,runes*.58));
  }else if(v_shape==4){
    float taper=abs(p.x)-(.13+.34*(p.y*.5+.5));float vertical=1.0-smoothstep(.72,1.0,abs(p.y));
    float helix=band(p.x-sin(p.y*8.0+v_phase*5.0)*.19,.025);
    alpha=aa(taper)*vertical*(.12+helix*.48);material=.75+helix*.25;
  }else if(v_shape==5){
    float r=length(p);float rim=band(r-.78,max(.02,v_edge));float seal=1.0-smoothstep(.0,.82,r);
    float cells=.55+.45*hash(floor((p+1.0)*9.0)+floor(v_phase*3.0));
    alpha=max(rim*.82,seal*.105*cells);material=.78;
  }else if(v_shape==6){
    float x=p.x*.5+.5,halfWidth=max(.025,x*.88);float side=abs(p.y)-halfWidth;
    float tip=max(-x,x-1.0);float edge=band(side,.028)+band(x-.98,.025);
    alpha=aa(max(side,tip))*.075+edge*.72;
  }else if(v_shape==7){
    float r=length(p);float falloff=pow(max(0.0,1.0-r),2.2);
    float rays=.72+.28*cos(atan(p.y,p.x)*6.0+v_phase);alpha=falloff*rays*.22;material=.86;
  }else if(v_shape==8){
    float wave=abs(p.y-sin((p.x+v_phase)*8.0)*.13*(1.0-abs(p.x)));
    float ends=1.0-smoothstep(.55,1.0,abs(p.x));alpha=(1.0-smoothstep(.025,.16,wave))*ends;
    material=.75+.25*(1.0-smoothstep(.0,.04,wave));
  }else if(v_shape==9){
    vec2 q=p;float n=fbm(q*5.2+vec2(v_phase*.7,-v_phase*.43))-.5;
    float horizontal=abs(q.y+n*.11*sin(q.x*8.0+v_phase*2.0));
    float vertical=abs(q.x+n*.11*cos(q.y*7.0-v_phase*1.7));
    float axis=min(horizontal,vertical),armMask=1.0-smoothstep(.72,1.02,max(abs(q.x),abs(q.y)));
    float branchA=band(q.y-sign(q.x)*q.x*.43+n*.16,.04)*(1.0-smoothstep(.18,.92,abs(q.x)));
    float branchB=band(q.x+sign(q.y)*q.y*.38-n*.13,.037)*(1.0-smoothstep(.2,.88,abs(q.y)));
    float chips=step(.69,noise2(q*19.0+floor(v_phase)))*(1.0-smoothstep(.08,.31,axis))*armMask;
    if(v_edge<.5){float trench=(1.0-smoothstep(.025,.2,axis))*armMask;float brokenEdge=band(axis-.13,.045)*armMask;alpha=max(trench*.94,max(brokenEdge*.68,max(branchA,branchB)*.62));material=.28+.34*noise2(q*13.0)+chips*.2;}
    else{float hot=band(axis,.035)*armMask,edgeFire=band(axis-.09,.032)*armMask;alpha=max(max(hot,edgeFire*.82),max(branchA,branchB)*.96);material=.88+.28*(hot+chips);}
  }else if(v_shape==10){
    vec2 q=vec2(p.x,p.y*1.18);float r=length(q),a=atan(q.y,q.x),edgeNoise=(fbm(q*7.0+v_phase)-.5)*.055;
    float sector=1.0-smoothstep(1.03,1.2,abs(a));float blade=band(r-.72+edgeNoise,.055)*sector;
    float inner=band(r-.54+edgeNoise*.6,.022)*sector*.72;float wake=(1.0-smoothstep(.17,.5,abs(r-.58)))*sector*(.16+.2*noise2(q*11.0+v_phase));
    alpha=max(blade,max(inner,wake));material=.65+.35*blade;
  }else if(v_shape==11){
    vec2 q=p;float r=length(q),a=atan(q.y,q.x);float diamond=abs(q.x)+abs(q.y)-.42;
    float core=aa(diamond)*(.55+.45*(1.0-smoothstep(0.0,.45,r)));float orbit1=band(length(vec2(q.x,q.y*1.75))-.68,.025);
    vec2 qr=mat2(.5,-.866,.866,.5)*q;float orbit2=band(length(vec2(qr.x,qr.y*1.72))-.75,.021);
    float rays=pow(max(0.0,cos(a*4.0+v_phase*2.0)),18.0)*(1.0-smoothstep(.18,.88,r));
    alpha=max(core,max(orbit1*.72,orbit2*.55))+rays*.5;material=.68+.32*(core+rays);
  }else if(v_shape==12){
    vec2 q=vec2(p.x,p.y*1.45);float r=length(q),a=atan(q.y,q.x);float swirl=band(sin(a*3.0-r*13.0+v_phase*5.0),.14)*(1.0-smoothstep(.12,.92,r));
    float rings=max(band(r-.72,.022),band(r-.48,.018)*.72);float runes=step(.67,fract(a/6.28318*18.0+v_phase*.2))*smoothstep(.58,.62,r)*(1.0-smoothstep(.78,.82,r));
    float core=pow(max(0.0,1.0-r/.34),2.0);alpha=max(max(swirl*.62,rings),max(runes*.72,core*.82));material=.55+.45*(rings+runes+core);
  }else if(v_shape==13){
    float x=p.x*.5+.5,taper=(1.0-x)*.18+x*.78,fade=smoothstep(0.0,.09,x)*(1.0-smoothstep(.88,1.0,x));
    float strands=0.0;for(int i=0;i<5;i++){float fi=float(i)-2.0;float curve=fi*.16+sin(x*11.0-v_phase*4.0+fi)*(.035+.04*x);strands=max(strands,band(p.y-curve,.025+.008*x));}
    float pressure=(1.0-smoothstep(taper,taper+.1,abs(p.y)))*(.08+.09*noise2(vec2(x*13.0,p.y*7.0)+v_phase));alpha=(strands*.88+pressure)*fade;material=.62+.38*strands;
  }else if(v_shape==14){
    vec2 q=vec2(p.x,p.y*1.5);float r=length(q),a=atan(q.y,q.x);float ringA=band(r-.78,.026),ringB=band(r-.57,.016);
    float moon=max(0.0,(1.0-smoothstep(.38,.72,length(q)))-(1.0-smoothstep(.28,.59,length(q-vec2(.2,0.0)))));
    float anchors=pow(max(0.0,cos(a*3.0-1.5708)),22.0)*smoothstep(.55,.62,r)*(1.0-smoothstep(.86,.9,r));
    float runes=step(.7,fract(a/6.28318*15.0+v_phase*.15))*smoothstep(.67,.7,r)*(1.0-smoothstep(.82,.85,r));
    alpha=max(max(ringA,ringB*.6),max(moon*.36,max(anchors,runes*.64)));material=.62+.38*(anchors+runes+ringA);
  }else if(v_shape==15){
    vec2 q=p;float facets=max(abs(q.x)*.86+abs(q.y)*.4,abs(q.y)*.92);float silhouette=aa(facets-.72);float split=step(q.x*.55+q.y,-.05);
    float chips=1.0-smoothstep(.45,.76,facets+noise2(q*5.0)*.18);alpha=silhouette;material=(.48+.38*split+.14*chips);
  }else if(v_shape==16){
    vec2 q=vec2(p.x,p.y*1.1);float r=length(q),a=atan(q.y,q.x),sector=1.0-smoothstep(1.0,1.12,abs(a));
    float body=smoothstep(.52,.57,r)*(1.0-smoothstep(.84,.9,r))*sector;
    float outer=band(r-.82,.035)*sector,inner=band(r-.59,.018)*sector;
    float bevel=band(r-.72,.026)*sector,engrave=band(sin(a*7.0+v_phase*.7),.17)*body*(.35+.65*smoothstep(.61,.72,r));
    float runes=step(.72,fract((a+1.05)/2.1*13.0+v_phase*.08))*body*smoothstep(.63,.68,r)*(1.0-smoothstep(.76,.8,r));
    float crown=pow(max(0.0,cos(a*3.0)),18.0)*body;alpha=max(body*.24,max(outer,max(inner*.7,max(bevel*.74,max(engrave*.42,runes*.8)))));material=.62+.28*outer+.18*bevel+.25*runes+.16*crown;
  }else if(v_shape==17){
    vec2 q=p;float x=q.x,y=q.y;float shaft=(1.0-smoothstep(.045,.085,abs(y)))*smoothstep(-.92,-.78,x)*(1.0-smoothstep(.48,.58,x));
    float headWidth=max(0.0,(.94-x)*.7),head=(1.0-smoothstep(headWidth,headWidth+.035,abs(y)))*smoothstep(.14,.25,x)*(1.0-smoothstep(.94,.99,x));
    float headEdge=band(abs(y)-headWidth,.025)*smoothstep(.18,.28,x)*(1.0-smoothstep(.9,.97,x));
    float upperFin=band(y-(x+.7)*.48,.045)*smoothstep(-.93,-.72,x)*(1.0-smoothstep(-.38,-.25,x));
    float lowerFin=band(y+(x+.7)*.48,.045)*smoothstep(-.93,-.72,x)*(1.0-smoothstep(-.38,-.25,x));
    float socket=band(length(vec2((x-.18)*1.5,y))-.17,.025);float vein=band(y-sin((x+.4)*13.0+v_phase)*.018,.02)*head;
    alpha=max(max(shaft,head*.82),max(headEdge,max(max(upperFin,lowerFin),max(socket*.75,vein*.65))));material=.58+.34*headEdge+.3*shaft+.2*vein;
  }else if(v_shape==18){
    vec2 q=vec2(p.x,p.y*1.12);float r=length(q),a=atan(q.y,q.x),limit=1.08,u=clamp((a+limit)/(limit*2.0),0.0,1.0);
    float sector=smoothstep(0.0,.055,u)*(1.0-smoothstep(.945,1.0,u));float taper=pow(max(0.0,sin(u*3.1415926)),.72);
    float wobble=(noise2(vec2(u*9.0,v_phase*.18))-.5)*.026,spine=.71+wobble;
    float width=.01+.058*taper,blade=(1.0-smoothstep(width,width+.016,abs(r-spine)))*sector;
    float core=band(r-spine,.009+.006*taper)*sector,bevel=band(abs(r-spine)-width*.78,.01)*sector;
    float filamentA=band(r-(spine-.095-.018*sin(u*19.0+v_phase)),.008)*sector*taper;
    float filamentB=band(r-(spine+.092+.014*sin(u*23.0-v_phase*.7)),.007)*sector*taper;
    float runes=step(.72,fract(u*19.0+v_phase*.045))*band(r-(spine+.12),.008)*sector*taper;
    float glint=exp(-pow((u-fract(v_phase*.055))*12.0,2.0))*band(r-spine,.028)*sector;
    alpha=max(blade*.46,max(core,max(bevel*.74,max(max(filamentA,filamentB)*.46,max(runes*.68,glint)))));material=.5+.5*core+.28*bevel+.42*glint+.2*runes;
  }else if(v_shape==19){
    vec2 q=p;float r=length(q),a=atan(q.y,q.x);float diamond=abs(q.x)*.82+abs(q.y)-.22;
    float core=aa(diamond)*(1.0-smoothstep(.0,.48,r));float longRay=band(q.y,.018)*(1.0-smoothstep(.12,.98,abs(q.x)));
    float crossRay=band(q.x,.024)*(1.0-smoothstep(.08,.72,abs(q.y)));
    float diagonal=max(band(sin(a-0.7854)*r,.018),band(sin(a+0.7854)*r,.018))*(1.0-smoothstep(.1,.8,r));
    float prism=band(r-.38,.018)*step(.73,fract(a/6.28318*8.0+v_phase*.04));alpha=max(core,max(longRay,max(crossRay*.66,max(diagonal*.5,prism*.74))));material=.68+.42*core+.24*prism;
  }else if(v_shape==20&&u_assetsReady==1){
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*8.0);vec2 cell=vec2(mod(frame,4.0),1.0-floor(frame/4.0));
    vec2 utilityUv=vec2(fract(uv.x*1.18-u_time*.18),fract(uv.y*1.08+u_time*.035));vec2 distortion=texture(u_distortionMap,utilityUv).rg-.5;
    float tier=clamp(v_edge,0.0,3.0),distortStrength=mix(.008,.032,tier/3.0);vec2 atlasUv=(cell+clamp(uv+distortion*distortStrength,.005,.995))/vec2(4.0,2.0);
    vec4 painted=texture(u_slashAtlas,atlasUv);vec3 normal=texture(u_normalMap,utilityUv).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.65,max(.2,normal.z)));
    float lighting=.72+.38*max(0.0,dot(normal,normalize(vec3(-.38,-.56,.9))));float flow=texture(u_flowMap,utilityUv).r;
    alpha=painted.a*(.82+flow*.18);textureColor=painted.rgb*lighting*(.88+flow*.22+tier*.035);textureMix=1.0;
  }else if(v_shape==21&&u_assetsReady==1){
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*8.0);vec2 cell=vec2(mod(frame,4.0),1.0-floor(frame/4.0));vec2 atlasUv=(cell+clamp(uv,.005,.995))/vec2(4.0,2.0);
    vec4 painted=texture(u_sparkAtlas,atlasUv);alpha=painted.a;textureColor=painted.rgb*(1.0+v_edge*.08);textureMix=1.0;
  }else if(v_shape==22&&u_assetsReady==1){
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*8.0);vec2 cell=vec2(mod(frame,4.0),1.0-floor(frame/4.0));
    vec2 utilityUv=vec2(fract(uv.x*1.31-u_time*.23),fract(uv.y*1.09+u_time*.052));vec2 distortion=texture(u_staffDistortionMap,utilityUv).rg-.5;
    float tier=clamp(v_edge,0.0,3.0),distortStrength=mix(.004,.016,tier/3.0);vec2 atlasUv=(cell+clamp(uv+distortion*distortStrength,.005,.995))/vec2(4.0,2.0);
    vec4 painted=texture(u_eclipseAtlas,atlasUv);vec3 normal=texture(u_staffNormalMap,utilityUv).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.72,max(.22,normal.z)));
    float lighting=.69+.43*max(0.0,dot(normal,normalize(vec3(-.31,-.58,.92))));float flow=texture(u_staffFlowMap,utilityUv).r,luma=max(painted.r,max(painted.g,painted.b));
    float body=painted.a*smoothstep(.16,.54,luma),spec=pow(max(0.0,dot(normal,normalize(vec3(-.31,-.58,.92)))),9.0);
    vec3 graded=mix(painted.rgb*vec3(.52,.88,1.18),vec3(.06,.5,1.12),smoothstep(.22,.74,luma));
    alpha=body*(1.1+flow*.16);textureColor=graded*lighting*(1.34+flow*.22+tier*.055)+vec3(.66,.94,1.18)*(pow(luma,4.0)*.42+spec*.38);textureMix=1.0;
  }else if(v_shape==23&&u_assetsReady==1){
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*8.0);vec2 cell=vec2(mod(frame,4.0),1.0-floor(frame/4.0));
    vec2 utilityUv=vec2(fract(uv.x*.94+u_time*.06),fract(uv.y*1.22-u_time*.14));vec2 distortion=texture(u_staffDistortionMap,utilityUv).rg-.5;
    float tier=clamp(v_edge,0.0,3.0),distortStrength=mix(.002,.009,tier/3.0);vec2 atlasUv=(cell+clamp(uv+distortion*distortStrength,.005,.995))/vec2(4.0,2.0);
    vec4 painted=texture(u_collapseAtlas,atlasUv);vec3 normal=texture(u_staffNormalMap,utilityUv).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.58,max(.25,normal.z)));
    vec3 iceLight=normalize(vec3(.34,-.48,.9));float ndl=max(0.0,dot(normal,iceLight)),lighting=.5+.66*ndl;float flow=texture(u_staffFlowMap,utilityUv).r;
    float luma=max(painted.r,max(painted.g,painted.b)),body=painted.a*smoothstep(.24,.6,luma),spec=pow(ndl,11.0);
    vec3 graded=mix(painted.rgb*vec3(.38,.82,1.16),vec3(.035,.42,1.08),smoothstep(.18,.7,luma));
    alpha=body*(1.16+flow*.12);textureColor=graded*lighting*(1.42+flow*.18+tier*.065)+vec3(.72,1.02,1.24)*(pow(luma,4.0)*.5+spec*.55);textureMix=1.0;
  }else if(v_shape==24&&u_assetsReady==1){
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*8.0);vec2 cell=vec2(mod(frame,4.0),1.0-floor(frame/4.0));
    vec2 utilityUv=vec2(fract(uv.x*1.31-u_time*.29),fract(uv.y*1.09+u_time*.061));vec2 distortion=texture(u_staffDistortionMap,utilityUv).rg-.5;
    float tier=clamp(v_edge,0.0,3.0);vec2 atlasUv=(cell+clamp(uv+distortion*(.01+tier*.005),.008,.992))/vec2(4.0,2.0);vec2 texel=vec2(1.0/1776.0,1.0/888.0);
    vec4 painted=texture(u_eclipseAtlas,atlasUv);float nearA=min(min(texture(u_eclipseAtlas,atlasUv+vec2(texel.x*2.2,0)).a,texture(u_eclipseAtlas,atlasUv-vec2(texel.x*2.2,0)).a),min(texture(u_eclipseAtlas,atlasUv+vec2(0,texel.y*2.2)).a,texture(u_eclipseAtlas,atlasUv-vec2(0,texel.y*2.2)).a));
    float luma=max(painted.r,max(painted.g,painted.b)),edge=max(0.0,painted.a-nearA),filament=painted.a*smoothstep(.66,.98,luma),flow=texture(u_staffFlowMap,utilityUv).r;
    alpha=max(edge*2.18,filament*.92)*(.9+flow*.18);textureColor=mix(vec3(.025,.42,1.08),vec3(.9,1.04,1.18),smoothstep(.42,.88,luma))*(1.3+tier*.11);textureMix=1.0;
  }else if(v_shape==25&&u_assetsReady==1){
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*8.0);vec2 cell=vec2(mod(frame,4.0),1.0-floor(frame/4.0));vec2 utilityUv=vec2(fract(uv.x*1.52-u_time*.17),fract(uv.y*.88+u_time*.04));
    vec2 atlasUv=(cell+clamp(uv+(texture(u_staffDistortionMap,utilityUv).rg-.5)*.035,.008,.992))/vec2(4.0,2.0);vec4 painted=texture(u_eclipseAtlas,atlasUv);float luma=max(painted.r,max(painted.g,painted.b)),flow=texture(u_staffFlowMap,utilityUv).r;
    float veil=painted.a*(1.0-smoothstep(.42,.72,luma))*smoothstep(.32,.78,flow);alpha=veil*.2;textureColor=mix(vec3(.025,.09,.34),vec3(.08,.48,.92),flow)*(1.0+v_edge*.04);textureMix=1.0;
  }else if(v_shape==26&&u_assetsReady==1){
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*8.0);vec2 cell=vec2(mod(frame,4.0),1.0-floor(frame/4.0));vec2 utilityUv=vec2(fract(uv.x*.94+u_time*.05),fract(uv.y*1.22-u_time*.18));
    vec2 atlasUv=(cell+clamp(uv+(texture(u_staffDistortionMap,utilityUv).rg-.5)*(.004+v_edge*.002),.008,.992))/vec2(4.0,2.0);vec2 texel=vec2(1.0/1776.0,1.0/888.0);vec4 painted=texture(u_collapseAtlas,atlasUv);
    float nearA=min(min(texture(u_collapseAtlas,atlasUv+vec2(texel.x*1.35,0)).a,texture(u_collapseAtlas,atlasUv-vec2(texel.x*1.35,0)).a),min(texture(u_collapseAtlas,atlasUv+vec2(0,texel.y*1.35)).a,texture(u_collapseAtlas,atlasUv-vec2(0,texel.y*1.35)).a));
    float luma=max(painted.r,max(painted.g,painted.b)),edge=max(0.0,painted.a-nearA),crystal=painted.a*smoothstep(.56,.9,luma),flow=texture(u_staffFlowMap,utilityUv).r;
    alpha=max(edge*2.72,crystal*1.08)*(.94+flow*.14);textureColor=mix(vec3(.015,.34,1.12),vec3(.92,1.06,1.22),smoothstep(.38,.84,luma))*(1.42+v_edge*.1);textureMix=1.0;
  }else if(v_shape==27&&u_assetsReady==1){
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*8.0);vec2 cell=vec2(mod(frame,4.0),1.0-floor(frame/4.0));vec2 utilityUv=vec2(fract(uv.x*1.17+u_time*.035),fract(uv.y*1.36-u_time*.11));
    vec2 atlasUv=(cell+clamp(uv+(texture(u_staffDistortionMap,utilityUv).rg-.5)*.028,.008,.992))/vec2(4.0,2.0);vec4 painted=texture(u_collapseAtlas,atlasUv);float luma=max(painted.r,max(painted.g,painted.b)),flow=texture(u_staffFlowMap,utilityUv).r;
    alpha=painted.a*(1.0-smoothstep(.4,.7,luma))*(.055+flow*.1);textureColor=mix(vec3(.015,.055,.24),vec3(.045,.32,.76),flow)*(1.0+v_edge*.035);textureMix=1.0;
  }else if(v_shape==28&&u_assetsReady==1){
    vec2 uv=p*.5+.5,flowUv=vec2(fract(uv.x*2.8-u_time*.025),fract(uv.y*1.18+u_time*.012));vec2 distortion=texture(u_staffDistortionMap,flowUv).rg-.5;float flow=texture(u_staffFlowMap,flowUv+distortion*.035).r;
    vec2 paintedUv=clamp(uv+distortion*(.005+v_edge*.002),.003,.997);vec4 painted=texture(u_staffTrailMap,paintedUv);vec2 texel=1.0/vec2(textureSize(u_staffTrailMap,0));float nearA=min(min(texture(u_staffTrailMap,paintedUv+vec2(texel.x*2.0,0)).a,texture(u_staffTrailMap,paintedUv-vec2(texel.x*2.0,0)).a),min(texture(u_staffTrailMap,paintedUv+vec2(0,texel.y*2.0)).a,texture(u_staffTrailMap,paintedUv-vec2(0,texel.y*2.0)).a));
    vec3 normal=texture(u_staffNormalMap,flowUv+distortion*.02).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.72,max(.2,normal.z)));float ndl=max(0.0,dot(normal,normalize(vec3(-.35,-.58,.9)))),luma=max(painted.r,max(painted.g,painted.b)),edge=max(0.0,painted.a-nearA),facets=smoothstep(.42,.88,luma)*smoothstep(.5,.95,ndl);
    float age=clamp(v_phase,0.0,1.0),erode=smoothstep(.72,1.0,age)*noise2(uv*19.0+vec2(age*2.4,0.0));alpha=max(painted.a*(.88+.14*flow),edge*2.25)*(1.0-erode*.72);textureColor=painted.rgb*(.72+.5*ndl)*(1.08+.15*flow)+vec3(.62,.96,1.16)*(facets*.42+edge*.32);textureMix=1.0;
  }else if(v_shape==29&&u_assetsReady==1){
    vec2 uv=p*.5+.5,utilityUv=vec2(fract(uv.x*1.24-u_time*.065),fract(uv.y*1.17+u_time*.038));vec2 distortion=texture(u_staffDistortionMap,utilityUv).rg-.5,paintedUv=clamp(uv+distortion*(.004+v_edge*.0015),.003,.997);vec4 painted=texture(u_staffBurstMap,paintedUv);
    vec3 normal=texture(u_staffNormalMap,utilityUv).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.68,max(.2,normal.z)));float ndl=max(0.0,dot(normal,normalize(vec3(-.34,-.6,.92)))),luma=max(painted.r,max(painted.g,painted.b)),progress=clamp(v_phase,0.0,1.0),radius=length(p),reach=clamp(progress*4.2,0.0,1.35);
    float reveal=1.0-smoothstep(reach-.16,reach+.09,radius),fade=1.0-smoothstep(.68,1.0,progress),erode=smoothstep(.62,1.0,progress)*noise2(uv*22.0+vec2(progress*3.1,-progress));float spec=pow(ndl,10.0),body=painted.a*smoothstep(.12,.42,luma);
    alpha=body*reveal*fade*(1.0-erode*.64);textureColor=painted.rgb*(.78+.48*ndl)*(1.12+v_edge*.045)+vec3(.68,1.0,1.18)*(pow(luma,4.0)*.3+spec*.34);textureMix=1.0;
  }else if(v_shape==30){
    // A grounded seal: dark contact well, bevelled rings and broken rune segments.
    vec2 q=vec2(p.x,p.y*1.58);float r=length(q),a=atan(q.y,q.x),pulse=.5+.5*sin(u_time*1.7+v_phase*3.0);
    float outer=band(r-.88,.024),bevel=band(r-.73,.016),inner=band(r-.52,.012);
    float runes=step(.72,fract(a/6.28318*18.0+u_time*.055+v_phase*.7))*smoothstep(.57,.65,r)*(1.0-smoothstep(.78,.87,r));
    float spokes=pow(max(0.0,cos(a*6.0-u_time*.16)),28.0)*smoothstep(.56,.82,r);
    float well=(1.0-smoothstep(.08,.48,r))*(.13+.08*pulse),depth=smoothstep(.2,.74,r);
    alpha=max(max(outer,bevel*.74),max(inner*.62,max(runes*.7,spokes*.3)))+well;
    material=.18+.34*depth+.22*(outer+bevel)+.13*spokes;
  }else if(v_shape==31){
    // Fracture field: radial cracks branch from the seal instead of drawing a flat decal.
    vec2 q=p;float r=length(q),a=atan(q.y,q.x),cracks=0.0;
    for(int i=0;i<6;i++){float branch=float(i)*1.0472+.12*sin(u_time*.4+float(i));float delta=abs(sin(a-branch));float reach=smoothstep(.12,.92,r);cracks=max(cracks,(1.0-smoothstep(.018,.082,delta))*reach);}
    float ring=band(r-.48,.018)*(1.0-smoothstep(.7,.98,r)),chips=step(.72,noise2(q*17.0+u_time*.12))*(1.0-smoothstep(.4,.9,r));
    alpha=cracks*(.28+.32*smoothstep(.16,.7,r))+ring*.62+chips*.28;material=.26+.42*cracks+.18*ring;
  }else if(v_shape==32){
    // Faceted vertical prism: the slanted faces carry their own highlight and shadow.
    float y=p.y*.5+.5,lean=sin(v_phase*2.4+u_time*.7)*.055*(1.0-y),width=.13+.24*y;
    float side=abs(p.x+lean)-width,body=1.0-smoothstep(0.0,.045,side),tip=smoothstep(-1.0,-.76,p.y),base=1.0-smoothstep(.76,1.0,p.y);
    float facet=smoothstep(-.45,.12,p.x+lean),edge=band(side,.018),vein=band(p.x+sin(p.y*7.0+u_time)*.035,.022)*(1.0-smoothstep(.58,.96,y));
    float bevelLight=body*(.42+.38*facet)*base+edge*.72+vein*.58;
    alpha=body*(.32+.38*base)+edge*.76+vein*.24;material=.22+bevelLight*.54+tip*.16;
  }else if(v_shape==33){
    // Suspended core: a lit sphere with a dark underside, facets and an orbiting cut.
    vec2 q=vec2(p.x,p.y*1.08);float r=length(q),inside=1.0-smoothstep(.76,.86,r),z=sqrt(max(0.0,1.0-r*r));
    vec3 normal=normalize(vec3(q.x,q.y,z));float ndl=max(0.0,dot(normal,normalize(vec3(-.42,-.58,.92)))),rim=band(r-.78,.024);
    float longitude=band(sin(atan(q.y,q.x)*3.0-u_time*1.4+v_phase*2.0),.12)*(1.0-smoothstep(.18,.78,r));
    float orbit=band(r-(.58+.045*sin(atan(q.y,q.x)*4.0+u_time*.8)),.016);
    alpha=inside*(.46+.46*ndl)+rim*.8+longitude*.48+orbit*.62;material=.28+.48*ndl+.2*longitude+.14*orbit;
  }else if(v_shape==34){
    // Thin orbit bands sit around the core and make the height separation readable.
    vec2 q=vec2(p.x,p.y*1.28);float r=length(q),a=atan(q.y,q.x),bandA=band(r-(.72+.045*sin(a*3.0+u_time*.8)),.018),bandB=band(r-(.48+.035*cos(a*2.0-u_time*.6)),.012);
    float ticks=step(.68,fract(a/6.28318*12.0+u_time*.09+v_phase))*smoothstep(.4,.58,r)*(1.0-smoothstep(.78,.86,r));
    alpha=max(bandA,bandB*.72)+ticks*.52;material=.3+.46*bandA+.24*ticks;
  }else if(v_shape==35){
    // Low-contrast volumetric mist is noise-shaped so it does not read as a solid circle.
    vec2 q=p;float n=fbm(q*3.6+vec2(u_time*.08,-u_time*.05)),r=length(q),falloff=1.0-smoothstep(.3,1.0,r),puff=smoothstep(.37,.7,n);
    alpha=falloff*puff*.23;material=.34+.22*n;
  }else if(v_shape==36&&u_assetsReady==1){
    // V9 authored collapse flipbook: four-by-four frames carry the silhouette; the shader only grades the material.
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*16.0);vec2 cell=vec2(mod(frame,4.0),3.0-floor(frame/4.0));
    vec2 utilityUv=vec2(fract(uv.x*1.2-u_time*.11),fract(uv.y*1.07+u_time*.047));vec2 flowUv=texture(u_staffFlowMap,utilityUv).rg-.5;
    vec2 atlasUv=(cell+clamp(uv+flowUv*.012,.006,.994))/vec2(4.0,4.0);vec4 painted=texture(u_staffCollapseV9Map,atlasUv);
    vec3 normal=texture(u_staffNormalMap,utilityUv).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.64,max(.24,normal.z)));
    float ndl=max(0.0,dot(normal,normalize(vec3(-.38,-.62,.9)))),luma=max(painted.r,max(painted.g,painted.b)),edge=pow(max(0.0,painted.a-smoothstep(.22,.68,luma)),.72);
    float spec=pow(ndl,12.0),tier=clamp(v_edge,0.0,3.0),crystalMask=smoothstep(.3,.66,luma),lateFrame=step(12.0,frame);alpha=min(.99,painted.a*(.09+.91*crystalMask)+edge*.2)*(1.0-lateFrame)*( .94+ndl*.22);vec3 deepIce=vec3(.018,.055,.25),blueIce=vec3(.035,.38,.86),frost=mix(deepIce,blueIce,smoothstep(.18,.72,luma));frost=mix(frost,vec3(.25,.78,1.0),smoothstep(.68,.96,luma)*.58);textureColor=mix(frost,painted.rgb,.2)*(.9+.72*ndl)*(1.22+tier*.08)+vec3(.72,.98,1.0)*(spec*.76+edge*.62);textureMix=1.0;
  }else if(v_shape==37&&u_assetsReady==1){
    // V9 grounded contact flipbook: cracks and raised plates remain readable beneath actors.
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*16.0);vec2 cell=vec2(mod(frame,4.0),3.0-floor(frame/4.0));
    vec2 utilityUv=vec2(fract(uv.x*1.16+u_time*.035),fract(uv.y*1.23-u_time*.021));vec2 atlasUv=(cell+clamp(uv,.006,.994))/vec2(4.0,4.0);vec4 painted=texture(u_staffGroundV9Map,atlasUv);
    vec3 normal=texture(u_staffNormalMap,utilityUv).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.78,max(.18,normal.z)));float ndl=max(0.0,dot(normal,normalize(vec3(-.4,-.58,.9)))),luma=max(painted.r,max(painted.g,painted.b));
    float edge=painted.a*(.45+.55*smoothstep(.42,.8,luma)),contactMask=smoothstep(.36,.74,luma);alpha=min(.94,painted.a*(.06+.94*contactMask)+edge*.16)*(.9+ndl*.24);vec3 groundIce=mix(vec3(.012,.06,.2),vec3(.04,.38,.68),smoothstep(.2,.76,luma));textureColor=mix(groundIce,painted.rgb,.28)*(.76+.7*ndl)+vec3(.4,.9,1.12)*(edge*.62);textureMix=1.0;
  }else if(v_shape==38&&u_assetsReady==1){
    // V9 authored burst flipbook: hard facets and debris replace the old generic radial flash.
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*16.0);vec2 cell=vec2(mod(frame,4.0),3.0-floor(frame/4.0));
    vec2 utilityUv=vec2(fract(uv.x*1.08-u_time*.16),fract(uv.y*1.14+u_time*.08));vec2 atlasUv=(cell+clamp(uv,.006,.994))/vec2(4.0,4.0);vec4 painted=texture(u_staffBurstV9Map,atlasUv);
    vec3 normal=texture(u_staffNormalMap,utilityUv).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.72,max(.2,normal.z)));float ndl=max(0.0,dot(normal,normalize(vec3(-.34,-.62,.92)))),luma=max(painted.r,max(painted.g,painted.b)),spec=pow(ndl,10.0),tier=clamp(v_edge,0.0,3.0);
    float burstMask=smoothstep(.26,.64,luma);alpha=min(1.0,painted.a*(.1+.9*burstMask)+spec*.12)*(.96+ndl*.22);vec3 burstIce=mix(vec3(.03,.08,.32),vec3(.14,.62,.98),burstMask);textureColor=mix(burstIce,painted.rgb,.3)*(.86+.66*ndl)*(1.22+tier*.08)+vec3(.68,1.0,1.18)*(spec*.72+pow(luma,4.0)*.5);textureMix=1.0;
  }else if(v_shape==39&&u_assetsReady==1){
    // Authored gleam channel: only crisp silhouette edges, facets and moving glints are added.
    // This keeps the spell ornate without painting another opaque decal over the floor.
    vec2 uv=p*.5+.5;float frame=floor(clamp(v_phase,0.0,.999)*16.0);vec2 cell=vec2(mod(frame,4.0),3.0-floor(frame/4.0));
    vec2 utilityUv=vec2(fract(uv.x*1.26-u_time*.22),fract(uv.y*1.12+u_time*.17));vec2 flow=texture(u_staffDistortionMap,utilityUv).rg-.5;
    vec2 atlasUv=(cell+clamp(uv+flow*.012,.006,.994))/vec2(4.0,4.0);vec4 painted=texture(u_staffCollapseV9Map,atlasUv);vec2 texel=1.0/vec2(textureSize(u_staffCollapseV9Map,0));
    float left=texture(u_staffCollapseV9Map,clamp(atlasUv-vec2(texel.x,0.0),.001,.999)).a,right=texture(u_staffCollapseV9Map,clamp(atlasUv+vec2(texel.x,0.0),.001,.999)).a;
    float up=texture(u_staffCollapseV9Map,clamp(atlasUv-vec2(0.0,texel.y),.001,.999)).a,down=texture(u_staffCollapseV9Map,clamp(atlasUv+vec2(0.0,texel.y),.001,.999)).a;
    float luma=dot(painted.rgb,vec3(.22,.54,.24)),solid=smoothstep(.12,.48,painted.a),edge=smoothstep(.02,.22,max(0.0,painted.a-min(min(left,right),min(up,down))));
    vec3 normal=texture(u_staffNormalMap,utilityUv).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.82,max(.2,normal.z)));float ndl=max(0.0,dot(normal,normalize(vec3(-.42,-.64,.9))));
    float facet=smoothstep(.48,.86,luma)*solid;float sweep=pow(max(0.0,1.0-abs(fract((p.x*1.3+p.y*.7)+u_time*.32)-.5)*2.0),10.0)*facet;
    float spec=pow(ndl,14.0)*solid;float jewelSweep=pow(max(0.0,cos(atan(p.y,p.x)*7.0-u_time*.34)),24.0)*smoothstep(.34,.82,length(p))*solid;float needle=pow(max(0.0,cos(atan(p.y,p.x)*8.0-u_time*.16)),36.0)*smoothstep(.38,.7,length(p))*(1.0-smoothstep(.76,.95,length(p)))*solid;alpha=min(.98,edge*2.9+facet*.3+sweep*.68+spec*.56+jewelSweep*.28+needle*.42)*(.96+ndl*.36);vec3 gleamBlue=mix(vec3(.02,.12,.54),vec3(.18,.7,1.0),smoothstep(.2,.78,luma));textureColor=gleamBlue*(1.1+ndl*.82)+vec3(.84,1.0,1.0)*(edge*1.12+sweep*.98+spec*.9+jewelSweep*.7+needle*.86);textureMix=1.0;
  }else if(v_shape==40&&u_assetsReady==1){
    // Refined late-stage atlas: explicit facets replace the old rounded debris silhouette.
    vec2 uv=p*.5+.5;float frame=12.0+floor(clamp(v_phase,0.0,.999)*4.0);vec2 cell=vec2(mod(frame,4.0),3.0-floor(frame/4.0));
    vec2 utilityUv=vec2(fract(uv.x*1.18-u_time*.13),fract(uv.y*1.24+u_time*.09));vec2 flow=texture(u_staffDistortionMap,utilityUv).rg-.5;vec2 atlasUv=(cell+clamp(uv+flow*.008,.008,.992))/vec2(4.0,4.0);vec4 painted=texture(u_staffCollapseV10Map,atlasUv);vec2 texel=1.0/vec2(textureSize(u_staffCollapseV10Map,0));
    float left=texture(u_staffCollapseV10Map,clamp(atlasUv-vec2(texel.x,0.0),.001,.999)).a,right=texture(u_staffCollapseV10Map,clamp(atlasUv+vec2(texel.x,0.0),.001,.999)).a;
    float up=texture(u_staffCollapseV10Map,clamp(atlasUv-vec2(0.0,texel.y),.001,.999)).a,down=texture(u_staffCollapseV10Map,clamp(atlasUv+vec2(0.0,texel.y),.001,.999)).a;
    // Final matte guard: generated atlases may contain a neutral checkerboard
    // even after alpha cleanup. Only chromatic ice or near-white highlights
    // adjacent to chromatic pixels may reach the framebuffer.
    float luma=dot(painted.rgb,vec3(.22,.54,.24)),chroma=length(painted.rgb-vec3(luma));
    float colorMask=smoothstep(.018,.075,chroma),highlightMask=smoothstep(.86,.96,luma)*(1.0-smoothstep(.025,.11,chroma));
    float sourceAlpha=painted.a*max(colorMask,highlightMask),solid=smoothstep(.2,.58,sourceAlpha),edge=smoothstep(.018,.18,max(0.0,sourceAlpha-min(min(left,right),min(up,down))));float plane=smoothstep(.22,.62,luma)*solid;
    vec3 normal=texture(u_staffNormalMap,utilityUv).rgb*2.0-1.0;normal=normalize(vec3(normal.xy*.86,max(.22,normal.z)));float ndl=max(0.0,dot(normal,normalize(vec3(-.48,-.64,.88)))),spec=pow(ndl,18.0)*solid;float facetGlint=pow(max(0.0,cos(atan(p.y,p.x)*6.0+u_time*.24)),30.0)*smoothstep(.34,.8,length(p))*solid;
    alpha=min(.96,(sourceAlpha*(.18+.82*plane)+edge*2.8+spec*.62+facetGlint*.42))*(.96+ndl*.3);vec3 facetBlue=mix(vec3(.018,.08,.3),vec3(.08,.48,.92),smoothstep(.18,.78,luma));facetBlue=mix(facetBlue,vec3(.3,.82,1.0),smoothstep(.68,.95,luma)*.52);float brightness=1.22+ndl*.2;textureColor=mix(facetBlue,painted.rgb,.16)*brightness+vec3(.72,.98,1.0)*(edge*1.04+spec*1.18+facetGlint*.98);textureMix=1.0;
  }else if(v_shape==41){
    // Portal membrane: an arched, refractive water surface driven by the same
    // flow, normal and distortion maps as the authored mage materials.
    vec2 uv=p*.5+.5;float archD;
    if(p.y<-.12)archD=length(vec2(p.x/.8,(p.y+.12)/.88))-1.0;else archD=max(abs(p.x)-.8,p.y-.88);
    float mask=aa(archD),rim=band(archD,.026)*mask,ready=float(u_assetsReady);
    vec2 flowUvA=vec2(fract(uv.x*2.3+u_time*.038),fract(uv.y*3.15-u_time*.061));
    vec2 flowUvB=vec2(fract(uv.x*3.45-u_time*.031),fract(uv.y*2.25+u_time*.047));
    vec2 procedural=vec2(sin(uv.y*22.0-u_time*1.35+sin(uv.x*11.0)*.65),cos(uv.x*19.0+u_time*.92+sin(uv.y*13.0)*.55))*.5;
    vec2 mapped=(texture(u_staffNormalMap,flowUvA).rg-.5)+(texture(u_staffDistortionMap,flowUvB).rg-.5)*.72;
    vec2 displacement=mix(procedural,mapped,ready);vec3 normal=normalize(vec3(displacement*1.55,.78));
    float flowA=mix(.5+.5*sin((uv.x*7.0+uv.y*18.0)-u_time*1.15),texture(u_staffFlowMap,flowUvA).r,ready);
    float flowB=mix(.5+.5*sin((uv.x*17.0-uv.y*12.0)+u_time*.82),texture(u_staffFlowMap,flowUvB).r,ready);
    float crossing=abs(sin((uv.x*15.0+uv.y*21.0)-u_time*1.24+flowA*2.1))*abs(cos((uv.x*23.0-uv.y*13.0)+u_time*.93+flowB));
    float caustic=pow(clamp(crossing,0.0,1.0),3.0),sweep=pow(max(0.0,1.0-abs(fract(uv.y*1.45-u_time*.115+sin(uv.x*8.0)*.07)-.5)*2.0),7.0);
    float ndl=max(0.0,dot(normal,normalize(vec3(-.45,-.58,.9)))),spec=pow(ndl,18.0),fresnel=pow(1.0-max(.0,normal.z),2.0);
    float depth=smoothstep(.02,.92,uv.y),micro=.5+.5*sin((uv.x+uv.y)*54.0+flowA*4.0-u_time*1.7);
    float sparkle=pow(max(0.0,.5+.5*sin(uv.x*71.0-uv.y*47.0+u_time*2.1+flowB*5.0)),18.0)*smoothstep(.35,.86,caustic);
    alpha=mask*(.69+caustic*.19+sweep*.13)+rim*.36;
    vec3 deep=vec3(.008,.07,.12),water=vec3(.035,.42,.53),jade=vec3(.14,.86,.77),white=vec3(.8,1.0,.94);
    textureColor=mix(deep,water,.66+.2*depth)+jade*(caustic*.9+sweep*.44+flowA*.13)+white*(spec*.7+rim*.9+micro*caustic*.3+sparkle*.96)+vec3(.03,.23,.24)*fresnel;
    textureMix=1.0;
  }else if(v_shape==42){
    // Volumetric portal interior. Nested parallax arches retreat into a dark
    // vanishing point, so the doorway reads as traversable space, not a decal.
    vec2 uv=p*.5+.5;float archD;if(p.y<-.12)archD=length(vec2(p.x/.8,(p.y+.12)/.88))-1.0;else archD=max(abs(p.x)-.8,p.y-.88);
    float mask=aa(archD),edge=band(archD,.018)*mask;vec2 q=vec2(p.x,p.y*.91+.05),dist=texture(u_staffDistortionMap,vec2(fract(uv.x*1.7-u_time*.021),fract(uv.y*2.1+u_time*.034))).rg-.5;
    q+=dist*.055;float radius=length(vec2(q.x*.86,q.y)),angle=atan(q.y,q.x);float tunnel=0.0,filaments=0.0;
    for(int i=0;i<6;i++){float fi=float(i),z=fract(fi/6.0+u_time*.055),scale=.24+z*.86;vec2 rp=q/scale;float arch=abs(length(vec2(rp.x*.9,(rp.y+.16)*.83))-(.58+fi*.012));tunnel+=exp(-arch*(46.0+fi*4.0))*(1.0-z)*.34;filaments+=pow(max(0.0,cos(angle*(5.0+mod(fi,2.0))+fi*1.7-u_time*(.4+fi*.06))),28.0)*exp(-abs(radius-scale*.72)*28.0)*.11;}
    float vanishing=exp(-length(vec2(q.x*.85,q.y+.04))*4.6),flow=texture(u_staffFlowMap,vec2(fract(uv.x*2.7+u_time*.027),fract(uv.y*3.3-u_time*.044))).r;
    float dust=pow(max(0.0,.5+.5*sin(uv.x*93.0+uv.y*71.0-u_time*1.2+flow*5.0)),24.0)*smoothstep(.18,.74,vanishing);
    vec3 abyss=vec3(.002,.012,.028),mid=vec3(.008,.11,.18),cyan=vec3(.05,.52,.58),pearl=vec3(.64,.97,.88);
    textureColor=mix(abyss,mid,vanishing*.75+flow*.11)+cyan*(tunnel*.9+filaments*.65)+pearl*(tunnel*tunnel*.62+dust*.7+edge*.28);alpha=mask*(.88+tunnel*.1)+edge*.18;textureMix=1.0;
  }
  alpha*=v_color.a;if(alpha<.004)discard;
  outColor=vec4(mix(v_color.rgb*material,textureColor,textureMix),alpha);
}`;
const postVertex=`#version 300 es
precision highp float;layout(location=0) in vec2 a_corner;out vec2 v_uv;
void main(){v_uv=a_corner*.5+.5;gl_Position=vec4(a_corner,0.0,1.0);}`;
const postFragment=`#version 300 es
precision highp float;uniform sampler2D u_scene;uniform float u_time;uniform float u_strength;in vec2 v_uv;out vec4 outColor;
void main(){
  vec2 texel=1.0/vec2(textureSize(u_scene,0));vec4 base=texture(u_scene,v_uv);
  float mask=smoothstep(.03,.34,base.a);
  vec2 flow=vec2(sin(v_uv.y*24.0+u_time*1.3),cos(v_uv.x*20.0-u_time))*texel*2.0*u_strength*mask;
  vec4 warped=texture(u_scene,v_uv+flow);
  vec3 edge=vec3(0.0);float edgeAlpha=0.0;
  for(int i=0;i<4;i++){
    vec2 off=i==0?vec2(texel.x,0.0):i==1?vec2(-texel.x,0.0):i==2?vec2(0.0,texel.y):vec2(0.0,-texel.y);
    vec4 sampleColor=texture(u_scene,v_uv+off*2.0);edge+=sampleColor.rgb*.085;edgeAlpha=max(edgeAlpha,sampleColor.a);
  }
  vec3 sourceColor=warped.rgb/max(warped.a,.012);
  vec3 edgeColor=edge/max(edgeAlpha,.012);
  vec3 color=sourceColor+edgeColor*(1.0-warped.a)*.18;
  float alpha=max(warped.a,edgeAlpha*.18);
  color=color/(vec3(1.0)+color*.32);
  outColor=vec4(color,alpha);
}`;
function unavailable(canvas){return {available:false,assetsReady:false,canvas,beginFrame(){},ring(){},disc(){},beam(){},shard(){},sigil(){},pillar(){},cone(){},light(){},trail(){},fissure(){},bladeArc(){},starCore(){},vortex(){},windWake(){},crescent(){},rock(){},royalArc(){},arrow(){},swordRibbon(){},bladeFlash(){},assetSlash(){},assetSpark(){},assetEclipse(){},assetCollapse(){},assetEclipseEdge(){},assetEclipseVeil(){},assetCollapseEdge(){},assetCollapseMist(){},assetStaffCollapseV9(){},assetStaffCollapseV10(){},assetStaffGroundV9(){},assetStaffBurstV9(){},assetStaffGleamV9(){},iceTrailSurface(){},iceBurst(){},groundSeal(){},crackField(){},prism(){},collapseCore(){},collapseOrbit(){},collapseMist(){},portalSurface(){},portalDepth(){},flush(){return {instances:0,drawCalls:0};}};}

export function createWebGLVfxRenderer(canvas){
  if(!canvas?.getContext)return unavailable(canvas);
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  if(!gl||typeof gl.VERTEX_SHADER!=='number')return unavailable(canvas);
  let effectProgram,postProgram;
  try{effectProgram=program(gl,vertexSource,fragmentSource);postProgram=program(gl,postVertex,postFragment);}catch(error){console.warn('WebGL VFX disabled:',error);return unavailable(canvas);}
  const quad=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);
  const vertexBuffer=gl.createBuffer(),instanceBuffer=gl.createBuffer(),effectVao=gl.createVertexArray();
  gl.bindVertexArray(effectVao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,quad,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,MAX_GPU_INSTANCES*12*4,gl.DYNAMIC_DRAW);
  for(let i=0;i<3;i++){const location=i+1;gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,4,gl.FLOAT,false,48,i*16);gl.vertexAttribDivisor(location,1);}
  const postVao=gl.createVertexArray();gl.bindVertexArray(postVao);gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const texture=gl.createTexture(),framebuffer=gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const assetState={loaded:0,total:16,textures:{}};
  function loadAssetTexture(name,url,repeat=false){
    const target=gl.createTexture();assetState.textures[name]=target;gl.bindTexture(gl.TEXTURE_2D,target);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);
    if(typeof Image==='undefined')return;const image=new Image();image.decoding='async';image.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,target);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);assetState.loaded++;};image.onerror=()=>console.warn('VFX texture failed:',url);image.src=url;
  }
  loadAssetTexture('slash','./vfx-sword-slash-atlas-v8.png');loadAssetTexture('flow','./vfx-sword-flow-v8.png',true);loadAssetTexture('normal','./vfx-sword-normal-v8.png',true);loadAssetTexture('distortion','./vfx-sword-distortion-v8.png',true);loadAssetTexture('spark','./vfx-sword-sparks-atlas-v8.png');
  loadAssetTexture('eclipse','./vfx-staff-eclipse-atlas-v8.png');loadAssetTexture('collapse','./vfx-staff-collapse-atlas-v8.png');loadAssetTexture('staffFlow','./vfx-staff-flow-v8.png',true);loadAssetTexture('staffNormal','./vfx-staff-normal-v8.png',true);loadAssetTexture('staffDistortion','./vfx-staff-distortion-v8.png',true);loadAssetTexture('staffTrail','./vfx-staff-ice-trail-v8.png');loadAssetTexture('staffBurst','./vfx-staff-ice-burst-v8.png');loadAssetTexture('staffCollapseV9','./vfx-staff-collapse-flipbook-v9.png');loadAssetTexture('staffCollapseV10','./vfx-staff-collapse-flipbook-v10-alpha.png?v=8.2-mage-vfx-v19');loadAssetTexture('staffGroundV9','./vfx-staff-ground-contact-v9.png');loadAssetTexture('staffBurstV9','./vfx-staff-burst-flipbook-v9.png');
  const data=new Float32Array(MAX_GPU_INSTANCES*12);let count=0,time=0,camera=[1,0,0],textureWidth=0,textureHeight=0;
  function resize(){const width=Math.max(1,canvas.width||1040),height=Math.max(1,canvas.height||720);if(textureWidth===width&&textureHeight===height)return;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);textureWidth=width;textureHeight=height;}
  function push(x,y,width,height,color,alpha,rotation,shape,edge=.04,phase=0){
    if(count>=MAX_GPU_INSTANCES||![x,y,width,height].every(Number.isFinite))return;
    // Material cores may be opaque; broad lights retain the lower safety ceiling.
    const opacityCeiling=shape>=20&&shape<=42?.98:.82;
    const rgb=hexColor(color),offset=count++*12;data.set([x,y,Math.max(1,width),Math.max(1,height),rgb[0],rgb[1],rgb[2],clamp(alpha,0,opacityCeiling),rotation||0,shape,edge,phase],offset);
  }
  const api={
    available:true,canvas,get assetsReady(){return assetState.loaded===assetState.total;},
    beginFrame(options={}){count=0;time=options.time||0;camera=[options.zoom||1,options.shakeX||0,options.shakeY||0];resize();},
    ring(x,y,r,color,alpha=.5,edge=.035,aspect=.62,rotation=0,phase=0){push(x,y,r*2,r*2*aspect,color,alpha,rotation,0,edge,phase);},
    disc(x,y,r,color,alpha=.16,aspect=.62,rotation=0,phase=0){push(x,y,r*2,r*2*aspect,color,alpha,rotation,5,.035,phase);},
    beam(x,y,length,width,rotation,color,alpha=.42,phase=0){push(x,y,length,width,color,alpha,rotation,1,.04,phase);},
    shard(x,y,size,rotation,color,alpha=.62,phase=0){push(x,y,size*2.4,size*1.25,color,alpha,rotation,2,.04,phase);},
    sigil(x,y,r,color,alpha=.48,rotation=0,phase=0){push(x,y,r*2,r*1.2,color,alpha,rotation,3,.025,phase);},
    pillar(x,y,r,height,color,alpha=.38,phase=0){push(x,y-height*.44,r*1.45,height,color,alpha,0,4,.03,phase);},
    cone(x,y,rotation,range,arc,color,alpha=.34,phase=0){const height=Math.max(18,2*range*Math.tan(Math.min(1.25,arc)/2));push(x+Math.cos(rotation)*range*.5,y+Math.sin(rotation)*range*.5,range,height,color,alpha,rotation,6,.025,phase);},
    light(x,y,r,color,alpha=.22,aspect=.65,phase=0){push(x,y,r*2,r*2*aspect,color,alpha,0,7,.03,phase);},
    trail(x,y,length,width,rotation,color,alpha=.52,phase=0){push(x,y,length,width,color,alpha,rotation,8,.03,phase);},
    fissure(x,y,size,rotation,color,alpha=.65,layer=1,phase=0){push(x,y,size,size*.62,color,alpha,rotation,9,layer,phase);},
    bladeArc(x,y,r,rotation,color,alpha=.68,phase=0){push(x,y,r*2.1,r*1.5,color,alpha,rotation,10,.04,phase);},
    starCore(x,y,r,rotation,color,alpha=.72,phase=0){push(x,y,r*2,r*2,color,alpha,rotation,11,.04,phase);},
    vortex(x,y,r,rotation,color,alpha=.62,phase=0){push(x,y,r*2,r*1.38,color,alpha,rotation,12,.04,phase);},
    windWake(x,y,length,width,rotation,color,alpha=.58,phase=0){push(x,y,length,width,color,alpha,rotation,13,.04,phase);},
    crescent(x,y,r,rotation,color,alpha=.58,phase=0){push(x,y,r*2,r*1.35,color,alpha,rotation,14,.04,phase);},
    rock(x,y,size,rotation,color,alpha=.7,phase=0){push(x,y,size*2,size*1.45,color,alpha,rotation,15,.04,phase);},
    royalArc(x,y,r,rotation,color,alpha=.7,phase=0){push(x,y,r*2.16,r*1.54,color,alpha,rotation,16,.04,phase);},
    arrow(x,y,length,rotation,color,alpha=.75,phase=0){push(x,y,length,Math.max(18,length*.38),color,alpha,rotation,17,.04,phase);},
    swordRibbon(x,y,r,rotation,color,alpha=.74,phase=0){push(x,y,r*2.2,r*1.58,color,alpha,rotation,18,.04,phase);},
    bladeFlash(x,y,r,rotation,color,alpha=.78,phase=0){push(x,y,r*2.8,r*1.9,color,alpha,rotation,19,.04,phase);},
    assetSlash(x,y,r,rotation,alpha=.82,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,20,quality,clamp((frame+.01)/8,0,.999));},
    assetSpark(x,y,r,rotation,alpha=.78,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,21,quality,clamp((frame+.01)/8,0,.999));},
    assetEclipse(x,y,r,rotation,alpha=.82,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,22,quality,clamp((frame+.01)/8,0,.999));},
    assetCollapse(x,y,r,rotation,alpha=.82,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,23,quality,clamp((frame+.01)/8,0,.999));},
    assetEclipseEdge(x,y,r,rotation,alpha=.82,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,24,quality,clamp((frame+.01)/8,0,.999));},
    assetEclipseVeil(x,y,r,rotation,alpha=.56,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,25,quality,clamp((frame+.01)/8,0,.999));},
    assetCollapseEdge(x,y,r,rotation,alpha=.82,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,26,quality,clamp((frame+.01)/8,0,.999));},
    assetCollapseMist(x,y,r,rotation,alpha=.5,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,27,quality,clamp((frame+.01)/8,0,.999));},
    assetStaffCollapseV9(x,y,r,rotation,alpha=.92,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,36,quality,clamp(frame,0,.999));},
    assetStaffCollapseV10(x,y,r,rotation,alpha=.9,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,40,quality,clamp(frame,0,.999));},
    assetStaffGroundV9(x,y,r,rotation,alpha=.78,frame=0,quality=3){push(x,y,r*2,r*2*.84,'#ffffff',alpha,rotation,37,quality,clamp(frame,0,.999));},
    assetStaffBurstV9(x,y,r,rotation,alpha=.96,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,38,quality,clamp(frame,0,.999));},
    assetStaffGleamV9(x,y,r,rotation,alpha=.82,frame=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,39,quality,clamp(frame,0,.999));},
    iceTrailSurface(x,y,length,width,rotation,alpha=.72,age=0,quality=3){push(x,y,length,width,'#ffffff',alpha,rotation,28,quality,clamp(age,0,.999));},
    iceBurst(x,y,r,rotation,alpha=.82,progress=0,quality=3){push(x,y,r*2,r*2,'#ffffff',alpha,rotation,29,quality,clamp(progress,0,.999));},
    groundSeal(x,y,r,rotation,color,alpha=.42,progress=0){push(x,y,r*2,r*1.58,color,alpha,rotation,30,.04,clamp(progress,0,.999));},
    crackField(x,y,r,rotation,color,alpha=.42,progress=0){push(x,y,r*2,r*2,color,alpha,rotation,31,.04,clamp(progress,0,.999));},
    prism(x,y,width,height,rotation,color,alpha=.62,progress=0){push(x,y-height*.46,width,height,color,alpha,rotation,32,.04,clamp(progress,0,.999));},
    collapseCore(x,y,r,rotation,color,alpha=.8,progress=0){push(x,y,r*2,r*2.16,color,alpha,rotation,33,.04,clamp(progress,0,.999));},
    collapseOrbit(x,y,r,rotation,color,alpha=.48,progress=0){push(x,y,r*2,r*1.28,color,alpha,rotation,34,.04,clamp(progress,0,.999));},
    collapseMist(x,y,r,rotation,color,alpha=.3,progress=0){push(x,y,r*2,r*2,color,alpha,rotation,35,.04,clamp(progress,0,.999));},
    portalSurface(x,y,width,height,color='#52d8c8',alpha=.82,phase=0){push(x,y,width,height,color,alpha,0,41,.04,phase);},
    portalDepth(x,y,width,height,color='#143b56',alpha=.82,phase=0){push(x,y,width,height,color,alpha,0,42,.04,phase);},
    flush(){
      resize();gl.viewport(0,0,canvas.width,canvas.height);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      if(count){gl.useProgram(effectProgram);gl.bindVertexArray(effectVao);gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,count*12));gl.uniform2f(gl.getUniformLocation(effectProgram,'u_resolution'),canvas.width,canvas.height);gl.uniform3f(gl.getUniformLocation(effectProgram,'u_camera'),camera[0],camera[1],camera[2]);gl.uniform1f(gl.getUniformLocation(effectProgram,'u_time'),time);gl.uniform1i(gl.getUniformLocation(effectProgram,'u_assetsReady'),api.assetsReady?1:0);for(const [index,[name,uniform]] of [['slash','u_slashAtlas'],['flow','u_flowMap'],['normal','u_normalMap'],['distortion','u_distortionMap'],['spark','u_sparkAtlas'],['eclipse','u_eclipseAtlas'],['collapse','u_collapseAtlas'],['staffFlow','u_staffFlowMap'],['staffNormal','u_staffNormalMap'],['staffDistortion','u_staffDistortionMap'],['staffTrail','u_staffTrailMap'],['staffBurst','u_staffBurstMap'],['staffCollapseV9','u_staffCollapseV9Map'],['staffCollapseV10','u_staffCollapseV10Map'],['staffGroundV9','u_staffGroundV9Map'],['staffBurstV9','u_staffBurstV9Map']].entries()){gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,assetState.textures[name]);gl.uniform1i(gl.getUniformLocation(effectProgram,uniform),index);}gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArraysInstanced(gl.TRIANGLES,0,6,count);}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(postProgram);gl.bindVertexArray(postVao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(postProgram,'u_scene'),0);gl.uniform1f(gl.getUniformLocation(postProgram,'u_time'),time);gl.uniform1f(gl.getUniformLocation(postProgram,'u_strength'),count>180?.35:.7);gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,6);
      return {instances:count,drawCalls:count?2:1};
    }
  };
  return api;
}
