'use strict';

/* Text: Arbeitsaufträge, Notizen, Hausaufgaben – direkt eintippen. */
registerWidget('text', {
  name: 'Text',
  icon: 'text',
  accent: '#2b8a3e',
  size: { w: 460, h: 280 },
  min: { w: 180, h: 110 },
  data: () => ({ html: '', size: 36, align: 'left' }),

  mount({ body, tools, data, save }) {
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
    tools.append(sizeBtn('A−', 1 / 1.2, 'Schrift kleiner'), sizeBtn('A+', 1.2, 'Schrift größer'), alignBtn);

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
