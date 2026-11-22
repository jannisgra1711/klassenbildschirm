'use strict';

/* Text: Arbeitsaufträge, Notizen, Hausaufgaben.
   Die Werkzeugleiste erscheint nur beim Schreiben – die Klasse sieht sauberen Text. */

const TEXT_FONTS = [
  { id: 'system',   name: 'Standard',              hint: 'Systemschrift',                          css: 'var(--font)' },
  { id: 'andika',   name: 'Andika',                hint: 'Leselernschrift, eindeutige Buchstaben', css: "'Andika', var(--font)" },
  { id: 'lexend',   name: 'Lexend',                hint: 'Entwickelt für flüssiges Lesen',         css: "'Lexend', var(--font)" },
  { id: 'atkinson', name: 'Atkinson Hyperlegible', hint: 'Zeichen besonders gut unterscheidbar',   css: "'Atkinson Hyperlegible', var(--font)" },
  { id: 'playpen',  name: 'Playpen Sans',          hint: 'Handschrift-Stil',                       css: "'Playpen Sans', var(--font)" },
  { id: 'serif',    name: 'Source Serif',          hint: 'Serifenschrift für längere Texte',       css: "'Source Serif 4', Georgia, serif" },
  { id: 'mono',     name: 'JetBrains Mono',        hint: 'Informatik & Code',                      css: "'JetBrains Mono', Consolas, monospace" },
];

const TEXT_COLORS = [
  ['Rot', '#d62828'], ['Orange', '#c2410c'], ['Grün', '#15803d'], ['Blau', '#1d4ed8'],
  ['Lila', '#7e22ce'], ['Grau', '#6b7280'], ['Schwarz', '#1b2130'], ['Weiß', '#ffffff'],
];

const MARKER_COLORS = [
  ['Gelb', '#fff176'], ['Grün', '#b9f6ca'], ['Blau', '#b3e5fc'], ['Rosa', '#ffcdd2'], ['Orange', '#ffe0b2'], ['Lila', '#e1bee7'],
];

const NOTE_COLORS = [
  { id: 'white',  name: 'Weiß',  swatch: '#ffffff', vars: {} },
  { id: 'yellow', name: 'Gelb',  swatch: '#fff3a6', vars: { '--card': '#fff8c4', '--card-2': '#fbefa0', '--line': '#ece08e' } },
  { id: 'blue',   name: 'Blau',  swatch: '#cfe5fb', vars: { '--card': '#e6f2fd', '--card-2': '#d3e7fa', '--line': '#bdd7f2' } },
  { id: 'green',  name: 'Grün',  swatch: '#d2efd6', vars: { '--card': '#e8f6ea', '--card-2': '#d5eed9', '--line': '#c0e2c6' } },
  { id: 'pink',   name: 'Rosa',  swatch: '#fbd5e3', vars: { '--card': '#fde9f1', '--card-2': '#f9d7e4', '--line': '#f0c2d4' } },
  { id: 'board',  name: 'Tafel', swatch: '#2f4a3a', vars: { '--card': '#2f4a3a', '--card-2': '#3b5a48', '--line': '#4b6c58', '--ink': '#f3f1e7', '--ink-2': '#cfd8d0', '--ink-3': '#93a99a' } },
];

const BLOCK_FORMATS = [
  { tag: 'div', name: 'Text' },
  { tag: 'h2',  name: 'Überschrift' },
  { tag: 'h3',  name: 'Zwischenüberschrift' },
];

registerWidget('text', {
  name: 'Text',
  icon: 'text',
  accent: '#2b8a3e',
  size: { w: 540, h: 330 },
  min: { w: 220, h: 130 },
  data: () => ({ html: '', size: 36, align: 'left', font: 'system', note: 'white' }),

  mount({ node, body, data, save, signal }) {
    try { document.execCommand('styleWithCSS', false, true); } catch { /* alte Browser */ }

    const edit = el('div', {
      class: 'x-text', contenteditable: 'true', spellcheck: 'true', lang: 'de',
      'data-placeholder': 'Hier tippen …', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Text',
    });
    edit.innerHTML = data.html;
    const bar = el('div', { class: 'x-bar', role: 'toolbar', 'aria-label': 'Textformatierung' });
    body.append(bar, edit);

    /* ---------- Speichern & Zustand der Knöpfe ---------- */
    const stateButtons = [];
    function changed() {
      if (edit.innerHTML === '<br>') edit.innerHTML = '';
      data.html = edit.innerHTML;
      save();
      updateStates();
    }
    function updateStates() {
      for (const [btn, cmd] of stateButtons) {
        let on = false;
        try { on = document.queryCommandState(cmd); } catch { /* egal */ }
        btn.setAttribute('aria-pressed', String(on));
      }
      let block = '';
      try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch { /* egal */ }
      const fmt = BLOCK_FORMATS.find(f => f.tag === block) || BLOCK_FORMATS[0];
      blockBtn.querySelector('span').textContent = fmt.name;
    }
    document.addEventListener('selectionchange', () => {
      const sel = document.getSelection();
      if (sel.rangeCount && edit.contains(sel.anchorNode)) updateStates();
    }, { signal });

    /** Befehl auf die Markierung anwenden. */
    function run(command, value = null) {
      if (!edit.contains(document.getSelection().anchorNode)) {
        edit.focus();
        placeCaretAtEnd();
      }
      document.execCommand(command, false, value);
      changed();
    }
    function placeCaretAtEnd() {
      const r = document.createRange();
      r.selectNodeContents(edit);
      r.collapse(false);
      const sel = document.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }

    /* ---------- Bausteine der Werkzeugleiste ---------- */
    function btn(content, title, onclick, stateCmd) {
      const b = el('button', { class: 'x-btn', type: 'button', title, 'aria-label': title, html: content });
      b.addEventListener('mousedown', e => e.preventDefault()); // Markierung im Text behalten
      b.addEventListener('click', onclick);
      if (stateCmd) { b.setAttribute('aria-pressed', 'false'); stateButtons.push([b, stateCmd]); }
      return b;
    }
    const sep = () => el('span', { class: 'x-sep', 'aria-hidden': 'true' });
    const group = (...items) => el('div', { class: 'x-group' }, items);

    function swatches(list, onPick, extra) {
      return el('div', { class: 'x-swatches' }, [
        ...list.map(([name, color]) => {
          const s = el('button', { class: 'x-swatch', type: 'button', title: name, 'aria-label': name, onclick: () => { closePopover(); onPick(color); } });
          s.style.background = color;
          return s;
        }),
        extra || null,
      ]);
    }

    /* Schriftart (gilt für das ganze Textfeld) */
    const fontBtn = btn(`<span class="x-font-name"></span>${icon('caret')}`, 'Schriftart', () => {
      openPopover(fontBtn, el('div', { class: 'x-menu' }, TEXT_FONTS.map(f => {
        const item = el('button', {
          class: 'x-menu-item', type: 'button', 'aria-pressed': String(f.id === data.font),
          onclick: () => { closePopover(); data.font = f.id; applyLook(); save(); edit.focus(); },
        }, [el('strong', { text: f.name }), el('small', { text: f.hint })]);
        item.firstChild.style.fontFamily = f.css;
        return item;
      })), { className: 'x-pop', label: 'Schriftart wählen' });
    });
    fontBtn.classList.add('x-wide');

    /* Absatzformat: Text / Überschrift / Zwischenüberschrift */
    const blockBtn = btn(`<span>Text</span>${icon('caret')}`, 'Absatzformat', () => {
      openPopover(blockBtn, el('div', { class: 'x-menu' }, BLOCK_FORMATS.map(f =>
        el('button', {
          class: `x-menu-item x-fmt-${f.tag}`, type: 'button',
          onclick: () => { closePopover(); run('formatBlock', `<${f.tag}>`); },
        }, [el('strong', { text: f.name })]))), { className: 'x-pop', label: 'Absatzformat wählen' });
    });
    blockBtn.classList.add('x-wide');

    const resize = factor => { data.size = Math.round(clamp(data.size * factor, 14, 220)); applyLook(); save(); };

    const colorBtn = btn('<span class="x-a">A<i></i></span>', 'Textfarbe', () => {
      openPopover(colorBtn, swatches(TEXT_COLORS, c => run('foreColor', c),
        el('button', { class: 'x-swatch x-none', type: 'button', title: 'Standardfarbe', 'aria-label': 'Standardfarbe', onclick: () => { closePopover(); run('foreColor', getComputedStyle(edit).color); } })),
      { className: 'x-pop', label: 'Textfarbe wählen' });
    });
    const markBtn = btn(icon('highlighter'), 'Textmarker', () => {
      openPopover(markBtn, swatches(MARKER_COLORS, c => run('hiliteColor', c),
        el('button', { class: 'x-swatch x-none', type: 'button', title: 'Kein Marker', 'aria-label': 'Kein Marker', onclick: () => { closePopover(); run('hiliteColor', 'transparent'); } })),
      { className: 'x-pop', label: 'Markerfarbe wählen' });
    });

    const noteBtn = btn(icon('note'), 'Farbe des Zettels', () => {
      openPopover(noteBtn, el('div', { class: 'x-swatches' }, NOTE_COLORS.map(n => {
        const s = el('button', {
          class: 'x-swatch x-note', type: 'button', title: n.name, 'aria-label': `Zettel ${n.name}`, 'aria-pressed': String(n.id === data.note),
          onclick: () => { closePopover(); data.note = n.id; applyLook(); save(); },
        });
        s.style.background = n.swatch;
        return s;
      })), { className: 'x-pop', label: 'Zettelfarbe wählen' });
    });

    const emojiBtn = btn(icon('smile'), 'Symbol einfügen', () => {
      openEmojiPicker(emojiBtn, sym => run('insertText', sym));
    });

    bar.append(
      group(fontBtn, blockBtn),
      sep(),
      group(btn('A−', 'Schrift kleiner (ganzes Feld)', () => resize(1 / 1.15)), btn('A+', 'Schrift größer (ganzes Feld)', () => resize(1.15))),
      sep(),
      group(
        btn('<b>B</b>', 'Fett (Strg+B)', () => run('bold'), 'bold'),
        btn('<i>I</i>', 'Kursiv (Strg+I)', () => run('italic'), 'italic'),
        btn('<u>U</u>', 'Unterstrichen (Strg+U)', () => run('underline'), 'underline'),
        btn('<s>S</s>', 'Durchgestrichen', () => run('strikeThrough'), 'strikeThrough'),
      ),
      sep(),
      group(colorBtn, markBtn),
      sep(),
      group(
        btn(icon('listBullet'), 'Aufzählung (oder „- “ tippen)', () => run('insertUnorderedList'), 'insertUnorderedList'),
        btn(icon('listNumber'), 'Nummerierung (oder „1. “ tippen)', () => run('insertOrderedList'), 'insertOrderedList'),
        btn(icon('outdent'), 'Einzug verkleinern (Umschalt+Tab)', () => run('outdent')),
        btn(icon('indent'), 'Einzug vergrößern (Tab)', () => run('indent')),
      ),
      sep(),
      group(
        btn(icon('alignLeft'), 'Linksbündig', () => run('justifyLeft'), 'justifyLeft'),
        btn(icon('alignCenter'), 'Zentriert', () => run('justifyCenter'), 'justifyCenter'),
        btn(icon('alignRight'), 'Rechtsbündig', () => run('justifyRight'), 'justifyRight'),
      ),
      sep(),
      group(emojiBtn, noteBtn, btn(icon('eraser'), 'Formatierung entfernen', () => { run('removeFormat'); run('formatBlock', '<div>'); })),
    );

    /* ---------- Aussehen des ganzen Feldes ---------- */
    function applyLook() {
      const font = TEXT_FONTS.find(f => f.id === data.font) || TEXT_FONTS[0];
      edit.style.fontFamily = font.css;
      edit.style.setProperty('--fs', data.size + 'px');
      edit.style.textAlign = data.align === 'center' ? 'center' : '';
      const nameEl = fontBtn.querySelector('.x-font-name');
      nameEl.textContent = font.name;
      nameEl.style.fontFamily = font.css;

      const note = NOTE_COLORS.find(n => n.id === data.note) || NOTE_COLORS[0];
      NOTE_COLORS.forEach(n => Object.keys(n.vars).forEach(k => node.style.removeProperty(k)));
      Object.entries(note.vars).forEach(([k, v]) => node.style.setProperty(k, v));
      node.classList.toggle('is-dark-note', note.id === 'board');
    }

    /* ---------- Tab für Einzug in Listen ---------- */
    edit.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const n = document.getSelection().anchorNode;
      const li = n && (n.nodeType === 1 ? n : n.parentElement).closest('li');
      if (li && edit.contains(li)) {
        e.preventDefault();
        run(e.shiftKey ? 'outdent' : 'indent');
      }
    });

    /* ---------- Listen per „- “ bzw. „1. “ am Zeilenanfang ----------
       Geprüft am eingegebenen Text (nicht am Tastendruck), damit es auch mit
       Bildschirmtastaturen auf Tablets und Smartboards funktioniert. */
    function autoList(inserted) {
      const sel = document.getSelection();
      if (!sel.isCollapsed || !sel.anchorNode) return;
      const start = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      if (start.closest('li')) return;
      let block = start; // umgebender Absatz (oder das Feld selbst in der ersten Zeile)
      while (block !== edit && !/^(DIV|P|H2|H3)$/.test(block.tagName)) block = block.parentElement;
      const before = document.createRange();
      before.setStart(block, 0);
      before.setEnd(sel.anchorNode, sel.anchorOffset);
      const typed = before.toString().replace(/ /g, ' ');
      const m = /^([-*•]|\d+[.)]) /.exec(typed);
      // Nur auslösen, wenn genau diese Eingabe das Kürzel vervollständigt hat
      if (!m || typed.length - inserted.length >= m[0].length) return;

      sel.removeAllRanges();
      sel.addRange(prefixRange(block, m[0].length));
      document.execCommand('delete');
      document.execCommand(/^\d/.test(m[1]) ? 'insertOrderedList' : 'insertUnorderedList');
      // Schreibmarke ans Ende des neuen Listenpunkts
      const n = document.getSelection().anchorNode;
      const li = n && (n.nodeType === 1 ? n : n.parentElement).closest('li');
      if (li) {
        const r = document.createRange();
        r.selectNodeContents(li);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }

    /** Bereich der ersten n Zeichen eines Absatzes. */
    function prefixRange(block, n) {
      const r = document.createRange();
      r.setStart(block, 0);
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let left = n, t;
      while ((t = walker.nextNode())) {
        if (t.textContent.length >= left) { r.setEnd(t, left); return r; }
        left -= t.textContent.length;
      }
      r.setEnd(block, block.childNodes.length);
      return r;
    }

    edit.addEventListener('input', e => {
      if (e.inputType === 'insertText' && /[  ]/.test(e.data || '')) autoList(e.data);
      changed();
    });

    // Nur reinen Text übernehmen (keine fremden Formatierungen aus Word & Co.)
    const insertPlain = text => { if (text) document.execCommand('insertText', false, text); };
    edit.addEventListener('paste', e => { e.preventDefault(); insertPlain(e.clipboardData.getData('text/plain')); });
    edit.addEventListener('drop', e => { e.preventDefault(); insertPlain(e.dataTransfer.getData('text/plain')); });

    applyLook();
    if (!data.html) setTimeout(() => edit.focus(), 50);
  },
});
