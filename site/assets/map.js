/* Geographic artwork and city coordinates originate in the user's journey-map.html.
 * No map service, analytics or third-party runtime is required. */
const MAP_NS = 'http://www.w3.org/2000/svg';
const MAP_VIEW = { x: 0, y: 0, width: 960, height: 560 };
const MAP_MOBILE_VIEW = { x: 300, y: 120, width: 490, height: 440 };
const MAP_CITIES = [
  { id: 'gansu', name: '甘肃', tag: '家乡 · 成长', x: 473.8, y: 276.6, text: '从甘肃出发，带着对人与环境的好奇。' },
  { id: 'chongqing', name: '重庆', tag: '建筑学求学', x: 506.2, y: 371, text: '在重庆学习建筑，从空间与真实场景理解需求。' },
  { id: 'shenzhen', name: '深圳', tag: '产品实习', x: 595.5, y: 472.9, text: '在产品实习中，把观察与分析转化为可执行的方案。' },
  { id: 'beijing', name: '北京', tag: 'AI 产品实践', x: 623.3, y: 220.9, text: '继续探索 AI 产品。点击这一站，展开我的成长之树。' }
];
const MAP_TOTAL = 7400;
const mapClamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

function mapArc(a, b, index) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const lift = distance * .25 * (index % 2 === 0 ? 1 : -1);
  const nx = -dy / distance, ny = dx / distance;
  return `M ${a.x} ${a.y} C ${a.x + dx * .3 + nx * lift} ${a.y + dy * .3 + ny * lift} ${a.x + dx * .7 + nx * lift} ${a.y + dy * .7 + ny * lift} ${b.x} ${b.y}`;
}

/** Mount the four-stop introduction. The parent owns page routing. */
export function mountMap(container, { onEnter = () => {} } = {}) {
  if (!container) throw new TypeError('mountMap needs a container');
  const previous = [...container.childNodes];
  const wrapper = document.createElement('div');
  wrapper.className = 'journey-map';
  const dotsURL = new URL('./map-dots.svg', import.meta.url).href;
  wrapper.innerHTML = `
    <style>
      .journey-map{--map-ink:var(--ink,#243c2d);--map-muted:var(--muted,#5c6b5b);--map-accent:var(--accent,#5f7d4b);position:relative;isolation:isolate;width:100%;aspect-ratio:960/560;min-width:0;overflow:visible;font-family:inherit}
      .journey-map__svg{display:block;width:100%;height:100%;overflow:hidden;pointer-events:none}
      .journey-map__base{fill:none;stroke:var(--line,#cbd4c6);stroke-width:1;stroke-linecap:round;vector-effect:non-scaling-stroke;opacity:.65}
      .journey-map__route{fill:none;stroke:var(--map-accent);stroke-width:1.4;stroke-linecap:round;vector-effect:non-scaling-stroke}
      .journey-map__node{position:absolute;display:grid;place-items:center;width:44px;height:44px;padding:0;transform:translate(-50%,-50%);border:0;border-radius:50%;background:none;color:var(--map-ink);cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
      .journey-map__node:focus{outline:none}
      .journey-map__dot{position:relative;display:block;width:14px;height:14px;border:1.2px solid var(--accent-strong,#385837);border-radius:50%;background:var(--bg,#f7f8f5);transition:background .2s,border-color .2s,box-shadow .2s}
      .journey-map__node:hover .journey-map__dot,.journey-map__node:focus-visible .journey-map__dot{box-shadow:0 0 0 5px var(--accent-halo,#5f7d4b26);border-color:var(--map-accent)}
      .journey-map__node.is-active .journey-map__dot{background:var(--map-accent);border-color:var(--map-accent)}
      .journey-map__node.is-destination .journey-map__dot::after{content:'';position:absolute;inset:-7px;border:1px solid var(--map-accent);border-radius:50%;animation:journey-map-breathe 2.5s ease-out infinite;pointer-events:none}
      .journey-map__card{position:absolute;z-index:2;width:210px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:12px 13px;background:var(--paper,#fbfcf9);border:1px solid var(--line,#cbd4c6);border-radius:1px;box-shadow:none;pointer-events:auto;transition:opacity .3s;text-align:center}
      .journey-map__card[data-docked="true"]{position:relative;left:auto!important;top:auto!important;width:100%;max-width:none;margin:14px 0 0;transform:none}
      .journey-map__enter{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:4px;color:var(--accent-strong,#385837);font-size:12px;text-decoration:none}
      .journey-map__card strong{display:block;font-size:13px;line-height:1.5;font-weight:550;letter-spacing:.08em;color:var(--ink,#243c2d)}
      .journey-map__tag{display:block;font-size:12px;line-height:1.7;margin-top:2px;color:var(--muted,#5c6b5b)}
      .journey-map__card p{margin:5px 0 0;font-size:12px;line-height:1.8;color:var(--muted,#5c6b5b)}
      .journey-map__copy-line{display:block;text-wrap:balance}
      .journey-map__sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
      @keyframes journey-map-breathe{0%{transform:scale(.65);opacity:.65}75%,100%{transform:scale(1.6);opacity:0}}
      @media(prefers-reduced-motion:reduce){.journey-map *{animation:none!important;transition:none!important}.journey-map__node.is-destination .journey-map__dot::after{opacity:.5}}
      @media(max-width:600px){.journey-map__card{width:196px;padding:10px 12px}.journey-map__card strong{font-size:13px}.journey-map__card p{font-size:12px;line-height:1.7}}
    </style>
    <svg class="journey-map__svg" viewBox="${MAP_VIEW.x} ${MAP_VIEW.y} ${MAP_VIEW.width} ${MAP_VIEW.height}" aria-hidden="true">
      <defs>
        <filter id="map-forest-ink" color-interpolation-filters="sRGB"><feFlood flood-color="var(--drawing,#8c9c84)" flood-opacity=".44"/><feComposite in2="SourceAlpha" operator="in"/></filter>
        <linearGradient id="map-fade-west"><stop offset="0" stop-color="black"/><stop offset=".035" stop-color="#777"/><stop offset=".10" stop-color="white"/><stop offset=".96" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
        <linearGradient id="map-fade-vertical" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="black"/><stop offset=".07" stop-color="white"/><stop offset=".94" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>
        <radialGradient id="map-fade-northwest" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="200"><stop offset="0" stop-color="#444"/><stop offset=".4" stop-color="#bbb"/><stop offset="1" stop-color="white"/></radialGradient>
        <mask id="map-mask-west" maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="560"><rect width="960" height="560" fill="url(#map-fade-west)"/></mask>
        <mask id="map-mask-vertical" maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="560"><rect width="960" height="560" fill="url(#map-fade-vertical)"/></mask>
        <mask id="map-mask-northwest" maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="560"><rect width="960" height="560" fill="url(#map-fade-northwest)"/></mask>
      </defs>
      <g mask="url(#map-mask-west)"><g mask="url(#map-mask-vertical)"><image href="${dotsURL}" x="0" y="0" width="960" height="560" opacity=".82" filter="url(#map-forest-ink)" mask="url(#map-mask-northwest)"/></g></g>
      <g class="journey-map__paths"></g>
    </svg>
    <div class="journey-map__card" hidden><strong></strong><span class="journey-map__tag"></span><p></p><a class="journey-map__enter" href="tree-study.html?form=7&amp;flow=1" hidden>进入成长之树 →</a></div>
    <p class="journey-map__sr" role="status" aria-live="polite" aria-atomic="true"></p>`;
  container.replaceChildren(wrapper);
  const pathsGroup = wrapper.querySelector('.journey-map__paths');
  const svg = wrapper.querySelector('.journey-map__svg');
  const card = wrapper.querySelector('.journey-map__card');
  const live = wrapper.querySelector('[role=status]');
  const paths = [];
  const buttons = [];
  const listeners = [];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed = 0, raf = 0, lastTime = null, playing = false;
  let selected = -1, destroyed = false, completed = false;
  let wasPlayingBeforeHidden = false;
  let resizeObserver = null;
  let view = MAP_VIEW;

  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  const atPercent = city => ({
    left: ((city.x - view.x) / view.width) * 100,
    top: ((city.y - view.y) / view.height) * 100
  });

  for (let i = 0; i < MAP_CITIES.length - 1; i++) {
    const d = mapArc(MAP_CITIES[i], MAP_CITIES[i + 1], i);
    const base = document.createElementNS(MAP_NS, 'path');
    base.setAttribute('d', d);
    base.setAttribute('class', 'journey-map__base');
    const route = document.createElementNS(MAP_NS, 'path');
    route.setAttribute('d', d);
    route.setAttribute('class', 'journey-map__route');
    route.setAttribute('pathLength', '1');
    route.setAttribute('stroke-dasharray', '1');
    route.setAttribute('stroke-dashoffset', '1');
    route.style.opacity = '0';
    pathsGroup.append(base, route);
    paths.push(route);
  }

  function positionCard() {
    if (selected < 0 || destroyed) return;
    // Prefer a close neighbour of the selected dot, never a remote map corner.
    card.dataset.docked='false';
    if (card.parentNode!==wrapper) wrapper.append(card);
    if (card.hidden) return;
    const city = MAP_CITIES[selected];
    const point = atPercent(city);
    const width = wrapper.clientWidth, height = wrapper.clientHeight;
    if (!width || !height) return;
    const cardWidth = card.offsetWidth, cardHeight = card.offsetHeight;
    const x = width * point.left / 100;
    const y = height * point.top / 100;
    const bounds=wrapper.getBoundingClientRect();
    // Let the popover use the outer whitespace on the right, while respecting
    // the viewport, introduction and controls below the map.
    const minLeft=Math.max(8,12-bounds.left);
    const maxLeft=window.innerWidth-12-bounds.left-cardWidth;
    const minTop=8,maxTop=height-cardHeight-8;
    const candidates=[];
    for(const offset of [.5,.25,.75,0,1]){
      candidates.push([x-28-cardWidth,y-cardHeight*offset],[x+28,y-cardHeight*offset]);
      candidates.push([x-cardWidth*offset,y-28-cardHeight],[x-cardWidth*offset,y+28]);
    }
    const placed=candidates.map(([left,top],preference) => {
      left=mapClamp(left,minLeft,Math.max(minLeft,maxLeft));
      top=mapClamp(top,minTop,Math.max(minTop,maxTop));
      let overlapTotal=0;
      MAP_CITIES.forEach((entry,index) => {
        const p=atPercent(entry),px=width*p.left/100,py=height*p.top/100;
        const overlap=Math.max(0,Math.min(left+cardWidth,px+22)-Math.max(left,px-22)) * Math.max(0,Math.min(top+cardHeight,py+22)-Math.max(top,py-22));
        overlapTotal+=overlap;
      });
      const edgeDistance=Math.hypot(Math.max(left-x,0,x-left-cardWidth),Math.max(top-y,0,y-top-cardHeight));
      const centreDistance=Math.hypot(left+cardWidth/2-x,top+cardHeight/2-y);
      return {left,top,overlapTotal,edgeDistance,score:overlapTotal*10000+edgeDistance*10+centreDistance+preference*.01};
    }).sort((a,b)=>a.score-b.score);
    if (placed[0].overlapTotal>0 || placed[0].edgeDistance>60 || cardHeight>height-16 || maxLeft<minLeft) {
      card.dataset.docked='true';
      container.append(card);
      return;
    }
    card.style.left=`${placed[0].left}px`;
    card.style.top=`${placed[0].top}px`;
    card.style.transform='none';
  }

  function showCity(index, announce = true, reveal = false) {
    if (destroyed || (index === selected && !reveal)) return;
    selected = index;
    const city = MAP_CITIES[index];
    buttons.forEach((button, i) => {
      button.classList.toggle('is-active', i === index);
      button.setAttribute('aria-pressed', String(i === index));
    });
    card.querySelector('strong').textContent = city.name;
    card.querySelector('.journey-map__tag').textContent = city.tag;
    const lines=city.text.match(/[^，。]+[，。]?/g)||[city.text];
    card.querySelector('p').replaceChildren(...lines.map(text=>{
      const line=document.createElement('span');
      line.className='journey-map__copy-line';line.textContent=text;return line;
    }));
    if (reveal) card.hidden = false;
    card.querySelector('a').hidden = index !== 3;
    positionCard();
    if (announce) live.textContent = `${city.name}，${city.tag}${index === 3 ? '。点击北京，进入成长之树。' : '。'}`;
  }

  function layout() {
    if (destroyed) return;
    // Expand the desktop geography; preserve the legible close view on phones.
    // SVG and HTML hit targets always share the same coordinate transform.
    view = window.innerWidth <= 760 ? MAP_MOBILE_VIEW : MAP_VIEW;
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
    wrapper.style.aspectRatio = `${view.width} / ${view.height}`;
    buttons.forEach((button,index) => {
      const point = atPercent(MAP_CITIES[index]);
      button.style.left = `${point.left}%`;
      button.style.top = `${point.top}%`;
    });
    positionCard();
  }

  MAP_CITIES.forEach((city, index) => {
    const button = document.createElement('button');
    const point = atPercent(city);
    button.type = 'button';
    button.className = 'journey-map__node';
    button.dataset.city = city.id;
    button.style.left = `${point.left}%`;
    button.style.top = `${point.top}%`;
    button.setAttribute('aria-label', `${city.name}，${city.tag}${index === 3 ? '，进入成长之树' : '，查看这一站'}`);
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<span class="journey-map__dot" aria-hidden="true"></span>';
    listen(button, 'click', () => {
      pause();
      if (index === 3 && selected === 3 && !card.hidden) onEnter();
      else showCity(index, true, true);
    });
    wrapper.append(button);
    buttons.push(button);
  });
  listen(card.querySelector('a'), 'click', event => { event.preventDefault(); onEnter(); });

  function draw() {
    let current = 0;
    paths.forEach((path, i) => {
      const progress = mapClamp((elapsed - (600 + i * 2400)) / 2000);
      const eased = progress * progress * (3 - 2 * progress);
      path.setAttribute('stroke-dashoffset', String(1 - eased));
      path.setAttribute('stroke-dasharray', progress>=1 ? 'none' : '1');
      path.style.opacity = progress > 0 ? '1' : '0';
      if (progress >= 1) current = i + 1;
    });
    showCity(current);
    completed = elapsed >= MAP_TOTAL;
    buttons[3].classList.toggle('is-destination', completed);
  }

  function tick(now) {
    raf = 0;
    if (destroyed || !playing || document.hidden) return;
    if (lastTime !== null) elapsed = Math.min(MAP_TOTAL, elapsed + now - lastTime);
    lastTime = now;
    draw();
    if (elapsed >= MAP_TOTAL) { playing = false; lastTime = null; }
    else raf = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    wasPlayingBeforeHidden = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastTime = null;
  }

  function replay() {
    if (destroyed) return;
    pause();
    elapsed = 0;
    selected = -1;
    completed = false;
    card.hidden = true;
    if (motion.matches) { finish(); return; }
    draw();
    playing = true;
    if (document.hidden) wasPlayingBeforeHidden = true;
    else raf = requestAnimationFrame(tick);
  }

  function finish() {
    if (destroyed) return;
    pause();
    elapsed = MAP_TOTAL;
    draw();
  }

  listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      wasPlayingBeforeHidden = playing;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTime = null;
    } else if (wasPlayingBeforeHidden && playing && !destroyed) {
      wasPlayingBeforeHidden = false;
      raf = requestAnimationFrame(tick);
    }
  });
  listen(motion, 'change', () => { if (motion.matches) finish(); });
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(wrapper);
  } else listen(window, 'resize', layout);
  layout();
  replay();

  return {
    pause,
    replay,
    finish,
    inspect: () => ({ current: MAP_CITIES[selected]?.id ?? null, cardVisible: !card.hidden, elapsed: Math.round(elapsed), playing, completed, reducedMotion: motion.matches, destroyed, viewBox: {...view} }),
    destroy() {
      if (destroyed) return;
      pause();
      destroyed = true;
      resizeObserver?.disconnect();
      listeners.forEach(remove => remove());
      if (wrapper.parentNode === container) container.replaceChildren(...previous);
    }
  };
}
