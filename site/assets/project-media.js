// Media stays independent of the three-block journey and its reading progress.
const boardTitles = ['背景与策略', '总体方案', '街道与公共空间', '建筑与节点深化'];
const videoWorks = [
  {slug:'dudu-little-house', title:"Dudu’s Little House", duration:'1:22'},
  {slug:'rainy-night-decision', title:'Rainy Night Decision', duration:'0:26'},
  {slug:'little-cat-healing-life', title:'The Little Cat’s Healing Life', duration:'1:18'}
];
const mediaBase = new URL('../media/', import.meta.url);
const source = path => new URL(path, mediaBase).href;
const boardSource = (index, suffix='') => source(`competition/board-${String(index+1).padStart(2,'0')}${suffix}.${suffix==='-full'?'jpg':'webp'}`);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, label) {
  const node = element('button', 'project-media-button', text);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  return node;
}
function image(src, alt, className) {
  const node = element('img', className);
  node.src = src; node.alt = alt; node.loading = 'lazy'; node.decoding = 'async';
  return node;
}

export function mountProjectMedia(host, kind) {
  if (!host || !['competition','zeemo'].includes(kind)) return () => {};
  const lifecycle = new AbortController();
  const listen = (target, event, handler, options={}) => target.addEventListener(event, handler, {...options, signal:lifecycle.signal});
  const section = element('section', `project-media project-media-${kind}`);
  section.setAttribute('aria-label', kind === 'competition' ? '竞赛图纸' : 'AI 视频作品');
  host.append(section);
  const dispose = kind === 'competition' ? mountBoards(section, listen) : mountVideos(section, listen);
  return () => { dispose(); lifecycle.abort(); section.remove(); };
}

function mountBoards(section, listen) {
  let current = 0;
  const figure = element('figure', 'project-media-board');
  const open = button('', '放大查看第 1 张图纸：背景与策略');
  open.classList.add('project-media-board-open');
  const preview = image(boardSource(0), '《破界织境》图纸 01：背景与策略', 'project-media-board-image');
  preview.width = 7016; preview.height = 9933;
  open.append(preview, element('span','project-media-enlarge','点击查看高清图纸 ↗'));
  const caption = element('figcaption', 'project-media-caption');
  caption.setAttribute('aria-live','polite');
  figure.append(open, caption);
  const navigation = element('div', 'project-media-board-navigation');
  navigation.setAttribute('role','group'); navigation.setAttribute('aria-label','选择图纸');
  const previous = button('←','上一张图纸');
  const next = button('→','下一张图纸');
  const thumbnails = element('div','project-media-board-thumbnails');
  const selectors = boardTitles.map((title,index) => {
    const item = button('', `图纸 ${index+1}：${title}`);
    item.classList.add('project-media-board-thumbnail');
    item.append(image(boardSource(index,'-thumb'),'','project-media-thumbnail-image'), element('span','project-media-thumbnail-caption',`${String(index+1).padStart(2,'0')} ${title}`));
    listen(item,'click',() => select(index));
    thumbnails.append(item); return item;
  });
  navigation.append(previous, thumbnails, next);
  section.append(figure,navigation);
  const viewer = createBoardViewer(listen, index => select(index));
  function select(index) {
    current = (index+boardTitles.length)%boardTitles.length;
    preview.src = boardSource(current);
    preview.alt = `《破界织境》图纸 ${String(current+1).padStart(2,'0')}：${boardTitles[current]}`;
    caption.textContent = `${String(current+1).padStart(2,'0')} / 04　${boardTitles[current]}`;
    open.setAttribute('aria-label', `放大查看第 ${current+1} 张图纸：${boardTitles[current]}`);
    selectors.forEach((node,i) => node.setAttribute('aria-pressed',String(i===current)));
    previous.disabled = current === 0; next.disabled = current === 3;
  }
  listen(previous,'click',() => select(current-1));
  listen(next,'click',() => select(current+1));
  listen(open,'click',() => viewer.open(current,open));
  select(0);
  return () => viewer.dispose();
}

function createBoardViewer(listen, onChange) {
  const dialog = element('dialog','project-media-viewer');
  dialog.setAttribute('aria-label','高清图纸查看器');
  const header = element('div','project-media-viewer-header');
  const title = element('p','project-media-viewer-title');
  const controls = element('div','project-media-viewer-controls');
  const previous = button('←','上一张图纸');
  const next = button('→','下一张图纸');
  const minus = button('−','缩小图纸');
  const fit = button('适屏','图纸适应屏幕');
  const plus = button('+','放大图纸');
  const close = button('关闭 ×','关闭高清图纸');
  controls.append(previous,next,minus,fit,plus,close);
  header.append(title,controls);
  const viewport = element('div','project-media-viewer-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label','图纸。滚轮或双指缩放，放大后拖动查看；方向键移动，Escape 关闭。');
  const picture = element('img','project-media-viewer-image');
  picture.draggable = false; picture.decoding = 'async';
  const status = element('p','project-media-viewer-status');
  status.setAttribute('role','status');
  viewport.append(picture);
  const footer = element('div','project-media-viewer-footer');
  footer.append(element('span','','滚轮 / 双指缩放 · 拖动查看'),status);
  dialog.append(header,viewport,footer);
  document.body.append(dialog);
  let current=0, zoom=1, x=0, y=0, baseWidth=0, baseHeight=0, previousOverflow='', opener=null, gesture=null;
  const pointers = new Map();
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  function render() {
    const maxX = Math.max(0,(baseWidth*zoom-viewport.clientWidth)/2);
    const maxY = Math.max(0,(baseHeight*zoom-viewport.clientHeight)/2);
    x=clamp(x,-maxX,maxX); y=clamp(y,-maxY,maxY);
    picture.style.transform=`translate(-50%, -50%) translate(${x}px, ${y}px) scale(${zoom})`;
    viewport.classList.toggle('project-media-is-zoomed',zoom>1.01);
    minus.disabled=zoom<=1; plus.disabled=zoom>=10;
    fit.textContent='适屏';
    fit.setAttribute('aria-label',`当前缩放 ${Math.round(zoom*100)}%，图纸适应屏幕`);
    fit.title=`当前缩放 ${Math.round(zoom*100)}%`;
  }
  function fitImage() {
    const ratio=Math.min((viewport.clientWidth-24)/7016,(viewport.clientHeight-24)/9933);
    baseWidth=Math.max(1,7016*ratio); baseHeight=Math.max(1,9933*ratio);
    picture.style.width=`${baseWidth}px`; picture.style.height=`${baseHeight}px`;
    zoom=1; x=0; y=0; render();
  }
  function changeZoom(value,anchorX=0,anchorY=0) {
    const nextZoom=clamp(value,1,10), ratio=nextZoom/zoom;
    x=anchorX-(anchorX-x)*ratio; y=anchorY-(anchorY-y)*ratio; zoom=nextZoom; render();
  }
  function load(index) {
    current=clamp(index,0,3); pointers.clear(); gesture=null;
    title.textContent=`${String(current+1).padStart(2,'0')} / 04　${boardTitles[current]}`;
    picture.alt=`《破界织境》图纸 ${current+1}：${boardTitles[current]}`;
    picture.src=boardSource(current,'-full');
    status.textContent='高清图纸加载中…';
    previous.disabled=current===0; next.disabled=current===3;
    fitImage(); onChange(current);
  }
  function dismiss(restore=true) {
    if (!dialog.open) return;
    dialog.close(); document.body.style.overflow=previousOverflow;
    pointers.clear(); gesture=null; picture.removeAttribute('src');
    if (restore && opener?.isConnected) opener.focus({preventScroll:true});
  }
  function beginGesture() {
    const entries=[...pointers.values()];
    if (entries.length>=2) {
      const [a,b]=entries;
      gesture={kind:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,zoom,x,y};
    } else if (entries.length===1) gesture={kind:'pan',cx:entries[0].x,cy:entries[0].y,x,y};
    else gesture=null;
  }
  listen(picture,'load',() => { status.textContent=''; });
  listen(picture,'error',() => { if(dialog.open) status.textContent='图纸未能加载，请切换后重试。'; });
  listen(close,'click',() => dismiss());
  listen(previous,'click',() => load(current-1));
  listen(next,'click',() => load(current+1));
  listen(plus,'click',() => changeZoom(zoom*1.5));
  listen(minus,'click',() => changeZoom(zoom/1.5));
  listen(fit,'click',fitImage);
  listen(dialog,'cancel',event => {event.preventDefault(); dismiss();});
  listen(dialog,'keydown',event => {
    // Do not let the parent page's Escape handler collapse the experience too.
    if(event.key==='Escape') {event.preventDefault();event.stopPropagation();dismiss();return;}
    if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      event.preventDefault();event.stopPropagation();
      if(event.key==='+'||event.key==='=') changeZoom(zoom*1.5);
      else if(event.key==='-') changeZoom(zoom/1.5);
      else if(event.key==='0') fitImage();
      else if(zoom>1) {x+=event.key==='ArrowLeft'?70:event.key==='ArrowRight'?-70:0;y+=event.key==='ArrowUp'?70:event.key==='ArrowDown'?-70:0;render();}
      else if(event.key==='ArrowLeft'&&current>0) load(current-1);
      else if(event.key==='ArrowRight'&&current<3) load(current+1);
    }
  });
  listen(viewport,'wheel',event => {
    event.preventDefault();
    const rect=viewport.getBoundingClientRect();
    changeZoom(zoom*Math.exp(-event.deltaY*.0015),event.clientX-rect.left-rect.width/2,event.clientY-rect.top-rect.height/2);
  },{passive:false});
  listen(viewport,'pointerdown',event => {
    if(event.pointerType==='mouse'&&event.button!==0) return;
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});beginGesture();
  });
  listen(viewport,'pointermove',event => {
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const entries=[...pointers.values()];
    if(gesture?.kind==='pinch'&&entries.length>=2) {
      const [a,b]=entries, rect=viewport.getBoundingClientRect();
      const nextZoom=clamp(gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,1,10);
      const oldX=gesture.cx-rect.left-rect.width/2, oldY=gesture.cy-rect.top-rect.height/2;
      const newX=(a.x+b.x)/2-rect.left-rect.width/2,newY=(a.y+b.y)/2-rect.top-rect.height/2;
      x=newX-(oldX-gesture.x)*nextZoom/gesture.zoom;y=newY-(oldY-gesture.y)*nextZoom/gesture.zoom;zoom=nextZoom;render();
    } else if(gesture?.kind==='pan'&&zoom>1) {x=gesture.x+event.clientX-gesture.cx;y=gesture.y+event.clientY-gesture.cy;render();}
  });
  const endPointer=event => {pointers.delete(event.pointerId);beginGesture();};
  listen(viewport,'pointerup',endPointer);listen(viewport,'pointercancel',endPointer);listen(viewport,'lostpointercapture',endPointer);
  listen(window,'resize',() => {if(dialog.open)fitImage();});
  return {
    open(index,trigger) {opener=trigger;previousOverflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';load(index);close.focus({preventScroll:true});},
    dispose() {dismiss(false);dialog.remove();}
  };
}

function mountVideos(section, listen) {
  const video = element('video','project-media-video');
  video.controls=true; video.playsInline=true; video.preload='metadata';
  video.setAttribute('playsinline','');
  const caption=element('p','project-media-caption');
  caption.setAttribute('aria-live','polite');
  const choices=element('div','project-media-video-choices');
  choices.setAttribute('role','group');choices.setAttribute('aria-label','选择 AI 视频作品');
  const selectors=videoWorks.map((work,index) => {
    const choice=button('',`播放列表 ${index+1}：${work.title}，${work.duration}`);
    choice.classList.add('project-media-video-choice');
    const copy=element('span','project-media-work-copy');
    copy.append(element('span','project-media-work-title',work.title),element('span','project-media-work-duration',`${String(index+1).padStart(2,'0')} / ${work.duration}`));
    choice.append(image(source(`zeemo/${work.slug}.webp`),'','project-media-video-poster'),copy);
    listen(choice,'click',() => select(index));
    choices.append(choice);return choice;
  });
  const error=element('p','project-media-error');error.hidden=true;error.setAttribute('role','status');
  section.append(video,caption,choices,error);
  function select(index) {
    video.pause();
    const work=videoWorks[index];
    video.poster=source(`zeemo/${work.slug}.webp`);
    video.src=source(`zeemo/${work.slug}.mp4`);
    video.setAttribute('aria-label',work.title);
    video.load();error.hidden=true;
    caption.textContent=`${String(index+1).padStart(2,'0')} / 03　${work.title}`;
    selectors.forEach((node,i) => node.setAttribute('aria-pressed',String(i===index)));
  }
  listen(video,'error',() => {error.textContent='视频暂时无法播放，请切换作品后重试。';error.hidden=false;});
  listen(document,'visibilitychange',() => {if(document.hidden)video.pause();});
  listen(window,'pagehide',() => video.pause());
  select(0);
  return () => {video.pause();video.removeAttribute('src');video.removeAttribute('poster');video.load();};
}
