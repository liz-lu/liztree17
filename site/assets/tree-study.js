import {createTreeStudyModel} from './tree-study-model.js?v=6f8b49917bc4';
import {buildVisibleStructure} from './tree-study-structure.js?v=6f8b49917bc4';
import {buildFoliageLayout} from './tree-study-foliage.js?v=6f8b49917bc4';
import {loadProgress,markStarted,startVisit,consumeBloom,consumeRoundRestart,isProgressPersistent} from './tree-progress.js?v=6f8b49917bc4';
import {navigate} from './transition.js?v=6f8b49917bc4';

// The form study remains available; flow=1 enables the local reading journey.
const journeyMode=new URLSearchParams(location.search).get('flow')!=='0';
if(journeyMode)consumeRoundRestart();
let journeyProgress=journeyMode?loadProgress():null;
let bloomGroup=journeyMode?consumeBloom():null,bloomTime=0,focusCancelled=false;
let cueGroup=null,cueElapsed=0,activatedGroup=null,guideCount=0,guideCache=null,hoverGuideGroup=null,hoverElapsed=0;
let guideExpansionPx=0,guideRippleAlpha=0,bodyPulse=0,entryTimer=null;
const hadStarted=journeyProgress?.started;
if(journeyMode){markStarted();journeyProgress=loadProgress();}
const canvas=document.querySelector('#study-canvas');
const stage=document.querySelector('#study-stage');
const fallback=document.querySelector('#study-fallback');
const status=document.querySelector('#study-status');
const model=createTreeStudyModel();
const visibleStructure=buildVisibleStructure(model);
const foliage=buildFoliageLayout(model,visibleStructure);
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a.map((x,i)=>x*(1-t)+b[i]*t);
// Paper-white bark and layered forest greens share the site's quiet print palette.
const palette={bark:[.92,.94,.90],edge:[.38,.46,.35],leafDark:[.20,.34,.23],leafLight:[.56,.68,.44]};
const defaultView={yaw:-.20,pitch:.20};
const groupNames=['campus','internships','projects','future'];
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const introStepDuration=1.2;
let introActive=journeyMode&&!hadStarted&&!reduced.matches,introElapsed=0,introGroup=null;
let focusGroup=null,focusAmount=0,focusReady=false,focusElapsed=0;
const previewLeafProgress=()=>focusGroup?(reduced.matches||paused?1:clamp(focusElapsed/1.1,0,1)):0;
let yaw=defaultView.yaw,pitch=defaultView.pitch,zoom=1,mode='full',frame=0,drag=null;
let age=0,elapsed=0,lastTimestamp=0,paused=false,manualUntil=0,orbit=0,activeGroup=0,selectedGroup=0;
let view=null,edgeYaw=Infinity,edgePitch=Infinity,edgeCount=0,frames=0;
const schedules=new Map();
for(const b of model.branches){
 const parent=schedules.get(b.parentId);
 const root=b.id.startsWith('root-'),trunk=b.id==='trunk';
 const duration=trunk?2.3:root?2.0:b.id.endsWith('-main')?2.2:b.id.includes('secondary')?1.35:b.id.includes('shoot')?.85:.7;
 const start=trunk?0:root?Math.max(1.9,parent.start+parent.duration*b.attachT+.15):parent?parent.start+parent.duration*b.attachT+.36:2.5;
 schedules.set(b.id,{start,duration});
}
const leafStart=leaf=>{const s=schedules.get(leaf.parentId);return s.start+s.duration*leaf.attachT+.42;};
const growthDuration=Math.max(...model.leaves.map(leaf=>leafStart(leaf)+2.4),...[...schedules.values()].map(s=>s.start+s.duration+.4));
if(reduced.matches||(journeyMode&&hadStarted))age=growthDuration;
if(reduced.matches){bloomGroup=null;bloomTime=4;}
let renderer='uninitialized',lastBounds={},drawCalls=0;
const gl=canvas.getContext('webgl',{alpha:true,antialias:true,stencil:true});
const resources=[];
const vertex=(p,n,c,uv=[0,0],anchor=p,anim=[-1,1,0,0])=>[...p,...n,...c,...uv,...anchor,...anim];
const vertexCount=a=>a.length/18;
const meshes=[];

// Transported frames yield curved, tapered solids, with no mesh-grid overlays.
for(const branch of visibleStructure){
  // Only the clean hand-drawn scaffold is visible. Dense support data remains
  // in the original model so the leafy crown keeps every existing leaf.
  const rings=[],normals=[],contours=[],vertices=[];let previous=null;
  const sides=branch.radii[0]>12?20:branch.radii[0]>4?12:branch.radii[0]>1.3?7:4;
  const timing=schedules.get(branch.id),group=groupNames.indexOf(branch.group)+1;
  branch.points.forEach((p,i)=>{
    const tangent=unit(sub(branch.points[Math.min(i+1,branch.points.length-1)],branch.points[Math.max(0,i-1)]));
    let normal=previous?sub(previous,mul(tangent,dot(previous,tangent))):cross(tangent,[0,0,1]);
    if(Math.hypot(...normal)<.01)normal=cross(tangent,[1,0,0]);
    normal=unit(normal);previous=normal;
    const binormal=unit(cross(tangent,normal)),radius=branch.radii[i];
    const ring=[],ns=[];
    for(let j=0;j<sides;j++){
      const a=j/sides*Math.PI*2,n=add(mul(normal,Math.cos(a)),mul(binormal,Math.sin(a)));
      ring.push(add(p,mul(n,radius)));ns.push(n);
    }
    const anim=[timing.start+timing.duration*i/(branch.points.length-1),.38,group,0];
    rings.push(ring);normals.push(ns);contours.push({p,tangent,radius,anim});
  });
  const barkColor=palette.bark;
  const v=(i,j)=>vertex(rings[i][j],normals[i][j],barkColor,[0,0],branch.points[i],contours[i].anim);
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
    const k=(j+1)%sides;
    vertices.push(...v(i,j),...v(i+1,j),...v(i,k),...v(i,k),...v(i+1,j),...v(i+1,k));
  }
  for(const i of [0,rings.length-1])for(let j=0;j<sides;j++)vertices.push(...vertex(branch.points[i],normals[i][j],barkColor,[0,0],branch.points[i],contours[i].anim),...v(i,j),...v(i,(j+1)%sides));
  meshes.push({kind:0,group:branch.group,data:new Float32Array(vertices),contours,branch});
}
const leafData=new Map(['campus','internships','projects','future'].map(g=>[g,[]]));
for(const leaf of foliage.leaves){
  const n=unit(cross(leaf.side,leaf.axis));
  let shade=leaf.renderShade;
  if(shade===undefined){
   const main=model.branches.find(b=>b.id===leaf.group+'-main');
   const distance=Math.min(...main.points.map(p=>Math.hypot(...sub(leaf.center,p))));
   shade=clamp(.95-distance/115+leaf.shade*.12,.08,.97);
  }
  const c=mix(palette.leafDark,palette.leafLight,shade);
  const base=leaf.base;
  const anim=[leafStart(leaf),.85,groupNames.indexOf(leaf.group)+1,1];
  const ridge=add(leaf.center,mul(n,leaf.width*.10));
  const data=leafData.get(leaf.group);
  const tri=(a,b,d,uv1,uv2,uv3)=>{
    const norm=unit(cross(sub(b,a),sub(d,a)));
    data.push(...vertex(a,norm,c,uv1,base,anim),...vertex(b,norm,c,uv2,base,anim),...vertex(d,norm,c,uv3,base,anim));
  };
  const outline=[[-0,-1],[-.62,-.68],[-1,-.22],[-.94,.28],[-.52,.72],[0,1],[.52,.72],[.94,.28],[1,-.22],[.62,-.68]];
  const leafPoint=([x,y])=>add(add(leaf.center,mul(leaf.axis,y*leaf.length*.5)),mul(leaf.side,x*leaf.width*.5));
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];tri(leafPoint(a),leafPoint(b),ridge,a,b,[0,0]);}
}
const leafMeshes=[...leafData].map(([group,data])=>({group,kind:1,data:new Float32Array(data)}));
leafData.clear();
// Keep the much denser crown in compact typed buffers; retain only contours
// after upload instead of several CPU copies of every triangle.
let barkData=new Float32Array(meshes.reduce((size,m)=>size+m.data.length,0));
let barkOffset=0;
for(const mesh of meshes){barkData.set(mesh.data,barkOffset);barkOffset+=mesh.data.length;delete mesh.data;}
const barkSolid={kind:0,data:barkData};
barkData=null;
const allPoints=[...visibleStructure.flatMap(b=>b.points),...foliage.leaves.map(l=>l.center)];
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for(const p of allPoints)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
const center=mix(min,max,.5);
let cameraCenter=center.slice();
let focusPoint=center.slice();
const groupCenters=Object.fromEntries(groupNames.map(group=>{
 const points=foliage.leaves.filter(l=>l.group===group).map(l=>l.center);
 return [group,points.reduce((sum,p)=>add(sum,mul(p,1/points.length)),[0,0,0])];
}));
// Ground and contour falloff match the loaded page theme, not a separate white.
const bg=(getComputedStyle(document.body).backgroundColor.match(/\d+(?:\.\d+)?/g)||[247,248,245]).slice(0,3).map(value=>Number(value)/255);
const groundData=[];
for(const p of [[-650,-1,-600],[650,-1,-600],[-650,-1,600],[-650,-1,600],[650,-1,-600],[650,-1,600]])groundData.push(...vertex(p,[0,1,0],bg));
const ground={data:groundData,kind:3};
// Quiet low meadow, not a saturated landscape or a hard-edged display plinth.
const grassData=[];
let grassSeed=815;
const grassRandom=()=>{grassSeed=(grassSeed*1664525+1013904223)>>>0;return grassSeed/4294967296;};
for(let i=0;i<780;i++){
 const angle=grassRandom()*Math.PI*2,r=32+Math.sqrt(grassRandom())*225;
 const x=Math.cos(angle)*r,z=Math.sin(angle)*r*.62;
 const h=.8+grassRandom()*2.2,w=.16+grassRandom()*.25;
 const c=mix([.57,.66,.51],bg,.40+r/650);
 const root=[x,-.8,z],tip=[x+(grassRandom()-.5)*1.8,h,z];
 grassData.push(...vertex([x-w,-.8,z],[0,1,0],c,[0,0],root),...vertex(tip,[0,1,0],c,[0,1],root),...vertex([x+w,-.8,z],[0,1,0],c,[0,0],root));
}
const grass={data:grassData,kind:4};
// Two first leaves travel with the growing shoot tip, then yield to the crown.
const sproutData=[];
for(const sign of [-1,1]){
 const base=[0,0,0],tip=[sign*18,10,sign*3],mid=[sign*9,7,sign*1.5],normal=[0,.5,1],color=[.56,.69,.44];
 const left=add(mid,[0,2,4]),right=add(mid,[0,-2,-4]),anim=[.25,.55,0,2];
 for(const tri of [[base,left,mid],[left,tip,mid],[tip,right,mid],[right,base,mid]])for(const p of tri)sproutData.push(...vertex(p,normal,color,[0,p===base?-1:p===tip?1:0],base,anim));
}
const sprout={data:sproutData,kind:1};
const trunk=model.branches.find(b=>b.id==='trunk');
const activeLeaves=()=>leafMeshes.filter(m=>journeyMode?journeyProgress.completed.includes(m.group)||m.group===focusGroup:mode==='full'||(mode==='one'&&m.group==='campus'));
const nextGroup=()=>groupNames.slice(0,3).find(group=>!journeyProgress?.completed.includes(group))||'future';
const displayGuide=()=>activatedGroup||hoverGuideGroup||focusGroup||introGroup||cueGroup;
// Only the scaffold and a few attached major laterals carry the guide. Fine
// twigs keep their architectural lines instead of becoming a flashing cloud.
const guideBranches=visibleStructure.filter(b=>b.id.endsWith('-main')||b.id.includes('-secondary-')||b.id.includes('-outreach-bough-'));
const journeyLinks=new Map();
if(journeyMode){
 document.title='卢佳丽 · 成长之树';document.body.classList.add('tree-journey');
 status.textContent=bloomGroup?`${model.anchors.find(a=>a.id===bloomGroup).label}已完成，正在长叶。`:'选择枝干，探索一段经历。';
 canvas.setAttribute('aria-label','三维成长之树。悬停查看名称，首次点击枝干放大并预览长叶，再点击同枝进入详情。数字1至4同样分两步选择校园、实习、项目和下一站。点击空白或Escape退出预览，方向键旋转。浏览三个体块并返回后保留树叶，完整一轮到下一站再返回则开启新一轮。');
 const nav=document.createElement('nav');nav.className='tree-journey-links';nav.setAttribute('aria-label','选择一段经历');
 const names=['校园与学习','实习经历','个人 AI 项目','下一站'];
 groupNames.forEach((group,index)=>{
  const link=document.createElement('a');link.className='tree-journey-link';link.dataset.treeGroup=group;link.href=group==='future'?'future.html?flow=tree':`layers.html?type=${group}&flow=tree`;
  const title=document.createElement('span');title.textContent=names[index];
  const hint=document.createElement('small');hint.className='tree-entry-hint';hint.textContent=group==='future'?'再次点击，前往下一站':'再次点击，了解详情';hint.hidden=true;
  link.append(title,hint);link.setAttribute('aria-label',group==='future'?'下一站':`${names[index]}，已查看${journeyProgress.viewed[group].length}/3${journeyProgress.completed.includes(group)?'，已完成':''}`);
  link.addEventListener('click',event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();enterGroup(group);});
  link.addEventListener('focus',()=>{activeGroup=index+1;manualUntil=elapsed+2;schedule();});link.addEventListener('blur',()=>{activeGroup=0;schedule();});
  link.addEventListener('pointerenter',()=>{activeGroup=index+1;manualUntil=elapsed+2;schedule();});link.addEventListener('pointerleave',()=>{if(document.activeElement!==link)activeGroup=0;schedule();});
  link.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();clearFocus();canvas.focus({preventScroll:true});}});
  nav.append(link);journeyLinks.set(group,link);
 });stage.append(nav);
 if(!isProgressPersistent()){const note=document.createElement('p');note.className='tree-progress-warning';note.textContent='浏览器无法保存本次进度，离开或刷新后可能重置。';stage.after(note);}
}

const vs=`
attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;attribute vec2 aUV;
attribute vec3 aAnchor;attribute vec4 aAnim;
uniform mat4 uMVP;uniform vec3 uCenter;uniform float uShadow;uniform float uKind;
uniform float uAge;uniform float uTime;uniform float uWind;uniform float uLeafProgress;uniform vec3 uSproutTip;uniform vec3 uLight;uniform float uGuide;uniform float uGuideOffset;
varying vec3 vNormal;varying vec3 vWorld;varying vec3 vColor;varying vec2 vUV;varying float vReveal;varying float vGroup;varying float vMaturity;
vec3 bend(vec3 p){
 float h=max(p.y,0.)/340.;float weight=h*h;
 float gust=sin(uTime*.82)+.32*sin(uTime*1.47+.7);
 p.x+=uWind*weight*(3.3*gust+.60*sin(uTime*2.0+p.x*.023+p.z*.017));
 p.z+=uWind*weight*(1.7*sin(uTime*.67+.9)+.32*sin(uTime*1.7+p.z*.03));
 return p;
}
void main(){
 vec3 p=aPosition;vWorld=p;vNormal=aNormal;vColor=aColor;vUV=aUV;vGroup=aAnim.z;
 vReveal=aAnim.x<0.?1.:smoothstep(aAnim.x,aAnim.x+aAnim.y,uAge);
 vMaturity=smoothstep(aAnim.x+.5,aAnim.x+2.4,uAge);
 if(aAnim.w>.5&&aAnim.w<1.5){float delay=clamp(aAnim.x/12.,0.,1.)*.38;float leafGrow=smoothstep(delay,delay+.56,uLeafProgress);vReveal*=leafGrow;vMaturity*=leafGrow;}
 if(uKind<2.5&&aAnim.x>=0.){
  if(aAnim.w>1.5)vReveal*=1.-smoothstep(4.3,6.0,uAge);
  float woodThickness=aAnim.w<.5?.035+.965*smoothstep(.8,8.6,uAge):1.;
  p=aAnchor+(p-aAnchor)*vReveal*woodThickness;
  if(aAnim.w>1.5)p+=uSproutTip;
  // Height develops before girth and crown spread: a slender shoot, not a scaled stump.
  float height=.24+.76*smoothstep(0.,7.0,uAge);
  float spread=.17+.83*smoothstep(1.0,8.0,uAge);
  p*=vec3(spread,height,spread);
  if(aAnim.w>.5){float tip=(aUV.y+1.)*.5;float phase=aAnchor.x*.14+aAnchor.z*.19;
   // Shared displacement at shared vertices keeps a folded blade watertight.
   p+=vec3(.24,.49,.16)*(uWind*tip*tip*sin(uTime*3.7+phase));
   vNormal=normalize(aNormal+vec3(.10*sin(uTime*3.7+phase),0.,.08*cos(uTime*3.7+phase)) *uWind*tip);
  }
  p=bend(p);
 }
 if(uKind>3.5)p.x+=sin(uTime*.82+aAnchor.x*.025)*.45*max(p.y+.8,0.)/3.;
 if(uGuide>.5)p+=aNormal*uGuideOffset;
 if(uShadow>0.5){p.x-=p.y*uLight.x/uLight.y;p.z-=p.y*uLight.z/uLight.y;p.y=-.65;}
 gl_Position=uMVP*vec4(p-uCenter,1.);
}`;
const fs=`
precision highp float;
uniform float uKind;uniform float uShadow;uniform vec3 uLight;uniform float uTime;uniform float uActive;uniform float uCue;uniform float uDetail;uniform float uGuide;uniform float uGuideReveal;uniform float uGuideAlpha;uniform float uBodyPulse;
varying vec3 vNormal;varying vec3 vWorld;varying vec3 vColor;varying vec2 vUV;varying float vReveal;varying float vGroup;varying float vMaturity;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
 if(vReveal<.025)discard;
 if(uGuide>.5){if(vUV.x>uGuideReveal)discard;gl_FragColor=vec4(vColor,uGuideAlpha*vUV.y);return;}
 if(uShadow>.5){float fade=1.-smoothstep(100.,380.,length(vec2(vWorld.x+vWorld.y*.48,vWorld.z-vWorld.y*.52)));gl_FragColor=vec4(.34,.43,.32,.11*fade);return;}
 if(uKind>3.5){gl_FragColor=vec4(vColor,.65);return;}
 if(uKind>2.5){float r=length(vWorld.xz/vec2(335.,230.));float soft=exp(-r*r*2.5);float contact=exp(-dot(vWorld.xz,vWorld.xz)/2200.);float grain=noise(vWorld*vec3(.38,1.,.38))*.009;gl_FragColor=vec4(.65,.71,.61,.09*soft+.16*contact+grain*soft);return;}
 if(vWorld.y<-.45)discard;
 float active=1.-step(.1,abs(vGroup-uActive));float cue=(1.-step(.1,abs(vGroup-uCue)))*(.5+.5*sin(uTime*1.8));
 if(vGroup<.5){active=0.;cue=0.;}
 if(uKind>1.5){gl_FragColor=vec4(mix(vColor,vec3(.22,.35,.22),active*.6+cue*.12),.75);return;}
 vec3 n=normalize(vNormal);float diffuse=max(0.,dot(n,uLight));
 if(uKind>.5){
  diffuse=abs(dot(n,uLight));
  float edge=smoothstep(.74,1.,abs(vUV.x));float vein=(1.-smoothstep(.008,.04,abs(vUV.x)))*.020;
  vec3 col=mix(vec3(.60,.73,.48),vColor,vMaturity)*(.82+.20*diffuse);col=mix(col,col*.89,edge*.65)+vein;col+=active*.025+cue*.012;
  gl_FragColor=vec4(col,1.);return;
 }
 float cloud=noise(vWorld*vec3(.87,.49,.87));
 float patch=smoothstep(.60,.72,cloud);
 float grain=smoothstep(.66,.78,noise(vWorld*vec3(3.4,.65,3.4)));
 float variation=noise(vWorld*vec3(.7,.13,.7));
 vec3 base=mix(vColor,vec3(.61,.68,.56),patch*.28);
 base-=grain*.035*uDetail;base+=(variation-.5)*.012;
 vec3 col=base*(.80+.20*diffuse);col+=active*.022+cue*.008;
 col=mix(col,vec3(.37,.49,.29)*(.90+.10*diffuse),active*uBodyPulse*.48);
 float rootShade=1.-exp(-max(vWorld.y,0.)/16.);col*=.92+.08*rootShade;
 gl_FragColor=vec4(col,1.);
}`;
let program,attribs,uniforms,edgeBuffer,guideBuffer;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function upload(m){m.buffer=gl.createBuffer();resources.push(m.buffer);gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);gl.bufferData(gl.ARRAY_BUFFER,m.data instanceof Float32Array?m.data:new Float32Array(m.data),gl.STATIC_DRAW);m.count=vertexCount(m.data);delete m.data;}
function initialize(){
 if(!gl)throw Error('WebGL unavailable');
 const v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs);
 program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 attribs=Object.fromEntries(['Position','Normal','Color','UV','Anchor','Anim'].map(a=>[a,gl.getAttribLocation(program,'a'+a)]));
 uniforms=Object.fromEntries(['MVP','Center','Shadow','Kind','Light','Age','Time','Wind','LeafProgress','Active','Cue','Detail','SproutTip','Guide','GuideReveal','GuideAlpha','GuideOffset','BodyPulse'].map(a=>[a,gl.getUniformLocation(program,'u'+a)]));
 [barkSolid,...leafMeshes,ground,grass,sprout].forEach(upload);edgeBuffer=gl.createBuffer();resources.push(edgeBuffer);
 guideBuffer=gl.createBuffer();resources.push(guideBuffer);
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);
 // The browser composites a premultiplied canvas: alpha must accumulate once,
 // not alpha squared, otherwise transparent shadows become a white halo.
 gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
 renderer='webgl';stage.dataset.renderer=renderer;
}
function bind(buffer){
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 const spec=[['Position',3,0],['Normal',3,12],['Color',3,24],['UV',2,36],['Anchor',3,44],['Anim',4,56]];
 for(const [name,size,offset] of spec){const loc=attribs[name];if(loc<0)continue;gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,72,offset);}
}
function draw(m){
 bind(m.buffer);gl.uniform1f(uniforms.Kind,m.kind);
 const leafProgress=journeyMode&&m.group===bloomGroup?clamp((bloomTime-.45)/2.6,0,1):journeyMode&&m.group===focusGroup&&!journeyProgress.completed.includes(m.group)?previewLeafProgress():1;
 gl.uniform1f(uniforms.LeafProgress,leafProgress);gl.drawArrays(gl.TRIANGLES,0,m.count);drawCalls++;
}
function drawGuide(group,camera){
 if(!group)return;
 const pixelScale=view.halfW*2/view.width,rotationYaw=yaw+orbit;
 if(!guideCache||guideCache.group!==group||Math.abs(guideCache.yaw-rotationYaw)>.004||Math.abs(guideCache.pitch-pitch)>.004||Math.abs(guideCache.scale-pixelScale)>.002){
  const paths=[];
  for(const mesh of meshes){
   if(mesh.group!==group||!guideBranches.includes(mesh.branch))continue;
   for(const sign of [-1,1]){
    let previous=null;const nodes=[];
    mesh.contours.forEach((r,index)=>{
     let side=unit(cross(r.tangent,camera));if(previous&&dot(side,previous)<0)side=mul(side,-1);previous=side;
     const along=index/(mesh.contours.length-1),start=mesh.branch.id.endsWith('-main')?0:mesh.branch.attachT*.85;
     nodes.push({p:add(r.p,mul(side,(r.radius+.25)*sign)),outward:mul(side,sign),anchor:r.p,anim:r.anim,progress:start+along*((mesh.branch.id.endsWith('-main')?.85:1)-start)});
    });paths.push(nodes);
   }
  }
  const data=[];
  // A quiet neutral keyline keeps the white contour legible on near-white bark.
  // It is an interaction annotation, not a new opaque part of the tree.
  for(const layer of [{width:1.05,color:[.58,.61,.57],alpha:.24},{width:.60,color:[1,1,1],alpha:1}]){
   for(const path of paths)for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],side=mul(unit(cross(sub(b.p,a.p),camera)),pixelScale*layer.width);
    const v=(node,sign)=>vertex(add(node.p,mul(side,sign)),node.outward,layer.color,[node.progress,layer.alpha],node.anchor,node.anim);
    data.push(...v(a,1),...v(a,-1),...v(b,1),...v(b,1),...v(a,-1),...v(b,-1));
   }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,guideBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);guideCount=vertexCount(data);
  guideCache={group,yaw:rotationYaw,pitch,scale:pixelScale};
 }
 gl.depthMask(false);gl.disable(gl.DEPTH_TEST);bind(guideBuffer);gl.uniform1f(uniforms.Kind,2);gl.uniform1f(uniforms.Guide,1);
 gl.uniform1f(uniforms.GuideReveal,reduced.matches||activatedGroup||hoverGuideGroup||focusGroup?1:clamp(introGroup?(introElapsed%introStepDuration)/.3:cueElapsed/1.25,0,1));
 gl.uniform1f(uniforms.GuideOffset,0);gl.uniform1f(uniforms.GuideAlpha,reduced.matches?1:.94);
 gl.drawArrays(gl.TRIANGLES,0,guideCount);drawCalls++;
 guideExpansionPx=0;guideRippleAlpha=0;
 if(!reduced.matches){
  const time=activatedGroup?elapsed-entryStartedAt:hoverGuideGroup?hoverElapsed:focusGroup?focusElapsed:introGroup?introElapsed%introStepDuration:Math.max(0,cueElapsed-1.25);
  const period=introGroup&&!hoverGuideGroup&&!focusGroup?introStepDuration:2.8;
  const phase=activatedGroup?clamp(time/.24,0,1):(time%period)/period;
  guideExpansionPx=.6+phase*8;guideRippleAlpha=.72*Math.pow(1-phase,1.55);
  gl.uniform1f(uniforms.GuideOffset,pixelScale*guideExpansionPx);gl.uniform1f(uniforms.GuideAlpha,guideRippleAlpha);
  gl.drawArrays(gl.TRIANGLES,0,guideCount);drawCalls++;
 }
 gl.uniform1f(uniforms.Guide,0);gl.uniform1f(uniforms.GuideOffset,0);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
}
function rotation(p,origin=cameraCenter){
 const [x,y,z]=sub(p,origin),cy=Math.cos(yaw+orbit),sy=Math.sin(yaw+orbit),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const rx=x*cy+z*sy,rz=-x*sy+z*cy;
 return [rx,y*cp-rz*sp,y*sp+rz*cp];
}
const boundsSamples=allPoints.filter((p,i)=>i%9===0);
function render(timestamp=performance.now()){
 frame=0;if(renderer!=='webgl')return;
 const dt=lastTimestamp?Math.min((timestamp-lastTimestamp)/1000,.08):0;lastTimestamp=timestamp;
 if(!paused&&!reduced.matches&&!document.hidden){elapsed+=dt;age=Math.min(growthDuration,age+dt);}
 if(introActive&&age>=growthDuration&&!bloomGroup){
  if(!activeGroup&&!focusGroup&&!paused&&!document.hidden)introElapsed+=dt;
  if(introElapsed>=groupNames.length*introStepDuration){introActive=false;introGroup=null;cueElapsed=0;}
  else introGroup=groupNames[Math.floor(introElapsed/introStepDuration)];
 }else introGroup=null;
 if(bloomGroup&&!paused&&!document.hidden){bloomTime+=reduced.matches?4:dt;if(bloomTime>=4){bloomGroup=null;focusCancelled=false;status.textContent=nextGroup()?`这枝已长叶，可以继续探索${model.anchors.find(a=>a.id===nextGroup()).label}。`:'三段经历已查看，成长之树已成冠。';}}
 const wantedCue=journeyMode&&!bloomGroup&&age>=growthDuration?nextGroup():null;
 if(cueGroup!==wantedCue){cueGroup=wantedCue;cueElapsed=0;guideCache=null;}else if(!paused&&!reduced.matches&&!document.hidden)cueElapsed+=dt;
 const wantedHover=journeyMode&&age>=growthDuration&&activeGroup?groupNames[activeGroup-1]:null;
 if(hoverGuideGroup!==wantedHover){hoverGuideGroup=wantedHover;hoverElapsed=0;guideCache=null;}else if(!paused&&!reduced.matches&&!document.hidden)hoverElapsed+=dt;
 const bloomFocus=bloomGroup&&!focusCancelled&&!reduced.matches?Math.sin(Math.PI*clamp(bloomTime/4,0,1)):0;
 const focusTarget=focusGroup?1:0,focusEase=reduced.matches?1:1-Math.exp(-dt*9);
 focusAmount+=(focusTarget-focusAmount)*focusEase;
 if(Math.abs(focusAmount-focusTarget)<.002)focusAmount=focusTarget;
 const targetPoint=focusGroup?groupCenters[focusGroup]:focusPoint;
 focusPoint=mix(focusPoint,targetPoint,focusEase);
 focusReady=!!focusGroup&&focusAmount>.985&&Math.hypot(...sub(focusPoint,targetPoint))<1;
 if(focusGroup&&!paused&&!reduced.matches)focusElapsed+=dt;
 cameraCenter=focusAmount>0?mix(center,focusPoint,focusAmount*.82):bloomGroup?mix(center,groupCenters[bloomGroup],bloomFocus*.56):center.slice();
 const orbitTarget=activeGroup||focusAmount>0||introActive?orbit:!bloomGroup&&!paused&&!reduced.matches&&elapsed>manualUntil&&!drag&&age>=growthDuration?Math.max(0,elapsed-Math.max(growthDuration,manualUntil))*.045:0;
 orbit+=(orbitTarget-orbit)*Math.min(1,dt*2.5);
 const rect=stage.getBoundingClientRect(),width=Math.max(rect.width,1),height=Math.max(rect.height,1),dpr=Math.min(devicePixelRatio||1,2);
 const pixelW=Math.round(width*dpr),pixelH=Math.round(height*dpr);
 if(canvas.width!==pixelW||canvas.height!==pixelH){canvas.width=pixelW;canvas.height=pixelH;}
 let extentX=0,extentY=0;
 for(const p of boundsSamples){const q=rotation(p,center);extentX=Math.max(extentX,Math.abs(q[0])+20);extentY=Math.max(extentY,Math.abs(q[1])+20);}
 const halfH=Math.max(extentY/.87,extentX/(width/height*.91))/(zoom*(1+bloomFocus*.23+focusAmount*.62)),halfW=halfH*width/height,depth=1600;
 view={width,height,halfW,halfH};
 const cy=Math.cos(yaw+orbit),sy=Math.sin(yaw+orbit),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const matrix=new Float32Array([cy/halfW,sp*sy/halfH,cp*sy/depth,0,0,cp/halfH,-sp/depth,0,sy/halfW,-sp*cy/halfH,-cp*cy/depth,0,0,0,0,1]);
 gl.viewport(0,0,pixelW,pixelH);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);gl.useProgram(program);
 gl.uniform1f(uniforms.Guide,0);
 gl.uniformMatrix4fv(uniforms.MVP,false,matrix);gl.uniform3fv(uniforms.Center,cameraCenter);gl.uniform3fv(uniforms.Light,unit([-.48+.05*Math.sin(elapsed*.18),1,.52+.035*Math.sin(elapsed*.13)]));gl.uniform1f(uniforms.Shadow,0);
 gl.uniform1f(uniforms.Age,age);gl.uniform1f(uniforms.Time,elapsed);gl.uniform1f(uniforms.Wind,reduced.matches?0:clamp(age/4,0,1));
 const pulseGroup=activatedGroup||hoverGuideGroup||focusGroup||introGroup;
 gl.uniform1f(uniforms.Active,pulseGroup?groupNames.indexOf(pulseGroup)+1:activeGroup||selectedGroup);
 const pulsePhase=activatedGroup?clamp((elapsed-entryStartedAt)/.24,0,1)*Math.PI:(hoverGuideGroup?hoverElapsed:focusGroup?focusElapsed:introElapsed%introStepDuration)*Math.PI*2/(introGroup&&!hoverGuideGroup&&!focusGroup?introStepDuration:2.8);
 bodyPulse=journeyMode&&pulseGroup?(reduced.matches?.65:.38+.62*(.5+.5*Math.cos(pulsePhase))):0;
 gl.uniform1f(uniforms.BodyPulse,bodyPulse);
 gl.uniform1f(uniforms.Detail,clamp((width/(halfW*2)-.55)/1.35,0,1));
 const tipAlong=clamp((age-.18)/schedules.get('trunk').duration,0,1)*(trunk.points.length-1),tipIndex=Math.min(trunk.points.length-2,Math.floor(tipAlong));
 gl.uniform3fv(uniforms.SproutTip,mix(trunk.points[tipIndex],trunk.points[tipIndex+1],tipAlong-tipIndex));
 gl.uniform1f(uniforms.Cue,!journeyMode&&age>=growthDuration&&!reduced.matches&&!bloomGroup?Math.floor((elapsed-growthDuration)/5)%4+1:-1);
 drawCalls=0;gl.depthMask(false);draw(ground);draw(grass);
 // Stencil prevents overlapping leaf/branch shadows from becoming a dark blob.
 gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.INCR);
 gl.uniform1f(uniforms.Shadow,1);
 [barkSolid,...activeLeaves(),sprout].forEach(draw);
 gl.disable(gl.STENCIL_TEST);gl.depthMask(true);gl.uniform1f(uniforms.Shadow,0);
 gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);draw(barkSolid);activeLeaves().forEach(draw);if(age<6)draw(sprout);gl.disable(gl.POLYGON_OFFSET_FILL);
 // Only silhouette contours of actual solid branches. No internal mesh lines.
 if(Math.abs(edgeYaw-(yaw+orbit))>.015||Math.abs(edgePitch-pitch)>.015){
 const camera=[-sy*cp,sp,cy*cp],edges=[];
 for(const mesh of meshes){
  if(mesh.branch.radii[0]<2.5||mesh.branch.id.includes('-infill-'))continue;
  const sidePaths=[[],[]];let previous=null;
  for(const r of mesh.contours){let s=unit(cross(r.tangent,camera));if(previous&&dot(s,previous)<0)s=mul(s,-1);previous=s;
   sidePaths[0].push({p:add(r.p,mul(s,r.radius)),anchor:r.p,anim:r.anim});sidePaths[1].push({p:sub(r.p,mul(s,r.radius)),anchor:r.p,anim:r.anim});
  }
  for(const path of sidePaths)for(let i=1;i<path.length;i++)for(const node of [path[i-1],path[i]])edges.push(...vertex(node.p,[0,1,0],palette.edge,[0,0],node.anchor,node.anim));
 }
 // A readable ground line immediately behind the roots. Keep it view-aligned
 // as the tree turns, rather than rotating a diagonal display-base outline.
 for(let i=0;i<64;i++){
  const point=j=>{const x=(j/64-.5)*640,z=-40+3*Math.sin(x/78);return [cy*x-sy*z,-.1,sy*x+cy*z];};
  const color=j=>mix([.58,.65,.54],bg,Math.pow(Math.abs(j/32-1),1.25));
  edges.push(...vertex(point(i),[0,1,0],color(i)),...vertex(point(i+1),[0,1,0],color(i+1)));
 }
 gl.bindBuffer(gl.ARRAY_BUFFER,edgeBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(edges),gl.DYNAMIC_DRAW);edgeCount=vertexCount(edges);edgeYaw=yaw+orbit;edgePitch=pitch;
 }
 bind(edgeBuffer);gl.uniform1f(uniforms.Kind,2);gl.drawArrays(gl.LINES,0,edgeCount);drawCalls++;
 guideExpansionPx=0;guideRippleAlpha=0;
 if(journeyMode)drawGuide(displayGuide(),[-sy*cp,sp,cy*cp]);
 const projected=boundsSamples.map(p=>{const q=rotation(p);return [q[0]/halfW,q[1]/halfH];});
 lastBounds={minX:Math.min(...projected.map(p=>p[0])),maxX:Math.max(...projected.map(p=>p[0])),minY:Math.min(...projected.map(p=>p[1])),maxY:Math.max(...projected.map(p=>p[1]))};
 for(const [group,link] of journeyLinks){
  const p=project(model.anchors.find(a=>a.id===group).position),focused=focusGroup===group;
  link.style.left=clamp(p.x,95,width-95)+'px';link.style.top=clamp(p.y+24,30,height-45)+'px';
  link.classList.toggle('is-active',activeGroup===groupNames.indexOf(group)+1||focused);link.dataset.focused=String(focused);
  link.querySelector('.tree-entry-hint').hidden=!focused;
 }
 frames++;
 if(!document.hidden&&((!paused&&!reduced.matches)||Math.abs(focusAmount-focusTarget)>.002||(focusGroup&&!focusReady)))schedule();
}
function schedule(){if(!frame&&renderer==='webgl'&&!document.hidden)frame=requestAnimationFrame(render);}
function setMode(value){if(!['bare','one','full'].includes(value))return;mode=value;schedule();}
function setZoom(value){focusCancelled=true;zoom=clamp(value,.7,2.0);manualUntil=elapsed+9;schedule();}
function clearFocus(){focusGroup=null;focusReady=false;focusElapsed=0;selectedGroup=0;activeGroup=0;hoverGuideGroup=null;guideCache=null;manualUntil=elapsed+9;schedule();}
function reset(){clearFocus();yaw=defaultView.yaw;pitch=defaultView.pitch;orbit=0;setZoom(1);}
function rotate(dx,dy=0){focusCancelled=true;yaw+=orbit+dx;orbit=0;pitch=clamp(pitch+dy,-.18,.5);manualUntil=elapsed+9;schedule();}
function replay(){age=reduced.matches?growthDuration:0;elapsed=0;lastTimestamp=0;paused=false;mode='full';reset();schedule();}
let entryStartedAt=0;
function enterGroup(group){
 const id=typeof group==='number'?groupNames[group-1]:group;
 if(!journeyMode||!groupNames.includes(id)||entryTimer||activatedGroup)return;
 introActive=false;introGroup=null;
 if(renderer==='webgl'&&focusGroup!==id){
  focusGroup=id;focusElapsed=0;focusReady=false;selectedGroup=groupNames.indexOf(id)+1;activeGroup=selectedGroup;
  age=growthDuration;focusCancelled=true;manualUntil=elapsed+9;guideCache=null;
  status.textContent=`${model.anchors.find(a=>a.id===id).label}，已聚焦。再次点击进入，点击空白或按Escape回到全树。`;
  schedule();return;
 }
 // A click during the camera movement cannot accidentally become confirmation.
 if(renderer==='webgl'&&!focusReady)return;
 activatedGroup=id;entryStartedAt=elapsed;selectedGroup=groupNames.indexOf(id)+1;schedule();
 if(id!=='future')startVisit(id);
 const target=id==='future'?'future.html?flow=tree':`layers.html?type=${id}&flow=tree`;
 if(reduced.matches)navigate(target);else entryTimer=setTimeout(()=>{entryTimer=null;navigate(target);},240);
}
function selectGroup(group){if(!group)return;if(journeyMode){enterGroup(group);return;}selectedGroup=group;activeGroup=0;age=growthDuration;manualUntil=elapsed+9;zoom=1.04;status.textContent=model.anchors[group-1].label+'枝干外形';schedule();}
function project(point){const q=rotation(point);return {x:(q[0]/view.halfW+1)*view.width/2,y:(1-q[1]/view.halfH)*view.height/2};}
function pick(x,y){
 if(!view||age<growthDuration-.5)return 0;
 const rect=canvas.getBoundingClientRect();x-=rect.left;y-=rect.top;let best=matchMedia('(pointer:coarse)').matches?32:24,group=0;
 const check=(point,id)=>{const p=project(point),d=Math.hypot(p.x-x,p.y-y);if(d<best){best=d;group=groupNames.indexOf(id)+1;}};
 for(const b of guideBranches)for(const p of b.points)check(p,b.group);
 for(let i=0;i<foliage.leaves.length;i+=6)if(!journeyMode||journeyProgress.completed.includes(foliage.leaves[i].group)||foliage.leaves[i].group===focusGroup)check(foliage.leaves[i].center,foliage.leaves[i].group);
 return group;
}
function useFallback(message){renderer='fallback';cancelAnimationFrame(frame);frame=0;stage.dataset.renderer=renderer;fallback.hidden=false;canvas.hidden=true;console.warn(message);}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,touch:e.pointerType==='touch',moved:false,group:pick(e.clientX,e.clientY)};manualUntil=elapsed+9;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
 if(!drag){activeGroup=pick(e.clientX,e.clientY);if(activeGroup)manualUntil=elapsed+2;canvas.style.cursor=activeGroup?'pointer':'grab';schedule();return;}
 if(drag.id!==e.pointerId)return;
 if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6)drag.moved=true;
 if(drag.moved)rotate((e.clientX-drag.x)*.007,drag.touch?0:(e.clientY-drag.y)*.004);
 drag.x=e.clientX;drag.y=e.clientY;
});
const end=e=>{if(!drag||drag.id!==e.pointerId)return;const click=!drag.moved&&e.type==='pointerup',group=drag.group;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(click){if(group)selectGroup(group);else if(journeyMode)clearFocus();}};
canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('pointerleave',()=>{activeGroup=0;schedule();});
canvas.addEventListener('dblclick',()=>{if(!journeyMode)replay();});
canvas.addEventListener('keydown',e=>{
 const actions={ArrowLeft:()=>rotate(-.12),ArrowRight:()=>rotate(.12),ArrowUp:()=>rotate(0,-.06),ArrowDown:()=>rotate(0,.06),Home:reset,'+':()=>setZoom(zoom*1.2),'=':()=>setZoom(zoom*1.2),'-':()=>setZoom(zoom/1.2),Escape:()=>{if(focusGroup)clearFocus();else{age=growthDuration;schedule();}},' ':()=>{paused=!paused;lastTimestamp=0;schedule();},r:replay,'1':()=>selectGroup(1),'2':()=>selectGroup(2),'3':()=>selectGroup(3),'4':()=>selectGroup(4)};
 if(actions[e.key]){e.preventDefault();actions[e.key]();}
});
canvas.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.004));}},{passive:false});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();useFallback('Tree preview: WebGL context lost');});
document.addEventListener('visibilitychange',()=>{lastTimestamp=0;if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();});
reduced.addEventListener('change',()=>{if(reduced.matches){age=growthDuration;orbit=0;introActive=false;introGroup=null;}lastTimestamp=0;schedule();});
window.addEventListener('pagehide',()=>{clearTimeout(entryTimer);entryTimer=null;});
window.addEventListener('pageshow',event=>{
 if(!journeyMode||!event.persisted)return;
 const newRound=consumeRoundRestart();markStarted();journeyProgress=loadProgress();
 bloomGroup=reduced.matches?(consumeBloom(),null):consumeBloom();bloomTime=reduced.matches?4:0;
 age=newRound&&!reduced.matches?0:growthDuration;elapsed=0;lastTimestamp=0;paused=false;
 clearTimeout(entryTimer);entryTimer=null;entryStartedAt=0;activatedGroup=null;
 cueGroup=null;cueElapsed=0;hoverGuideGroup=null;hoverElapsed=0;guideCache=null;
 introActive=newRound&&!reduced.matches;introElapsed=0;introGroup=null;
 reset();focusAmount=0;focusPoint=center.slice();focusCancelled=false;schedule();
});
try{initialize();render();}catch(error){useFallback(error.message);}
document.documentElement.dataset.journeyBooted='true';
requestAnimationFrame(()=>requestAnimationFrame(()=>window.dispatchEvent(new Event('journey:tree-ready'))));
new ResizeObserver(schedule).observe(stage);
window.treeStudy={setMode,setZoom,reset,rotate,replay,selectGroup,enterGroup,clearFocus,
 setTime(value){age=clamp(value,0,growthDuration);elapsed=value;paused=true;orbit=0;render();},
 inspect:()=>({renderer,mode,yaw:yaw+orbit,pitch,zoom,bounds:lastBounds,branchCount:model.anchors.length,renderedBranches:visibleStructure.length,branchGroups:model.anchors.map(a=>a.id),leaves:model.leaves.length,foliageLayout:foliage.stats,visibleLeafGroups:activeLeaves().map(m=>m.group),drawCalls,background:getComputedStyle(document.body).backgroundColor,prototype:true,age,growthDuration,elapsed,paused,reducedMotion:reduced.matches,selectedGroup,frames,
 anchors:view?model.anchors.map(a=>({...a,screen:project(a.position)})):[],scheduled:frame!==0,
 journey:journeyMode?{progress:loadProgress(),bloomGroup,bloomTime,nextGroup:nextGroup(),cueGroup,cueElapsed,cueStatic:reduced.matches,hoverGroup:hoverGuideGroup,hoverElapsed,displayGuide:displayGuide(),guideColor:'white',guideStrokePx:1.2,guideExpansionPx,guideRippleAlpha,bodyPulse,guideVertices:guideCount,focusGroup,focusAmount,focusReady,previewLeafProgress:previewLeafProgress(),introActive,introGroup,introElapsed}:null})};
