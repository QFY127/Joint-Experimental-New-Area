/* Page-only behavior. Each mount returns a cleanup function: no duplicated
 * global scroll handlers, leaked observers, or background carousel timers. */
(() => {
  'use strict';
  class PageScope {
    constructor(root) {
      this.root = root;
      this.controller = new AbortController();
      this.timers = new Set();
      this.observers = [];
      this.cleanups = [];
    }
    on(target, event, handler, options = {}) {
      target?.addEventListener(event, handler, { ...options, signal: this.controller.signal });
    }
    later(handler, delay) {
      const id = setTimeout(() => { this.timers.delete(id); handler(); }, delay);
      this.timers.add(id);
      return id;
    }
    repeat(handler, delay) { const id = setInterval(handler, delay); this.timers.add(id); return id; }
    cancel(id) { clearTimeout(id); clearInterval(id); this.timers.delete(id); }
    dispose() {
      this.controller.abort();
      this.timers.forEach(id => { clearTimeout(id); clearInterval(id); });
      this.observers.forEach(observer => observer.disconnect());
      this.cleanups.forEach(cleanup => cleanup());
    }
  }
  const $ = (root, selector) => root.querySelector(selector);
  const $$ = (root, selector) => [...root.querySelectorAll(selector)];
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function carousel(scope, route) {
    const root = scope.root;
    const landing = route === 'index';
    const images = route === 'yx';
    const carouselDuration = route === 'zy' ? 600 : 800;
    const carouselEasing = route === 'index' ? 'cubic-bezier(.25,.46,.45,.94)' : route === 'zy' ? 'ease' : 'ease-in-out';
    const area = $(root, landing ? '.carousel-wrapper' : '.carousel-section');
    const track = $(root, landing ? '.carousel-inner' : images ? '#carousel' : '.carousel-track');
    if (!area || !track) return;
    const items = [...track.children];
    if (!items.length) return;
    const dots = $$(root, images ? '.dot' : '.indicator');
    const prev = $(root, images ? '#prevBtn' : '.prev-btn');
    const next = $(root, images ? '#nextBtn' : '.next-btn');
    const buttons = $$(root, landing ? '.carousel-control' : '.carousel-btn');
    const landingContent = $(root, '.page-content');
    let index = 0, autoplay = null, hideTimer = null, touchX = null, touchY = null;
    let transitioning = false, queuedIndex = null, waitingIndex = null, disposed = false;
    let runningAnimations = [];
    let useWAAPI = items.every(item => typeof item.animate === 'function' && typeof $(item, 'img')?.animate === 'function');
    track.dataset.carouselEngine = useWAAPI ? 'waapi' : 'css';
    const decoded = new WeakSet();
    scope.cleanups.push(() => {
      disposed = true;
      runningAnimations.forEach(animation => animation.cancel());
      runningAnimations = [];
    });
    function hideUI() {
      if (landing) {
        landingContent.classList.add('ui-hide');
        buttons.forEach(button => button.classList.add('ui-hide'));
      }
    }
    function showUI() {
      scope.cancel(hideTimer);
      if (landing) {
        landingContent.classList.remove('ui-hide');
        buttons.forEach(button => button.classList.remove('ui-hide'));
      }
    }
    function scheduleHide() { scope.cancel(hideTimer); hideTimer = scope.later(hideUI, landing ? 3000 : 4000); }
    function update(previous = -1) {
      // Move only adjacent visible frames, including the last-to-first loop.
      if (previous >= 0 && previous !== index) items[previous].classList.add('is-leaving');
      items.forEach((item, i) => {
        item.classList.toggle('active', i === index);
        item.setAttribute('aria-hidden', String(i !== index));
      });
      if (previous >= 0 && previous !== index) items[index].classList.add('is-entering');
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
        dot.setAttribute('aria-pressed', String(i === index));
      });
      const upcoming = items[(index + 1) % items.length]?.querySelector('img');
      if (upcoming?.complete && upcoming.naturalWidth && upcoming.decode && !decoded.has(upcoming)) {
        upcoming.decode().then(() => decoded.add(upcoming)).catch(() => {});
      }
    }
    function select(target, direction = 1) {
      if (disposed || target === index || items.length < 2) return;
      if (transitioning) { queuedIndex = { target, direction }; return; }
      const image = $(items[target], 'img');
      if (image && !image.complete) {
        if (waitingIndex === target) return;
        waitingIndex = target;
        scope.on(image, 'load', () => {
          if (waitingIndex !== target) return;
          waitingIndex = null;
          if (image.naturalWidth) { select(target, direction); start(); }
        }, { once: true });
        scope.on(image, 'error', () => { if (waitingIndex === target) waitingIndex = null; }, { once: true });
        return;
      }
      if (image && !image.naturalWidth) return;
      // A downloaded but undecoded image can otherwise appear halfway through
      // the slide. Decode before starting the paired movement animations.
      if (image?.decode && !decoded.has(image)) {
        if (waitingIndex === target) return;
        waitingIndex = target;
        image.decode().then(() => decoded.add(image), () => decoded.add(image)).then(() => {
          if (disposed || waitingIndex !== target) return;
          waitingIndex = null;
          select(target, direction); start();
        });
        return;
      }
      const previous = index;
      index = target;
      track.style.setProperty('--carousel-enter-x', direction < 0 ? '-100%' : '100%');
      track.style.setProperty('--carousel-exit-x', direction < 0 ? '100%' : '-100%');
      update(previous);
      transitioning = true;
      let finished = false, completionTimer = null;
      const finish = () => {
        if (finished || disposed) return;
        finished = true;
        if (completionTimer !== null) scope.cancel(completionTimer);
        runningAnimations.forEach(animation => animation.cancel());
        runningAnimations = [];
        items[previous].classList.remove('is-leaving');
        items[target].classList.remove('is-entering');
        transitioning = false;
        const next = queuedIndex;
        queuedIndex = null;
        if (next !== null) select(next.target, next.direction);
      };
      if (useWAAPI) {
        try {
          const options = { duration: carouselDuration, easing: carouselEasing, fill: 'both' };
          const enterX = direction < 0 ? '-100%' : '100%';
          const exitX = direction < 0 ? '100%' : '-100%';
          runningAnimations.push(
            items[target].animate([
              { opacity: 0, transform: `translate3d(${enterX},0,0)` },
              { opacity: 1, transform: 'translate3d(0,0,0)' }
            ], options));
          runningAnimations.push(
            items[previous].animate([
              { opacity: 1, transform: 'translate3d(0,0,0)' },
              { opacity: 0, transform: `translate3d(${exitX},0,0)` }
            ], options));
          runningAnimations.forEach(animation => animation.finished.catch(() => {}));
          runningAnimations[0].onfinish = finish;
          // Fallback if an animation is cancelled by the browser without a
          // finish event. The same finish guard prevents a second transition.
          completionTimer = scope.later(finish, carouselDuration + 120);
          return;
        } catch {
          runningAnimations.forEach(animation => animation.cancel());
          runningAnimations = [];
          useWAAPI = false;
          track.dataset.carouselEngine = 'css';
        }
      }
      completionTimer = scope.later(finish, carouselDuration);
    }
    function stop() { scope.cancel(autoplay); autoplay = null; }
    function start() {
      stop();
      if (!document.hidden && items.length > 1) autoplay = scope.repeat(() => select((index + 1) % items.length), 5000);
    }
    function move(delta) { select((index + delta + items.length) % items.length, delta); start(); }
    scope.on(prev, 'click', () => move(-1));
    scope.on(next, 'click', () => move(1));
    dots.forEach((dot, i) => {
      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('aria-label', `第 ${i + 1} 张图片`);
      scope.on(dot, 'click', () => { select(i, i < index ? -1 : 1); start(); });
      scope.on(dot, 'keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); dot.click(); } });
    });
    scope.on(document, 'visibilitychange', () => document.hidden ? stop() : start());
    scope.on(area, 'touchstart', event => {
      touchX = event.changedTouches[0].clientX;
      touchY = event.changedTouches[0].clientY;
      stop();
      showUI();
    }, { passive: true });
    scope.on(area, 'touchend', event => {
      const dx = event.changedTouches[0].clientX - touchX;
      const dy = event.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? -1 : 1);
      start(); scheduleHide();
    }, { passive: true });
    scope.on(area, 'touchcancel', start, { passive: true });
    const hoverTargets = landing ? [$ (root, '#hoverBox')] : [];
    hoverTargets.forEach(target => {
      scope.on(target, 'mouseenter', showUI);
      scope.on(target, 'mouseleave', scheduleHide);
      scope.on(target, 'focusin', showUI);
      scope.on(target, 'focusout', scheduleHide);
    });
    update(); start();
    if (landing) {
      // Initial entrance animation without waiting for window.onload on SPA mounts.
      const logo = $(root, '#logo'), jump = $(root, '#jumpBtn');
      if (!reducedMotion()) {
        [logo, jump].forEach((node, i) => { node.style.opacity = '0'; node.style.transform = `translateY(${i ? 20 : -20}px)`; });
        scope.later(() => {
          logo.style.transition = 'opacity 1.2s ease, transform 1.2s ease';
          logo.style.opacity = '1'; logo.style.transform = 'translateY(0)';
          scope.later(() => { jump.style.transition = 'opacity 1.2s ease, transform 1.2s ease'; jump.style.opacity = '1'; jump.style.transform = 'translateY(0)'; scheduleHide(); }, 500);
        }, 300);
      } else scheduleHide();
    }
  }
  function anchors(scope) {
    scope.on(scope.root, 'click', event => {
      const link = event.target.closest('.side-nav-list a, #sceneNav a, #teamNav a');
      if (!link) return;
      const list = link.closest('ul, ol, #sceneNav, #teamNav');
      list?.querySelectorAll('a').forEach(a => a.classList.toggle('active', a === link));
    });
  }
  function archives(scope) {
    const root = scope.root, cards = $$(root, '.archive-card');
    const pagination = $(root, '#paginationBox');
    let page = 1;
    const totalPages = Math.ceil(cards.length / 4);
    function render() {
      cards.forEach((card, i) => { card.style.display = i >= (page - 1) * 4 && i < page * 4 ? 'flex' : 'none'; });
      pagination.replaceChildren();
      const button = (label, target, disabled = false) => {
        const node = document.createElement('button');
        node.type = 'button'; node.className = 'page-btn'; node.textContent = label;
        node.dataset.page = target; node.disabled = disabled;
        node.classList.toggle('disabled', disabled);
        if (label === String(page)) { node.classList.add('active'); node.setAttribute('aria-current', 'page'); }
        pagination.append(node);
      };
      button('上一页', page - 1, page === 1);
      for (let i = 1; i <= totalPages; i++) button(String(i), i);
      button('下一页', page + 1, page === totalPages);
      const tip = document.createElement('span'); tip.className = 'page-tip';
      tip.textContent = `共 ${cards.length} 份档案，${totalPages} 页`; pagination.append(tip);
    }
    scope.on(pagination, 'click', event => {
      const button = event.target.closest('button[data-page]');
      if (!button || button.disabled) return;
      page = Math.max(1, Math.min(totalPages, Number(button.dataset.page)));
      render(); $(root, '.center-column').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
    const modal = $(root, '#archiveModal'), close = $(root, '.modal-close');
    close.setAttribute('tabindex', '0'); close.setAttribute('role', 'button'); close.setAttribute('aria-label', '关闭档案详情');
    let returnFocus = null, previousOverflow = '';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', '档案详情');
    function closeModal() {
      modal.style.display = 'none'; document.body.style.overflow = previousOverflow;
      returnFocus?.focus({ preventScroll: true }); returnFocus = null;
    }
    scope.on(root, 'click', event => {
      const button = event.target.closest('.open-modal-btn');
      if (!button) return;
      event.preventDefault();
      const card = button.closest('.archive-card');
      $(root, '#modalImage').src = $(card, '.archive-modal-source img').src;
      $(root, '#modalDesc').innerHTML = $(card, '.archive-desc-source').innerHTML;
      returnFocus = button; previousOverflow = document.body.style.overflow;
      modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; close.focus();
    });
    scope.on(close, 'click', closeModal);
    scope.on(close, 'keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); closeModal(); } });
    scope.on(modal, 'click', event => { if (event.target === modal) closeModal(); });
    scope.on(document, 'keydown', event => {
      if (modal.style.display !== 'flex') return;
      if (event.key === 'Escape') closeModal();
      if (event.key === 'Tab') {
        const controls = $$(modal, 'button, a[href], input, [tabindex="0"]');
        const first = controls[0], last = controls[controls.length - 1];
        if (!controls.length) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    scope.cleanups.push(() => { if (modal.style.display === 'flex') document.body.style.overflow = previousOverflow; });
    render();
  }
  function news(scope) {
    const root = scope.root, filters = $$(root, '.filter-item'), items = $$(root, '.news-item');
    const buttons = $$(root, '.page-btn[data-page]');
    const prev = $(root, '.page-btn.prev'), next = $(root, '.page-btn.next');
    [...buttons, prev, next].forEach(button => {
      button.setAttribute('role', 'button'); button.setAttribute('tabindex', '0');
      scope.on(button, 'keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); button.click(); } });
    });
    let category = 'all', page = 1;
    function filtered() { return items.filter(item => category === 'all' || item.dataset.tag === category); }
    function render() {
      const list = filtered(), totalPages = Math.max(1, Math.ceil(list.length / 5));
      page = Math.max(1, Math.min(page, totalPages));
      // Hide every item before rendering the selected category (fix stale rows).
      items.forEach(item => { item.style.display = 'none'; });
      list.slice((page - 1) * 5, page * 5).forEach(item => { item.style.display = 'flex'; });
      buttons.forEach(button => {
        const n = Number(button.dataset.page);
        button.classList.toggle('active', n === page);
        button.style.display = n > totalPages ? 'none' : '';
        if (n === page) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      });
      [[prev, page <= 1], [next, page >= totalPages]].forEach(([button, disabled]) => {
        button.classList.toggle('disabled', disabled); button.setAttribute('aria-disabled', String(disabled));
      });
    }
    filters.forEach(filter => {
      filter.setAttribute('role', 'button'); filter.setAttribute('tabindex', '0');
      scope.on(filter, 'click', () => {
        category = filter.dataset.type; page = 1;
        filters.forEach(item => { item.classList.toggle('active', item === filter); item.setAttribute('aria-pressed', String(item === filter)); });
        render();
      });
      scope.on(filter, 'keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); filter.click(); } });
    });
    buttons.forEach(button => scope.on(button, 'click', event => { event.preventDefault(); page = Number(button.dataset.page); render(); }));
    scope.on(prev, 'click', event => { event.preventDefault(); if (page > 1) { page--; render(); } });
    scope.on(next, 'click', event => { event.preventDefault(); if (page < Math.ceil(filtered().length / 5)) { page++; render(); } });
    render();
  }
  function images(scope) {
    const root = scope.root, switches = $$(root, '.switch-btn');
    function activate(id) {
      switches.forEach(button => { button.classList.toggle('active', button.dataset.target === id); button.setAttribute('aria-pressed', String(button.dataset.target === id)); });
      $$(root, '.content-block').forEach(block => block.classList.toggle('active', block.id === id));
      $(root, '#sceneNav').classList.toggle('show', id === 'scene-block');
      $(root, '#teamNav').classList.toggle('show', id === 'team-block');
      $(root, '#navTitle').textContent = id === 'scene-block' ? '景区快速导航' : '合影分组导航';
    }
    switches.forEach(button => scope.on(button, 'click', () => {
      activate(button.dataset.target);
      $(root, '#' + button.dataset.target)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }));
    scope.on(window, 'joint-area:hash', event => {
      const target = document.getElementById(event.detail.id);
      const block = target?.closest('.content-block');
      if (block) activate(block.id);
    });
    activate('scene-block');
    $$(root, '.scene-image-card, .photo-card, .team-item').forEach(card => card.classList.add('show'));
  }

  function about(scope) {
    const root = scope.root;
    const page = $(root, '.gy-about');
    if (!page) return;
    const chapters = $$(page, '.gy-chapter');
    const chapterLinks = $$(page, '[data-gy-chapter]');
    const rail = $(page, '.gy-chapter-nav');
    const count = $(page, '[data-gy-current]');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const visibleLayers = new Set();
    let frame = 0, disposed = false, activeChapter = -1;

    function render() {
      frame = 0;
      if (disposed || !page.isConnected) return;
      const navHeight = document.getElementById('site-nav')?.offsetHeight || 44;
      const height = window.innerHeight;
      const pageRect = page.getBoundingClientRect();
      const distance = Math.max(1, pageRect.height - height + navHeight);
      const progress = Math.max(0, Math.min(1, (navHeight - pageRect.top) / distance));
      rail.style.setProperty('--gy-progress', progress.toFixed(4));
      const readingLine = navHeight + rail.offsetHeight + height * .32;
      let current = 0;
      chapters.forEach((chapter, index) => {
        if (chapter.getBoundingClientRect().top <= readingLine) current = index;
      });
      if (current !== activeChapter) {
        activeChapter = current;
        chapterLinks.forEach((link, index) => {
          link.classList.toggle('is-active', index === current);
          if (index === current) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
        count.textContent = String(current + 1).padStart(2, '0');
      }
      if (!motion.matches) visibleLayers.forEach(layer => {
        const bounds = layer.parentElement.getBoundingClientRect();
        // The 25px overscan above/below the images covers all movement.
        const offset = Math.max(-20, Math.min(20, (height / 2 - bounds.top - bounds.height / 2) * .055));
        layer.style.setProperty('--gy-parallax', `${offset.toFixed(2)}px`);
      });
    }
    function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(render); }
    if ('IntersectionObserver' in window) {
      const layers = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const layer = $(entry.target, '[data-gy-parallax]');
          if (!layer) return;
          if (entry.isIntersecting) visibleLayers.add(layer);
          else visibleLayers.delete(layer);
        });
        schedule();
      }, { rootMargin: '80px 0px' });
      $$(page, '[data-gy-parallax]').forEach(layer => layers.observe(layer.parentElement));
      scope.observers.push(layers);
    }
    scope.on(window, 'scroll', schedule, { passive: true });
    scope.on(window, 'resize', schedule, { passive: true });
    scope.on(motion, 'change', () => {
      if (motion.matches) {
        $$(page, '[data-gy-parallax]').forEach(layer => layer.style.removeProperty('--gy-parallax'));
      }
      schedule();
    });
    scope.on(window, 'joint-area:hash', event => {
      const target = document.getElementById(event.detail.id);
      if (!target || !page.contains(target)) return;
      // Do not start an anchor destination's animation before scrolling to it.
      // The shared scroll-position reveal starts it when the visitor sees it.
      schedule();
    });
    const poster = $(page, '[data-gy-play]');
    const film = $(page, '#gy-video-frame');
    scope.on(poster, 'click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      document.querySelector('#music-player audio')?.pause();
      film.src = film.dataset.src;
      poster.hidden = true;
      film.hidden = false;
      film.parentElement.classList.add('is-playing');
      film.focus({ preventScroll: true });
    });
    scope.cleanups.push(() => {
      disposed = true;
      cancelAnimationFrame(frame);
      visibleLayers.clear();
      // Explicitly unload the external player when navigating away.
      film.removeAttribute('src');
    });
    schedule();
  }
  function followSections(scope, links, sections, offset) {
    let frame = 0;
    function render() {
      frame = 0;
      if (!scope.root.isConnected) return;
      const readingLine = (document.getElementById('site-nav')?.offsetHeight || 44) + offset() + innerHeight * .18;
      let current = sections[0]?.id;
      sections.forEach(section => { if (section.getBoundingClientRect().top <= readingLine) current = section.id; });
      links.forEach(link => {
        const active = link.getAttribute('href') === '#' + current;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
    scope.on(window, 'scroll', schedule, { passive: true });
    scope.on(window, 'resize', schedule, { passive: true });
    scope.on(window, 'joint-area:hash', schedule);
    scope.cleanups.push(() => cancelAnimationFrame(frame));
    schedule();
  }
  function departments(scope) {
    const aside = $(scope.root, '.department-container .left-column');
    const button = $(scope.root, '[data-department-toggle]');
    if (!aside || !button) return;
    aside.classList.add('department-follow-ready');
    const setExpanded = expanded => {
      aside.dataset.expanded = String(expanded);
      button.setAttribute('aria-expanded', String(expanded));
      $(button, '.department-follow-indicator').textContent = expanded ? '−' : '＋';
    };
    setExpanded(false);
    scope.on(button, 'click', () => setExpanded(button.getAttribute('aria-expanded') !== 'true'));
    const links = $$(aside, '.side-nav-list a');
    links.forEach(link => scope.on(link, 'click', () => {
      if (matchMedia('(max-width: 768px)').matches) setExpanded(false);
    }));
    followSections(scope, links, $$(scope.root, '.department-overview, .department-section'),
      () => matchMedia('(max-width: 768px)').matches ? button.offsetHeight + 12 : 0);
  }
  function regions(scope) {
    const rail = $(scope.root, '.fq-section-nav');
    if (!rail) return;
    followSections(scope, $$(rail, 'a[href^="#"]'), $$(scope.root, '.fq-region, .fq-outpost'), () => rail.offsetHeight);
  }
  window.JointAreaFeatures = {
    mount(route, root) {
      const scope = new PageScope(root);
      anchors(scope);
      if (['zy', 'index', 'yx'].includes(route)) carousel(scope, route);
      if (route === 'da') archives(scope);
      if (route === 'xw') news(scope);
      if (route === 'yx') images(scope);
      if (route === 'gy') about(scope);
      if (route === 'bm') departments(scope);
      if (route === 'fq') regions(scope);
      const motionDispose = window.JointAreaMotion?.mount(route, root);
      if (motionDispose) scope.cleanups.push(motionDispose);
      return () => scope.dispose();
    }
  };
})();
