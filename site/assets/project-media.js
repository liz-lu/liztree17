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
  let current=-1, bufferingTimer=null, fallbackTimer=null, disposed=false;
  let quality='smooth', pendingPlayback=null;
  const frame=element('div','project-media-video-frame');
  const video = element('video','project-media-video');
  video.controls=true; video.playsInline=true; video.preload='auto';
  video.setAttribute('playsinline','');
  const buffering=element('p','project-media-video-status');
  buffering.hidden=true;buffering.setAttribute('role','status');
  buffering.setAttribute('aria-live','polite');
  frame.append(video,buffering);
  const caption=element('p','project-media-caption');
  caption.setAttribute('aria-live','polite');
  const qualityBar=element('div','project-media-quality');
  const qualityOptions=element('div','project-media-quality-options');
  qualityOptions.setAttribute('role','group');qualityOptions.setAttribute('aria-label','视频清晰度');
  const qualityButtons=['smooth','hd'].map(value=>{
    const option=button(value==='smooth'?'流畅 360p':'高清 720p');
    option.dataset.quality=value;
    listen(option,'click',()=>changeQuality(value));qualityOptions.append(option);return option;
  });
  const bufferInfo=element('span','project-media-buffer-info','正在准备视频…');
  qualityBar.append(qualityOptions,bufferInfo);
  const choices=element('div','project-media-video-choices');
  choices.setAttribute('role','group');choices.setAttribute('aria-label','选择 AI 视频作品');
  const selectors=videoWorks.map((work,index) => {
    const choice=button('',`播放列表 ${index+1}：${work.title}，${work.duration}`);
    choice.classList.add('project-media-video-choice');
    const copy=element('span','project-media-work-copy');
    copy.append(element('span','project-media-work-title',work.title),element('span','project-media-work-duration',`${String(index+1).padStart(2,'0')} / ${work.duration}`));
    choice.append(image(source(`zeemo/${work.slug}-smooth.webp`),'','project-media-video-poster'),copy);
    listen(choice,'click',() => select(index));
    choices.append(choice);return choice;
  });
  const error=element('p','project-media-error');error.hidden=true;error.setAttribute('role','status');
  section.append(frame,qualityBar,caption,choices,error);
  function clearBuffering() {
    clearTimeout(bufferingTimer);bufferingTimer=null;
    clearTimeout(fallbackTimer);fallbackTimer=null;
    buffering.hidden=true;buffering.textContent='';
  }
  function updateBufferInfo(){
    if(disposed)return;
    let ahead=0;
    for(let i=0;i<video.buffered.length;i++){
      if(video.buffered.start(i)<=video.currentTime+.1&&video.buffered.end(i)>video.currentTime)
        ahead=Math.max(ahead,video.buffered.end(i)-video.currentTime);
    }
    bufferInfo.textContent=ahead>=1?`已缓冲 ${Math.floor(ahead)} 秒`:'正在准备视频…';
  }
  function loadSource(time=0,play=false){
    clearBuffering();video.pause();error.hidden=true;
    const work=videoWorks[current];
    video.poster=source(`zeemo/${work.slug}-smooth.webp`);
    // This component is mounted only when its experience is opened. Warm just
    // the selected small file from the initial request, not every site video.
    video.preload='auto';
    video.src=source(`zeemo/${work.slug}${quality==='smooth'?'-smooth':''}.mp4?v=stream-20261109-1`);
    video.setAttribute('aria-label',work.title);
    pendingPlayback={time,play};
    video.load();updateBufferInfo();
    qualityButtons.forEach(option=>option.setAttribute('aria-pressed',String(option.dataset.quality===quality)));
  }
  function changeQuality(value){
    if(disposed||value===quality&&!video.error)return;
    const time=video.currentTime,play=!video.paused&&!video.ended;
    quality=value;loadSource(time,play);
  }
  function showBuffering() {
    // Metadata fetches and pauses are not playback stalls. Ignore brief waits.
    if(disposed||video.paused||video.ended||video.error||video.readyState>=3||bufferingTimer!==null) return;
    bufferingTimer=setTimeout(() => {
      bufferingTimer=null;
      if(disposed||video.paused||video.ended||video.error||video.readyState>=3) return;
      buffering.textContent='正在缓冲…';buffering.hidden=false;
      // Only a sustained HD playback stall triggers a lower-bandwidth source.
      if(quality==='hd')fallbackTimer=setTimeout(()=>{
        fallbackTimer=null;
        if(disposed||video.paused||video.ended||video.error||video.readyState>=3||quality!=='hd')return;
        changeQuality('smooth');
        buffering.textContent='已切换流畅画质，正在缓冲…';buffering.hidden=false;
      },3000);
    },250);
  }
  function select(index) {
    // Preserve the current time and downloaded buffer; a real error can retry.
    if(index===current&&!video.error) return;
    current=index;
    const work=videoWorks[index];
    loadSource();
    caption.textContent=`${String(index+1).padStart(2,'0')} / 03　${work.title}`;
    selectors.forEach((node,i) => node.setAttribute('aria-pressed',String(i===index)));
  }
  listen(video,'waiting',showBuffering);
  listen(video,'stalled',showBuffering);
  listen(video,'seeking',showBuffering);
  listen(video,'loadedmetadata',()=>{
    const pending=pendingPlayback;pendingPlayback=null;
    if(!pending||disposed)return;
    if(pending.time>0)video.currentTime=Math.min(pending.time,Math.max(0,video.duration-.1));
    if(pending.play&&!document.hidden)video.play().catch(()=>{});
  });
  ['progress','loadeddata','timeupdate','seeked'].forEach(event=>listen(video,event,updateBufferInfo));
  listen(video,'canplay',() => {if(video.readyState>=3)clearBuffering();});
  listen(video,'seeked',() => {if(video.readyState>=3)clearBuffering();});
  ['playing','pause','ended','emptied','abort'].forEach(event => listen(video,event,clearBuffering));
  listen(video,'error',() => {clearBuffering();error.textContent='视频暂时无法播放，请点击当前作品重试，或切换其他作品。';error.hidden=false;});
  function pause(){if(pendingPlayback)pendingPlayback.play=false;video.pause();}
  listen(document,'visibilitychange',() => {if(document.hidden)pause();});
  listen(window,'pagehide',pause);
  select(0);
  return () => {disposed=true;pendingPlayback=null;clearBuffering();video.pause();video.removeAttribute('src');video.removeAttribute('poster');video.load();};
}
