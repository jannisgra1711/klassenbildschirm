'use strict';

/* =====================================================================
   App: Arbeitsfläche, Werkzeugleiste, Hintergrund, Speichern.
   ===================================================================== */
(() => {
  const STORAGE_KEY = 'klassenbildschirm.v1';
  const ORDER = ['timer', 'stopwatch', 'clock', 'text', 'image', 'qr'];

  const BACKGROUNDS = [
    { id: 'tafel',    name: 'Tafel',    css: 'radial-gradient(ellipse at 30% 20%, #3f6150, #213529 72%)' },
    { id: 'nacht',    name: 'Nacht',    css: 'linear-gradient(135deg, #1d2846, #45306b)' },
    { id: 'ozean',    name: 'Ozean',    css: 'linear-gradient(135deg, #0d3f63, #2f7fb5)' },
    { id: 'schiefer', name: 'Schiefer', css: '#383d45' },
    { id: 'himmel',   name: 'Himmel',   css: 'linear-gradient(165deg, #9fd0fb, #e9f5ff)', light: true },
    { id: 'wiese',    name: 'Wiese',    css: 'linear-gradient(140deg, #c7ecaa, #74c27a)', light: true },
    { id: 'sonne',    name: 'Sonne',    css: 'linear-gradient(135deg, #ffe39d, #ffab9c)', light: true },
    { id: 'papier',   name: 'Papier',   css: '#f2ede3', light: true },
  ];

  /* ---------- Zustand laden & speichern ---------- */
  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* beschädigt → neu */ }
    if (!s || !Array.isArray(s.widgets)) s = { background: { kind: 'preset', id: 'tafel' }, widgets: [] };
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

  function add(type) {
    const def = Widgets[type];
    const n = state.widgets.length % 6;
    const w = {
      id: uid(), type, w: def.size.w, h: def.size.h, z: ++topZ, data: def.data(),
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

  async function applyBackground() {
    const bg = state.background || {};
    let css = BACKGROUNDS[0].css, light = false;
    if (bg.kind === 'preset') {
      const p = BACKGROUNDS.find(b => b.id === bg.id) || BACKGROUNDS[0];
      css = p.css; light = !!p.light;
    } else if (bg.kind === 'color') {
      css = bg.color; light = isLight(bg.color);
    } else if (bg.kind === 'image') {
      const blob = await ImageDB.get(bg.imageId).catch(() => null);
      if (blob) {
        if (bgObjectUrl) URL.revokeObjectURL(bgObjectUrl);
        bgObjectUrl = URL.createObjectURL(blob);
        css = `center / cover no-repeat url("${bgObjectUrl}"), #222`;
      }
    }
    if (bg.kind !== 'image' && bgObjectUrl) { URL.revokeObjectURL(bgObjectUrl); bgObjectUrl = null; }
    board.style.background = css;
    document.body.dataset.tone = light ? 'light' : 'dark';
    panel.querySelectorAll('.swatch').forEach(s => {
      s.setAttribute('aria-pressed', String(bg.kind === 'preset' && s.dataset.id === bg.id));
    });
  }

  function setBackground(bg) {
    const old = state.background;
    if (old?.kind === 'image' && old.imageId !== bg.imageId) ImageDB.del(old.imageId).catch(() => {});
    state.background = bg;
    save();
    applyBackground();
  }

  function buildPanel() {
    const swatches = BACKGROUNDS.map(b => {
      const s = el('button', {
        class: 'swatch', title: b.name, 'aria-label': `Hintergrund ${b.name}`, 'data-id': b.id,
        onclick: () => setBackground({ kind: 'preset', id: b.id }),
      });
      s.style.background = b.css;
      return s;
    });
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
      el('div', { class: 'swatches' }, swatches),
      el('div', { class: 'panel-row' }, [el('label', { class: 'color-pick' }, [color, el('span', { text: 'Eigene Farbe' })]), upload]),
    );
  }

  /* ---------- Werkzeugleiste ---------- */
  const dock = $('#dock');
  let bgBtn, fsBtn;

  function dockButton(label, iconName, onclick, accent) {
    const b = el('button', { class: 'dock-btn', html: icon(iconName) + `<span>${label}</span>`, onclick });
    if (accent) b.style.setProperty('--accent', accent);
    return b;
  }

  function togglePanel(force) {
    const open = force ?? panel.hidden;
    panel.hidden = !open;
    bgBtn.setAttribute('aria-expanded', String(open));
  }

  function buildDock() {
    const adders = ORDER.filter(t => Widgets[t]).map(t => {
      const d = Widgets[t];
      const b = dockButton(d.name, d.icon, () => add(t), d.accent);
      b.title = `${d.name} hinzufügen`;
      return b;
    });
    bgBtn = dockButton('Hintergrund', 'palette', () => togglePanel());
    bgBtn.setAttribute('aria-expanded', 'false');
    fsBtn = dockButton('Vollbild', 'expand', toggleFullscreen);
    const clearBtn = dockButton('Leeren', 'trash', clearAll);
    dock.replaceChildren(...adders, el('span', { class: 'dock-sep', 'aria-hidden': 'true' }), bgBtn, fsBtn, clearBtn);
    if (!document.fullscreenEnabled) fsBtn.hidden = true;
  }

  document.addEventListener('pointerdown', e => {
    if (!panel.hidden && !panel.contains(e.target) && !bgBtn.contains(e.target)) togglePanel(false);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') togglePanel(false); });

  /* ---------- Vollbild: Leiste blendet sich bei Ruhe aus ---------- */
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => toast('Vollbild ist hier nicht möglich.'));
  }

  let idleTimer;
  function wake() {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    if (document.fullscreenElement && panel.hidden) {
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
  applyBackground();
  state.widgets.forEach(mount);
  updateEmpty();
})();
