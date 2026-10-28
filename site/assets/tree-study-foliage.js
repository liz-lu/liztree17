/**
 * Render-only foliage territories. The generated botanical model is immutable:
 * a whole fine-twig spray is translated together, including its growth/wind
 * anchors. Four functional groups and every original blade remain intact.
 * These are world-space volumes, never camera-dependent screen-space masks.
 */
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,k)=>a.map(v=>v*k);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const groups=['campus','internships','projects'];

function randomFor(key){
 let n=2166136261;
 for(let i=0;i<key.length;i++)n=Math.imul(n^key.charCodeAt(i),16777619);
 return ()=>{n=Math.imul(n^n>>>16,2246822507);n=Math.imul(n^n>>>13,3266489909);n^=n>>>16;return(n>>>0)/4294967296;};
}
function onBranch(branch,t){
 const along=clamp(t,0,1)*(branch.points.length-1),i=Math.min(branch.points.length-2,Math.floor(along));
 return mix(branch.points[i],branch.points[i+1],along-i);
}
function nearest(point,branches){
 // This runs for each blade; avoid millions of temporary vector allocations.
 let best=Infinity,x=0,y=0,z=0,radius=0,owner=null;
 for(const branch of branches)for(let i=0;i<branch.points.length-1;i++){
  const a=branch.points[i],b=branch.points[i+1];
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
  const t=clamp(((point[0]-a[0])*dx+(point[1]-a[1])*dy+(point[2]-a[2])*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);
  const px=a[0]+dx*t,py=a[1]+dy*t,pz=a[2]+dz*t;
  const ex=point[0]-px,ey=point[1]-py,ez=point[2]-pz,distance=ex*ex+ey*ey+ez*ez;
  if(distance<best){best=distance;x=px;y=py;z=pz;owner=branch;
   radius=branch.radii[i]+(branch.radii[i+1]-branch.radii[i])*t;}
 }
 return {distance:Math.sqrt(best),point:[x,y,z],radius,branch:owner};
}

export function buildFoliageLayout(model,structure){
 const mains=Object.fromEntries([...groups,'future'].map(g=>[g,structure.find(b=>b.id===`${g}-main`)]));
 const supports=Object.fromEntries(groups.map(g=>[g,structure.filter(b=>b.group===g&&!b.id.includes('-shoot-'))]));
 const sprays=new Map();
 model.leaves.forEach((leaf,index)=>{
  if(!sprays.has(leaf.parentId))sprays.set(leaf.parentId,{group:leaf.group,entries:[]});
  sprays.get(leaf.parentId).entries.push({leaf,index});
 });
 const leaves=new Array(model.leaves.length),stats={total:model.leaves.length,moved:0,groups:{}};
 for(const group of groups)stats.groups[group]={count:0,moved:0,lowerBefore:0,lowerAfter:0,
  foreignNearBefore:0,foreignNearAfter:0,minForeignClearance:Infinity};

 for(const [parentId,spray] of sprays){
  const group=spray.group,entries=spray.entries;
  // The next-station buds stay exactly where the botanical generator put them.
  if(group==='future'){for(const {leaf,index}of entries)leaves[index]=leaf;continue;}
  const main=mains[group],own=supports[group],foreign=Object.entries(mains).filter(([g])=>g!==group).map(([,b])=>b);
  const random=randomFor(parentId),seed=[random(),random(),random(),random(),random()];
  const center=mul(entries.reduce((sum,{leaf})=>add(sum,leaf.center),[0,0,0]),1/entries.length);
  const spread=Math.max(...entries.map(({leaf})=>Math.hypot(...sub(leaf.center,center))+leaf.length*.5));
  const angle=Math.atan2(main.points.at(-1)[2],main.points.at(-1)[0]);
  const radial=[Math.cos(angle),0,Math.sin(angle)],across=[-radial[2],0,radial[0]];
  const deltaAngle=wrap(Math.atan2(center[2],center[0])-angle),r=Math.hypot(center[0],center[2]);
  const territory=smooth(.72,1.50,Math.abs(deltaAngle));
  const foreignStart=nearest(center,foreign);
  const crowded=1-smooth(24+spread,50+spread,foreignStart.distance-foreignStart.radius);
  const relocate=Math.max(territory,crowded);
  // Out-of-sector infill used to wrap 360 degrees around the shared trunk.
  // Rehome those sprays inside their own limb's continuous, irregular fan.
  // No clipping/deletion and no hard planar sector boundary is involved.
  const targetAngle=angle+deltaAngle*(1-territory)+(seed[0]-.5)*1.50*territory;
  const targetRadius=r*(1-relocate)+(67+Math.sqrt(seed[1])*123)*relocate;
  let target=[Math.cos(targetAngle)*targetRadius,center[1],Math.sin(targetAngle)*targetRadius];
  const shoulder=onBranch(main,.58)[1];
  // Keep the crown attached to each staggered limb, not the taller neighbour.
  // The middle remains full; upper overflow becomes softer lower leaf layers.
  target[1]=shoulder+(center[1]-shoulder)*.84-7-relocate*12;
  if(relocate>.2&&seed[2]<.34){
   const boughs=own.filter(b=>b.id.includes('-outreach-bough-'));
   const bough=boughs[Math.floor(seed[3]*boughs.length)];
   const perch=onBranch(bough,.36+seed[1]*.60);
   const lower=add(perch,add(mul(across,(seed[0]-.5)*55),[0,-16+seed[4]*43,0]));
   target=mix(target,lower,relocate);
  }
  // Visible supports and the retained small sprays form one connected crown.
  // A soft leash prevents a relocated cluster floating away from its limb.
  const support=nearest(target,own),reach=46+seed[4]*18;
  if(support.distance>reach)target=add(support.point,mul(unit(sub(target,support.point)),reach));
  // Valid sprays keep their established high crown and silhouette. Only the
  // overlapping/wrong-side sprays are redistributed, not the entire canopy.
  target=mix(center,target,relocate);
  // Reserve a narrow 3D corridor around foreign main limbs, including future.
  // Move a complete spray, not individual blades, so leaf scales and their
  // attachment pattern never deform and the foliage edge stays organic.
  for(let pass=0;pass<5;pass++){
   const near=nearest(target,foreign),clearance=26+spread+near.radius;
   if(near.distance>=clearance)break;
   const away=unit(add(sub(target,near.point),mul(radial,12)));
   target=add(target,mul(away,clearance-near.distance+2));
  }
  const displacement=sub(target,center),moved=Math.hypot(...displacement)>1;
  const groupStats=stats.groups[group],lowerY=main.points.at(-1)[1]-8;
  for(const {leaf,index}of entries){
   const position=add(leaf.center,displacement),anchor=add(leaf.base,displacement);
   const ownDistance=nearest(position,[main]).distance;
   const before=nearest(leaf.center,foreign),after=nearest(position,foreign);
   // Source identity and parent timing are retained. Both leaf and anchor move
   // by the same vector, preserving the full blade and local wind articulation.
   leaves[index]={...leaf,center:position,base:anchor,sourceIndex:index,
    sourceParentId:leaf.parentId,renderShade:clamp(.96-ownDistance/124+leaf.shade*.10,.08,.97)};
   groupStats.count++;
   if(moved){groupStats.moved++;stats.moved++;}
   if(leaf.center[1]<lowerY)groupStats.lowerBefore++;
   if(position[1]<lowerY)groupStats.lowerAfter++;
   if(before.distance-before.radius<24)groupStats.foreignNearBefore++;
   if(after.distance-after.radius<24)groupStats.foreignNearAfter++;
   groupStats.minForeignClearance=Math.min(groupStats.minForeignClearance,after.distance-after.radius);
  }
 }
 return {leaves,stats};
}
