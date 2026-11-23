'use strict';

/* =====================================================================
   App: Startseite „Meine Stunden“, Bildschirme (wie Folien),
   Arbeitsfläche, Werkzeugleiste, Hintergrund, Speichern.

   Datenmodell:
   state = { lessons: [ { id, name, screens: [ { id, name, widgets } ],
                          current, created, updated } ],
             lastLesson, background, effects, collabLinks }
   ===================================================================== */
(() => {
  const STORAGE_KEY = 'klassenbildschirm.v1';
  const ORDER = ['timer', 'stopwatch', 'clock', 'agenda', 'text', 'image', 'qr'];

  /* ---------- Zustand laden ---------- */
  const renumber = screen => screen.widgets
    .sort((a, b) => (a.z || 0) - (b.z || 0))
    .forEach((w, i) => { w.z = i + 1; });

  const makeScreen = n => ({ id: uid(), name: `Bildschirm ${n}`, widgets: [] });
  const makeLesson = name => ({ id: uid(), name, screens: [makeScreen(1)], current: 0, created: Date.now(), updated: Date.now() });

  function normalizeLesson(l, i) {
    const lesson = {
      id: String(l?.id || uid()),
      name: String(l?.name || `Stunde ${i + 1}`),
      screens: Array.isArray(l?.screens) && l.screens.length ? l.screens : [makeScreen(1)],
      current: l?.current | 0,
      created: Number(l?.created) || Date.now(),
      updated: Number(l?.updated) || Date.now(),
    };
    lesson.screens.forEach((screen, n) => {
      screen.id ||= uid();
      screen.name ||= `Bildschirm ${n + 1}`;
      screen.widgets = (Array.isArray(screen.widgets) ? screen.widgets : []).filter(w => w && Widgets[w.type]);
      renumber(screen);
    });
    lesson.current = clamp(lesson.current, 0, lesson.screens.length - 1);
    return lesson;
  }

  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* beschädigt → neu */ }
    if (!s || typeof s !== 'object') s = {};
    if (!Array.isArray(s.lessons)) {
      // Ältere Versionen: eine Fläche (widgets) bzw. eine Folge von Bildschirmen (screens)
      const screens = Array.isArray(s.screens) ? s.screens
        : Array.isArray(s.widgets) && s.widgets.length ? [{ id: uid(), name: 'Bildschirm 1', widgets: s.widgets }]
        : null;
      s.lessons = screens ? [{ id: uid(), name: 'Meine erste Stunde', screens, current: s.current | 0 }] : [];
    }
    delete s.screens; delete s.widgets; delete s.current;
    s.lessons = s.lessons.map(normalizeLesson);
    s.background ||= { kind: 'auto' };
    if (!s.lessons.some(l => l.id === s.lastLesson)) s.lastLesson = s.lessons[0]?.id || null;
    return s;
  }

  const state = loadState();
  let lesson = null; // geöffnete Stunde (null = Startseite)

  /* ---------- Speichern (mit sichtbarer Bestätigung) ---------- */
  const saveBadge = el('div', { class: 'save-badge', role: 'status', 'aria-live': 'polite' });
  document.body.append(saveBadge);
  let saveFailed = false, badgeTimer;

  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (saveFailed) { saveFailed = false; saveBadge.classList.remove('is-error'); }
      saveBadge.innerHTML = icon('check') + '<span>Gespeichert</span>';
      saveBadge.classList.add('show');
      clearTimeout(badgeTimer);
      badgeTimer = setTimeout(() => saveBadge.classList.remove('show'), 1400);
    } catch {
      saveFailed = true;
      clearTimeout(badgeTimer);
      saveBadge.innerHTML = '<span>⚠ Nicht gespeichert – Browser-Speicher voll. Bitte Bilder entfernen und eine Sicherung erstellen.</span>';
      saveBadge.classList.add('show', 'is-error');
    }
  }
  const save = debounce(saveNow, 300);
  /** Änderung an der geöffneten Stunde (merkt sich „zuletzt bearbeitet“). */
  const changed = () => { if (lesson) lesson.updated = Date.now(); save(); };
  window.addEventListener('pagehide', saveNow);

  /** Den Browser bitten, die Daten nie von selbst aufzuräumen. */
  let persisted = null;
  async function requestPersist() {
    try {
      if (!navigator.storage?.persist) return;
      persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    } catch { /* nicht unterstützt */ }
    renderStorageNote();
  }
  navigator.storage?.persisted?.().then(p => { persisted = p; renderStorageNote(); }).catch(() => {});

  /* ---------- Hilfen rund um die geöffnete Stunde ---------- */
  const currentScreen = () => lesson.screens[lesson.current];
  const maxZ = screen => screen.widgets.reduce((m, w) => Math.max(m, w.z || 0), 0);
  const allWidgets = () => state.lessons.flatMap(l => l.screens.flatMap(s => s.widgets));

  function findWidget(id) {
    if (!lesson) return null;
    for (const screen of lesson.screens) {
      const index = screen.widgets.findIndex(w => w.id === id);
      if (index >= 0) return { screen, index, w: screen.widgets[index] };
    }
    return null;
  }

  /** Bild aus dem Speicher löschen – aber nur, wenn es nirgends mehr benutzt wird. */
  function releaseImage(id) {
    if (!id) return;
    const used = state.background?.imageId === id || allWidgets().some(w => w.data?.imageId === id);
    if (!used) ImageDB.del(id).catch(() => {});
  }

  /* ---------- Arbeitsfläche ---------- */
  const board = $('#board');
  const emptyHint = $('#empty-hint');
  const live = new Map();   // Werkzeug-ID → { node, inst, ac }
  const layers = new Map(); // Bildschirm-ID → Ebene im DOM

  function layerFor(screen) {
    let layer = layers.get(screen.id);
    if (!layer) {
      layer = el('div', { class: 'screen', 'data-id': screen.id });
      board.append(layer);
      layers.set(screen.id, layer);
    }
    return layer;
  }

  function updateEmpty() { emptyHint.hidden = !lesson || currentScreen().widgets.length > 0; }

  /** Position & Größe, angepasst an den sichtbaren Bereich (Kopfzeile bleibt greifbar).
      Ändert die gespeicherten Werte NICHT – ein kleines oder (beim Start) noch
      unsichtbares Fenster darf das gespeicherte Layout nicht zerstören. */
  function fitted(w) {
    const def = Widgets[w.type];
    const vw = Math.max(window.innerWidth, 480), vh = Math.max(window.innerHeight, 320);
    const ww = Math.round(clamp(w.w, def.min.w, Math.max(def.min.w, vw - 16)));
    const hh = Math.round(clamp(w.h, def.min.h, Math.max(def.min.h, vh - 16)));
    return {
      w: ww, h: hh,
      x: Math.round(clamp(w.x, 80 - ww, vw - 80)),
      y: Math.round(clamp(w.y, 0, vh - 44)),
    };
  }

  function place(w, node) {
    const g = fitted(w);
    node.style.left = g.x + 'px';
    node.style.top = g.y + 'px';
    node.style.width = g.w + 'px';
    node.style.height = g.h + 'px';
    node.style.zIndex = w.z;
  }

  /** Nur bei eigenen Aktionen (Ziehen, Größe ändern): Werte wirklich übernehmen. */
  const keepInView = w => Object.assign(w, fitted(w));

  function bringToFront(w, node) {
    const screen = findWidget(w.id)?.screen;
    if (!screen || w.z === maxZ(screen)) return;
    w.z = maxZ(screen) + 1;
    node.style.zIndex = w.z;
    changed();
  }

  /** Ebene ändern: 'front' = ganz nach vorne, 'back' = ganz nach hinten. */
  function setLayer(w, where) {
    const screen = findWidget(w.id)?.screen;
    if (!screen) return;
    w.z = where === 'back' ? -1 : maxZ(screen) + 1;
    renumber(screen);
    screen.widgets.forEach(x => { const e = live.get(x.id); if (e) e.node.style.zIndex = x.z; });
    changed();
  }

  /** Ziehen per Maus, Stift oder Finger. Beginnt erst ab 3 px Bewegung,
      damit Klicks und Doppelklicks (z. B. Text bearbeiten) normal ankommen. */
  function makeDraggable(handle, w, node, apply) {
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button, input, a, .w-menu, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, start = { ...w, ...fitted(w) };
      let moving = false;
      const move = ev => {
        if (ev.pointerId !== e.pointerId) return;
        if (!moving) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
          moving = true;
          node.classList.add('is-moving');
        }
        apply(start, ev.clientX - sx, ev.clientY - sy);
        keepInView(w);
        place(w, node);
      };
      const end = ev => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        if (moving) { node.classList.remove('is-moving'); changed(); }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    });
  }

  function mount(w, screen) {
    const def = Widgets[w.type];
    w.data = { ...def.data(), ...(w.data || {}) };
    const ac = new AbortController();

    const tools = el('div', { class: 'w-tools' });
    const head = el('header', { class: 'w-head' }, [
      el('span', { class: 'w-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'w-title', text: def.name }),
      tools,
      def.duplicable ? el('button', {
        class: 'w-btn', title: 'Duplizieren', 'aria-label': `${def.name} duplizieren`,
        html: icon('copy'), onclick: () => duplicateWidget(w.id),
      }) : null,
      el('button', {
        class: 'w-btn w-close', title: 'Entfernen', 'aria-label': `${def.name} entfernen`,
        html: icon('x'), onclick: () => remove(w.id),
      }),
    ]);
    const body = el('div', { class: 'w-body' });
    const grip = el('div', { class: 'w-grip', title: 'Größe ändern', 'aria-hidden': 'true' });
    const node = el('section', { class: `widget w-${w.type}${def.frameless ? ' is-frameless' : ''}`, 'aria-label': def.name }, [head, body, grip]);
    node.style.setProperty('--accent', def.accent);
    // Formen bleiben auf ihrer Ebene (sonst ließen sie sich nicht nach hinten legen)
    if (!def.frameless) node.addEventListener('pointerdown', () => bringToFront(w, node), true);

    place(w, node);
    layerFor(screen).append(node);

    makeDraggable(head, w, node, (s, dx, dy) => { w.x = s.x + dx; w.y = s.y + dy; });
    if (def.dragBody) makeDraggable(body, w, node, (s, dx, dy) => { w.x = s.x + dx; w.y = s.y + dy; });
    makeDraggable(grip, w, node, (s, dx, dy) => { w.w = s.w + dx; w.h = s.h + dy; });

    let inst = {};
    try {
      inst = def.mount({
        node, body, tools, data: w.data, save: changed, signal: ac.signal,
        releaseImage: id => releaseImage(id),
        layer: where => setLayer(w, where),
      }) || {};
    } catch (err) {
      console.error(err);
      body.append(el('p', { class: 'w-note', text: 'Dieses Werkzeug konnte nicht geladen werden.' }));
    }
    live.set(w.id, { node, inst, ac });
    return w;
  }

  /** Neues Werkzeug auf dem aktuellen Bildschirm. size = { w, h } (optional). */
  function add(type, initialData, size) {
    if (!lesson) return null;
    const def = Widgets[type];
    const screen = currentScreen();
    const n = screen.widgets.length % 6;
    const ww = size?.w || def.size.w, hh = size?.h || def.size.h;
    const w = {
      id: uid(), type, w: ww, h: hh, z: maxZ(screen) + 1, data: { ...def.data(), ...initialData },
      x: Math.round((window.innerWidth - ww) / 2 + n * 30 - 75),
      y: Math.round((window.innerHeight - hh) / 2 + n * 30 - 110),
    };
    screen.widgets.push(w);
    mount(w, screen);
    updateEmpty();
    changed();
    return w;
  }

  function duplicateWidget(id) {
    const found = findWidget(id);
    if (!found) return;
    const copy = JSON.parse(JSON.stringify(found.w));
    Object.assign(copy, { id: uid(), x: found.w.x + 28, y: found.w.y + 28, z: maxZ(found.screen) + 1 });
    found.screen.widgets.push(copy);
    mount(copy, found.screen);
    changed();
  }

  function unmount(id, animate = true) {
    const entry = live.get(id);
    live.delete(id);
    if (!entry) return;
    try { entry.inst.destroy?.(); } catch (err) { console.error(err); }
    entry.ac.abort();
    if (!animate) { entry.node.remove(); return; }
    entry.node.classList.add('is-leaving');
    setTimeout(() => entry.node.remove(), 160);
  }

  function remove(id) {
    const found = findWidget(id);
    if (!found) return;
    found.screen.widgets.splice(found.index, 1);
    unmount(id);
    Widgets[found.w.type].onRemove?.(found.w.data);
    releaseImage(found.w.data?.imageId);
    updateEmpty();
    changed();
  }

  function clearAll() {
    const screen = currentScreen();
    if (!screen.widgets.length) return;
    if (!confirm(`Alle Werkzeuge von „${screen.name}“ entfernen?`)) return;
    [...screen.widgets].forEach(w => remove(w.id));
  }

  /* ---------- Stunden öffnen & schließen ---------- */
  const flash = el('div', { class: 'screen-flash', 'aria-live': 'polite' });
  document.body.append(flash);
  function showFlash(text) {
    flash.textContent = text;
    flash.classList.remove('show');
    void flash.offsetWidth; // Animation neu starten
    flash.classList.add('show');
  }

  function openLesson(id) {
    const next = state.lessons.find(l => l.id === id);
    if (!next) return;
    closeLesson();
    lesson = next;
    state.lastLesson = lesson.id;
    for (const screen of lesson.screens) screen.widgets.forEach(w => mount(w, screen));
    home.hidden = true;
    document.body.classList.remove('at-home');
    showScreen(lesson.current, { announce: false });
    showFlash(lesson.screens.length > 1 ? `${lesson.name} · ${lesson.current + 1} / ${lesson.screens.length}` : lesson.name);
    requestPersist();
    saveNow();
  }

  function closeLesson() {
    if (!lesson) return;
    for (const screen of lesson.screens) screen.widgets.forEach(w => unmount(w.id, false));
    layers.forEach(layer => layer.remove());
    layers.clear();
    lesson = null;
  }

  function showHome() {
    closePanels();
    closePopover();
    saveNow();
    closeLesson();
    renderHome();
    home.hidden = false;
    document.body.classList.add('at-home');
    updateEmpty();
    home.querySelector('.lesson-open, .lesson-new')?.focus({ preventScroll: true });
  }

  /* ---------- Bildschirme der geöffneten Stunde ---------- */
  function showScreen(index, { announce = true } = {}) {
    lesson.current = clamp(index, 0, lesson.screens.length - 1);
    const active = currentScreen();
    for (const screen of lesson.screens) layerFor(screen).classList.toggle('is-active', screen === active);
    closePopover();
    if (document.activeElement && board.contains(document.activeElement)) document.activeElement.blur();
    updateEmpty();
    updateNav();
    renderScreensPanel();
    save();
    if (announce && lesson.screens.length > 1) showFlash(`${lesson.current + 1} / ${lesson.screens.length} · ${active.name}`);
  }
  const nextScreen = () => { if (lesson && lesson.current < lesson.screens.length - 1) showScreen(lesson.current + 1); };
  const prevScreen = () => { if (lesson && lesson.current > 0) showScreen(lesson.current - 1); };

  function addScreen() {
    const screen = makeScreen(lesson.screens.length + 1);
    lesson.screens.splice(lesson.current + 1, 0, screen);
    layerFor(screen);
    changed();
    showScreen(lesson.current + 1);
  }

  function duplicateScreen(i) {
    const copy = JSON.parse(JSON.stringify(lesson.screens[i]));
    copy.id = uid();
    copy.name = `${copy.name} (Kopie)`;
    copy.widgets.forEach(w => { w.id = uid(); });
    lesson.screens.splice(i + 1, 0, copy);
    copy.widgets.forEach(w => mount(w, copy));
    changed();
    showScreen(i + 1);
  }

  function deleteScreen(i) {
    const screen = lesson.screens[i];
    if (lesson.screens.length === 1) { toast('Der letzte Bildschirm einer Stunde kann nicht gelöscht werden.'); return; }
    if (screen.widgets.length && !confirm(`„${screen.name}“ mit allen Werkzeugen löschen?`)) return;
    lesson.screens.splice(i, 1);
    screen.widgets.forEach(w => { unmount(w.id); releaseImage(w.data?.imageId); });
    layers.get(screen.id)?.remove();
    layers.delete(screen.id);
    changed();
    // Davor gelegene Bildschirme rücken auf; der gelöschte wird durch seinen Nachfolger ersetzt
    const cur = lesson.current > i ? lesson.current - 1 : Math.min(lesson.current, lesson.screens.length - 1);
    showScreen(cur, { announce: false });
  }

  function moveScreen(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= lesson.screens.length) return;
    [lesson.screens[i], lesson.screens[j]] = [lesson.screens[j], lesson.screens[i]];
    const cur = lesson.current === i ? j : lesson.current === j ? i : lesson.current;
    changed();
    showScreen(cur, { announce: false });
  }

  // Weiterblättern mit Pfeiltasten und Bild↑/Bild↓ (auch Präsentations-Presenter)
  document.addEventListener('keydown', e => {
    if (!lesson || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"], .popover')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); nextScreen(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevScreen(); }
    else if (e.key === 'Home' && lesson.screens.length > 1) { e.preventDefault(); showScreen(0); }
    else if (e.key === 'End' && lesson.screens.length > 1) { e.preventDefault(); showScreen(lesson.screens.length - 1); }
  });

  window.addEventListener('resize', debounce(() => {
    if (lesson) {
      for (const screen of lesson.screens) {
        for (const w of screen.widgets) { const e = live.get(w.id); if (e) place(w, e.node); }
      }
    }
    applyBackground(); // Hintergrundbild in passender Auflösung neu berechnen
  }, 150));

  /* ---------- Hintergrund ---------- */
  const panel = $('#bg-panel');
  let bgObjectUrl = null;

  function isLight(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
  }

  const fxLayer = el('div', { class: 'fx', 'aria-hidden': 'true' });
  board.prepend(fxLayer);
  let autoSeason = null;
  let bgToken = 0;

  async function applyBackground() {
    const token = ++bgToken;
    const bg = state.background || { kind: 'auto' };
    let css = null, light = false, fx = null;
    if (bg.kind === 'color') {
      css = safeColor(bg.color, '#4a6fa5'); light = isLight(css);
    } else if (bg.kind === 'image') {
      const blob = await ImageDB.get(bg.imageId).catch(() => null);
      if (blob) {
        if (bgObjectUrl) URL.revokeObjectURL(bgObjectUrl);
        bgObjectUrl = URL.createObjectURL(blob);
        css = `center / cover no-repeat url("${bgObjectUrl}"), #222`;
      }
    }
    autoSeason = currentSeason();
    if (!css) { // Automatisch, Vorlage – oder Rückfall, falls das eigene Bild fehlt
      const p = (bg.kind === 'preset' && bgPreset(bg.id)) || bgPreset(autoSeason);
      light = !!p.light; fx = p.fx || null;
      if (!board.style.background) board.style.background = presetFallback(p);
      const dpr = window.devicePixelRatio || 1;
      const k = Math.min(1, 2560 / (Math.max(window.innerWidth, window.innerHeight) * dpr));
      css = await presetCss(p, Math.round(window.innerWidth * dpr * k), Math.round(window.innerHeight * dpr * k));
    }
    if (token !== bgToken) return; // inzwischen wurde schon etwas anderes gewählt
    if (bg.kind !== 'image' && bgObjectUrl) { URL.revokeObjectURL(bgObjectUrl); bgObjectUrl = null; }
    board.style.background = css;
    document.body.dataset.tone = light ? 'light' : 'dark';
    renderEffects(fxLayer, state.effects ? fx : null);
    updatePanelSelection();
  }

  /** Kleines Hintergrundbild für die Vorschaukarten der Startseite. */
  async function backgroundThumb() {
    const bg = state.background || { kind: 'auto' };
    if (bg.kind === 'color') return safeColor(bg.color, '#4a6fa5');
    if (bg.kind === 'image' && bgObjectUrl) return `center / cover no-repeat url("${bgObjectUrl}"), #222`;
    const p = (bg.kind === 'preset' && bgPreset(bg.id)) || bgPreset(currentSeason());
    return presetCss(p, 320, 180, true);
  }

  function updatePanelSelection() {
    const bg = state.background || { kind: 'auto' };
    panel.querySelectorAll('.bg-tile').forEach(t => {
      t.setAttribute('aria-pressed', String(bg.kind === 'preset' && t.dataset.id === bg.id));
    });
    const auto = panel.querySelector('.bg-auto');
    if (auto) {
      const season = bgPreset(autoSeason || currentSeason());
      auto.setAttribute('aria-pressed', String(bg.kind === 'auto'));
      auto.querySelector('.bg-auto-now').textContent = `Gerade: ${season.name}`;
      const thumb = auto.querySelector('.bg-thumb');
      if (thumb.dataset.id !== season.id) {
        thumb.dataset.id = season.id;
        thumb.style.background = presetFallback(season);
        presetCss(season, 320, 200, true).then(css => { if (thumb.dataset.id === season.id) thumb.style.background = css; });
      }
    }
  }

  // Läuft der Bildschirm tagelang, wechselt die Automatik trotzdem pünktlich.
  setInterval(() => {
    if ((state.background?.kind || 'auto') === 'auto' && currentSeason() !== autoSeason) applyBackground();
  }, 30 * 60 * 1000);

  function setBackground(bg) {
    const old = state.background;
    state.background = bg;
    if (old?.kind === 'image' && old.imageId !== bg.imageId) releaseImage(old.imageId);
    save();
    applyBackground();
  }

  function buildPanel() {
    const tile = p => {
      const thumb = el('span', { class: 'bg-thumb', 'aria-hidden': 'true' });
      thumb.style.background = presetFallback(p);
      presetCss(p, 320, 200, true).then(css => { thumb.style.background = css; });
      return el('button', {
        class: 'bg-tile', type: 'button', 'data-id': p.id, 'aria-label': `Hintergrund ${p.name}`,
        onclick: () => setBackground({ kind: 'preset', id: p.id }),
      }, [thumb, el('span', { class: 'bg-name', text: p.name })]);
    };
    const section = (title, group) => el('section', { class: 'bg-section' }, [
      el('h3', { text: title }),
      el('div', { class: 'bg-grid' }, BG_PRESETS.filter(p => p.group === group).map(tile)),
    ]);

    const auto = el('button', { class: 'bg-auto', type: 'button', onclick: () => setBackground({ kind: 'auto' }) }, [
      el('span', { class: 'bg-thumb', 'aria-hidden': 'true' }),
      el('span', { class: 'bg-auto-text' }, [
        el('strong', { text: 'Automatisch nach Jahreszeit' }),
        el('span', { text: 'Frühling, Ostern, Sommer, Herbst, Advent & Weihnachten, Winter – wechselt von selbst.' }),
        el('span', { class: 'bg-auto-now' }),
      ]),
    ]);

    const fxBox = el('input', { type: 'checkbox' });
    fxBox.checked = !!state.effects;
    fxBox.addEventListener('change', () => { state.effects = fxBox.checked; save(); applyBackground(); });

    const color = el('input', { type: 'color', value: safeColor(state.background?.color, '#4a6fa5'), 'aria-label': 'Eigene Farbe' });
    color.addEventListener('input', () => setBackground({ kind: 'color', color: color.value }));
    const upload = el('button', {
      class: 'btn', html: icon('upload') + '<span>Eigenes Bild</span>',
      onclick: async () => {
        const file = await pickFile('image/*');
        if (!file) return;
        try {
          const id = await ImageDB.put(await shrinkImage(file, 2560));
          setBackground({ kind: 'image', imageId: id });
        } catch (err) {
          console.error(err);
          toast('Das Bild konnte nicht gespeichert werden.');
        }
      },
    });
    panel.replaceChildren(
      el('h2', { text: 'Hintergrund' }),
      auto,
      section('Jahreszeiten & Feste', 'season'),
      section('Schule', 'school'),
      section('Farben', 'color'),
      el('div', { class: 'panel-row' }, [
        el('label', { class: 'color-pick' }, [color, el('span', { text: 'Eigene Farbe' })]),
        upload,
        el('label', { class: 'fx-toggle' }, [fxBox, el('span', { text: 'Bewegte Effekte (Schnee, Blätter, Blüten)' })]),
      ]),
    );
    updatePanelSelection();
  }

  /* ---------- Werkzeugleiste & Menüs ---------- */
  const dock = $('#dock');
  const collabPanel = $('#collab-panel');
  const screensPanel = $('#screens-panel');
  const shapesPanel = $('#shapes-panel');
  const panels = []; // { panel, btn }
  let fsBtn, navPrev, navNext, navLabel;

  function dockButton(label, iconName, onclick, accent) {
    const b = el('button', { class: 'dock-btn', html: icon(iconName) + `<span>${label}</span>`, onclick });
    if (accent) b.style.setProperty('--accent', accent);
    return b;
  }

  /** Öffnet ein Menü (und schließt alle anderen); ohne force: umschalten. */
  function togglePanel(entry, force) {
    const open = force ?? entry.panel.hidden;
    for (const p of panels) {
      const show = p === entry && open;
      p.panel.hidden = !show;
      p.btn.setAttribute('aria-expanded', String(show));
    }
  }
  const closePanels = () => panels.forEach(p => { p.panel.hidden = true; p.btn.setAttribute('aria-expanded', 'false'); });

  function registerPanel(btn, panelEl) {
    const entry = { panel: panelEl, btn };
    btn.addEventListener('click', () => togglePanel(entry));
    btn.setAttribute('aria-expanded', 'false');
    panels.push(entry);
    return btn;
  }
  const panelButton = (label, iconName, panelEl, accent) => registerPanel(dockButton(label, iconName, null, accent), panelEl);

  function buildDock() {
    const homeBtn = dockButton('Übersicht', 'home', showHome);
    homeBtn.title = 'Zur Startseite „Meine Stunden“';
    navPrev = el('button', { class: 'nav-btn', title: 'Vorheriger Bildschirm (←, Bild↑)', 'aria-label': 'Vorheriger Bildschirm', html: icon('left'), onclick: prevScreen });
    navNext = el('button', { class: 'nav-btn', title: 'Nächster Bildschirm (→, Bild↓)', 'aria-label': 'Nächster Bildschirm', html: icon('right'), onclick: nextScreen });
    navLabel = registerPanel(el('button', { class: 'nav-label', title: 'Bildschirme verwalten' }), screensPanel);
    const nav = el('div', { class: 'dock-nav' }, [navPrev, navLabel, navNext]);

    const adders = ORDER.filter(t => Widgets[t]).map(t => {
      const d = Widgets[t];
      const b = dockButton(d.name, d.icon, () => add(t), d.accent);
      b.title = `${d.name} hinzufügen`;
      return b;
    });
    const shapesBtn = panelButton('Formen', 'shapes', shapesPanel, '#e85d75');
    shapesBtn.title = 'Formen, Kästen & Symbole einfügen';
    const collabBtn = panelButton('Gemeinsam', 'users', collabPanel, '#5b5bd6');
    collabBtn.title = 'Zusammenarbeit: Pinnwände, Dokumente, Umfragen …';
    const bgBtn = panelButton('Hintergrund', 'palette', panel);
    fsBtn = dockButton('Vollbild', 'expand', toggleFullscreen);
    const clearBtn = dockButton('Leeren', 'trash', clearAll);
    clearBtn.title = 'Alle Werkzeuge von diesem Bildschirm entfernen';
    const sep = () => el('span', { class: 'dock-sep', 'aria-hidden': 'true' });
    dock.replaceChildren(homeBtn, nav, sep(), ...adders, shapesBtn, sep(), collabBtn, bgBtn, fsBtn, clearBtn);
    if (!document.fullscreenEnabled) fsBtn.hidden = true;
  }

  function updateNav() {
    if (!navLabel || !lesson) return;
    navLabel.innerHTML = `<strong>${lesson.current + 1}</strong><span>/ ${lesson.screens.length}</span>`;
    navLabel.setAttribute('aria-label', `Bildschirm ${lesson.current + 1} von ${lesson.screens.length}: ${currentScreen().name}. Bildschirme verwalten`);
    navPrev.disabled = lesson.current === 0;
    navNext.disabled = lesson.current === lesson.screens.length - 1;
  }

  /* Übersicht der Bildschirme der geöffneten Stunde */
  function renderScreensPanel() {
    if (!screensPanel || !lesson) return;
    const rows = lesson.screens.map((screen, i) => {
      const name = el('input', { class: 'sc-name', type: 'text', value: screen.name, 'aria-label': `Name von Bildschirm ${i + 1}` });
      name.addEventListener('input', () => { screen.name = name.value; changed(); });
      name.addEventListener('change', () => { if (!name.value.trim()) { screen.name = `Bildschirm ${i + 1}`; name.value = screen.name; changed(); } });
      name.addEventListener('keydown', e => { if (e.key === 'Enter') name.blur(); });
      const count = screen.widgets.length;
      const mini = (iconName, label, onclick, disabled, extra = '') => el('button', {
        class: `mini-btn ${extra}`, type: 'button', title: label, 'aria-label': `${label}: ${screen.name}`, html: icon(iconName), onclick, disabled,
      });
      const row = el('li', { class: 'sc-row' + (i === lesson.current ? ' is-current' : '') }, [
        el('button', { class: 'sc-num', type: 'button', text: String(i + 1), title: 'Anzeigen', 'aria-label': `Bildschirm ${i + 1} anzeigen`, onclick: () => showScreen(i) }),
        el('div', { class: 'sc-main' }, [name, el('small', { text: count === 1 ? '1 Werkzeug' : `${count} Werkzeuge` })]),
        mini('up', 'Nach vorne verschieben', () => moveScreen(i, -1), i === 0),
        mini('down', 'Nach hinten verschieben', () => moveScreen(i, 1), i === lesson.screens.length - 1),
        mini('copy', 'Duplizieren', () => duplicateScreen(i)),
        mini('trash', 'Löschen', () => deleteScreen(i), lesson.screens.length === 1, 'del'),
      ]);
      row.addEventListener('click', e => { if (!e.target.closest('button, input')) showScreen(i); });
      return row;
    });
    screensPanel.replaceChildren(
      el('h2', { text: `Bildschirme · ${lesson.name}` }),
      el('p', { class: 'sc-hint', text: 'Wie Folien einer Präsentation: Blättern mit ◀ ▶, den Pfeiltasten oder Bild↑/Bild↓ (auch mit einem Presenter).' }),
      el('ol', { class: 'sc-list' }, rows),
      el('div', { class: 'sc-foot' }, [
        el('button', { class: 'btn btn-primary sc-add', type: 'button', html: icon('plus') + '<span>Neuer Bildschirm</span>', onclick: addScreen }),
        el('button', { class: 'btn', type: 'button', html: icon('home') + '<span>Alle Stunden</span>', onclick: showHome }),
      ]),
    );
  }

  document.addEventListener('pointerdown', e => {
    if (e.target.closest?.('.popover')) return;
    for (const p of panels) {
      if (!p.panel.hidden && !p.panel.contains(e.target) && !p.btn.contains(e.target)) togglePanel(p, false);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });

  /* ---------- Startseite „Meine Stunden“ ---------- */
  const home = $('#home');
  let thumbBg = null;

  function relTime(ts) {
    const diff = Date.now() - ts;
    const d = new Date(ts), today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toDateString() === d.toDateString();
    const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (diff < 60e3) return 'gerade eben';
    if (diff < 3600e3 && sameDay) return `vor ${Math.round(diff / 60e3)} Min.`;
    if (sameDay) return `heute, ${time}`;
    if (yesterday) return `gestern, ${time}`;
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  }

  /** Schematische Vorschau des aktuellen Bildschirms einer Stunde. */
  function lessonThumb(l) {
    const box = el('div', { class: 'lesson-thumb', 'aria-hidden': 'true' });
    if (thumbBg) box.style.background = thumbBg;
    const screen = l.screens[l.current] || l.screens[0];
    const vw = Math.max(window.innerWidth, 480), vh = Math.max(window.innerHeight, 320);
    const pct = v => `${(clamp(v, -1, 2) * 100).toFixed(2)}%`;
    for (const w of [...screen.widgets].sort((a, b) => a.z - b.z)) {
      const def = Widgets[w.type];
      const g = fitted(w);
      const r = el('span', { class: `lt-w lt-${w.type}` });
      r.style.cssText = `left:${pct(g.x / vw)};top:${pct(g.y / vh)};width:${pct(g.w / vw)};height:${pct(g.h / vh)};--accent:${def.accent}`;
      if (w.type === 'shape') {
        const d = w.data || {};
        r.classList.add('is-shape', `lt-kind-${d.kind}`);
        if (d.kind === 'emoji') { r.textContent = d.symbol || '⭐'; r.style.fontSize = `${((g.h / vh) * 70).toFixed(1)}cqh`; }
        else if (d.kind === 'callout') r.style.setProperty('--c', safeColor(d.fill, (CALLOUTS[d.callout] || CALLOUTS.merke).color));
        else r.style.background = safeColor(d.fill, 'transparent');
      } else {
        r.innerHTML = icon(def.icon);
      }
      box.append(r);
    }
    return box;
  }

  function renderHome() {
    const lessons = [...state.lessons].sort((a, b) => b.updated - a.updated);
    const hour = new Date().getHours();
    const greeting = hour < 11 ? 'Guten Morgen' : hour < 17 ? 'Hallo' : 'Guten Abend';

    const newCard = el('article', { class: 'lesson-card lesson-new-card' });
    const showNewButton = () => newCard.replaceChildren(el('button', {
      class: 'lesson-new', type: 'button', html: `<span class="lesson-new-icon">${icon('plus')}</span><strong>Neue Stunde</strong><small>leer beginnen</small>`,
      onclick: showNewForm,
    }));
    function showNewForm() {
      const input = el('input', { class: 'field', type: 'text', placeholder: 'z. B. Mathe 7b – Brüche', 'aria-label': 'Name der neuen Stunde', maxlength: '80' });
      const form = el('form', { class: 'lesson-new-form' }, [
        el('label', { text: 'Wie heißt die Stunde?' }), input,
        el('div', { class: 'lesson-new-actions' }, [
          el('button', { class: 'btn btn-primary', type: 'submit', html: icon('check') + '<span>Anlegen</span>' }),
          el('button', { class: 'btn', type: 'button', text: 'Abbrechen', onclick: showNewButton }),
        ]),
      ]);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const l = makeLesson(input.value.trim() || `Stunde ${state.lessons.length + 1}`);
        state.lessons.push(l);
        saveNow();
        openLesson(l.id);
      });
      input.addEventListener('keydown', e => { if (e.key === 'Escape') showNewButton(); });
      newCard.replaceChildren(form);
      input.focus();
    }
    showNewButton();

    home.replaceChildren(el('div', { class: 'home-inner' }, [
      el('header', { class: 'home-head' }, [
        el('div', {}, [
          el('h1', { text: 'Meine Stunden' }),
          el('p', { text: lessons.length ? `${greeting}! Wähle eine Stunde oder lege eine neue an.` : `${greeting}! Lege deine erste Stunde an – zum Beispiel für morgen früh.` }),
        ]),
        el('div', { class: 'home-actions' }, [
          el('button', { class: 'btn', type: 'button', title: 'Gesicherte Datei laden', html: icon('upload') + '<span>Laden</span>', onclick: doImport }),
          el('button', { class: 'btn', type: 'button', title: 'Alle Stunden als Datei sichern', html: icon('download') + '<span>Alles sichern</span>', onclick: () => doExport() }),
        ]),
      ]),
      el('div', { class: 'home-grid' }, [newCard, ...lessons.map((l, i) => lessonCard(l, i === 0 && l.id === state.lastLesson))]),
      el('footer', { class: 'home-foot' }, [el('p', { class: 'storage-note' })]),
    ]));
    renderStorageNote();

    // Vorschaubilder bekommen den aktuellen Hintergrund, sobald er berechnet ist
    backgroundThumb().then(css => {
      thumbBg = css;
      home.querySelectorAll('.lesson-thumb').forEach(t => { t.style.background = css; });
    }).catch(() => {});
  }

  function lessonCard(l, isLast) {
    const count = l.screens.length;
    const widgets = l.screens.reduce((n, s) => n + s.widgets.length, 0);
    const name = el('h3', { class: 'lesson-name', text: l.name });
    const menuBtn = el('button', { class: 'mini-btn lesson-menu-btn', type: 'button', title: 'Weitere Aktionen', 'aria-label': `Weitere Aktionen für ${l.name}`, html: icon('dots') });
    const card = el('article', { class: 'lesson-card' }, [
      el('button', { class: 'lesson-open', type: 'button', 'aria-label': `${l.name} öffnen`, onclick: () => openLesson(l.id) }, [
        lessonThumb(l),
        isLast ? el('span', { class: 'lesson-badge', text: 'Zuletzt geöffnet' }) : null,
      ]),
      el('div', { class: 'lesson-info' }, [
        el('div', { class: 'lesson-text' }, [
          name,
          el('p', { class: 'lesson-meta', text: `${count === 1 ? '1 Bildschirm' : `${count} Bildschirme`} · ${widgets} ${widgets === 1 ? 'Element' : 'Elemente'} · ${relTime(l.updated)}` }),
        ]),
        menuBtn,
      ]),
    ]);

    const action = (iconName, label, fn, extra = '') => el('button', {
      class: `lesson-action ${extra}`, type: 'button', html: icon(iconName) + `<span>${label}</span>`,
      onclick: () => { closePopover(); fn(); },
    });
    menuBtn.addEventListener('click', () => openPopover(menuBtn, el('div', { class: 'lesson-menu' }, [
      action('right', 'Öffnen', () => openLesson(l.id)),
      action('pencil', 'Umbenennen', () => renameLesson(l, card)),
      action('copy', 'Duplizieren', () => duplicateLesson(l)),
      action('download', 'Als Datei sichern', () => doExport(l)),
      action('trash', 'Löschen', () => deleteLesson(l), 'del'),
    ]), { className: 'lesson-pop', label: `Aktionen für ${l.name}` }));
    return card;
  }

  function renameLesson(l, card) {
    const nameEl = card.querySelector('.lesson-name');
    const input = el('input', { class: 'field lesson-rename', type: 'text', value: l.name, 'aria-label': 'Neuer Name', maxlength: '80' });
    const commit = () => {
      l.name = input.value.trim() || l.name;
      l.updated = Date.now();
      saveNow();
      renderHome();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') renderHome(); });
    input.addEventListener('blur', commit);
    nameEl.replaceWith(input);
    input.focus();
    input.select();
  }

  function duplicateLesson(l) {
    const copy = JSON.parse(JSON.stringify(l));
    copy.id = uid();
    copy.name = `${l.name} (Kopie)`;
    copy.created = copy.updated = Date.now();
    copy.screens.forEach(s => { s.id = uid(); s.widgets.forEach(w => { w.id = uid(); }); });
    state.lessons.push(copy);
    saveNow();
    renderHome();
    toast(`„${copy.name}“ angelegt.`);
  }

  function deleteLesson(l) {
    const widgets = l.screens.reduce((n, s) => n + s.widgets.length, 0);
    if (!confirm(`„${l.name}“ löschen?${widgets ? ` Alle ${widgets} Elemente darin gehen verloren.` : ''}\n\nTipp: Vorher „Als Datei sichern“, dann lässt sie sich wiederherstellen.`)) return;
    state.lessons = state.lessons.filter(x => x !== l);
    l.screens.forEach(s => s.widgets.forEach(w => releaseImage(w.data?.imageId)));
    if (state.lastLesson === l.id) state.lastLesson = state.lessons[0]?.id || null;
    saveNow();
    renderHome();
  }

  function renderStorageNote() {
    const note = home?.querySelector('.storage-note');
    if (!note) return;
    note.className = 'storage-note' + (persisted ? ' is-safe' : '');
    note.innerHTML = persisted
      ? `${icon('check')}<span><strong>Dauerhaft gespeichert</strong> in diesem Browser. Für einen anderen Rechner (z. B. Schule ↔ Zuhause) „Alles sichern“ und dort „Laden“.</span>`
      : `${icon('check')}<span><strong>Automatisch gespeichert</strong> in diesem Browser. Am Schul-PC vor dem Abmelden „Alles sichern“ – manche Schulrechner löschen den Browser-Speicher.</span>`;
  }

  /* ---------- Sichern & Laden ---------- */
  async function doExport(only) {
    try {
      saveNow();
      const r = await exportBackup(state, only ? { lessons: [only], label: only.name } : {});
      toast(`Gesichert: ${r.name}`);
    } catch (err) {
      console.error(err);
      toast('Sichern hat nicht geklappt.');
    }
  }

  function showDialog(title, text, buttons) {
    const backdrop = el('div', { class: 'dialog-backdrop' });
    const close = () => backdrop.remove();
    backdrop.append(el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      el('h2', { text: title }),
      el('p', { text }),
      el('div', { class: 'dialog-actions' }, buttons.map(b => el('button', {
        class: `btn ${b.primary ? 'btn-primary' : ''}`, type: 'button', html: (b.icon ? icon(b.icon) : '') + `<span>${b.label}</span>`,
        onclick: () => { close(); b.onclick?.(); },
      }))),
    ]));
    backdrop.addEventListener('pointerdown', e => { if (e.target === backdrop) close(); });
    backdrop.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.body.append(backdrop);
    backdrop.querySelector('.btn')?.focus();
  }

  async function doImport() {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    let data;
    try { data = await readBackup(file); } catch (err) { toast(err.message); return; }
    const n = data.state.lessons.length;
    const screens = data.state.lessons.reduce((s, l) => s + (l.screens?.length || 0), 0);
    const when = data.exportedAt ? ` Gesichert am ${new Date(data.exportedAt).toLocaleDateString('de-DE')}.` : '';
    showDialog('Sicherung laden',
      `„${file.name}“ enthält ${n === 1 ? '1 Stunde' : `${n} Stunden`} mit ${screens === 1 ? '1 Bildschirm' : `${screens} Bildschirmen`}.${when}`,
      [
        { label: 'Zu meinen Stunden hinzufügen', icon: 'plus', primary: true, onclick: () => finishImport(data, 'add') },
        {
          label: 'Alles ersetzen', icon: 'reset',
          onclick: () => { if (confirm('Alle aktuellen Stunden werden durch die Sicherung ersetzt. Fortfahren?')) finishImport(data, 'replace'); },
        },
        { label: 'Abbrechen' },
      ]);
  }

  async function finishImport(data, mode) {
    let result;
    try { result = await stateFromBackup(data, state, mode); } catch (err) {
      console.error(err);
      toast('Die Sicherung konnte nicht geladen werden.');
      return;
    }
    const before = JSON.stringify(state);
    Object.assign(state, result.state);
    state.lessons = state.lessons.map(normalizeLesson);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      Object.assign(state, JSON.parse(before));
      result.newImages.forEach(id => ImageDB.del(id).catch(() => {}));
      toast('Nicht genug Speicherplatz im Browser für diese Sicherung.');
      return;
    }
    if (mode === 'replace') { // nicht mehr benötigte Bilder aufräumen
      const keep = backupImageIds(state);
      const all = await ImageDB.keys().catch(() => []);
      await Promise.all(all.filter(id => !keep.has(id)).map(id => ImageDB.del(id).catch(() => {})));
      buildPanel();
      buildCollabPanel(collabPanel, { state, save, addWidget: add, close: closePanels });
      applyBackground();
    }
    renderHome();
    toast(mode === 'add' ? `${result.added === 1 ? '1 Stunde' : `${result.added} Stunden`} hinzugefügt.` : 'Sicherung geladen.');
  }

  /* ---------- Vollbild: Leiste blendet sich bei Ruhe aus ---------- */
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => toast('Vollbild ist hier nicht möglich.'));
  }

  let idleTimer;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    if (document.fullscreenElement && lesson && panels.every(p => p.panel.hidden)) {
      idleTimer = setTimeout(() => document.body.classList.add('idle'), 3000);
    }
  }
  ['pointermove', 'pointerdown'].forEach(ev => window.addEventListener(ev, wake, { passive: true }));
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    fsBtn.innerHTML = icon(on ? 'shrink' : 'expand') + `<span>${on ? 'Beenden' : 'Vollbild'}</span>`;
    wake();
  });

  /* ---------- Bild aus der Zwischenablage einfügen (Strg+V) ---------- */
  document.addEventListener('paste', e => {
    if (!lesson || e.target.closest?.('[contenteditable], input, textarea')) return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const w = add('image');
    live.get(w.id)?.inst.useFile?.(item.getAsFile());
  });

  // Ton freischalten, sobald jemand mit der Seite interagiert (Browser-Regel)
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

  /* ---------- Start: immer mit der Startseite ---------- */
  buildDock();
  buildPanel();
  buildCollabPanel(collabPanel, { state, save, addWidget: add, close: closePanels });
  buildShapesPanel(shapesPanel, { addWidget: add, close: closePanels });
  applyBackground();
  showHome();
})();
