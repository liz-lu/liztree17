import * as THREE from './vendor/three.module.js?v=archive-20261109-layout-1';

/** White exhibition room; spatial joints and glass reflections provide depth. */
export function createExhibitionRoom({probe=false,blendColor=null}={}){
  const group=new THREE.Group();group.name='Exhibition room / environment only';
  const wall=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false});
  wall.onBeforeCompile=shader=>{
    shader.uniforms.galleryLight={value:new THREE.Color('#ffffff')};shader.uniforms.galleryShade={value:new THREE.Color('#ffffff')};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGalleryPosition;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvGalleryPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vGalleryPosition;\nuniform vec3 galleryLight;\nuniform vec3 galleryShade;').replace('#include <color_fragment>','#include <color_fragment>\nvec3 lightDistance = (vGalleryPosition - vec3(-0.9, 1.1, -0.6)) * vec3(0.65, 0.60, 0.35);\nfloat broadLight = exp(-dot(lightDistance, lightDistance));\ndiffuseColor.rgb = mix(galleryShade, galleryLight, 0.25 + 0.75 * broadLight);');
  };
  wall.customProgramCacheKey=()=> 'white-room-4';
  const floor=wall,ceiling=wall;
  function plane(w,h,position,rotation,material){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);m.position.set(...position);m.rotation.set(...rotation);m.receiveShadow=false;m.castShadow=false;group.add(m);return m;}
  const x=1.5,front=1.15,back=-1.15,bottom=-.40,top=1.52;
  plane(x*2,top-bottom,[0,(top+bottom)/2,back],[0,0,0],wall);
  plane(front-back,top-bottom,[-x,(top+bottom)/2,(front+back)/2],[0,Math.PI/2,0],wall);
  plane(front-back,top-bottom,[x,(top+bottom)/2,(front+back)/2],[0,-Math.PI/2,0],wall);
  plane(x*2,front-back,[0,bottom,(front+back)/2],[-Math.PI/2,0,0],floor);
  plane(x*2,front-back,[0,top,(front+back)/2],[Math.PI/2,0,0],ceiling);
  const vertices=[];function edge(a,b){vertices.push(...a,...b);}
  for(const side of [-x,x]){
    edge([side,bottom,front],[side,bottom,back]);edge([side,bottom,back],[side,top,back]);edge([side,top,back],[side,top,front]);
  }
  for(const y of [bottom,top])edge([-x,y,back],[x,y,back]);
  // A small number of structural joints define depth, without a decorative grid.
  for(const px of [-.75,.75]){edge([px,bottom+.001,front],[px,bottom+.001,back]);edge([px,top-.001,front],[px,top-.001,back]);}
  edge([-x,bottom+.001,-.3],[x,bottom+.001,-.3]);
  const lines=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),new THREE.LineBasicMaterial({color:0x9aa9aa,transparent:true,opacity:probe?.26:.18}));group.add(lines);
  // Recessed wall lights give the optical shell something spatial to reflect.
  const warm=new THREE.MeshBasicMaterial({color:new THREE.Color(probe?2:1,probe?2:1,probe?2:1),toneMapped:false});
  const cool=new THREE.MeshBasicMaterial({color:new THREE.Color(probe?1.5:1,probe?1.5:1,probe?1.5:1),toneMapped:false});
  plane(.015,1.50,[-1.495,.55,-.80],[0,Math.PI/2,0],warm);
  plane(.015,1.50,[1.495,.55,-.80],[0,-Math.PI/2,0],cool);
  const softbox=new THREE.MeshBasicMaterial({color:new THREE.Color(probe?2.2:1,probe?2.2:1,probe?2.2:1),toneMapped:false});
  for(const px of [-.85,0,.85])plane(.55,.72,[px,top-.003,-.30],[Math.PI/2,0,0],softbox);
  if(blendColor){
    // Blend only the room into the host palette. The tree, glass and projected
    // interaction anchors keep their full contrast, including near the edges.
    const edgeMaterials=new Set();group.traverse(o=>{if(o.material)edgeMaterials.add(o.material);});
    for(const material of edgeMaterials){
      const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
      material.toneMapped=false;
      material.onBeforeCompile=shader=>{
        previous.call(material,shader);
        shader.uniforms.galleryHostColor={value:new THREE.Color(blendColor)};
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec4 vGalleryClip;').replace('#include <project_vertex>','#include <project_vertex>\nvGalleryClip = gl_Position;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec4 vGalleryClip;\nuniform vec3 galleryHostColor;').replace('#include <opaque_fragment>',`vec2 galleryUV = vGalleryClip.xy / vGalleryClip.w * 0.5 + 0.5;
          vec2 galleryInset = min(galleryUV, 1.0 - galleryUV);
          float galleryEdge = smoothstep(0.0, 0.15, galleryInset.x) * smoothstep(0.0, 0.12, galleryInset.y);
          ${material.isLineBasicMaterial?'diffuseColor.a *= galleryEdge;':'outgoingLight = mix(galleryHostColor, outgoingLight, galleryEdge);'}
          #include <opaque_fragment>`);
      };
      material.customProgramCacheKey=()=>previousKey+'-host-edge-blend-1';
    }
  }
  group.userData.environmentOnly=true;return group;
}
