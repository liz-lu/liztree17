/**
 * Render-only scaffold, following the user's brown structural sketch.
 * The dense model remains untouched: it owns original leaf data, growth
 * timing and group membership. Foliage layout may translate whole sprays.
 * Hidden sprays are not drawn as visible tubes.
 */
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,k)=>a.map(v=>v*k);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const unit=a=>mul(a,1/(Math.hypot(...a)||1));

function onBranch(branch,t){
 const along=Math.max(0,Math.min(1,t))*(branch.points.length-1);
 const index=Math.min(branch.points.length-2,Math.floor(along));
 return {point:mix(branch.points[index],branch.points[index+1],along-index),
  radius:branch.radii[index]+(branch.radii[index+1]-branch.radii[index])*(along-index)};
}

function cubic(a,b,c,d,count){
 return Array.from({length:count},(_,i)=>{
  const t=i/(count-1),s=1-t;
  return a.map((v,k)=>s*s*s*v+3*s*s*t*b[k]+3*s*t*t*c[k]+t*t*t*d[k]);
 });
}

function keepBranch(branch){
 const id=branch.id;
 if(id==='trunk'||id.startsWith('root-')||id.endsWith('-main'))return true;
 // Four spaced laterals per mature limb, plus the two established outward arcs.
 if(/^(campus|internships|projects)-secondary-(2|4|9|13)$/.test(id))return true;
 if(/^future-secondary-[1-3]$/.test(id))return true;
 if(/-outreach-bough-\d+$/.test(id))return true;
 // A small number of short forks keeps the scaffold natural without needles.
 if(/-outreach-shoot-\d+-(0|1)$/.test(id))return true;
 return /^(campus|internships|projects)-shoot-(2-0|4-3|9-2)$/.test(id);
}

export function buildVisibleStructure(model){
 const visible=[];
 const byId=new Map();
 for(const original of model.branches){
  if(!keepBranch(original))continue;
  if(original.id==='trunk'||original.id.startsWith('root-')){
   visible.push(original);byId.set(original.id,original);continue;
  }
  const parent=byId.get(original.parentId);
  if(!parent)throw new Error(`Visible scaffold is missing parent: ${original.id}`);
  const joint=onBranch(parent,original.attachT),start=joint.point;
  let end=original.points.at(-1).slice();
  const main=original.id.endsWith('-main');
  const shortFork=original.id.includes('-shoot-');
  let outward;
  if(main){
   // A single tapering gesture replaces the old curled / S-shaped tip.
   outward=unit(sub(end,start));
  }else{
   const originalDelta=sub(end,original.points[0]);
   const radial=unit([start[0],0,start[2]]);
   // Future's short crown forks may fan left and right around its upright axis.
   outward=original.group==='future'?unit([originalDelta[0],0,originalDelta[2]]):radial;
   let delta=sub(end,start);
   const minimum=shortFork?5:Math.max(10,Math.hypot(...delta)*.15);
   const projection=dot(delta,outward);
   if(projection<minimum)end=add(end,mul(outward,minimum-projection));
   delta=sub(end,start);
   if(shortFork&&Math.hypot(...delta)>27)end=add(start,mul(unit(delta),27));
  }
  const delta=sub(end,start),length=Math.hypot(...delta);
  const across=unit([-delta[2],0,delta[0]]);
  const side=(original.id.length%2?1:-1)*Math.min(3,length*.025);
  const lift=main?Math.min(9,length*.045):Math.min(5,length*.06);
  const a=add(add(mix(start,end,.29),[0,lift,0]),mul(across,side));
  const b=add(add(mix(start,end,.73),[0,lift*.35,0]),mul(across,side*.55));
  // The Bezier controls advance monotonically along the outward direction.
  // Its last segment can slope down slightly, but never curls into the crown.
  for(const [control,fraction] of [[a,.29],[b,.73]]){
   const expected=dot(delta,outward)*fraction;
   const drift=dot(sub(control,start),outward)-expected;
   for(let axis=0;axis<3;axis++)control[axis]-=outward[axis]*drift;
  }
  const scale=Math.min(1,joint.radius*.78/original.radii[0]);
  const branch={...original,
   points:cubic(start,a,b,end,original.points.length),
   radii:original.radii.map(radius=>radius*scale),
  };
  visible.push(branch);byId.set(branch.id,branch);
 }
 return visible;
}

// Alias for callers interested only in the visible branch collection.
export const selectVisibleBranches=buildVisibleStructure;
