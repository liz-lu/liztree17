// Shared, brief transitions. Browser history and reduced-motion remain native.
let leaving = false, navigationTimer = null;
export function navigate(href) {
  if (leaving) return;
  const url = new URL(href, location.href);
  leaving = true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    location.assign(url.href);
    return;
  }
  const currentPage=location.pathname.split('/').pop()||'index.html';
  const nextPage=url.pathname.split('/').pop();
  const mapTreePair=url.origin===location.origin&&document.documentElement.dataset.handoff==='map-tree'&&
    ((currentPage==='index.html'&&nextPage==='tree-study.html')||(currentPage==='tree-study.html'&&nextPage==='index.html'));
  if(mapTreePair){
    // Use a predictable paper fade across the whole reading flow, including
    // browsers that cancel native transitions when either page lacks opt-in.
    document.documentElement.classList.add('is-tree-handoff');
  }
  document.documentElement.classList.add('is-leaving');
  navigationTimer=setTimeout(() => location.assign(url.href), mapTreePair?360:180);
}
document.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.('a[href]');
  if (!link || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  event.preventDefault();
  navigate(url.href);
});
window.addEventListener('pageshow', () => {
  clearTimeout(navigationTimer);navigationTimer=null;
  leaving = false;
  document.documentElement.classList.remove('is-leaving','is-tree-handoff');
});

