// Runs the real game logic (src/js 00, 10, 15, 20, 40) in a node VM with the DOM,
// audio and renderer stubbed out, plus a bot that plays like a given player profile.
// Used by tools/sim.mjs (balance + economy) and tools/bench.mjs (archetype DPS).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'src', 'js');
const FILES = ['00-core.js', '10-balance.js', '15-tables.js', '20-content.js', '40-game.js'];

function loadGame(tuning) {
  const ctx = {
    console, performance,
    window: { innerWidth: 393, innerHeight: 852, devicePixelRatio: 3, addEventListener() {} },
    document: { getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), addEventListener() {}, body: { appendChild() {} } },
    navigator: {}, localStorage: undefined,
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0,
    getComputedStyle: () => ({}),
  };
  vm.createContext(ctx);
  let code = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/^if \(typeof module !== 'undefined'\).*$/m, '')).join('\n;\n');
  code += `
;const UI = { rally() { G.mode = 'play'; }, failed() {}, baseFail() {}, levelClear() {}, endlessOver() {} };
Store.load();
globalThis.__api = { STAGES, G, BAL, TUNING, UPG, Store, SHOTS, ESHOTS, startLevel, update, formHalf, reach, applyBand, upMult, buyUpgrades, pipCost,
  stageOf, isStageBoss, levelTuning, dmgPerSoldier, fireRate, shotDamage, guns, ARCH, ARCH_ORDER, RIFT_PROFILES, enemyHP, rng, archDef, layoutBodies, roleWeights, pickRole, addEnemy, discValue, baseBonus, bossHP, Math };`;
  vm.runInContext(code, ctx, { filename: 'rift-climb-logic.js' });
  const api = ctx.__api;
  api.ctx = ctx;
  if (tuning) Object.assign(api.TUNING, tuning);
  return api;
}

// A bot that plays like a profile: pBest = picks the best band, pPump = share of the
// approach it spends standing in front of its band (pumping), pDodge = share of telegraphed
// attacks and return-fire tracers it steps out of.
function makeBot(api, prof, rnd) {
  const G = api.G;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ROADW = 5;
  function decide(set) {
    const N = G.N;
    const wary = rnd() < prof.pDodge;
    // a band with a barrel or barricade behind it is worth less to a wary player
    const haz = set.bands.map(b => G.barrels.some(r => !r.dead && r.x > b.x0 && r.x < b.x1 && r.z > set.z && r.z < set.z + 8) || G.bars.some(r => !r.dead && r.x0 >= b.x0 - 0.3 && r.x1 <= b.x1 + 0.3 && r.z > set.z && r.z < set.z + 8));
    set.botHaz = haz;
    const vals = set.bands.map((b, i) => api.applyBand(N, b) * (wary && haz[i] ? 0.75 : 1));
    const best = vals.indexOf(Math.max(...vals));
    if (rnd() < prof.pBest || set.bands.length === 1) return best;
    // a miss is an arithmetic miss: the next-best green band (a red one only if nothing else is left)
    const others = set.bands.map((_, i) => i).filter(i => i !== best).sort((a, b) => vals[b] - vals[a]);
    const green = others.filter(i => !set.bands[i].red);
    return green.length && !set.bands[best].red ? green[0] : best;
  }
  function safeX(test, pref) {
    let best = null, bd = 1e9;
    const fh = api.formHalf();
    for (let x = -4.6; x <= 4.6; x += 0.2) {
      let ok = true;
      for (let k = -1; k <= 1; k++) if (test(x + k * fh * 0.95)) { ok = false; break; }
      if (!ok) continue;
      const d = Math.abs(x - pref);
      if (d < bd) { bd = d; best = x; }
    }
    return best == null ? pref : best;
  }
  return function think() {
    const l = G.lead, fh = api.formHalf(), R = api.reach();
    let goal = l.x, locked = false;
    if (G.phase === 'run') {
      for (const sp of G.splits) if (sp.botSide == null && sp.z0 - G.P < 5 * G.v) sp.botSide = rnd() < prof.pBest ? -sp.side : sp.side;
      const sp = G.splits.find(s => s.botSide != null && G.P < s.z0 && s.z0 - G.P < 3 * G.v);
      // free aim: line up on the nearest enemy ahead
      let near = null;
      for (const e of G.enemies) { if (e.dead || !e.active || e.inv) continue; const d = e.z - G.P; if (d > 1.5 && d < 35 && (!near || d < near.z - G.P)) near = e; }
            const small = G.N < Math.max(8, 2 * api.ctx.blockSize(G.level));
      if (small) { near = null; goal = 0; } // a small squad holds the clear middle lane instead of hunting
      if (near) goal = near.shield && G.arch !== 'crossbow' ? clamp(near.x + (near.x > 0 ? -1.9 : 1.9), -4.6, 4.6) : near.x;
      // weapon crates
      const crate = G.crates.find(c => !c.dead && c.z - G.P < 30 && c.z - G.P > 2 && (!small || Math.abs(c.x) < 1.6));
      if (crate) {
        if (crate.want == null) crate.want = prof.crates === 'all' ? 1 : prof.crates === 'none' ? 0 : (rnd() < prof.pBest ? 1 : 0);
        if (crate.want) goal = crate.x;
        else if (Math.abs(goal - crate.x) < 1.2) goal = crate.x + (crate.x > 0 ? -1.6 : 1.6);
      } else if (G.boss && !G.boss.dead && G.boss.z - G.P < 32 && !near) goal = G.boss.x; // nothing else in reach: pour it into the boss
      if (sp) goal = sp.botSide * 2.6;
      const set = G.sets.find(s => !s.done && s.z > G.P);
      if (set) {
        const d = set.z - G.P;
        if (set.botIdx == null && d < R + 20) set.botIdx = decide(set);
        if (set.botIdx != null) {
          const b = set.bands[set.botIdx];
          const enterAt = Math.max(3, G.v * 0.5);
          const commit = set.botHaz && set.botHaz[set.botIdx] ? Math.max(prof.pPump, prof.pDodge) : prof.pPump; // blow the barrel early or eat it
          if (d < R * commit || d < enterAt) {
            const w = b.x1 - b.x0;
            goal = w > 2 * fh + 0.8 ? clamp((b.x0 + b.x1) / 2, b.x0 + fh + 0.4, b.x1 - fh - 0.4) : (b.x0 + b.x1) / 2;
            locked = d < enterAt;
          }
        }
      }
      // telegraphed hazards behind bands: step around a live barrel or a solid barricade once past the band
      // blocks: mow down what the squad can kill in time, steer around what it can't
      if (!locked) {
        const cap = Math.max(1, api.guns()) * api.fireRate() * 1.6; // shots before contact
        const sk = Math.max(1, api.ctx.enemyHP(G.level) / Math.max(1e-9, api.shotDamage()));
        const threat = x => { let n = 0; for (const e of G.enemies) { if (e.dead || !e.active || e.inv || e.z < G.P - 0.5 || e.z - G.P > 22) continue; if (Math.abs(e.x - x) < fh + e.r + 0.2) n += e.kill * (1 + (22 - (e.z - G.P)) / 22); } return n; };
        const tg = threat(goal);
        if (tg * sk > cap * 0.8) {
          let best = goal, bv = tg + 0;
          for (let x = small ? -1.2 : -4.4; x <= (small ? 1.2 : 4.4); x += 0.4) { const v = threat(x) + Math.abs(x - goal) * 0.15; if (v < bv) { bv = v; best = x; } }
          goal = best;
        }
      }
      for (const br of G.barrels) {
        if (br.dead || br.z - G.P > 9 || br.z < G.P - 1) continue;
        if (br.bd == null) br.bd = rnd() < prof.pDodge ? 1 : 0;
        const need = fh + br.blast * 0.75;
        if (br.bd && !locked && Math.abs(goal - br.x) < need) goal = br.x > 0 ? br.x - need - 0.2 : br.x + need + 0.2;
      }
      for (const bar of G.bars) {
        if (bar.dead || bar.z - G.P > 9 || bar.z < G.P) continue;
        if (bar.bd == null) bar.bd = rnd() < prof.pDodge ? 1 : 0;
        if (bar.bd && !locked && goal + fh > bar.x0 && goal - fh < bar.x1) goal = bar.x0 > -3 ? bar.x0 - fh - 0.3 : bar.x1 + fh + 0.3;
      }
      for (const h of G.hazards) { // telegraphed corruption: step out
        if (h.bd == null) h.bd = rnd() < prof.pDodge ? 1 : 0;
        if (h.bd && !locked && goal > h.x0 - fh - 0.3 && goal < h.x1 + fh + 0.3) goal = h.x0 > -ROADW + fh + 0.6 ? h.x0 - fh - 0.4 : h.x1 + fh + 0.4;
      }
      for (let i = 0; i < api.ESHOTS.n; i++) {
        const s = api.ESHOTS.a[i];
        const tArr = (s.z - G.P) / -s.vz;
        if (tArr > 1.1 || tArr < 0) continue;
        const hitX = s.x + s.vx * tArr;
        if (Math.abs(hitX - goal) > fh * 0.9 + 0.3) continue;
        if (s.dk === undefined || s.dk < 0) s.dk = rnd() < prof.pDodge ? 1 : 0;
        if (s.dk && !locked) goal = hitX + (hitX > goal ? -1 : 1) * (fh + 0.7);
      }
      if (small && !locked) { const m = Math.max(0, 2.2 - fh - 0.5); goal = clamp(goal, -m, m); } // never drift into the edge blocks
    } else if (G.phase === 'clash') {
      const b = G.boss;
      let pref = b ? (b.split ? (Math.abs(l.x - (b.x - 2.6)) < Math.abs(l.x - (b.x + 2.6)) ? b.x - 2.6 : b.x + 2.6) : b.x) : 0;
      goal = pref;
      const a = b && b.atk;
      if (a) {
        if (a.bd == null) a.bd = rnd() < prof.pDodge ? 1 : 0;
        if (a.bd && a.wind < 1.4) goal = safeX(x => api.ctx.inAttack ? api.ctx.inAttack(a, x) : false, pref);
      }
      for (const hz of G.hazards) { // lingering fire: step out, at the cost of standing off the boss
        if (hz.bd == null) hz.bd = rnd() < prof.pDodge ? 1 : 0;
        if (hz.bd && !(a && a.bd && a.wind < 1.4)) goal = safeX(x => x > hz.x0 && x < hz.x1, goal);
      }
      for (let i = 0; i < api.ESHOTS.n; i++) {
        const s = api.ESHOTS.a[i];
        const tArr = (s.z - G.P) / -s.vz;
        if (tArr > 0.9 || tArr < 0) continue;
        const hitX = s.x + s.vx * tArr;
        if (Math.abs(hitX - goal) > fh * 0.9 + 0.3) continue;
        if (s.dk === undefined || s.dk < 0) s.dk = rnd() < prof.pDodge ? 1 : 0;
        if (s.dk && !a) goal = hitX + (hitX > goal ? -1 : 1) * (fh + 0.7);
      }
    }
    l.tx = clamp(goal, -4.6, 4.6);
  };
}

// Play one level to the end (boss dead or squad wiped). Logs boss HP and live counts.
function playLevel(api, o) {
  const G = api.G;
  const r = api.rng(o.seed), r2 = api.rng(o.seed * 7 + 3);
  api.Math.random = r;
  api.Store.d.run = { level: o.L, relics: [], loop: 0, arch: o.arch || 'crossbow', weapon: o.weapon || 1 };
  api.Store.d.tut.base = true;
  G.sim = true;
  api.startLevel({ sim: true, up: o.up, plusOne: 0, weapon: o.weapon || 1, rnd: api.rng(o.seed * 13 + 1) });
  G.noBreak = !!o.noBreak;
  const think = makeBot(api, o.prof, r2);
  const dt = 1 / 60;
  let i = 0;
  const limit = 60 * (o.limit || 200), log = [];
  while (G.mode === 'play' && i < limit) {
    if (o.stopAtClash && G.phase !== 'run' && G.phase !== 'intro') break;
    if (i % 3 === 0) think();
    api.update(dt);
    if (G.mode === 'rally') G.mode = 'play';
    if (o.sample && i % Math.round(o.sample * 60) === 0) log.push({ t: +(i / 60).toFixed(2), p: +(G.P / G.Lr).toFixed(3), phase: G.phase, shots: api.SHOTS.n, enemies: api.ctx.liveAhead(), N: G.N, bossHP: G.boss ? Math.round(G.boss.hp) : 0 });
    i++;
  }
  const b = G.boss;
  return {
    L: o.L, won: G.mode === 'clear' || G.phase === 'done', died: G.mode === 'failed', t: i / 60, killP: G.stats.killP, killT: G.stats.killT,
    firstHitP: b && b.firstHitP, bossDmg: G.stats.bossDmg || 0, bossLeft: b ? b.hp : 0, arrive: G.stats.arrive || G.N, endN: G.N, coins: G.stats.coins,
    crates: G.stats.crates, cratesMissed: G.stats.cratesMissed, weapon: G.weapon, lost: G.stats.lost, flips: G.stats.flips, startN: G.startN, log,
  };
}

module.exports = { loadGame, makeBot, playLevel };
