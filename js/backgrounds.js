'use strict';

/* =====================================================================
   Hintergründe: selbst gezeichnete SVG-Illustrationen (offline, scharf
   auf jedem Beamer), Jahreszeit-Automatik und optionale Effekte.
   ===================================================================== */

/** Kleiner, reproduzierbarer Zufallsgenerator → Bilder sehen immer gleich aus. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = n => Math.round(n * 10) / 10;

/** Vollbild-Illustration (1600×900, wird wie „cover“ zugeschnitten). */
function svgScene(inner, fallback) {
  return {
    svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900' preserveAspectRatio='xMidYMid slice'>${inner}</svg>`,
    fallback,
  };
}

/* ---------- SVG → Bild umrechnen ----------
   Der Browser zeichnet aufwendige SVG-Hintergründe bei jedem Neuzeichnen
   neu (langsam). Einmal in ein Bild passender Größe umgerechnet, sind sie
   schnell. Ergebnisse werden zwischengespeichert. */
const rasterCache = new Map();

function rasterize(key, svg, w, h, type = 'image/jpeg') {
  if (rasterCache.has(key)) return rasterCache.get(key);
  const job = (async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg.replace('<svg ', `<svg width='${w}' height='${h}' `));
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.92));
    if (!blob) throw new Error('toBlob');
    return URL.createObjectURL(blob);
  })().catch(() => 'data:image/svg+xml,' + encodeURIComponent(svg)); // Notlösung: direkt als SVG
  rasterCache.set(key, job);
  // Speicher begrenzen: älteste Einträge freigeben
  while (rasterCache.size > 40) {
    const [oldKey, oldJob] = rasterCache.entries().next().value;
    rasterCache.delete(oldKey);
    oldJob.then(url => url.startsWith('blob:') && URL.revokeObjectURL(url));
  }
  return job;
}

/**
 * CSS-Hintergrund für eine Vorlage in der Größe w×h (Bildschirmpixel).
 * thumb = true → kleines Kachelmuster für die Vorschau.
 */
async function presetCss(p, w, h, thumb = false) {
  if (p.scene) {
    const { svg, fallback } = p.scene();
    const url = await rasterize(`${p.id}@${w}x${h}`, svg, w, h);
    return `center / cover no-repeat url("${url}"), ${fallback}`;
  }
  if (p.tile) {
    const px = thumb ? 130 : p.tileSize;
    const scale = Math.min(2, Math.ceil(window.devicePixelRatio || 1));
    const url = await rasterize(`${p.id}@tile${px * scale}`, p.tile(), px * scale, px * scale, 'image/png');
    return `url("${url}") 0 0 / ${px}px ${px}px repeat, ${p.color}`;
  }
  return p.css();
}

/** Schnelle Ersatzfarbe, solange das Bild noch berechnet wird. */
const presetFallback = p => p.scene ? p.scene().fallback : p.tile ? p.color : p.css();

/* ---------- wiederverwendbare Bausteine ---------- */
const PART = {
  cloud: `<g id='cloud'><ellipse rx='92' ry='36'/><ellipse cx='-56' cy='8' rx='58' ry='28'/><ellipse cx='58' cy='8' rx='64' ry='27'/><ellipse cx='8' cy='-24' rx='56' ry='38'/></g>`,
  flower: `<g id='fl'>${[0, 72, 144, 216, 288].map(a => `<ellipse rx='7' ry='12' cy='-11' transform='rotate(${a})'/>`).join('')}<circle r='5.5' fill='#ffb703'/></g>`,
};

function fir(x, y, s, { color = '#2e5e4e', snow = true, lights = null, star = false, seed = 1 } = {}) {
  let out = `<g transform='translate(${r1(x)} ${r1(y)}) scale(${s})'>` +
    `<rect x='-8' y='8' width='16' height='28' fill='#5b4636'/>` +
    `<path d='M0 -190L46 -112H-46Z M0 -146L66 -54H-66Z M0 -100L88 10H-88Z' fill='${color}'/>`;
  if (snow) {
    out += `<path d='M-46 -112Q-23 -124 0 -114Q23 -124 46 -112 M-66 -54Q-33 -68 0 -56Q33 -68 66 -54 M-88 10Q-44 -6 0 8Q44 -6 88 10' stroke='#fff' stroke-width='8' fill='none' stroke-linecap='round'/>`;
  }
  if (lights) {
    const r = rng(seed);
    for (let i = 0; i < 16; i++) {
      const yy = -170 + r() * 170;
      const half = (yy + 190) * 0.42;
      out += `<circle cx='${r1((r() * 2 - 1) * half)}' cy='${r1(yy)}' r='4.5' fill='${lights[i % lights.length]}'/>`;
    }
  }
  if (star) out += `<path d='M0 -232l9 19 21 3-15 15 4 21-19-10-19 10 4-21-15-15 21-3z' fill='#ffd166'/>`;
  return out + '</g>';
}

function tree(x, y, s, crown) {
  return `<g transform='translate(${x} ${y}) scale(${s})'><rect x='-7' y='-30' width='14' height='70' fill='#5a2d1a'/>` +
    `<circle cy='-62' r='50' fill='${crown}'/><circle cx='-38' cy='-30' r='36' fill='${crown}'/><circle cx='40' cy='-34' r='38' fill='${crown}'/></g>`;
}

/* ---------- Jahreszeiten & Feste ---------- */
function artSpring() {
  const r = rng(11);
  const colors = ['#ff8fab', '#ffffff', '#ffd23f', '#c77dff', '#ff99c8'];
  let flowers = '';
  for (let i = 0; i < 90; i++) {
    const x = r() * 1600, y = 700 + r() * 200;
    flowers += `<use href='#fl' transform='translate(${r1(x)} ${r1(y)}) scale(${r1(0.6 + r() * 0.8)})' fill='${colors[i % colors.length]}'/>`;
  }
  const blossoms = [[1560, 45], [1500, 66], [1440, 88], [1380, 110], [1320, 128], [1262, 148], [1420, 48], [1372, 24], [1346, 160], [1302, 194], [1272, 216], [1604, 30], [1478, 40], [1226, 160], [1532, 80]]
    .map(([x, y], i) => `<use href='#fl' transform='translate(${x} ${y}) scale(${i % 3 ? 1.15 : 0.9}) rotate(${i * 23})' fill='${i % 2 ? '#ffc2d4' : '#ffafcc'}'/>`).join('');
  return svgScene(`<defs>
      <linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='#bfe6ff'/><stop offset='.7' stop-color='#eef9ff'/></linearGradient>
      <radialGradient id='g'><stop offset='0' stop-color='#fff7c2' stop-opacity='.9'/><stop offset='1' stop-color='#fff7c2' stop-opacity='0'/></radialGradient>
      ${PART.cloud}${PART.flower}</defs>
    <rect width='1600' height='900' fill='url(#s)'/>
    <circle cx='260' cy='170' r='230' fill='url(#g)'/><circle cx='260' cy='170' r='62' fill='#fff3a8'/>
    <use href='#cloud' x='620' y='150' fill='#fff' opacity='.95'/><use href='#cloud' x='1050' y='300' fill='#fff' opacity='.8' transform='scale(.8)'/>
    <path d='M0 600C260 540 520 560 800 600S1300 540 1600 580V900H0Z' fill='#c5e9a8'/>
    <path d='M0 680C300 630 600 660 900 690S1350 640 1600 670V900H0Z' fill='#9fd982'/>
    <path d='M0 770C350 730 700 760 1050 785S1450 750 1600 760V900H0Z' fill='#7cc46b'/>
    ${flowers}
    <path d='M1640 30C1500 60 1400 120 1250 150M1450 84C1420 40 1380 20 1340 8M1362 124C1340 168 1302 200 1268 222' stroke='#7a5442' stroke-width='9' fill='none' stroke-linecap='round'/>
    ${blossoms}`, '#cdeffc');
}

function artEaster() {
  const r = rng(5);
  const pastels = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'];
  const accents = ['#ef476f', '#f78c6b', '#06d6a0', '#118ab2', '#8f5bd6', '#ffd166'];
  const eggs = [[170, 770, -8], [265, 805, 10], [390, 755, -4], [610, 838, 6], [1000, 828, -10], [1210, 748, 8], [1310, 800, -6], [1440, 760, 12], [1520, 815, -3]]
    .map(([x, y, rot], i) => {
      const a = accents[i % accents.length];
      const deco = i % 3 === 0
        ? `<path d='M-40 -6L-30 -16L-20 -6L-10 -16L0 -6L10 -16L20 -6L30 -16L40 -6' stroke='#fff' stroke-width='5' fill='none'/><rect x='-40' y='10' width='80' height='10' fill='${a}'/>`
        : i % 3 === 1
          ? `<rect x='-40' y='-14' width='80' height='9' fill='${a}'/><rect x='-40' y='6' width='80' height='9' fill='${a}'/><circle cy='-28' r='4' fill='#fff'/>`
          : `<circle cx='-12' cy='-18' r='5' fill='${a}'/><circle cx='10' cy='-4' r='5' fill='${a}'/><circle cx='-6' cy='14' r='5' fill='${a}'/><circle cx='14' cy='24' r='4' fill='${a}'/><circle cx='-18' cy='4' r='4' fill='${a}'/>`;
      return `<g transform='translate(${x} ${y}) rotate(${rot})'><ellipse cy='40' rx='28' ry='7' fill='#4f8f3f' opacity='.25'/>` +
        `<path d='M0 -42C24 -42 32 -4 30 12C28 32 14 42 0 42C-14 42-28 32-30 12C-32-4-24-42 0-42Z' fill='${pastels[i % pastels.length]}'/>` +
        `<g clip-path='url(#egg)'>${deco}</g></g>`;
    }).join('');
  let flowers = '';
  for (let i = 0; i < 40; i++) {
    flowers += `<use href='#fl' transform='translate(${r1(r() * 1600)} ${r1(690 + r() * 210)}) scale(${r1(0.5 + r() * 0.6)})' fill='${['#fff', '#ffd23f', '#ff99c8'][i % 3]}'/>`;
  }
  return svgScene(`<defs>
      <linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='#fff1d6'/><stop offset='1' stop-color='#f1f9e4'/></linearGradient>
      <radialGradient id='g'><stop offset='0' stop-color='#fff2b3' stop-opacity='.95'/><stop offset='1' stop-color='#fff2b3' stop-opacity='0'/></radialGradient>
      <clipPath id='egg'><path d='M0 -42C24 -42 32 -4 30 12C28 32 14 42 0 42C-14 42-28 32-30 12C-32-4-24-42 0-42Z'/></clipPath>
      ${PART.cloud}${PART.flower}</defs>
    <rect width='1600' height='900' fill='url(#s)'/>
    <circle cx='1320' cy='150' r='260' fill='url(#g)'/><circle cx='1320' cy='150' r='64' fill='#ffe38a'/>
    <use href='#cloud' x='380' y='170' fill='#fff' opacity='.9'/><use href='#cloud' x='900' y='110' fill='#fff' opacity='.7' transform='scale(.7)'/>
    <path d='M0 650C400 590 800 640 1200 620C1400 610 1520 630 1600 625V900H0Z' fill='#bfe5a0'/>
    <path d='M0 760C380 720 760 770 1120 750C1350 738 1500 760 1600 752V900H0Z' fill='#97d27b'/>
    ${flowers}${eggs}`, '#f6f6e4');
}

function artSummer() {
  let waves = '';
  const r = rng(3);
  for (let i = 0; i < 26; i++) {
    const x = r() * 1560, y = 600 + r() * 105;
    waves += `<path d='M${r1(x)} ${r1(y)}q14 -7 28 0t28 0' stroke='#fff' stroke-opacity='.45' stroke-width='3' fill='none' stroke-linecap='round'/>`;
  }
  return svgScene(`<defs>
      <linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='#3aa6ee'/><stop offset='.65' stop-color='#b4e4ff'/></linearGradient>
      <linearGradient id='w' x2='0' y2='1'><stop offset='0' stop-color='#1f7fc4'/><stop offset='1' stop-color='#4fc0e8'/></linearGradient>
      <radialGradient id='g'><stop offset='0' stop-color='#fff6b0' stop-opacity='1'/><stop offset='1' stop-color='#fff6b0' stop-opacity='0'/></radialGradient>
      ${PART.cloud}</defs>
    <rect width='1600' height='900' fill='url(#s)'/>
    <circle cx='1300' cy='160' r='300' fill='url(#g)'/><circle cx='1300' cy='160' r='86' fill='#ffd93d'/>
    <use href='#cloud' x='420' y='150' fill='#fff'/><use href='#cloud' x='860' y='260' fill='#fff' opacity='.85' transform='scale(.75)'/>
    <rect y='570' width='1600' height='330' fill='url(#w)'/>
    <path d='M0 570H1600' stroke='#e8f7ff' stroke-width='3' opacity='.7'/>
    ${waves}
    <g transform='translate(1080 585)'><path d='M-60 0H60L44 22H-44Z' fill='#7a4b2a'/><path d='M0 -4V-120' stroke='#5a3a22' stroke-width='5'/><path d='M4 -116L64 -12H4Z' fill='#fff'/><path d='M-4 -100L-50 -12H-4Z' fill='#ffd166'/></g>
    <path d='M0 720C300 690 600 740 900 720C1200 700 1400 740 1600 715V900H0Z' fill='#f6dca5'/>
    <path d='M0 720C300 690 600 740 900 720C1200 700 1400 740 1600 715' stroke='#fff' stroke-width='7' fill='none' opacity='.7'/>
    <path d='M0 820C350 790 700 840 1100 815C1350 800 1500 830 1600 820V900H0Z' fill='#ecc98b'/>
    <g transform='translate(270 610)'><path d='M0 -60V190' stroke='#8a6a4a' stroke-width='8' stroke-linecap='round'/>
      <path d='M-140 8Q0 -120 140 8Z' fill='#ef476f'/><path d='M0 8L-70 -40L-50 -48L-28 -53Z M0 8L28 -53L50 -48L70 -40Z' fill='#fff'/>
      <circle cy='-58' r='6' fill='#8a6a4a'/></g>
    <g transform='translate(430 815)'><circle r='32' fill='#fff'/><path d='M0 -32A32 32 0 0 1 32 0H0Z' fill='#ef476f'/><path d='M0 32A32 32 0 0 1 -32 0H0Z' fill='#118ab2'/><path d='M-32 0A32 32 0 0 1 0 -32V0Z' fill='#ffd166'/></g>`, '#8fd0f5');
}

function artAutumn() {
  const r = rng(7);
  const colors = ['#e4572e', '#f3a712', '#c0392b', '#f28f3b', '#d1495b', '#ffc857'];
  let leaves = '';
  for (let i = 0; i < 46; i++) {
    const x = r() * 1600, y = r() * 860;
    leaves += `<use href='#${i % 2 ? 'leafA' : 'leafB'}' transform='translate(${r1(x)} ${r1(y)}) rotate(${Math.round(r() * 360)}) scale(${r1(0.6 + r() * 1.1)})' fill='${colors[i % colors.length]}' opacity='${r1(0.6 + r() * 0.4)}'/>`;
  }
  return svgScene(`<defs>
      <linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='#ffe3b3'/><stop offset='.55' stop-color='#f8b47c'/><stop offset='1' stop-color='#e5885a'/></linearGradient>
      <radialGradient id='g'><stop offset='0' stop-color='#fff4d6' stop-opacity='.95'/><stop offset='1' stop-color='#fff4d6' stop-opacity='0'/></radialGradient>
      <g id='leafA'><path d='M0 -22C14 -12 14 10 0 22C-14 10 -14 -12 0 -22Z'/><path d='M0 -18V27' stroke='#000' stroke-opacity='.22' stroke-width='1.6' fill='none'/></g>
      <g id='leafB'><path d='M0 -24L6 -10L18 -14L13 -2L24 2L12 8L15 20L3 14L0 24L-3 14L-15 20L-12 8L-24 2L-13 -2L-18 -14L-6 -10Z'/><path d='M0 -14V30' stroke='#000' stroke-opacity='.22' stroke-width='1.6' fill='none'/></g>
    </defs>
    <rect width='1600' height='900' fill='url(#s)'/>
    <circle cx='1180' cy='560' r='380' fill='url(#g)'/><circle cx='1180' cy='560' r='72' fill='#fff1cf' opacity='.9'/>
    <path d='M0 600C220 540 420 560 640 600C860 640 1060 560 1300 570C1450 576 1540 600 1600 590V900H0Z' fill='#e7915f'/>
    ${tree(150, 650, 1.05, '#f3a712')}${tree(290, 642, 0.8, '#e4572e')}${tree(1360, 640, 0.95, '#ffc857')}${tree(1490, 648, 1.2, '#d1495b')}${tree(540, 668, 0.6, '#f28f3b')}
    <path d='M0 690C240 640 480 660 760 700C1040 740 1280 660 1600 680V900H0Z' fill='#cc6a3e'/>
    <path d='M0 790C300 740 640 770 960 800C1240 826 1440 770 1600 780V900H0Z' fill='#a14d2b'/>
    ${leaves}`, '#f2a774');
}

function artWinter() {
  const r = rng(21);
  let snow = '';
  for (let i = 0; i < 150; i++) {
    snow += `<circle cx='${r1(r() * 1600)}' cy='${r1(r() * 900)}' r='${r1(1.5 + r() * 3.8)}' fill='#fff' opacity='${r1(0.5 + r() * 0.45)}'/>`;
  }
  for (let i = 0; i < 14; i++) {
    snow += `<use href='#flake' transform='translate(${r1(r() * 1600)} ${r1(r() * 620)}) scale(${r1(0.5 + r() * 0.9)}) rotate(${Math.round(r() * 60)})' opacity='.8'/>`;
  }
  const caps = [[180, 400], [520, 340], [860, 380], [1220, 360]]
    .map(([x, y]) => `<path d='M${x} ${y}L${x + 42} ${y + 46}L${x + 16} ${y + 36}L${x} ${y + 52}L${x - 16} ${y + 34}L${x - 40} ${y + 44}Z' fill='#fff'/>`).join('');
  return svgScene(`<defs>
      <linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='#8db7de'/><stop offset='.6' stop-color='#dbeaf6'/><stop offset='1' stop-color='#eef5fb'/></linearGradient>
      <radialGradient id='g'><stop offset='0' stop-color='#fff' stop-opacity='.8'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient>
      <g id='flake' stroke='#fff' stroke-width='3' stroke-linecap='round'><path d='M0 -16V16M-14 -8L14 8M-14 8L14 -8M-4 -12L0 -8L4 -12M-4 12L0 8L4 12'/></g>
    </defs>
    <rect width='1600' height='900' fill='url(#s)'/>
    <circle cx='380' cy='220' r='200' fill='url(#g)'/><circle cx='380' cy='220' r='56' fill='#fff' opacity='.75'/>
    <path d='M0 560L180 400L330 520L520 340L700 500L860 380L1040 520L1220 360L1400 500L1600 420V900H0Z' fill='#b6cce4'/>${caps}
    <path d='M0 650C300 600 600 640 900 670C1200 700 1400 630 1600 650V900H0Z' fill='#e3ecf6'/>
    ${fir(120, 700, 1.0)}${fir(240, 690, 0.72)}${fir(760, 690, 0.55)}${fir(1350, 690, 0.9)}${fir(1470, 704, 1.15)}${fir(1560, 708, 0.7)}
    <path d='M0 760C350 710 700 760 1000 780C1300 800 1450 740 1600 750V900H0Z' fill='#f8fbfe'/>
    ${snow}`, '#cfe2f3');
}

function artChristmas() {
  const r = rng(12);
  let stars = '';
  for (let i = 0; i < 110; i++) {
    stars += `<circle cx='${r1(r() * 1600)}' cy='${r1(r() * 600)}' r='${r1(0.8 + r() * 1.6)}' fill='#fff' opacity='${r1(0.35 + r() * 0.6)}'/>`;
  }
  const bulbColors = ['#ff5a5f', '#ffd166', '#06d6a0', '#4cc9f0', '#f78c6b'];
  const garland = (p0, p1, p2, offset) => {
    let out = `<path d='M${p0[0]} ${p0[1]}Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}' stroke='#22382b' stroke-width='3.5' fill='none'/>`;
    for (let i = 1; i < 14; i++) {
      const t = i / 14, u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
      const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
      const c = bulbColors[(i + offset) % bulbColors.length];
      out += `<g transform='translate(${r1(x)} ${r1(y + 14)})'><circle r='26' fill='${c}' opacity='.35' filter='url(#glow)'/>` +
        `<rect x='-4' y='-17' width='8' height='7' rx='1.5' fill='#3a4a3f'/><ellipse rx='8.5' ry='12' fill='${c}'/><ellipse cx='-3' cy='-4' rx='2.5' ry='4' fill='#fff' opacity='.55'/></g>`;
    }
    return out;
  };
  let snow = '';
  for (let i = 0; i < 70; i++) {
    snow += `<circle cx='${r1(r() * 1600)}' cy='${r1(r() * 900)}' r='${r1(1.2 + r() * 2.8)}' fill='#fff' opacity='${r1(0.35 + r() * 0.5)}'/>`;
  }
  const lights = ['#ffd166', '#ff5a5f', '#4cc9f0', '#fff3b0'];
  return svgScene(`<defs>
      <linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='#0b1a2e'/><stop offset='.6' stop-color='#173552'/><stop offset='1' stop-color='#25496a'/></linearGradient>
      <filter id='glow' x='-1' y='-1' width='3' height='3'><feGaussianBlur stdDeviation='9'/></filter>
      <mask id='moon'><circle cx='230' cy='170' r='48' fill='#fff'/><circle cx='252' cy='154' r='44' fill='#000'/></mask>
    </defs>
    <rect width='1600' height='900' fill='url(#s)'/>${stars}
    <circle cx='230' cy='170' r='48' fill='#fdf1c1' mask='url(#moon)'/>
    ${garland([-40, 30], [400, 250], [840, 40], 0)}${garland([760, 40], [1200, 240], [1640, 30], 2)}
    <path d='M0 690C300 640 600 680 900 705C1200 730 1400 660 1600 680V900H0Z' fill='#d6e2ee'/>
    ${fir(130, 720, 1.05, { color: '#1c4a39', lights, seed: 3 })}${fir(260, 712, 0.75, { color: '#1c4a39', lights, seed: 4 })}
    ${fir(1330, 712, 0.85, { color: '#1c4a39', lights, seed: 5 })}${fir(1470, 728, 1.25, { color: '#1c4a39', lights, star: true, seed: 6 })}
    <path d='M0 780C350 730 700 780 1000 800C1300 820 1450 760 1600 770V900H0Z' fill='#f1f5fa'/>
    ${snow}`, '#173552');
}

/* ---------- Schule ---------- */
function artChalkboard() {
  const chalk = `stroke='#fff' stroke-opacity='.3' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'`;
  const text = (x, y, size, rot, t) => `<text x='${x}' y='${y}' font-size='${size}' transform='rotate(${rot} ${x} ${y})'>${t}</text>`;
  return svgScene(`<defs>
      <radialGradient id='b' cx='.5' cy='.45' r='.75'><stop offset='0' stop-color='#3d5e4b'/><stop offset='1' stop-color='#1d3127'/></radialGradient>
      <filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 .09'/></feComponentTransfer></filter>
      <filter id='blur' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='40'/></filter>
    </defs>
    <rect width='1600' height='900' fill='url(#b)'/>
    <rect width='1600' height='900' filter='url(#n)'/>
    <g fill='#fff' opacity='.05' filter='url(#blur)'><ellipse cx='420' cy='300' rx='260' ry='90'/><ellipse cx='1180' cy='620' rx='300' ry='80'/><ellipse cx='900' cy='180' rx='200' ry='60'/></g>
    <g fill='#fff' fill-opacity='.3' font-family='Segoe Print, Bradley Hand, Comic Sans MS, cursive'>
      ${text(110, 150, 46, -3, 'a² + b² = c²')}${text(1260, 150, 42, 2, 'π ≈ 3,14')}${text(640, 100, 34, 1, '7 · 8 = 56')}
      ${text(140, 830, 40, -2, 'H₂O')}${text(1320, 810, 54, -4, 'ABC')}${text(900, 840, 34, 2, 'x = ?')}
    </g>
    <g ${chalk}>
      <path d='M170 300V450H350Z'/><path d='M170 428H192V450'/>
      <circle cx='1430' cy='420' r='34'/><path d='M1430 362v-18M1430 478v18M1372 420h-18M1488 420h18M1389 379l-12-12M1471 461l12 12M1471 379l12-12M1389 461l-12 12'/>
      <path d='M1180 610C1240 550 1310 566 1350 624M1350 624l-4-24M1350 624l-22-8'/>
      <path d='M520 820q40-50 80 0t80 0t80 0'/>
      <path d='M300 600l12 26 28 4-20 20 5 28-25-13-25 13 5-28-20-20 28-4z'/>
    </g>
    <rect y='874' width='1600' height='26' fill='#6b4a33'/><rect y='874' width='1600' height='4' fill='#8a6446'/>
    <rect x='240' y='866' width='70' height='10' rx='3' fill='#f4f1e8' opacity='.9'/><rect x='1260' y='866' width='46' height='10' rx='3' fill='#ffd6e0' opacity='.9'/>`, '#2a4436');
}

function artCork() {
  const note = (x, y, w, h, rot, color, pin) => {
    let lines = '';
    for (let ly = 40; ly < h - 20; ly += 22) lines += `<path d='M20 ${ly}H${w - 20 - ((ly * 7) % 40)}' stroke='#000' stroke-opacity='.16' stroke-width='3' stroke-linecap='round'/>`;
    return `<g transform='translate(${x} ${y}) rotate(${rot})'><rect x='6' y='9' width='${w}' height='${h}' fill='#000' opacity='.22' filter='url(#sh)'/>` +
      `<rect width='${w}' height='${h}' fill='${color}'/>${lines}` +
      `<circle cx='${w / 2}' cy='12' r='11' fill='${pin}'/><circle cx='${w / 2 - 3}' cy='9' r='3.5' fill='#fff' opacity='.6'/></g>`;
  };
  return svgScene(`<defs>
      <filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='3' seed='4' stitchTiles='stitch'/>
        <feColorMatrix values='0 0 0 0 .33  0 0 0 0 .2  0 0 0 0 .1  1.7 0 0 0 -.72'/></filter>
      <filter id='n2' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='2' seed='9' stitchTiles='stitch'/>
        <feColorMatrix values='0 0 0 0 1  0 0 0 0 .86  0 0 0 0 .62  0 1.6 0 0 -.78'/></filter>
      <filter id='sh' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='6'/></filter>
      <radialGradient id='v' r='.75'><stop offset='.55' stop-color='#3c1e0a' stop-opacity='0'/><stop offset='1' stop-color='#3c1e0a' stop-opacity='.4'/></radialGradient>
    </defs>
    <rect width='1600' height='900' fill='#c4925a'/>
    <rect width='1600' height='900' filter='url(#n)'/><rect width='1600' height='900' filter='url(#n2)' opacity='.6'/>
    <rect width='1600' height='900' fill='url(#v)'/>
    ${note(70, 70, 170, 160, -6, '#ffe680', '#e63946')}${note(1370, 80, 160, 150, 5, '#bde0fe', '#2a9d8f')}
    ${note(100, 660, 170, 150, 4, '#ffc8dd', '#f4a261')}${note(1390, 650, 160, 170, -4, '#caffbf', '#e63946')}`, '#b98652');
}

function doodleTile(color) {
  const size = 400;
  const s = `stroke='${color}' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'`;
  const at = (cx, cy, rot, w, h, inner) => `<g transform='translate(${cx} ${cy}) rotate(${rot}) translate(${-w / 2} ${-h / 2})'>${inner}</g>`;
  const inner = `<g ${s}>
    ${at(66, 66, -18, 56, 54, `<path d='M0 52L10 34L46 -2L56 8L20 44Z M10 34L20 44 M40 4L50 14'/>`)}
    ${at(200, 66, 6, 80, 60, `<path d='M0 8Q22 0 40 10Q58 0 80 8V58Q58 50 40 60Q22 50 0 58Z M40 10V60'/>`)}
    ${at(200, 200, 0, 0, 0, `<circle r='30'/><ellipse rx='13' ry='30'/><path d='M-30 0H30M-26 -15H26M-26 15H26'/>`)}
    ${at(333, 200, 0, 0, 0, `<ellipse rx='34' ry='12'/><ellipse rx='34' ry='12' transform='rotate(60)'/><ellipse rx='34' ry='12' transform='rotate(120)'/><circle r='3' fill='${color}'/>`)}
    ${at(66, 333, -20, 110, 24, `<rect width='110' height='24' rx='3'/><path d='M12 0v8M24 0v12M36 0v8M48 0v12M60 0v8M72 0v12M84 0v8M96 0v12'/>`)}
    ${at(200, 333, 8, 62, 62, `<path d='M23 47h16M26 55h10M31 8a16 16 0 0 0-9 28c2 1.5 3 3 3 5.5h13c0-2.5 1-4 3-5.5A16 16 0 0 0 31 8z'/>`)}
    ${at(333, 333, 10, 44, 54, `<path d='M14 0H30M18 0V18L4 46Q2 52 8 52H36Q42 52 40 46L26 18V0 M10 36H34'/>`)}
    ${at(133, 133, 12, 0, 0, `<path d='M0 -14l4 9 10 1.5-7 7 2 10-9-5-9 5 2-10-7-7 10-1.5z'/>`)}
    ${at(266, 266, -8, 0, 0, `<path d='M-6 12a7 5 0 1 1 .1 0M1 12V-14L16 -18V6M16 6a7 5 0 1 1 .1 0'/>`)}
    ${at(133, 266, -6, 50, 40, `<path d='M0 40H50L0 0Z M0 30H10V40'/>`)}
  </g>
  <g fill='${color}' font-family='Segoe UI, Arial, sans-serif' font-weight='700'>
    <text x='300' y='82' font-size='28' transform='rotate(-8 300 82)'>ABC</text>
    <text x='36' y='212' font-size='28' transform='rotate(6 36 212)'>1+2</text>
    <text x='252' y='145' font-size='26' transform='rotate(4 252 145)'>a²</text>
  </g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}'>${inner}</svg>`;
}

/* ---------- Liste aller Vorlagen ---------- */
const memo = fn => { let v; return () => (v ??= fn()); };

const BG_PRESETS = [
  // Jahreszeiten & Feste
  { id: 'fruehling',   group: 'season', name: 'Frühling',    light: true,  fx: 'petals', scene: memo(artSpring) },
  { id: 'ostern',      group: 'season', name: 'Ostern',      light: true,  fx: 'petals', scene: memo(artEaster) },
  { id: 'sommer',      group: 'season', name: 'Sommer',      light: true,  fx: null,     scene: memo(artSummer) },
  { id: 'herbst',      group: 'season', name: 'Herbst',      light: true,  fx: 'leaves', scene: memo(artAutumn) },
  { id: 'weihnachten', group: 'season', name: 'Advent & Weihnachten', light: false, fx: 'snow', scene: memo(artChristmas) },
  { id: 'winter',      group: 'season', name: 'Winter',      light: true,  fx: 'snow',   scene: memo(artWinter) },
  // Schule
  { id: 'tafel',  group: 'school', name: 'Kreidetafel', scene: memo(artChalkboard) },
  { id: 'karo',   group: 'school', name: 'Karopapier', light: true,
    css: () => 'linear-gradient(#d6e4ef 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(90deg, #d6e4ef 1px, transparent 1px) 0 0 / 28px 28px, #fcfcf8' },
  { id: 'heft',   group: 'school', name: 'Heftlinien', light: true,
    css: () => 'linear-gradient(90deg, transparent 96px, #eba3a3 96px, #eba3a3 98px, transparent 98px), linear-gradient(transparent 39px, #cbdcec 39px) 0 0 / 100% 40px, #fdfdf9' },
  { id: 'kork',   group: 'school', name: 'Pinnwand', scene: memo(artCork) },
  { id: 'schulsachen', group: 'school', name: 'Schulsachen', light: true,
    tile: memo(() => doodleTile('#adc5df')), tileSize: 400, color: '#eaf2fb' },
  { id: 'schulsachen-nacht', group: 'school', name: 'Schulsachen dunkel',
    tile: memo(() => doodleTile('#3f5f82')), tileSize: 400, color: '#1d2c40' },
  // Farben & Verläufe
  { id: 'nacht',    group: 'color', name: 'Nacht',    css: () => 'linear-gradient(135deg, #1d2846, #45306b)' },
  { id: 'ozean',    group: 'color', name: 'Ozean',    css: () => 'linear-gradient(135deg, #0d3f63, #2f7fb5)' },
  { id: 'schiefer', group: 'color', name: 'Schiefer', css: () => '#383d45' },
  { id: 'himmel',   group: 'color', name: 'Himmel',   light: true, css: () => 'linear-gradient(165deg, #9fd0fb, #e9f5ff)' },
  { id: 'wiese',    group: 'color', name: 'Wiese',    light: true, css: () => 'linear-gradient(140deg, #c7ecaa, #74c27a)' },
  { id: 'sonne',    group: 'color', name: 'Sonne',    light: true, css: () => 'linear-gradient(135deg, #ffe39d, #ffab9c)' },
  { id: 'papier',   group: 'color', name: 'Papier',   light: true, css: () => '#f2ede3' },
];

const bgPreset = id => BG_PRESETS.find(p => p.id === id);

/* ---------- Jahreszeit bestimmen ---------- */
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function firstAdvent(year) {
  const dow = new Date(year, 11, 25).getDay();          // 0 = Sonntag
  const fourth = 25 - (dow === 0 ? 7 : dow);             // Sonntag vor Heiligabend/1. Feiertag
  return new Date(year, 11, fourth - 21);                // 3 Wochen davor
}

/**
 * Advent & Weihnachten: 1. Advent bis 6. Januar
 * Ostern: Palmsonntag bis eine Woche nach Ostern
 * sonst Frühling 20.3. · Sommer 21.6. · Herbst 23.9. · Winter 7.1.
 */
function currentSeason(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const y = d.getFullYear();
  if (d >= firstAdvent(y) || d <= new Date(y, 0, 6)) return 'weihnachten';
  const easter = easterSunday(y);
  if (d >= new Date(y, easter.getMonth(), easter.getDate() - 7) && d <= new Date(y, easter.getMonth(), easter.getDate() + 7)) return 'ostern';
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  if (md >= 320 && md < 621) return 'fruehling';
  if (md >= 621 && md < 923) return 'sommer';
  if (md >= 923) return 'herbst';
  return 'winter';
}

/* ---------- Bewegte Effekte (Schnee, Blätter, Blüten) ---------- */
const FX_SHAPES = {
  leaves: ['#e4572e', '#f3a712', '#c0392b', '#ffc857'].map(c =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-24 -24 48 48'><path d='M0 -22C14 -12 14 10 0 22C-14 10 -14 -12 0 -22Z' fill='${c}'/><path d='M0 -18V22' stroke='rgba(0,0,0,.22)' stroke-width='1.6'/></svg>`)}")`),
  petals: ['#ffc2d4', '#ffafcc', '#fff0f5'].map(c =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-12 -12 24 24'><path d='M0 -10C7 -6 7 4 0 10C-7 4 -7 -6 0 -10Z' fill='${c}'/></svg>`)}")`),
};

function renderEffects(layer, kind) {
  if ((layer.dataset.kind || '') === (kind || '')) return;
  layer.dataset.kind = kind || '';
  layer.replaceChildren();
  if (!kind) return;
  const count = kind === 'snow' ? 70 : 24;
  for (let i = 0; i < count; i++) {
    const item = document.createElement('span');
    item.className = `fx-item fx-${kind}`;
    const size = kind === 'snow' ? 3 + Math.random() * 6 : kind === 'leaves' ? 16 + Math.random() * 18 : 10 + Math.random() * 10;
    const duration = (kind === 'snow' ? 10 : 12) + Math.random() * 10;
    item.style.cssText =
      `left:${(Math.random() * 100).toFixed(2)}%;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;` +
      `animation-duration:${duration.toFixed(1)}s;animation-delay:${(-Math.random() * duration).toFixed(1)}s;` +
      `--drift:${Math.round(Math.random() * 200 - 100)}px;--spin:${Math.round(Math.random() * 720 - 360)}deg;` +
      (kind === 'snow' ? `opacity:${(0.5 + Math.random() * 0.45).toFixed(2)};` : '');
    if (FX_SHAPES[kind]) item.style.backgroundImage = FX_SHAPES[kind][i % FX_SHAPES[kind].length];
    layer.append(item);
  }
}
