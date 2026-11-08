// A owns the visible fallback and lifecycle; B owns the renderer and real anchors.
export function mountProgressiveTree(host, load, options = {}) {
  const poster = host.querySelector('.tree-fallback');
  const status = document.createElement('div');
  status.className = 'tree-load-status'; status.hidden = true;
  const message = document.createElement('span');
  message.setAttribute('role', 'status');
  const retry = document.createElement('button');
  retry.type = 'button'; retry.dataset.treeRetry = ''; retry.textContent = '重试动态树'; retry.hidden = true;
  status.append(message, retry); host.append(status);
  let current, sequence = 0;

  function start() {
    if (current && !current.finished) return;
    current?.abort.abort(); current?.controller?.dispose(); current?.mount.remove();
    const attempt = {id: ++sequence, abort: new AbortController(), finished: false, controller: null};
    current = attempt;
    const mount = document.createElement('div'); mount.className = 'tree-live-mount is-pending'; mount.inert = true; mount.setAttribute('aria-hidden','true');
    attempt.mount = mount; host.prepend(mount);
    poster.hidden = false; status.hidden = true; retry.hidden = true;
    host.dataset.integrated = 'loading'; host.setAttribute('aria-busy', 'true');
    options.onReset?.();
    const loading = setTimeout(() => {
      if (current !== attempt || attempt.finished) return;
      message.textContent = '动态树正在载入，经历可先阅读。'; status.hidden = false;
    }, 4000);
    let deadline;
    function fail(error) {
      if (current !== attempt || host.dataset.integrated === 'failed') return;
      attempt.finished = true; clearTimeout(loading); clearTimeout(deadline);
      host.dataset.integrated = 'failed'; host.removeAttribute('aria-busy');
      poster.hidden = false; mount.classList.add('is-pending');
      attempt.abort.abort(); attempt.controller?.dispose(); mount.remove();
      options.onError?.(error);
      attempt.reloadPage = error.reloadPage === true;
      retry.textContent = attempt.reloadPage ? '重新载入页面' : '重试动态树';
      message.textContent = '暂时显示静态树，经历仍可阅读。'; status.hidden = false; retry.hidden = false;
    }
    const timeout = new Promise((_, reject) => {
      deadline = setTimeout(() => reject(new Error('Tree load timed out')), 50000);
    });
    const work = (async () => {
      const controller = await load(mount, {
        signal: attempt.abort.signal, loadTimeoutMs: 45000, hdrTimeoutMs: 8000,
        onState(event) { if (event.state === 'error') fail(new Error(event.reason || event.message || 'Tree unavailable')); },
        onProgress(event) {
          if (current !== attempt || attempt.finished || event.asset !== 'model') return;
          if (event.total > 0) message.textContent = `动态树正在载入 ${Math.min(99, Math.round(event.ratio * 100))}%，经历可先阅读。`;
        }
      });
      attempt.controller = controller;
      if (current !== attempt || attempt.abort.signal.aborted) { controller?.dispose(); return; }
      if (!controller?.getStats?.().ready) throw new Error('Tree renderer not ready');
      // The complete silhouette stays visible; no second empty-to-grown reveal after a slow download.
      controller.seek?.(3.3);
      if (!controller.getStats().ready) throw new Error('Tree first frame failed');
      await new Promise(requestAnimationFrame);
      if (current !== attempt || attempt.abort.signal.aborted) { controller.dispose(); return; }
      attempt.finished = true; clearTimeout(loading); clearTimeout(deadline);
      host.dataset.integrated = 'true'; host.removeAttribute('aria-busy');
      mount.classList.remove('is-pending'); mount.inert = false; mount.removeAttribute('aria-hidden'); poster.hidden = true; status.hidden = true;
      options.onReady?.(controller);
    })();
    Promise.race([work, timeout]).catch(fail);
  }
  retry.addEventListener('click', () => current?.reloadPage ? location.reload() : start());
  start();
  return {retry: start};
}
