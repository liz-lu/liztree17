import { createTree as createBTree } from '../modules/tree-v4/index.js?v=archive-20261109-layout-1';

// B owns the selected cut model, materials and six authored projection anchors.
export async function createTree(container, options = {}) {
  const tree=await createBTree(container, {
    ...options,
    assetUrl: new URL('../modules/tree-v4/growth-tree-cut.glb', import.meta.url).href,
    viewHeight: 1.48,
    viewWidth: 1.23,
    pixelRatio: 1.25
  });
  // One capped presentation clock. Hover/focus is not an instruction to stop.
  let stopped=false,disposed=false,raf=0,last=0,lastDraw=0,phase=0,center=0,lastAngle=null,ready=false;
  let reduced=!!options.reducedMotion;
  const snapshot=()=>tree.getMotionState?.()||tree.getStats();
  function wake(){if(!disposed&&!stopped&&!reduced&&!raf){last=0;raf=requestAnimationFrame(tick);}}
  function tick(now){
    raf=0;if(disposed||stopped||reduced)return;
    raf=requestAnimationFrame(tick);
    if(now-lastDraw<1000/30)return;
    const dt=last?Math.min(.1,(now-last)/1000):0;last=now;lastDraw=now;
    const stats=snapshot();if(!stats.ready)return;
    if(!ready){if(stats.elapsed<3.2)return;ready=true;center=stats.yaw*180/Math.PI;tree.pause();}
    if(document.hidden||stats.dragging)return;
    const current=stats.yaw*180/Math.PI;
    if(lastAngle!==null&&Math.abs(current-lastAngle)>.2)center=current-Math.sin(phase)*25;
    phase+=dt*Math.PI/5;lastAngle=center+Math.sin(phase)*25;tree.setAngle(lastAngle);
  }
  wake();
  return {...tree,
    pause(){stopped=true;cancelAnimationFrame(raf);raf=0;last=0;tree.pause();},
    resume(){stopped=false;if(!ready)tree.resume();else tree.pause();wake();},
    setReducedMotion(value){reduced=!!value;tree.setReducedMotion?.(reduced);if(reduced){cancelAnimationFrame(raf);raf=0;}else wake();},
    select(id){tree.select(id);},
    dispose(){disposed=true;cancelAnimationFrame(raf);tree.dispose();}
  };
}
