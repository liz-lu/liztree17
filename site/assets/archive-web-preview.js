// Keep product previews inside the reader. Never proxy around framing policies.
export function mountWebPreview(parent, entry) {
  const section=document.createElement('section');section.className='reader-web-preview';
  const bar=document.createElement('div');bar.className='web-preview-bar';
  const title=document.createElement('h3');title.textContent=entry.groupId==='projects'?'体验项目':'产品官网预览';
  const origin=document.createElement('span');origin.textContent=new URL(entry.link).hostname;bar.append(title,origin);section.append(bar);
  if(entry.id==='zeemo'){
    const note=document.createElement('p');note.className='web-preview-note';note.textContent='官网静态预览 · Zeemo 限制跨站嵌入，以下为公开首页快照。';
    const scroller=document.createElement('div');scroller.className='web-snapshot';scroller.tabIndex=0;scroller.setAttribute('aria-label','滚动查看 Zeemo 官网快照');
    const img=document.createElement('img');img.src=new URL('./archive-v4/zeemo-site-preview.jpg',import.meta.url).href;img.alt='Zeemo 公开官网首页快照';img.loading='lazy';scroller.append(img);section.append(note,scroller);parent.append(section);return ()=>{};
  }
  const note=document.createElement('p');note.className='web-preview-note';note.textContent='在下方窗口直接浏览与操作；作品介绍保留在上方。';
  const frame=document.createElement('iframe');frame.className='web-live-frame';frame.title=entry.name+'网站内嵌预览';frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-downloads');frame.src=entry.link;
  section.append(note,frame);parent.append(section);
  return ()=>{frame.src='about:blank';frame.remove();};
}
