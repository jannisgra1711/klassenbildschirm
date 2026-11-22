'use strict';

/* Stoppuhr: zählt hoch, mit Zehntelsekunden. */
registerWidget('stopwatch', {
  name: 'Stoppuhr',
  icon: 'stopwatch',
  accent: '#1f6feb',
  size: { w: 360, h: 240 },
  min: { w: 220, h: 170 },
  data: () => ({ elapsed: 0, startedAt: null, running: false }),

  mount({ node, body, data, save }) {
    const digits = el('div', { class: 'sw-digits big-num', role: 'timer' });
    const resetBtn = el('button', { class: 'btn btn-icon', title: 'Zurücksetzen', 'aria-label': 'Zurücksetzen', html: icon('reset'), onclick: reset });
    const startBtn = el('button', { class: 'btn btn-primary', onclick: toggle });
    body.append(digits, el('div', { class: 'controls' }, [resetBtn, startBtn]));

    const elapsed = () => data.running ? data.elapsed + (Date.now() - data.startedAt) : data.elapsed;

    function format(ms) {
      const tenths = Math.floor(ms / 100);
      const s = Math.floor(tenths / 10);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return `<span>${h ? `${h}:${pad2(m)}` : pad2(m)}:${pad2(sec)}<small>,${tenths % 10}</small></span>`;
    }

    let lastHtml = '', lastButton = '';
    function render() {
      const html = format(elapsed());
      if (html !== lastHtml) { digits.innerHTML = html; lastHtml = html; }
      node.classList.toggle('is-running', data.running);
      const state = data.running ? 'pause' : (data.elapsed > 0 ? 'resume' : 'start');
      if (state !== lastButton) {
        lastButton = state;
        startBtn.innerHTML = state === 'pause'
          ? icon('pause') + '<span>Pause</span>'
          : icon('play') + `<span>${state === 'resume' ? 'Weiter' : 'Start'}</span>`;
      }
    }

    function toggle() {
      if (data.running) {
        data.elapsed = elapsed();
        data.running = false;
        data.startedAt = null;
      } else {
        data.startedAt = Date.now();
        data.running = true;
      }
      save();
      render();
    }

    function reset() {
      data.elapsed = 0;
      data.running = false;
      data.startedAt = null;
      save();
      render();
    }

    const tick = setInterval(() => { if (data.running) render(); }, 50);
    render();
    return { destroy() { clearInterval(tick); } };
  },
});
