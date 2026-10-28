/* True isometric sections: perpendicular stair, return landing, level bridge, descending ramp. */
const C = { wall: 7, width: 150, height: 180, level: 100, lowerLevel:70, stride: 166, slab: 6, scale: 1.12 };
const COS = Math.sqrt(3) / 2;
const n = v => Number(v.toFixed(3));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const v = (x,y,z) => ({x,y,z});
const project = p => ({ x: 180 + C.scale * COS * (p.x-p.y), y: 260 + C.scale * (.5*(p.x+p.y)-p.z) });
const d = points => points.map((p,i) => { const q=project(p); return `${i?'L':'M'}${n(q.x)} ${n(q.y)}`; }).join(' ');
const poly = points => d(points)+'Z';
const depth = p => p.x+p.y+p.z;
const mix = (a,b,t) => v(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
let instances = 0;
const CSS = `
.journey-slices{position:relative;width:100%;aspect-ratio:1160/320;color:var(--ink,#243c2d)}
.journey-slices svg{display:block;width:100%;height:auto;font-family:inherit;overflow:visible;touch-action:pan-x pan-y}
.journey-slices .architecture-face{fill:var(--paper,#fbfcf9);stroke:var(--drawing,#8c9c84);stroke-width:.85;stroke-linejoin:round;transition:fill .2s,stroke .2s}
.journey-slices .architecture-face[data-hovered=true]{stroke:var(--accent-strong,#385837)}
.journey-slices .face-wall[data-selected=true]{fill:var(--selected,#e5eadd);stroke:var(--accent,#5f7d4b)}
.journey-slices .door-reveal[data-selected=true]{fill:var(--selected-edge,#cad6c0);stroke:var(--accent,#5f7d4b)}
.journey-slices .architecture-face[data-selected=true][data-hovered=true]{stroke:var(--accent-strong,#385837)}
.journey-slices .face-edge{fill:var(--surface-muted,#edf1e8);stroke-width:.75}
.journey-slices .face-reveal{fill:var(--surface-muted,#edf1e8);stroke-width:.75}
.journey-slices .face-slab{fill:var(--surface-muted,#edf1e8);stroke:var(--drawing,#8c9c84);stroke-width:.9}
.journey-slices .architecture-edge{fill:none;stroke:var(--muted,#5c6b5b);stroke-width:.95;stroke-linejoin:round}
.journey-slices .architecture-rail{fill:none;stroke:var(--drawing,#8c9c84);stroke-width:.65}
.journey-slices .corner-guide{fill:none;stroke:var(--line,#cbd4c6);stroke-width:.7;stroke-dasharray:3 6}
.journey-slices .walk-trail{fill:none;stroke:var(--accent,#5f7d4b);stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}
.journey-slices .slice-button,.journey-slices .slice-next{cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}
.journey-slices .slice-hit{fill:transparent;stroke:none;pointer-events:all}
.journey-slices .slice-focus{fill:none;stroke:transparent;stroke-width:1;stroke-dasharray:3 5;pointer-events:none}
.journey-slices .slice-button:focus-visible .slice-focus,.journey-slices .slice-next:focus-visible .slice-focus{stroke:var(--accent-strong,#385837)}
.journey-slices .slice-number{font-size:11px;fill:var(--muted,#5c6b5b);letter-spacing:.04em}
.journey-slices .slice-label{font-size:18px;fill:var(--ink,#243c2d);letter-spacing:0}
.journey-slices .slice-time{font-size:12px;fill:var(--muted,#5c6b5b);letter-spacing:0}
.journey-slices [data-panel-label]{pointer-events:none;paint-order:stroke fill;stroke:var(--paper,#fbfcf9);stroke-width:1.2;stroke-linejoin:round}
.journey-slices .slice-button[aria-pressed=true] [data-panel-label]{stroke:var(--selected,#e5eadd)}
.journey-slices .slice-button[aria-pressed=true] .slice-label,.journey-slices .slice-button[aria-pressed=true] .slice-number{fill:var(--accent-strong,#385837)}
.journey-slices .slice-button:hover .slice-label{fill:var(--accent-strong,#385837)}
.journey-slices .slice-walker{fill:var(--ink,#243c2d);pointer-events:none;transition:opacity .3s}
.journey-slices .slice-next{opacity:0;pointer-events:none;transition:opacity .5s}
.journey-slices .slice-next[data-ready=true]{opacity:1;pointer-events:auto}
.journey-slices .next-whisper{fill:none;stroke:var(--accent,#5f7d4b);stroke-width:1;stroke-dasharray:2 6;opacity:.38}
.journey-slices .departure-path{opacity:0;pointer-events:none;transition:opacity .5s}
.journey-slices .departure-path[data-ready=true]{opacity:.38}
.journey-slices .next-dots{fill:var(--accent,#5f7d4b);opacity:.65}
.journey-slices .slice-next:hover .next-dots{opacity:1}
.journey-slices .next-label{font-size:18px;fill:var(--muted,#5c6b5b)}
@media(prefers-reduced-motion:reduce){.journey-slices *{transition:none!important}}
`;

function geometry() {
  const faces=[], rails=[], walls=[], links=[];
  const face=(points,kind='wall',slice=-1,wallPart=false)=>faces.push({points,kind,slice,wallPart,depth:points.reduce((s,p)=>s+depth(p),0)/points.length});
  function box(x0,x1,y0,y1,z0,z1,kind='slab',slice=-1) {
    face([v(x0,y0,z1),v(x1,y0,z1),v(x1,y1,z1),v(x0,y1,z1)],kind,slice);
    face([v(x1,y0,z0),v(x1,y1,z0),v(x1,y1,z1),v(x1,y0,z1)],'edge',slice);
    face([v(x0,y1,z0),v(x1,y1,z0),v(x1,y1,z1),v(x0,y1,z1)],'edge',slice);
  }
  function slab(points) {
    face(points,'slab');
    for(let i=0;i<points.length;i++) {const a=points[i],b=points[(i+1)%points.length];face([a,b,v(b.x,b.y,b.z-C.slab),v(a.x,a.y,a.z-C.slab)],'edge');}
  }
  function walkway(a,b,width=28) {
    // Ends are parallel to each wall: the full deck, not only its centre, meets the opening.
    const ox=width/2,oy=0;
    const points=[v(a.x+ox,a.y,a.z),v(b.x+ox,b.y,b.z),v(b.x-ox,b.y,b.z),v(a.x-ox,a.y,a.z)];
    slab(points);
    for(const sign of [-1,1]) {
      const pa=v(a.x+sign*ox,a.y+sign*oy,a.z+19),pb=v(b.x+sign*ox,b.y+sign*oy,b.z+19);
      rails.push([pa,pb]);
      for(let i=0;i<=2;i++) {const p=mix(pa,pb,i/2);rails.push([v(p.x,p.y,p.z-19),p]);}
    }
    return points;
  }
  for(let i=0;i<3;i++) {
    const x=i*C.stride,y=-i*C.stride;
    const doorX=i===0?100:x+(i===2?100:50),doorLevel=i===2?C.lowerLevel:C.level;
    const holes=[{x0:doorX-14,x1:doorX+14,z0:doorLevel,z1:doorLevel+56}];
    if(i===0)holes.unshift({x0:16,x1:44,z0:50,z1:132});
    const outer=[v(x,y+C.wall,0),v(x+150,y+C.wall,0),v(x+150,y+C.wall,180),v(x,y+C.wall,180)];
    // The visible face is one compound polygon; its door reveals are real holes.
    const front={points:outer,kind:'wall',slice:i,wallPart:true,holes:holes.map(h=>[v(h.x0,y+C.wall,h.z0),v(h.x1,y+C.wall,h.z0),v(h.x1,y+C.wall,h.z1),v(h.x0,y+C.wall,h.z1)])};
    front.depth=outer.reduce((s,p)=>s+depth(p),0)/4;faces.push(front);
    const back={points:outer.map(p=>v(p.x,y,p.z)),kind:'back',slice:i,wallPart:true,holes:front.holes.map(h=>h.map(p=>v(p.x,y,p.z)))};
    back.depth=back.points.reduce((s,p)=>s+depth(p),0)/4;faces.push(back);
    face([v(x,y,180),v(x+150,y,180),v(x+150,y+C.wall,180),v(x,y+C.wall,180)],'edge',i,true);
    face([v(x+150,y,0),v(x+150,y+C.wall,0),v(x+150,y+C.wall,180),v(x+150,y,180)],'edge',i,true);
    holes.forEach(h=>{
      face([v(h.x0,y,h.z0),v(h.x0,y+C.wall,h.z0),v(h.x0,y+C.wall,h.z1),v(h.x0,y,h.z1)],'reveal',i,true);
      face([v(h.x1,y,h.z0),v(h.x1,y+C.wall,h.z0),v(h.x1,y+C.wall,h.z1),v(h.x1,y,h.z1)],'reveal',i,true);
      face([v(h.x0,y,h.z1),v(h.x1,y,h.z1),v(h.x1,y+C.wall,h.z1),v(h.x0,y+C.wall,h.z1)],'reveal',i,true);
    });
    box(doorX-14,doorX+14,y,y+C.wall,doorLevel-C.slab,doorLevel,'slab',i);
    walls.push({index:i,x,y,holes,outer});
  }
  // Stair runs normal to the wall (−Y), through the lower opening to a far-side landing.
  slab([v(16,132,0),v(44,132,0),v(44,110,0),v(16,110,0)]);
  const steps=16,run=144,rise=C.level/steps;
  for(let i=0;i<steps;i++) {
    const y0=110-i*run/steps,y1=y0-run/steps,z0=i*rise,z1=z0+rise;
    face([v(16,y0,z0),v(44,y0,z0),v(44,y0,z1),v(16,y0,z1)],'edge',0);
    face([v(16,y0,z1),v(44,y0,z1),v(44,y1,z1),v(16,y1,z1)],'slab',0);
    face([v(44,y0,z1),v(44,y1,z1),v(44,y1,z1-5),v(44,y0,z0-5)],'edge',0);
  }
  const landing=[v(16,-54,100),v(114,-54,100),v(114,0,100),v(86,0,100),v(86,-34,100),v(16,-34,100)];
  slab(landing);
  for(const x of [16,44]) {
    rails.push([v(x,110,19),v(x,-34,C.level+19)]);
    for(let i=0;i<=4;i++) {const y=110-i*36,z=i*C.level/4;rails.push([v(x,y,z),v(x,y,z+19)]);}
  }
  rails.push([v(16,-34,119),v(16,-54,119),v(114,-54,119),v(114,0,119)],[v(44,-34,119),v(86,-34,119),v(86,0,119)]);
  // The first connector wraps around the right edge, never through the solid first wall.
  const connector=[v(70,7,100),v(166,7,100),v(166,-113,100),v(202,-159,100),v(230,-159,100),v(194,-105,100),v(194,52,100),v(70,52,100)];
  slab(connector);
  for(let i=0;i<connector.length;i++) {
    if(i===0||i===3)continue;
    const a=connector[i],b=connector[(i+1)%connector.length],pa=v(a.x,a.y,119),pb=v(b.x,b.y,119);
    rails.push([pa,pb],[a,pa]);
  }
  rails.push([v(150,7,119),v(166,7,119)]);
  const bridges=[{from:v(100,7,100),to:v(216,-159,100),elevation:100,footprint:connector}];
  const secondA=v(216,-166,100),secondB=v(432,-325,C.lowerLevel);
  const ramp=walkway(secondA,secondB);bridges.push({from:secondA,to:secondB,elevation:null,kind:'descending-ramp',footprint:ramp});
  for(let i=0;i<2;i++) {
    for(const [cx,z,name] of [[0,0,'lower-left'],[150,0,'lower-right'],[0,180,'upper-left'],[150,180,'upper-right']]) {
      links.push({fromSlice:i,toSlice:i+1,corner:name,from:v(i*C.stride+cx,-i*C.stride, z),to:v((i+1)*C.stride+cx,-(i+1)*C.stride,z)});
    }
  }
  faces.sort((a,b)=>a.depth-b.depth);
  const exit=v(2*C.stride+100,-2*C.stride,C.lowerLevel),exitEnd=v(exit.x+76,exit.y-76,C.lowerLevel),exitFace=faces.length,exitRail=rails.length;
  walkway(exit,exitEnd);
  faces.slice(exitFace).forEach(f=>f.future=true);rails.slice(exitRail).forEach(r=>r.future=true);
  return {faces,rails,walls,bridges,links,stair:{start:v(30,110,0),end:v(30,-34,C.level),width:28,steps,run},landing};
}

function routeModel() {
  const points=[],stops=[],doors=[];
  const add=p=>{if(!points.length||Math.hypot(p.x-points.at(-1).x,p.y-points.at(-1).y,p.z-points.at(-1).z)>.0001)points.push(p);};
  const line=(a,b,steps=12)=>{for(let i=0;i<=steps;i++)add(mix(a,b,i/steps));};
  const bezier=(a,b,c,e,steps=25)=>{for(let i=0;i<=steps;i++){const t=i/steps,u=1-t;add(v(u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*e.x,u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*e.y,u*u*u*a.z+3*u*u*t*b.z+3*u*t*t*c.z+t*t*t*e.z));}};
  add(v(30,128,0));line(points.at(-1),v(30,110,0));
  for(let i=0;i<16;i++) {
    line(points.at(-1),v(30,110-i*9,(i+1)*6.25),2);
    line(points.at(-1),v(30,110-(i+1)*9,(i+1)*6.25),2);
  }
  bezier(points.at(-1),v(30,-50,100),v(100,-50,100),v(100,-34,100));
  line(points.at(-1),v(100,0,100));line(points.at(-1),v(100,7,100));
  doors.push({slice:0,index:points.length-1});stops.push(points.length-1);
  line(points.at(-1),v(100,24,100));
  bezier(points.at(-1),v(100,32,100),v(108,32,100),v(116,32,100));
  line(points.at(-1),v(168,32,100));
  bezier(points.at(-1),v(180,32,100),v(180,25,100),v(180,16,100));
  line(points.at(-1),v(180,-100,100));
  bezier(points.at(-1),v(180,-110,100),v(188,-120,100),v(194,-128,100));
  line(points.at(-1),v(216,-159,100));
  for(let i=1;i<3;i++) {
    const x=i*C.stride+(i===2?100:50),y=-i*C.stride,level=i===2?C.lowerLevel:C.level;
    if(i>1) {
      const a=points.at(-1),end=v(x,y+C.wall,level);
      // Gentle bend inside the bridge footprint, not a straight drawn-ahead guide.
      const c1=mix(a,end,.32),c2=mix(a,end,.7);c1.x+=3;c2.x-=3;
      bezier(a,c1,c2,end);
    }
    line(points.at(-1),v(x,y+7,level)); doors.push({slice:i,index:points.length-1});stops.push(points.length-1);
    line(points.at(-1),v(x,y,level));
  }
  const departureStart=points.length-1,a=points.at(-1);
  bezier(a,v(a.x+24,a.y-24,C.lowerLevel),v(a.x+52,a.y-52,C.lowerLevel),v(a.x+76,a.y-76,C.lowerLevel));
  let length=0;const distances=[0];
  for(let i=1;i<points.length;i++){const a=project(points[i-1]),b=project(points[i]);length+=Math.hypot(b.x-a.x,b.y-a.y);distances.push(length);}
  function at(distance) {
    const target=Math.max(0,Math.min(length,distance));let i=1;while(i<distances.length-1&&distances[i]<target)i++;
    return mix(points[i-1],points[i],(target-distances[i-1])/(distances[i]-distances[i-1]||1));
  }
  return {points,distances,length,stops:stops.map(i=>distances[i]),doors:doors.map(o=>({...o,distance:distances[o.index]})),departureStart:distances[departureStart],at};
}

// Clip a face against the figure's vertical plane to preserve real doorway occlusion.
function foreground(points,foot) {
  const out=[],limit=foot.x+foot.y+.1;
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],da=a.x+a.y-limit,db=b.x+b.y-limit;
    if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(mix(a,b,da/(da-db)));
  }
  return out;
}
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
function prepareFace(f) {
  const a=f.points[0];let normal;
  for(let i=2;i<f.points.length;i++) {
    const b=v(f.points[i-1].x-a.x,f.points[i-1].y-a.y,f.points[i-1].z-a.z),c=v(f.points[i].x-a.x,f.points[i].y-a.y,f.points[i].z-a.z);
    normal=v(b.y*c.z-b.z*c.y,b.z*c.x-b.x*c.z,b.x*c.y-b.y*c.x);
    if(Math.hypot(normal.x,normal.y,normal.z)>.001)break;
  }
  f.plane={normal,offset:dot(normal,a),ray:normal.x+normal.y+normal.z};
  f.screen=f.points.map(project);f.screenHoles=(f.holes??[]).map(h=>h.map(project));
  f.bounds={x0:Math.min(...f.screen.map(p=>p.x)),x1:Math.max(...f.screen.map(p=>p.x)),y0:Math.min(...f.screen.map(p=>p.y)),y1:Math.max(...f.screen.map(p=>p.y))};
  return f;
}
function clipNear(points,plane) {
  if(Math.abs(plane.ray)<.0001)return [];
  const out=[],value=p=>(dot(plane.normal,p)-plane.offset)/plane.ray-.015;
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],da=value(a),db=value(b);
    if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(mix(a,b,da/(da-db)));
  }
  return out;
}
function contains(p,polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
function visibleAt(p,faces) {
  const q=project(p);
  return !faces.some(f=>{
    const b=f.bounds,plane=f.plane;
    if(q.x<b.x0||q.x>b.x1||q.y<b.y0||q.y>b.y1||Math.abs(plane.ray)<.0001)return false;
    const t=(plane.offset-dot(plane.normal,p))/plane.ray;
    return t>.05&&contains(q,f.screen)&&!f.screenHoles.some(h=>contains(q,h));
  });
}
function visibleLine(points,faces) {
  let path='',active=false;
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/2);
    for(let j=0;j<=steps;j++) {const p=mix(a,b,j/steps),q=project(p);if(visibleAt(p,faces)){path+=`${active?'L':'M'}${n(q.x)} ${n(q.y)} `;active=true;}else active=false;}
  }
  return path;
}
const BODY='<path d="M0-34 3-30 1-26-2-27-3-31Z M-2-27 2-26 7-19 15-19 15-17 5-17 1-21 2-11-5-12Z"/>';
const LEGS='M-4-13H0L-3-6-11 0-8 2-9 3-14 0-6-8Z M0-13H3L7-1 12-2 13 0 5 2Z';

export function mountSlices(container,{layers,onSelect=()=>{},onNext=()=>{},nextLabel='下一段旅程'}={}) {
  if(!container||layers?.length!==3)throw new TypeError('Three layers and a container are required.');
  const doc=container.ownerDocument,win=doc.defaultView,id='slices-v6-'+ ++instances,g=geometry(),r=routeModel();
  const root=doc.createElement('div');root.className='journey-slices';
  const end=project(r.points.at(-1));
  const facePath=f=>poly(f.points)+(f.holes??[]).map(poly).join('');
  // Every surface is clipped by nearer geometry in camera space. Drawing walls first
  // and corridors last cannot represent a deck that wraps both in front of and behind a wall.
  g.faces.forEach(prepareFace);
  const maskDefs=[];
  const solids=g.faces.map((f,index)=>{
    const b=f.bounds,occluders=g.faces.filter(o=>o!==f&&o.bounds.x1>=b.x0&&o.bounds.x0<=b.x1&&o.bounds.y1>=b.y0&&o.bounds.y0<=b.y1).map(o=>{
      const points=clipNear(o.points,f.plane);if(points.length<3)return '';
      return `<path d="${poly(points)+(o.holes??[]).map(h=>clipNear(h,f.plane)).filter(h=>h.length>=3).map(poly).join('')}"/>`;
    }).join('');
    if(occluders)maskDefs.push(`<mask id="${id}-surface-${index}" maskUnits="userSpaceOnUse" x="0" y="0" width="1160" height="410" style="mask-type:luminance"><rect width="1160" height="410" fill="white"/><g fill="black" fill-rule="evenodd">${occluders}</g></mask>`);
    return `<path class="architecture-face face-${f.kind}${f.kind==='reveal'?' door-reveal':''}" data-building-index="${f.slice}" data-selected="false" d="${facePath(f)}" fill-rule="evenodd"${occluders?` mask="url(#${id}-surface-${index})"`:''}${f.future?' opacity=".26"':''}/>`;
  }).join('');
  const measure=doc.createElement('canvas').getContext('2d'),family=win.getComputedStyle(container).fontFamily;
  const wrap=(value,width,size)=>{
    measure.font=`${size}px ${family}`;const lines=[];let line='';
    for(const token of value.match(/[^\s—]+—?\s*|\s+/g)??[]) {
      if(line&&measure.measureText(line+token).width>width){lines.push(line);line='';}
      for(const char of token){if(line&&measure.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}
    }
    if(line)lines.push(line);return lines;
  };
  root.innerHTML=`<style>${CSS}</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 1160 320" role="group" aria-labelledby="${id}-title ${id}-desc">
    <title id="${id}-title">楼梯与空中连廊串联的三个建筑切片</title>
    <desc id="${id}-desc">从首片左侧垂直上楼穿下门，门后平台转向穿上门；实心楼板绕墙连接第二片，再沿缓坡下行至右下方第三门。完整名称和时间贴在墙面。点击体块，小人沿路径行走，下方展开经历。</desc>
    <defs><mask id="${id}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1160" height="410" style="mask-type:luminance"><rect width="1160" height="410" fill="white"/><g data-occluders fill="black" fill-rule="evenodd"></g></mask>
    <mask id="${id}-trail-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1160" height="410" style="mask-type:luminance"><path d="${visibleLine(r.points,g.faces)}" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/></mask>
    ${maskDefs.join('')}</defs>
    <g aria-hidden="true" pointer-events="none">${g.links.map((l,i)=>`<path class="corner-guide" data-corner-connection="${i}" d="${d([l.from,l.to])}"/>`).join('')}</g>
    <g aria-hidden="true" pointer-events="none">${solids}</g>
    <g aria-hidden="true" pointer-events="none">${g.rails.map(points=>`<path class="architecture-rail" d="${visibleLine(points,g.faces)}"${points.future?' opacity=".26"':''}/>`).join('')}</g>
    <path class="walk-trail" data-walk-route d="${d(r.points)}" mask="url(#${id}-trail-mask)" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="1000" aria-hidden="true"/>
    <g mask="url(#${id}-mask)" aria-hidden="true"><g class="slice-walker" data-walker><g data-direction>${BODY}<path data-legs d="${LEGS}"/></g></g></g>
    ${layers.map((layer,i)=>{
      const base=project(v(i*C.stride,-i*C.stride,0)),x=base.x-7;
      // First two plaques sit below the bridge silhouette; the lower third doorway
      // leaves a clean upper-left area. Keep all text outside the projected circulation.
      const anchor=project(v(i*C.stride+(i===0?44:12),-i*C.stride+C.wall,i===2?160:35)),textWidth=i===0?106:126;
      const titleLines=wrap(layer.name,textWidth,18),timeLines=wrap(layer.time,i===2?70:textWidth,12);
      return `<g class="slice-button" data-slice="${esc(layer.id)}" data-index="${i}" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(layer.name)} ${esc(layer.time)}">
        <title>${esc(layer.name)}</title>
        <g data-panel-label transform="matrix(${n(C.scale*COS)} ${C.scale*.5} 0 ${C.scale} ${n(anchor.x)} ${n(anchor.y)})">
          <text class="slice-label" aria-label="${esc(layer.name)}">${titleLines.map((line,j)=>`<tspan x="0" y="${j*22}">${esc(line)}</tspan>`).join('')}</text>
          <text class="slice-time" aria-label="${esc(layer.time)}">${timeLines.map((line,j)=>`<tspan x="0" y="${titleLines.length*22+j*17}">${esc(line)}</tspan>`).join('')}</text>
        </g>
        <rect class="slice-hit" x="${n(i===0?60:x-6)}" y="50" width="${i===0?x+155:200}" height="300"/><rect class="slice-focus" x="${n(i===0?60:x-6)}" y="50" width="${i===0?x+155:200}" height="300"/>
      </g>`;
    }).join('')}
    <path class="next-whisper departure-path" data-departure-path data-ready="false" d="${d(r.points.filter((_,i)=>r.distances[i]>=r.departureStart))}" aria-hidden="true"/>
    <g class="slice-next" data-next data-ready="false" role="button" tabindex="-1" aria-hidden="true" aria-label="${esc(nextLabel)}">
      <title>${esc(nextLabel)}</title>
      <g class="next-dots" transform="translate(${n(end.x)} ${n(end.y)})"><circle cx="-6" r="1.5"/><circle r="1.5"/><circle cx="6" r="1.5"/></g>
      <text class="next-label" x="${n(end.x)}" y="${n(end.y+26)}" text-anchor="middle">${esc(nextLabel)}</text>
      <rect class="slice-hit" x="${n(end.x-40)}" y="${n(end.y-30)}" width="80" height="70"/><rect class="slice-focus" x="${n(end.x-40)}" y="${n(end.y-30)}" width="80" height="70"/>
    </g></svg>`;
  container.append(root);
  const buttons=[...root.querySelectorAll('[data-slice]')],walker=root.querySelector('[data-walker]'),dir=root.querySelector('[data-direction]'),legs=root.querySelector('[data-legs]'),trail=root.querySelector('[data-walk-route]'),mask=root.querySelector('[data-occluders]'),next=root.querySelector('[data-next]');
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)'),removers=[];
  let selected=-1,distance=0,frame=0,token=0,moving=false,destroyed=false,departing=false,ready=false,direction=1;
  function listen(el,event,fn){el.addEventListener(event,fn);removers.push(()=>el.removeEventListener(event,fn));}
  function setReady(value){ready=value;next.dataset.ready=String(value);root.querySelector('[data-departure-path]').dataset.ready=String(value);next.setAttribute('tabindex',value?'0':'-1');next.setAttribute('aria-hidden',String(!value));}
  function paint(value,walk=false) {
    const before=project(r.at(distance));distance=value;const foot=r.at(value),p=project(foot),dx=p.x-before.x;
    if(Math.abs(dx)>.1)direction=dx<0?-1:1;
    walker.setAttribute('transform',`translate(${n(p.x)} ${n(p.y)})`);dir.setAttribute('transform',`scale(${direction*.86} .86)`);
    trail.setAttribute('stroke-dashoffset',n(1000*(1-value/r.length)));
    mask.innerHTML=g.faces.map(f=>{
      const points=foreground(f.points,foot);if(points.length<3)return '';
      return `<path d="${poly(points)+(f.holes??[]).map(h=>foreground(h,foot)).filter(h=>h.length>=3).map(poly).join('')}"/>`;
    }).join('');
    if(walk){const s=Math.sin(value*.26)*5;legs.setAttribute('d',`M-4-13H0L${n(-s*.5)}-6 ${n(-s-4)} 1H${n(-s-8)}L-5-7Z M0-13H3L${n(s*.5+2)}-6 ${n(s+7)} 0H${n(s+3)}L0-6Z`);}else legs.setAttribute('d',LEGS);
  }
  function cancel(){token++;if(frame)win.cancelAnimationFrame(frame);frame=0;moving=false;departing=false;walker.style.opacity='1';}
  function move(target,animate=true,done=()=>{}) {
    const origin=distance,delta=target-origin,run=++token;setReady(false);
    if(!animate||reduced.matches||Math.abs(delta)<.1){paint(target);moving=false;done();return;}
    moving=true;let start;const duration=Math.max(350,Math.min(3800,Math.abs(delta)*5.3));
    const step=t=>{
      if(destroyed||run!==token)return;start??=t;const progress=Math.min(1,(t-start)/duration),smooth=progress*progress*(3-2*progress);
      paint(origin+delta*smooth,progress<1);
      if(departing)walker.style.opacity=String(Math.min(1,(1-progress)*4));
      if(progress<1)frame=win.requestAnimationFrame(step);else{frame=0;moving=false;paint(target);done();}
    };frame=win.requestAnimationFrame(step);
  }
  function select(index,{animate=true}={}) {
    if(destroyed)return inspect();if(!Number.isInteger(index)||index< -1||index>2)throw new RangeError('Selection must be -1, 0, 1 or 2.');
    cancel();selected=index;buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));root.dataset.selectedIndex=index;
    root.querySelectorAll('[data-building-index]').forEach(f=>f.dataset.selected=String(Number(f.dataset.buildingIndex)===index&&index>=0));
    move(index<0?0:r.stops[index],animate,()=>setReady(index===2));return inspect();
  }
  function inspect(){return {selectedIndex:selected,selectedId:layers[selected]?.id??null,moving,animating:moving,departing,distance,nextVisible:ready,reducedMotion:reduced.matches,destroyed,count:3,position:project(r.at(distance)),worldPosition:r.at(distance),
    geometry:{projection:{type:'isometric',axes:[[COS,.5],[-COS,.5],[0,-1]],scale:C.scale},sliceThickness:C.wall,stairsBySlice:[1,0,0],bridgeElevation:C.level,bridges:g.bridges,stair:g.stair,walls:g.walls,landing:g.landing,walkableSurfaces:g.faces.filter(f=>f.kind==='slab').map(f=>({points:f.points})),viewBox:[0,40,1160,320]},
    cornerConnections:g.links,route:{points:r.points,stops:r.stops,length:r.length,drawnFraction:distance/r.length},crossedThresholds:r.doors.filter(p=>p.distance<=distance).map(p=>p.slice)};}
  buttons.forEach((b,i)=>{
    const hover=active=>root.querySelectorAll(`[data-building-index="${i}"]`).forEach(f=>f.dataset.hovered=String(active));
    listen(b,'pointerenter',()=>hover(true));listen(b,'pointerleave',()=>hover(false));listen(b,'focus',()=>hover(true));listen(b,'blur',()=>hover(false));
    listen(b,'click',()=>{if(!departing)onSelect(i);});
    listen(b,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat&&!departing)onSelect(i);}else if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowLeft'?2:1))%3].focus({preventScroll:true});}});
  });
  const leave=()=>{if(!ready||moving||destroyed)return;departing=true;move(r.length,true,()=>{walker.style.opacity='0';departing=false;onNext();});};
  listen(next,'click',leave);listen(next,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)leave();}else if(e.key==='ArrowLeft'){e.preventDefault();buttons[2].focus();}});
  listen(reduced,'change',()=>{if(reduced.matches){const leaving=departing;cancel();paint(leaving?r.length:selected<0?0:r.stops[selected]);if(leaving)onNext();else setReady(selected===2);}});
  paint(0);
  return {select,inspect,destroy(){cancel();destroyed=true;removers.forEach(fn=>fn());root.remove();}};
}
export default mountSlices;
