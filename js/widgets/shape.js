'use strict';

/* =====================================================================
   Formen, Kästen & Symbole – zum Gestalten ansehnlicher Bildschirme.
   Rahmenlos: direkt am Objekt ziehen, Doppelklick (oder ✎) für Text.
   ===================================================================== */

const SHAPE_PALETTE = [
  ['Weiß', '#ffffff'], ['Gelb', '#fde68a'], ['Hellblau', '#bfdbfe'], ['Hellgrün', '#bbf7d0'], ['Rosa', '#fecdd3'],
  ['Flieder', '#e9d5ff'], ['Apricot', '#fed7aa'], ['Blau', '#2563eb'], ['Grün', '#16a34a'], ['Rot', '#dc2626'],
  ['Orange', '#f59e0b'], ['Lila', '#7c3aed'], ['Dunkel', '#1e293b'], ['Grau', '#64748b'],
];

const CALLOUTS = {
  merke:   { title: 'Merke',   color: '#2563eb', symbol: '💡' },
  tipp:    { title: 'Tipp',    color: '#16a34a', symbol: '👍' },
  achtung: { title: 'Achtung', color: '#d97706', symbol: '⚠️' },
  aufgabe: { title: 'Aufgabe', color: '#7c3aed', symbol: '✏️' },
};

const SHAPE_PRESETS = [
  { label: 'Box',         size: [260, 160], data: { kind: 'rect',    fill: '#ffffff', stroke: '#1e293b', strokeWidth: 3 } },
  { label: 'Abgerundet',  size: [260, 160], data: { kind: 'round',   fill: '#bfdbfe', stroke: '#2563eb', strokeWidth: 3 } },
  { label: 'Kreis',       size: [180, 180], data: { kind: 'ellipse', fill: '#fde68a', stroke: '#f59e0b', strokeWidth: 3 } },
  { label: 'Pfeil',       size: [240, 110], data: { kind: 'arrow',   fill: '#2563eb', stroke: '#1e40af', strokeWidth: 0, dir: 'right' } },
  { label: 'Sprechblase', size: [300, 200], data: { kind: 'speech',  fill: '#ffffff', stroke: '#1e293b', strokeWidth: 3 } },
  { label: 'Stern',       size: [180, 180], data: { kind: 'star',    fill: '#fde68a', stroke: '#f59e0b', strokeWidth: 3 } },
  { label: 'Schild',      size: [320, 100], data: { kind: 'banner',  fill: '#dc2626', stroke: '#991b1b', strokeWidth: 0 } },
];

const STICKERS = [
  ['👤', 'Einzelarbeit'], ['🧑‍🤝‍🧑', 'Partnerarbeit'], ['👥', 'Gruppenarbeit'], ['🗣️', 'Plenum'],
  ['🤫', 'Leise arbeiten'], ['✋', 'Melden'], ['📖', 'Lesen'], ['✏️', 'Schreiben'],
  ['👂', 'Zuhören'], ['🤔', 'Nachdenken'], ['☕', 'Pause'], ['🏠', 'Hausaufgabe'],
];

/** Helle Füllung → dunkle Schrift, dunkle Füllung → weiße Schrift. */
function autoInk(fill) {
  const m = /^#([0-9a-f]{6})$/i.exec(fill || '');
  if (!m) return '#1e293b';
  const n = parseInt(m[1], 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#1e293b' : '#ffffff';
}

/** SVG-Form passend zur echten Größe (Ecken bleiben rund, nichts wird verzerrt). */
function shapeSvg(d, w, h) {
  const sw = clamp(Number(d.strokeWidth) || 0, 0, 40), s = sw / 2;
  const fill = safeColor(d.fill, 'none'), strokeColor = safeColor(d.stroke, '#1e293b');
  const R = (x) => Math.round(x * 10) / 10;
  let inner = '';
  switch (d.kind) {
    case 'rect':
      inner = `<rect x='${s}' y='${s}' width='${R(w - sw)}' height='${R(h - sw)}'/>`;
      break;
    case 'round': {
      const r = Math.min(28, w / 4, h / 4);
      inner = `<rect x='${s}' y='${s}' width='${R(w - sw)}' height='${R(h - sw)}' rx='${R(r)}'/>`;
      break;
    }
    case 'ellipse':
      inner = `<ellipse cx='${R(w / 2)}' cy='${R(h / 2)}' rx='${R(Math.max(1, w / 2 - s))}' ry='${R(Math.max(1, h / 2 - s))}'/>`;
      break;
    case 'arrow': {
      const vertical = d.dir === 'up' || d.dir === 'down';
      const W = vertical ? h : w, H = vertical ? w : h;
      const head = Math.min(W * 0.45, H * 0.9);
      const path = `M${s} ${R(H * 0.28)}H${R(W - head)}V${s}L${R(W - s)} ${R(H / 2)}L${R(W - head)} ${R(H - s)}V${R(H * 0.72)}H${s}Z`;
      const t = { right: '', left: `translate(${w} 0) scale(-1 1)`, down: `translate(${w} 0) rotate(90)`, up: `translate(0 ${h}) rotate(-90)` }[d.dir] || '';
      inner = `<path d='${path}' transform='${t}'/>`;
      break;
    }
    case 'speech': {
      const bh = h * 0.8, r = Math.min(22, w / 6, bh / 3);
      inner = `<path d='M${R(r + s)} ${s}H${R(w - r - s)}Q${R(w - s)} ${s} ${R(w - s)} ${R(r + s)}V${R(bh - r)}Q${R(w - s)} ${R(bh)} ${R(w - r - s)} ${R(bh)}` +
        `H${R(w * 0.34)}L${R(w * 0.16)} ${R(h - s)}L${R(w * 0.2)} ${R(bh)}H${R(r + s)}Q${s} ${R(bh)} ${s} ${R(bh - r)}V${R(r + s)}Q${s} ${s} ${R(r + s)} ${s}Z'/>`;
      break;
    }
    case 'star': {
      const cx = w / 2, cy = h / 2 + Math.min(w, h) * 0.04, Ro = Math.min(w, h) / 2 - s, Ri = Ro * 0.48;
      let p = '';
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? Ri : Ro;
        p += `${i ? 'L' : 'M'}${R(cx + rr * Math.cos(a))} ${R(cy + rr * Math.sin(a))}`;
      }
      inner = `<path d='${p}Z'/>`;
      break;
    }
    case 'banner': {
      const n = Math.min(h * 0.32, w * 0.15);
      inner = `<path d='M${s} ${s}H${R(w - s)}L${R(w - n)} ${R(h / 2)}L${R(w - s)} ${R(h - s)}H${s}L${R(n)} ${R(h / 2)}Z'/>`;
      break;
    }
  }
  const stroke = sw ? `stroke='${strokeColor}' stroke-width='${sw}'` : `stroke='none'`;
  return `<svg width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' aria-hidden='true'><g fill='${fill}' ${stroke} stroke-linejoin='round'>${inner}</g></svg>`;
}

/** Text in einem Element per Doppelklick (oder Stift-Knopf) bearbeitbar machen. */
function editableText(elm, get, set, placeholder) {
  elm.textContent = get() || '';
  elm.dataset.placeholder = placeholder;
  const start = () => {
    elm.contentEditable = 'plaintext-only';
    if (elm.contentEditable !== 'plaintext-only') elm.contentEditable = 'true';
    elm.focus();
    const r = document.createRange();
    r.selectNodeContents(elm);
    r.collapse(false);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  };
  elm.addEventListener('dblclick', start);
  elm.addEventListener('input', () => set(elm.innerText.replace(/\n$/, '')));
  elm.addEventListener('blur', () => {
    elm.contentEditable = 'false';
    if (!elm.textContent.trim()) elm.textContent = '';
  });
  elm.addEventListener('keydown', e => { if (e.key === 'Escape') elm.blur(); });
  elm.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); });
  return start;
}

registerWidget('shape', {
  name: 'Form',
  icon: 'shapes',
  accent: '#e85d75',
  size: { w: 260, h: 160 },
  min: { w: 50, h: 40 },
  frameless: true,
  dragBody: true,
  duplicable: true,
  data: () => ({ kind: 'round', fill: '#bfdbfe', stroke: '#2563eb', strokeWidth: 3, text: '', textColor: null, fontSize: 28, dir: 'right', title: '', symbol: '⭐', callout: 'merke' }),

  mount({ node, body, tools, data, save, layer }) {
    node.classList.add(`kind-${data.kind}`);
    const kind = data.kind;
    let startEdit = () => {};
    let redraw = () => {};
    let observer = null;

    if (kind === 'callout') {
      /* ---- Kasten: Merke / Tipp / Achtung / Aufgabe ---- */
      const kindOf = () => CALLOUTS[data.callout] || CALLOUTS.merke;
      const box = el('div', { class: 'sh-callout' });
      const symbol = el('span', { class: 'sh-callout-icon' });
      const title = el('span', { class: 'sh-callout-title' });
      const text = el('div', { class: 'sh-text sh-callout-text' });
      box.append(el('div', { class: 'sh-callout-head' }, [symbol, title]), text);
      body.append(box);
      editableText(title, () => data.title || kindOf().title, v => { data.title = v; save(); }, kindOf().title);
      startEdit = editableText(text, () => data.text, v => { data.text = v; save(); }, 'Doppelklick zum Schreiben');
      redraw = () => {
        const c = kindOf();
        box.style.setProperty('--c', safeColor(data.fill, c.color));
        symbol.textContent = c.symbol;
        if (!data.title && document.activeElement !== title) title.textContent = c.title;
        text.style.fontSize = data.fontSize + 'px';
      };
    } else if (kind === 'emoji') {
      /* ---- Symbol mit Beschriftung ---- */
      const sym = el('div', { class: 'sh-emoji', text: data.symbol });
      const caption = el('div', { class: 'sh-text sh-caption' });
      body.append(sym, caption);
      startEdit = editableText(caption, () => data.text, v => { data.text = v; save(); node.classList.toggle('has-caption', !!v.trim()); }, 'Beschriftung');
      redraw = () => {
        sym.textContent = data.symbol;
        caption.style.fontSize = data.fontSize + 'px';
        caption.style.color = data.textColor || '';
        node.classList.toggle('has-caption', !!(data.text || '').trim());
      };
    } else {
      /* ---- Form mit Text ---- */
      const art = el('div', { class: 'sh-art' });
      const text = el('div', { class: 'sh-text sh-label' });
      body.append(art, text);
      startEdit = editableText(text, () => data.text, v => { data.text = v; save(); }, 'Doppelklick für Text');
      redraw = () => {
        const w = body.clientWidth, h = body.clientHeight;
        if (w && h) art.innerHTML = shapeSvg(data, w, h);
        text.style.color = data.textColor || autoInk(data.fill);
        text.style.fontSize = data.fontSize + 'px';
        text.dataset.kind = kind;
      };
      observer = new ResizeObserver(() => redraw());
      observer.observe(body);
    }

    /* ---------- Kopfzeile: Text, Gestalten ---------- */
    const editBtn = el('button', { class: 'w-btn', title: 'Text bearbeiten', 'aria-label': 'Text bearbeiten', html: icon('pencil') });
    editBtn.addEventListener('mousedown', e => e.preventDefault());
    editBtn.addEventListener('click', () => startEdit());
    const styleBtn = el('button', { class: 'w-btn', title: 'Gestalten', 'aria-label': 'Gestalten', html: icon('palette') });
    styleBtn.addEventListener('click', () => openPopover(styleBtn, stylePanel(), { className: 'sh-pop', label: 'Form gestalten' }));
    tools.append(editBtn, styleBtn);

    const change = () => { redraw(); save(); };

    function swatchRow(list, current, onPick, { none = false } = {}) {
      const row = el('div', { class: 'x-swatches' });
      const mark = value => row.querySelectorAll('.x-swatch').forEach(s => s.setAttribute('aria-pressed', String(s.dataset.value === String(value))));
      list.forEach(([name, color]) => {
        const s = el('button', { class: 'x-swatch', type: 'button', title: name, 'aria-label': name, 'data-value': color, onclick: () => { onPick(color); mark(color); } });
        s.style.background = color;
        row.append(s);
      });
      if (none) row.append(el('button', { class: 'x-swatch x-none', type: 'button', title: 'Keine', 'aria-label': 'Keine', 'data-value': 'none', onclick: () => { onPick(null); mark('none'); } }));
      mark(current ?? 'none');
      return row;
    }
    const section = (title, ...content) => el('div', { class: 'sh-sec' }, [el('h4', { text: title }), ...content]);
    const pill = (label, onclick, pressed) => el('button', { class: 'sh-pill', type: 'button', 'aria-pressed': String(!!pressed), html: label, onclick });
    const sizeRow = () => el('div', { class: 'sh-pills' }, [
      pill('A−', () => { data.fontSize = Math.round(clamp(data.fontSize / 1.15, 10, 160)); change(); }),
      pill('A+', () => { data.fontSize = Math.round(clamp(data.fontSize * 1.15, 10, 160)); change(); }),
    ]);
    const layerRow = () => section('Ebene', el('div', { class: 'sh-pills' }, [
      pill(icon('layers') + ' Nach vorne', () => layer('front')),
      pill(icon('layers') + ' Nach hinten', () => layer('back')),
    ]));

    function stylePanel() {
      if (kind === 'callout') {
        return el('div', { class: 'sh-panel' }, [
          section('Art', el('div', { class: 'sh-pills' }, Object.entries(CALLOUTS).map(([id, c]) =>
            pill(`${c.symbol} ${c.title}`, () => { data.callout = id; data.fill = null; data.title = ''; change(); }, data.callout === id)))),
          section('Farbe', swatchRow(SHAPE_PALETTE.slice(7), data.fill, v => { data.fill = v; change(); }, { none: false })),
          section('Textgröße', sizeRow()),
          layerRow(),
        ]);
      }
      if (kind === 'emoji') {
        const symBtn = pill('Symbol ändern …', () => openEmojiPicker(styleBtn, s => { data.symbol = s; change(); }));
        return el('div', { class: 'sh-panel' }, [
          section('Symbol', el('div', { class: 'sh-pills' }, [symBtn])),
          section('Beschriftung', swatchRow([['Dunkel', '#1e293b'], ['Weiß', '#ffffff'], ['Blau', '#2563eb'], ['Rot', '#dc2626'], ['Grün', '#16a34a']], data.textColor, v => { data.textColor = v; change(); }), sizeRow()),
          layerRow(),
        ]);
      }
      const parts = [
        section('Füllung', swatchRow(SHAPE_PALETTE, data.fill, v => { data.fill = v; change(); }, { none: true })),
        section('Rand',
          swatchRow(SHAPE_PALETTE.slice(7), data.stroke, v => { data.stroke = v || data.stroke; if (!v) data.strokeWidth = 0; else if (!data.strokeWidth) data.strokeWidth = 3; change(); }, { none: true }),
          el('div', { class: 'sh-pills' }, [['dünn', 2], ['mittel', 4], ['dick', 8]].map(([label, wdt]) =>
            pill(label, () => { data.strokeWidth = wdt; change(); }, data.strokeWidth === wdt)))),
        section('Text',
          swatchRow([['Automatisch', 'auto'], ['Dunkel', '#1e293b'], ['Weiß', '#ffffff'], ['Rot', '#dc2626'], ['Blau', '#2563eb']], data.textColor || 'auto',
            v => { data.textColor = v === 'auto' ? null : v; change(); }),
          sizeRow()),
      ];
      if (kind === 'arrow') {
        parts.push(section('Richtung', el('div', { class: 'sh-pills' }, [['←', 'left'], ['→', 'right'], ['↑', 'up'], ['↓', 'down']].map(([label, dir]) =>
          pill(label, () => { data.dir = dir; change(); }, data.dir === dir)))));
      }
      parts.push(layerRow());
      return el('div', { class: 'sh-panel' }, parts);
    }

    redraw();
    return { destroy() { observer?.disconnect(); } };
  },
});

/* ---------- Galerie „Formen“ in der Werkzeugleiste ---------- */
function buildShapesPanel(panel, { addWidget, close }) {
  const insert = (data, size) => { addWidget('shape', data, size && { w: size[0], h: size[1] }); close(); };

  const shapeItems = SHAPE_PRESETS.map(p => {
    const preview = el('span', { class: 'sg-preview', html: shapeSvg({ ...p.data, strokeWidth: Math.min(p.data.strokeWidth, 2) }, 64, p.data.kind === 'ellipse' || p.data.kind === 'star' ? 46 : p.data.kind === 'banner' ? 26 : 40) });
    return el('button', { class: 'sg-item', type: 'button', title: `${p.label} einfügen`, onclick: () => insert({ ...p.data }, p.size) },
      [preview, el('span', { class: 'sg-name', text: p.label })]);
  });

  const calloutItems = Object.entries(CALLOUTS).map(([id, c]) => {
    const preview = el('span', { class: 'sg-callout', html: `<b>${c.symbol} ${c.title}</b><i></i><i></i>` });
    preview.style.setProperty('--c', c.color);
    return el('button', { class: 'sg-item', type: 'button', title: `Kasten „${c.title}“ einfügen`, onclick: () => insert({ kind: 'callout', callout: id, fill: null, fontSize: 24 }, [420, 200]) },
      [preview, el('span', { class: 'sg-name', text: c.title })]);
  });

  const stickerItems = STICKERS.map(([symbol, label]) =>
    el('button', { class: 'sg-item sg-sticker', type: 'button', title: `${label} einfügen`, onclick: () => insert({ kind: 'emoji', symbol, text: label, fontSize: 22 }, [170, 180]) },
      [el('span', { class: 'sg-emoji', text: symbol }), el('span', { class: 'sg-name', text: label })]));

  const ownBtn = el('button', { class: 'sg-item sg-sticker', type: 'button', title: 'Beliebiges Symbol einfügen' },
    [el('span', { class: 'sg-emoji sg-more', html: icon('smile') }), el('span', { class: 'sg-name', text: 'Eigenes …' })]);
  ownBtn.addEventListener('click', () => openEmojiPicker(ownBtn, symbol => insert({ kind: 'emoji', symbol, text: '', fontSize: 22 }, [150, 150])));

  const section = (title, items) => el('section', { class: 'bg-section' }, [el('h3', { text: title }), el('div', { class: 'sg-grid' }, items)]);
  panel.replaceChildren(
    el('h2', { text: 'Formen & Symbole' }),
    el('p', { class: 'sc-hint', text: 'Einfügen, dann direkt am Objekt ziehen. Doppelklick bearbeitet den Text, die Palette oben am Objekt ändert Farben.' }),
    section('Formen', shapeItems),
    section('Kästen', calloutItems),
    section('Arbeitsformen & Symbole', [...stickerItems, ownBtn]),
  );
}
