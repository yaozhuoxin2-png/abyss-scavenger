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
in vec2 v_uv;
in vec4 v_color;
flat in int v_shape;
in float v_edge;
in float v_phase;
out vec4 outColor;
float aa(float d){return 1.0-smoothstep(0.0,fwidth(d)*1.7,d);}
float band(float d,float width){return 1.0-smoothstep(width,width+fwidth(d)*1.5,abs(d));}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 p=v_uv;float alpha=0.0;float material=1.0;
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
  }
  alpha*=v_color.a;if(alpha<.004)discard;
  outColor=vec4(v_color.rgb*material,alpha);
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
function unavailable(canvas){return {available:false,canvas,beginFrame(){},ring(){},disc(){},beam(){},shard(){},sigil(){},pillar(){},cone(){},light(){},trail(){},flush(){return {instances:0,drawCalls:0};}};}

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
  const data=new Float32Array(MAX_GPU_INSTANCES*12);let count=0,time=0,camera=[1,0,0],textureWidth=0,textureHeight=0;
  function resize(){const width=Math.max(1,canvas.width||1040),height=Math.max(1,canvas.height||720);if(textureWidth===width&&textureHeight===height)return;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);textureWidth=width;textureHeight=height;}
  function push(x,y,width,height,color,alpha,rotation,shape,edge=.04,phase=0){
    if(count>=MAX_GPU_INSTANCES||![x,y,width,height].every(Number.isFinite))return;
    const rgb=hexColor(color),offset=count++*12;data.set([x,y,Math.max(1,width),Math.max(1,height),rgb[0],rgb[1],rgb[2],clamp(alpha,0,.82),rotation||0,shape,edge,phase],offset);
  }
  const api={
    available:true,canvas,
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
    flush(){
      resize();gl.viewport(0,0,canvas.width,canvas.height);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      if(count){gl.useProgram(effectProgram);gl.bindVertexArray(effectVao);gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,count*12));gl.uniform2f(gl.getUniformLocation(effectProgram,'u_resolution'),canvas.width,canvas.height);gl.uniform3f(gl.getUniformLocation(effectProgram,'u_camera'),camera[0],camera[1],camera[2]);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawArraysInstanced(gl.TRIANGLES,0,6,count);}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(postProgram);gl.bindVertexArray(postVao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(postProgram,'u_scene'),0);gl.uniform1f(gl.getUniformLocation(postProgram,'u_time'),time);gl.uniform1f(gl.getUniformLocation(postProgram,'u_strength'),count>180?.35:.7);gl.disable(gl.BLEND);gl.drawArrays(gl.TRIANGLES,0,6);
      return {instances:count,drawCalls:count?2:1};
    }
  };
  return api;
}
