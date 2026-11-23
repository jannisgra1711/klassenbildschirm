'use strict';

/* =====================================================================
   Sichern & Laden: Stunden samt Bildern als eine Datei.
   Damit wandern vorbereitete Stunden zwischen Schule und Zuhause –
   und nichts geht verloren, wenn ein Schulrechner beim Abmelden den
   Browser-Speicher löscht.
   Version 1 (ältere Dateien): nur eine Folge von Bildschirmen.
   Version 2: mehrere Stunden.
   ===================================================================== */

const BACKUP_APP = 'klassenbildschirm';
const BACKUP_VERSION = 2;

/** Alle Bild-IDs, die ein Zustand (oder eine Liste von Stunden) verwendet. */
function backupImageIds(state, lessons = state.lessons) {
  const ids = new Set();
  if (state.background?.kind === 'image' && state.background.imageId) ids.add(state.background.imageId);
  for (const l of lessons) for (const screen of l.screens) for (const w of screen.widgets) if (w.data?.imageId) ids.add(w.data.imageId);
  return ids;
}

const blobToDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

async function dataUrlToBlob(url) {
  if (!/^data:image\/(png|jpeg|gif|webp|svg\+xml|bmp);base64,/i.test(url)) throw new Error('Kein Bild');
  return (await fetch(url)).blob();
}

/** Dateiname-tauglich: „Mathe 7b – Brüche“ → „mathe-7b-brueche“ */
function slug(text) {
  return String(text || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/**
 * Lädt eine Sicherungsdatei herunter.
 * opts.lessons: nur diese Stunden (Standard: alle), opts.label: Teil des Dateinamens.
 */
async function exportBackup(state, { lessons = state.lessons, label = '' } = {}) {
  const onlySome = lessons !== state.lessons;
  const images = {};
  const ids = backupImageIds(onlySome ? { background: null } : state, lessons);
  for (const id of ids) {
    const blob = await ImageDB.get(id).catch(() => null);
    if (blob) images[id] = await blobToDataUrl(blob);
  }
  const payload = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state: {
      lessons,
      // Einzelne Stunden nehmen keine persönlichen Einstellungen mit
      ...(onlySome ? {} : { background: state.background, effects: !!state.effects, collabLinks: state.collabLinks || [] }),
    },
    images,
  };
  const d = new Date();
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const name = `klassenbildschirm-${slug(label) || 'alle-stunden'}-${date}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { name, lessons: lessons.length, images: Object.keys(images).length };
}

/** Liest und prüft eine Sicherungsdatei. Wirft verständliche Fehler. */
async function readBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Die Datei konnte nicht gelesen werden.'); }
  if (data?.app !== BACKUP_APP || !data.state || typeof data.state !== 'object') {
    throw new Error('Das ist keine Sicherung des Klassenbildschirms.');
  }
  if ((data.version | 0) > BACKUP_VERSION) throw new Error('Diese Sicherung stammt aus einer neueren Version.');
  // Version 1: eine Folge von Bildschirmen → eine Stunde
  if (!Array.isArray(data.state.lessons)) {
    if (!Array.isArray(data.state.screens)) throw new Error('Das ist keine Sicherung des Klassenbildschirms.');
    data.state.lessons = [{ name: 'Gesicherte Stunde', screens: data.state.screens }];
  }
  if (!data.state.lessons.length) throw new Error('Diese Sicherung enthält keine Stunden.');
  return data;
}

const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * Baut aus einer Sicherung die Änderungen am Zustand.
 * mode 'add' = Stunden anhängen, 'replace' = alles ersetzen.
 * Bilder landen mit neuen IDs im Speicher; alle IDs werden neu vergeben.
 * Ergebnis: { state: {...Teilzustand}, newImages: [...], added: Anzahl }
 */
async function stateFromBackup(data, state, mode) {
  const idMap = {};
  for (const [oldId, url] of Object.entries(data.images || {})) {
    try { idMap[oldId] = await ImageDB.put(await dataUrlToBlob(url)); } catch { /* defektes Bild überspringen */ }
  }
  const remap = id => (id && idMap[id]) || null;
  const now = Date.now();

  const lessons = data.state.lessons.map((l, li) => ({
    id: uid(),
    name: String(l?.name || `Stunde ${li + 1}`).slice(0, 80),
    current: 0,
    created: now,
    updated: now,
    screens: (Array.isArray(l?.screens) ? l.screens : []).map((s, i) => ({
      id: uid(),
      name: String(s?.name || `Bildschirm ${i + 1}`).slice(0, 80),
      widgets: (Array.isArray(s?.widgets) ? s.widgets : [])
        .filter(w => w && typeof w.type === 'string' && Widgets[w.type])
        .map(w => {
          const d = (w.data && typeof w.data === 'object') ? { ...w.data } : {};
          if ('imageId' in d) d.imageId = remap(d.imageId);
          return {
            id: uid(), type: w.type, data: d,
            x: num(w.x, 40), y: num(w.y, 40), w: num(w.w, 300), h: num(w.h, 200), z: num(w.z, 1),
          };
        }),
    })),
  }));

  const newImages = Object.values(idMap);
  if (mode === 'add') {
    return { state: { lessons: [...state.lessons, ...lessons] }, newImages, added: lessons.length };
  }
  let background = data.state.background && typeof data.state.background === 'object' ? { ...data.state.background } : state.background;
  if (background?.kind === 'image') {
    background = { ...background, imageId: remap(background.imageId) };
    if (!background.imageId) background = { kind: 'auto' };
  }
  return {
    state: {
      lessons,
      lastLesson: lessons[0]?.id || null,
      background: background || { kind: 'auto' },
      effects: 'effects' in data.state ? !!data.state.effects : state.effects,
      collabLinks: Array.isArray(data.state.collabLinks) ? data.state.collabLinks : state.collabLinks,
    },
    newImages,
    added: lessons.length,
  };
}
