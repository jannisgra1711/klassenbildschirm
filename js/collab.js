'use strict';

/* =====================================================================
   Menü „Zusammenarbeit“: bewährte Werkzeuge für gemeinsames Arbeiten,
   eigene Links (z. B. Schul-Cloud, Moodle) und „Für die Klasse
   anzeigen“ → großer QR-Code mit Überschrift.
   Hinweis: Vor dem Einsatz die Datenschutzvorgaben der Schule prüfen.
   ===================================================================== */

const COLLAB_CATEGORIES = [
  {
    name: 'Gemeinsam schreiben', label: 'Dokument', icon: 'doc', tools: [
      { name: 'ZUMPad', url: 'https://zumpad.zum.de/', hint: 'Gemeinsam Texte schreiben (Etherpad der ZUM), ohne Anmeldung' },
      { name: 'CryptPad Dokument', url: 'https://cryptpad.fr/pad/', hint: 'Verschlüsselter Texteditor, ohne Anmeldung nutzbar' },
    ],
  },
  {
    name: 'Pinnwand', label: 'Pinnwand', icon: 'pin', tools: [
      { name: 'TaskCards', url: 'https://www.taskcards.de/', hint: 'Digitale Pinnwand aus Deutschland' },
      { name: 'Padlet', url: 'https://padlet.com/', hint: 'Digitale Pinnwand' },
      { name: 'CryptPad Kanban', url: 'https://cryptpad.fr/kanban/', hint: 'Board mit Spalten, verschlüsselt' },
      { name: 'Flinga', url: 'https://flinga.fi/', hint: 'Pinnwand und Whiteboard' },
    ],
  },
  {
    name: 'Whiteboard', label: 'Whiteboard', icon: 'board', tools: [
      { name: 'Excalidraw', url: 'https://excalidraw.com/', hint: 'Zeichenfläche; über „Live-Zusammenarbeit“ entsteht ein Link' },
      { name: 'CryptPad Whiteboard', url: 'https://cryptpad.fr/whiteboard/', hint: 'Gemeinsames Zeichenbrett, verschlüsselt' },
    ],
  },
  {
    name: 'Brainstorming', label: 'Brainstorming', icon: 'bulb', tools: [
      { name: 'Oncoo', url: 'https://www.oncoo.de/', hint: 'Kartenabfrage, Placemat und weitere kooperative Methoden' },
    ],
  },
  {
    name: 'Umfrage & Feedback', label: 'Umfrage', icon: 'chart', tools: [
      { name: 'Tweedback', url: 'https://tweedback.de/', hint: 'Live-Feedback und Fragen' },
      { name: 'Particify', url: 'https://www.particify.de/', hint: 'Umfragen und Fragen im Unterricht' },
      { name: 'Mentimeter', url: 'https://www.mentimeter.com/', hint: 'Umfragen und Wortwolken' },
      { name: 'CryptPad Formular', url: 'https://cryptpad.fr/form/', hint: 'Formular oder Umfrage, verschlüsselt' },
    ],
  },
  {
    name: 'Quiz & Übungen', label: 'Quiz', icon: 'star', tools: [
      { name: 'LearningApps', url: 'https://learningapps.org/', hint: 'Interaktive Übungen' },
      { name: 'Kahoot!', url: 'https://kahoot.com/', hint: 'Quiz-Spiel für die ganze Klasse' },
    ],
  },
];

/** "taskcards.de/board/x" → "https://taskcards.de/board/x"; leer/ungültig → '' */
function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  if (/^[^\s/]+\.[^\s/]{2,}/.test(s)) return 'https://' + s;
  return s; // reiner Text ist für QR-Codes auch erlaubt
}

/**
 * Baut den Inhalt des Menüs.
 * opts = { state, save, addWidget(type, data), close() }
 */
function buildCollabPanel(panel, { state, save, addWidget, close }) {
  if (!Array.isArray(state.collabLinks)) state.collabLinks = [];

  /* --- „Für die Klasse anzeigen“ --- */
  const linkInput = el('input', { class: 'field', type: 'text', id: 'collab-link', placeholder: 'Link einfügen (Strg+V)', autocomplete: 'off', spellcheck: 'false' });
  const titleInput = el('input', { class: 'field', type: 'text', id: 'collab-title', placeholder: 'Überschrift, z. B. Pinnwand', autocomplete: 'off' });
  const shareForm = el('form', { class: 'collab-share' }, [
    el('h3', { text: 'Für die Klasse anzeigen' }),
    el('div', { class: 'collab-share-row' }, [
      el('label', { class: 'sr-only', for: 'collab-link', text: 'Link' }), linkInput,
      el('label', { class: 'sr-only', for: 'collab-title', text: 'Überschrift' }), titleInput,
    ]),
    el('button', { class: 'btn btn-primary', type: 'submit', html: icon('qr') + '<span>Als QR-Code anzeigen</span>' }),
  ]);
  shareForm.addEventListener('submit', e => {
    e.preventDefault();
    const url = normalizeUrl(linkInput.value);
    if (!url) { linkInput.focus(); toast('Bitte zuerst den Teilen-Link einfügen.'); return; }
    addWidget('qr', { text: url, title: titleInput.value.trim() });
    linkInput.value = '';
    titleInput.value = '';
    close();
  });

  function showForClass(url, title) {
    addWidget('qr', { text: url, title });
    close();
  }

  /* --- Werkzeug-Kategorien --- */
  const cats = el('div', { class: 'collab-cats' }, COLLAB_CATEGORIES.map(cat =>
    el('div', { class: 'collab-cat' }, [
      el('div', { class: 'collab-cat-name', html: icon(cat.icon) + `<span>${cat.name}</span>` }),
      el('div', { class: 'collab-tools' }, cat.tools.map(tool => el('a', {
        class: 'tool-link', href: tool.url, target: '_blank', rel: 'noopener noreferrer', title: tool.hint,
        html: `<span>${tool.name}</span>` + icon('external'),
        onclick: () => { if (!titleInput.value) titleInput.value = cat.label; },
      }))),
    ])));

  /* --- Eigene Links --- */
  const ownTools = el('div', { class: 'collab-tools' });
  const ownForm = el('form', { class: 'collab-own-form', hidden: true });
  const ownName = el('input', { class: 'field', type: 'text', placeholder: 'Name, z. B. Schul-Cloud', 'aria-label': 'Name des Links', autocomplete: 'off' });
  const ownUrl = el('input', { class: 'field', type: 'text', placeholder: 'https://…', 'aria-label': 'Adresse', autocomplete: 'off', spellcheck: 'false' });
  ownForm.append(ownName, ownUrl, el('button', { class: 'btn', type: 'submit', text: 'Speichern' }));
  ownForm.addEventListener('submit', e => {
    e.preventDefault();
    const url = normalizeUrl(ownUrl.value);
    if (!/^https?:\/\//i.test(url)) { ownUrl.focus(); toast('Bitte eine Webadresse eingeben, z. B. https://…'); return; }
    const name = ownName.value.trim() || url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0];
    state.collabLinks.push({ id: uid(), name, url });
    save();
    ownName.value = ''; ownUrl.value = '';
    ownForm.hidden = true;
    renderOwn();
  });

  function renderOwn() {
    ownTools.replaceChildren(
      ...state.collabLinks.map(link => el('span', { class: 'own-link' }, [
        (() => {
          const a = el('a', { class: 'tool-link', href: link.url, target: '_blank', rel: 'noopener noreferrer', title: link.url, html: icon('external') });
          a.prepend(el('span', { text: link.name }));
          return a;
        })(),
        el('button', { class: 'mini-btn', type: 'button', title: 'Für die Klasse als QR-Code anzeigen', 'aria-label': `${link.name} als QR-Code anzeigen`, html: icon('qr'), onclick: () => showForClass(link.url, link.name) }),
        el('button', {
          class: 'mini-btn del', type: 'button', title: 'Link entfernen', 'aria-label': `${link.name} entfernen`, html: icon('x'),
          onclick: () => { state.collabLinks = state.collabLinks.filter(l => l !== link); save(); renderOwn(); },
        }),
      ])),
      el('button', {
        class: 'tool-link add', type: 'button', html: icon('plus') + '<span>Eigener Link</span>',
        onclick: () => { ownForm.hidden = !ownForm.hidden; if (!ownForm.hidden) ownName.focus(); },
      }),
    );
  }
  renderOwn();

  panel.replaceChildren(
    el('div', { class: 'collab-head' }, [
      el('h2', { text: 'Zusammenarbeit' }),
      el('ol', { class: 'collab-steps' }, [
        el('li', { text: 'Werkzeug öffnen und dort z. B. eine Pinnwand anlegen' }),
        el('li', { text: 'Den Teilen-Link kopieren' }),
        el('li', { text: 'Unten einfügen: Die Klasse scannt den QR-Code' }),
      ]),
    ]),
    cats,
    el('div', { class: 'collab-cat' }, [
      el('div', { class: 'collab-cat-name', html: icon('link') + '<span>Eigene Links</span>' }),
      el('div', {}, [ownTools, ownForm]),
    ]),
    shareForm,
    el('p', { class: 'collab-note', text: 'Externe Angebote: Bitte vor dem Einsatz die Datenschutzvorgaben deiner Schule prüfen.' }),
  );
}
