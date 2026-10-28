// Keep browser navigation/history native; fade only the new tree scene.
(() => {
  // Lightweight before-paint fallback; never builds the tree or changes progress.
  if(!location.pathname.endsWith('/tree-study.html'))return;
  const root=document.documentElement;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  root.dataset.handoffSupport='fade';
  if(!reduced.matches)root.classList.add('tree-preparing');
  let released=false;
  function reveal(){
    if(released)return;released=true;
    clearTimeout(timeout);
    root.dataset.treeReady='true';
    root.classList.remove('tree-preparing');
    if(!reduced.matches)root.classList.add('tree-arrived');
  }
  const timeout=setTimeout(reveal,5000);
  window.addEventListener('journey:tree-ready',reveal,{once:true});
  window.addEventListener('pageshow',event=>{
    if(event.persisted){reveal();root.classList.remove('tree-preparing','tree-arrived');}
  });
  reduced.addEventListener('change',()=>{if(reduced.matches){reveal();root.classList.remove('tree-arrived');}});
})();
