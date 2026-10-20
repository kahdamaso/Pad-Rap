// Efeitos de jogo: números que sobem, confete, tremida, sons e vibração.
// Sons são sintetizados na hora (Web Audio), então não há arquivos para baixar.
(function (root) {
  'use strict';

  const SOUND_KEY = 'rotina-rpg:som';
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let layer = null;
  function getLayer() {
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    return layer;
  }

  function spawn(cls, x, y, text, style) {
    const el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (style) Object.assign(el.style, style);
    getLayer().appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    setTimeout(() => el.remove(), 2500);
    return el;
  }

  // Texto que sobe e some (ex.: "+25 XP" saindo do botão).
  function float(x, y, text, kind) {
    spawn(`fx-float ${kind || ''}`, x, y, text);
  }

  // Estouro de partículas num ponto.
  function burst(x, y, opts) {
    if (reduced()) return;
    const o = opts || {};
    const glyphs = o.glyphs || ['✦', '✧', '•'];
    const n = o.count || 12;
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const dist = 30 + Math.random() * (o.spread || 40);
      spawn('fx-particle', x, y, glyphs[i % glyphs.length], {
        '--dx': `${Math.cos(angle) * dist}px`,
        '--dy': `${Math.sin(angle) * dist}px`,
        color: o.colors ? o.colors[i % o.colors.length] : '',
      });
    }
  }

  // Confete caindo pela tela toda (subir de nível, vencer chefe…).
  function confetti() {
    if (reduced()) return;
    const colors = ['#f2c14e', '#9b7bff', '#4cc38a', '#e5484d', '#4c9bff', '#e86fb5'];
    for (let i = 0; i < 60; i++) {
      spawn('fx-confetti', Math.random() * window.innerWidth, -20, '', {
        background: colors[i % colors.length],
        animationDelay: `${Math.random() * 0.6}s`,
        animationDuration: `${1.6 + Math.random() * 1.2}s`,
        '--drift': `${(Math.random() - 0.5) * 160}px`,
        '--spin': `${(Math.random() - 0.5) * 900}deg`,
      });
    }
  }

  function shake(el) {
    if (!el || reduced()) return;
    el.classList.remove('fx-shake');
    void el.offsetWidth; // reinicia a animação
    el.classList.add('fx-shake');
  }

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  // ---------- Sons ----------

  let ctx = null;
  function soundOn() {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch (e) {
      return true;
    }
  }

  function setSound(on) {
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch (e) {
      /* preferência opcional */
    }
  }

  function tone(freq, start, dur, type, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol || 0.12, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  const SOUNDS = {
    complete: () => { tone(660, 0, 0.12, 'triangle'); tone(990, 0.08, 0.2, 'triangle'); },
    coin: () => { tone(1320, 0, 0.08, 'square', 0.05); tone(1760, 0.06, 0.14, 'square', 0.05); },
    hurt: () => { tone(180, 0, 0.25, 'sawtooth', 0.08); tone(120, 0.05, 0.3, 'sine', 0.1); },
    hit: () => { tone(220, 0, 0.1, 'square', 0.07); tone(140, 0.04, 0.16, 'triangle', 0.1); },
    levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.1)),
    victory: () => [392, 523, 659, 784, 659, 1047].forEach((f, i) => tone(f, i * 0.1, 0.32, 'triangle', 0.1)),
    chest: () => [880, 1175, 1568, 2093].forEach((f, i) => tone(f, i * 0.07, 0.25, 'sine', 0.08)),
    click: () => tone(520, 0, 0.05, 'triangle', 0.05),
  };

  function play(name) {
    if (!soundOn() || !SOUNDS[name]) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      SOUNDS[name]();
    } catch (e) {
      /* sem áudio neste aparelho */
    }
  }

  root.RPGFx = { float, burst, confetti, shake, vibrate, play, soundOn, setSound };
})(typeof self !== 'undefined' ? self : this);
