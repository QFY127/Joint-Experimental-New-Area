(() => {
  'use strict';
  const player = document.querySelector('#music-player');
  if (!player) return;
  const audio = player.querySelector('audio');
  const body = player.querySelector('#music-body');
  const title = player.querySelector('.music-title');
  const artist = player.querySelector('.music-artist');
  const count = player.querySelector('.music-track-count');
  const headerSubtitle = player.querySelector('.music-header-subtitle');
  const toggle = player.querySelector('.music-toggle');
  const dragHandle = player.querySelector('.music-drag');
  const heading = player.querySelector('.music-heading');
  const dock = player.querySelector('.music-dock');
  const volumeToggle = player.querySelector('.music-volume-toggle');
  const playButtons = [...player.querySelectorAll('[data-music-play]')];
  const previous = player.querySelector('.music-prev');
  const next = player.querySelector('.music-next');
  const seek = player.querySelector('.music-seek');
  const currentTime = player.querySelector('.music-current-time');
  const duration = player.querySelector('.music-duration');
  const volume = player.querySelector('.music-volume');
  const volumeValue = player.querySelector('.music-volume-value');
  const mute = player.querySelector('.music-mute');
  const status = player.querySelector('.music-status');
  const list = player.querySelector('.music-playlist');
  const listToggle = player.querySelector('.music-list-toggle');
  const playlist = (Array.isArray(window.MUSIC_PLAYLIST) ? window.MUSIC_PLAYLIST : [])
    .filter(track => track && typeof track.src === 'string' && track.src.trim());
  const icons = {
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M9 5v14M15 5v14" stroke-width="4"/>',
    volume: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15 8a6 6 0 010 8M18 5a10 10 0 010 14"/>',
    muted: '<path d="M11 5L6 9H3v6h3l5 4zM16 9l5 6m0-6l-5 6"/>'
  };
  let index = 0, expanded = true, generation = 0, busy = false, requestPending = false;
  let desiredPlaying = false, seeking = false, lastVolume = .65;
  let side = 'right';
  let verticalPosition = .5, dragState = null, positionFrame = 0;
  let lastRecordHue = null;
  const clamp = value => Math.min(1, Math.max(0, Number(value)));
  const timeText = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00';
  function notify(message, error = false) { status.textContent = message; status.dataset.error = String(error); }
  function saveVolume(value) { try { localStorage.setItem('joint-area-music-volume', String(value)); } catch {} }
  function syncPlay() {
    const playing = !audio.paused && !audio.ended;
    player.classList.toggle('is-playing', playing);
    playButtons.forEach(button => {
      button.querySelector('svg').innerHTML = playing ? icons.pause : icons.play;
      button.setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
      button.setAttribute('aria-pressed', String(playing));
    });
  }
  function syncTime() {
    currentTime.textContent = timeText(audio.currentTime);
    duration.textContent = timeText(audio.duration);
    seek.disabled = !Number.isFinite(audio.duration) || audio.duration <= 0;
    if (!seeking) seek.value = seek.disabled ? 0 : audio.currentTime / audio.duration * 1000;
    seek.setAttribute('aria-valuetext', `${timeText(audio.currentTime)} / ${timeText(audio.duration)}`);
  }
  function applyVolume() {
    const value = clamp(volume.value);
    volumeValue.textContent = `${Math.round(value * 100)}%`;
    mute.setAttribute('aria-label', value === 0 ? '取消静音' : '静音');
    mute.setAttribute('aria-pressed', String(value === 0));
    mute.querySelector('svg').innerHTML = value === 0 ? icons.muted : icons.volume;
    // 保持浏览器原生音频输出。本地 file:// 或未授权的跨域音频接入
    // MediaElementAudioSourceNode 后可能只输出静音，即使播放进度仍在走。
    audio.volume = value;
    audio.muted = value === 0;
    if (!audio.paused && !audio.ended) notifyPlaying();
  }
  function notifyPlaying() {
    notify(audio.muted ? '正在播放 · 已静音，请取消静音或调高音量' : '正在播放 · 随心听一会儿');
  }
  async function startPlayback() {
    if (!playlist.length) return;
    desiredPlaying = true;
    requestPending = true;
    const token = generation;
    notify('正在加载音乐…');
    try {
      await audio.play();
      if (token !== generation) return;
      requestPending = false;
      if (!desiredPlaying) { audio.pause(); return; }
      notifyPlaying();
    } catch (error) {
      if (token !== generation) return;
      requestPending = false;
      if (error.name === 'AbortError') return;
      desiredPlaying = false;
      notify(error.name === 'NotAllowedError' ? '请再次点击播放按钮。' : '播放失败，请检查音乐文件或换一首。', true);
      syncPlay();
    }
  }
  function randomizeRecordColors() {
    // 每次载入曲目自动配色，并让相邻两次的色相至少相差 70 度。
    const hue = lastRecordHue === null ? Math.floor(Math.random() * 360) : (lastRecordHue + 70 + Math.floor(Math.random() * 221)) % 360;
    const secondaryHue = (hue + 45 + Math.floor(Math.random() * 70)) % 360;
    lastRecordHue = hue;
    player.style.setProperty('--record-color', `hsl(${hue}, 70%, 68%)`);
    player.style.setProperty('--record-secondary', `hsl(${secondaryHue}, 66%, 72%)`);
  }
  function loadTrack(nextIndex, shouldPlay = false) {
    generation += 1; busy = false; requestPending = false;
    audio.pause(); desiredPlaying = shouldPlay;
    index = (nextIndex + playlist.length) % playlist.length;
    const track = playlist[index];
    title.textContent = track.title || '未命名歌曲';
    artist.textContent = track.artist || '联合实验新区音乐角';
    headerSubtitle.textContent = expanded ? '让世界慢下来' : title.textContent;
    count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(playlist.length).padStart(2, '0')}`;
    randomizeRecordColors();
    [...list.querySelectorAll('button')].forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
    audio.src = track.src;
    audio.load(); syncTime(); syncPlay();
    notify('点击播放，开启音乐');
    if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: title.textContent, artist: artist.textContent, album: '联合实验新区' }); } catch {}
    }
    if (shouldPlay) startPlayback();
  }
  function togglePlay() {
    if (!playlist.length) return;
    if (desiredPlaying || !audio.paused) {
      desiredPlaying = false; requestPending = false; audio.pause(); notify('已暂停 · 点击继续'); syncPlay();
    } else startPlayback();
  }
  function switchTrack(direction) { if (playlist.length) loadTrack(index + direction, desiredPlaying || !audio.paused); }
  function setExpanded(value) {
    expanded = value; body.hidden = !value;
    player.classList.toggle('is-collapsed', !value);
    toggle.setAttribute('aria-expanded', String(value));
    toggle.setAttribute('aria-label', value ? '收起音乐播放器' : '展开音乐播放器');
    player.querySelector('.music-mini-play').hidden = value;
    headerSubtitle.textContent = value ? '让世界慢下来' : title.textContent;
    if (!value) {
      list.hidden = true;
      listToggle.setAttribute('aria-expanded', 'false');
      setVolumeOpen(false);
    }
    syncDock();
    positionPlayer();
  }
  // 只改变纵向中心点，横向位置始终由 data-side 的贴边样式控制。
  function viewportBounds() {
    const viewport = window.visualViewport;
    const style = getComputedStyle(player);
    return {
      top: viewport?.offsetTop || 0,
      height: viewport?.height || window.innerHeight,
      topInset: 10 + (parseFloat(style.getPropertyValue('--music-safe-top')) || 0),
      bottomInset: 10 + (parseFloat(style.getPropertyValue('--music-safe-bottom')) || 0)
    };
  }
  function positionPlayer(requestedCenter) {
    const viewport = viewportBounds();
    const availableHeight = Math.max(1, viewport.height - viewport.topInset - viewport.bottomInset);
    const naturalHeight = player.querySelector('.music-header').offsetHeight + (body.hidden ? 0 : body.offsetHeight);
    player.style.setProperty('--music-available-height', `${availableHeight}px`);
    player.classList.toggle('is-height-constrained', naturalHeight > availableHeight);
    const height = player.getBoundingClientRect().height;
    const minimum = viewport.top + viewport.topInset + height / 2;
    const maximum = Math.max(minimum, viewport.top + viewport.height - viewport.bottomInset - height / 2);
    const target = requestedCenter ?? viewport.top + viewport.height * verticalPosition;
    const center = Math.min(maximum, Math.max(minimum, target));
    player.style.top = `${center}px`;
    const above = center - height / 2 - viewport.top - viewport.topInset;
    const below = viewport.top + viewport.height - viewport.bottomInset - center - height / 2;
    const opensBelow = above < 180 && below > above;
    player.classList.toggle('popovers-below', opensBelow);
    player.style.setProperty('--music-popup-height', `${Math.max(0, Math.min(180, (opensBelow ? below : above) - 8))}px`);
    return center;
  }
  function rememberVerticalPosition(center) {
    const viewport = viewportBounds();
    verticalPosition = Math.min(1, Math.max(0, (center - viewport.top) / viewport.height));
  }
  function saveVerticalPosition() { try { localStorage.setItem('joint-area-music-position-y', String(verticalPosition)); } catch {} }
  function beginVerticalDrag(event) {
    if (!event.isPrimary || event.button !== 0 || dragState) return;
    event.preventDefault();
    setVolumeOpen(false); list.hidden = true; listToggle.setAttribute('aria-expanded', 'false');
    const box = player.getBoundingClientRect();
    dragState = { pointerId: event.pointerId, startY: event.clientY, center: box.top + box.height / 2, target: event.currentTarget, moved: false };
    dragState.target.setPointerCapture(event.pointerId);
    player.classList.add('is-dragging');
  }
  function moveVerticalDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const delta = event.clientY - dragState.startY;
    if (Math.abs(delta) > 2) dragState.moved = true;
    rememberVerticalPosition(positionPlayer(dragState.center + delta));
  }
  function endVerticalDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const state = dragState; dragState = null;
    player.classList.remove('is-dragging');
    if (state.target.hasPointerCapture(state.pointerId)) state.target.releasePointerCapture(state.pointerId);
    if (state.moved) saveVerticalPosition();
  }
  [dragHandle, heading].forEach(handle => {
    handle.addEventListener('pointerdown', beginVerticalDrag);
    handle.addEventListener('pointermove', moveVerticalDrag);
    handle.addEventListener('pointerup', endVerticalDrag);
    handle.addEventListener('pointercancel', endVerticalDrag);
    handle.addEventListener('lostpointercapture', endVerticalDrag);
  });
  dragHandle.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const viewport = viewportBounds(), box = player.getBoundingClientRect();
    const step = event.shiftKey ? 50 : 20;
    const target = event.key === 'Home' ? viewport.top : event.key === 'End' ? viewport.top + viewport.height : box.top + box.height / 2 + (event.key === 'ArrowUp' ? -step : step);
    rememberVerticalPosition(positionPlayer(target)); saveVerticalPosition();
  });
  function schedulePosition() {
    if (positionFrame) return;
    positionFrame = requestAnimationFrame(() => { positionFrame = 0; positionPlayer(); });
  }
  window.addEventListener('resize', schedulePosition);
  window.visualViewport?.addEventListener('resize', schedulePosition);
  window.visualViewport?.addEventListener('scroll', schedulePosition);
  if ('ResizeObserver' in window) new ResizeObserver(schedulePosition).observe(player);
  function syncDock() {
    player.dataset.side = side;
    const pointsRight = (side === 'right') === expanded;
    toggle.querySelector('svg').innerHTML = pointsRight ? '<path d="M9 6l6 6-6 6"/>' : '<path d="M15 6l-6 6 6 6"/>';
    dock.setAttribute('aria-label', side === 'right' ? '移动播放器到屏幕左侧' : '移动播放器到屏幕右侧');
    dock.title = side === 'right' ? '移动到左侧' : '移动到右侧';
    dock.querySelector('svg').innerHTML = side === 'right' ? '<path d="M4 4v16M19 12H8m5-5l-5 5 5 5"/>' : '<path d="M20 4v16M5 12h11m-5-5l5 5-5 5"/>';
  }
  function setVolumeOpen(value) {
    player.classList.toggle('volume-open', value);
    volumeToggle.setAttribute('aria-expanded', String(value));
    if (value) { list.hidden = true; listToggle.setAttribute('aria-expanded', 'false'); }
  }
  playButtons.forEach(button => button.addEventListener('click', togglePlay));
  previous.addEventListener('click', () => switchTrack(-1));
  next.addEventListener('click', () => switchTrack(1));
  toggle.addEventListener('click', () => setExpanded(!expanded));
  dock.addEventListener('click', () => { side = side === 'right' ? 'left' : 'right'; syncDock(); try { localStorage.setItem('joint-area-music-side', side); } catch {} });
  volumeToggle.addEventListener('click', () => setVolumeOpen(!player.classList.contains('volume-open')));
  listToggle.addEventListener('click', () => { list.hidden = !list.hidden; listToggle.setAttribute('aria-expanded', String(!list.hidden)); if (!list.hidden) setVolumeOpen(false); });
  document.addEventListener('pointerdown', event => { if (!player.contains(event.target)) { setVolumeOpen(false); list.hidden = true; listToggle.setAttribute('aria-expanded', 'false'); } });
  player.addEventListener('keydown', event => { if (event.key === 'Escape') { setVolumeOpen(false); list.hidden = true; listToggle.setAttribute('aria-expanded', 'false'); toggle.focus(); } });
  volume.addEventListener('input', () => { applyVolume(); if (Number(volume.value) > 0) lastVolume = Number(volume.value); saveVolume(volume.value); });
  mute.addEventListener('click', () => { if (Number(volume.value) > 0) { lastVolume = Number(volume.value); volume.value = 0; } else volume.value = lastVolume || .65; applyVolume(); saveVolume(volume.value); });
  seek.addEventListener('input', () => {
    seeking = true;
    if (!Number.isFinite(audio.duration)) return;
    const target = Number(seek.value) / 1000 * audio.duration;
    currentTime.textContent = timeText(target);
    seek.setAttribute('aria-valuetext', `${timeText(target)} / ${timeText(audio.duration)}`);
  });
  seek.addEventListener('change', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value) / 1000 * audio.duration; seeking = false; syncTime(); });
  audio.addEventListener('timeupdate', syncTime);
  audio.addEventListener('loadedmetadata', syncTime);
  audio.addEventListener('durationchange', syncTime);
  audio.addEventListener('play', () => { desiredPlaying = true; syncPlay(); });
  audio.addEventListener('playing', () => { busy = false; notifyPlaying(); syncPlay(); });
  audio.addEventListener('pause', () => { if (!requestPending && !busy && !audio.ended) { desiredPlaying = false; notify('已暂停 · 点击继续'); } syncPlay(); });
  audio.addEventListener('waiting', () => { busy = true; if (desiredPlaying) notify('正在缓冲音乐…'); });
  audio.addEventListener('ended', () => loadTrack(index + 1, true));
  audio.addEventListener('error', () => { desiredPlaying = false; requestPending = false; busy = false; notify('音乐文件无法读取，请换一首或检查文件路径。', true); syncPlay(); });
  playlist.forEach((track, i) => {
    const item = document.createElement('li'), button = document.createElement('button');
    button.type = 'button'; button.className = 'music-track';
    const number = document.createElement('span'), name = document.createElement('span');
    number.className = 'music-track-number'; number.textContent = String(i + 1).padStart(2, '0');
    name.className = 'music-track-name'; name.textContent = track.title || '未命名歌曲';
    button.append(number, name); button.addEventListener('click', () => loadTrack(i, true)); item.append(button); list.append(item);
  });
  try { const value = localStorage.getItem('joint-area-music-volume'); if (value !== null && Number.isFinite(Number(value))) volume.value = clamp(value); } catch {}
  try { if (localStorage.getItem('joint-area-music-side') === 'left') side = 'left'; } catch {}
  try { const value = localStorage.getItem('joint-area-music-position-y'); if (value !== null && Number.isFinite(Number(value))) verticalPosition = clamp(value); } catch {}
  if (Number(volume.value) > 0) lastVolume = Number(volume.value);
  applyVolume(); setExpanded(true);
  if (playlist.length) loadTrack(0);
  else {
    title.textContent = '暂无音乐'; artist.textContent = '歌单更新后即可播放'; count.textContent = '00 / 00';
    [...playButtons, previous, next, listToggle, seek].forEach(control => { control.disabled = true; });
    notify('暂时没有可播放的歌曲。');
  }
  if ('mediaSession' in navigator) {
    const handlers = { play: startPlayback, pause: () => { desiredPlaying = false; audio.pause(); }, previoustrack: () => switchTrack(-1), nexttrack: () => switchTrack(1), seekto: details => { if (Number.isFinite(audio.duration) && Number.isFinite(details.seekTime)) audio.currentTime = Math.min(audio.duration, Math.max(0, details.seekTime)); } };
    Object.entries(handlers).forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler); } catch {} });
  }
})();
