import * as THREE from './vendor/three.module.js?v=archive-20261109-playback-1';
import { createExhibitionRoom } from './exhibition-room.js?v=archive-20261109-playback-1';
// A white gallery with broad windows and narrow dark reflection cards.
// These objects only enter the environment probe, never the visible scene.
export function createGlassStudio(){
  const scene=new THREE.Scene();scene.background=new THREE.Color(.22,.23,.24);
  const resources=[];
  function panel(position,size,color){
    const g=new THREE.PlaneGeometry(...size),m=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
    const o=new THREE.Mesh(g,m);o.position.set(...position);o.lookAt(0,0,0);scene.add(o);resources.push(g,m);return o;
  }
  panel([-3,2,3],[2.2,5],new THREE.Color(3.4,2.85,2.25));
  panel([3,1,1],[1.4,4],new THREE.Color(.065,.08,.07));
  panel([2,3,-2],[1.1,4],new THREE.Color(2.4,2.5,2.45));
  panel([0,4,0],[4,2],new THREE.Color(2.1,2.1,2.1));
  panel([-2,-1,-3],[2.2,3],new THREE.Color(.38,.42,.4));
  panel([-.55,.3,3],[.22,3.1],new THREE.Color(5,4.2,3.35));
  panel([.26,.3,3],[.12,3.1],new THREE.Color(3,3,3));
  const architecture=createExhibitionRoom({probe:true});scene.add(architecture);
  architecture.traverse(o=>{if(o.geometry)resources.push(o.geometry);if(o.material)resources.push(o.material);});
  scene.dispose=()=>resources.forEach(r=>r.dispose());return scene;
}
