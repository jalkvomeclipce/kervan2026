/* ============================================================
   KERVAN YOLU — sfx.js
   Küçük sentezlenmiş ses efektleri (WebAudio). Ses dosyası yok.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.Sfx = (function () {
  let ctx = null, master = null, on = true, noiseBuf = null;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.32; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function tone(freq, dur, type, vol, slide, delay) {
    if (!ctx || !on) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, f0, f1, q, delay) {
    if (!ctx || !on) return;
    const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q || 1.2;
    f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.05);
  }
  const P = {
    swing: () => noise(0.16, 0.18, 900, 2800, 0.8),
    hit: () => { noise(0.08, 0.35, 1400, 500, 1.5); tone(110, 0.1, 'triangle', 0.25, 0.5); },
    crit: () => { noise(0.12, 0.45, 2200, 400, 1.2); tone(160, 0.16, 'square', 0.12, 0.4); },
    hurt: () => { tone(180, 0.16, 'sawtooth', 0.12, 0.5); noise(0.08, 0.2, 700, 300, 1); },
    fire: () => noise(0.35, 0.22, 400, 1800, 0.7),
    boom: () => { noise(0.4, 0.4, 600, 90, 0.8); tone(70, 0.35, 'sine', 0.4, 0.5); },
    heal: () => { [523, 659, 784].forEach((f, k) => tone(f, 0.28, 'sine', 0.14, 1, k * 0.07)); },
    coin: () => { tone(1320, 0.08, 'square', 0.06); tone(1760, 0.12, 'square', 0.06, 1, 0.06); },
    level: () => { [392, 494, 587, 784, 988].forEach((f, k) => tone(f, 0.35, 'triangle', 0.16, 1, k * 0.09)); },
    ok: () => { tone(660, 0.12, 'triangle', 0.14); tone(990, 0.2, 'triangle', 0.14, 1, 0.08); },
    fail: () => { tone(300, 0.25, 'sawtooth', 0.1, 0.55); },
    click: () => tone(880, 0.04, 'square', 0.04),
    horn: () => { tone(196, 0.5, 'sawtooth', 0.12, 1.02); tone(147, 0.6, 'sawtooth', 0.1, 1, 0.3); },
    die: () => { tone(220, 0.8, 'triangle', 0.18, 0.3); },
    whirl: () => noise(0.45, 0.25, 500, 2400, 0.6),
    slam: () => { noise(0.6, 0.5, 300, 60, 0.7); tone(55, 0.5, 'sine', 0.5, 0.6); },
    portal: () => { [440, 660, 880, 1320].forEach((f, k) => tone(f, 0.3, 'sine', 0.1, 1.05, k * 0.05)); }
  };
  return {
    init, play: (k) => { if (P[k]) try { P[k](); } catch (e) { } },
    get on() { return on; }, set on(v) { on = v; }
  };
})();
