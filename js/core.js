'use strict';

/* =====================================================================
   Kern: kleine Helfer, Symbole, Speicher, Ton, Werkzeug-Registrierung.
   Bewusst ohne Build-Schritt und ohne Module, damit die Seite auch per
   Doppelklick (file://) und auf GitHub Pages ohne Weiteres läuft.
   ===================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);

/** Element bauen: el('button', {class: 'x', onclick: fn}, [kinder]) */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const pad2 = n => String(n).padStart(2, '0');

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Sekunden → "05:00" bzw. "1:05:00" */
function formatDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** "5" → 5 Minuten, "2:30" → 2 min 30 s, "1:00:00" → 1 Stunde. Ungültig → null */
function parseDuration(str) {
  const s = String(str).trim().replace(',', '.');
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);
  const parts = s.split(':').map(p => p.trim());
  if (parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null;
  return parts.map(Number).reduce((acc, v) => acc * 60 + v, 0);
}

/* ---------- Symbole (eigene, schlichte Linien-Icons) ---------- */
const ICONS = {
  hourglass: '<path d="M6 3h12M6 21h12"/><path d="M8 3v3.5L12 12l4-5.5V3M8 21v-3.5L12 12l4 5.5V21"/>',
  stopwatch: '<circle cx="12" cy="14" r="7"/><path d="M12 14v-3.5M10 3h4M12 3v4M18.5 7.5l1.2-1.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-10 9"/>',
  qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h3v3h-3zM17.5 17.5h3v3h-3zM14 20.5h.5M20.5 14h.01"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.2-1-1.5-1-2.6 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-4-4-7.3-9-7.3z"/><circle cx="7.5" cy="11.5" r="1" fill="currentColor"/><circle cx="10" cy="7.3" r="1" fill="currentColor"/><circle cx="15" cy="7.8" r="1" fill="currentColor"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.5v4h4"/>',
  upload: '<path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5M4.5 15v4.5h15V15"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  alignLeft: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  alignCenter: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
};

function icon(name) {
  return `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ---------- Kurzmeldung oben am Bildschirm ---------- */
function toast(message, ms = 3500) {
  let box = $('#toast');
  if (!box) {
    box = el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(box._t);
  box._t = setTimeout(() => box.classList.remove('show'), ms);
}

/* ---------- Einstellungs-Menü im Kopf eines Werkzeugs ---------- */
function settingsMenu({ tools, signal }, items) {
  const head = tools.closest('.w-head');
  const menu = el('div', { class: 'w-menu', role: 'menu', hidden: true });
  const btn = el('button', {
    class: 'w-btn', title: 'Einstellungen', 'aria-label': 'Einstellungen', 'aria-haspopup': 'true',
    html: icon('sliders'),
  });

  function build() {
    menu.replaceChildren(...items.map(item => {
      const box = el('input', { type: 'checkbox' });
      box.checked = !!item.get();
      box.addEventListener('change', () => item.set(box.checked));
      return el('label', { role: 'menuitemcheckbox' }, [box, el('span', { text: item.label })]);
    }));
  }

  btn.addEventListener('click', () => {
    if (menu.hidden) build();
    menu.hidden = !menu.hidden;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  }, { signal });

  tools.append(btn);
  head.append(menu);
}

/* ---------- Bilder im Browser speichern (IndexedDB) ----------
   localStorage fasst nur ~5 MB. Bilder landen daher in IndexedDB,
   im Zustand steht nur ihre ID. */
const ImageDB = (() => {
  let opening = null;
  function db() {
    return opening ||= new Promise((resolve, reject) => {
      const req = indexedDB.open('klassenbildschirm', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('images');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function run(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('images', mode);
      const req = fn(tx.objectStore('images'));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  return {
    async put(blob) { const id = uid(); await run('readwrite', s => s.put(blob, id)); return id; },
    get: id => run('readonly', s => s.get(id)),
    del: id => run('readwrite', s => s.delete(id)),
  };
})();

/** Große Fotos verkleinern, damit der Speicher nicht vollläuft. */
async function shrinkImage(file, maxSide = 2000) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return file; } // z. B. SVG: unverändert
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5e6) { bitmap.close?.(); return file; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise(resolve => canvas.toBlob(b => resolve(b || file), 'image/webp', 0.88));
}

/** Dateiauswahl öffnen; liefert die gewählte Datei. */
function pickFile(accept = 'image/*') {
  return new Promise(resolve => {
    const input = el('input', { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });
}

/* ---------- Signalton (ohne Audiodatei, per Web Audio) ---------- */
const Sound = (() => {
  let ctx = null;
  function unlock() {
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch { /* kein Ton verfügbar */ }
    return ctx;
  }
  function tone(c, freq, start, dur, vol) {
    const osc = c.createOscillator(), gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }
  /** Freundlicher Gong, dreimal. */
  function chime() {
    const c = unlock();
    if (!c) return;
    const t = c.currentTime + 0.05;
    for (let i = 0; i < 3; i++) {
      tone(c, 880, t + i * 0.9, 0.85, 0.35);
      tone(c, 1318.5, t + i * 0.9 + 0.16, 0.75, 0.22);
    }
  }
  return { unlock, chime };
})();

/* ---------- Werkzeug-Registrierung ----------
   Jedes Werkzeug ruft registerWidget(typ, definition) auf:
   { name, icon, accent, size:{w,h}, min:{w,h}, data(): Startwerte,
     mount(ctx) → { destroy?() }, onRemove?(data) }
   ctx = { node, body, tools, data, save, signal }                     */
const Widgets = {};
function registerWidget(type, def) {
  Widgets[type] = { type, ...def };
}
