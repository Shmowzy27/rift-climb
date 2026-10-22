// ============================================================================
// BALANCE + GATE MATH
// Pure functions only (no DOM) so tools/balance.mjs can run them under node.
// ============================================================================

const BAL = {
  startSoldiers: 10,
  squadCap: 9999,
  salvoRate: 2,            // squad volleys per second; one volley = count x per-soldier damage
  runSpeed: 10,            // world units per second at 1.0
  speedPerLevel: 0.02, speedCap: 1.5,
  roadBase: 45, roadPerLevel: 2, roadCap: 90, // seconds of running
  hpBase: 15, hpGrowth: 1.17, hpBreather: 1.11,
  coinBase: 5, coinGrowth: 1.08,
  // gate sets: best-gate growth per stage; second best within 25%; traps below
  gateGrowth: [2.0, 1.85, 1.5, 1.45, 1.42],
  gateGap: [0.256, 0.213, 0.159, 0.057, 0.025], // non-best gates trail the best by up to this fraction (per-level values in TUNING)
  squeezeChance: [0, 0.12, 0.12, 0.12, 0.12], // sets where every gate shrinks the squad
  // base assault
  assaultTime: 20, bossTime: 55, bossHpMult: 3,
  targetT: 14,              // average player breaks the base in ~14s (6s spare)
  decay: 0.03, decayFlat: 0.25, // defenders kill 3% of the squad per second on average (+0.25/s flat)
  decayTrickle: 0.01, barrageEvery: 1.6, barrageHit: 0.064, // 1%/s always + a 6.4% barrage every 1.6s; average player dodges half
  bossDecay: 0.012,         // boss fights average 1.2%/s: a small trickle + telegraphed strikes
  bossTrickle: 0.004, bossHit: 0.12,
  // per-soldier damage: scaled so an average squad two gates in kills a normal enemy in ~1 volley
  kappa: 2.5,
  enemyHpAvg: 1.2,          // average HP multiplier across archetypes
  contactAvg: 1.6,          // average soldiers lost per enemy that reaches the formation
  dmgBonusCap: 2.5,         // buffs + relics + gems never exceed +250% per-soldier damage
  simRuns: 601,
};

function stageOf(L) { return Math.min(5, Math.floor((L - 1) / 8) + 1); }
function isStageBoss(L) { return L % 8 === 0; }
function isBreather(L) { return L % 5 === 0 || (L - 1) % 8 === 0; }
function enemyHP(L, loop) {
  let h = BAL.hpBase * Math.pow(BAL.hpGrowth, L);
  if (isBreather(L)) h *= BAL.hpBreather / BAL.hpGrowth;
  return Math.max(2, Math.round(h * Math.pow(1.35, loop || 0)));
}
function enemiesFor(L) { return 8 + Math.floor(L * 2.2); }
function roadSeconds(L) { return Math.min(BAL.roadCap, BAL.roadBase + BAL.roadPerLevel * (L - 1)); }
function speedMult(L) { return Math.min(BAL.speedCap, 1 + BAL.speedPerLevel * (L - 1)); }
function spawnRateMult(L) { return Math.min(2.2, 1 + 0.04 * (L - 1)); }
function coinsPerKill(L) { return Math.max(1, Math.round(BAL.coinBase * Math.pow(BAL.coinGrowth, L))); }
function gateSetsFor(L) { return Math.min(9, 6 + Math.floor((L - 1) / 10)); }
function debuffWarnBase(L) { return L <= 8 ? 3.0 : L <= 16 ? 2.4 : L <= 24 ? 1.8 : 1.4; }

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------
const OP_SYM = { add: '+', sub: '−', mul: '×', div: '÷' };
function opLabel(o) { return OP_SYM[o.k] + o.n; }
function applyOp(v, o, roundUp) {
  switch (o.k) {
    case 'add': return v + o.n;
    case 'sub': return v - o.n;
    case 'mul': return v * o.n;
    case 'div': return roundUp ? Math.ceil(v / o.n) : Math.floor(v / o.n);
  }
  return v;
}
function gateResult(N, ops, roundUp) {
  let v = N;
  for (const o of ops) v = applyOp(v, o, roundUp);
  return Math.max(1, Math.min(BAL.squadCap, v));
}
function isPrime(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
function awkward(n) { // Stage 4+: numbers that resist mental shortcuts (+17, -23)
  if (n < 6) return n;
  let a = n; while (!(isPrime(a) || a % 10 === 3 || a % 10 === 7)) a++;
  return a;
}
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------------------
// Gate sets, generated from the CURRENT squad count so the choice stays close.
// Rule: best and second-best results land within 25% of each other.
// ---------------------------------------------------------------------------
// Gate forms. "free" forms carry a number we can solve for any target; "fixed"
// forms (xk, /k) have one natural result and anchor the set around it.
const FORMS = {
  add: { p: 'add', free: true, solve: (N, R) => (R > N ? [{ k: 'add', n: R - N }] : null) },
  sub: { p: 'sub', free: true, solve: (N, R) => (R < N ? [{ k: 'sub', n: N - R }] : null) },
  mulsub: { p: 'cmp', free: true, solve: (N, R, k) => (N * k - R >= 1 ? [{ k: 'mul', n: k }, { k: 'sub', n: N * k - R }] : null) },
  muladd: { p: 'cmp', free: true, solve: (N, R, k) => (R - N * k >= 1 ? [{ k: 'mul', n: k }, { k: 'add', n: R - N * k }] : null) },
  divadd: { p: 'cmp', free: true, solve: (N, R, k) => (R - Math.floor(N / k) >= 1 && N >= k ? [{ k: 'div', n: k }, { k: 'add', n: R - Math.floor(N / k) }] : null) },
  addmul: { p: 'cmp', free: true, solve: (N, R, k) => { const n = Math.round(R / k) - N; return n >= 1 ? [{ k: 'add', n }, { k: 'mul', n: k }] : null; } },
  submul: { p: 'cmp', free: true, solve: (N, R, k) => { const n = N - Math.round(R / k); return n >= 1 && N - n >= 1 ? [{ k: 'sub', n }, { k: 'mul', n: k }] : null; } },
};
function stageRules(st) {
  return {
    mulK: st <= 2 ? [2] : st === 3 ? [2, 3] : [2, 3, 4, 5, 7],
    divK: st <= 1 ? [] : st === 2 ? [2] : [2, 3],
    free: st === 1 ? ['add'] : st === 2 ? ['add', 'sub'] : ['add', 'sub', 'mulsub', 'muladd', 'divadd', 'addmul', 'submul'],
    k: st === 1 ? [2] : st === 2 ? [2, 2, 2, 3] : st === 3 ? [2, 3] : st === 4 ? [2, 3, 3] : [3],
    cmp: st === 5 ? 2 : st >= 3 ? 1 : 0,
    odd: st >= 4,
  };
}
const pickR = (a, rnd) => a[Math.floor(rnd() * a.length)];
// Per-level tuning written by `node tools/balance.mjs --write` into 15-tables.js
const TUNING = {};
function levelGap(L, st) { return (TUNING[L] && TUNING[L].gap) || BAL.gateGap[(st || stageOf(L)) - 1] * 6 / gateSetsFor(L); }

function makeGateSet(N, L, rnd, opt) {
  rnd = rnd || Math.random; opt = opt || {};
  N = Math.max(1, N);
  if (opt.tutorial === 'obvious') return finishSet([[{ k: 'mul', n: 2 }], [{ k: 'add', n: 1 }]], N, rnd);
  const st = opt.tutorial === 'real' ? 1 : stageOf(L);
  const R = stageRules(st);
  const gap = levelGap(L, st);
  for (let tries = 0; tries < 60; tries++) {
    const k = pickR(R.k, rnd);
    // at most one squeeze set per level, never among the first two (opt.allowSqueeze)
    const squeeze = !!opt.allowSqueeze && rnd() < BAL.squeezeChance[st - 1] * 2;
    let G = squeeze ? 0.78 + rnd() * 0.12 : BAL.gateGrowth[st - 1] * (0.95 + rnd() * 0.1);
    // slot multipliers relative to the best result
    const rel = [1, 1 - gap * (0.5 + 0.5 * rnd())];
    if (k === 3) rel.push(1 - gap * (1.1 + 0.5 * rnd()));
    const gates = [];
    const usedP = new Set();
    // anchor a fixed gate (x2, /2 ...) in one slot when its natural result fits
    let B = Math.round(N * G);
    const fixed = squeeze ? R.divK.map(d => ({ ops: [{ k: 'div', n: d }], r: Math.floor(N / d), p: 'div' }))
                          : R.mulK.map(m => ({ ops: [{ k: 'mul', n: m }], r: N * m, p: 'mul' }));
    if (fixed.length && (st === 1 || rnd() < 0.55)) {
      const f = pickR(fixed, rnd);
      const slot = Math.floor(rnd() * rel.length);
      const b2 = Math.round(f.r / rel[slot]);
      const ok = squeeze ? b2 < N && b2 >= Math.max(1, N * 0.75) : b2 >= N * G * 0.88 && b2 <= N * G * 1.15;
      if (ok && f.r >= 1) { B = b2; gates[slot] = f.ops; usedP.add(f.p); }
    }
    if (B <= (squeeze ? 0 : N)) continue;
    let cmp = 0;
    let fail = false;
    for (let i = 0; i < rel.length; i++) {
      if (gates[i]) continue;
      const target = Math.max(1, Math.round(B * rel[i]));
      let types = R.free.filter(t => !usedP.has(FORMS[t].p) || FORMS[t].p === 'cmp');
      if (cmp < R.cmp) { const c = types.filter(t => FORMS[t].p === 'cmp'); if (c.length) types = c; }
      types.sort(() => rnd() - 0.5);
      let ops = null;
      for (const t of types) {
        ops = FORMS[t].solve(N, target, pickR(R.mulK.length > 1 ? R.mulK.slice(0, 3) : [2], rnd));
        if (ops) { usedP.add(FORMS[t].p); if (FORMS[t].p === 'cmp') cmp++; break; }
      }
      if (!ops) { fail = true; break; }
      if (R.odd) for (const o of ops) if ((o.k === 'add' || o.k === 'sub') && rnd() < 0.8) o.n = awkward(o.n);
      gates[i] = ops;
    }
    if (fail || cmp < Math.min(R.cmp, rel.length)) continue;
    const out = finishSet(gates, N, rnd);
    if (validSet(out, N)) { out.squeeze = squeeze; return out; }
  }
  const n = Math.max(1, Math.round(N * 0.85));
  return finishSet([[{ k: 'mul', n: 2 }], [{ k: 'add', n }]], N, rnd);
}
function finishSet(set, N, rnd) {
  const gates = set.map(ops => ({ ops, label: ops.map(opLabel), result: gateResult(N, ops) }));
  for (let i = gates.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [gates[i], gates[j]] = [gates[j], gates[i]]; }
  return gates;
}
function validSet(gates, N) {
  const r = gates.map(g => g.result).sort((a, b) => b - a);
  if (N < 6) return r[1] < r[0];                 // tiny squads: integers can't honour the 25% rule
  if (r[1] >= r[0]) return false;                  // one gate must be strictly best
  if (r[0] / r[1] > 1.25) return false;            // ...but only just
  const labels = new Set(gates.map(g => g.label.join(' ')));
  if (labels.size !== gates.length) return false;
  const prim = new Set(gates.map(g => g.ops.length > 1 ? 'cmp' : g.ops[0].k));
  if (prim.size < 2) return false;                 // mix operation types
  return r[r.length - 1] >= 1;
}

// ---------------------------------------------------------------------------
// BALANCE CHECK
// Simulates a level for a player who picks the best gate with probability p,
// collects 60% of coins and takes one debuff. Road combat: each segment between
// gates has enemies; volleys of (count x damage) kill them; whatever survives
// reaches the formation and kills soldiers. At the base, defenders kill 3% of
// the squad per second, so the longer it takes the weaker you get.
// ---------------------------------------------------------------------------
function squadIntegral(N0, T, k, flat) { // integral of N(t) for dN/dt = -kN - flat
  const a = N0 + flat / k;
  const tz = Math.log(a / (flat / k)) / k; // time the squad would hit 0
  const t = Math.min(T, tz);
  return a * (1 - Math.exp(-k * t)) / k - (flat / k) * t;
}
function timeToBreak(hp, N0, dmg, k, flat, cap) {
  let lo = 0, hi = cap || 200;
  if (dmg * BAL.salvoRate * squadIntegral(N0, hi, k, flat) < hp) return Infinity;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (dmg * BAL.salvoRate * squadIntegral(N0, m, k, flat) >= hp) hi = m; else lo = m; }
  return hi;
}
function simLevel(L, pBest, rnd, dmg) {
  const sets = gateSetsFor(L), segs = sets + 1;
  const E = enemiesFor(L), hp = enemyHP(L) * BAL.enemyHpAvg;
  const segT = roadSeconds(L) / segs;
  const debuffSeg = 1 + Math.floor(rnd() * sets);
  let N = BAL.startSoldiers, N2 = N, lost = 0, squeezed = false;
  for (let s = 0; s < segs; s++) {
    if (s > 0) { // first stretch is open road
      const n = E / sets;
      const volley = Math.max(1, N * (dmg || 1) * (s === debuffSeg ? 0.85 : 1));
      const perEnemy = Math.ceil(hp / volley);
      const avail = BAL.salvoRate * segT * 0.75;
      const unkilled = Math.max(0, n - Math.floor(avail / perEnemy));
      const dodge = 0.5;
      const l = Math.min(N - 1, Math.round(unkilled * BAL.contactAvg * (1 - dodge) + N * 0.01));
      N -= l; lost += l;
    }
    if (s < sets) {
      const g = makeGateSet(N, L, rnd, { allowSqueeze: s >= 2 && !squeezed });
      if (g.squeeze) squeezed = true;
      const sorted = g.slice().sort((a, b) => b.result - a.result);
      N = rnd() < pBest ? sorted[0].result : sorted[1 + Math.floor(rnd() * (sorted.length - 1))].result;
      if (s === 1) N2 = N;
    }
  }
  return { N0: N, N2, lost };
}
function median(a) { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
function geomean(a) { let t = 0; for (const v of a) t += Math.log(Math.max(1, v)); return Math.round(Math.exp(t / a.length)); }

const LEVEL_CACHE = {};
function clearTuningCache() { for (const k in LEVEL_CACHE) delete LEVEL_CACHE[k]; }
// Per-level tuning derived from the simulation (deterministic seed per level).
function levelTuning(L, fresh) {
  if (!fresh && TUNING[L] && TUNING[L].baseHP) return { L, dmg: TUNING[L].dmg, baseHP: TUNING[L].baseHP, timer: isStageBoss(L) ? BAL.bossTime : BAL.assaultTime };
  if (LEVEL_CACHE[L]) return LEVEL_CACHE[L];
  const runs = BAL.simRuns;
  // pass 1: squad size two gates in -> per-soldier damage
  let r = rng(1000 + L);
  const n2 = []; for (let i = 0; i < runs; i++) n2.push(simLevel(L, BAL.avgPick, r, 1e9).N2);
  const dmg = Math.max(1, Math.round(BAL.kappa * enemyHP(L) * BAL.enemyHpAvg / median(n2)));
  // pass 2: arrival counts with that damage, average vs careless player
  r = rng(2000 + L);
  const avg = [], careless = [];
  for (let i = 0; i < runs; i++) { avg.push(simLevel(L, BAL.avgPick, r, dmg).N0); careless.push(simLevel(L, BAL.carelessPick || 0.35, r, dmg).N0); }
  const Na = geomean(avg), Nc = geomean(careless);
  const boss = isStageBoss(L);
  const k = boss ? BAL.bossDecay : BAL.decay;
  const baseHP = Math.round(dmg * BAL.salvoRate * squadIntegral(Na, BAL.targetT, BAL.decay, BAL.decayFlat) / 10) * 10;
  const hp = boss ? baseHP * BAL.bossHpMult : baseHP;
  const tAvg = timeToBreak(hp, Na, dmg, k, BAL.decayFlat);
  const tCareless = timeToBreak(hp, Nc, dmg, k, BAL.decayFlat);
  return (LEVEL_CACHE[L] = { L, dmg, baseHP: hp, Na, Nc, tAvg, tCareless, timer: boss ? BAL.bossTime : BAL.assaultTime });
}
BAL.carelessPick = 0.35;
BAL.avgPick = 0.7;

function balanceCheck() {
  const rows = [];
  for (let L = 1; L <= 40; L++) rows.push(levelTuning(L, true));
  return rows;
}

if (typeof module !== 'undefined') module.exports = { TUNING, clearTuningCache, BAL, stageOf, enemyHP, enemiesFor, roadSeconds, speedMult, coinsPerKill, gateSetsFor, makeGateSet, gateResult, opLabel, levelTuning, balanceCheck, rng, isStageBoss };
