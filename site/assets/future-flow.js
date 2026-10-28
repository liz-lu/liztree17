import { visitFuture, isProgressPersistent } from './tree-progress.js?v=6f8b49917bc4';

// The published/default future page remains unchanged. Only the opt-in local
// tree journey records arrival and offers a new round once it is really ready.
if (new URLSearchParams(location.search).get('flow') !== 'standalone') {
  const back = document.querySelector('.future-note a[href="tree.html"]');
  if (back) {
    back.href = 'tree-study.html?form=7&flow=1';
    const update = () => {
      const state = visitFuture();
      const ready = state.completed.length === 3 && state.futureVisited;
      back.textContent = '← 回到成长之树';
      back.dataset.roundReady = String(ready);
      // A restricted storage environment must not promise a persisted round.
      if (!isProgressPersistent()) back.setAttribute('aria-label', '回到成长之树；浏览器未允许保存本次进度');
      else back.removeAttribute('aria-label');
    };
    update();
    window.addEventListener('pageshow', update);
  }
}
