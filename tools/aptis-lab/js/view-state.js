(() => {
  'use strict';

  const view = () => location.hash.replace('#', '') || 'dashboard';
  const key = (name) => `aptis.view.scroll.${name}`;
  const save = () => {
    try { sessionStorage.setItem(key(view()), String(Math.max(0, Math.round(window.scrollY || 0)))); }
    catch (_) {}
  };
  const restore = () => {
    let y = 0;
    try { y = Number(sessionStorage.getItem(key(view())) || 0); } catch (_) {}
    if (y > 0) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' })));
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#labNav [data-view]')) save();
  }, true);
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', save);
  window.addEventListener('hashchange', () => setTimeout(restore, 60));

  const root = document.querySelector('#pageContent');
  if (root) new MutationObserver(() => setTimeout(restore, 40)).observe(root, { childList: true, subtree: false });
})();
