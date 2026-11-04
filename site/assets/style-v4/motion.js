/** D scoped visuals. No global CSS, no audio, no external runtime dependency. */
const asset = name => new URL(name, import.meta.url).href;
const active = new WeakMap();
export function createVisual(container, options = {}) {
 if (!(container instanceof HTMLElement)) throw new TypeError('container must be an HTMLElement');
 active.get(container)?.dispose();
 const kind = options.kind || 'runner';
 if (!['runner','hands','tech-hand','touch'].includes(kind)) throw new Error('Unknown visual kind');
 const root=document.createElement('div');root.className='style-v4-motion';root.dataset.kind=kind;
 const shadow=root.attachShadow({mode:'open'});
 shadow.innerHTML=`<style>
 :host{display:block;position:relative;width:100%;height:100%;min-height:120px;contain:layout paint;isolation:isolate;--accent:#087650}
 *{box-sizing:border-box}[hidden]{display:none!important}.stage{position:absolute;inset:0;overflow:hidden}.stage img{position:absolute;display:block;object-fit:contain;pointer-events:none;user-select:none}
 canvas{width:100%;height:100%;display:block}.fallback{inset:6%;width:88%;height:88%}.human{width:54%;left:-3%;top:48%}.robot{width:61%;right:-7%;top:47%}
 .tech{width:76%;height:86%;left:12%;top:7%;transform-origin:50% 65%}.scan{position:absolute;left:10%;right:10%;top:12%;height:1px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.6}.touch-image,.touch-signal{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}.touch-signal{overflow:visible}
 .controls{position:absolute;right:10px;bottom:10px;z-index:3}button{font:12px/1.4 system-ui;color:#07583d;background:#ffffffed;border:1px solid #a5bdb1;padding:6px 13px;cursor:pointer;border-radius:0}button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}button:disabled{cursor:default;color:#5c7066}.error{position:absolute;inset:35% 12%;font:13px/1.7 system-ui;color:#50655b}
 </style><div class="stage"></div><div class="controls"><button type="button" aria-pressed="false">播放</button></div>`;
 const stage=shadow.querySelector('.stage'),button=shadow.querySelector('button');
 if(options.palette?.accent)root.style.setProperty('--accent',options.palette.accent);
 if(options.controls===false)shadow.querySelector('.controls').hidden=true;
 container.append(root);
 let disposed=false,wanted=options.autoplay===true,time=0,last=0,raf=0,visible=true,loaded=false;
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 let reduce=options.reducedMotion===true||media.matches;
 const animations=[];let canvas,ctx,sprite,frame=0,tone=1;const bodySamples=[],edgeSamples=[];
 const img=(name,cls,alt)=>{const el=new Image();el.src=asset(name);el.className=cls;el.alt=alt;el.draggable=false;stage.append(el);return el};
 const fallback=kind==='runner'?img('runner-v1.webp','fallback','绿色粒子人物跑步姿态，新绘示意素材'):null;
 if(kind==='runner'){
  canvas=document.createElement('canvas');canvas.hidden=true;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','绿色粒子人物连续跑步，绿色随时间产生深浅变化');stage.append(canvas);ctx=canvas.getContext('2d');
  sprite=new Image();sprite.src=asset('runner-cycle-v2.webp');
  sprite.onload=()=>{if(disposed)return;loaded=true;sampleBody();fallback.hidden=true;canvas.hidden=false;resize();sync()};
  sprite.onerror=()=>{loaded=false;wanted=false;button.disabled=true;button.textContent='静态替代';};
 } else if(kind==='hands'){
  const human=img('human-hand-v1.webp','human','人手从左侧伸向中央'),robot=img('robot-hand-v1.webp','robot','机械手从右侧伸向中央');
  animations.push(human.animate([{transform:'translateX(-6%)'},{transform:'translateX(0)'},{transform:'translateX(-6%)'}],{duration:6500,iterations:Infinity,easing:'ease-in-out'}),robot.animate([{transform:'translateX(6%)'},{transform:'translateX(0)'},{transform:'translateX(6%)'}],{duration:6500,iterations:Infinity,easing:'ease-in-out'}));
 } else if(kind==='touch'){
  img('tech-touch-v1.webp','touch-image','银白机械手触碰绿色透视网格');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.classList.add('touch-signal');svg.setAttribute('viewBox','0 0 1448 1086');svg.setAttribute('aria-hidden','true');
  svg.innerHTML='<circle cx="276" cy="590" r="24" fill="none" stroke="var(--accent)" stroke-width="4"/><circle cx="276" cy="590" r="40" fill="none" stroke="var(--accent)" stroke-width="2"/><path d="M276 590 L225 599 L170 608 L96 620 L96 503 L96 407" fill="none" stroke="var(--accent)" stroke-width="4" stroke-dasharray="30 560"/>';
  stage.append(svg);[...svg.querySelectorAll('circle')].forEach((c,i)=>{c.style.transformOrigin='276px 590px';animations.push(c.animate([{transform:'scale(.7)',opacity:.85},{transform:'scale(2.3)',opacity:0}],{duration:2100,delay:i*600,iterations:Infinity,easing:'ease-out'}))});
  animations.push(svg.querySelector('path').animate([{strokeDashoffset:'30',opacity:0},{strokeDashoffset:'-120',opacity:.8},{strokeDashoffset:'-560',opacity:0}],{duration:2800,iterations:Infinity,easing:'linear'}));
 } else {
  const hand=img('tech-hand-v1.webp','tech','透明机械科技手');const scan=document.createElement('div');scan.className='scan';scan.setAttribute('aria-hidden','true');stage.append(scan);
  animations.push(hand.animate([{transform:'rotate(-2deg) translateY(1%)',filter:'brightness(.92)'},{transform:'rotate(2deg) translateY(-1%)',filter:'brightness(1.08)'},{transform:'rotate(-2deg) translateY(1%)',filter:'brightness(.92)'}],{duration:4600,iterations:Infinity,easing:'ease-in-out'}),scan.animate([{top:'16%',opacity:0},{top:'30%',opacity:.6},{top:'82%',opacity:0}],{duration:3000,iterations:Infinity,easing:'linear'}));
 }
 animations.forEach(a=>{a.pause();a.currentTime=0});
 function running(){return !disposed&&wanted&&!reduce&&visible&&!document.hidden&&(kind!=='runner'||loaded)}
 function sampleBody(){
  // Sample each real pose separately. Sparkles and shed particles follow anatomy, not a background layer.
  const off=document.createElement('canvas');off.width=sprite.naturalWidth;off.height=sprite.naturalHeight;const oc=off.getContext('2d',{willReadFrequently:true});oc.drawImage(sprite,0,0);const px=oc.getImageData(0,0,off.width,off.height).data,cw=off.width/4,ch=off.height/2;
  const inside=(x,y)=>{const k=(Math.floor(y)*off.width+Math.floor(x))*4;return px[k+3]>70&&px[k+1]>px[k]*1.08};
  for(let f=0;f<8;f++){const points=[],edges=[],ox=f%4*cw,oy=Math.floor(f/4)*ch;for(let y=9;y<ch-9;y+=6){for(let x=9;x<cw-9;x+=6){if(!inside(ox+x,oy+y))continue;const p={x:x/cw,y:y/ch,phase:(x*13+y*7)%101/101};points.push(p);if(!inside(ox+x+7,oy+y)||!inside(ox+x-7,oy+y)||!inside(ox+x,oy+y+7)||!inside(ox+x,oy+y-7))edges.push(p)}}bodySamples[f]=points;edgeSamples[f]=edges}
 }
 function draw(){if(!ctx||!loaded||disposed)return;const {width:w,height:h}=canvas;ctx.clearRect(0,0,w,h);frame=reduce?0:Math.floor(time*12)%8;tone=reduce?1:.82+.42*(.5+.5*Math.sin(time*Math.PI*2/4.8));
  const cw=sprite.naturalWidth/4,ch=sprite.naturalHeight/2;const size=Math.min(w*.86,h*.94),x=(w-size)/2,y=(h-size)/2;
  ctx.save();ctx.filter=`brightness(${tone}) saturate(${1.03+.1*Math.sin(time*1.31)})`;ctx.drawImage(sprite,(frame%4)*cw,Math.floor(frame/4)*ch,cw,ch,x,y,size,size);ctx.restore();
  if(!reduce){
   for(const p of bodySamples[frame]){const pulse=.5+.5*Math.sin(time*9+p.phase*31);if(pulse<.55)continue;ctx.fillStyle=p.phase>.6?`rgba(210,255,229,${.22+pulse*.56})`:`rgba(7,${Math.round(118+55*tone)},83,${.25+pulse*.5})`;const r=Math.max(1,size/260)*(p.phase+.5);ctx.fillRect(x+p.x*size,y+p.y*size,r,r)}
   for(let trail=1;trail<=3;trail++){const age=trail/12,previous=(Math.floor((time-age)*12)%8+8)%8;for(let i=0;i<edgeSamples[previous].length;i+=3){const p=edgeSamples[previous][i];ctx.fillStyle=`rgba(9,${Math.round(120+45*tone)},91,${(.18-trail*.035)*(.5+p.phase)})`;const r=Math.max(1,size/340);ctx.fillRect(x+(p.x+age*.28)*size,y+(p.y+age*.015)*size,r,r)}}
  }
 }
 function tick(now){if(!running()){raf=0;last=0;return}if(last)time+=Math.min(.08,(now-last)/1000);last=now;draw();raf=requestAnimationFrame(tick)}
 function sync(){const run=running();button.disabled=reduce;button.textContent=reduce?'静态 · 减少动态':wanted?'暂停':'播放';button.setAttribute('aria-pressed',String(wanted&&!reduce));root.dataset.playing=String(run);animations.forEach(a=>run?a.play():a.pause());if(run&&!raf){last=0;raf=requestAnimationFrame(tick)}if(!run&&raf){cancelAnimationFrame(raf);raf=0;last=0}draw()}
 function resize(){if(canvas){const box=root.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));draw()}}
 function onPreference(){reduce=options.reducedMotion===true||media.matches;if(reduce){time=0;animations.forEach(a=>a.currentTime=0)}sync()}
 button.onclick=()=>{wanted=!wanted;sync()};
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()});observer.observe(root);
 const sizes=new ResizeObserver(resize);sizes.observe(root);
 media.addEventListener('change',onPreference);document.addEventListener('visibilitychange',sync);
 const controller={element:root,pause(){wanted=false;sync()},resume(){wanted=true;sync()},resize,
  setReducedMotion(value){options.reducedMotion=Boolean(value);onPreference()},
  setTime(value){time=Math.max(0,Number(value)||0);animations.forEach(a=>a.currentTime=time*1000);draw()},
  inspect(){return {kind,playing:running(),reducedMotion:reduce,time,frame,tone,loaded,disposed,bodyParticles:bodySamples[frame]?.length||0,contourParticles:edgeSamples[frame]?.length||0,particleMode:kind==='runner'?'per-pose-body-and-contour':'none'}},
  dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);animations.forEach(a=>a.cancel());observer.disconnect();sizes.disconnect();media.removeEventListener('change',onPreference);document.removeEventListener('visibilitychange',sync);if(sprite){sprite.onload=null;sprite.onerror=null}root.remove();if(active.get(container)===controller)active.delete(container)}
 };
 active.set(container,controller);sync();return controller;
}
