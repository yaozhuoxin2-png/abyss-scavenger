import {MAGE_COLLAPSE_BUILD,collapseLayout,collapsePhase,crystalPose,chipPose,FLOOR_COS,collapseCameraShift,encodeFootY,clamp01,smooth} from './mage-collapse-state.mjs';

const WIDTH=1040,HEIGHT=720;
// A real mesh pass, not a replacement atlas. Three is pinned and bundled locally.
export function createMageCollapseRenderer(canvas,sourceCanvas){
  const api={available:false,ready:false,failed:false,build:MAGE_COLLAPSE_BUILD,stats:{crystals:0,chips:0,drawCalls:0,triangles:0,cpuMs:0,gpuMs:null,fps:null,peakCpuMs:0},beginFrame(){},captureFloor(){},recordActor(){},render(){},clear(){},readyPromise:null};
  if(!canvas?.getContext||typeof document==='undefined')return api;
  let gl;try{gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});}catch{return api;}
  if(!gl||typeof gl.getParameter!=='function'||typeof gl.getParameter(gl.VERSION)!=='string')return api;
  api.available=true;
  api.readyPromise=import('./vendor/three.module.min.js').then(THREE=>initialize(THREE,canvas,sourceCanvas,gl,api)).catch(error=>{api.failed=true;console.error('立体冰晶初始化失败，保留原技能回退：',error);});
  return api;
}

function initialize(T,canvas,sourceCanvas,gl,api){
  const renderer=new T.WebGLRenderer({canvas,context:gl,alpha:true,antialias:true,premultipliedAlpha:true});
  renderer.setPixelRatio(1);renderer.setSize(WIDTH,HEIGHT,false);renderer.setClearColor(0,0);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
  renderer.debug.onShaderError=(_context,_program,_vertex,fragment)=>{api.failed=true;api.ready=false;console.error('立体冰晶着色器无法编译：',gl.getShaderInfoLog(fragment));};
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-WIDTH/2,WIDTH/2,HEIGHT/2,-HEIGHT/2,1,2200);
  camera.position.set(0,800,600);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const viewDirection=new T.Vector3(0,.8,.6);
  // GPU silhouette pass: reuse the actual rendered actor alpha. Idle / authored
  // walk frames upload once, and foot depth travels in a uniform, not a newly
  // repainted Canvas image on every frame.
  const maskTarget=new T.WebGLRenderTarget(WIDTH/2,HEIGHT/2,{format:T.RGBAFormat,depthBuffer:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
  const actorMask=maskTarget.texture;actorMask.colorSpace=T.NoColorSpace;actorMask.generateMipmaps=false;
  const maskScene=new T.Scene(),maskCamera=new T.OrthographicCamera(-520,520,360,-360,.1,3);maskCamera.position.z=1;
  const maskQuad=new T.PlaneGeometry(1,1),maskNodes=[],maskTextures=new Map(),actorRecords=[];let maskFrame=0;
  function drawActorMask(){
    maskFrame++;for(const mesh of maskNodes)mesh.visible=false;
    for(let i=0;i<actorRecords.length;i++){
      const actor=actorRecords[i],{image,dirty,x,y,w,h,footY,transform:m}=actor;
      let cached=maskTextures.get(image);if(!cached){const texture=new T.CanvasTexture(image);texture.colorSpace=T.NoColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=T.LinearFilter;cached={texture,last:maskFrame,token:null};maskTextures.set(image,cached);}cached.last=maskFrame;if(dirty&&(dirty===true||dirty!==cached.token)){cached.texture.needsUpdate=true;cached.token=dirty;}
      if(!maskNodes[i]){const material=new T.ShaderMaterial({uniforms:{alphaMap:{value:null},footCode:{value:new T.Vector3()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D alphaMap;uniform vec3 footCode;varying vec2 vUv;void main(){float alpha=texture2D(alphaMap,vUv).a;if(alpha<.42)discard;gl_FragColor=vec4(footCode,alpha);}',depthTest:false,depthWrite:false,side:T.DoubleSide,blending:T.NoBlending});const mesh=new T.Mesh(maskQuad,material);mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;maskNodes.push(mesh);maskScene.add(mesh);}
      const mesh=maskNodes[i],cx=m.a*(x+w/2)+m.c*(y+h/2)+m.e,cy=m.b*(x+w/2)+m.d*(y+h/2)+m.f;
      mesh.visible=true;mesh.renderOrder=i;mesh.material.uniforms.alphaMap.value=cached.texture;const rgb=encodeFootY(footY);mesh.material.uniforms.footCode.value.set(rgb[0]/255,rgb[1]/255,1);
      mesh.matrix.set(m.a*w,-m.c*h,0,cx-520,-m.b*w,m.d*h,0,360-cy,0,0,1,0,0,0,0,1);mesh.matrixWorldNeedsUpdate=true;
    }
    renderer.setRenderTarget(maskTarget);renderer.render(maskScene,maskCamera);const calls=renderer.info.render.calls;renderer.setRenderTarget(null);
    for(const [image,cached] of maskTextures)if(maskFrame-cached.last>120){cached.texture.dispose();maskTextures.delete(image);}
    return calls;
  }
  const floorCanvas=document.createElement('canvas');floorCanvas.width=WIDTH;floorCanvas.height=HEIGHT;const floorPaint=floorCanvas.getContext('2d');let capturedMap;
  const sourceTexture=new T.CanvasTexture(floorCanvas);sourceTexture.colorSpace=T.SRGBColorSpace;sourceTexture.generateMipmaps=false;sourceTexture.minFilter=T.LinearFilter;
  const uniforms={actorMask:{value:actorMask},sceneMap:{value:sourceTexture},resolution:{value:new T.Vector2(WIDTH,HEIGHT)},zoom:{value:1},shake:{value:new T.Vector2()},floorZoom:{value:1},floorShake:{value:new T.Vector2()},age:{value:0},groundStrength:{value:0}};
  const maskGLSL=`
    vec2 screenUv=gl_FragCoord.xy/resolution;
    vec4 occluder=texture2D(actorMask,screenUv);
    if(occluder.a>.42&&occluder.b>.5){
      float foot=(floor(occluder.r*255.0+.5)*256.0+floor(occluder.g*255.0+.5))/65535.0*1024.0;
      float sy=(720.0-gl_FragCoord.y-360.0-shake.y)/zoom+360.0;
      float bodyDepth=.6*((foot-360.0)/.8)+.8*max(0.0,(foot-sy)/.6);
      float iceDepth=.6*vWorld.z+.8*vWorld.y;
      if(bodyDepth>iceDepth+.8)discard;
    }
  `;
  const sharedFragment=`uniform sampler2D actorMask;uniform sampler2D sceneMap;uniform vec2 resolution;uniform float zoom;uniform vec2 shake;varying vec3 vWorld;`;
  const crystalMaterial=new T.ShaderMaterial({uniforms,vertexShader:`
    varying vec3 vNormal;varying vec3 vWorld;varying vec3 vLocal;varying vec2 vUv;
    void main(){
      mat4 world=modelMatrix;
      #ifdef USE_INSTANCING
        world=modelMatrix*instanceMatrix;
      #endif
      vec4 wp=world*vec4(position,1.0);vWorld=wp.xyz;vLocal=position;vUv=uv;
      mat3 basis=mat3(world);vec3 scaleSq=vec3(dot(basis[0],basis[0]),dot(basis[1],basis[1]),dot(basis[2],basis[2]));
      vNormal=normalize(basis*(normal/max(scaleSq,vec3(.00001))));
      gl_Position=projectionMatrix*viewMatrix*wp;
    }`,fragmentShader:`
    ${sharedFragment}varying vec3 vNormal;varying vec3 vLocal;varying vec2 vUv;uniform float age;uniform float floorZoom;uniform vec2 floorShake;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      ${maskGLSL}
      vec3 n=normalize(vNormal),v=normalize(vec3(0.0,.8,.6));
      vec3 key=normalize(vec3(-.55,.85,.38)),rim=normalize(vec3(.8,.3,-.6));
      float diffuse=max(0.0,dot(n,key)),side=max(0.0,dot(n,rim));
      float fresnel=pow(1.0-abs(dot(n,v)),3.0);
      float glint=pow(max(0.0,dot(n,normalize(key+v))),48.0);
      float longEdge=1.0-smoothstep(.003,.014,min(vUv.x,1.0-vUv.x));
      float fissureY=.33+.12*sin(vUv.x*9.0)+.045*sin(vUv.x*27.0);
      float fissure=(1.0-smoothstep(.003,.009,abs(vUv.y-fissureY)))*smoothstep(.06,.3,vUv.x)*(1.0-smoothstep(.7,.96,vUv.x));
      float secondary=(1.0-smoothstep(.002,.005,abs(vUv.x-(.62+.055*sin(vUv.y*14.0)))))*smoothstep(.36,.5,vUv.y)*(1.0-smoothstep(.64,.8,vUv.y));
      float height=smoothstep(0.0,.8,vLocal.y);
      vec3 deep=vec3(.008,.038,.19),clear=vec3(.045,.28,.59),tip=vec3(.24,.64,.86);
      vec3 body=mix(deep,clear,height);body=mix(body,tip,height*height*.32);
      body*=.32+diffuse*1.3+side*.15;
      // A small amount of actual dungeon refraction, never a pale whole-image overlay.
      vec2 gamePixel=(vec2(gl_FragCoord.x,720.0-gl_FragCoord.y)-vec2(520.0,360.0)-shake)/zoom;
      vec2 floorPixel=gamePixel*floorZoom+vec2(520.0,360.0)+floorShake;
      vec2 refractUv=vec2(floorPixel.x/1040.0,1.0-floorPixel.y/720.0)+vec2(n.x,-n.z)*.0035;
      vec3 behind=texture2D(sceneMap,clamp(refractUv,.001,.999)).rgb;
      body=mix(body,behind*vec3(.5,.86,1.15),.08*(1.0-fresnel));
      body+=vec3(.13,.45,.73)*fresnel*.22;
      body+=vec3(.6,.88,1.0)*(longEdge*(.32+diffuse*.5)+fissure*.12+secondary*.12);
      float vein=pow(max(0.0,1.0-abs(vUv.x-(.32+.018*sin(vUv.y*22.0)))*140.0),2.0)*smoothstep(.08,.3,vUv.y)*(1.0-smoothstep(.7,.92,vUv.y));
      body+=vec3(.16,.53,.87)*vein*.34;
      body+=vec3(.8,.96,1.0)*glint*.9;
      gl_FragColor=vec4(body,1.0);
      #include <colorspace_fragment>
    }`,side:T.FrontSide,transparent:false,depthWrite:true});

  const planeGeometry=new T.PlaneGeometry(2,2);planeGeometry.rotateX(-Math.PI/2);
  const groundMaterial=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:`varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.0);vWorld=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,fragmentShader:`
    ${sharedFragment}varying vec2 vUv;uniform float age;uniform float groundStrength;
    float hash(vec2 q){return fract(sin(dot(q,vec2(41.3,289.7)))*43758.5);}
    void main(){
      ${maskGLSL}
      vec2 p=(vUv-.5)*2.0;float d=length(p);if(d>1.0)discard;
      float a=atan(p.y,p.x),band=floor((a+3.14159)/6.28318*22.0);
      float sector=(a+3.14159)/6.28318*22.0-band;
      float segment=floor(d*9.0),offset=(hash(vec2(band,segment))-.5)*.18;
      float crack=1.0-smoothstep(.008,.024,abs(sector-.5-offset));
      float growth=smoothstep(0.0,.48,age),reach=growth*(.74+.26*hash(vec2(band,4.0)));
      crack*=1.0-smoothstep(reach-.045,reach,d);
      float grain=hash(floor(p*145.0));
      float frost=smoothstep(.77,.98,grain)*(.19+.32*(1.0-d))*(1.0-smoothstep(growth-.1,growth,d));
      // Voronoi boundaries read as fractured glass, not smooth spokes or a decal disc.
      vec2 grid=p*11.0,cell=floor(grid),local=fract(grid);float nearest=9.0,second=9.0;vec2 winning=vec2(0.0);
      for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j)),site=vec2(hash(cell+o),hash(cell+o+9.3));float q=length(o+site-local);if(q<nearest){second=nearest;nearest=q;winning=site;}else second=min(second,q);}
      float hairline=(1.0-smoothstep(.018,.055,second-nearest))*(1.0-smoothstep(growth-.09,growth,d));
      float sheet=step(.62,winning.x)*smoothstep(.1,.26,age)*(1.0-smoothstep(.43,.79,d));
      float boundary=(1.0-smoothstep(.004,.014,abs(d-.994)))*(.48+.3*step(.3,fract(a*2.54)));
      float opacity=groundStrength*(crack*.55+frost*.3+hairline*.42+sheet*.18+boundary*.5);
      vec3 col=mix(vec3(.015,.12,.23),vec3(.24,.65,.91),clamp(crack+boundary+hairline*.75,0.0,1.0));
      gl_FragColor=vec4(col,opacity);
      #include <colorspace_fragment>
    }`});

  const keyLight=new T.DirectionalLight(0xc5e8ff,1);keyLight.position.set(-170,320,190);keyLight.castShadow=true;
  keyLight.shadow.mapSize.set(512,512);keyLight.shadow.camera.left=-340;keyLight.shadow.camera.right=340;keyLight.shadow.camera.top=340;keyLight.shadow.camera.bottom=-340;keyLight.shadow.camera.near=1;keyLight.shadow.camera.far=1000;keyLight.shadow.bias=-.0015;keyLight.shadow.normalBias=.4;
  scene.add(keyLight,keyLight.target);
  const shadowMaterial=new T.ShadowMaterial({color:0x041021,opacity:.32,depthWrite:false});
  shadowMaterial.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 vWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWorld=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader=sharedFragment+'\n'+shader.fragmentShader.replace('void main() {',`void main() {\n${maskGLSL}`);
  };
  const shadowPlane=new T.Mesh(new T.PlaneGeometry(1,1),shadowMaterial);shadowPlane.rotation.x=-Math.PI/2;shadowPlane.position.y=.5;shadowPlane.receiveShadow=true;scene.add(shadowPlane);
  const iceGeometries=Array.from({length:4},(_,i)=>crystalGeometry(T,i));
  const pools=Array.from({length:4},(_,i)=>{const ice=new T.InstancedMesh(iceGeometries[i],crystalMaterial,36),chips=new T.InstancedMesh(iceGeometries[i],crystalMaterial,110),plates=new T.InstancedMesh(plateGeometry(T,i),crystalMaterial,30);ice.count=chips.count=plates.count=0;for(const mesh of [ice,chips,plates]){mesh.frustumCulled=false;mesh.castShadow=true;scene.add(mesh);}return {ice,chips,plates};});
  const groundPlanes=Array.from({length:3},()=>{const mesh=new T.Mesh(planeGeometry,groundMaterial.clone());mesh.material.uniforms={...uniforms,age:{value:0},groundStrength:{value:0}};mesh.visible=false;mesh.renderOrder=-2;scene.add(mesh);return mesh;});
  const fogTexture=bakeColdMist(T,renderer);
  const fogUniforms={...uniforms,mistMap:{value:fogTexture}};
  const fogMaterial=new T.ShaderMaterial({uniforms:fogUniforms,transparent:true,depthWrite:false,vertexShader:`attribute float mistFrame;attribute float mistOpacity;varying float vFrame;varying float vOpacity;varying vec2 vUv;varying vec3 vWorld;void main(){vFrame=mistFrame;vOpacity=mistOpacity;vUv=uv;vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.0);vWorld=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,fragmentShader:`${sharedFragment}uniform sampler2D mistMap;varying float vFrame;varying float vOpacity;varying vec2 vUv;void main(){${maskGLSL}float f=floor(vFrame);vec2 cell=vec2(mod(f,4.0),3.0-floor(f/4.0));vec4 mist=texture2D(mistMap,(cell+clamp(vUv,.012,.988))/4.0);gl_FragColor=vec4(mist.rgb,mist.a*vOpacity);#include <colorspace_fragment>}`});
  // Shader include directives must start a line.
  fogMaterial.fragmentShader=fogMaterial.fragmentShader.replace(';#include',';\n#include').replace('<colorspace_fragment>}', '<colorspace_fragment>\n}');
  const fogGeometry=new T.PlaneGeometry(1,1);fogGeometry.setAttribute('mistFrame',new T.InstancedBufferAttribute(new Float32Array(42),1));fogGeometry.setAttribute('mistOpacity',new T.InstancedBufferAttribute(new Float32Array(42),1));
  const fogMesh=new T.InstancedMesh(fogGeometry,fogMaterial,42);fogMesh.frustumCulled=false;fogMesh.count=0;fogMesh.renderOrder=4;scene.add(fogMesh);
  const wallMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:true});
  const wallMesh=new T.InstancedMesh(new T.BoxGeometry(38,44,38/FLOOR_COS),wallMaterial,468);wallMesh.frustumCulled=false;wallMesh.count=0;wallMesh.renderOrder=-5;scene.add(wallMesh);
  const dummy=new T.Object3D(),cached=new Map();let active=false,frameSettings={},lastHadEffects=false,lastFrame=0;
  const frameTimes=[],gpuQueries=[],timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const cameraQuaternion=camera.quaternion.clone();
  function place(mesh,index,x,y,height,sx,sy,sz,angle=0,lean=0){
    dummy.position.set(x-WIDTH/2,height,(y-HEIGHT/2)/FLOOR_COS);dummy.rotation.set(0,angle,lean);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
  }
  api.beginFrame=(events,{zoom=1,shakeX=0,shakeY=0,map=null}={})=>{
    const now=performance.now();if(lastFrame&&now-lastFrame<3000){frameTimes.push(now-lastFrame);if(frameTimes.length>120)frameTimes.shift();api.stats.fps=1000/(frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length);}lastFrame=now;
    active=events.some(e=>e.type==='mageCollapse'&&e.life>0);frameSettings={events,zoom,shakeX,shakeY,map};
    actorRecords.length=0;
    uniforms.zoom.value=zoom;uniforms.shake.value.set(shakeX*zoom,shakeY*zoom);
    const shift=collapseCameraShift(shakeX,shakeY);
    camera.zoom=zoom;camera.position.set(shift.x,800+shift.y,600+shift.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  };
  api.recordActor=(image,x,y,w,h,footY,transform,dirty=true)=>{
    if(!active||!transform||!image?.width)return;
    actorRecords.push({image,x,y,w,h,footY,transform,dirty});
  };
  api.captureFloor=()=>{
    if(!active||capturedMap===frameSettings.map)return;
    floorPaint.clearRect(0,0,WIDTH,HEIGHT);floorPaint.drawImage(sourceCanvas,0,0);sourceTexture.needsUpdate=true;capturedMap=frameSettings.map;
    uniforms.floorZoom.value=frameSettings.zoom;uniforms.floorShake.value.set(frameSettings.shakeX*frameSettings.zoom,frameSettings.shakeY*frameSettings.zoom);
  };
  const renderFrame=()=>{
    const start=performance.now();
    if(!active){if(lastHadEffects){renderer.clear();lastHadEffects=false;api.stats.crystals=api.stats.chips=api.stats.drawCalls=api.stats.triangles=0;}return;}
    lastHadEffects=true;
    // Refract the cached room floor, not a repeatedly copied screenshot of the
    // fight. Actor silhouettes and real mesh animation remain live every frame.
    const effects=frameSettings.events.filter(e=>e.type==='mageCollapse'&&e.life>0).slice(-3),counts=Array.from({length:4},()=>({ice:0,chips:0,plates:0}));let fogCount=0;
    for(const plane of groundPlanes)plane.visible=false;
    for(let ei=0;ei<effects.length;ei++){
      const event=effects[ei],age=Math.max(0,event.max-event.life),key=`${event.seed}:${event.radius||165}:${event.quality||0}`;
      if(!cached.has(key))cached.set(key,collapseLayout(event.radius||165,event.seed,event.quality));const layout=cached.get(key),state=collapsePhase(age);
      const floor=groundPlanes[ei];floor.visible=true;floor.position.set(event.x-520,1,(event.y-360)/FLOOR_COS);floor.scale.set(layout.radius,1,layout.radius/FLOOR_COS);floor.material.uniforms.age.value=age;floor.material.uniforms.groundStrength.value=state.ground;
      for(const crystal of layout.crystals){const pose=crystalPose(crystal,age);if(!pose.visible)continue;const index=counts[crystal.variant].ice++;place(pools[crystal.variant].ice,index,event.x+pose.x,event.y+pose.y,1,pose.width,pose.height,pose.depth,pose.angle,pose.lean);}
      for(const plate of layout.plates){const growth=smooth(plate.start,plate.start+.32,age)*(1-smooth(1.4,2.55,age));if(growth<.004)continue;const index=counts[plate.variant].plates++;place(pools[plate.variant].plates,index,event.x+plate.x,event.y+plate.y,.7,plate.width*growth,plate.height*growth,plate.depth*growth,plate.angle);}
      for(const chip of layout.chips){const pose=chipPose(chip,age);if(!pose.visible)continue;const index=counts[chip.variant].chips++;place(pools[chip.variant].chips,index,event.x+pose.x,event.y+pose.y,pose.height+1,pose.width,chip.height*pose.scale,pose.width*.6,pose.angle,pose.tilt);}
      for(let i=0;i<12&&fogCount<42;i++){
        const local=age-.64-i*.012;if(local<0||local>1.2)continue;const progress=clamp01(local/1.2),a=i*Math.PI*2/12;
        const distance=layout.radius*(.28+progress*.38),size=34+progress*49,opacity=.23*Math.sin(progress*Math.PI);
        dummy.position.set(event.x-520+Math.cos(a)*distance,5+progress*7,(event.y-360+Math.sin(a)*distance)/FLOOR_COS);dummy.quaternion.copy(cameraQuaternion);dummy.scale.set(size,size*.52,1);dummy.updateMatrix();fogMesh.setMatrixAt(fogCount,dummy.matrix);
        fogGeometry.attributes.mistFrame.array[fogCount]=Math.min(15,progress*15);fogGeometry.attributes.mistOpacity.array[fogCount]=opacity;fogCount++;
      }
    }
    for(const [i,pool] of pools.entries())for(const name of ['ice','chips','plates']){pool[name].count=counts[i][name];pool[name].instanceMatrix.needsUpdate=true;}
    fogMesh.count=fogCount;fogMesh.instanceMatrix.needsUpdate=true;fogGeometry.attributes.mistFrame.needsUpdate=true;fogGeometry.attributes.mistOpacity.needsUpdate=true;
    const focus=effects[0];keyLight.position.set(focus.x-520-170,320,(focus.y-360)/FLOOR_COS+190);keyLight.target.position.set(focus.x-520,0,(focus.y-360)/FLOOR_COS);
    const left=Math.min(...effects.map(e=>e.x-e.radius-70)),right=Math.max(...effects.map(e=>e.x+e.radius+70)),top=Math.min(...effects.map(e=>e.y-e.radius-110)),bottom=Math.max(...effects.map(e=>e.y+e.radius+110));
    shadowPlane.position.set((left+right)/2-520,.5,((top+bottom)/2-360)/FLOOR_COS);shadowPlane.scale.set(right-left,(bottom-top)/FLOOR_COS,1);
    let wallCount=0;if(frameSettings.map)for(let y=0;y<frameSettings.map.length;y++)for(let x=0;x<frameSettings.map[y].length;x++)if(frameSettings.map[y][x]){place(wallMesh,wallCount++,x*40+20,y*40+20,22,1,1,1);}wallMesh.count=wallCount;wallMesh.instanceMatrix.needsUpdate=true;
    if(timer&&gpuQueries.length&&gl.getQueryParameter(gpuQueries[0],gl.QUERY_RESULT_AVAILABLE)){const query=gpuQueries.shift();if(!gl.getParameter(timer.GPU_DISJOINT_EXT))api.stats.gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);}
    const query=timer&&gpuQueries.length<5?gl.createQuery():null;
    if(query)gl.beginQuery(timer.TIME_ELAPSED_EXT,query);
    const maskCalls=drawActorMask();
    renderer.render(scene,camera);
    if(query){gl.endQuery(timer.TIME_ELAPSED_EXT);gpuQueries.push(query);}
    if(!api.ready){renderer.clear();return;}
    const cpuMs=performance.now()-start;
    api.stats={...api.stats,crystals:counts.reduce((n,c)=>n+c.ice,0),chips:counts.reduce((n,c)=>n+c.chips,0),drawCalls:renderer.info.render.calls+maskCalls,triangles:renderer.info.render.triangles,cpuMs,peakCpuMs:Math.max(api.stats.peakCpuMs,cpuMs)};
    const living=new Set(effects.map(e=>`${e.seed}:${e.radius||165}:${e.quality||0}`));for(const key of cached.keys())if(!living.has(key))cached.delete(key);
  };
  api.render=()=>{try{renderFrame();}catch(error){api.failed=true;api.ready=false;renderer.clear();console.error('立体冰晶绘制失败，切回原技能且保持游戏运行：',error);}};
  api.clear=()=>{cached.clear();renderer.clear();lastHadEffects=false;};
  api.ready=true;canvas.dataset.build=MAGE_COLLAPSE_BUILD;canvas.dataset.renderer='three-real-mesh-hybrid';
}

function crystalGeometry(T,variant){
  const positions=[],uvs=[],rings=[0,.09,.73,1.08],outline=[];
  outline.push([1,-.42],[.64,-.72],[-.64,-.72],[-1,-.42],[-1,.42],[-.64,.72],[.64,.72],[1,.42]);
  outline.reverse();const sides=outline.length;
  const points=rings.map((height,ri)=>outline.map(([x,z],i)=>{
    const taper=[.96,1,.84,.008][ri],bend=height*height*(.11+variant*.055),ridge=(i%3===0?1.05:.95);
    const crown=ri===2?.07*Math.cos(i*Math.PI/4+variant):0;
    return [x*taper*ridge+bend,height+crown,z*taper*ridge-height*.035];
  }));
  function triangle(a,b,c,ua,ub,uc){positions.push(...a,...b,...c);uvs.push(...ua,...ub,...uc);}
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<sides;i++){
    const j=(i+1)%sides,a=points[r][i],b=points[r][j],c=points[r+1][j],d=points[r+1][i];
    triangle(a,c,b,[0,rings[r]],[1,rings[r+1]],[1,rings[r]]);triangle(a,d,c,[0,rings[r]],[0,rings[r+1]],[1,rings[r+1]]);
  }
  for(let i=0;i<sides;i++){const j=(i+1)%sides;triangle([0,0,0],points[0][i],points[0][j],[.5,0],[0,0],[1,0]);triangle([.11+variant*.055,1.081,-.035],points[3][j],points[3][i],[.5,1],[1,1],[0,1]);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

function plateGeometry(T,variant){
  const positions=[],uvs=[],points=Array.from({length:6},(_,i)=>{const a=i*Math.PI/3+.18*variant,r=.7+.21*Math.sin(i*4.7+variant);return [Math.cos(a)*r,Math.sin(a)*r];});
  const vertex=(p,y)=>{positions.push(p[0],y,p[1]);uvs.push(p[0]*.5+.5,p[1]*.5+.5);};
  for(let i=0;i<6;i++){const a=points[i],b=points[(i+1)%6],aa=a.map(v=>v*.87),bb=b.map(v=>v*.87);vertex([.05,.04],1);vertex(bb,.75);vertex(aa,.75);vertex(aa,.75);vertex(bb,.75);vertex(a,0);vertex(a,0);vertex(bb,.75);vertex(b,0);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

// Original coherent cold-vapour source animation is baked once into a 16-frame
// RGBA GPU atlas. There is no generated white/checkerboard background to key out.
function bakeColdMist(T,renderer){
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
  const material=new T.ShaderMaterial({transparent:false,uniforms:{phase:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,fragmentShader:`
    varying vec2 vUv;uniform float phase;
    float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    void main(){vec2 uv=(vUv-.5)*2.0;float density=0.0;for(int i=0;i<9;i++){float z=-.8+float(i)*.2;vec3 p=vec3(uv,z);float envelope=max(0.0,1.0-length(p*vec3(1.05,1.3,.9)));float n=noise(p*4.0+vec3(phase*.7,phase*.4,-phase*.25))*.7+noise(p*9.0+vec3(0,phase,0))*.3;density+=max(0.0,n-.38)*envelope;}float alpha=1.0-exp(-density*1.5);vec3 col=mix(vec3(.13,.3,.42),vec3(.53,.74,.83),clamp(density,0.0,1.0));gl_FragColor=vec4(col,alpha);}
  `});scene.add(new T.Mesh(new T.PlaneGeometry(2,2),material));
  const target=new T.WebGLRenderTarget(512,512,{format:T.RGBAFormat,depthBuffer:false});target.texture.colorSpace=T.LinearSRGBColorSpace;
  renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.setScissorTest(true);
  for(let frame=0;frame<16;frame++){const x=frame%4*128,y=(3-Math.floor(frame/4))*128;renderer.setViewport(x,y,128,128);renderer.setScissor(x,y,128,128);material.uniforms.phase.value=frame/15*1.8;renderer.render(scene,camera);}
  renderer.setScissorTest(false);renderer.setRenderTarget(null);renderer.setViewport(0,0,WIDTH,HEIGHT);material.dispose();scene.children[0].geometry.dispose();
  return target.texture;
}
