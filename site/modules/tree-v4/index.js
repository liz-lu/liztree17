import * as THREE from './vendor/three.module.js?v=archive-20261105-1';
import { GLTFLoader } from './vendor/GLTFLoader.js?v=archive-20261105-1';
import { createGlassStudio } from './studio.js?v=archive-20261105-1';
import { createExhibitionRoom } from './exhibition-room.js?v=archive-20261105-1';
import { RectAreaLightUniformsLib } from './vendor/RectAreaLightUniformsLib.js?v=archive-20261105-1';
import { HDRLoader } from './vendor/HDRLoader.js?v=archive-20261105-1';

let areaLightUsers=0;
function retainAreaLights(){if(areaLightUsers++===0)RectAreaLightUniformsLib.init();}
function releaseAreaLights(){if(--areaLightUsers===0)for(const key of ['LTC_FLOAT_1','LTC_FLOAT_2','LTC_HALF_1','LTC_HALF_2']){THREE.UniformsLib[key]?.dispose();}}

const ids = ['campus', 'internships', 'projects', 'outlook'];
const noteIds = ['trunk', 'roots'];
const anchorIds = [...ids,...noteIds];
const labels = ['01 校园', '02 实习', '03 项目', '未来'];
const here = name => new URL(name, import.meta.url).href;

/** All anchor coordinates are relative to container. No global CSS or imports needed. */
export async function createTree(container, options = {}) {
  const palette = {bg:'#ffffff', ink:'#234236', accent:'#a6dfb6', line:'#91aa9c', ...options.palette};
  const selectionColor=new THREE.Color(options.selectionColor||'#9cddb3');
  const reduced = options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.createElement('div'); root.className='tree-v4';
  Object.assign(root.style,{position:'relative',width:'100%',height:'100%',minHeight:'280px',overflow:'hidden',background:palette.bg});
  container.append(root);
  const abort = new AbortController(), signal=abort.signal;
  let disposed=false, failed=false, paused=false, selected=null, hovered=false, focused=false, dragging=null, manualYaw=0, raf=0, elapsed=reduced?3.2:0, renderedFrames=0;
  let renderer, scene, camera, model, mixer, growth, orbit, envTarget,backdrop,areaLightsRetained=false;
  const externalLights=[];
  const picks=[], materials=new Set(), meshes=[], anchors={}, buttons=[];
  const stats={ready:false,renderer:'pending',leafCount:0,groups:{},animations:[],fps:0,drawCalls:0,triangles:0,selected:null,paused:false,yaw:0,errors:[]};
  // Keep the glass silhouette clear of the surrounding cards; model data stays intact.
  const presentationScale=options.presentationScale??.75;
  stats.presentationScale=presentationScale;
  const fullView={height:(options.viewHeight||1.76)/presentationScale,width:(options.viewWidth||1.54)/presentationScale,center:options.viewCenter||[0,.40,0]};
  let view=fullView;
  const status=document.createElement('span'); status.textContent='正在载入成长之树…';
  Object.assign(status.style,{position:'absolute',left:'20px',bottom:'20px',font:'12px sans-serif',color:palette.ink}); root.append(status);
  function emitSelect(id, notify=true){
    if (id!==null && !ids.includes(id)) throw new RangeError('Unknown tree id: '+id);
    selected=id; stats.selected=id;if(id!==null)paused=true;
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
  function draw(){if(disposed||failed||!renderer||!model)return;updateAnchors();renderer.render(scene,camera);renderedFrames++;stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;stats.yaw=model.rotation.y;stats.paused=paused||hovered||focused;}
  function resize(){if(!renderer||disposed)return;const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);renderer.setSize(w,h,false);backdrop?.resize(w,h);const aspect=w/h,v=Math.max(view.height,view.width/aspect);camera.aspect=aspect;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(v/(2*Math.hypot(.08,.20,3))));camera.updateProjectionMatrix();draw();}
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);abort.abort();observer.disconnect();mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);const geometries=new Set(),textures=new Set();scene?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.morphTexture)textures.add(o.morphTexture);if(o.isInstancedMesh)o.dispose();for(const m of [].concat(o.material||[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());envTarget?.dispose();backdrop?.dispose();if(areaLightsRetained)releaseAreaLights();renderer?.dispose();renderer?.forceContextLoss();root.remove();}
  const observer=new ResizeObserver(resize);observer.observe(container);
  const api={select:id=>emitSelect(id,false),pause(){paused=true;draw();},resume(){paused=false;draw();},resize,dispose,
    getStats:()=>structuredClone({...stats,elapsed,paused,hovered,focused,mixerTime:mixer?.time,morph:meshes.find(o=>o.isInstancedMesh)?.morphTargetInfluences}),
    setView(name){view=name==='detail'?{height:.63,width:.72,center:[-.20,.66,.02]}:fullView;if(camera){const c=view.center;camera.position.set(c[0]+.08,c[1]-.08,c[2]+3);camera.lookAt(...c);resize();}},
    setLighting(enabled){for(const light of externalLights)light.intensity=enabled?light.userData.power:0;stats.externalLighting=!!enabled;draw();},
    setAngle(deg){manualYaw=THREE.MathUtils.degToRad(deg);if(model)model.rotation.y=manualYaw;draw();},
    replay(){elapsed=0;paused=false;manualYaw=0;emitSelect(null,false);growth?.reset().play();},
    seek(time){elapsed=time;if(growth){growth.reset().play();mixer.setTime(Math.min(time,stats.animations[0]?.duration||2.2));syncMorphs();}model.rotation.y=manualYaw;draw();}
  };
  for(const [i,id] of ids.entries()){
    const b=document.createElement('button');b.type='button';b.textContent=labels[i];b.setAttribute('aria-pressed','false');
    Object.assign(b.style,{border:`1px solid ${palette.line}`,padding:'8px 11px',background:palette.bg,color:palette.ink,font:'12px sans-serif',cursor:'pointer'});
    b.addEventListener('click',()=>emitSelect(id),{signal});buttons.push(b);
  }
  const nav=document.createElement('nav');nav.setAttribute('aria-label','树的内容入口');
  Object.assign(nav.style,{position:'absolute',bottom:'12px',left:'50%',transform:'translateX(-50%)',display:options.showControls===false?'none':'flex',gap:'5px',whiteSpace:'nowrap',zIndex:'2'});nav.append(...buttons);root.append(nav);
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, options.pixelRatio||1.5));renderer.setClearColor(palette.bg);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label','可拖动旋转的成长之树');renderer.domElement.tabIndex=0;
    Object.assign(renderer.domElement.style,{display:'block',width:'100%',height:'100%',touchAction:'pan-y'});root.prepend(renderer.domElement);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.01,10);const center=options.viewCenter||[0,.40,0];camera.position.set(center[0]+.08,center[1]-.08,center[2]+3);camera.lookAt(...center);
    const edgeBlend=options.edgeBlend??options.showControls===false;
    if(options.background!=='solid')scene.add(createExhibitionRoom({blendColor:edgeBlend?palette.bg:null}));stats.background=options.background==='solid'?'solid':'white-gallery';stats.edgeBlend=!!edgeBlend;stats.groundShadow=false;stats.lighting='neutral studio softboxes';stats.glass='clear solid glass';
    const pmrem=new THREE.PMREMGenerator(renderer);
    try{const hdr=await new HDRLoader().loadAsync(here('studio-light.hdr'));envTarget=pmrem.fromEquirectangular(hdr);hdr.dispose();stats.environment='photographic studio HDR';}
    catch{const room=createGlassStudio();envTarget=pmrem.fromScene(room,.005);room.dispose();stats.environment='procedural studio fallback';}
    scene.environment=envTarget.texture;scene.environmentRotation.y=Math.PI*.35;pmrem.dispose();
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
    const gltf=await new GLTFLoader().loadAsync(options.assetUrl||here('growth-tree-cut.glb'));
    if(disposed){gltf.scene.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[]))m.dispose();});return api;}
    model=gltf.scene;scene.add(model);stats.animations=gltf.animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks.length}));
    model.traverse(o=>{
      if(o.name.startsWith('anchor')){const id=anchorIds.find(id=>o.name.endsWith(id));if(id)anchors[id]=o;}
      if(!o.isMesh)return;
      let group=o;while(group&&!group.userData.group)group=group.parent;
      let metadata=o;while(metadata&&!metadata.userData.glass)metadata=metadata.parent;
      if(metadata){o.userData.glass=true;o.userData.section=metadata.userData.section;}
      o.userData.section=o.userData.section||(group?.userData.group==='stem'?(o.isInstancedMesh?'outlook':undefined):group?.userData.group);
      o.material=o.material.clone();materials.add(o.material);meshes.push(o);
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
    stats.ready=true;stats.renderer=renderer.getContext().getParameter(renderer.getContext().RENDERER);status.remove();resize();
    const raycaster=new THREE.Raycaster();
    const pick=e=>{const rect=renderer.domElement.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;
      const near=anchorIds.map(id=>({id,a:stats.anchors?.[id]})).filter(p=>p.a?.visible).map(p=>({...p,d:Math.hypot(x-p.a.u*rect.width,y-p.a.v*rect.height)})).sort((a,b)=>a.d-b.d)[0];
      if(near&&near.d<=22){if(noteIds.includes(near.id)){paused=true;options.onNoteSelect?.(near.id);draw();}else emitSelect(near.id);return;}
      raycaster.setFromCamera(new THREE.Vector2(x/rect.width*2-1,-y/rect.height*2+1),camera);const hit=raycaster.intersectObjects(picks,false)[0];if(hit)emitSelect(hit.object.userData.section);};
    renderer.domElement.addEventListener('pointerdown',e=>{dragging={x:e.clientX,y:e.clientY,yaw:model.rotation.y,moved:false};renderer.domElement.setPointerCapture(e.pointerId);},{signal});
    renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-dragging.x;if(Math.abs(dx)>4)dragging.moved=true;if(dragging.moved){manualYaw=dragging.yaw+dx*.008;model.rotation.y=manualYaw;draw();}},{signal});
    renderer.domElement.addEventListener('pointerup',e=>{if(dragging&&!dragging.moved)pick(e);dragging=null;},{signal});
    renderer.domElement.addEventListener('pointercancel',()=>{dragging=null;},{signal});
    root.addEventListener('pointerenter',()=>{hovered=true;},{signal});root.addEventListener('pointerleave',()=>{hovered=false;},{signal});
    root.addEventListener('focusin',()=>{focused=true;},{signal});root.addEventListener('focusout',e=>{focused=root.contains(e.relatedTarget);},{signal});
    renderer.domElement.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();api.setAngle(THREE.MathUtils.radToDeg(model.rotation.y)+(e.key==='ArrowLeft'?-5:5));}if(e.key==='Escape')emitSelect(null);if(e.key===' '){e.preventDefault();paused=!paused;}},{signal});
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stats.errors.push('WebGL context lost');fallback('图形已暂停，可继续选择内容');},{signal});
    let last=performance.now(),frames=0,windowStart=last;
    function tick(now){if(disposed||failed)return;raf=requestAnimationFrame(tick);const dt=Math.max(0,(now-last)/1000);last=now;
      if(!document.hidden&&!paused&&!dragging&&(elapsed<2.2||(!reduced&&!hovered&&!focused))){
        const prev=elapsed;elapsed+=dt;
        if(prev<2.3){mixer.update(Math.max(0,Math.min(dt,2.2-mixer.time)));syncMorphs();}
        if(elapsed>3.2)model.rotation.y=manualYaw+Math.sin((elapsed-3.2)*Math.PI/10)*THREE.MathUtils.degToRad(25);
        draw();
      }
      frames++;if(now-windowStart>1000){stats.fps=Math.round(renderedFrames*1000/(now-windowStart));stats.refreshFps=Math.round(frames*1000/(now-windowStart));renderedFrames=0;frames=0;windowStart=now;}
    }raf=requestAnimationFrame(tick);draw();
  }catch(error){stats.errors.push(String(error));fallback('三维图形未能载入，可继续选择内容');}
  function fallback(message){failed=true;stats.ready=false;cancelAnimationFrame(raf);renderer?.domElement.remove();status.textContent=message;root.append(status);const img=document.createElement('img');img.src=here('fallback.png');img.alt='成长之树静态图';Object.assign(img.style,{width:'100%',height:'100%',objectFit:'contain'});root.prepend(img);nav.style.display='flex';options.onAnchors?.(Object.fromEntries(anchorIds.map(id=>[id,{u:.5,v:.5,visible:false}])));}
  return api;
}
