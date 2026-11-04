// Keep the desktop composition on every device; mobile viewport scales natively.
(() => {
  function fit() {
    const viewport = document.documentElement.clientWidth || innerWidth;
    const width = Math.max(1064, viewport);
    document.documentElement.style.setProperty('--archive-width', `${width}px`);
    document.documentElement.style.setProperty('--archive-zoom', Math.min(1, viewport / width));
  }
  fit();
  addEventListener('resize', fit, { passive: true });
})();
