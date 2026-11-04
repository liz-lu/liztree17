// A-owned native interface drawings. Decorative motion is never a skill score.
export function mountMicrographics(){
  // Human-machine interaction artwork and motion are supplied by D.
  const skills=document.querySelector('[data-motion-graphic="skills"]');
  if(skills){
    let bars='';for(let i=0;i<3;i++)bars+=`<rect class="scope-bar" x="${16+i*32}" y="78" width="18" height="58" style="--n:${i}"/>`;
    skills.innerHTML=`<svg viewBox="0 0 114 148"><path class="scope-grid" d="M1 1h112v146H1z M1 68h112 M1 82h112 M1 96h112 M1 110h112 M1 124h112 M1 138h112"/><g class="scope-orbit"><ellipse cx="57" cy="34" rx="27" ry="15"/><ellipse cx="57" cy="34" rx="27" ry="15" transform="rotate(60 57 34)"/><ellipse cx="57" cy="34" rx="27" ry="15" transform="rotate(120 57 34)"/></g>${bars}</svg>`;
  }
  document.querySelectorAll('.method-list button i').forEach((host,row)=>{
    host.replaceChildren();for(let j=0;j<24;j++){const dot=document.createElement('b');dot.style.setProperty('--delay',`${-((j*7+row*3)%24)/6}s`);host.append(dot);}
  });
  const future=document.querySelector('[data-motion-graphic="future"]');
  if(future)future.innerHTML=`<svg viewBox="0 0 220 146" aria-hidden="true"><defs><pattern id="micro-space-dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#278767" opacity=".22"/></pattern></defs><rect width="220" height="146" fill="url(#micro-space-dots)" stroke="none"/><g class="digital-core"><path d="m20 60 22-13 22 13v26L42 99 20 86Z M20 60l22 13 22-13M42 73v26"/><rect x="35" y="66" width="14" height="14"/></g><g class="world-globe"><circle cx="158" cy="73" r="40"/><ellipse cx="158" cy="73" rx="40" ry="14"/><ellipse cx="158" cy="73" rx="16" ry="40"/><path d="M118 73h80M158 33v80"/></g><path class="signal-track" d="M64 73h54"/><path class="signal-packet" d="M64 73h54"/><circle class="world-satellite" cx="158" cy="33" r="3"/><text x="22" y="129">AI</text><text x="135" y="129">WORLD</text><text x="8" y="14">CONNECT / EXPLORE</text></svg>`;
  // CSS animations pause outside the viewport and during reading.
  const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>target.classList.toggle('graphic-offscreen',!isIntersecting)),{rootMargin:'60px'});
  document.querySelectorAll('[data-motion-graphic],.method-list').forEach(el=>observer.observe(el));
}
