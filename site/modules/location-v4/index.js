import { geography } from './geometry.js?v=archive-20261108-loading-1';

// Screen-space coordinates retained from assets/map.js and the user's original map.
// Gansu is a province-level illustration, not a birthplace or a geocoded city.
export const locations = Object.freeze([
  Object.freeze({ id: 'gansu', name: '甘肃', tag: '家乡成长', x: 473.8, y: 276.6 }),
  Object.freeze({ id: 'chongqing', name: '重庆', tag: '建筑求学', x: 506.2, y: 371 }),
  Object.freeze({ id: 'shenzhen', name: '深圳', tag: '产品实习', x: 595.5, y: 472.9 }),
  Object.freeze({ id: 'beijing', name: '北京', tag: 'AI 产品实践', x: 623.3, y: 220.9 })
]);
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const smooth = n => { const t=clamp(n);return t*t*(3-2*t); };
const nearestPlace = (x,y) => Math.min(...locations.map(p=>Math.hypot(x-p.x,y-p.y)));
const noise = (x,y,salt=0) => {
  let n=(Math.round(x*2)*73856093^Math.round(y*2)*19349663^salt*83492791)>>>0;
  n^=n>>>13;return (Math.imul(n,1274126177)>>>0)/4294967296;
};
// Preserve the source raster and its outline. Thin distant interior samples and
// subdivide only cells whose four corners already belong to the supplied geography.
const occupied = new Set(geography.map(([x,y])=>`${x},${y}`));
const displayGeography=[];
for(const [x,y] of geography){
  const proximity=nearestPlace(x,y);
  const boundary=[[7,0],[-7,0],[0,7],[0,-7]].some(([dx,dy])=>!occupied.has(`${x+dx},${y+dy}`));
  const patch=.05*Math.sin(x/43)*Math.cos(y/37);
  const keep=clamp(.45+patch+.55*Math.exp(-((proximity/77)**2)),.35,1);
  if(boundary||noise(x,y)<keep)displayGeography.push({x,y,proximity,detail:false,boundary});
  if(occupied.has(`${x+7},${y}`)&&occupied.has(`${x},${y+7}`)&&occupied.has(`${x+7},${y+7}`)){
    for(const [dx,dy,salt] of [[3.5,0,1],[0,3.5,2],[3.5,3.5,3]]){
      const distance=nearestPlace(x+dx,y+dy);
      if(noise(x,y,salt)<.94*Math.exp(-((distance/57)**2)))displayGeography.push({x:x+dx,y:y+dy,proximity:distance,detail:true,boundary:false});
    }
  }
}
const densityStats={
  sourceCount:geography.length,displayCount:displayGeography.length,
  nearPerSource:displayGeography.filter(p=>p.proximity<44).length/geography.filter(([x,y])=>nearestPlace(x,y)<44).length,
  farPerSource:displayGeography.filter(p=>p.proximity>140).length/geography.filter(([x,y])=>nearestPlace(x,y)>140).length
};
const mounts = new WeakMap();
const curves = locations.slice(0, -1).map((a, index) => {
  const b = locations[index + 1], dx = b.x - a.x, dy = b.y - a.y;
  const bend = .25 * (index % 2 ? -1 : 1);
  const c = { x: a.x + dx * .3 - dy * bend, y: a.y + dy * .3 + dx * bend };
  const d = { x: a.x + dx * .7 - dy * bend, y: a.y + dy * .7 + dx * bend };
  return t => ({ x: (1-t)**3*a.x+3*(1-t)**2*t*c.x+3*(1-t)*t*t*d.x+t**3*b.x,
    y: (1-t)**3*a.y+3*(1-t)**2*t*c.y+3*(1-t)*t*t*d.y+t**3*b.y });
});

/**
 * A owns surrounding cards, leader lines and navigation. Include ./style.css once.
 * onSelect emits once per changed id (including initial gansu); select is idempotent.
 * onAnchors uses the supplied container's border box, and emits on layout changes.
 * pause/resume never override offscreen, page-hidden or reduced-motion safeguards.
 */
export function createLocation(container, options = {}) {
  if (!container || container.nodeType !== 1) throw new TypeError('createLocation needs an element');
  if (mounts.has(container)) throw new Error('Dispose the existing location before mounting again');
  const doc = container.ownerDocument, win = doc.defaultView;
  const root = doc.createElement('section');
  root.className = 'location-v4';
  root.setAttribute('aria-label', '甘肃到重庆、深圳、北京的成长路线');
  const palette = { bg: '#ffffff', ink: '#193f32', accent: '#19855c', line: '#cbdcd3', ...options.palette };
  for (const key of ['bg', 'ink', 'accent', 'line']) root.style.setProperty(`--lv-${key}`, palette[key]);
  root.innerHTML = `<div class="location-v4__stage">
      <canvas class="location-v4__canvas" aria-hidden="true"></canvas>
      <div class="location-v4__fallback" hidden>甘肃 → 重庆 → 深圳 → 北京<br>可在下方选择地点</div>
    </div>
    <ol class="location-v4__route" aria-label="按经历顺序选择地点" hidden></ol>
    <p class="location-v4__summary" hidden></p><p class="location-v4__sr" role="status" aria-live="polite" aria-atomic="true"></p>`;
  // Retain the host's existing DOM, including any no-JS route, for disposal.
  const previous = doc.createDocumentFragment();
  while (container.firstChild) previous.append(container.firstChild);
  container.append(root);
  const stage = root.querySelector('.location-v4__stage');
  const canvas = root.querySelector('canvas');
  const routeList = root.querySelector('ol');
  const summary = root.querySelector('.location-v4__summary');
  const live = root.querySelector('[role=status]');
  let ctx = null, cache = doc.createElement('canvas'), cacheCtx = null;
  try { ctx = canvas.getContext('2d'); cacheCtx = cache.getContext('2d'); } catch { /* text route remains usable */ }
  let graphical = !!(ctx && cacheCtx);
  let disposed = false, manualPause = false, inView = false, sized = false, raf = 0;
  let selected = null, elapsed = 0, last = null, frameCount = 0, paintCount = 0;
  let width = 0, height = 0, dpr = 1, transform = null, particles = [], anchors = {};
  let waves = [], waveFields = [], litId = null, maxDisplacement = 0, maxRouteDisplacement = 0, strandCount = 0;
  const waveDuration = 2200;
  const cursor={last:null,impulses:[],active:false,bounds:null,maxOffset:0,trailCount:0,sample:null};
  const trails={count:0,tiers:[0,0,0],minAlpha:0,maxAlpha:0};
  let routeGeometry=[],maxAmbientDisplacement=0,maxPointerRouteDisplacement=0;
  let resizeObserver = null, intersectionObserver = null;
  const removers = [], nodeButtons = [], routeButtons = [];
  const motion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced = () => options.reducedMotion === true || !!motion?.matches;
  const listen = (target, type, fn) => { target.addEventListener(type, fn); removers.push(() => target.removeEventListener(type, fn)); };
  const point = p => ({ x: (p.x - transform.x) * transform.scale + transform.ox,
    y: (p.y - transform.y) * transform.scale + transform.oy });

  for (const [index, place] of locations.entries()) {
    const node = doc.createElement('button');
    node.type = 'button'; node.className = 'location-v4__node'; node.dataset.id = place.id;
    node.setAttribute('aria-label', `${place.name}${index === 0 ? '（省域示意）' : ''}，${place.tag}`);
    node.innerHTML = `<span class="location-v4__pin" aria-hidden="true"></span><span class="location-v4__label" aria-hidden="true"><small>${String(index + 1).padStart(2,'0')}</small>${place.name}</span>`;
    const li = doc.createElement('li'), button = doc.createElement('button');
    button.type = 'button'; button.className = 'location-v4__stop'; button.dataset.id = place.id;
    button.innerHTML = `<strong>${place.name}</strong><small>${place.tag}</small>`;
    if (index === 0) button.setAttribute('aria-label', '甘肃（省域示意），家乡成长');
    li.append(button); routeList.append(li); stage.append(node);
    nodeButtons.push(node); routeButtons.push(button);
    listen(node, 'click', () => activate(place.id)); listen(button, 'click', () => activate(place.id));
  }
  function rendererState() {
    root.dataset.renderer = graphical ? 'canvas2d' : 'text';
    canvas.hidden = !graphical;
    root.querySelector('.location-v4__fallback').hidden = graphical;
    routeList.hidden = graphical;
    summary.hidden = graphical;
    nodeButtons.forEach(button => { button.hidden = !graphical; });
  }
  rendererState();

  function activate(id) {
    if (disposed) return;
    // Clicking the selected place repeats its ripple, without repeating onSelect.
    if (selected === id) { ripple(id); draw(); }
    else select(id);
  }

  function ripple(id) {
    litId = id;
    nodeButtons.forEach(button => { button.dataset.lit = String(button.dataset.id === id); });
    if (graphical && !reduced() && !manualPause && !doc.hidden) {
      // Latest click owns the bounded wave; no accumulation or automatic relay.
      waves = [{ id, age: 0 }];
    }
    reconcile();
  }

  function select(id, initial = false) {
    if (disposed || !locations.some(p => p.id === id) || selected === id) return;
    selected = id;
    for (const button of [...nodeButtons, ...routeButtons]) button.setAttribute('aria-pressed', String(button.dataset.id === id));
    const place = locations.find(p => p.id === id), index = locations.indexOf(place);
    summary.replaceChildren();
    const strong = doc.createElement('strong'), note = doc.createElement('span');
    strong.textContent = `${String(index + 1).padStart(2,'0')} / ${place.name} · ${place.tag}`;
    note.textContent = index === 0 ? '省域示意，不指向具体城市' : '甘肃 → 重庆 → 深圳 → 北京';
    summary.append(strong, note);
    live.textContent = `已选择${place.name}，${place.tag}${index === 0 ? '，省域示意' : ''}`;
    if (!initial) ripple(id);
    // Selection does not start a click wave on initial mount.
    draw();
    options.onSelect?.(id);
  }

  function publishAnchors(force = false) {
    const host = container.getBoundingClientRect();
    const next = Object.fromEntries(locations.map((p, i) => {
      // Read the actual screen marker, including host padding/borders/CSS scaling.
      const marker = nodeButtons[i].getBoundingClientRect();
      const u = graphical && host.width ? (marker.left + marker.width / 2 - host.left) / host.width : 0;
      const v = graphical && host.height ? (marker.top + marker.height / 2 - host.top) / host.height : 0;
      const visible = graphical && sized && root.getClientRects().length > 0 && u >= 0 && u <= 1 && v >= 0 && v <= 1;
      return [p.id, { u, v, visible }];
    }));
    if (force || JSON.stringify(anchors) !== JSON.stringify(next)) { anchors = next; options.onAnchors?.(next); }
  }

  function resize() {
    if (disposed) return;
    clearCursor();
    width = stage.clientWidth; height = stage.clientHeight;
    sized = width > 0 && height > 0 && container.getClientRects().length > 0;
    root.dataset.narrow = String(width < 440);
    root.style.setProperty('--lv-grid', width < 440 ? '36px' : '48px');
    if (!sized) { publishAnchors(true); reconcile(); return; }
    // Fit a geographic crop with isotropic scaling; never stretch the geography.
    const view = width < 440 ? { x: 350, y: 155, w: 415, h: 390 } : { x: 265, y: 105, w: 570, h: 450 };
    const scale = Math.min(width / view.w, height / view.h);
    transform = { x: view.x, y: view.y, scale, ox: (width - view.w * scale) / 2, oy: (height - view.h * scale) / 2 };
    dpr = Math.min(win.devicePixelRatio || 1, 2);
    canvas.width = cache.width = Math.max(1, Math.round(width * dpr));
    canvas.height = cache.height = Math.max(1, Math.round(height * dpr));
    particles = displayGeography.map(({x,y,proximity,detail,boundary}, i) => {
      const p = point({ x, y });
      const edge = clamp(Math.min(p.x, width-p.x, p.y, height-p.y) / 64);
      const jitter=boundary?0:.55*scale;
      const variation=noise(x,y,6),tier=variation<.64?0:variation<.93?1:2;
      return { x:p.x+(noise(x,y,4)-.5)*jitter,y:p.y+(noise(x,y,5)-.5)*jitter,depth:.5+(i%7)/12,
        alpha:edge*(.15+.26*Math.exp(-proximity/105))*(detail?.78:1)*(.72+.28*noise(x,y,7)),radius:Math.max(.6,(detail?.91:1.08)*scale),i,
        tier,trailLife:[300,850,1400][tier]*(.8+.4*noise(x,y,8)),
        trailAlpha:[.18,.52,.92][tier],trailWidth:[.42,.58,.78][tier],
        ox:0,oy:0,vx:0,vy:0,history:[] };
    }).filter(p => p.x > -20 && p.y > -20 && p.x < width + 20 && p.y < height + 20);
    // Cache route geometry and interpolation weights at resize, not on every frame.
    // Nearby particles supply exactly the same pointer displacement as the map.
    routeGeometry=curves.map(curve=>{
      let length=0,previous=point(curve(0));
      for(let j=1;j<=48;j++){const at=point(curve(j/48));length+=Math.hypot(at.x-previous.x,at.y-previous.y);previous=at;}
      const pieces=Math.max(48,Math.ceil(length/3.6));
      const probe=t=>{
        const base=point(curve(t)),neighbors=[];let total=0;
        for(const particle of particles){
          const distance=Math.hypot(particle.x-base.x,particle.y-base.y);
          if(distance<40){const weight=(1-distance/40)**2;neighbors.push({particle,weight});total+=weight;}
        }
        return {base,lock:Math.sin(Math.PI*t)**.7,neighbors,total};
      };
      return {segments:Array.from({length:pieces},(_,j)=>[probe(j/pieces),probe((j+.38)/pieces)]),arrow:probe(.56),before:probe(.54)};
    });
    nodeButtons.forEach((button, i) => { const p = point(locations[i]); button.style.left = `${p.x}px`; button.style.top = `${p.y}px`; });
    if (graphical) {
      cacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0); cacheCtx.clearRect(0, 0, width, height);
      paintDots(cacheCtx);
    }
    draw(); publishAnchors(true); reconcile();
  }

  // One finite travelling wave field drives both particle strokes and route displacement.
  // HTML markers (and therefore A's screen anchors) remain at their real positions.
  function waveGeometry(wave) {
    const index=locations.findIndex(loc=>loc.id===wave.id), origin=point(locations[index]);
    const target=index<locations.length-1?point(locations[index+1]):null;
    const range=target?Math.hypot(target.x-origin.x,target.y-origin.y):clamp(Math.min(width,height)*.12,28,64);
    const travel=clamp(wave.age/1900),progress=1-(1-travel)**2;
    return { ...wave, origin, targetId:locations[index+1]?.id??null, range,
      front:range*progress, band:clamp(range*.19,15,44),
      fade:smooth(wave.age/150)*(1-smooth(progress))**.65 };
  }

  function wavePoint(p) {
    let x = p.x, y = p.y, influence = 0, angle = 0, radius = 0, centre = p;
    for (const wave of waveFields) {
      const origin = wave.origin;
      const dx = p.x-origin.x, dy = p.y-origin.y, distance = Math.hypot(dx,dy);
      if(distance>wave.range) continue;
      const offset = distance-wave.front;
      const edgeFade=1-smooth((distance/wave.range-.85)/.15);
      const envelope = Math.exp(-(offset*offset)/(wave.band*wave.band)) * wave.fade * edgeFade;
      if (envelope < .002) continue;
      const theta = Math.atan2(dy,dx), lock = clamp(distance/25);
      const phase=offset/clamp(wave.range*.07,7,15);
      const shift = Math.sin(phase)*envelope*clamp(wave.range*.08,3,13)*lock;
      const shear = Math.cos(phase*.7)*envelope*2.4*lock;
      const nextRadius=clamp(distance+shift,0,wave.range),nextAngle=theta+shear/Math.max(16,distance);
      x=origin.x+Math.cos(nextAngle)*nextRadius;y=origin.y+Math.sin(nextAngle)*nextRadius;
      if (envelope > influence) { influence=envelope;angle=nextAngle;centre=origin;radius=nextRadius; }
    }
    return {x,y,influence,angle,centre,radius};
  }

  function clearCursor() {
    cursor.last=null;cursor.impulses=[];cursor.active=false;cursor.bounds=null;cursor.maxOffset=0;cursor.trailCount=0;cursor.sample=null;
    for(const p of particles){p.ox=p.oy=p.vx=p.vy=0;p.history=[];}
  }

  // A slow, spatially varying field keeps the geography alive without input.
  // Time advances only when visible and unpaused. Markers never use this field.
  function ambientOffset(p) {
    const time=elapsed/1000,scale=transform.scale;
    const u=(p.x-width*.5)/scale,v=(p.y-height*.5)/scale;
    const phase=u*.032+v*.018-time*.82;
    const amplitude=smooth(elapsed/1200)*clamp(scale,.65,1.2)*(.68+.32*Math.sin(u*.017+v*.021));
    return {x:(Math.sin(phase)*5.2+Math.sin(v*.037-time*.57)*3.2)*amplitude,
      y:(Math.cos(phase*.83+time*.22)*3.2+Math.cos(u*.028-time*.67)*2.6)*amplitude};
  }

  function advanceCursor(delta) {
    const impulses=cursor.impulses.splice(0),radius=clamp(width*.15,65,125);
    let active=false,maxOffset=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    const steps=Math.ceil(delta/16),step=delta/16/steps;
    for(const p of particles){
      for(const impulse of impulses){
        const dx=impulse.x-impulse.sx,dy=impulse.y-impulse.sy;
        const t=clamp(((p.x+p.ox-impulse.sx)*dx+(p.y+p.oy-impulse.sy)*dy)/(dx*dx+dy*dy||1));
        const distance=Math.hypot(p.x+p.ox-impulse.sx-t*dx,p.y+p.oy-impulse.sy-t*dy);
        const weight=clamp(1-distance/radius)**2;
        p.vx+=impulse.fx*weight*.22;p.vy+=impulse.fy*weight*.22;
      }
      for(let n=0;n<steps;n++){
        // A softly damped spring: a small overshoot, then rest, rather than
        // repeated oscillation. Substeps keep slow frames from jolting the map.
        p.vx=(p.vx-p.ox*.024*step)*(.82**step);p.vy=(p.vy-p.oy*.024*step)*(.82**step);
        p.ox+=p.vx*step;p.oy+=p.vy*step;
      }
      const offset=Math.hypot(p.ox,p.oy);
      if(offset>38){p.ox*=38/offset;p.oy*=38/offset;p.vx*=.5;p.vy*=.5;}
      if(Math.hypot(p.ox,p.oy,p.vx,p.vy)<.055)p.ox=p.oy=p.vx=p.vy=0;
      p.history=p.history.filter(h=>elapsed-h.t<p.trailLife);
      if(p.ox||p.oy){
        active=true;maxOffset=Math.max(maxOffset,Math.hypot(p.ox,p.oy));
        minX=Math.min(minX,p.x-70);minY=Math.min(minY,p.y-70);maxX=Math.max(maxX,p.x+70);maxY=Math.max(maxY,p.y+70);
      }
    }
    cursor.active=active;cursor.maxOffset=maxOffset;
    cursor.bounds=active?{x:minX,y:minY,w:maxX-minX,h:maxY-minY}:null;
  }

  function paintDots(context, interactive = false, recordMotion = false) {
    context.fillStyle = palette.accent;
    context.strokeStyle = palette.accent;context.lineCap='round';
    maxDisplacement = 0;maxAmbientDisplacement=0;strandCount = 0;cursor.trailCount=0;cursor.sample=null;
    trails.count=0;trails.tiers=[0,0,0];trails.minAlpha=Infinity;trails.maxAlpha=0;
    for (const p of particles) {
      const at = interactive ? wavePoint(p) : {...p};
      if(interactive){
        const ambient=ambientOffset(p);at.x+=p.ox+ambient.x;at.y+=p.oy+ambient.y;
        maxAmbientDisplacement=Math.max(maxAmbientDisplacement,Math.hypot(ambient.x,ambient.y));
      }
      if (interactive) maxDisplacement = Math.max(maxDisplacement, Math.hypot(at.x-p.x,at.y-p.y));
      if(recordMotion&&elapsed-(p.history.at(-1)?.t??-100)>=48){
        p.history.push({x:at.x,y:at.y,t:elapsed});if(p.history.length>36)p.history.shift();
      }
      if(interactive&&p.history.length>1){
        let travel=0;
        context.lineWidth=p.trailWidth;
        for(let j=1;j<p.history.length;j++){
          const a=p.history[j-1],b=p.history[j],distance=Math.hypot(b.x-a.x,b.y-a.y);travel+=distance;
          // Older ends dissolve; the short, pale majority leaves space between
          // a smaller number of medium and dark strands. No uniform hairball.
          const alpha=p.alpha*p.trailAlpha*(1-clamp((elapsed-a.t)/p.trailLife))**1.6;
          if(alpha<.008||distance<.02)continue;
          context.globalAlpha=alpha;
          trails.minAlpha=Math.min(trails.minAlpha,alpha);trails.maxAlpha=Math.max(trails.maxAlpha,alpha);
          context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();
        }
        if(travel>.5){
          trails.count++;trails.tiers[p.tier]++;
          if(Math.hypot(p.ox,p.oy)>.12){
            cursor.trailCount++;
            if(!cursor.sample||travel>cursor.sample.length)cursor.sample={length:travel,points:p.history.map(h=>({...h})),head:{x:at.x,y:at.y}};
          }
        }
      }
      // Dots stretch into tangential arcs at the travelling crests, then become dots again.
      if (interactive && at.influence > .06 && at.radius > 8) {
        const half = (.6 + 7*at.influence) * [.4,.75,1][p.tier] / Math.max(12,at.radius);
        context.globalAlpha = p.alpha * p.trailAlpha * at.influence;
        context.lineWidth=p.trailWidth;
        const ambient=ambientOffset(p);
        context.beginPath();context.arc(at.centre.x+ambient.x+p.ox,at.centre.y+ambient.y+p.oy,at.radius,at.angle-half,at.angle+half);context.stroke();
        strandCount++;
      }
      context.globalAlpha = p.alpha * (1 - (at.influence || 0)*.84);
      context.beginPath();
      context.arc(at.x, at.y,
        p.radius * (.7 + .3 * p.depth), 0, Math.PI * 2);
      context.fill();
    }
    if(!Number.isFinite(trails.minAlpha))trails.minAlpha=0;
    context.globalAlpha = 1;
  }

  function draw(recordMotion = false) {
    if (disposed || !graphical || !sized || !transform) return;
    paintCount++;
    const moving = !reduced();
    waveFields=!reduced()?waves.map(waveGeometry):[];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    if (moving) paintDots(ctx,true,recordMotion);
    else {ctx.drawImage(cache,0,0,width,height);maxDisplacement=maxAmbientDisplacement=0;strandCount=0;cursor.trailCount=0;cursor.sample=null;trails.count=0;trails.tiers=[0,0,0];trails.minAlpha=trails.maxAlpha=0;}
    maxRouteDisplacement=0;maxPointerRouteDisplacement=0;
    routeGeometry.forEach(route => {
      const sample = probe => {
        const {base,lock,neighbors,total}=probe,wave=moving ? wavePoint(base) : base;
        const ambient=moving?ambientOffset(base):{x:0,y:0};let dx=0,dy=0;
        if(moving&&cursor.active&&total)for(const {particle,weight} of neighbors){dx+=particle.ox*weight/total;dy+=particle.oy*weight/total;}
        const p={x:base.x+(wave.x-base.x+ambient.x+dx)*lock,y:base.y+(wave.y-base.y+ambient.y+dy)*lock};
        maxPointerRouteDisplacement=Math.max(maxPointerRouteDisplacement,Math.hypot(dx,dy)*lock);
        maxRouteDisplacement=Math.max(maxRouteDisplacement,Math.hypot(p.x-base.x,p.y-base.y));
        return p;
      };
      ctx.beginPath();
      // Keep each dash tied to a route parameter. A wave must not shift the dash
      // phase of the entire remaining route through a changed total path length.
      for(const [start,end] of route.segments){
        const a=sample(start),b=sample(end);
        ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      }
      ctx.strokeStyle=palette.accent;ctx.lineWidth=.75;ctx.globalAlpha=.53;
      ctx.lineCap='round';ctx.stroke();
      const at=sample(route.arrow),before=sample(route.before),angle=Math.atan2(at.y-before.y,at.x-before.x);
      ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-3,-2);ctx.lineTo(0,0);ctx.lineTo(-3,2);ctx.stroke();ctx.restore();
    });
    ctx.globalAlpha=1;
    if (litId) {
      const focus=point(locations.find(p=>p.id===litId));
      const halo=ctx.createRadialGradient(focus.x,focus.y,0,focus.x,focus.y,42);
      halo.addColorStop(0,'rgba(255,255,255,.96)');
      halo.addColorStop(.22,'rgba(246,250,253,.85)');
      halo.addColorStop(.48,'rgba(174,190,201,.3)');
      halo.addColorStop(1,'rgba(230,239,246,0)');
      ctx.fillStyle=halo;ctx.fillRect(focus.x-42,focus.y-42,84,84);
    }
  }

  const canAnimate = () => !disposed && graphical && sized && inView && !manualPause && !doc.hidden && !reduced();
  const allowed = () => canAnimate();
  function tick(now) {
    raf = 0;
    if (!allowed()) { last = null; reconcile(); return; }
    const delta = last === null ? 16 : Math.min(80, now - last);
    if (last !== null) elapsed += delta;
    waves.forEach(wave=>{wave.age+=delta;});
    waves=waves.filter(wave=>wave.age<waveDuration);
    advanceCursor(delta);
    last = now; frameCount++; draw(true);
    if (allowed()) raf = win.requestAnimationFrame(tick);
    else reconcile();
  }
  function reconcile() {
    if (disposed) return;
    // Also clear on synchronous media reads, before a queued media change event arrives.
    if(reduced() && (waves.length||cursor.active||cursor.impulses.length)){waves=[];clearCursor();draw();}
    if (allowed()) { if (!raf) { last = null; raf = win.requestAnimationFrame(tick); } }
    else { if (raf) win.cancelAnimationFrame(raf); raf = 0; last = null; }
    root.dataset.motion = reduced() ? 'reduced' : manualPause ? 'paused' : !inView || doc.hidden ? 'offscreen' : 'playing';
  }
  function pause() { if (!disposed) { manualPause = true;cursor.last=null;cursor.impulses=[]; reconcile(); } }
  function resume() { if (!disposed) { manualPause = false; reconcile(); } }
  function dispose() {
    if (disposed) return;
    pause(); disposed = true;
    resizeObserver?.disconnect(); intersectionObserver?.disconnect(); removers.splice(0).forEach(remove => remove());
    canvas.width = canvas.height = cache.width = cache.height = 0;
    clearCursor();particles = [];routeGeometry=[];waves = []; waveFields=[];ctx = null; cacheCtx = null; maxDisplacement = 0; maxRouteDisplacement = 0; strandCount = 0;maxAmbientDisplacement=maxPointerRouteDisplacement=0;trails.count=0;trails.tiers=[0,0,0];trails.minAlpha=trails.maxAlpha=0;
    root.remove(); container.append(previous); mounts.delete(container);
    anchors = Object.fromEntries(locations.map(p => [p.id, { u: 0, v: 0, visible: false }]));
    options.onAnchors?.(anchors);
  }
  const controller = { select, pause, resume, resize, dispose,
    inspect: () => ({ selected, renderer: graphical ? 'canvas2d' : 'text', reducedMotion: reduced(),
      running: !!raf, manualPause, inView, disposed, elapsed: Math.round(elapsed), frameCount, paintCount,
      particleCount: particles.length, anchors: structuredClone(anchors), width, height,
      density:{...densityStats},
      ambient:{enabled:!disposed&&graphical&&!reduced(),maxDisplacement:maxAmbientDisplacement},
      trails:{...trails,tiers:[...trails.tiers]},maxPointerRouteDisplacement,
      cursor:{active:cursor.active,maxOffset:cursor.maxOffset,trailCount:cursor.trailCount,sample:cursor.sample},
      ripple: { count:waves.length, ages:waves.map(w=>Math.round(w.age)), origins:waves.map(w=>w.id),
        ranges:transform?waves.map(waveGeometry).map(w=>({id:w.id,targetId:w.targetId,radius:w.range,front:w.front,opacity:w.fade})):[],
        maxDisplacement, maxRouteDisplacement, strandCount, litId } }) };
  mounts.set(container, controller);
  listen(doc, 'visibilitychange', reconcile);
  if (motion) listen(motion, 'change', () => { if(reduced()){waves=[];clearCursor();} draw(); reconcile(); });
  const pointerPosition=event=>{const r=stage.getBoundingClientRect();return{x:(event.clientX-r.left)*width/r.width,y:(event.clientY-r.top)*height/r.height};};
  listen(stage,'pointerenter',event=>{cursor.last=event.pointerType!=='touch'&&canAnimate()?pointerPosition(event):null;});
  listen(stage,'pointermove',event=>{
    if(event.pointerType==='touch'||!canAnimate()){cursor.last=null;return;}
    const at=pointerPosition(event),previous=cursor.last;cursor.last=at;
    if(!previous)return;
    const dx=at.x-previous.x,dy=at.y-previous.y,distance=Math.hypot(dx,dy);if(distance<.4)return;
    const cap=Math.min(1,32/distance);
    cursor.impulses.push({x:at.x,y:at.y,sx:previous.x,sy:previous.y,fx:dx*cap,fy:dy*cap});
    if(cursor.impulses.length>12)cursor.impulses.shift();reconcile();
  });
  listen(stage,'pointerleave',()=>{cursor.last=null;});listen(stage,'pointercancel',()=>{cursor.last=null;});
  listen(canvas, 'contextlost', event => { event.preventDefault(); waves=[];clearCursor();graphical = false; rendererState(); resize(); });
  listen(canvas, 'contextrestored', () => {
    try { ctx = canvas.getContext('2d'); cacheCtx = cache.getContext('2d'); graphical = !!(ctx && cacheCtx); } catch { graphical = false; }
    rendererState(); resize();
  });
  if (win.ResizeObserver) {
    resizeObserver = new win.ResizeObserver(resize); resizeObserver.observe(container); resizeObserver.observe(stage);
  } else listen(win, 'resize', resize);
  if (win.IntersectionObserver) {
    intersectionObserver = new win.IntersectionObserver(entries => { inView = entries[0].isIntersecting; reconcile(); }, { threshold: 0 });
    intersectionObserver.observe(root);
  } else inView = true;
  resize(); select('gansu', true); reconcile();
  return controller;
}
