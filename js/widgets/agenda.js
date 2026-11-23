'use strict';

/* Agenda: Stundenablauf als Liste – zum Abhaken, schlicht oder nummeriert,
   jeder Punkt optional mit Emoji/Symbol. */

const AGENDA_MODES = [
  { id: 'check',    label: 'Abhaken',    icon: 'check' },
  { id: 'list',     label: 'Liste',      icon: 'list' },
  { id: 'numbered', label: 'Nummeriert', text: '1.' },
];

registerWidget('agenda', {
  name: 'Agenda',
  icon: 'list',
  accent: '#0b7a85',
  size: { w: 420, h: 430 },
  min: { w: 220, h: 170 },
  duplicable: true,
  data: () => ({
    heading: '',
    mode: 'check',
    size: 26,
    highlight: true,
    fresh: true,
    items: [
      { id: uid(), emoji: '👋', text: 'Begrüßung', done: false },
      { id: uid(), emoji: '🔁', text: 'Wiederholung', done: false },
      { id: uid(), emoji: '✏️', text: 'Arbeitsphase', done: false },
      { id: uid(), emoji: '🗣️', text: 'Besprechung', done: false },
    ],
  }),

  mount({ node, body, tools, data, save, signal }) {
    let editing = false;
    const view = el('div', { class: 'ag-view' });
    body.append(view);

    /* ---------- Kopfzeile ---------- */
    const resetBtn = el('button', {
      class: 'w-btn', title: 'Alle Haken entfernen', 'aria-label': 'Alle Haken entfernen', html: icon('reset'),
      onclick: () => { data.items.forEach(it => { it.done = false; }); save(); render(); },
    });
    const sizeBtn = (label, factor, title) => el('button', {
      class: 'w-btn ag-size', text: label, title, 'aria-label': title,
      onclick: () => { data.size = Math.round(clamp(data.size * factor, 14, 120)); save(); render(); },
    });
    const editBtn = el('button', {
      class: 'w-btn', title: 'Bearbeiten', 'aria-label': 'Agenda bearbeiten', html: icon('pencil'),
      onclick: () => setEditing(!editing),
    });
    tools.append(resetBtn, sizeBtn('A−', 1 / 1.15, 'Schrift kleiner'), sizeBtn('A+', 1.15, 'Schrift größer'), editBtn);
    settingsMenu({ tools, signal }, [
      { label: 'Nächsten offenen Punkt hervorheben', get: () => data.highlight, set: v => { data.highlight = v; save(); render(); } },
    ]);

    function setEditing(on) {
      editing = on;
      if (!on) {
        data.items = data.items.filter(it => it.text.trim() || it.emoji);
        save();
      }
      node.classList.toggle('is-editing', on);
      editBtn.setAttribute('aria-pressed', String(on));
      render();
    }

    function render(focus) {
      resetBtn.hidden = editing || data.mode !== 'check';
      tools.querySelectorAll('.ag-size').forEach(b => { b.hidden = editing; });
      if (editing) renderEditor(focus); else renderList();
    }

    /* ---------- Ansicht für die Klasse ---------- */
    function renderList() {
      view.className = 'ag-view';
      view.style.setProperty('--fs', data.size + 'px');
      const parts = [];
      if (data.heading.trim()) parts.push(el('h3', { class: 'ag-heading', text: data.heading }));

      if (!data.items.length) {
        parts.push(el('p', { class: 'ag-empty', text: 'Noch keine Punkte. Über den Stift oben rechts hinzufügen.' }));
        view.replaceChildren(...parts);
        return;
      }

      const check = data.mode === 'check';
      const list = el(data.mode === 'numbered' ? 'ol' : 'ul', { class: `ag-list mode-${data.mode}` });
      const current = check && data.highlight ? data.items.find(it => !it.done) : null;

      data.items.forEach((it, i) => {
        let marker = null;
        if (check) marker = el('span', { class: 'ag-check', html: it.done ? icon('check') : '' });
        else if (data.mode === 'numbered') marker = el('span', { class: 'ag-num', text: String(i + 1) });
        else if (!it.emoji) marker = el('span', { class: 'ag-bullet' });

        const li = el('li', { class: 'ag-item' + (check && it.done ? ' done' : '') + (it === current ? ' current' : '') }, [
          marker,
          it.emoji ? el('span', { class: 'ag-emoji', text: it.emoji }) : null,
          el('span', { class: 'ag-text', text: it.text }),
        ]);
        if (check) {
          li.tabIndex = 0;
          li.setAttribute('role', 'checkbox');
          li.setAttribute('aria-checked', String(it.done));
          const toggle = refocus => {
            it.done = !it.done;
            save();
            render();
            if (refocus) view.querySelectorAll('.ag-item')[i]?.focus();
          };
          li.addEventListener('click', () => toggle(false));
          li.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(true); } });
        }
        list.append(li);
      });
      parts.push(list);
      view.replaceChildren(...parts);
    }

    /* ---------- Bearbeiten ---------- */
    function newItem() { return { id: uid(), emoji: '', text: '', done: false }; }

    function renderEditor(focus) {
      view.className = 'ag-edit';
      view.style.removeProperty('--fs');

      const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Art der Agenda' },
        AGENDA_MODES.map(m => el('button', {
          class: 'seg-btn', type: 'button', role: 'radio', 'aria-checked': String(data.mode === m.id), title: m.label,
          html: (m.icon ? icon(m.icon) : `<b class="seg-num">${m.text}</b>`) + `<span>${m.label}</span>`,
          onclick: () => { data.mode = m.id; save(); render(); },
        })));

      const heading = el('input', { class: 'field', type: 'text', value: data.heading, placeholder: 'Überschrift (optional), z. B. Mathe – Mittwoch', 'aria-label': 'Überschrift' });
      heading.addEventListener('input', () => { data.heading = heading.value; save(); });

      const rows = el('div', { class: 'ag-rows' }, data.items.map((it, i) => editorRow(it, i)));
      const add = el('button', {
        class: 'btn ag-add', type: 'button', html: icon('plus') + '<span>Punkt hinzufügen</span>',
        onclick: () => { const it = newItem(); data.items.push(it); save(); render({ id: it.id }); },
      });
      const done = el('button', { class: 'btn btn-primary', type: 'button', html: icon('check') + '<span>Fertig</span>', onclick: () => setEditing(false) });

      view.replaceChildren(seg, heading, rows, el('div', { class: 'ag-edit-foot' }, [add, done]));

      if (focus) {
        const input = view.querySelector(`[data-id="${focus.id}"]`);
        if (input) {
          input.focus();
          const pos = focus.caret === 'start' ? 0 : input.value.length;
          input.setSelectionRange(pos, pos);
        }
      }
    }

    function editorRow(it, i) {
      const emojiBtn = el('button', {
        class: 'ag-emoji-btn' + (it.emoji ? ' has' : ''), type: 'button', title: 'Symbol wählen', 'aria-label': 'Symbol wählen',
        html: it.emoji ? null : icon('smile'), text: it.emoji || null,
        onclick: () => openEmojiPicker(emojiBtn, sym => { it.emoji = sym; save(); render({ id: it.id }); }, { allowNone: true }),
      });

      const input = el('input', { class: 'field', type: 'text', value: it.text, placeholder: `Punkt ${i + 1}`, 'data-id': it.id, 'aria-label': `Punkt ${i + 1}` });
      input.addEventListener('input', () => { it.text = input.value; save(); });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const next = newItem();
          data.items.splice(i + 1, 0, next);
          save();
          render({ id: next.id });
        } else if (e.key === 'Backspace' && !input.value && !it.emoji && data.items.length > 1) {
          e.preventDefault();
          data.items.splice(i, 1);
          save();
          render({ id: data.items[Math.max(0, i - 1)].id });
        } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          move(i, e.key === 'ArrowUp' ? -1 : 1);
        }
      });

      const mini = (name, label, onclick, disabled, extra = '') => el('button', {
        class: 'mini-btn ' + extra, type: 'button', title: label, 'aria-label': label, html: icon(name), onclick, disabled,
      });

      return el('div', { class: 'ag-row' }, [
        emojiBtn,
        input,
        mini('up', 'Nach oben', () => move(i, -1), i === 0, 'move'),
        mini('down', 'Nach unten', () => move(i, 1), i === data.items.length - 1, 'move'),
        mini('trash', 'Punkt löschen', () => { data.items.splice(i, 1); save(); render(); }, false, 'del'),
      ]);
    }

    function move(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= data.items.length) return;
      [data.items[i], data.items[j]] = [data.items[j], data.items[i]];
      save();
      render({ id: data.items[j].id });
    }

    // Neu hinzugefügt? Dann gleich im Bearbeiten-Modus starten.
    if (data.fresh) {
      data.fresh = false;
      save();
      setEditing(true);
    } else {
      render();
    }
  },
});
