'use strict';

/* Timer: Countdown mit Fortschrittsring, Schnellwahl und Gong am Ende. */
registerWidget('timer', {
  name: 'Timer',
  icon: 'hourglass',
  accent: '#d13a4f',
  size: { w: 340, h: 390 },
  min: { w: 220, h: 220 },
  data: () => ({ duration: 300, remaining: 300, endAt: null, running: false, sound: true }),

  mount({ node, body, tools, data, save, signal }) {
    const R = 45, C = 2 * Math.PI * R;
    const ring = el('div', {
      class: 't-ring',
      html: `<svg viewBox="0 0 100 100" aria-hidden="true">
               <circle class="t-track" cx="50" cy="50" r="${R}"/>
               <circle class="t-bar" cx="50" cy="50" r="${R}" stroke-dasharray="${C.toFixed(2)}"/>
             </svg>`,
    });
    const bar = ring.querySelector('.t-bar');
    const digits = el('button', { class: 't-digits big-num', role: 'timer' });
    const input = el('input', {
      class: 't-input big-num', type: 'text', inputmode: 'numeric', autocomplete: 'off',
      'aria-label': 'Zeit in Minuten oder als Minuten:Sekunden', hidden: true,
    });
    const chips = el('div', { class: 'chips' },
      [1, 2, 3, 5, 10, 15, 20].map(m => el('button', { class: 'chip', text: `${m} min`, onclick: () => setDuration(m * 60) })));
    const resetBtn = el('button', { class: 'btn btn-icon', title: 'Zurücksetzen', 'aria-label': 'Zurücksetzen', html: icon('reset'), onclick: reset });
    const startBtn = el('button', { class: 'btn btn-primary', onclick: toggle });

    body.append(el('div', { class: 't-face' }, [ring, digits, input]), chips, el('div', { class: 'controls' }, [resetBtn, startBtn]));

    settingsMenu({ tools, signal }, [
      { label: 'Gong am Ende', get: () => data.sound, set: v => { data.sound = v; save(); } },
    ]);

    const secondsLeft = () => data.running ? Math.max(0, (data.endAt - Date.now()) / 1000) : data.remaining;

    let lastButton = '';
    function render() {
      const left = secondsLeft();
      const text = formatDuration(Math.ceil(left - 0.001));
      if (digits.textContent !== text) digits.textContent = text;
      digits.classList.toggle('long', text.length > 5);
      digits.title = data.running ? '' : 'Klicken, um die Zeit einzustellen';

      const frac = data.duration > 0 ? left / data.duration : 0;
      bar.style.strokeDashoffset = (C * (1 - frac)).toFixed(2);

      const done = !data.running && data.remaining <= 0;
      node.classList.toggle('is-done', done);
      node.classList.toggle('is-running', data.running);
      node.classList.toggle('is-ending', data.running && left <= 10);

      const state = data.running ? 'pause' : (done || data.remaining >= data.duration ? 'start' : 'resume');
      if (state !== lastButton) {
        lastButton = state;
        startBtn.innerHTML = state === 'pause'
          ? icon('pause') + '<span>Pause</span>'
          : icon('play') + `<span>${state === 'resume' ? 'Weiter' : 'Start'}</span>`;
      }
    }

    function toggle() {
      if (data.running) {
        data.remaining = secondsLeft();
        data.running = false;
        data.endAt = null;
      } else {
        Sound.unlock();
        if (data.remaining <= 0) data.remaining = data.duration;
        if (data.remaining <= 0) return;
        data.endAt = Date.now() + data.remaining * 1000;
        data.running = true;
      }
      save();
      render();
    }

    function reset() {
      data.running = false;
      data.endAt = null;
      data.remaining = data.duration;
      save();
      render();
    }

    function setDuration(sec) {
      data.duration = sec;
      reset();
    }

    function finish(withSound) {
      data.running = false;
      data.endAt = null;
      data.remaining = 0;
      save();
      render();
      if (withSound && data.sound) Sound.chime();
    }

    /* Zeit direkt eintippen: auf die Ziffern klicken */
    function openEditor() {
      if (data.running) return;
      input.value = formatDuration(data.duration);
      digits.hidden = true;
      input.hidden = false;
      input.focus();
      input.select();
    }
    function closeEditor(apply) {
      if (input.hidden) return;
      if (apply) {
        const sec = parseDuration(input.value);
        if (sec && sec > 0) setDuration(Math.min(sec, 10 * 3600));
        else toast('Bitte z. B. „5“ (Minuten) oder „2:30“ eingeben.');
      }
      input.hidden = true;
      digits.hidden = false;
    }
    digits.addEventListener('click', openEditor);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') closeEditor(true);
      else if (e.key === 'Escape') closeEditor(false);
    });
    input.addEventListener('blur', () => closeEditor(true));

    // Lief der Timer ab, während die Seite zu war? Dann still beenden.
    if (data.running && Date.now() >= data.endAt) finish(false);

    const tick = setInterval(() => {
      if (!data.running) return;
      if (Date.now() >= data.endAt) finish(true);
      else render();
    }, 200);

    render();
    return { destroy() { clearInterval(tick); } };
  },
});
