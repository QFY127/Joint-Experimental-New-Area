/* Keep shell roots and the audio element alive while changing page content.
 * Works on ordinary static hosting and also offline when opening index.html. */
(() => {
  'use strict';
  const rootURL = new URL('../', document.currentScript.src);
  const assetVersion = '20261002-motion-v9';
  const routes = new Set(['index', 'zy', 'gy', 'fq', 'bm', 'xz', 'da', 'yx', 'xw', 'sm']);
  const legacyRoutes = new Map([
    ['/webpage/country/download.html', 'xz'],
    ['/webpage/country/archive.html', 'da'],
    ['/webpage/country/scenery.html', 'yx']
  ]);
  const content = document.getElementById('page-content');
  const nav = document.getElementById('site-nav');
  const status = document.getElementById('route-status');
  const styles = new Map([...document.querySelectorAll('[data-page-style]')].map(link => [link.dataset.pageStyle, Promise.resolve(link)]));
  let current = document.body.dataset.page;
  let dispose = () => {};
  let navigation = 0, pendingRequest = null, offlinePromise = null;
  let statusTimer = 0;
  const pageURL = route => new URL(`${route}.html`, rootURL);
  const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const shellIds = ['site-brand', 'site-header', 'site-nav', 'site-footer'];
  function readPage(source) {
    return {
      title: source.title,
      content: source.getElementById('page-content').innerHTML,
      icon: source.querySelector('link[rel="icon"]')?.getAttribute('href'),
      shell: Object.fromEntries(shellIds.map(id => [id, source.getElementById(id).innerHTML]))
    };
  }
  function updateShell(page) {
    shellIds.forEach(id => {
      const node = document.getElementById(id);
      if (page.shell?.[id] !== undefined && node.innerHTML !== page.shell[id]) node.innerHTML = page.shell[id];
    });
    if (page.icon) document.querySelector('link[rel="icon"]').setAttribute('href', page.icon);
  }
  function enterCarousel(options, route) {
    if (!options.entrance || route !== 'zy') return false;
    const carousel = content.querySelector('.carousel-section');
    if (!carousel) return false;
    // Leave the navigation above the viewport instead of sticking over the image.
    document.body.classList.add('carousel-entry');
    // Original width/height metadata reserves the carousel's space even when
    // images are still downloading, so this needs only one scroll operation.
    carousel.scrollIntoView({ behavior: 'auto', block: 'start' });
    return true;
  }
  function pageHash(url) {
    if (url.protocol === 'file:' && url.hash.startsWith('#page=')) {
      const anchor = new URLSearchParams(url.hash.slice(1)).get('anchor');
      return anchor ? '#' + encodeURIComponent(anchor) : '';
    }
    return url.hash;
  }
  function routeFromURL(url) {
    if (url.origin !== rootURL.origin || !url.pathname.startsWith(rootURL.pathname)) return null;
    if (url.protocol === 'file:' && url.hash.startsWith('#page=')) {
      const route = new URLSearchParams(url.hash.slice(1)).get('page');
      if (routes.has(route)) return route;
    }
    const relative = url.pathname.slice(rootURL.pathname.length);
    if (!relative) return 'index';
    const match = /^([a-z]+)\.html$/.exec(relative);
    return match && routes.has(match[1]) ? match[1] : null;
  }
  function stateFor(route) { return { jointArea: true, route }; }
  function writeHistory(route, url, replace = false) {
    let target = url;
    if (location.protocol === 'file:') {
      // Browsers forbid changing file:// pathname with pushState. Use a hash
      // route on the same local file, preserving audio and back/forward.
      target = new URL(location.href);
      const params = new URLSearchParams({ page: route });
      const hash = pageHash(url);
      if (hash && hash !== '#') {
        try { params.set('anchor', decodeURIComponent(hash.slice(1))); }
        catch { params.set('anchor', hash.slice(1)); }
      }
      target.hash = params.toString();
    }
    history[replace ? 'replaceState' : 'pushState'](stateFor(route), '', target);
  }
  function announce(message, persistent = false) {
    clearTimeout(statusTimer); status.hidden = false; status.textContent = message;
    if (!persistent) statusTimer = setTimeout(() => { status.hidden = true; }, 3000);
  }
  function hideStatus() { clearTimeout(statusTimer); status.hidden = true; }
  function updateNav() {
    nav.querySelectorAll('[data-route]').forEach(link => {
      const active = link.dataset.route === current;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    document.documentElement.style.setProperty('--nav-height', `${nav.offsetHeight}px`);
  }
  if ('ResizeObserver' in window) new ResizeObserver(updateNav).observe(nav);
  else window.addEventListener('resize', updateNav, { passive: true });
  function offlinePages() {
    if (window.JOINT_AREA_PAGES) return Promise.resolve(window.JOINT_AREA_PAGES);
    if (!offlinePromise) offlinePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(`assets/page-data.js?v=${assetVersion}`, rootURL).href;
      script.onload = () => window.JOINT_AREA_PAGES ? resolve(window.JOINT_AREA_PAGES) : reject(new Error('离线页面数据不存在'));
      script.onerror = () => { offlinePromise = null; script.remove(); reject(new Error('离线页面无法读取')); };
      document.head.append(script);
    });
    return offlinePromise;
  }
  async function loadPage(route, signal) {
    let page;
    if (location.protocol === 'file:') page = (await offlinePages())[route];
    else {
      try {
        const requestURL = pageURL(route);
        requestURL.searchParams.set('v', assetVersion);
        const response = await fetch(requestURL, { signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const documentPage = new DOMParser().parseFromString(await response.text(), 'text/html');
        const main = documentPage.getElementById('page-content');
        if (!main || documentPage.body.dataset.page !== route) throw new Error('页面结构不匹配');
        page = readPage(documentPage);
      } catch (error) {
        if (signal.aborted) throw error;
        // A temporary hosting/fetch failure must not force a document reload
        // (which would interrupt audio); use the bundled offline copy instead.
        page = (await offlinePages())[route];
      }
    }
    if (!page) throw new Error('页面不存在');
    return page;
  }
  function loadStyle(route) {
    if (!styles.has(route)) {
      const promise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.dataset.pageStyle = route;
        link.href = new URL(`assets/pages/${route}.css?v=${assetVersion}`, rootURL).href;
        link.onload = () => resolve(link);
        link.onerror = () => { styles.delete(route); link.remove(); reject(new Error('页面样式无法读取')); };
        // Each stylesheet is scoped to body[data-page], so preloading it cannot
        // alter the current page or the persistent shell.
        document.head.insertBefore(link, document.querySelector('[data-site-responsive]'));
      });
      styles.set(route, promise);
    }
    return styles.get(route);
  }
  function hashTarget(hash) {
    if (!hash || hash === '#') return null;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return null; }
    window.dispatchEvent(new CustomEvent('joint-area:hash', { detail: { id } }));
    return document.getElementById(id);
  }
  function scrollToHash(hash, behavior = smooth()) {
    const target = hashTarget(hash);
    if (target) target.scrollIntoView({ behavior, block: 'start' });
    else if (hash === '#') window.scrollTo({ top: 0, behavior });
  }
  async function navigate(url, options = {}) {
    const route = routeFromURL(url);
    const hash = pageHash(url);
    if (!route) return;
    const token = ++navigation;
    pendingRequest?.abort();
    window.JointAreaMotion?.cancel(content);
    document.body.classList.remove('is-navigating');
    pendingRequest = new AbortController();
    // An explicit anchor keeps this page active. All page entries, including
    // the active nav and Back/Forward, remount from a fresh HTML template.
    if (route === current && hash) {
      if (!options.pop && url.href !== location.href) {
        writeHistory(route, url);
      }
      hideStatus(); content.removeAttribute('aria-busy');
      scrollToHash(hash, options.pop ? 'auto' : smooth());
      return;
    }
    content.setAttribute('aria-busy', 'true'); announce('正在加载页面…', true);
    document.body.classList.add('is-navigating');
    try {
      const [page] = await Promise.all([loadPage(route, pendingRequest.signal), loadStyle(route)]);
      if (token !== navigation) return;
      await window.JointAreaMotion?.leave(content);
      if (token !== navigation) return;
      dispose();
      document.body.classList.remove('carousel-entry');
      content.innerHTML = page.content;
      updateShell(page);
      current = route;
      document.body.dataset.page = route;
      document.title = page.title;
      if (!options.pop && url.href !== location.href) writeHistory(route, url);
      updateNav();
      dispose = window.JointAreaFeatures.mount(route, content);
      content.removeAttribute('aria-busy'); hideStatus();
      document.body.classList.remove('is-navigating');
      content.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (token !== navigation) return;
        if (!enterCarousel(options, route)) {
          if (hash) scrollToHash(hash, 'auto');
          else window.scrollTo(0, 0);
        }
        window.JointAreaMotion?.enter(content);
      });
    } catch (error) {
      if (token !== navigation || pendingRequest.signal.aborted) return;
      window.JointAreaMotion?.cancel(content);
      document.body.classList.remove('is-navigating');
      content.removeAttribute('aria-busy');
      announce('页面加载失败，请再次点击导航。');
      // Keep the current page and its playing audio rather than reload it.
      if (options.pop) {
        writeHistory(current, pageURL(current), true);
      }
      console.error('页面切换失败:', error);
    }
  }
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const raw = link.getAttribute('href');
    if (!raw || /^(?:mailto:|tel:|javascript:)/i.test(raw)) return;
    // Preserve the original nav href (including active '#' and the homepage
    // URL). Normal clicks use route metadata to retain the playing audio.
    const navRoute = nav.contains(link) && link.dataset.route;
    if (routes.has(navRoute)) {
      event.preventDefault(); navigate(pageURL(navRoute)); return;
    }
    const url = raw.startsWith('#') ? new URL(raw, pageURL(current)) : new URL(raw, location.href);
    // Old internal links retain their literal href. Handle their known page
    // destinations in the router so they also keep the audio instance alive.
    const legacyRoute = url.origin === rootURL.origin && legacyRoutes.get(url.pathname);
    if (legacyRoute) {
      const target = pageURL(legacyRoute); target.search = url.search; target.hash = url.hash;
      event.preventDefault(); navigate(target); return;
    }
    const route = routeFromURL(url);
    if (!route) return;
    if (raw.startsWith('#')) {
      if (raw === '#') return;
      if (!hashTarget(url.hash)) return;
      event.preventDefault();
      writeHistory(current, url);
      scrollToHash(url.hash); return;
    }
    event.preventDefault(); navigate(url, { entrance: current === 'index' && link.id === 'jumpBtn' });
  });
  window.addEventListener('popstate', () => { navigate(new URL(location.href), { pop: true }); });
  window.addEventListener('scroll', () => {
    // Ordinary sticky navigation returns when the visitor scrolls back to it.
    if (document.body.classList.contains('carousel-entry') && scrollY <= nav.offsetTop) {
      document.body.classList.remove('carousel-entry');
    }
  }, { passive: true });
  try { history.scrollRestoration = 'manual'; } catch {}
  history.replaceState(stateFor(current), '', location.href);
  updateNav();
  dispose = window.JointAreaFeatures.mount(current, content);
  window.JointAreaMotion?.enter(content);
  const initialURL = new URL(location.href);
  if (routeFromURL(initialURL) !== current) navigate(initialURL, { pop: true });
  else if (pageHash(initialURL)) requestAnimationFrame(() => scrollToHash(pageHash(initialURL), 'auto'));
  else requestAnimationFrame(() => window.scrollTo(0, 0));
})();
