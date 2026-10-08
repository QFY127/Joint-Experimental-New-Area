/* Scroll-position based reveals and cancellable route transitions. */
(() => {
  'use strict';
  const routeAnimations = new WeakMap();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const selectors = {
    index: '.carousel-wrapper',
    zy: '.carousel-section, .department-panel, .news-card, .分区-card, .quick-link-card, .存档-card',
    gy: '[data-gy-reveal]',
    fq: '[data-site-reveal]',
    bm: '.bm-hero, .department-overview, .department-section, .related-pages',
    xz: '.xz-hero, .xz-overview, .xz-current, .xz-mirrors, .xz-history, .xz-guide, .xz-faq, .xz-related',
    da: '.da-hero, .da-timeline, .editorial-heading, .archive-card, .da-links',
    yx: '.carousel-section, .yx-intro, .scene-image-card, .photo-card, .team-item',
    xw: '.xw-hero, .editorial-heading, .news-item, .quick-link-card, .hot-news-card',
    sm: '.article-wrap'
  };
  function cancel(root) {
    routeAnimations.get(root)?.cancel();
    routeAnimations.delete(root);
  }
  async function transition(root, leaving) {
    cancel(root);
    if (!root.animate) {
      await new Promise(resolve => {
        const name = leaving ? 'site-route-leave' : 'site-route-enter';
        let timer;
        const record = { cancel: () => {
          clearTimeout(timer); root.classList.remove(name);
          if (routeAnimations.get(root) === record) routeAnimations.delete(root);
          resolve();
        } };
        routeAnimations.set(root, record);
        root.classList.add(name);
        timer = setTimeout(record.cancel, leaving ? 260 : 650);
      });
      return;
    }
    const gentle = reduced();
    const frames = leaving
      ? [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: gentle ? 'none' : 'translateY(-8px)' }]
      : [{ opacity: 0, transform: gentle ? 'none' : 'translateY(26px)' }, { opacity: 1, transform: 'none' }];
    const animation = root.animate(frames, {
      duration: leaving ? 260 : gentle ? 280 : 650,
      easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both'
    });
    routeAnimations.set(root, animation);
    try { await animation.finished; } catch { /* Rapid navigation cancels the old transition. */ }
    finally {
      if (routeAnimations.get(root) === animation) {
        routeAnimations.delete(root); animation.cancel();
      }
    }
  }
  function mount(route, root) {
    const controller = new AbortController(), timers = new Set(), animations = new Set();
    const queue = [], records = [...root.querySelectorAll(selectors[route] || '[data-site-reveal]')]
      .map(element => ({ element, state: 'pending' }));
    let raf = 0, busy = false, disposed = false;
    const signal = controller.signal;
    const on = (target, type, fn, options = {}) => target?.addEventListener(type, fn, { ...options, signal });
    const later = (fn, delay) => {
      const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, delay);
      timers.add(id);
    };
    const play = (element, frames, options) => {
      if (disposed || !element?.animate) return;
      const animation = element.animate(frames, { easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards', ...options });
      animations.add(animation);
      const release = () => { animations.delete(animation); animation.cancel(); };
      animation.onfinish = release;
      animation.oncancel = () => animations.delete(animation);
      return animation;
    };
    function revealChapterPhoto(element) {
      if (route !== 'gy' || reduced() || !element.classList.contains('gy-chapter')) return;
      const image = element.querySelector('.gy-image-layer img');
      if (!image) return;
      // Keep the photograph concealed until its pixels are decoded; the copy
      // can already begin rising, so slow images do not stall the whole card.
      element.classList.add('gy-image-waiting');
      const begin = () => {
        if (disposed || !root.isConnected) return;
        element.classList.remove('gy-image-waiting');
        if (!image.naturalWidth) return;
        element.classList.add('gy-image-entering');
        later(() => element.classList.remove('gy-image-entering'), 2200);
      };
      const decoded = () => image.decode ? image.decode().then(begin, begin) : begin();
      if (image.complete) decoded();
      else {
        on(image, 'load', decoded, { once: true });
        on(image, 'error', begin, { once: true });
      }
    }
    function show(record, animate = true) {
      const element = record.element;
      record.state = 'shown';
      if (animate) revealChapterPhoto(element);
      element.removeAttribute('data-motion-pending');
      element.classList.add('motion-shown');
      if (!animate) return;
      const gentle = reduced();
      if (element.animate) {
        // One continuous rise/fade, with no clip-path or brightness wipe.
        const frames = gentle
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, transform: route === 'gy' ? 'translateY(120px)' : 'translateY(66px)' },
             { opacity: .16, transform: route === 'gy' ? 'translateY(98px)' : 'translateY(54px)', offset: .22 },
             { opacity: .64, transform: route === 'gy' ? 'translateY(36px)' : 'translateY(20px)', offset: .72 },
             { opacity: 1, transform: 'translateY(0px)' }];
        play(element, frames, { duration: gentle ? 280 : route === 'gy' ? 1750 : route === 'fq' ? 1250 : 1050,
          easing: 'cubic-bezier(.22,.65,.2,1)' });
        [...element.querySelectorAll('.gy-chapter-heading > *, .gy-chapter-caption > *, .gy-chapter-detail > *, .gy-hero-content > *, .fq-hero-content > *, .fq-region-copy > *, .fq-outpost-copy > *')]
          .forEach((text, index) => play(text, gentle ? [{opacity:0},{opacity:1}] :
            [{ opacity: 0, transform: route === 'gy' ? 'translateY(38px)' : 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0px)' }],
            { duration: gentle ? 240 : route === 'gy' ? 1100 : 800, delay: gentle ? 0 : route === 'gy' ? 350 + index * 100 : 230 + index * 125 }));
      } else {
        element.classList.add('motion-css-enter');
        later(() => element.classList.remove('motion-css-enter'), route === 'gy' ? 1800 : 1300);
      }
    }
    function drain() {
      if (busy || disposed) return;
      while (queue.length) {
        const record = queue.shift();
        if (record.state === 'shown') continue;
        const bounds = record.element.getBoundingClientRect();
        if (bounds.bottom <= (document.getElementById('site-nav')?.offsetHeight || 44)) { show(record, false); continue; }
        show(record);
        busy = true;
        later(() => { busy = false; drain(); }, route === 'gy' ? 850 : route === 'fq' ? 620 : 180);
        break;
      }
    }
    function tick() {
      raf = 0;
      if (disposed || !root.isConnected) return;
      const nav = document.getElementById('site-nav')?.offsetHeight || 44;
      const trigger = nav + (innerHeight - nav) * (route === 'gy' ? .70 : .86);
      records.forEach(record => {
        if (record.state !== 'pending') return;
        const element = record.element;
        // Hidden filter results and inactive gallery tabs must wait until shown.
        if (!element.getClientRects().length) return;
        const bounds = element.getBoundingClientRect();
        if (bounds.bottom <= nav) { show(record, false); return; }
        if (bounds.top <= trigger && bounds.bottom > nav) {
          record.state = 'queued'; queue.push(record);
        }
      });
      drain();
    }
    const schedule = () => { if (!disposed && !raf) raf = requestAnimationFrame(tick); };
    records.forEach(({element}) => element.setAttribute('data-motion-pending', ''));
    // Let incoming layout/scroll restoration settle and paint the initial frame.
    raf = requestAnimationFrame(() => { raf = requestAnimationFrame(tick); });
    on(window, 'scroll', schedule, { passive: true });
    on(window, 'resize', schedule, { passive: true });
    on(window, 'joint-area:hash', schedule);
    on(root, 'click', schedule);
    on(root, 'load', schedule, { capture: true });
    on(root, 'focusin', event => {
      const record = records.find(item => item.element.contains(event.target));
      if (record && record.state !== 'shown') show(record);
    });
    return () => {
      disposed = true; controller.abort(); cancelAnimationFrame(raf);
      timers.forEach(clearTimeout); animations.forEach(animation => animation.cancel());
      records.forEach(({element}) => {
        element.removeAttribute('data-motion-pending');
        ['motion-css-enter', 'gy-image-waiting', 'gy-image-entering'].forEach(name => element.classList.remove(name));
      });
      queue.length = 0;
    };
  }
  window.JointAreaMotion = { mount, enter: root => transition(root, false), leave: root => transition(root, true), cancel };
})();
