'use strict';

/* =====================================================================
   Sichern & Laden: alle Bildschirme samt Bildern als eine Datei.
   Damit wandern vorbereitete Stunden zwischen Schule und Zuhause –
   und nichts geht verloren, wenn ein Schulrechner beim Abmelden den
   Browser-Speicher löscht.
   ===================================================================== */

const BACKUP_APP = 'klassenbildschirm';
const BACKUP_VERSION = 1;

function backupImageIds(state) {
  const ids = new Set();
  if (state.background?.kind === 'image' && state.background.imageId) ids.add(state.background.imageId);
  for (const screen of state.screens) for (const w of screen.widgets) if (w.data?.imageId) ids.add(w.data.imageId);
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

/** Lädt eine Sicherungsdatei herunter. */
async function exportBackup(state) {
  const images = {};
  for (const id of backupImageIds(state)) {
    const blob = await ImageDB.get(id).catch(() => null);
    if (blob) images[id] = await blobToDataUrl(blob);
  }
  const payload = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state: {
      screens: state.screens,
      background: state.background,
      effects: !!state.effects,
      collabLinks: state.collabLinks || [],
    },
    images,
  };
  const d = new Date();
  const name = `klassenbildschirm-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { name, screens: state.screens.length, images: Object.keys(images).length };
}

/** Liest und prüft eine Sicherungsdatei. Wirft verständliche Fehler. */
async function readBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Die Datei konnte nicht gelesen werden.'); }
  if (data?.app !== BACKUP_APP || !Array.isArray(data.state?.screens)) {
    throw new Error('Das ist keine Sicherung des Klassenbildschirms.');
  }
  if ((data.version | 0) > BACKUP_VERSION) throw new Error('Diese Sicherung stammt aus einer neueren Version.');
  return data;
}

const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * Baut aus einer Sicherung den neuen Zustand.
 * mode 'add' = Bildschirme anhängen, 'replace' = alles ersetzen.
 * Bilder landen mit neuen IDs im Speicher; alle IDs werden neu vergeben.
 */
async function stateFromBackup(data, state, mode) {
  const idMap = {};
  for (const [oldId, url] of Object.entries(data.images || {})) {
    try { idMap[oldId] = await ImageDB.put(await dataUrlToBlob(url)); } catch { /* defektes Bild überspringen */ }
  }
  const remap = id => (id && idMap[id]) || null;

  const screens = data.state.screens.map((s, i) => ({
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
  }));
  if (!screens.length) screens.push({ id: uid(), name: 'Bildschirm 1', widgets: [] });

  if (mode === 'add') {
    return { ...state, screens: [...state.screens, ...screens], current: state.screens.length, _newImages: Object.values(idMap) };
  }
  let background = data.state.background && typeof data.state.background === 'object' ? { ...data.state.background } : { kind: 'auto' };
  if (background.kind === 'image') {
    background.imageId = remap(background.imageId);
    if (!background.imageId) background = { kind: 'auto' };
  }
  return {
    screens,
    background,
    effects: !!data.state.effects,
    collabLinks: Array.isArray(data.state.collabLinks) ? data.state.collabLinks : [],
    current: 0,
    _newImages: Object.values(idMap),
  };
}
