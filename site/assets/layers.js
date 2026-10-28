import { groups } from './data.js?v=6f8b49917bc4';
import { details } from './details.js?v=6f8b49917bc4';
import { navigate } from './transition.js?v=6f8b49917bc4';
import { mountProjectMedia } from './project-media.js?v=web-20261028-1';
import { loadProgress, startVisit, markViewed, finishVisit, isProgressPersistent } from './tree-progress.js?v=6f8b49917bc4';

const parameters = new URLSearchParams(location.search);
const requested = parameters.get('type');
const treeFlow = parameters.get('flow') !== 'standalone';
const treeHref = 'tree-study.html?form=7&flow=1';
const type = Object.hasOwn(groups, requested) ? requested : 'campus';
const group = groups[type];
const names = { campus: '校园与学习', internships: '实习经历', projects: '个人 AI 项目' };
const next = {
  campus: { label: '走向实习', href: 'layers.html?type=internships' },
  internships: { label: '走向作品', href: 'layers.html?type=projects' },
  projects: { label: '走向下一站', href: 'future.html' }
}[type];
const container = document.querySelector('#experience-detail');
const readLink = document.querySelector('#read-detail');
const prompt = document.querySelector('#selection-prompt');
const status = document.querySelector('#detail-status');
let selected = -1;
let detailRendered = false;
let diagram = null;
let flowCount = null;
let flowReturn = null;
let storageNote = null;
let mediaCleanups = [];

document.title = '卢佳丽 · ' + names[type];
document.querySelector('#group-name').textContent = names[type];
document.querySelector('#group-intro').textContent = group.intro;
document.querySelector('#group-index').textContent = '03 / ' + group.index + ' · EXPERIENCE IN SECTIONS';
document.querySelectorAll('.group-navigation a').forEach(a => {
  if (a.search === '?type=' + type) a.setAttribute('aria-current', 'page');
});

function returnToTree(event) {
  if (event && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
  event?.preventDefault();
  finishVisit(type);
  navigate(treeHref);
}
function updateFlowProgress() {
  if (!treeFlow || !flowCount) return;
  const state = loadProgress(), count = state.viewed[type].length;
  flowCount.textContent = `已查看 ${count}/${group.layers.length}`;
  const ready = count === group.layers.length && !state.completed.includes(type);
  flowReturn.textContent = ready ? '返回树 · 让这枝长叶 ↗' : '返回成长之树 ↗';
  storageNote.hidden = isProgressPersistent();
}
if (treeFlow) {
  document.body.classList.add('flow-layers');
  startVisit(type);
  const back = document.querySelector('.subnav a[href="tree.html"]');
  back.href = treeHref;
  back.addEventListener('click', returnToTree);
  const bar = text('nav', 'flow-progress', '');
  bar.setAttribute('aria-label', '本类浏览进度');
  flowCount = text('span', 'flow-count', '');
  flowCount.setAttribute('aria-live', 'polite');
  flowReturn = text('a', 'flow-return', '返回成长之树 ↗');
  flowReturn.href = treeHref;
  flowReturn.addEventListener('click', returnToTree);
  storageNote = text('p', 'flow-storage-note', '浏览器未允许保存本次进度；当前页仍可浏览，离开或刷新后可能需要重新查看。');
  storageNote.hidden = true;
  bar.append(flowCount, flowReturn, storageNote);
  container.after(bar);
  document.querySelectorAll('.group-navigation a').forEach(link => {
    const target = new URL(link.href);
    if (target.pathname.endsWith('/layers.html')) {
      target.searchParams.set('flow', 'tree');
      link.href = target.pathname + target.search;
    } else if (target.pathname.endsWith('/future.html')) {
      link.href = treeHref;
      link.textContent = '返回树，选择下一枝 ↗';
      link.addEventListener('click', returnToTree);
    }
  });
  updateFlowProgress();
}

function text(tag, className, value) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
}
// Only our authored **emphasis** is interpreted; no HTML is injected.
function projectCopy(value, tag = 'dd', className = '') {
  const node = text(tag, className, '');
  value.split(/(\*\*[^*]+\*\*)/g).forEach(part => {
    node.append(part.startsWith('**') && part.endsWith('**')
      ? text('strong', '', part.slice(2, -2)) : document.createTextNode(part));
  });
  return node;
}
function mountMedia(parent, kind, headingLevel = 'h3') {
  const section = text('section', 'detail-media', '');
  section.setAttribute('aria-label', kind === 'competition' ? '竞赛图纸' : 'AI 视频作品');
  section.append(text(headingLevel, 'detail-media-title', kind === 'competition' ? '《破界织境》' : 'AI 视频作品'));
  if (kind === 'competition') section.append(text('p', 'detail-media-subtitle', '基于边界理论与空间缝合理论的社区更新改造'));
  const host = text('div', 'detail-media-host', '');
  section.append(host);
  parent.append(section);
  try { mediaCleanups.push(mountProjectMedia(host, kind)); }
  catch (error) {
    console.warn('Project media could not load.', error);
    host.append(text('p', 'detail-note', '作品暂未加载，请刷新后重试。'));
  }
}
function renderDetail(index) {
  mediaCleanups.forEach(cleanup => cleanup?.());
  mediaCleanups = [];
  container.replaceChildren();
  container.hidden = index < 0;
  readLink.hidden = index < 0;
  prompt.textContent = index < 0 ? '点击切片，展开经历。' : '';
  if (index < 0) { status.textContent = '已返回经历总览。'; return; }
  const layer = group.layers[index];
  const content = details[layer.id];
  const article = document.createElement('article');
  article.dataset.experience = layer.id;
  const header = text('header', 'detail-header', '');
  const meta = text('p', 'detail-meta', '');
  meta.append(text('span', '', '0' + (index + 1) + ' / ' + layer.tag), text('span', '', layer.time));
  header.append(meta, text('h2', '', layer.name));
  if (layer.role) header.append(text('p', 'detail-role', layer.role));
  header.append(projectCopy(content.headline, 'p', 'detail-headline'));
  article.append(header);
  content.projects?.forEach((project, i) => {
    const section = text('section', 'detail-project', '');
    const headingId = `${layer.id}-${project.id}-title`;
    section.setAttribute('aria-labelledby', headingId);
    section.dataset.project = project.id;
    const heading = text('h3', '', project.title);
    heading.id = headingId;
    const projectHeader = text('header', 'detail-project-header', '');
    const number = text('span', 'detail-number', String(i + 1).padStart(2, '0'));
    number.setAttribute('aria-hidden', 'true');
    projectHeader.append(number, heading);
    const list = text('dl', 'detail-project-story', '');
    [['problem', '问题'], ['judgment', '判断'], ['action', '行动'], ['outcome', '成果']].forEach(([key, label]) => {
      const row = text('div', `detail-project-row${key === 'outcome' ? ' is-outcome' : ''}`, '');
      row.append(text('dt', '', label), projectCopy(project[key]));
      list.append(row);
    });
    section.append(projectHeader, list);
    article.append(section);
    if (project.media) mountMedia(section, project.media, 'h4');
  });
  content.sections?.forEach((section, i) => {
    const row = text('section', 'detail-section', '');
    const copy = text('div', '', '');
    copy.append(text('h3', '', section.title), projectCopy(section.body, 'p'));
    row.append(text('span', 'detail-number', '0' + (i + 1)), copy);
    article.append(row);
  });
  if (content.outcomes?.length) {
    const outcomes = text('section', 'detail-outcomes', '');
    const list = document.createElement('ul');
    content.outcomes.forEach(item => list.append(projectCopy(item, 'li')));
    outcomes.append(text('h3', '', '成果'), list);
    article.append(outcomes);
  }
  if (content.note) article.append(text('p', 'detail-note', content.note));
  if (content.media) mountMedia(article, content.media);
  if (layer.link) {
    const link = document.createElement('a');
    link.className = 'text-link detail-link';
    link.href = layer.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', layer.linkText + '（新标签页）');
    const arrow = text('span', '', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(text('span', '', layer.linkText), arrow);
    article.append(link);
  }
  container.append(article);
  if (treeFlow) { markViewed(type, layer.id); updateFlowProgress(); }
  status.textContent = '已选择' + layer.name + '，详情在建筑切片下方。';
}
function select(index, { updateHistory = true, animate = true } = {}) {
  if (!Number.isInteger(index) || index < -1 || index >= group.layers.length) return;
  const changed = index !== selected || !detailRendered;
  selected = index;
  if (changed) { renderDetail(index); detailRendered = true; }
  diagram?.select(index, { animate });
  if (updateHistory) {
    const hash = index < 0 ? '#overview' : '#' + group.layers[index].id;
    if (location.hash !== hash) history.pushState(null, '', location.pathname + location.search + hash);
  }
}
function sync() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { /* Invalid fragments open overview. */ }
  // The reading anchor is an in-page destination, not a different experience.
  if (id === 'experience-detail') return;
  const initial = !id && (type === 'internships' || type === 'projects') ? 0 : group.layers.findIndex(layer => layer.id === id);
  select(initial, { updateHistory: false, animate: false });
}
readLink.addEventListener('click', event => {
  event.preventDefault();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  container.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'start' });
});
window.addEventListener('popstate', sync);
window.addEventListener('hashchange', sync);
window.addEventListener('pageshow', () => { if (treeFlow) updateFlowProgress(); });
document.addEventListener('keydown', event => {
  if (!event.defaultPrevented && event.key === 'Escape' && selected >= 0 && !document.querySelector('dialog[open]')) select(-1);
});
window.journeyLayers = {
  select,
  inspect: () => ({ type, selected, id: group.layers[selected]?.id ?? null, order: group.layers.map(layer => layer.id), treeFlow, ...(treeFlow ? { progress: loadProgress() } : {}) })
};
sync();
// Narrative loads independently: a graphics failure must not erase the user's work.
try {
  const { mountSlices } = await import('./slices-v6.js?v=6f8b49917bc4');
  diagram = mountSlices(document.querySelector('#slice-stage'), {
    layers: group.layers, onSelect: index => select(index),
    nextLabel: treeFlow ? '返回成长之树' : next.label, onNext: () => treeFlow ? returnToTree() : navigate(next.href)
  });
  window.journeySlices = diagram;
  diagram.select(selected, { animate: !location.hash });
} catch (error) {
  console.warn('Architectural diagram could not load; experience text remains available.', error);
  const fallback = text('nav', 'slice-fallback', '');
  fallback.setAttribute('aria-label', '选择经历');
  group.layers.forEach((layer, index) => {
    const button = text('button', 'quiet-button', '0' + (index + 1) + ' / ' + layer.name);
    button.type = 'button'; button.addEventListener('click', () => select(index)); fallback.append(button);
  });
  document.querySelector('#slice-stage').replaceChildren(text('p', 'quiet', '图示暂未加载，可先选择下方经历阅读。'), fallback);
}
