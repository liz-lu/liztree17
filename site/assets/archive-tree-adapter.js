import { createTree as createBTree } from '../modules/tree-v4/index.js?v=archive-20261105-1';

// B owns the selected cut model, materials and six authored projection anchors.
export async function createTree(container, options = {}) {
  const tree=await createBTree(container, {
    ...options,
    assetUrl: new URL('../modules/tree-v4/growth-tree-cut.glb', import.meta.url).href,
    viewHeight: 1.48,
    viewWidth: 1.23,
    pixelRatio: 1.25
  });
  // Twice B's default oscillation rate, while retaining hover/focus and reader pauses.
  let stopped=false,disposed=false,raf=0,last=performance.now(),phase=0,center=0,lastAngle=null,ready=false;
  function tick(now){
    if(disposed)return;raf=requestAnimationFrame(tick);const dt=Math.min(.1,(now-last)/1000);last=now;
    const stats=tree.getStats();if(!stats.ready)return;
    if(!ready){if(stats.elapsed<3.2)return;ready=true;center=stats.yaw*180/Math.PI;tree.pause();}
    if(stopped||options.reducedMotion||document.hidden||stats.hovered||stats.focused)return;
    const current=stats.yaw*180/Math.PI;
    if(lastAngle!==null&&Math.abs(current-lastAngle)>.2)center=current-Math.sin(phase)*25;
    phase+=dt*Math.PI/5;lastAngle=center+Math.sin(phase)*25;tree.setAngle(lastAngle);
  }
  raf=requestAnimationFrame(tick);
  return {...tree,
    pause(){stopped=true;tree.pause();},
    resume(){stopped=false;if(!ready)tree.resume();else tree.pause();},
    select(id){tree.select(id);if(id!==null)stopped=true;},
    dispose(){disposed=true;cancelAnimationFrame(raf);tree.dispose();}
  };
}
