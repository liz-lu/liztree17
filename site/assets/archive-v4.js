import { mountWebPreview } from './archive-web-preview.js?v=archive-20261105-1';
import { groups } from './data.js?v=archive-20261105-1';
import { details } from './details.js?v=archive-20261105-1';
import { mountProjectMedia } from './project-media.js?v=archive-20261105-1';
import { integrations } from './archive-integrations.js?v=archive-20261105-1';
import { mountMicrographics } from './archive-micrographics.js?v=archive-20261105-1';
mountMicrographics();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const layoutWidth = () => Math.max(1064, window.innerWidth);
const palette = { bg:'#ffffff', ink:'#183e34', accent:'#278767', line:'#9ab5aa' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const entries = Object.entries(groups).flatMap(([groupId, group]) => group.layers.map(layer => ({...layer, groupId, groupName:groupId==='internships'?'实习经历':groupId==='projects'?'个人 AI 项目':'校园与学习', detail:details[layer.id]})));
const entryById = new Map(entries.map(entry => [entry.id, entry]));
const controllers = {};
const visualControllers=[];
const activeScenes = new Set();
const sceneAnchors = {tree:null, location:null};
let selectedBranch = '', selectedCity = 'gansu', motionStopped = false;
let selectedNote = '';
let disposedMedia = [], readerState = null, bodyScroll = null, searchTrigger = null;
let previousRestoration = history.scrollRestoration, restoreScrollTimer = 0;
const reader = $('#reader-dialog'), search = $('#search-dialog'), scrollArea = $('#reader-scroll');

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function copy(tag, className, text) {
  const el = node(tag, className);
  String(text || '').split(/(\*\*[^*]+\*\*)/g).forEach(part => el.append(part.startsWith('**') && part.endsWith('**') ? node('strong','',part.slice(2,-2)) : document.createTextNode(part)));
  return el;
}

for (const host of $$('[data-group]')) {
  const group = groups[host.dataset.group];
  group.layers.forEach(layer => {
    const button = node('button'); button.type='button'; button.dataset.experience=layer.id;
    button.setAttribute('aria-haspopup','dialog'); button.setAttribute('aria-controls','reader-dialog');
    button.setAttribute('aria-label',`阅读${layer.name}`);
    const text = node('span'); text.append(node('strong','',layer.name),node('small','',layer.focus || layer.tag));
    const arrow = node('span','entry-arrow','↗'); arrow.setAttribute('aria-hidden','true');
    button.append(text,arrow);
    button.addEventListener('click',()=>openReader(layer.id,button));
    host.append(button);
  });
}

const methods = [
  '从用户操作中定位问题，以实际反馈验证产品优化。',
  '围绕任务目标，拆解 Agent 生成链路，迭代提示词并评估结果。',
  '把角色、场景、动作与约束拆清楚，帮助用户表达生成意图。',
  '从建筑学的空间观察出发，把对人、场景与系统的理解带入产品设计。'
];
$$('[data-method]').forEach(button=>button.addEventListener('click',()=>{
  $$('[data-method]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
  $('.method-response').textContent=methods[Number(button.dataset.method)]; scheduleLines('location');
}));

const cities = {
  gansu:['甘肃 / 家乡','从这里出发，带着对人与环境的好奇。'],
  chongqing:['重庆 / 建筑学求学','沿着人的路线看空间，学习在真实场景中理解需要。'],
  shenzhen:['深圳 / 产品实习','把观察与分析，转化为可执行、可验证的方案。'],
  beijing:['北京 / AI 产品实践','继续探索输入、生成与反馈，怎样组成一次完整体验。']
};
function selectCity(id, fromModule=false) {
  if (!cities[id]) return;
  const changed = selectedCity!==id; selectedCity=id;
  $$('[data-city]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.city===id)));
  $('.city-note strong').textContent=cities[id][0]; $('.city-note span').textContent=cities[id][1];
  if (!fromModule && changed) controllers.location?.select(id);
  scheduleLines('location');
}
$$('[data-city]').forEach(button=>button.addEventListener('click',()=>selectCity(button.dataset.city)));

function selectBranch(id, fromModule=false) {
  if (!['campus','internships','projects','outlook'].includes(id)) return;
  const changed=selectedBranch!==id; selectedBranch=id;
  selectedNote='';updateNoteSelection();
  $$('[data-branch]').forEach(card=>card.classList.toggle('is-selected',card.dataset.branch===id));
  $$('[data-select-branch]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.selectBranch===id)));
  $('#branch-status').textContent=id==='outlook'?'嫩梢 / 让好奇心继续生长。':`${groups[id].index} / ${id==='internships'?'实习经历':id==='projects'?'个人 AI 项目':'校园与学习'} · 选择卡片中的一项阅读。`;
  if (!fromModule && changed) controllers.tree?.select(id);
  scheduleLines('tree');
}
$$('[data-select-branch]').forEach(button=>button.addEventListener('click',()=>selectBranch(button.dataset.selectBranch)));
$('[data-select-future]').addEventListener('click',()=>selectBranch('outlook'));
const traitCopy={
  resilient:'面对复杂的问题，愿意持续拆解、尝试，再根据反馈修正。',
  curious:'对未知保持兴趣，愿意追问它为什么发生，也愿意亲手试一次。',
  creative:'把不同领域的观察放在一起，寻找新的连接，再把想法做成可体验的东西。',
  rigorous:'区分事实、判断与假设；让表达有依据，让结果可以被检验。',
  human:'关注使用技术的具体的人：他们的处境、感受，以及保留选择的权利。'
};
function updateNoteSelection(){
  $$('.note-card').forEach(card=>card.classList.toggle('is-selected',card.dataset.leader===selectedNote));
  $$('[data-select-note]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.selectNote===selectedNote)));
}
function selectNote(id, bringIntoView=false){
  selectedNote=id;selectedBranch='';
  $$('[data-branch]').forEach(card=>card.classList.remove('is-selected'));
  $$('[data-select-branch]').forEach(button=>button.setAttribute('aria-pressed','false'));
  updateNoteSelection();
  controllers.tree?.select(null);
  controllers.tree?.pause();
  $('#branch-status').textContent=id==='trunk'?'主干 / 坚韧、好奇、创造、严谨与人文。':'根系 / 好奇心，从这里生长。';
  scheduleLines('tree');
  const local=$('.tree-local-notes');
  if(local)local.classList.toggle('is-active',id==='trunk');
}
$$('[data-select-note]').forEach(button=>button.addEventListener('click',()=>selectNote(button.dataset.selectNote)));

$('#tree-motion').addEventListener('click',()=>{
  motionStopped=!motionStopped;
  $('#tree-motion').setAttribute('aria-pressed',String(motionStopped));
  $('#tree-motion').replaceChildren(document.createTextNode(motionStopped?'继续旋转 ':'暂停旋转 '),node('span','',motionStopped?'▷':'Ⅱ'));
  syncMotion();
});

function lockPage() {
  if (bodyScroll!==null) return;
  clearTimeout(restoreScrollTimer);
  previousRestoration = history.scrollRestoration;
  history.scrollRestoration='manual';
  bodyScroll=window.scrollY;
  const gap=window.innerWidth-document.documentElement.clientWidth;
  document.body.classList.add('dialog-open');
  Object.assign(document.body.style,{position:'fixed',top:`-${bodyScroll / (Number(getComputedStyle(document.body).zoom)||1)}px`,width:'var(--archive-width)',paddingRight:`${gap}px`});
  syncMotion();
}
function unlockPage(focusTarget) {
  if (reader.open || search.open || bodyScroll===null) return;
  const y=bodyScroll; bodyScroll=null;
  Object.assign(document.body.style,{position:'',top:'',width:'',paddingRight:''});
  document.body.classList.remove('dialog-open');
  const behavior=document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior='auto';
  window.scrollTo(0,y);
  document.documentElement.style.scrollBehavior=behavior;
  // Browser history restores persisted scroll after popstate. Keep it manual
  // through that task, so it cannot overwrite the location restored above.
  restoreScrollTimer=setTimeout(()=>{if(bodyScroll===null)history.scrollRestoration=previousRestoration;},0);
  if(focusTarget?.isConnected) focusTarget.focus({preventScroll:true});
  syncMotion(); scheduleLines('tree'); scheduleLines('location');
}
function addMedia(parent, kind) {
  const host=node('section','reader-media');
  host.setAttribute('aria-label',kind==='competition'?'建筑作品图纸':'AI 视频作品');
  host.append(node('h3','reader-media-title',kind==='competition'?'《破界织境》 / 四张设计图纸':'AI 视频作品 / 模板实践'));
  const media=node('div'); host.append(media); parent.append(host);
  disposedMedia.push(mountProjectMedia(media,kind));
}
function clearReaderMedia() {
  disposedMedia.forEach(dispose=>dispose()); disposedMedia=[];
}
function renderReader(entry) {
  clearReaderMedia();
  const fragment=document.createDocumentFragment();
  const meta=node('div','reader-meta'); meta.append(node('span','',`${entry.groupName} / ${entry.tag}`),node('span','',entry.time));
  const title=node('h2','reader-title',entry.name); title.id='reader-heading'; title.tabIndex=-1;
  fragment.append(meta,title);
  if(entry.role) fragment.append(node('p','reader-role',entry.role));
  fragment.append(copy('p','reader-headline',entry.detail.headline));
  if(entry.detail.projects?.length) {
    const index=node('nav','reader-index'); index.setAttribute('aria-label','本段实习的小项目');
    entry.detail.projects.forEach((project,i)=>{
      const a=node('a','',`${String(i+1).padStart(2,'0')} / ${project.title}`); a.href=`#detail-${entry.id}-${project.id}`;
      a.addEventListener('click',event=>{event.preventDefault();document.getElementById(`detail-${entry.id}-${project.id}`)?.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});});
      index.append(a);
    }); fragment.append(index);
    entry.detail.projects.forEach((project,i)=>{
      const section=node('section','reader-section'); section.id=`detail-${entry.id}-${project.id}`;
      section.append(node('span','section-number',`PROJECT / ${String(i+1).padStart(2,'0')}`),node('h3','',project.title));
      const dl=node('dl','reader-facts');
      for(const [key,label] of [['problem','问题'],['judgment','判断'],['action','行动'],['outcome','成果']]) {
        const row=node('div'); row.append(node('dt','',label),copy('dd','',project[key])); dl.append(row);
      }
      section.append(dl); fragment.append(section);
      if(project.media) addMedia(section,project.media);
    });
  }
  entry.detail.sections?.forEach((item,i)=>{
    const section=node('section','reader-section');
    section.append(node('span','section-number',`NOTE / ${String(i+1).padStart(2,'0')}`),node('h3','',item.title),copy('p','',item.body)); fragment.append(section);
  });
  if(entry.detail.outcomes?.length){
    const box=node('section','reader-outcomes'),ul=node('ul');
    entry.detail.outcomes.forEach(item=>ul.append(copy('li','',item))); box.append(node('h3','','成果与实践'),ul); fragment.append(box);
  }
  if(entry.detail.note) fragment.append(node('p','reader-note',entry.detail.note));
  if(entry.detail.media) addMedia(fragment,entry.detail.media);
  if(entry.link)disposedMedia.push(mountWebPreview(fragment,entry));
  $('#reader-content').replaceChildren(fragment);
  $('#reader-context').textContent=`${entry.groupName.toUpperCase()} / ${entry.name}`;
  scrollArea.scrollTop=0;
  requestAnimationFrame(updateReadProgress);
}
function openReader(id, trigger, projectId=null, fromRoute=false) {
  const entry=entryById.get(id); if(!entry)return;
  const existing=readerState;
  selectBranch(entry.groupId);
  if(!reader.open){
    const oldHash=location.hash.startsWith('#read/')?'#growth':location.hash;
    readerState={trigger:trigger||$(`[data-experience="${id}"]`),returnHash:oldHash,pushed:!fromRoute};
    lockPage();
  } else readerState={...existing,trigger:trigger||existing.trigger};
  renderReader(entry);
  if(!fromRoute){
    const hash=`#read/${id}${projectId?'/'+projectId:''}`;
    history[reader.open?'replaceState':'pushState']({archiveReader:id},'',hash);
  }
  if(!reader.open)reader.showModal();
  syncMotion();
  if(projectId){requestAnimationFrame(()=>document.getElementById(`detail-${id}-${projectId}`)?.scrollIntoView({behavior:'instant',block:'start'}));}
  else $('#reader-heading').focus({preventScroll:true});
}
function finishReader() {
  if(!reader.open)return;
  const trigger=readerState?.trigger;
  clearReaderMedia(); reader.close(); readerState=null;
  unlockPage(trigger);
}
function requestReaderClose() {
  if(readerState?.pushed)history.back();
  else {history.replaceState(null,'',readerState?.returnHash||'#growth');finishReader();}
}
$('.dialog-close',reader).addEventListener('click',requestReaderClose);
reader.addEventListener('cancel',event=>{event.preventDefault();requestReaderClose();});
reader.addEventListener('close',()=>{if(readerState){const trigger=readerState.trigger;clearReaderMedia();readerState=null;unlockPage(trigger);}});
function readRoute() {
  const match=location.hash.match(/^#read\/([a-z]+)(?:\/([a-z-]+))?$/);
  if(match && entryById.has(match[1]))openReader(match[1],null,match[2],true);
  else if(reader.open)finishReader();
}
window.addEventListener('popstate',readRoute);
function updateReadProgress(){const max=scrollArea.scrollHeight-scrollArea.clientHeight;$('#reader-progress').textContent=`${max>1?Math.min(100,Math.round(scrollArea.scrollTop/max*100)):100}%`;}
scrollArea.addEventListener('scroll',updateReadProgress,{passive:true});
new ResizeObserver(updateReadProgress).observe($('#reader-content'));

const searchEntries=entries.flatMap(entry=>[
  {id:entry.id,title:entry.name,context:entry.groupName,copy:[entry.text,entry.tag,entry.detail.headline,...(entry.detail.sections||[]).map(s=>s.title+' '+s.body)].join(' ')},
  ...(entry.detail.projects||[]).map(project=>({id:entry.id,projectId:project.id,title:project.title,context:`${entry.groupName} / ${entry.name}`,copy:[project.problem,project.judgment,project.action,project.outcome].join(' ')}))
]);
function renderSearch(){
  const terms=$('#archive-query').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found=searchEntries.map(entry=>{
    const weights=terms.map(term=>entry.title.toLowerCase().includes(term)?9:entry.context.toLowerCase().includes(term)?4:entry.copy.toLowerCase().includes(term)?1:0);
    return {entry,score:weights.includes(0)?-1:weights.reduce((sum,n)=>sum+n,0)};
  }).filter(item=>terms.length?item.score>0:['oppo','zeemo','yuan'].includes(item.entry.id)&&!item.entry.projectId).sort((a,b)=>b.score-a.score);
  $('#search-status').textContent=terms.length?(found.length?`找到 ${found.length} 条相关经历`:'没有找到匹配的经历，可以试试公司名、作品名或「评测」。'):'可以先从这三段实习开始';
  $('#search-results').replaceChildren(...found.map(({entry})=>{
    const li=node('li'),button=node('button'),label=node('span'); button.type='button';
    label.append(node('strong','',entry.title),node('small','',entry.context)); button.append(label,node('span','','↗'));
    button.addEventListener('click',()=>{
      search.close();openReader(entry.id,$('.search-trigger'),entry.projectId);
    });li.append(button);return li;
  }));
}
$('.search-trigger').addEventListener('click',event=>{
  searchTrigger=event.currentTarget;$('#archive-query').value='';renderSearch();lockPage();search.showModal();syncMotion();$('#archive-query').focus();
});
$('#archive-query').addEventListener('input',renderSearch);
$('#archive-query').addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();$('#search-results button')?.focus();}});
$('.dialog-close',search).addEventListener('click',()=>search.close());
search.addEventListener('close',()=>unlockPage(searchTrigger));

const futureContent={
  physical:{
    kicker:'感知 → 判断 → 动作 → 反馈', question:'从建筑空间，\n走向空间智能。',
    progress:'视觉—语言—动作模型正在连接场景理解与机器人控制。跨环境泛化、长任务可靠性与人的安全，仍需逐项验证。',
    description:'建筑关注人与空间的关系，也让我对空间智能产生兴趣：AI 对环境的理解，正在从图像识别延伸到空间关系、行动与反馈。我关注这种变化如何影响我们使用空间、与机器相处的方式，以及技术之中人的感受与判断。',
    evidence:'继续学习空间智能与具身智能，观察真实案例里人与系统如何配合，寻找适合自己的问题。',
    human:'人的位置 / 目标与行动边界由人设定；发生偏差时，可中止、可接管。', target:'世界',
    source:'https://deepmind.google/blog/gemini-robotics-2-brings-whole-body-intelligence-to-robots/', sourceLabel:'研究参考 · Google DeepMind / Robotics'
  },
  agents:{
    kicker:'目标 → 分工 → 协作 → 核验', question:'从系统协作，\n观察智能之间的连接。',
    progress:'多智能体已用于并行研究与工具协作，但任务依赖、信息交接和额外成本，会影响实际收益。',
    description:'从建筑中的系统组织到 AI 产品，我关注不同角色之间的信息传递与协作。Agent 的连接让我看到一种新的工作组织方式；相比数量与分工的复杂程度，我更在意信息是否清楚、协作是否有价值，以及人能否理解结果的来处。',
    evidence:'继续体验不同的 Agent 协作方式，观察它们在信息交接、分歧和结果解释上的表现。',
    human:'人的位置 / 人保留验收标准与关键授权，系统提供可追溯的过程和结果。', target:'AI',
    source:'https://www.anthropic.com/research/multi-agent-research-system', sourceLabel:'研究参考 · Anthropic / Multi-agent systems'
  }
};
let futureVisual=null;
function selectFuture(mode){
  const content=futureContent[mode];if(!content)return;
  $$('[data-future]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.future===mode)));
  $('#future-kicker').textContent=content.kicker;
  $('#future-question').replaceChildren(...content.question.split('\n').flatMap((line,i)=>i?[document.createElement('br'),document.createTextNode(line)]:[document.createTextNode(line)]));
  $('#future-description').textContent=content.description;
  $('#future-source').href=content.source;$('#future-source').textContent=content.sourceLabel+' ↗';
  const target=$('#future-target');if(target)target.textContent=content.target;
  futureVisual?.select(mode);
}
$$('[data-future]').forEach(button=>button.addEventListener('click',()=>selectFuture(button.dataset.future)));
selectFuture('physical');

$$('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(button.dataset.copy);
    else{
      const field=node('textarea');field.value=button.dataset.copy;field.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(field);field.select();const ok=document.execCommand('copy');field.remove();button.focus({preventScroll:true});if(!ok)throw new Error('Clipboard unavailable');
    }
    $('#copy-status').textContent=`已复制${button.dataset.copy.includes('@')?'邮箱':'电话'}：${button.dataset.copy}`;
    $('.copy-label',button).textContent='已复制 ✓';setTimeout(()=>{$('.copy-label',button).textContent='复制 ↗';},2500);
  }catch{$('#copy-status').textContent=`复制暂不可用，请手动选择：${button.dataset.copy}`;}
}));

const cross=$('.click-cross');
document.addEventListener('pointerdown',event=>{
  if(event.button!==0||reduced.matches)return;
  cross.style.setProperty('--x',`${event.clientX}px`);cross.style.setProperty('--y',`${event.clientY}px`);
  cross.classList.remove('is-visible');void cross.offsetWidth;cross.classList.add('is-visible');
},{passive:true});

const svgNS='http://www.w3.org/2000/svg';
const pendingLines={};
function scheduleLines(kind){
  if(pendingLines[kind])return;
  pendingLines[kind]=requestAnimationFrame(()=>{pendingLines[kind]=0;drawLeaders(kind);});
}
function fallbackAnchors(kind,host){
  if(kind==='tree'){
    // Pixel anchors measured on the existing 1040x960 render, including contain letterboxing.
    const fit=Math.min(host.clientWidth/1040,host.clientHeight/960),w=1040*fit,h=960*fit,ox=(host.clientWidth-w)/2,oy=(host.clientHeight-h)/2;
    return Object.fromEntries(Object.entries({campus:[.67,.47],internships:[.29,.34],projects:[.64,.22],outlook:[.55,.1],trunk:[.49,.65],roots:[.48,.83]}).map(([id,[u,v]])=>[id,{u:(ox+u*w)/host.clientWidth,v:(oy+v*h)/host.clientHeight,visible:true}]));
  }
  const width=host.clientWidth,height=host.clientHeight,svgHeight=width*560/960,top=(height-svgHeight)/2;
  return Object.fromEntries(Object.entries({gansu:[473.8,276.6],chongqing:[506.2,371],shenzhen:[595.5,472.9],beijing:[623.3,220.9]}).map(([id,[x,y]])=>[id,{u:x/960,v:(top+y/560*svgHeight)/height,visible:true}]));
}
function drawLeaders(kind){
  const layout=$(`[data-scene="${kind}"]`),host=$(`#${kind==='tree'?'tree':'location'}-scene`),svg=$('.leader-layer',layout);
  if(kind==='location'){svg.replaceChildren();return;}
  if(kind==='tree')positionTreeHotspots();
  if(layoutWidth()<=900){svg.replaceChildren();return;}
  const layoutBox=layout.getBoundingClientRect(),hostBox=host.getBoundingClientRect();
  svg.setAttribute('viewBox',`0 0 ${layoutBox.width} ${layoutBox.height}`);
  const anchors=sceneAnchors[kind]||fallbackAnchors(kind,host);const fragment=document.createDocumentFragment();
  $$('[data-leader]',layout).forEach(card=>{
    const id=card.dataset.leader,anchor=anchors[id];if(!anchor||anchor.visible===false||!Number.isFinite(anchor.u)||!Number.isFinite(anchor.v))return;
    const r=card.getBoundingClientRect();const x=hostBox.left-layoutBox.left+anchor.u*hostBox.width,y=hostBox.top-layoutBox.top+anchor.v*hostBox.height;
    const endX=card.dataset.side==='left'?r.right-layoutBox.left+1:r.left-layoutBox.left-1,endY=r.top-layoutBox.top+16;
    const dx=endX-x,dy=endY-y,sx=Math.sign(dx),sy=Math.sign(dy),room=Math.max(0,Math.abs(dx)-26),diag=Math.min(room,Math.abs(dy));
    let d;
    if(Math.abs(dy)<=room){const corner=endX-sx*20;d=`M${x},${y} H${corner-sx*diag} L${corner},${endY} H${endX}`;}
    else{d=`M${x},${y} V${endY-sy*diag} L${x+sx*diag},${endY} H${endX}`;}
    const g=document.createElementNS(svgNS,'g');g.dataset.anchor=id;if(id===(kind==='tree'?(selectedNote||selectedBranch):selectedCity))g.classList.add('selected');
    const path=document.createElementNS(svgNS,'path');path.setAttribute('d',d);g.append(path);
    const square=document.createElementNS(svgNS,'rect');square.setAttribute('x',x-3);square.setAttribute('y',y-3);square.setAttribute('width','6');square.setAttribute('height','6');g.append(square);
    const terminal=document.createElementNS(svgNS,'rect');terminal.classList.add('leader-terminal');terminal.setAttribute('x',endX-2);terminal.setAttribute('y',endY-2);terminal.setAttribute('width','4');terminal.setAttribute('height','4');g.append(terminal);fragment.append(g);
  });svg.replaceChildren(fragment);
}
function applyTreeScale(){
  const layout=$('.tree-layout'),host=$('#tree-scene'),width=layout.clientWidth;
  if(layoutWidth()<=900){host.style.width='100%';host.style.height=layoutWidth()<=600?'600px':'850px';host.style.left='0';host.style.transform='none';}
  else{
    const side=layoutWidth()>=1600?260:layoutWidth()>1190?238:210,gap=layoutWidth()>=1600?45:layoutWidth()>1190?32:20;
    const originalWidth=width-2*side-2*gap,originalHeight=layoutWidth()>=1600?760:layoutWidth()>1190?690:650;
    host.style.width=`${originalWidth*1.5}px`;host.style.height=`${originalHeight*1.5}px`;host.style.left='50%';host.style.transform='translateX(-50%)';
  }
}
function installTreeHotspots(){
  const host=$('#tree-scene');$('.tree-note-hotspots',host)?.remove();
  const overlay=node('div','tree-note-hotspots');
  const localLines=document.createElementNS(svgNS,'svg');localLines.classList.add('tree-note-lines');localLines.setAttribute('aria-hidden','true');overlay.append(localLines);
  const cluster=node('div','tree-local-notes');cluster.setAttribute('role','group');cluster.setAttribute('aria-label','主干性格标签');
  const labels={resilient:'坚韧',curious:'好奇',creative:'创造力',rigorous:'严谨',human:'人文'};
  for(const [id,label] of Object.entries(labels)){
    const button=node('button','tree-trait-label',label);button.type='button';button.dataset.trait=id;button.setAttribute('aria-pressed','false');button.title=traitCopy[id];
    button.addEventListener('click',()=>{selectNote('trunk');$$('[data-trait]',host).forEach(el=>el.setAttribute('aria-pressed',String(el===button)));$('#branch-status').textContent=label+' / '+traitCopy[id];});cluster.append(button);
  }
  const core=node('button','trunk-touch');core.type='button';core.dataset.noteAnchor='trunk';core.setAttribute('aria-label','主干：坚韧、好奇、创造力、严谨、人文');core.addEventListener('click',()=>selectNote('trunk'));cluster.append(core);
  const root=node('div','root-local-label');root.dataset.noteAnchor='roots';root.append(node('small','','ROOT / 00'),node('span','','从兴趣出发'));root.title='科幻电影埋下兴趣的种子，后来开始自学 AI，探索连接物理世界的人工智能。';
  overlay.append(cluster,root);host.append(overlay);positionTreeHotspots();
}
function positionTreeHotspots(){
  const host=$('#tree-scene'),anchors=sceneAnchors.tree||fallbackAnchors('tree',host),svg=$('.tree-note-lines',host);
  if(!svg)return;
  svg.setAttribute('viewBox',`0 0 ${host.clientWidth} ${host.clientHeight}`);const lines=document.createDocumentFragment();
  for(const [id,selector] of [['trunk','.tree-local-notes'],['roots','.root-local-label']]){
    const el=$(selector,host),a=anchors[id];if(!el)continue;el.hidden=!a||a.visible===false;
    if(!a||a.visible===false)continue;
    const x=a.u*host.clientWidth,y=a.v*host.clientHeight,small=layoutWidth()<=600;
    const direction=id==='trunk'?1:-1,run=small?49:90,dy=id==='trunk'?-36:35;
    const endX=x+direction*run,endY=y+dy;
    el.style.left=`${id==='trunk'?endX+7:endX-(small?78:104)}px`;el.style.top=`${endY-30}px`;
    const group=document.createElementNS(svgNS,'g');group.dataset.noteLine=id;
    const path=document.createElementNS(svgNS,'path');path.setAttribute('d',`M${x},${y} L${x+direction*Math.abs(dy)},${endY} H${endX}`);
    const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','3');
    const end=document.createElementNS(svgNS,'rect');end.setAttribute('x',endX-2);end.setAttribute('y',endY-2);end.setAttribute('width','4');end.setAttribute('height','4');
    group.append(path,dot,end);lines.append(group);
  }svg.replaceChildren(lines);
}
applyTreeScale();installTreeHotspots();
const resizeObserver=new ResizeObserver(()=>{applyTreeScale();scheduleLines('tree');scheduleLines('location');controllers.tree?.resize();controllers.location?.resize();});
$$('.specimen-layout').forEach(el=>resizeObserver.observe(el));
document.fonts.ready.then(()=>{scheduleLines('tree');scheduleLines('location');});

function syncMotion(){
  const stopped=document.hidden||reader.open||search.open;
  document.body.classList.toggle('motion-paused',stopped);
  for(const visual of visualControllers){visual.setReducedMotion?.(reduced.matches);if(stopped||reduced.matches)visual.pause();else visual.resume();}
  for(const [kind,controller] of Object.entries(controllers)){
    if(stopped||reduced.matches||!activeScenes.has(kind)||(kind==='tree'&&motionStopped))controller.pause();else controller.resume();
  }
  $$('[data-visual-slot] video,.hero-visual video').forEach(video=>{if(stopped||reduced.matches)video.pause();else video.play().catch(()=>{});});
}
const sceneObserver=new IntersectionObserver(items=>{for(const item of items){const kind=item.target.id==='tree-scene'?'tree':'location';if(item.isIntersecting)activeScenes.add(kind);else activeScenes.delete(kind);}syncMotion();},{threshold:.05});
sceneObserver.observe($('#tree-scene'));sceneObserver.observe($('#location-scene'));
document.addEventListener('visibilitychange',syncMotion);reduced.addEventListener('change',syncMotion);

async function attachModule(kind,path){
  if(!path)return;
  const host=$(`#${kind==='tree'?'tree':'location'}-scene`);const original=[...host.childNodes];
  try{
    const module=await import(new URL(path,new URL('./archive-integrations.js?v=archive-20261105-1',import.meta.url)).href);
    host.replaceChildren();
    const controller=await module[kind==='tree'?'createTree':'createLocation'](host,{
      palette,reducedMotion:reduced.matches,showControls:false,
      onSelect:id=>kind==='tree'?selectBranch(id,true):selectCity(id,true),
      onNoteSelect:id=>selectNote(id),
      onAnchors:anchors=>{sceneAnchors[kind]=anchors;scheduleLines(kind);}
    });
    for(const method of ['select','pause','resume','resize','dispose'])if(typeof controller?.[method]!=='function')throw new Error(`${kind} controller missing ${method}`);
    if(kind==='tree'&&controller.getStats?.().ready===false){controller.dispose();throw new Error('Tree renderer not ready');}
    controllers[kind]=controller;host.dataset.integrated='true';
    if(kind==='tree'){$('#tree-motion').disabled=false;installTreeHotspots();if(selectedBranch)controller.select(selectedBranch);}else controller.select(selectedCity);
    syncMotion();scheduleLines(kind);
  }catch(error){host.replaceChildren(...original);sceneAnchors[kind]=null;host.dataset.integrated='failed';console.warn(`${kind} component fallback:`,error);scheduleLines(kind);}
}

async function attachVisuals(path){
  if(!path)return;
  try{
    const url=new URL(path,new URL('./archive-integrations.js?v=archive-20261105-1',import.meta.url));const response=await fetch(url);if(!response.ok)throw new Error('Visual manifest unavailable');
    const manifest=await response.json();const assets=Array.isArray(manifest)?manifest:manifest.assets;
    if(!Array.isArray(assets))throw new Error('Visual manifest needs assets array');
    const readyAssets=assets.filter(a=>!a.temporary);
    if(['human-hand','robot-hand'].every(id=>readyAssets.some(a=>a.id===id))){
      const hero=$('#prologue-visual');const motion=await import(new URL('motion.js?v=archive-20261105-1',url));
      hero.replaceChildren();hero.classList.add('has-assets','hands-scene');
      visualControllers.push(motion.createVisual(hero,{kind:'hands',autoplay:true,controls:false,palette,reducedMotion:reduced.matches}));
      const runner=$('[data-visual-slot="runner"]');if(runner){runner.replaceChildren();visualControllers.push(motion.createVisual(runner,{kind:'runner',autoplay:true,controls:false,palette,reducedMotion:reduced.matches}));}
      const touch=$('[data-visual-slot="touch"]');if(touch&&readyAssets.some(a=>a.id==='tech-touch')){touch.replaceChildren();visualControllers.push(motion.createVisual(touch,{kind:'touch',autoplay:true,controls:false,palette,reducedMotion:reduced.matches}));}
    }
    for(const asset of readyAssets){
      // D supplies transparent collage artwork; placement is owned by A.
      const slot=asset.id==='statue'?'growth-sticker':asset.id;
      if(!['growth-sticker','hero-hands','angel','digital-life','coin-dark','coin-gold','coin-silver'].includes(slot))continue;
      const host=asset.id==='hero-hands'?$('#prologue-visual'):$(`[data-visual-slot="${slot}"]`);
      if(!host||!asset.file)continue;
      const source=new URL(asset.file,url);const isVideo=/\.(mp4|webm)$/i.test(source.pathname),el=node(isVideo?'video':'img');el.src=source.href;
      if(isVideo){el.muted=true;el.loop=true;el.playsInline=true;el.preload='metadata';if(asset.poster)el.poster=new URL(asset.poster,url).href;}
      else{el.alt='';el.decoding='async';await new Promise((resolve,reject)=>{el.onload=resolve;el.onerror=reject;});}
      if(asset.id==='hero-hands'){el.className='supplied-hero';host.classList.add('has-assets');}
      host.replaceChildren(el);
    }
    // The user selected the original line diagram; D's particle study remains an unused asset.
    syncMotion();
  }catch(error){console.warn('Visual assets retain fallback:',error);}
}

const chapterObserver=new IntersectionObserver(items=>{
  for(const item of items)if(item.isIntersecting){
    $$('.chapter-nav a').forEach(a=>{if(a.hash===`#${item.target.id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  }
},{rootMargin:'-15% 0px -65% 0px',threshold:0});
$$('.chapter').forEach(section=>chapterObserver.observe(section));
window.addEventListener('pagehide',()=>{clearReaderMedia();for(const controller of Object.values(controllers))controller.pause();});
window.addEventListener('pageshow',syncMotion);
await Promise.allSettled([attachModule('tree',integrations.tree),attachModule('location',integrations.location),attachVisuals(integrations.visuals)]);
readRoute();scheduleLines('tree');scheduleLines('location');
