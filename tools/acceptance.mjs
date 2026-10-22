// Fix pass 2 acceptance checks A, B, D, E, G, run on the real game logic (headless).
// C (rendered frames) and the frame-cost probe for F live in tools/accept-render.cjs.
//   node tools/acceptance.mjs [A|B|D|E|G ...]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const H = require('./headless.cjs');
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');

const only = process.argv.slice(2).map(s => s.toUpperCase());
const want = k => !only.length || only.includes(k);
const AVG = { pBest: 0.7, pPump: 0.5, pDodge: 0.7 };
const api = H.loadGame();
const G = api.G, ctx = api.ctx;
const expW = L => (L <= 1 ? 1 : Math.min(10, ctx.crateTier(L - 1, 1)));
const stats = a => { const n = a.length, mean = a.reduce((x, y) => x + y, 0) / Math.max(1, n); return { min: Math.min(...a), max: Math.max(...a), mean: +mean.toFixed(1), n }; };
const fmt = s => `min ${s.min}  max ${s.max}  mean ${s.mean}  (${s.n} samples)`;
let failed = 0;
const verdict = (name, ok, extra) => { if (!ok) failed++; console.log(`${name}: ${ok ? 'PASS' : 'FAIL'}${extra ? '  ' + extra : ''}`); };

// play a level with the bot, calling probe(t) every `every` seconds of game time
function play(L, o, every, probe) {
  const r = api.rng(o.seed), r2 = api.rng(o.seed * 7 + 3);
  api.Math.random = r;
  api.Store.d.run = { level: L, relics: [], loop: 0, arch: 'crossbow', weapon: o.weapon || 1 };
  api.Store.d.tut.base = true;
  G.sim = true;
  api.startLevel({ sim: true, up: { rate: 0, dmg: 0, rev: 0 }, plusOne: 0, weapon: o.weapon || 1, rnd: api.rng(o.seed * 13 + 1) });
  if (o.noCrates) G.crates = []; // a player who claims none
  const think = H.makeBot(api, o.prof || AVG, r2);
  const step = Math.round(every * 60);
  let i = 0, tAt100 = null;
  while (G.mode === 'play' && i < 60 * 240) {
    if (i % step === 0) probe(i / 60);
    if (i % 3 === 0) think();
    api.update(1 / 60);
    if (tAt100 == null && G.P >= G.Lr) tAt100 = (i + 1) / 60;
    i++;
  }
  probe(i / 60);
  const won = G.phase === 'done' || G.mode === 'clear';
  // seconds between the boss's death and the moment the road hits 100% (negative: it died first)
  const vsWire = !won ? null : tAt100 != null ? G.stats.killT - tAt100 : -(1 - G.stats.killP) * G.Lr / G.v;
  return { t: i / 60, won, killT: G.stats.killT, killP: G.stats.killP, tAt100, vsWire, firstHitP: G.boss && G.boss.firstHitP };
}

// ---- A: tracers ---------------------------------------------------------------------------
if (want('A')) {
  console.log('\n== A. live tracer instances, sampled every 0.25s (one per shot in flight) ==');
  let ok = true;
  for (const L of [1, 20]) {
    const s = [];
    play(L, { seed: 11, weapon: expW(L) }, 0.25, t => { if (t >= 1 && G.mode === 'play' && G.phase !== 'done') { s.push(api.SHOTS.n); if (!api.SHOTS.n) console.log('  zero at', t, G.phase, 'N', G.N, 'p', (G.P / G.Lr).toFixed(3)); } });
    const st = stats(s);
    console.log(`L${L}: ${fmt(st)}`);
    if (st.min === 0) ok = false;
    if (L === 1 && st.mean < 2) ok = false;
    if (L === 20 && st.mean < 100) ok = false;
  }
  verdict('A', ok, '(L1 mean >= 2, L20 mean in the hundreds, never 0 after the first second)');
}

// ---- B: enemy counts ----------------------------------------------------------------------
if (want('B')) {
  console.log('\n== B. live enemies on screen ahead of the squad, sampled every 0.5s after the first 5s of the road ==');
  let ok = true;
  for (const L of [1, 10, 20, 30, 40]) {
    const s = [];
    const floor = ctx.enemyFloor(L);
    play(L, { seed: 21, weapon: expW(L) }, 0.5, () => {
      if (G.phase !== 'run' || G.lt < 6.5) return; // the road starts after the 1.5s boss intro
      let n = 0; for (const e of G.enemies) if (!e.dead && !e.inv && e.z > G.P && e.z - G.P <= 80) n++; // drawn: within 80 units
      s.push(n);
    });
    const st = stats(s);
    const pass = st.min >= floor;
    if (!pass) ok = false;
    console.log(`L${String(L).padEnd(3)} floor ${String(floor).padEnd(3)} ${fmt(st)}  ${pass ? 'ok' : 'BELOW FLOOR'}`);
  }
  verdict('B', ok);
}

// ---- D: boss HP over L10 ------------------------------------------------------------------
if (want('D')) {
  console.log('\n== D. L10 boss HP every second (average player) ==');
  const runs = [];
  for (const seed of [31, 32, 33, 34, 35, 36, 37, 38, 39]) {
    const rows = [];
    const r = play(10, { seed, weapon: expW(10) }, 1, t => rows.push(`${t.toFixed(0)}s ${(Math.min(1, G.P / G.Lr) * 100).toFixed(0)}% ${Math.max(0, Math.round(G.boss.hp))}`));
    r.rows = rows; r.seed = seed;
    runs.push(r);
  }
  // the average player's typical run: the median by when the boss died relative to 100%
  const byWire = runs.filter(r => r.won).sort((a, b) => a.vsWire - b.vsWire), med = byWire[byWire.length >> 1];
  console.log(`median run (seed ${med.seed}), boss HP every second:`);
  console.log(med.rows.join(' | '));
  console.log('all runs:');
  for (const r of runs) console.log(`  first damage at ${(r.firstHitP * 100).toFixed(0)}%   boss down ${r.won ? (r.vsWire >= 0 ? r.vsWire.toFixed(1) + 's after 100%' : (-r.vsWire).toFixed(1) + 's before 100% (at ' + (r.killP * 100).toFixed(0) + '%)') : 'never (squad lost)'}`);
  const first = runs.map(r => r.firstHitP).sort((a, b) => a - b)[runs.length >> 1];
  const near = runs.filter(r => r.won && Math.abs(r.vsWire) <= 2).length;
  verdict('D', first >= 0.33 && first <= 0.47 && Math.abs(med.vsWire) <= 2, `first damage at ${(first * 100).toFixed(0)}% (median); median run's boss down ${med.vsWire.toFixed(1)}s from 100%; ${near}/${runs.length} individual runs within 2s, ${runs.filter(r => !r.won).length} lost`);
}

// ---- E: crates matter -----------------------------------------------------------------------
if (want('E')) {
  console.log('\n== E. clear time: a player who never shoots a crate vs one who takes them all ==');
  // the weapon carries through the run: the zero player is still on Lv1, the all player holds the best crate of the level before
  const rows = [];
  for (const L of [6, 12, 20, 28, 36]) {
    const t = { none: [], all: [] };
    for (const seed of [41, 42, 43, 44]) {
      for (const mode of ['none', 'all']) {
        const r = play(L, { seed, noCrates: mode === 'none', weapon: mode === 'none' ? 1 : Math.min(10, ctx.crateTier(L - 1, 2)), prof: Object.assign({}, AVG, { crates: mode }) }, 5, () => {});
        t[mode].push(r.won ? r.killT : r.t + 30); // a lost level costs a retry
      }
    }
    const m = a => a.reduce((x, y) => x + y, 0) / a.length;
    const d = (m(t.none) - m(t.all)) / m(t.none);
    rows.push(d);
    console.log(`L${String(L).padEnd(3)} none ${m(t.none).toFixed(1)}s  all ${m(t.all).toFixed(1)}s  difference ${(d * 100).toFixed(0)}%`);
  }
  const avg = rows.reduce((x, y) => x + y, 0) / rows.length;
  verdict('E', avg >= 0.2 && avg <= 0.35, `average difference ${(avg * 100).toFixed(0)}% (target 20-35%)`);
}

// ---- G: the squad starts at exactly 1 -------------------------------------------------------
if (want('G')) {
  console.log('\n== G. squad count in the first 0.5s ==');
  let ok = true;
  for (const L of [1, 5, 12, 30]) {
    const s = [];
    const r = api.rng(51); api.Math.random = r;
    api.Store.d.run = { level: L, relics: [], loop: 0, arch: 'crossbow', weapon: 1 }; api.Store.d.plusOne = 0;
    G.sim = true;
    api.startLevel({ sim: true, rnd: api.rng(52) });
    for (let i = 0; i <= 30; i++) { if (i % 6 === 0) s.push(G.N); api.update(1 / 60); }
    console.log(`L${String(L).padEnd(3)} t=0 N=${s[0]}   first 0.5s: ${s.join(',')}`);
    if (s[0] !== 1) ok = false;
  }
  // a mid-level wipe, then the retry the fail screen offers (it calls startLevel() again)
  play(12, { seed: 53 }, 1, () => { if (G.P / G.Lr > 0.5 && G.mode === 'play') ctx.loseSoldiers(G.N); }); // wiped at 50%
  const wiped = G.mode === 'failed';
  api.startLevel({ sim: true, rnd: api.rng(54) });
  console.log(`L12 retry after ${wiped ? 'a wipe' : 'a clear'}: t=0 N=${G.N}`);
  if (G.N !== 1) ok = false;
  // an old save that had banked +1 SOLDIERs: v3 refunds them and never carries them into a level
  const old = { v: 2, gems: 4, plusOne: 3, run: { level: 7, relics: [], loop: 0, arch: 'crossbow' } };
  const d = Object.assign(api.Store.defaults(), JSON.parse(JSON.stringify(old)));
  api.Store.migrate(d); api.Store.migrate3(d);
  console.log(`save v2 {plusOne: 3, gems: 4} -> v${d.v} {plusOne: ${d.plusOne}, gems: ${d.gems}, run.weapon: ${d.run.weapon}}`);
  if (d.plusOne !== 0 || d.v !== 3) ok = false;
  console.log('every line that assigns a starting squad value:');
  for (const f of fs.readdirSync(path.join(ROOT, 'src', 'js'))) {
    const lines = fs.readFileSync(path.join(ROOT, 'src', 'js', f), 'utf8').split('\n');
    lines.forEach((l, i) => { if (/startSoldiers\s*:|startingSquad\s*\(|G\.N\s*=\s*startingSquad|return BAL\.startSoldiers|plusOne\s*=(?!=)|G\.startN\s*=/.test(l)) console.log(`  src/js/${f}:${i + 1}: ${l.trim().slice(0, 140)}`); });
  }
  verdict('G', ok);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall headless checks passed');
process.exitCode = failed ? 1 : 0;
