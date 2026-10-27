// Original synthesized sound effects and music using WebAudio. No sound files.
(function (root) {
  var ctx = null, master = null, sfxBus = null, musBus = null, muted = false, noiseBuf = null, musTimer = null, step = 0, nextT = 0, song = 'main';
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(function () { }); return; }
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    var comp = ctx.createDynamicsCompressor(); comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
    musBus = ctx.createGain(); musBus.gain.value = 0.22; musBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = noiseBuf.getChannelData(0), s = 7; for (var i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
  }
  function tone(type, f0, f1, dur, vol, when, bus) {
    if (!ctx) return; var t = (when || ctx.currentTime), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, fFrom, fTo, when, bus, q) {
    if (!ctx) return; var t = when || ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'lowpass'; f.Q.value = q || 1; f.frequency.setValueAtTime(fFrom, t); f.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus || sfxBus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  var last = {};
  function sfx(name) {
    if (!ctx || muted) return; var now = ctx.currentTime; if (last[name] && now - last[name] < 0.04) return; last[name] = now;
    switch (name) {
      case 'place': tone('triangle', 520, 260, 0.12, 0.35); break;
      case 'boom': noise(0.7, 0.9, 2400, 60); tone('sine', 140, 40, 0.5, 0.7); break;
      case 'crate': noise(0.18, 0.3, 3000, 800, now, null, 4); break;
      case 'power': [660, 880, 1100, 1320].forEach(function (f, i) { tone('square', f, 0, 0.09, 0.12, now + i * 0.06); }); break;
      case 'kick': tone('square', 200, 500, 0.08, 0.2); break;
      case 'shield': tone('sine', 900, 300, 0.3, 0.3); break;
      case 'pop': tone('sine', 300, 1200, 0.15, 0.3); tone('triangle', 800, 1600, 0.1, 0.15, now + 0.05); break;
      case 'ko': [600, 450, 330, 220].forEach(function (f, i) { tone('triangle', f, f * 0.9, 0.14, 0.3, now + i * 0.1); }); break;
      case 'win': [523, 659, 784, 1046, 784, 1046].forEach(function (f, i) { tone('square', f, 0, 0.16, 0.14, now + i * 0.11); }); break;
      case 'lose': [392, 330, 262, 196].forEach(function (f, i) { tone('triangle', f, 0, 0.25, 0.25, now + i * 0.18); }); break;
      case 'portal': tone('sine', 300, 1200, 0.6, 0.25); tone('sine', 450, 1800, 0.6, 0.15, now + 0.1); break;
      case 'bosshit': tone('sawtooth', 160, 60, 0.3, 0.3); noise(0.3, 0.4, 1500, 100); break;
      case 'tap': tone('sine', 700, 900, 0.05, 0.15); break;
    }
  }
  // Music: an original 2-bar loop (lead, bass, soft drums). Boss song uses a minor feel.
  var SONGS = {
    main: { bpm: 132, lead: [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 0, 74, 76, 0, 77, 0, 76, 74, 0, 72, 74, 0, 76, 0, 72, 69, 0, 67, 69, 0], bass: [48, 48, 55, 55, 53, 53, 55, 55] },
    boss: { bpm: 144, lead: [69, 0, 72, 69, 76, 0, 74, 72, 71, 0, 72, 74, 0, 71, 68, 0, 69, 0, 72, 76, 81, 0, 79, 76, 77, 0, 76, 74, 72, 71, 69, 0], bass: [45, 45, 41, 41, 43, 43, 40, 40] },
    menu: { bpm: 108, lead: [67, 0, 72, 0, 76, 0, 74, 72, 69, 0, 72, 0, 74, 0, 0, 0, 65, 0, 69, 0, 72, 0, 71, 69, 67, 0, 71, 0, 72, 0, 0, 0], bass: [48, 48, 45, 45, 41, 41, 43, 43] }
  };
  var mf = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
  function tick() {
    if (!ctx) return; var S = SONGS[song], sp = 60 / S.bpm / 2;
    while (nextT < ctx.currentTime + 0.15) {
      var i = step % 32, n = S.lead[i];
      if (n) tone('square', mf(n), 0, sp * 0.9, 0.09, nextT, musBus);
      if (i % 4 === 0) tone('triangle', mf(S.bass[(i / 4) | 0]), 0, sp * 3.6, 0.32, nextT, musBus);
      if (i % 2 === 1) noise(0.04, 0.12, 9000, 5000, nextT, musBus);
      if (i % 8 === 0) tone('sine', 120, 45, 0.15, 0.4, nextT, musBus);
      nextT += sp; step++;
    }
  }
  function music(name) { song = name || 'main'; if (!ctx) return; if (musTimer) return; step = 0; nextT = ctx.currentTime + 0.05; musTimer = setInterval(tick, 50); }
  function stopMusic() { if (musTimer) clearInterval(musTimer); musTimer = null; }
  function setMuted(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02); }
  var api = { init: init, sfx: sfx, music: music, stopMusic: stopMusic, setMuted: setMuted, isMuted: function () { return muted; }, song: function () { return song; } };
  root.BM = root.BM || {}; root.BM.Audio = api;
})(this);
