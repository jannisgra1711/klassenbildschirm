'use strict';

/* Text: Arbeitsaufträge, Notizen, Hausaufgaben – direkt eintippen. */
registerWidget('text', {
  name: 'Text',
  icon: 'text',
  accent: '#2b8a3e',
  size: { w: 460, h: 280 },
  min: { w: 180, h: 110 },
  data: () => ({ html: '', size: 36, align: 'left' }),

  mount({ body, tools, data, save, signal }) {
    const edit = el('div', {
      class: 'x-text', contenteditable: 'true', spellcheck: 'true', lang: 'de',
      'data-placeholder': 'Hier tippen …', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Text',
    });
    edit.innerHTML = data.html;
    body.append(edit);

    function applyStyle() {
      edit.style.setProperty('--fs', data.size + 'px');
      edit.style.textAlign = data.align;
      alignBtn.innerHTML = icon(data.align === 'center' ? 'alignCenter' : 'alignLeft');
    }

    const sizeBtn = (label, factor, title) => el('button', {
      class: 'w-btn', text: label, title, 'aria-label': title,
      onclick: () => { data.size = Math.round(clamp(data.size * factor, 14, 220)); applyStyle(); save(); },
    });
    const alignBtn = el('button', {
      class: 'w-btn', title: 'Ausrichtung', 'aria-label': 'Ausrichtung wechseln',
      onclick: () => { data.align = data.align === 'center' ? 'left' : 'center'; applyStyle(); save(); },
    });
    // Symbol an der zuletzt bekannten Cursorposition einfügen
    let savedRange = null;
    document.addEventListener('selectionchange', () => {
      const sel = document.getSelection();
      if (sel.rangeCount && edit.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
    }, { signal });
    const emojiBtn = el('button', {
      class: 'w-btn', title: 'Symbol einfügen', 'aria-label': 'Symbol einfügen', html: icon('smile'),
      onclick: () => openEmojiPicker(emojiBtn, sym => {
        edit.focus();
        const sel = document.getSelection();
        sel.removeAllRanges();
        if (savedRange) sel.addRange(savedRange);
        else { const r = document.createRange(); r.selectNodeContents(edit); r.collapse(false); sel.addRange(r); }
        document.execCommand('insertText', false, sym);
      }),
    });

    tools.append(emojiBtn, sizeBtn('A−', 1 / 1.2, 'Schrift kleiner'), sizeBtn('A+', 1.2, 'Schrift größer'), alignBtn);

    edit.addEventListener('input', () => {
      if (edit.innerHTML === '<br>') edit.innerHTML = ''; // Platzhalter wieder zeigen
      data.html = edit.innerHTML;
      save();
    });

    // Nur reinen Text übernehmen (keine fremden Formatierungen aus Word & Co.)
    const insertPlain = text => { if (text) document.execCommand('insertText', false, text); };
    edit.addEventListener('paste', e => { e.preventDefault(); insertPlain(e.clipboardData.getData('text/plain')); });
    edit.addEventListener('drop', e => { e.preventDefault(); insertPlain(e.dataTransfer.getData('text/plain')); });

    applyStyle();
    if (!data.html) setTimeout(() => edit.focus(), 50);
  },
});
