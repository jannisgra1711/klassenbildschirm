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
  list: '<path d="M9.5 6.5h10.5M9.5 12h10.5M9.5 17.5h10.5"/><path d="M3.8 6.3l1.3 1.3 2.4-2.6M3.8 11.8l1.3 1.3 2.4-2.6"/><circle cx="5.3" cy="17.5" r="1" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17 14.2a5.5 5.5 0 0 1 3.5 5.3"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  pin: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="6" y="7" width="5" height="5" rx=".6"/><rect x="13" y="7" width="5" height="4" rx=".6"/><rect x="6" y="14" width="5" height="3" rx=".6"/><rect x="13" y="13" width="5" height="4" rx=".6"/>',
  board: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21l4-4 4 4M7 13l3-4 3 3 4-5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  chart: '<path d="M5 20V11M12 20V5M19 20v-6M3 20h18"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  listBullet: '<circle cx="5" cy="7" r="1.4" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1.4" fill="currentColor" stroke="none"/><path d="M9.5 7H20M9.5 12H20M9.5 17H20"/>',
  listNumber: '<path d="M10 7H20M10 12H20M10 17H20"/><path d="M3.6 5.2L5 4.4V9.6M3.4 13.6c.4-1 2.8-1 2.8.4 0 1.2-2.8 1.8-2.8 3.4h3" stroke-width="1.5"/>',
  indent: '<path d="M4 5h16M11 10h9M11 14h9M4 19h16M4 9l3.5 3L4 15"/>',
  outdent: '<path d="M4 5h16M11 10h9M11 14h9M4 19h16M7.5 9L4 12l3.5 3"/>',
  alignRight: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  eraser: '<path d="M8 20h12M4.6 15.4l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H8.2z"/><path d="M9.5 10.5l5 5"/>',
  highlighter: '<path d="M14.5 4.5l5 5-8 8-5-5z"/><path d="M6.5 12.5L4 18l2 2 5.5-2.5"/>',
  note: '<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/>',
  caret: '<path d="M8 10l4 4 4-4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  shapes: '<rect x="3.5" y="12.5" width="8" height="8" rx="1.5"/><circle cx="16.5" cy="7.5" r="4"/><path d="M15.5 13.5l5 7h-10z"/>',
  layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
  download: '<path d="M12 4v11.5M7.5 11L12 15.5 16.5 11M4.5 15v4.5h15V15"/>',
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

/* ---------- Symbol-Auswahl (Emojis & Zeichen) ---------- */
const EMOJI_SETS = [
  { name: 'Unterricht', items: '📚 📖 ✏️ 📝 📐 📏 🧮 🔬 🧪 🌍 🗺️ 🎨 🎵 ⚽ 💻 📱 🧠 💡 🔍 📊 📋 🗂️ 📎 ✂️ 🖍️ 📓 🎭 🧩' },
  { name: 'Ablauf', items: '👋 🗣️ 👂 👀 🤫 🙋 ✋ 🤝 👤 👥 🧑‍🏫 ⏰ ⏳ ☕ 🍎 🔔 🏁 🚀 🎯 📌 🔁 ➡️ 🏠 🚪 🎒 🧹 🔇 💬' },
  { name: 'Feedback', items: '✅ ☑️ ❌ ⭐ 🌟 🏆 🥇 👍 👎 👏 🎉 💪 ❤️ 😀 🙂 😐 😕 🤔 😴 🤩 🔥 ⚠️ ❓ ❗ 🟢 🟡 🔴 🌈' },
  { name: 'Zeichen', items: '→ ⇒ ← ↑ ↓ ↔ ✓ ✗ • ★ ☆ ① ② ③ ④ ⑤ ⑥ ∑ ≈ ≠ ≤ ≥ ± × ÷ √ π ∞ ° € § ½ ¼ ¾ ² ³' },
].map(s => ({ ...s, items: s.items.split(' ') }));

/* ---------- Aufklapp-Menü (Popover) ----------
   Schwebt über allem, schließt bei Klick daneben oder Escape. Ein Klick
   darin nimmt dem Texteditor weder Fokus noch Markierung weg. */
let activePopover = null;

function closePopover() {
  if (!activePopover) return;
  const p = activePopover;
  activePopover = null;
  p.cleanup();
  p.pop.remove();
  p.anchor.setAttribute('aria-expanded', 'false');
}

/** Öffnet `content` unter `anchor`. Zweiter Klick auf denselben Auslöser schließt. */
function openPopover(anchor, content, { className = '', label = '' } = {}) {
  if (activePopover?.anchor === anchor) { closePopover(); return null; }
  closePopover();

  const pop = el('div', { class: `popover ${className}`, role: 'dialog', 'aria-label': label }, content);
  pop.addEventListener('mousedown', e => { if (!e.target.closest('input, select, textarea')) e.preventDefault(); });
  document.body.append(pop);

  // Unter (oder notfalls über) dem Auslöser platzieren
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  pop.style.left = clamp(r.left, 8, window.innerWidth - pw - 8) + 'px';
  pop.style.top = top + 'px';

  const onDown = e => { if (!pop.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  const onKey = e => { if (e.key === 'Escape') closePopover(); };
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey);
  anchor.setAttribute('aria-expanded', 'true');
  activePopover = {
    anchor, pop,
    cleanup() { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey); },
  };
  return pop;
}

/** Öffnet die Auswahl unter `anchor`; onPick(symbol) – bei „Kein Symbol“ mit ''. */
function openEmojiPicker(anchor, onPick, { allowNone = false } = {}) {
  const tabs = el('div', { class: 'emoji-tabs', role: 'tablist' });
  const grid = el('div', { class: 'emoji-grid' });
  const pick = sym => { closePopover(); onPick(sym); };

  function show(i) {
    openEmojiPicker.lastTab = i;
    [...tabs.children].forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
    grid.classList.toggle('is-symbols', EMOJI_SETS[i].name === 'Zeichen');
    grid.replaceChildren(...EMOJI_SETS[i].items.map(sym =>
      el('button', { type: 'button', text: sym, 'aria-label': sym, onclick: () => pick(sym) })));
  }
  EMOJI_SETS.forEach((s, i) => tabs.append(el('button', { class: 'emoji-tab', type: 'button', role: 'tab', text: s.name, onclick: () => show(i) })));

  show(openEmojiPicker.lastTab || 0);
  openPopover(anchor, [
    tabs, grid,
    allowNone ? el('button', { class: 'emoji-none', type: 'button', text: 'Kein Symbol', onclick: () => pick('') }) : null,
  ], { className: 'emoji-pop', label: 'Symbol auswählen' });
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
    keys: () => run('readonly', s => s.getAllKeys()),
  };
})();

/* ---------- Schutz vor eingeschleustem Code ----------
   Inhalte können aus fremden Sicherungsdateien stammen. Formatierter Text
   wird daher auf harmlose Tags und Stilangaben reduziert. */
const SAFE_TAGS = new Set(['DIV', 'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SPAN', 'FONT', 'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE']);
const SAFE_STYLES = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'text-align', 'margin-left', 'padding-left'];

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const clean = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE || !SAFE_TAGS.has(child.tagName)) {
        // Unbekanntes Element: Inhalt als Text behalten, Element entfernen
        if (child.nodeType === Node.ELEMENT_NODE && !/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|SVG|MATH)$/.test(child.tagName)) {
          child.replaceWith(...[...child.childNodes]);
          clean(node); // Ersetzte Kinder erneut prüfen
          return;
        }
        child.remove();
        continue;
      }
      const style = child.style;
      const kept = SAFE_STYLES
        .map(p => [p, style.getPropertyValue(p)])
        .filter(([, v]) => v && !/url\s*\(|expression|javascript:/i.test(v));
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      kept.forEach(([p, v]) => child.style.setProperty(p, v));
      clean(child);
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

/** Nur echte Farbwerte zulassen (#rgb, #rrggbb, rgb(…)). Sonst Ersatzwert. */
function safeColor(value, fallback = null) {
  const v = String(value ?? '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\([\d\s.,%]+\)$/i.test(v) ? v : fallback;
}

/** Nur Webadressen (http/https) als Link zulassen. */
const isWebUrl = url => /^https?:\/\//i.test(String(url || '').trim());

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
