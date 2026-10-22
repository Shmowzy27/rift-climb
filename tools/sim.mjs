// Balance + economy simulation in the real game code (headless, tools/headless.cjs).
//
//   node tools/sim.mjs            report with the current tables
//   node tools/sim.mjs --write    recalibrate src/js/15-tables.js (uRef + base HP per level), then report
//
// Skill profiles (bots): best band %, pump % (share of the approach spent pumping), dodge %.
// Spending profiles run all 40 levels in order and buy upgrades between levels with the
// coins they actually picked up. Base HP per level is chosen so every profile lands as close
// to its target band as one number allows; the report shows where each one actually lands.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
const require = createRequire(import.meta.url);
const H = require('./headless.cjs');
const TABLES = new URL('../src/js/15-tables.js', import.meta.url);

export const SKILL = {
  average: { pBest: 0.7, pPump: 0.5, pDodge: 0.7 },
  careless: { pBest: 0.35, pPump: 0, pDodge: 0.4 },
  skilled: { pBest: 0.95, pPump: 0.9, pDodge: 0.95 },
  perfect: { pBest: 1, pPump: 1, pDodge: 1 },
};
// spare = timer - break time. Bands from the brief; [lo, hi] in seconds, null = only "must clear"
export const PROFILES = [
  { id: 'average', skill: 'average', spend: ['rate', 'dmg', 'rev'], band: [4, 5], label: 'Average (70/50/70), buys everything' },
  { id: 'careless', skill: 'careless', spend: ['rate', 'dmg', 'rev'], band: [-5, -2], label: 'Careless (35/0/40), buys everything' },
  { id: 'frd', skill: 'average', spend: ['rate', 'dmg'], band: [1, 2], label: 'Average, Fire Rate + Damage only' },
  { id: 'perfect', skill: 'perfect', spend: [], band: [0, 1], from: 17, label: 'Perfect play, buys nothing' },
  { id: 'skilled', skill: 'skilled', spend: [], band: [0, null], label: 'Skilled (95/90/95), buys nothing' },
];

function readTables() {
  const m = readFileSync(TABLES, 'utf8').match(/Object\.assign\(TUNING, (.*)\);/);
  return m ? JSON.parse(m[1]) : {};
}

// ---------------------------------------------------------------- worker
if (!isMainThread) {
  const api = H.loadGame(workerData.tuning);
  parentPort.on('message', job => {
    if (job.tuning) { for (const k in api.TUNING) delete api.TUNING[k]; Object.assign(api.TUNING, job.tuning); parentPort.postMessage({ ok: 1 }); return; }
    // the base never breaks here (HP only sets the boss phase thresholds): we log the whole damage curve
    const r = H.playLevel(api, { L: job.L, seed: job.seed, prof: SKILL[job.skill], up: job.up, arch: job.arch, measure: true, baseHP: job.phaseHP });
    parentPort.postMessage({ id: job.id, r });
  });
}

// ---------------------------------------------------------------- main
class PoolW {
  constructor(n, tuning) {
    this.ws = []; this.q = []; this.cb = new Map(); this.id = 0;
    for (let i = 0; i < n; i++) {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: { tuning } });
      w.busy = false;
      w.on('message', m => { w.busy = false; const f = this.cb.get(m.id); if (f) { this.cb.delete(m.id); f(m.r); } else if (w.res) { const r = w.res; w.res = null; r(); } this.pump(); });
      this.ws.push(w);
    }
  }
  run(job) { return new Promise(res => { job.id = ++this.id; this.cb.set(job.id, res); this.q.push(job); this.pump(); }); }
  pump() { for (const w of this.ws) if (!w.busy && this.q.length) { w.busy = true; w.postMessage(this.q.shift()); } }
  async setTuning(t) { await Promise.all(this.ws.map(w => new Promise(res => { w.res = res; w.busy = true; w.postMessage({ tuning: t }); }))); }
  close() { for (const w of this.ws) w.terminate(); }
}

if (isMainThread && process.argv[1] && process.argv[1].endsWith('sim.mjs')) {
  const write = process.argv.includes('--write');
  const SEEDS = +(process.argv.find(a => a.startsWith('--seeds=')) || '--seeds=3').split('=')[1];
  const M = require('../src/js/10-balance.js');
  const api0 = H.loadGame();
  let tuning = readTables();
  const pool = new PoolW(Math.max(1, os.cpus().length), tuning);
  const timerOf = L => M.assaultTimer(L);
  // the Rift: players pick a squad per level; the sim uses the one that suits each level
  const RIFT_ARCH = { 33: 'beam', 34: 'staff', 35: 'crossbow', 36: 'staff', 37: 'crossbow', 38: 'beam', 39: 'staff', 40: 'staff' };

  // play every level in order for every profile, buying upgrades with the coins actually earned
  async function campaign(tun) {
    const out = {};
    const state = Object.fromEntries(PROFILES.map(p => [p.id, { up: { rate: 0, dmg: 0, rev: 0 }, wallet: { coins: 0, gems: 0 }, rows: [] }]));
    for (let L = 1; L <= 40; L++) {
      const jobs = [];
      for (const p of PROFILES) {
        const st = state[p.id];
        M.buyUpgrades(st.up, st.wallet, p.spend);
        const up = { ...st.up };
        const phaseHP = tun[L] && tun[L].baseHP;
        for (let s = 0; s < SEEDS; s++) jobs.push(pool.run({ L, seed: 1000 * L + 17 * s + 3, skill: p.skill, up, arch: RIFT_ARCH[L] || 'crossbow', phaseHP }).then(r => ({ p, r, up })));
      }
      const res = await Promise.all(jobs);
      for (const p of PROFILES) {
        const st = state[p.id], mine = res.filter(x => x.p === p).map(x => x.r);
        const rev = M.upMult('rev', st.up.rev);
        const road = mine.reduce((a, r) => a + r.coins, 0) / mine.length;
        st.wallet.coins += Math.round(road + M.baseBonus(L) * rev);
        st.wallet.gems += M.isStageBoss(L) ? 6 : 2.1; // expected gem income (35% x 2-10 per base, bosses always)
        const U = M.upMult('rate', st.up.rate) * M.upMult('dmg', st.up.dmg);
        st.rows.push({ L, U, rev, up: { ...st.up }, runs: mine, coins: Math.round(road + M.baseBonus(L) * rev) });
      }
      process.stdout.write(`L${L} `);
    }
    process.stdout.write('\n');
    for (const p of PROFILES) out[p.id] = state[p.id].rows;
    return out;
  }
  // break time for one run's damage log (0.1s samples) against base HP h
  const breakT = (log, h) => { for (let i = 0; i < log.length; i++) if (log[i] >= h) return i * 0.1; return Infinity; };
  const spareOf = (rows, L, h) => {
    const T = timerOf(L), ts = rows[L - 1].runs.map(r => (r.roadFail ? Infinity : breakT(r.dmg, h)));
    const fin = ts.filter(isFinite);
    const clears = fin.length / ts.length;
    // mean over runs; a run that never breaks counts as missing by what it still owed, extrapolated
    const sp = ts.map((t, i) => {
      if (isFinite(t)) return T - t;
      const r = rows[L - 1].runs[i];
      if (r.roadFail || !r.dmg.length) return -T;
      const d = r.dmg, last = d[d.length - 1], rate = Math.max(1, (last - d[Math.max(0, d.length - 31)]) / 3);
      return -Math.min(T, (h - last) / rate);
    });
    return { spare: sp.reduce((a, b) => a + b, 0) / sp.length, clears };
  };
  const miss = (p, sp, L) => {
    if (p.from && L < p.from) return Math.max(0, -sp); // early on, only "clears"
    const [lo, hi] = p.band;
    if (sp < lo) return lo - sp;
    if (hi != null && sp > hi) return sp - hi;
    return 0;
  };
  // base HP: the average buyer breaks it with 4.5s to spare (middle of the 3-5 and 4-6 bands);
  // every other profile is reported where the game's own mechanics put it
  function calibrate(res) {
    const t = {};
    for (let L = 1; L <= 40; L++) {
      const avgRows = res.average;
      const uRef = +avgRows[L - 1].U.toFixed(3);
      let lo = 1, hi = 10;
      for (const r of avgRows[L - 1].runs) if (r.dmg.length) hi = Math.max(hi, r.dmg[r.dmg.length - 1] * 3 + 10);
      for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); if (spareOf(avgRows, L, m).spare > 4.5) lo = m; else hi = m; }
      t[L] = { uRef, baseHP: Math.round(Math.sqrt(lo * hi)) };
    }
    // smooth across neighbouring levels of the same stage (bosses on their own): a level's few runs are noisy
    const r = L => Math.log(t[L].baseHP / (M.enemyHP(L) * t[L].uRef));
    const sm = {};
    for (let L = 1; L <= 40; L++) {
      if (M.isStageBoss(L)) { sm[L] = r(L); continue; }
      const nb = [L - 1, L, L + 1].filter(k => k >= 1 && k <= 40 && !M.isStageBoss(k) && M.stageOf(k) === M.stageOf(L) && !M.isBreather(k) === !M.isBreather(L));
      sm[L] = nb.reduce((a, k) => a + r(k), 0) / nb.length;
    }
    for (let L = 1; L <= 40; L++) {
      t[L].baseHP = Math.round(Math.exp(sm[L]) * M.enemyHP(L) * t[L].uRef);
      // hard requirement first: a skilled player with no upgrades must clear every level
      while (spareOf(res.skilled, L, t[L].baseHP).spare < 0.5 && t[L].baseHP > 10) t[L].baseHP = Math.round(t[L].baseHP * 0.98);
    }
    return t;
  }

  (async () => {
    const t0 = Date.now();
    let res;
    if (write) {
      for (let it = 0; it < 2; it++) {
        console.log(`calibration pass ${it + 1}`);
        res = await campaign(tuning);
        const t = calibrate(res);
        tuning = t;
        Object.keys(M.TUNING).forEach(k => delete M.TUNING[k]); Object.assign(M.TUNING, t);
        await pool.setTuning(t);
        writeFileSync(TABLES, '// Generated by `node tools/sim.mjs --write`. Per-level base HP and the upgrade multiplier an average buyer has (uRef).\nObject.assign(TUNING, ' + JSON.stringify(t) + ');\n');
      }
      console.log('wrote src/js/15-tables.js');
    }
    console.log('final pass');
    res = await campaign(tuning);
    report(res);
    console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}s, ${SEEDS} seeds per profile per level)`);
    pool.close();
  })();

  function report(res) {
    const pad = (s, n) => String(s).padStart(n);
    console.log('\nSPARE SECONDS AT THE BASE (timer - break time; negative = short by). Mean of runs; clears = share of runs that break it.');
    console.log(' L  timer ' + PROFILES.map(p => pad(p.id, 15)).join(''));
    const viol = Object.fromEntries(PROFILES.map(p => [p.id, 0]));
    for (let L = 1; L <= 40; L++) {
      const h = tuning[L] ? tuning[L].baseHP : M.levelTuning(L).baseHP;
      const cells = PROFILES.map(p => {
        const s = spareOf(res[p.id], L, h), m = miss(p, s.spare, L) > 0.05;
        if (m) viol[p.id]++;
        return pad((s.spare >= 0 ? '+' : '') + s.spare.toFixed(1) + (s.clears < 1 ? ` c${Math.round(s.clears * 100)}%` : '') + (m ? '*' : ' '), 15);
      });
      console.log(`${pad(L, 2)}  ${pad(timerOf(L), 4)}s ${cells.join('')}${M.isStageBoss(L) ? '  BOSS' : ''}`);
    }
    console.log('\nOut of band (*):', PROFILES.map(p => `${p.id} ${viol[p.id]}`).join(', '));
    console.log('\nPer stage, mean spare (target band):');
    for (let st = 1; st <= 5; st++) {
      const Ls = Array.from({ length: 8 }, (_, i) => (st - 1) * 8 + i + 1);
      console.log(`  Stage ${st}: ` + PROFILES.map(p => { const v = Ls.map(L => spareOf(res[p.id], L, tuning[L] ? tuning[L].baseHP : M.levelTuning(L).baseHP).spare); return `${p.id} ${(v.reduce((a, b) => a + b) / v.length).toFixed(1)}`; }).join(' | '));
    }
    console.log('\nSquad at the base (mean arrival) and road failures:');
    for (const p of PROFILES) {
      const rows = res[p.id];
      const per = [1, 2, 3, 4, 5].map(st => { const rs = rows.slice((st - 1) * 8, st * 8).flatMap(r => r.runs); const ok = rs.filter(r => !r.roadFail); return Math.round(ok.reduce((a, r) => a + r.arrive, 0) / Math.max(1, ok.length)); });
      const fails = rows.flatMap(r => r.runs).filter(r => r.roadFail).length, total = rows.flatMap(r => r.runs).length;
      console.log(`  ${p.id.padEnd(9)} arrival by stage ${per.join(' / ')}   road deaths ${fails}/${total}`);
    }
    console.log('\nUpgrades (Fire Rate x Damage multiplier, revenue multiplier, pips rate/dmg/rev) by spending profile:');
    for (const p of PROFILES.filter(p => p.spend.length)) {
      const rows = res[p.id];
      console.log(`  ${p.id.padEnd(9)} ` + [5, 10, 16, 17, 24, 32, 40].map(L => { const r = rows[L - 1]; return `L${L} x${r.U.toFixed(2)} rev x${r.rev.toFixed(1)} (${r.up.rate}/${r.up.dmg}/${r.up.rev})`; }).join('  '));
    }
    // no grind: the average buyer, clearing each level once, always has enough to clear the next
    const avg = res.average;
    const noGrind = avg.every((r, i) => { const L = i + 1; return spareOf(avg, L, tuning[L] ? tuning[L].baseHP : M.levelTuning(L).baseHP).spare > 0; });
    console.log(`\nNo grind (average buyer clears every level on first-try income): ${noGrind ? 'yes' : 'NO'}`);
  }
}
