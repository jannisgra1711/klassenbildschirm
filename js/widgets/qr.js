'use strict';

/* QR-Code: Link oder Text eingeben, Schüler*innen scannen mit dem Handy/Tablet. */

// Umlaute & Co. korrekt als UTF-8 kodieren
if (typeof qrcode === 'function') {
  qrcode.stringToBytes = s => Array.from(new TextEncoder().encode(s));
}

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), q = 2, size = n + 2 * q;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  }
  return `<svg viewBox="${-q} ${-q} ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR-Code">` +
    `<rect x="${-q}" y="${-q}" width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** "https://www.beispiel.de/" → "beispiel.de" */
function prettyLink(text) {
  return text.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

registerWidget('qr', {
  name: 'QR-Code',
  icon: 'qr',
  accent: '#3d4451',
  size: { w: 320, h: 390 },
  min: { w: 190, h: 200 },
  data: () => ({ text: '', caption: true }),

  mount({ body, tools, data, save, signal }) {
    const view = el('div', { class: 'qr-view' });
    body.append(view);

    function showForm(focus) {
      const input = el('input', {
        class: 'field', type: 'text', id: 'qr-' + uid(), value: data.text,
        placeholder: 'https://…', autocomplete: 'off', spellcheck: 'false',
      });
      const form = el('form', { class: 'qr-form' }, [
        el('label', { for: input.id, text: 'Link oder Text für den QR-Code' }),
        input,
        el('button', { class: 'btn btn-primary', type: 'submit', html: icon('qr') + '<span>Erzeugen</span>' }),
      ]);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        data.text = text;
        save();
        showCode();
      });
      view.replaceChildren(form);
      if (focus) setTimeout(() => input.focus(), 50);
    }

    function showCode() {
      if (typeof qrcode !== 'function') {
        view.replaceChildren(el('p', { class: 'w-note', text: 'QR-Codes brauchen beim ersten Laden eine Internetverbindung. Bitte Seite neu laden, sobald du online bist.' }));
        return;
      }
      let svg;
      try { svg = qrSvg(data.text); } catch {
        toast('Der Text ist zu lang für einen QR-Code.');
        showForm(true);
        return;
      }
      const parts = [el('div', { class: 'qr-box', html: svg })];
      if (data.caption) parts.push(el('div', { class: 'qr-caption', text: prettyLink(data.text), title: data.text }));
      view.replaceChildren(...parts);
    }

    tools.append(el('button', {
      class: 'w-btn', title: 'Link ändern', 'aria-label': 'Link ändern', html: icon('pencil'),
      onclick: () => showForm(true),
    }));
    settingsMenu({ tools, signal }, [
      { label: 'Link unter dem Code zeigen', get: () => data.caption, set: v => { data.caption = v; save(); if (data.text) showCode(); } },
    ]);

    if (data.text) showCode(); else showForm(true);
  },
});
