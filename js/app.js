'use strict';

/* =====================================================================
   App: Bildschirme (wie Folien), Arbeitsfläche, Werkzeugleiste,
   Hintergrund, Speichern.
   ===================================================================== */
(() => {
  const STORAGE_KEY = 'klassenbildschirm.v1';
  const ORDER = ['timer', 'stopwatch', 'clock', 'agenda', 'text', 'image', 'qr'];

  /* ---------- Zustand laden & speichern ---------- */
  const renumber = screen => screen.widgets
    .sort((a, b) => (a.z || 0) - (b.z || 0))
    .forEach((w, i) => { w.z = i + 1; });

  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* beschädigt → neu */ }
    if (!s || typeof s !== 'object') s = {};
    // Ältere Version: eine einzige Fläche → wird Bildschirm 1
    if (!Array.isArray(s.screens) || !s.screens.length) {
      s.screens = [{ id: uid(), name: 'Bildschirm 1', widgets: Array.isArray(s.widgets) ? s.widgets : [] }];
    }
    delete s.widgets;
    s.background ||= { kind: 'auto' };
    for (const screen of s.screens) {
      screen.widgets = (screen.widgets || []).filter(w => Widgets[w.type]);
      renumber(screen);
    }
    s.current = clamp(s.current | 0, 0, s.screens.length - 1);
    return s;
  }

  const state = loadState();
  let saveWarned = false;
  let saveSuppressed = false; // während eine Sicherung geladen wird

  function saveNow() {
    if (saveSuppressed) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      if (!saveWarned) { saveWarned = true; toast('Speichern fehlgeschlagen: Der Browser-Speicher ist voll.'); }
    }
  }
  const save = debounce(saveNow, 250);
  window.addEventListener('pagehide', saveNow);

  const currentScreen = () => state.screens[state.current];
  const maxZ = screen => screen.widgets.reduce((m, w) => Math.max(m, w.z || 0), 0);

  function findWidget(id) {
    for (const screen of state.screens) {
      const index = screen.widgets.findIndex(w => w.id === id);
      if (index >= 0) return { screen, index, w: screen.widgets[index] };
    }
    return null;
  }

  /** Bild aus dem Speicher löschen – aber nur, wenn es nirgends mehr benutzt wird. */
  function releaseImage(id) {
    if (!id) return;
    const used = state.background?.imageId === id ||
      state.screens.some(s => s.widgets.some(w => w.data?.imageId === id));
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

  function updateEmpty() { emptyHint.hidden = currentScreen().widgets.length > 0; }

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
    save();
  }

  /** Ebene ändern: 'front' = ganz nach vorne, 'back' = ganz nach hinten. */
  function setLayer(w, where) {
    const screen = findWidget(w.id)?.screen;
    if (!screen) return;
    w.z = where === 'back' ? -1 : maxZ(screen) + 1;
    renumber(screen);
    screen.widgets.forEach(x => { const e = live.get(x.id); if (e) e.node.style.zIndex = x.z; });
    save();
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
        if (moving) { node.classList.remove('is-moving'); save(); }
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
        node, body, tools, data: w.data, save, signal: ac.signal,
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
    save();
    return w;
  }

  function duplicateWidget(id) {
    const found = findWidget(id);
    if (!found) return;
    const copy = JSON.parse(JSON.stringify(found.w));
    Object.assign(copy, { id: uid(), x: found.w.x + 28, y: found.w.y + 28, z: maxZ(found.screen) + 1 });
    found.screen.widgets.push(copy);
    mount(copy, found.screen);
    save();
  }

  function unmount(id) {
    const entry = live.get(id);
    live.delete(id);
    if (!entry) return;
    try { entry.inst.destroy?.(); } catch (err) { console.error(err); }
    entry.ac.abort();
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
    save();
  }

  function clearAll() {
    const screen = currentScreen();
    if (!screen.widgets.length) return;
    if (!confirm(`Alle Werkzeuge von „${screen.name}“ entfernen?`)) return;
    [...screen.widgets].forEach(w => remove(w.id));
  }

  /* ---------- Bildschirme ---------- */
  const flash = el('div', { class: 'screen-flash', 'aria-live': 'polite' });
  document.body.append(flash);

  function showScreen(index, { announce = true } = {}) {
    state.current = clamp(index, 0, state.screens.length - 1);
    const active = currentScreen();
    for (const screen of state.screens) layerFor(screen).classList.toggle('is-active', screen === active);
    closePopover();
    if (document.activeElement && board.contains(document.activeElement)) document.activeElement.blur();
    updateEmpty();
    updateNav();
    renderScreensPanel();
    save();
    if (announce && state.screens.length > 1) {
      flash.textContent = `${state.current + 1} / ${state.screens.length} · ${active.name}`;
      flash.classList.remove('show');
      void flash.offsetWidth; // Animation neu starten
      flash.classList.add('show');
    }
  }
  const nextScreen = () => { if (state.current < state.screens.length - 1) showScreen(state.current + 1); };
  const prevScreen = () => { if (state.current > 0) showScreen(state.current - 1); };

  function addScreen() {
    const screen = { id: uid(), name: `Bildschirm ${state.screens.length + 1}`, widgets: [] };
    state.screens.splice(state.current + 1, 0, screen);
    layerFor(screen);
    showScreen(state.current + 1);
  }

  function duplicateScreen(i) {
    const copy = JSON.parse(JSON.stringify(state.screens[i]));
    copy.id = uid();
    copy.name = `${copy.name} (Kopie)`;
    copy.widgets.forEach(w => { w.id = uid(); });
    state.screens.splice(i + 1, 0, copy);
    copy.widgets.forEach(w => mount(w, copy));
    showScreen(i + 1);
  }

  function deleteScreen(i) {
    const screen = state.screens[i];
    if (state.screens.length === 1) { toast('Der letzte Bildschirm kann nicht gelöscht werden.'); return; }
    if (screen.widgets.length && !confirm(`„${screen.name}“ mit allen Werkzeugen löschen?`)) return;
    state.screens.splice(i, 1);
    screen.widgets.forEach(w => { unmount(w.id); releaseImage(w.data?.imageId); });
    layers.get(screen.id)?.remove();
    layers.delete(screen.id);
    // Davor gelegene Bildschirme rücken auf; der gelöschte wird durch seinen Nachfolger ersetzt
    const cur = state.current > i ? state.current - 1 : Math.min(state.current, state.screens.length - 1);
    showScreen(cur, { announce: false });
  }

  function moveScreen(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= state.screens.length) return;
    [state.screens[i], state.screens[j]] = [state.screens[j], state.screens[i]];
    const cur = state.current === i ? j : state.current === j ? i : state.current;
    showScreen(cur, { announce: false });
  }

  // Weiterblättern mit Pfeiltasten und Bild↑/Bild↓ (auch Präsentations-Presenter)
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"], .popover')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); nextScreen(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevScreen(); }
    else if (e.key === 'Home' && state.screens.length > 1) { e.preventDefault(); showScreen(0); }
    else if (e.key === 'End' && state.screens.length > 1) { e.preventDefault(); showScreen(state.screens.length - 1); }
  });

  window.addEventListener('resize', debounce(() => {
    for (const screen of state.screens) {
      for (const w of screen.widgets) { const e = live.get(w.id); if (e) place(w, e.node); }
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

    const color = el('input', { type: 'color', value: state.background?.color || '#4a6fa5', 'aria-label': 'Eigene Farbe' });
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
    dock.replaceChildren(nav, sep(), ...adders, shapesBtn, sep(), collabBtn, bgBtn, fsBtn, clearBtn);
    if (!document.fullscreenEnabled) fsBtn.hidden = true;
  }

  function updateNav() {
    if (!navLabel) return;
    navLabel.innerHTML = `<strong>${state.current + 1}</strong><span>/ ${state.screens.length}</span>`;
    navLabel.setAttribute('aria-label', `Bildschirm ${state.current + 1} von ${state.screens.length}: ${currentScreen().name}. Bildschirme verwalten`);
    navPrev.disabled = state.current === 0;
    navNext.disabled = state.current === state.screens.length - 1;
  }

  /* Übersicht der Bildschirme */
  function renderScreensPanel() {
    if (!screensPanel) return;
    const rows = state.screens.map((screen, i) => {
      const name = el('input', { class: 'sc-name', type: 'text', value: screen.name, 'aria-label': `Name von Bildschirm ${i + 1}` });
      name.addEventListener('input', () => { screen.name = name.value; save(); });
      name.addEventListener('change', () => { if (!name.value.trim()) { screen.name = `Bildschirm ${i + 1}`; name.value = screen.name; save(); } });
      name.addEventListener('keydown', e => { if (e.key === 'Enter') name.blur(); });
      const count = screen.widgets.length;
      const mini = (iconName, label, onclick, disabled, extra = '') => el('button', {
        class: `mini-btn ${extra}`, type: 'button', title: label, 'aria-label': `${label}: ${screen.name}`, html: icon(iconName), onclick, disabled,
      });
      const row = el('li', { class: 'sc-row' + (i === state.current ? ' is-current' : '') }, [
        el('button', { class: 'sc-num', type: 'button', text: String(i + 1), title: 'Anzeigen', 'aria-label': `Bildschirm ${i + 1} anzeigen`, onclick: () => showScreen(i) }),
        el('div', { class: 'sc-main' }, [name, el('small', { text: count === 1 ? '1 Werkzeug' : `${count} Werkzeuge` })]),
        mini('up', 'Nach vorne verschieben', () => moveScreen(i, -1), i === 0),
        mini('down', 'Nach hinten verschieben', () => moveScreen(i, 1), i === state.screens.length - 1),
        mini('copy', 'Duplizieren', () => duplicateScreen(i)),
        mini('trash', 'Löschen', () => deleteScreen(i), state.screens.length === 1, 'del'),
      ]);
      row.addEventListener('click', e => { if (!e.target.closest('button, input')) showScreen(i); });
      return row;
    });
    screensPanel.replaceChildren(
      el('h2', { text: 'Bildschirme' }),
      el('p', { class: 'sc-hint', text: 'Wie Folien einer Präsentation: Blättern mit ◀ ▶, den Pfeiltasten oder Bild↑/Bild↓ (auch mit einem Presenter).' }),
      el('ol', { class: 'sc-list' }, rows),
      el('div', { class: 'sc-foot' }, [
        el('button', { class: 'btn btn-primary sc-add', type: 'button', html: icon('plus') + '<span>Neuer Bildschirm</span>', onclick: addScreen }),
        el('div', { class: 'sc-file' }, [
          el('button', { class: 'btn', type: 'button', title: 'Alle Bildschirme als Datei speichern', html: icon('download') + '<span>Sichern</span>', onclick: doExport }),
          el('button', { class: 'btn', type: 'button', title: 'Gesicherte Datei laden', html: icon('upload') + '<span>Laden</span>', onclick: doImport }),
        ]),
      ]),
      el('p', { class: 'sc-tip', text: 'Tipp: Am Schul-PC vor dem Abmelden sichern – manche Schulrechner löschen den Browser-Speicher. Mit der Datei nimmst du deine Stunden auch nach Hause mit.' }),
    );
  }

  /* ---------- Sichern & Laden ---------- */
  async function doExport() {
    try {
      saveNow();
      const r = await exportBackup(state);
      toast(`Gesichert: ${r.name}`);
    } catch (err) {
      console.error(err);
      toast('Sichern hat nicht geklappt.');
    }
  }

  async function doImport() {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    let data;
    try { data = await readBackup(file); } catch (err) { toast(err.message); return; }
    const n = data.state.screens.length;
    const when = data.exportedAt ? `, gesichert am ${new Date(data.exportedAt).toLocaleDateString('de-DE')}` : '';
    togglePanel(panels.find(p => p.panel === screensPanel), true);
    screensPanel.replaceChildren(
      el('h2', { text: 'Sicherung laden' }),
      el('p', { class: 'sc-hint', text: `„${file.name}“ enthält ${n === 1 ? '1 Bildschirm' : `${n} Bildschirme`}${when}.` }),
      el('div', { class: 'sc-choice' }, [
        el('button', { class: 'btn btn-primary sc-add', type: 'button', html: icon('plus') + '<span>Zu meinen Bildschirmen hinzufügen</span>', onclick: () => finishImport(data, 'add') }),
        el('button', {
          class: 'btn', type: 'button', html: icon('reset') + '<span>Alles ersetzen</span>',
          onclick: () => { if (confirm('Alle aktuellen Bildschirme werden durch die Sicherung ersetzt. Fortfahren?')) finishImport(data, 'replace'); },
        }),
        el('button', { class: 'btn', type: 'button', text: 'Abbrechen', onclick: renderScreensPanel }),
      ]),
    );
  }

  async function finishImport(data, mode) {
    let next;
    try { next = await stateFromBackup(data, state, mode); } catch (err) {
      console.error(err);
      toast('Die Sicherung konnte nicht geladen werden.');
      return;
    }
    const newImages = next._newImages || [];
    delete next._newImages;
    saveSuppressed = true; // der alte Stand darf den neuen nicht mehr überschreiben
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      saveSuppressed = false;
      newImages.forEach(id => ImageDB.del(id).catch(() => {}));
      toast('Nicht genug Speicherplatz im Browser für diese Sicherung.');
      return;
    }
    if (mode === 'replace') { // nicht mehr benötigte Bilder aufräumen
      const keep = backupImageIds(next);
      const all = await ImageDB.keys().catch(() => []);
      await Promise.all(all.filter(id => !keep.has(id)).map(id => ImageDB.del(id).catch(() => {})));
    }
    location.reload();
  }

  document.addEventListener('pointerdown', e => {
    if (e.target.closest?.('.popover')) return;
    for (const p of panels) {
      if (!p.panel.hidden && !p.panel.contains(e.target) && !p.btn.contains(e.target)) togglePanel(p, false);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });

  /* ---------- Vollbild: Leiste blendet sich bei Ruhe aus ---------- */
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => toast('Vollbild ist hier nicht möglich.'));
  }

  let idleTimer;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    if (document.fullscreenElement && panels.every(p => p.panel.hidden)) {
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
    if (e.target.closest?.('[contenteditable], input, textarea')) return;
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const w = add('image');
    live.get(w.id)?.inst.useFile?.(item.getAsFile());
  });

  // Ton freischalten, sobald jemand mit der Seite interagiert (Browser-Regel)
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

  /* ---------- Start ---------- */
  buildDock();
  buildPanel();
  buildCollabPanel(collabPanel, { state, save, addWidget: add, close: closePanels });
  buildShapesPanel(shapesPanel, { addWidget: add, close: closePanels });
  applyBackground();
  for (const screen of state.screens) screen.widgets.forEach(w => mount(w, screen));
  showScreen(state.current, { announce: false });
})();
