import * as THREE from './vendor/three.module.js?v=archive-20261109-layout-1';
import { GLTFLoader } from './vendor/GLTFLoader.js?v=archive-20261109-layout-1';
import { createGlassStudio } from './studio.js?v=archive-20261109-layout-1';
import { createExhibitionRoom } from './exhibition-room.js?v=archive-20261109-layout-1';
import { RectAreaLightUniformsLib } from './vendor/RectAreaLightUniformsLib.js?v=archive-20261109-layout-1';
import { HDRLoader } from './vendor/HDRLoader.js?v=archive-20261109-layout-1';

let areaLightUsers=0;
function retainAreaLights(){if(areaLightUsers++===0)RectAreaLightUniformsLib.init();}
function releaseAreaLights(){if(--areaLightUsers===0)for(const key of ['LTC_FLOAT_1','LTC_FLOAT_2','LTC_HALF_1','LTC_HALF_2']){THREE.UniformsLib[key]?.dispose();}}

const ids = ['campus', 'internships', 'projects', 'outlook'];
const noteIds = ['trunk', 'roots'];
const anchorIds = [...ids,...noteIds];
const labels = ['01 校园', '02 实习', '03 项目', '未来'];
const here = name => new URL(name, import.meta.url).href;

// Fetch both heavy resources concurrently, while keeping cancellation and deadlines
// attached to the actual requests rather than only to a Promise.race timer.
async function fetchBuffer(url, {signal,timeoutMs,asset,onProgress}) {
  const request=new AbortController();
  const cancel=()=>request.abort(signal.reason||new DOMException('Tree loading cancelled','AbortError'));
  if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});
  const timeout=setTimeout(()=>request.abort(new DOMException(`${asset} load timed out`,'TimeoutError')),timeoutMs);
  let reader;
  try{
    const response=await fetch(url,{signal:request.signal});
    if(!response.ok)throw new Error(`${asset} HTTP ${response.status}`);
    // Fetch exposes decoded bytes, while Content-Length can describe gzip/br bytes.
    const encoding=response.headers.get('content-encoding')?.trim().toLowerCase();
    const total=encoding&&encoding!=='identity'?0:Number(response.headers.get('content-length'))||0;
    if(!response.body){const buffer=await response.arrayBuffer();onProgress?.({asset,loaded:buffer.byteLength,total:total||buffer.byteLength,ratio:1});return buffer;}
    reader=response.body.getReader();const chunks=[];let loaded=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;onProgress?.({asset,loaded,total,ratio:total?Math.min(1,loaded/total):null});}
    const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    onProgress?.({asset,loaded,total:total||loaded,ratio:1});return bytes.buffer;
  }catch(error){throw request.signal.aborted?request.signal.reason:error;}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',cancel);reader?.releaseLock();}
}
function disposeObject(object){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  object?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.morphTexture)textures.add(o.morphTexture);if(o.isInstancedMesh)o.dispose();for(const m of [].concat(o.material||[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
function parseModel(buffer,url,signal){
  // GLB parsing cannot be interrupted mid-task; release a late result after abort.
  return new Promise((resolve,reject)=>{
    let cancelled=signal.aborted;
    const cancel=()=>{cancelled=true;reject(signal.reason||new DOMException('Tree loading cancelled','AbortError'));};
    if(cancelled){cancel();return;}signal.addEventListener('abort',cancel,{once:true});
    new GLTFLoader().parseAsync(buffer,new URL('.',url).href).then(gltf=>{signal.removeEventListener('abort',cancel);if(cancelled){disposeObject(gltf.scene);return;}resolve(gltf);},error=>{signal.removeEventListener('abort',cancel);reject(error);});
  });
}
function parseEnvironment(buffer){
  const data=new HDRLoader().parse(buffer);
  const texture=new THREE.DataTexture(data.data,data.width,data.height,THREE.RGBAFormat,data.type);
  texture.colorSpace=THREE.LinearSRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;texture.flipY=true;texture.needsUpdate=true;return texture;
}

/** All anchor coordinates are relative to container. No global CSS or imports needed. */
export async function createTree(container, options = {}) {
  const palette = {bg:'#ffffff', ink:'#234236', accent:'#a6dfb6', line:'#91aa9c', ...options.palette};
  const selectionColor=new THREE.Color(options.selectionColor||'#9cddb3');
  let reduced = options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.createElement('div'); root.className='tree-v4';
  Object.assign(root.style,{position:'relative',width:'100%',height:'100%',minHeight:'280px',overflow:'hidden',background:palette.bg});
  container.append(root);
  const abort = new AbortController(), signal=abort.signal, networkAbort=new AbortController();
  let disposed=false, failed=false, paused=false, selected=null, hovered=false, focused=false, dragging=null, manualYaw=0, raf=0, elapsed=reduced?3.2:0, renderedFrames=0;
  let wake=()=>{},drawRaf=0,frameWindowStart=performance.now();
  function stopLoop(){cancelAnimationFrame(raf);raf=0;}
  function pauseMotion(){paused=true;stopLoop();stats.paused=true;}
  function resumeMotion(){paused=false;stats.paused=false;wake();}
  function requestDraw(){if(!drawRaf&&!disposed&&!failed)drawRaf=requestAnimationFrame(()=>{drawRaf=0;draw();});}
  let renderer, scene, camera, model, mixer, growth, orbit, envTarget,backdrop,pmrem,areaLightsRetained=false,gpuReleased=false;
  const externalLights=[];
  const picks=[], materials=new Set(), meshes=[], anchors={}, buttons=[];
  const stats={ready:false,renderer:'pending',leafCount:0,groups:{},animations:[],fps:0,drawCalls:0,triangles:0,selected:null,paused:false,yaw:0,errors:[]};
  function notify(callback,value){try{callback?.(value);}catch(error){stats.errors.push('Host callback: '+String(error));}}
  function state(name,extra={}){stats.state=name;notify(options.onState,{state:name,...extra});}
  function progress(value){stats.progress={...stats.progress,[value.asset]:value};notify(options.onProgress,value);}
  // Keep the glass silhouette clear of the surrounding cards; model data stays intact.
  const presentationScale=options.presentationScale??.75;
  stats.presentationScale=presentationScale;
  const fullView={height:(options.viewHeight||1.76)/presentationScale,width:(options.viewWidth||1.54)/presentationScale,center:options.viewCenter||[0,.40,0]};
  let view=fullView;
  const status=document.createElement('span'); status.textContent='正在载入成长之树…';
  Object.assign(status.style,{position:'absolute',left:'20px',bottom:'20px',font:'12px sans-serif',color:palette.ink}); root.append(status);
  function emitSelect(id, notify=true){
    if (id!==null && !ids.includes(id)) throw new RangeError('Unknown tree id: '+id);
    selected=id; stats.selected=id;if(id!==null)pauseMotion();
    for(const m of meshes){
      const active=m.userData.section===id && id!==null;
      if(m.material.color&&m.userData.restColor){m.material.color.copy(m.userData.restColor);if(active&&!m.userData.glass)m.material.color.lerp(selectionColor,.62);}
      if(m.material.emissive){m.material.emissive.copy(active?selectionColor:new THREE.Color(0));m.material.emissiveIntensity=active?(m.userData.glass?0.035:(m.isInstancedMesh?.16:.09)):0;}
    }
    for(const [i,b] of buttons.entries()) {b.setAttribute('aria-pressed',String(ids[i]===id));b.style.background=ids[i]===id?palette.accent:palette.bg;b.style.color=ids[i]===id?'#153729':palette.ink;}
    draw(); if(notify)options.onSelect?.(id);
  }
  function updateAnchors(){
    if(!model)return;
    model.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const projected={};
    for(const id of anchorIds){
      const a=anchors[id]; if(!a){projected[id]={u:.5,v:.5,visible:false};continue;}
      const p=a.getWorldPosition(new THREE.Vector3()).project(camera);
      projected[id]={u:(p.x+1)/2,v:(1-p.y)/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&elapsed>2.1};
    }
    stats.anchors=projected;options.onAnchors?.(projected);
  }
  function syncMorphs(){for(const o of meshes)if(o.isInstancedMesh&&o.morphTargetInfluences){for(let i=0;i<o.count;i++)o.setMorphAt(i,o);o.morphTexture.needsUpdate=true;}}
  function draw(){if(disposed||failed||!renderer||!model)return false;try{if(renderer.getContext().isContextLost())throw new Error('WebGL context lost');updateAnchors();renderer.render(scene,camera);if(renderer.getContext().isContextLost())throw new Error('WebGL context lost');renderedFrames++;const now=performance.now();if(now-frameWindowStart>=1000){stats.fps=Math.round(renderedFrames*1000/(now-frameWindowStart));renderedFrames=0;frameWindowStart=now;}stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;stats.yaw=model.rotation.y;stats.paused=paused;return true;}catch(error){stats.errors.push(String(error));fallback('图形已暂停，可继续选择内容',renderer.getContext().isContextLost()?'context-lost':'render-error');return false;}}
  function resize(){if(!renderer||disposed||failed||!camera)return false;const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);renderer.setSize(w,h,false);backdrop?.resize(w,h);const aspect=w/h,v=Math.max(view.height,view.width/aspect);camera.aspect=aspect;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(v/(2*Math.hypot(.08,.20,3))));camera.updateProjectionMatrix();return draw();}
  function releaseGPU(){if(gpuReleased)return;gpuReleased=true;stopLoop();cancelAnimationFrame(drawRaf);drawRaf=0;mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);disposeObject(scene);materials.forEach(m=>m.dispose());envTarget?.dispose();pmrem?.dispose();backdrop?.dispose();if(areaLightsRetained){releaseAreaLights();areaLightsRetained=false;}renderer?.dispose();renderer?.forceContextLoss();}
  function dispose(){if(disposed)return;disposed=true;stats.ready=false;networkAbort.abort(new DOMException('Tree loading cancelled','AbortError'));abort.abort();observer.disconnect();options.signal?.removeEventListener('abort',cancelFromHost);releaseGPU();root.remove();}
  function cancelFromHost(){if(disposed)return;dispose();state('cancelled',{reason:'aborted'});}
  const observer=new ResizeObserver(resize);observer.observe(container);
  const api={select:id=>emitSelect(id,false),pause:pauseMotion,resume:resumeMotion,resize,dispose,
    // Called by A's motion driver: avoid cloning geometry/anchor diagnostics every frame.
    getMotionState:()=>({ready:stats.ready,elapsed,yaw:model?.rotation.y||0,dragging:!!dragging,paused,reducedMotion:reduced,hovered,focused}),
    getStats:()=>structuredClone({...stats,elapsed,paused,hovered,focused,dragging:!!dragging,animationFramePending:!!raf,drawFramePending:!!drawRaf,fps:performance.now()-frameWindowStart>1500?0:stats.fps,mixerTime:mixer?.time,morph:meshes.find(o=>o.isInstancedMesh)?.morphTargetInfluences}),
    setReducedMotion(value){reduced=!!value;if(reduced&&elapsed>=3.2)stopLoop();else wake();},
    setView(name){view=name==='detail'?{height:.63,width:.72,center:[-.20,.66,.02]}:fullView;if(camera){const c=view.center;camera.position.set(c[0]+.08,c[1]-.08,c[2]+3);camera.lookAt(...c);resize();}},
    setLighting(enabled){for(const light of externalLights)light.intensity=enabled?light.userData.power:0;stats.externalLighting=!!enabled;draw();},
    setAngle(deg){if(!Number.isFinite(deg))return;manualYaw=THREE.MathUtils.degToRad(deg);if(!model||Math.abs(model.rotation.y-manualYaw)<1e-7)return;model.rotation.y=manualYaw;draw();},
    replay(){elapsed=0;paused=false;manualYaw=0;emitSelect(null,false);growth?.reset().play();wake();},
    seek(time){elapsed=time;if(growth){growth.reset().play();mixer.setTime(Math.min(time,stats.animations[0]?.duration||2.2));syncMorphs();}if(model)model.rotation.y=manualYaw;draw();}
  };
  for(const [i,id] of ids.entries()){
    const b=document.createElement('button');b.type='button';b.textContent=labels[i];b.setAttribute('aria-pressed','false');
    Object.assign(b.style,{border:`1px solid ${palette.line}`,padding:'8px 11px',background:palette.bg,color:palette.ink,font:'12px sans-serif',cursor:'pointer'});
    b.addEventListener('click',()=>emitSelect(id),{signal});buttons.push(b);
  }
  const nav=document.createElement('nav');nav.setAttribute('aria-label','树的内容入口');
  Object.assign(nav.style,{position:'absolute',bottom:'12px',left:'50%',transform:'translateX(-50%)',display:options.showControls===false?'none':'flex',gap:'5px',whiteSpace:'nowrap',zIndex:'2'});nav.append(...buttons);root.append(nav);
  if(options.signal?.aborted){cancelFromHost();return api;}
  options.signal?.addEventListener('abort',cancelFromHost,{once:true});
  state('loading');
  if(disposed)return api;
  try{
    const modelUrl=new URL(options.assetUrl||here('growth-tree-cut.glb'),document.baseURI).href;
    // Settle immediately so either parallel failure can never become an unhandled rejection.
    const settled=promise=>promise.then(value=>({value}),error=>({error}));
    const modelRequest=settled(fetchBuffer(modelUrl,{signal:networkAbort.signal,timeoutMs:options.loadTimeoutMs??45000,asset:'model',onProgress:progress}).catch(error=>{networkAbort.abort(error);throw error;}));
    const environmentRequest=settled(fetchBuffer(here('studio-light.hdr'),{signal:networkAbort.signal,timeoutMs:options.hdrTimeoutMs??8000,asset:'environment',onProgress:progress}));
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(disposed||failed)return;stats.errors.push('WebGL context lost');fallback('图形已暂停，可继续选择内容','context-lost');},{signal});
    renderer.setPixelRatio(Math.min(devicePixelRatio, options.pixelRatio||1.5));renderer.setClearColor(palette.bg);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label','可拖动旋转的成长之树');renderer.domElement.tabIndex=0;
    Object.assign(renderer.domElement.style,{display:'block',width:'100%',height:'100%',touchAction:'pan-y'});root.prepend(renderer.domElement);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.01,10);const center=options.viewCenter||[0,.40,0];camera.position.set(center[0]+.08,center[1]-.08,center[2]+3);camera.lookAt(...center);
    const edgeBlend=options.edgeBlend??options.showControls===false;
    if(options.background!=='solid')scene.add(createExhibitionRoom({blendColor:edgeBlend?palette.bg:null}));stats.background=options.background==='solid'?'solid':'white-gallery';stats.edgeBlend=!!edgeBlend;stats.groundShadow=false;stats.lighting='neutral studio softboxes';stats.glass='clear solid glass';
    const [modelResult,environmentResult]=await Promise.all([modelRequest,environmentRequest]);
    if(disposed||failed)return api;if(modelResult.error)throw modelResult.error;
    pmrem=new THREE.PMREMGenerator(renderer);
    try{if(environmentResult.error)throw environmentResult.error;const hdr=parseEnvironment(environmentResult.value);try{envTarget=pmrem.fromEquirectangular(hdr);}finally{hdr.dispose();}stats.environment='photographic studio HDR';}
    catch{const room=createGlassStudio();try{envTarget=pmrem.fromScene(room,.005);}finally{room.dispose();}stats.environment='procedural studio fallback';}
    scene.environment=envTarget.texture;scene.environmentRotation.y=Math.PI*.35;pmrem.dispose();pmrem=null;
    scene.environmentIntensity=.65;scene.add(new THREE.HemisphereLight(0xffffff,0xa0aaa7,.35));
    const light=new THREE.DirectionalLight(0xffffff,1.8);light.position.set(-.8,3,1);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-1,right:1,top:1.5,bottom:-1,near:.1,far:7});light.shadow.bias=-.0003;light.shadow.radius=3;scene.add(light);
    const fill=new THREE.DirectionalLight(0xe4eeeb,.7);fill.position.set(1,1,-1);scene.add(fill);
    retainAreaLights();areaLightsRetained=true;
    for(const [position,size,power] of [[[-1.05,1.25,1.45],[.75,1.55],3.2],[[1.0,.8,-.55],[.42,1.25],1.6]]){
      const area=new THREE.RectAreaLight(0xffffff,power,...size);area.position.set(...position);area.lookAt(0,.48,0);area.userData.power=power;scene.add(area);externalLights.push(area);
    }
    stats.externalLighting=true;
    const wallFill=new THREE.RectAreaLight(0xffffff,2.0,2.4,1.5);wallFill.position.set(0,.65,-.7);wallFill.lookAt(0,.65,-1.15);scene.add(wallFill);
    // User removed the ground projection; self-shadowing remains on the tree.
    const gltf=await parseModel(modelResult.value,modelUrl,networkAbort.signal);
    if(disposed||failed){disposeObject(gltf.scene);return api;}
    model=gltf.scene;scene.add(model);stats.animations=gltf.animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks.length}));
    model.traverse(o=>{
      if(o.name.startsWith('anchor')){const id=anchorIds.find(id=>o.name.endsWith(id));if(id)anchors[id]=o;}
      if(!o.isMesh)return;
      let group=o;while(group&&!group.userData.group)group=group.parent;
      let metadata=o;while(metadata&&!metadata.userData.glass)metadata=metadata.parent;
      if(metadata){o.userData.glass=true;o.userData.section=metadata.userData.section;}
      o.userData.section=o.userData.section||(group?.userData.group==='stem'?(o.isInstancedMesh?'outlook':undefined):group?.userData.group);
      materials.add(o.material);o.material=o.material.clone();materials.add(o.material);meshes.push(o);
      if(o.userData.glass){
        // A single photographic response keeps transmitted leaves from clipping.
        o.material.toneMapped=true;
        o.material.envMapIntensity=.85;
        const pane=o.material.name.includes('optical panels');if(pane){o.material.transparent=false;o.material.depthWrite=true;}
      }
      o.userData.restColor=o.material.color?.clone();
      if(!o.userData.glass){o.material.opacity=1;o.material.transparent=false;o.material.depthWrite=true;}
      o.castShadow=!o.userData.glass;o.receiveShadow=!o.userData.glass;if(o.userData.glass&&o.material.transparent)o.material.depthWrite=false;
      if(o.isInstancedMesh){stats.leafCount+=o.count;const g=group?.userData.group||'unknown';stats.groups[g]=(stats.groups[g]||0)+o.count;
        // InstancedMesh uses a texture for per-instance morph weights in Three r180.
        o.updateMorphTargets();if(o.morphTargetInfluences){for(let i=0;i<o.count;i++)o.setMorphAt(i,o);o.morphTexture.needsUpdate=true;}
      }
      if(ids.includes(o.userData.section))picks.push(o);
    });
    mixer=new THREE.AnimationMixer(model);growth=gltf.animations.find(a=>a.name==='01 Growth');
    if(growth){growth=mixer.clipAction(growth);growth.setLoop(THREE.LoopOnce,1);growth.clampWhenFinished=true;growth.play();}
    orbit=gltf.animations.find(a=>a.name==='02 Orbit A');
    if(reduced){mixer.setTime(2.2);syncMorphs();}
    stats.renderer=renderer.getContext().getParameter(renderer.getContext().RENDERER);if(!resize())return api;
    stats.ready=true;status.remove();state('ready');if(disposed||failed)return api;
    const raycaster=new THREE.Raycaster();
    const pick=e=>{const rect=renderer.domElement.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;
      const near=anchorIds.map(id=>({id,a:stats.anchors?.[id]})).filter(p=>p.a?.visible).map(p=>({...p,d:Math.hypot(x-p.a.u*rect.width,y-p.a.v*rect.height)})).sort((a,b)=>a.d-b.d)[0];
      if(near&&near.d<=22){if(noteIds.includes(near.id)){pauseMotion();options.onNoteSelect?.(near.id);draw();}else emitSelect(near.id);return;}
      raycaster.setFromCamera(new THREE.Vector2(x/rect.width*2-1,-y/rect.height*2+1),camera);const hit=raycaster.intersectObjects(picks,false)[0];if(hit)emitSelect(hit.object.userData.section);};
    renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging={x:e.clientX,y:e.clientY,yaw:model.rotation.y,moved:false,pointerId:e.pointerId};stopLoop();renderer.domElement.setPointerCapture(e.pointerId);},{signal});
    renderer.domElement.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragging.pointerId)return;const dx=e.clientX-dragging.x;if(Math.abs(dx)>4)dragging.moved=true;if(dragging.moved){manualYaw=dragging.yaw+dx*.008;model.rotation.y=manualYaw;requestDraw();}},{signal});
    const endDrag=()=>{dragging=null;wake();};
    renderer.domElement.addEventListener('pointerup',e=>{if(!dragging||e.pointerId!==dragging.pointerId)return;const click=!dragging.moved;dragging=null;if(click)pick(e);if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);wake();},{signal});
    renderer.domElement.addEventListener('pointercancel',endDrag,{signal});
    renderer.domElement.addEventListener('lostpointercapture',endDrag,{signal});
    root.addEventListener('pointerenter',()=>{hovered=true;},{signal});root.addEventListener('pointerleave',()=>{hovered=false;},{signal});
    root.addEventListener('focusin',()=>{focused=true;},{signal});root.addEventListener('focusout',e=>{focused=root.contains(e.relatedTarget);},{signal});
    renderer.domElement.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();api.setAngle(THREE.MathUtils.radToDeg(model.rotation.y)+(e.key==='ArrowLeft'?-5:5));}if(e.key==='Escape')emitSelect(null);if(e.key===' '){e.preventDefault();if(!e.repeat){if(options.onToggleMotion)options.onToggleMotion();else if(paused)resumeMotion();else pauseMotion();}}},{signal});
    let last=performance.now();
    const shouldAnimate=()=>!disposed&&!failed&&!document.hidden&&!paused&&!dragging&&(elapsed<3.2||!reduced);
    function tick(now){raf=0;if(!shouldAnimate())return;const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
      if(shouldAnimate()){
        const prev=elapsed;elapsed+=dt;
        if(prev<2.3){mixer.update(Math.max(0,Math.min(dt,2.2-mixer.time)));syncMorphs();}
        if(elapsed>3.2)model.rotation.y=manualYaw+Math.sin((elapsed-3.2)*Math.PI/10)*THREE.MathUtils.degToRad(25);
        draw();
      }
      if(shouldAnimate()&&!raf)raf=requestAnimationFrame(tick);
    }
    wake=()=>{if(shouldAnimate()&&!raf){last=performance.now();raf=requestAnimationFrame(tick);}};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopLoop();else wake();},{signal});
    wake();
  }catch(error){if(disposed||failed)return api;stats.errors.push(String(error));fallback('三维图形未能载入，可继续选择内容',error?.name==='TimeoutError'?'timeout':'load-error');}
  function fallback(message,reason='load-error'){if(disposed||failed)return;failed=true;stats.ready=false;networkAbort.abort(new DOMException('Tree loading stopped','AbortError'));observer.disconnect();renderer?.domElement.remove();releaseGPU();status.textContent=message;root.append(status);const img=document.createElement('img');img.src=here('fallback.png');img.alt='成长之树静态图';Object.assign(img.style,{width:'100%',height:'100%',objectFit:'contain'});root.prepend(img);nav.style.display='flex';notify(options.onAnchors,Object.fromEntries(anchorIds.map(id=>[id,{u:.5,v:.5,visible:false}])));state('error',{reason,message});}
  return api;
}
