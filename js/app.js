'use strict';

/* =====================================================================
   App: Arbeitsfläche, Werkzeugleiste, Hintergrund, Speichern.
   ===================================================================== */
(() => {
  const STORAGE_KEY = 'klassenbildschirm.v1';
  const ORDER = ['timer', 'stopwatch', 'clock', 'agenda', 'text', 'image', 'qr'];

  /* ---------- Zustand laden & speichern ---------- */
  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* beschädigt → neu */ }
    if (!s || !Array.isArray(s.widgets)) s = { background: { kind: 'auto' }, widgets: [] };
    s.widgets = s.widgets.filter(w => Widgets[w.type]);
    // Stapelreihenfolge neu durchnummerieren, damit z-Werte klein bleiben
    s.widgets.sort((a, b) => (a.z || 0) - (b.z || 0)).forEach((w, i) => { w.z = i + 1; });
    return s;
  }

  const state = loadState();
  let topZ = state.widgets.length;
  let saveWarned = false;

  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      if (!saveWarned) { saveWarned = true; toast('Speichern fehlgeschlagen: Der Browser-Speicher ist voll.'); }
    }
  }
  const save = debounce(saveNow, 250);
  window.addEventListener('pagehide', saveNow);

  /* ---------- Arbeitsfläche ---------- */
  const board = $('#board');
  const emptyHint = $('#empty-hint');
  const live = new Map(); // id → { node, inst, ac }

  function updateEmpty() { emptyHint.hidden = state.widgets.length > 0; }

  function place(w, node) {
    node.style.left = w.x + 'px';
    node.style.top = w.y + 'px';
    node.style.width = w.w + 'px';
    node.style.height = w.h + 'px';
    node.style.zIndex = w.z;
  }

  /** Werkzeug im sichtbaren Bereich halten (Kopfzeile muss greifbar bleiben). */
  function keepInView(w) {
    const def = Widgets[w.type];
    const vw = window.innerWidth, vh = window.innerHeight;
    w.w = Math.round(clamp(w.w, def.min.w, Math.max(def.min.w, vw - 16)));
    w.h = Math.round(clamp(w.h, def.min.h, Math.max(def.min.h, vh - 16)));
    w.x = Math.round(clamp(w.x, 80 - w.w, vw - 80));
    w.y = Math.round(clamp(w.y, 0, vh - 44));
  }

  function bringToFront(w, node) {
    if (w.z === topZ) return;
    w.z = ++topZ;
    node.style.zIndex = w.z;
    save();
  }

  /** Ziehen per Maus, Stift oder Finger. */
  function makeDraggable(handle, w, node, apply) {
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button, input, a, .w-menu')) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, start = { ...w };
      node.classList.add('is-moving');
      const move = ev => { apply(start, ev.clientX - sx, ev.clientY - sy); keepInView(w); place(w, node); };
      const end = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
        node.classList.remove('is-moving');
        save();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  function mount(w) {
    const def = Widgets[w.type];
    w.data = { ...def.data(), ...(w.data || {}) };
    const ac = new AbortController();

    const tools = el('div', { class: 'w-tools' });
    const head = el('header', { class: 'w-head' }, [
      el('span', { class: 'w-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'w-title', text: def.name }),
      tools,
      el('button', {
        class: 'w-btn w-close', title: 'Entfernen', 'aria-label': `${def.name} entfernen`,
        html: icon('x'), onclick: () => remove(w.id),
      }),
    ]);
    const body = el('div', { class: 'w-body' });
    const grip = el('div', { class: 'w-grip', title: 'Größe ändern', 'aria-hidden': 'true' });
    const node = el('section', { class: `widget w-${w.type}`, 'aria-label': def.name }, [head, body, grip]);
    node.style.setProperty('--accent', def.accent);
    node.addEventListener('pointerdown', () => bringToFront(w, node), true);

    keepInView(w);
    place(w, node);
    board.append(node);

    makeDraggable(head, w, node, (s, dx, dy) => { w.x = s.x + dx; w.y = s.y + dy; });
    makeDraggable(grip, w, node, (s, dx, dy) => { w.w = s.w + dx; w.h = s.h + dy; });

    let inst = {};
    try {
      inst = def.mount({ node, body, tools, data: w.data, save, signal: ac.signal }) || {};
    } catch (err) {
      console.error(err);
      body.append(el('p', { class: 'w-note', text: 'Dieses Werkzeug konnte nicht geladen werden.' }));
    }
    live.set(w.id, { node, inst, ac });
    return w;
  }

  function add(type, initialData) {
    const def = Widgets[type];
    const n = state.widgets.length % 6;
    const w = {
      id: uid(), type, w: def.size.w, h: def.size.h, z: ++topZ, data: { ...def.data(), ...initialData },
      x: Math.round((window.innerWidth - def.size.w) / 2 + n * 30 - 75),
      y: Math.round((window.innerHeight - def.size.h) / 2 + n * 30 - 110),
    };
    state.widgets.push(w);
    mount(w);
    updateEmpty();
    save();
    return w;
  }

  function remove(id) {
    const i = state.widgets.findIndex(w => w.id === id);
    if (i < 0) return;
    const [w] = state.widgets.splice(i, 1);
    const entry = live.get(id);
    live.delete(id);
    if (entry) {
      try { entry.inst.destroy?.(); } catch (err) { console.error(err); }
      entry.ac.abort();
      entry.node.classList.add('is-leaving');
      setTimeout(() => entry.node.remove(), 160);
    }
    Widgets[w.type].onRemove?.(w.data);
    updateEmpty();
    save();
  }

  function clearAll() {
    if (!state.widgets.length) return;
    if (!confirm('Alle Werkzeuge vom Bildschirm entfernen?')) return;
    [...state.widgets].forEach(w => remove(w.id));
  }

  window.addEventListener('resize', debounce(() => {
    for (const w of state.widgets) { keepInView(w); const e = live.get(w.id); if (e) place(w, e.node); }
    save();
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
      css = bg.color; light = isLight(bg.color);
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
    if (old?.kind === 'image' && old.imageId !== bg.imageId) ImageDB.del(old.imageId).catch(() => {});
    state.background = bg;
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
  const panels = []; // { panel, btn }
  let fsBtn;

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

  function panelButton(label, iconName, panelEl, accent) {
    const entry = { panel: panelEl };
    entry.btn = dockButton(label, iconName, () => togglePanel(entry), accent);
    entry.btn.setAttribute('aria-expanded', 'false');
    panels.push(entry);
    return entry.btn;
  }

  function buildDock() {
    const adders = ORDER.filter(t => Widgets[t]).map(t => {
      const d = Widgets[t];
      const b = dockButton(d.name, d.icon, () => add(t), d.accent);
      b.title = `${d.name} hinzufügen`;
      return b;
    });
    const collabBtn = panelButton('Gemeinsam', 'users', collabPanel, '#5b5bd6');
    collabBtn.title = 'Zusammenarbeit: Pinnwände, Dokumente, Umfragen …';
    const bgBtn = panelButton('Hintergrund', 'palette', panel);
    fsBtn = dockButton('Vollbild', 'expand', toggleFullscreen);
    const clearBtn = dockButton('Leeren', 'trash', clearAll);
    dock.replaceChildren(...adders, el('span', { class: 'dock-sep', 'aria-hidden': 'true' }), collabBtn, bgBtn, fsBtn, clearBtn);
    if (!document.fullscreenEnabled) fsBtn.hidden = true;
  }

  document.addEventListener('pointerdown', e => {
    if (e.target.closest?.('.emoji-pop')) return;
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
  ['pointermove', 'pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, wake, { passive: true }));
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
  applyBackground();
  state.widgets.forEach(mount);
  updateEmpty();
})();
