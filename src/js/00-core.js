'use strict';
// ============================================================================
// CORE: utilities, save data, audio, haptics
// ============================================================================

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const fmtInt = n => Math.floor(n).toLocaleString('en-US');
// numbers above 4 digits (boss / elite HP only) are shown compact
const fmtHP = n => (n < 1e6 ? fmtInt(n) : (n / 1e6).toFixed(n < 1e7 ? 2 : 1) + 'M');
const now = () => performance.now() / 1000;

// ---------------------------------------------------------------------------
// Save data (localStorage, always wrapped)
// ---------------------------------------------------------------------------
const SAVE_KEY = 'riftclimb.squad.v1';
const Store = {
  d: null,
  defaults() {
    return {
      v: 1, gems: 0, shop: {}, skinsOwned: ['conscript'], skin: 'conscript',
      settings: { sound: true, music: true, haptics: true },
      story: [], best: 0, bestScore: 0, runsDone: 0, loop: 0, records: {}, tut: {},
      run: null, // { level, coins, relics, loop, cards }
    };
  },
  load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    const d = this.defaults();
    if (raw) {
      try {
        const p = JSON.parse(raw);
        Object.assign(d, p);
        d.settings = Object.assign(this.defaults().settings, p.settings || {});
      } catch (e) { /* corrupted save: start clean */ }
    }
    this.d = d;
  },
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.d)); } catch (e) { /* storage full or blocked */ } },
  reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} this.d = this.defaults(); this.save(); },
};

// ---------------------------------------------------------------------------
// Audio: everything synthesized with WebAudio, no files
// ---------------------------------------------------------------------------
const AudioSys = {
  ctx: null, master: null, sfx: null, mus: null, noiseBuf: null, last: {},
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.connect(this.master);
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const ch = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    this.apply();
  },
  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') { try { this.ctx.resume(); } catch (e) {} }
  },
  apply() {
    if (!this.ctx) return;
    const s = Store.d.settings;
    this.sfx.gain.value = s.sound ? 0.8 : 0;
    this.mus.gain.value = s.music ? 0.26 : 0;
  },
  ok() { return this.ctx && this.ctx.state === 'running'; },
  throttle(key, ms) {
    const t = performance.now();
    if (this.last[key] && t - this.last[key] < ms) return true;
    this.last[key] = t; return false;
  },
  tone(o) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + (o.at || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f || 440, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.d || 0.1));
    if (o.detune) osc.detune.value = o.detune;
    const v = o.v == null ? 0.2 : o.v, d = o.d || 0.1, a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(o.dest || this.sfx);
    osc.start(t); osc.stop(t + d + 0.05);
  },
  noise(o) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + (o.at || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1200, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.d || 0.2));
    f.Q.value = o.q || 0.8;
    const g = c.createGain(), v = o.v == null ? 0.3 : o.v, d = o.d || 0.2;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + d + 0.05);
  },
};

const SFX = {
  shoot() { if (AudioSys.throttle('shoot', 60)) return; AudioSys.noise({ d: 0.07, v: 0.12, f: 2600, f2: 700, type: 'bandpass', q: 1.2 }); AudioSys.tone({ f: 160, f2: 70, d: 0.06, type: 'square', v: 0.05 }); },
  hit() { if (AudioSys.throttle('hit', 40)) return; AudioSys.noise({ d: 0.05, v: 0.07, f: 2400, type: 'bandpass', q: 2 }); },
  kill() { if (AudioSys.throttle('kill', 50)) return; AudioSys.noise({ d: 0.14, v: 0.14, f: 900, f2: 200 }); AudioSys.tone({ f: 180, f2: 70, d: 0.12, type: 'square', v: 0.07 }); },
  exact(streak) {
    const b = 660 * Math.pow(2, Math.min(streak, 15) / 12);
    AudioSys.tone({ f: b, d: 0.14, type: 'square', v: 0.09 });
    AudioSys.tone({ f: b * 1.5, d: 0.16, type: 'square', v: 0.07, at: 0.05 });
    AudioSys.tone({ f: b * 2, d: 0.3, type: 'sine', v: 0.12, at: 0.1 });
  },
  merge(tier) {
    const f = 196 * Math.pow(2, tier / 5);
    AudioSys.tone({ f, f2: f * 2, d: 0.12, type: 'square', v: 0.11 });
    AudioSys.tone({ f: f * 1.5, d: 0.22, type: 'triangle', v: 0.12, at: 0.06 });
    AudioSys.noise({ d: 0.12, v: 0.08, f: 3000, type: 'highpass' });
  },
  summon() { AudioSys.tone({ f: 330, f2: 880, d: 0.12, type: 'triangle', v: 0.13 }); AudioSys.tone({ f: 990, d: 0.08, type: 'sine', v: 0.06, at: 0.08 }); },
  tile() { [0, 4, 7].forEach((n, i) => AudioSys.tone({ f: 523 * Math.pow(2, n / 12), d: 0.1, type: 'triangle', v: 0.08, at: i * 0.04 })); },
  op(good) { AudioSys.tone({ f: good ? 440 : 330, f2: good ? 990 : 200, d: 0.18, type: 'sawtooth', v: 0.08 }); AudioSys.noise({ d: 0.18, v: 0.09, f: 4000, type: 'highpass' }); },
  sell() { AudioSys.tone({ f: 1200, d: 0.06, type: 'square', v: 0.06 }); AudioSys.tone({ f: 1600, d: 0.1, type: 'square', v: 0.06, at: 0.06 }); },
  coin(i) { AudioSys.tone({ f: 700 + Math.min(i, 60) * 18, d: 0.05, type: 'square', v: 0.045 }); },
  boom() {
    AudioSys.tone({ f: 140, f2: 32, d: 0.55, type: 'sine', v: 0.55 });
    AudioSys.noise({ d: 0.5, v: 0.4, f: 700, f2: 90 });
    AudioSys.tone({ f: 70, f2: 30, d: 0.35, type: 'square', v: 0.12 });
  },
  heart() { AudioSys.tone({ f: 320, f2: 120, d: 0.35, type: 'sawtooth', v: 0.14 }); AudioSys.noise({ d: 0.25, v: 0.15, f: 500 }); },
  debuff() { AudioSys.tone({ f: 240, f2: 80, d: 0.4, type: 'sawtooth', v: 0.15 }); AudioSys.tone({ f: 250, f2: 90, d: 0.4, type: 'sawtooth', v: 0.1, detune: 30 }); },
  buff() { [0, 4, 7, 12].forEach((n, i) => AudioSys.tone({ f: 587 * Math.pow(2, n / 12), d: 0.14, type: 'sine', v: 0.12, at: i * 0.05 })); },
  puff() { AudioSys.noise({ d: 0.25, v: 0.12, f: 600, f2: 150 }); },
  warn() { if (AudioSys.throttle('warn', 300)) return; AudioSys.tone({ f: 880, d: 0.08, type: 'square', v: 0.05 }); AudioSys.tone({ f: 660, d: 0.08, type: 'square', v: 0.05, at: 0.1 }); },
  gate(up) { AudioSys.tone({ f: up === false ? 660 : 220, f2: up === false ? 180 : 1320, d: 0.35, type: 'triangle', v: 0.14 }); AudioSys.noise({ d: 0.4, v: 0.1, f: 6000, type: 'highpass' }); },
  shield() {
    AudioSys.noise({ d: 0.5, v: 0.3, f: 5000, type: 'highpass' });
    [0, 7, 12, 19].forEach((n, i) => AudioSys.tone({ f: 880 * Math.pow(2, n / 12), d: 0.3, type: 'sine', v: 0.1, at: i * 0.04 }));
  },
  bossHit() { if (AudioSys.throttle('bh', 70)) return; AudioSys.tone({ f: 90, f2: 50, d: 0.08, type: 'square', v: 0.09 }); },
  bossDie() {
    this.boom();
    [12, 7, 4, 0, -5].forEach((n, i) => AudioSys.tone({ f: 440 * Math.pow(2, n / 12), d: 0.25, type: 'square', v: 0.08, at: 0.15 + i * 0.09 }));
  },
  clear() { [0, 4, 7, 12, 16].forEach((n, i) => AudioSys.tone({ f: 523 * Math.pow(2, n / 12), d: 0.3, type: 'square', v: 0.08, at: i * 0.08 })); },
  fail() { [0, -3, -7, -12].forEach((n, i) => AudioSys.tone({ f: 330 * Math.pow(2, n / 12), d: 0.3, type: 'triangle', v: 0.12, at: i * 0.13 })); },
  gem(i) { AudioSys.tone({ f: 1400 + i * 90, d: 0.12, type: 'sine', v: 0.08 }); },
  ui() { AudioSys.tone({ f: 600, f2: 900, d: 0.05, type: 'triangle', v: 0.07 }); },
  wind() { AudioSys.tone({ f: 120, f2: 260, d: 1.8, type: 'sawtooth', v: 0.05 }); },
  swing() { AudioSys.noise({ d: 0.35, v: 0.3, f: 1800, f2: 200, type: 'bandpass' }); AudioSys.tone({ f: 100, f2: 40, d: 0.3, type: 'square', v: 0.15 }); },
  lose() { if (AudioSys.throttle('lose', 90)) return; AudioSys.tone({ f: 260, f2: 140, d: 0.12, type: 'square', v: 0.07 }); },
  crumble() { AudioSys.noise({ d: 0.45, v: 0.35, f: 900, f2: 120 }); AudioSys.tone({ f: 90, f2: 40, d: 0.3, type: 'square', v: 0.1 }); },
  rally() { [0, 4, 7, 12, 16, 19].forEach((n, i) => AudioSys.tone({ f: 392 * Math.pow(2, n / 12), d: 0.2, type: 'square', v: 0.08, at: i * 0.05 })); },
  baseHit() { if (AudioSys.throttle('bh', 80)) return; AudioSys.tone({ f: 110, f2: 55, d: 0.1, type: 'square', v: 0.09 }); AudioSys.noise({ d: 0.1, v: 0.12, f: 1200 }); },
  orb() { if (AudioSys.throttle('orb', 80)) return; AudioSys.tone({ f: 520, f2: 1040, d: 0.18, type: 'sine', v: 0.1 }); AudioSys.tone({ f: 780, f2: 1560, d: 0.14, type: 'triangle', v: 0.05, at: 0.03 }); },
  beam() { if (AudioSys.throttle('beam', 70)) return; AudioSys.tone({ f: 1800, f2: 600, d: 0.08, type: 'sawtooth', v: 0.04 }); },
  slash() { if (AudioSys.throttle('slash', 90)) return; AudioSys.noise({ d: 0.14, v: 0.22, f: 3000, f2: 900, type: 'bandpass', q: 1.5 }); AudioSys.tone({ f: 1200, f2: 300, d: 0.1, type: 'triangle', v: 0.05 }); },
  card() { AudioSys.tone({ f: 392, d: 0.5, type: 'sine', v: 0.1 }); AudioSys.tone({ f: 587, d: 0.6, type: 'sine', v: 0.08, at: 0.12 }); },
};

// ---------------------------------------------------------------------------
// Music: tiny step sequencer, one mood per stage + menu
// ---------------------------------------------------------------------------
const SONGS = [
  // 0 Flooded Ward: dubby, wet, minor
  { bpm: 88, root: 50, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3],
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: [0, null, null, 0, null, null, 4, null, 0, null, null, 0, null, 2, null, null], arp: [null, 4, null, null, 2, null, null, null, null, 4, null, 7, null, null, 2, null], lead: 'sine', bassT: 'triangle', pad: true },
  // 1 Cursed Keep: drums, harmonic minor
  { bpm: 104, root: 45, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 4, 4],
    kick: 'x..x..x.x..x....', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.',
    bass: [0, null, 0, null, null, 0, null, null, 0, null, 0, null, 4, null, 3, null], arp: [7, null, null, 6, null, null, 4, null, null, null, 2, null, 4, null, null, null], lead: 'square', bassT: 'sawtooth', pad: false },
  // 2 Iron Foundry: industrial 16ths
  { bpm: 116, root: 43, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 1, 6],
    kick: 'x...x...x...x...', snare: '....x..x....x...', hat: 'xxxxxxxxxxxxxxxx',
    bass: [0, 0, null, 0, null, 0, 0, null, 0, null, 0, 0, null, 0, null, 7], arp: [null, null, 4, null, null, null, 4, null, null, null, 4, null, 2, null, 1, null], lead: 'sawtooth', bassT: 'square', pad: false },
  // 3 Neon Sprawl: synthwave arps
  { bpm: 108, root: 52, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 5, 3, 4],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...xx',
    bass: [0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, 4], arp: [0, 2, 4, 7, 0, 2, 4, 7, 0, 2, 4, 7, 9, 7, 4, 2], lead: 'square', bassT: 'sawtooth', pad: true },
  // 4 The Rift: sparse and cold
  { bpm: 72, root: 47, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 1, 0, 6],
    kick: 'x...............', snare: '........x.......', hat: '....x.......x...',
    bass: [0, null, null, null, null, null, null, null, 1, null, null, null, null, null, null, null], arp: [null, null, 7, null, null, null, null, 4, null, null, null, 9, null, null, null, null], lead: 'sine', bassT: 'sine', pad: true },
  // 5 Menu
  { bpm: 96, root: 48, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6],
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: [0, null, null, null, 0, null, null, null, 0, null, null, null, 4, null, null, null], arp: [0, null, 4, null, 7, null, 4, null, 9, null, 7, null, 4, null, 2, null], lead: 'triangle', bassT: 'triangle', pad: true },
];
const Music = {
  cur: -1, song: null, nextT: 0, step: 0, timer: null,
  play(i) {
    AudioSys.init();
    if (!AudioSys.ctx) return;
    if (this.cur === i && this.timer) return;
    this.cur = i; this.song = SONGS[i]; this.step = 0;
    this.nextT = AudioSys.ctx.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 30);
  },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.cur = -1; },
  midi(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  deg(d) { const s = this.song.scale; const o = Math.floor(d / s.length); return s[((d % s.length) + s.length) % s.length] + o * 12; },
  tick() {
    const c = AudioSys.ctx;
    if (!c || c.state !== 'running' || !this.song) return;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.02;
    while (this.nextT < c.currentTime + 0.15) { this.sched(this.step, this.nextT - c.currentTime); this.nextT += 60 / this.song.bpm / 4; this.step++; }
  },
  sched(s, at) {
    const S = this.song, i = s % 16, bar = Math.floor(s / 16) % 4, ch = S.prog[bar], dest = AudioSys.mus;
    const beat = 60 / S.bpm / 4;
    if (S.kick[i] === 'x') { AudioSys.tone({ f: 150, f2: 40, d: 0.25, type: 'sine', v: 0.7, at, dest }); }
    if (S.snare[i] === 'x') { AudioSys.noise({ d: 0.16, v: 0.35, f: 1800, type: 'bandpass', q: 0.7, at, dest }); AudioSys.tone({ f: 200, f2: 120, d: 0.08, type: 'triangle', v: 0.2, at, dest }); }
    if (S.hat[i] === 'x') AudioSys.noise({ d: 0.04, v: 0.12, f: 8000, type: 'highpass', at, dest });
    const b = S.bass[i];
    if (b != null) AudioSys.tone({ f: this.midi(S.root - 12 + this.deg(ch + b)), d: beat * 1.8, type: S.bassT, v: 0.28, at, dest });
    const a = S.arp[i];
    if (a != null) AudioSys.tone({ f: this.midi(S.root + 12 + this.deg(ch + a)), d: beat * 1.5, type: S.lead, v: 0.09, at, dest });
    if (S.pad && i === 0) {
      [0, 2, 4].forEach(k => AudioSys.tone({ f: this.midi(S.root + this.deg(ch + k)), d: beat * 15, type: 'triangle', v: 0.05, a: 0.4, at, dest }));
    }
  },
};

// ---------------------------------------------------------------------------
// Haptics. iOS Safari has no navigator.vibrate; iOS 18+ gives a system tick when
// a switch-style checkbox toggles, so we fall back to that during touches.
// ---------------------------------------------------------------------------
const Haptic = {
  lbl: null, lastT: 0,
  init() {
    if (navigator.vibrate) return;
    try {
      const lbl = document.createElement('label');
      lbl.setAttribute('aria-hidden', 'true');
      lbl.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none;';
      const inp = document.createElement('input');
      inp.type = 'checkbox'; inp.setAttribute('switch', '');
      lbl.appendChild(inp); document.body.appendChild(lbl);
      this.lbl = lbl;
    } catch (e) { this.lbl = null; }
  },
  buzz(ms) {
    if (!Store.d.settings.haptics) return;
    const t = performance.now();
    if (t - this.lastT < 70) return;
    this.lastT = t;
    if (navigator.vibrate) { try { navigator.vibrate(ms || 15); } catch (e) {} return; }
    if (this.lbl) { try { this.lbl.click(); } catch (e) {} }
  },
};
