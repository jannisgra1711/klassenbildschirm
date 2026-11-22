'use strict';

/* Uhr: digital oder analog, optional mit Datum und Sekunden. */
registerWidget('clock', {
  name: 'Uhr',
  icon: 'clock',
  accent: '#6b4fd8',
  size: { w: 400, h: 230 },
  min: { w: 200, h: 140 },
  data: () => ({ analog: false, seconds: false, date: true }),

  mount({ body, tools, data, save, signal }) {
    const wrap = el('div', { class: 'c-wrap' });
    body.append(wrap);

    const dateFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let hands = null, timeEl = null, dateEl = null;

    function analogSvg() {
      let ticks = '', nums = '';
      for (let i = 0; i < 60; i++) {
        const major = i % 5 === 0;
        ticks += `<line class="c-tick${major ? ' major' : ''}" x1="100" y1="${major ? 9 : 11}" x2="100" y2="${major ? 21 : 16}" transform="rotate(${i * 6} 100 100)"/>`;
      }
      for (let n = 1; n <= 12; n++) {
        const a = n * Math.PI / 6;
        nums += `<text x="${(100 + 67 * Math.sin(a)).toFixed(1)}" y="${(100 - 67 * Math.cos(a)).toFixed(1)}">${n}</text>`;
      }
      return `<svg class="c-analog" viewBox="0 0 200 200" role="img" aria-label="Analoge Uhr">
        <circle class="c-face" cx="100" cy="100" r="96"/>${ticks}<g class="c-nums">${nums}</g>
        <line class="c-h" x1="100" y1="112" x2="100" y2="52"/>
        <line class="c-m" x1="100" y1="116" x2="100" y2="28"/>
        <line class="c-s" x1="100" y1="124" x2="100" y2="22"/>
        <circle class="c-pin" cx="100" cy="100" r="5"/></svg>`;
    }

    function build() {
      wrap.classList.toggle('with-date', data.date);
      if (data.analog) {
        wrap.innerHTML = analogSvg();
        const svg = wrap.firstElementChild;
        hands = { h: svg.querySelector('.c-h'), m: svg.querySelector('.c-m'), s: svg.querySelector('.c-s') };
        hands.s.style.display = data.seconds ? '' : 'none';
        timeEl = null;
      } else {
        wrap.replaceChildren();
        timeEl = el('div', { class: 'c-time big-num' + (data.seconds ? ' with-sec' : '') });
        wrap.append(timeEl);
        hands = null;
      }
      dateEl = data.date ? el('div', { class: 'c-date' }) : null;
      if (dateEl) wrap.append(dateEl);
      update();
    }

    function update() {
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
      if (hands) {
        hands.h.setAttribute('transform', `rotate(${(h % 12) * 30 + m * 0.5} 100 100)`);
        hands.m.setAttribute('transform', `rotate(${m * 6 + s * 0.1} 100 100)`);
        hands.s.setAttribute('transform', `rotate(${s * 6} 100 100)`);
      }
      if (timeEl) {
        timeEl.innerHTML = `${pad2(h)}:${pad2(m)}` + (data.seconds ? `<span class="sec">:${pad2(s)}</span>` : '');
      }
      if (dateEl) dateEl.textContent = dateFmt.format(now);
    }

    settingsMenu({ tools, signal }, [
      { label: 'Analoge Uhr', get: () => data.analog, set: v => { data.analog = v; save(); build(); } },
      { label: 'Sekunden anzeigen', get: () => data.seconds, set: v => { data.seconds = v; save(); build(); } },
      { label: 'Datum anzeigen', get: () => data.date, set: v => { data.date = v; save(); build(); } },
    ]);

    // Genau zum Sekundenwechsel aktualisieren
    let timer;
    const loop = () => { update(); timer = setTimeout(loop, 1000 - (Date.now() % 1000) + 10); };
    build();
    loop();
    return { destroy() { clearTimeout(timer); } };
  },
});
