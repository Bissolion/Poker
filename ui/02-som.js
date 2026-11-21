// ---- som (sintetizado, sem arquivos) ----
const sfx = (() => {
  let ctx = null;
  const ok = () => prefs.sound && ctx && ctx.state === 'running';
  const unlock = () => {
    if (!prefs.sound) return;
    try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; }
  };
  const tone = (f, t0, dur, type = 'sine', vol = .12) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, ctx.currentTime + t0);
    g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
    o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.02);
  };
  const noise = (t0, dur, freq, vol = .18, type = 'bandpass') => {
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = type; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f).connect(g).connect(ctx.destination); src.start(ctx.currentTime + t0);
  };
  const safe = fn => (...a) => { if (!ok()) return; try { fn(...a); } catch (e) {} };
  return {
    unlock,
    card: safe((n = 1) => { for (let i = 0; i < n; i++) noise(i * 0.09, 0.07, 3200, .22); }),
    chip: safe(() => { tone(2300, 0, .05, 'triangle', .09); tone(1900, .05, .06, 'triangle', .08); }),
    check: safe(() => { tone(150, 0, .08, 'sine', .3); tone(150, .11, .08, 'sine', .25); }),
    fold: safe(() => noise(0, .14, 900, .14, 'lowpass')),
    turn: safe(() => { tone(660, 0, .12, 'sine', .08); tone(990, .1, .2, 'sine', .07); }),
    win: safe(() => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .25, 'triangle', .09))),
    allin: safe(() => [196, 247, 294].forEach(f => tone(f, 0, .5, 'sawtooth', .035))),
    level: safe(() => { tone(440, 0, .15, 'square', .04); tone(660, .16, .25, 'square', .04); }),
  };
})();
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });

// ---- voz: anuncia cada ação ("Raise", "Call"...) com a síntese de fala do navegador ----
const voice = (() => {
  const ok = () => prefs.voice && 'speechSynthesis' in window;
  let v = null;
  const pick = () => { try { const all = speechSynthesis.getVoices(); v = all.find(x => /^en(-|_)US/i.test(x.lang)) || all.find(x => /^en/i.test(x.lang)) || null; } catch (e) {} };
  if ('speechSynthesis' in window) { pick(); try { speechSynthesis.onvoiceschanged = pick; } catch (e) {} }
  const say = word => {
    if (!word) return;
    if (!ok()) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      if (v) u.voice = v; u.lang = v ? v.lang : 'en-US'; u.rate = 1.05; u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  };
  return { say, available: 'speechSynthesis' in window };
})();
