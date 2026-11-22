'use strict';

/* Bild: per Auswahl, Ziehen & Ablegen oder Strg+V. Bilder bleiben im Browser. */
registerWidget('image', {
  name: 'Bild',
  icon: 'image',
  accent: '#c2410c',
  size: { w: 480, h: 360 },
  min: { w: 160, h: 120 },
  data: () => ({ imageId: null, fit: 'contain' }),

  mount({ node, body, tools, data, save, signal }) {
    const view = el('div', { class: 'img-view' });
    body.append(view);
    let objectUrl = null;

    async function show() {
      const blob = data.imageId ? await ImageDB.get(data.imageId).catch(() => null) : null;
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        const img = el('img', { src: objectUrl, alt: '', draggable: 'false' });
        img.style.objectFit = data.fit;
        view.replaceChildren(img);
      } else {
        view.replaceChildren(el('div', { class: 'drop' }, [
          el('div', { class: 'drop-icon', html: icon('image') }),
          el('p', { text: 'Bild hierher ziehen oder mit Strg+V einfügen' }),
          el('button', { class: 'btn btn-primary', html: icon('upload') + '<span>Bild auswählen</span>', onclick: choose }),
        ]));
      }
      node.classList.toggle('is-empty', !blob);
    }

    async function useFile(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) { toast('Das ist keine Bilddatei.'); return; }
      try {
        const id = await ImageDB.put(await shrinkImage(file, 2000));
        if (data.imageId) ImageDB.del(data.imageId).catch(() => {});
        data.imageId = id;
        save();
        show();
      } catch (err) {
        console.error(err);
        toast('Das Bild konnte nicht gespeichert werden.');
      }
    }

    async function choose() { useFile(await pickFile('image/*')); }

    view.addEventListener('dragover', e => { e.preventDefault(); view.classList.add('drag'); }, { signal });
    view.addEventListener('dragleave', () => view.classList.remove('drag'), { signal });
    view.addEventListener('drop', e => {
      e.preventDefault();
      view.classList.remove('drag');
      useFile(e.dataTransfer.files[0]);
    }, { signal });

    tools.append(el('button', { class: 'w-btn', title: 'Anderes Bild', 'aria-label': 'Anderes Bild wählen', html: icon('upload'), onclick: choose }));
    settingsMenu({ tools, signal }, [
      {
        label: 'Fläche ganz ausfüllen', get: () => data.fit === 'cover',
        set: v => {
          data.fit = v ? 'cover' : 'contain';
          save();
          const img = view.querySelector('img');
          if (img) img.style.objectFit = data.fit;
        },
      },
    ]);

    show();
    return {
      useFile,
      destroy() { if (objectUrl) URL.revokeObjectURL(objectUrl); },
    };
  },

  onRemove(data) {
    if (data.imageId) ImageDB.del(data.imageId).catch(() => {});
  },
});
