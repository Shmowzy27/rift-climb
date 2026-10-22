// ============================================================================
// BALANCE + GATE MATH + UPGRADE ECONOMY
// Pure functions only (no DOM) so the node sim (tools/sim.mjs) can run them.
// ============================================================================

const BAL = {
  startSoldiers: 1,
  squadCap: 9999,
  drawCap: 60,              // soldiers drawn; the count above the squad is the truth
  gunCap: 25,               // past this many soldiers the front rank fires for everyone
  runSpeed: 10,             // world units per second at 1.0
  speedPerLevel: 0.008, speedCap: 1.3,
  roadBase: 62, roadPerLevel: 0.35, roadCap: 76, // seconds of running
  gates: 7,                 // gate sets per level
  hpBase: 6, hpGrowth: 1.21, breatherHP: 0.8,
  // par path: what a player taking the best gate (unpumped) carries into each gate
  growth: [1.6, 1.6, 1.6, 1.6, 1.6], // best-gate growth per stage once the squad is big enough to multiply
  parLoss: 0.12,            // share of the squad the road takes between gates
  gap: [0.09, 0.09, 0.08, 0.08, 0.07],  // second-best green trails the best by about this much at par
  redChance: [0.13, 0.15, 0.16, 0.18, 0.2], // sets that are all red (shoot to flip)
  pumpMax: { add: 3, mul: 3, sub: 6, div: 2, early: 9 }, // pump steps from untouched to fully pumped (early: +5 -> +14)
  pumpFloor: 12,            // a squad smaller than this pumps proportionally slower; bigger never pumps faster
  flipAt: 0.55,             // share of a red band's steps you must pour in before it flips
  assaultTime: [20, 20, 16, 16, 16], bossTime: 40,
  bossHitCap: 0.35,         // one boss strike deletes at most this share of the squad
  crowd: 0.15,              // enemy HP on the road per unit of the par squad's fire
  crowdStage: [1, 1, 1, 0.9, 0.6], // the Rift's crawlers blink, drift and wall up: fewer of them
  ddaAt: 0.8,               // below this share of par, part of the crowd ahead thins out
  crowdSpread: 1.6,         // extra bodies on the flanks that never reach the squad's line of fire
  hpPerShot: 0.85,            // a normal enemy takes ~this many par soldier-shots
  shotsPerSec: [0, 0.7, 1.0, 1.2, 1.3], // enemy return fire across the crowd, by stage
};

function stageOf(L) { return Math.min(5, Math.floor((L - 1) / 8) + 1); }
function isStageBoss(L) { return L % 8 === 0; }
function isBreather(L) { return L === 5 || L === 10; }
function enemyHP(L, loop) {
  let h = BAL.hpBase * Math.pow(BAL.hpGrowth, L - 1);
  if (isBreather(L)) h *= BAL.breatherHP;
  return h * Math.pow(1.35, loop || 0);
}
function roadSeconds(L) { return Math.min(BAL.roadCap, BAL.roadBase + BAL.roadPerLevel * (L - 1)); }
function speedMult(L) { return Math.min(BAL.speedCap, 1 + BAL.speedPerLevel * (L - 1)); }
function assaultTimer(L) { return isStageBoss(L) ? BAL.bossTime : BAL.assaultTime[stageOf(L) - 1]; }
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pickR = (a, rnd) => a[Math.floor(rnd() * a.length)];
const round1 = v => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Coins. Discs on the road carry printed values that scale with level.
// ---------------------------------------------------------------------------
function niceNum(v) { // 88, 120, 300, 1,250 ... values that look printed, not computed
  if (v < 100) return Math.max(1, Math.round(v));
  const m = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / m / 2) * m * 2;
}
function discValue(L, loop) { return niceNum(80 * (1 + 0.06 * (L - 1)) * Math.pow(1.3, loop || 0)); }
function cartValue(L, loop) { return niceNum(discValue(L, loop) * 7); }
function baseBonus(L, loop) { return niceNum(discValue(L, loop) * (isStageBoss(L) ? 16 : 8)); }

// ---------------------------------------------------------------------------
// Upgrades: three tracks bought between levels. 5 pips make a level (the badge);
// every 5th level costs gems instead of coins. Effects compound per level.
// ---------------------------------------------------------------------------
// Fire Rate cheap and frequent, Damage mid, Revenue expensive and capped (5 levels, x8.9):
// once maxed it buys a steady few extra pips of the other two, never a runaway.
const UPG = {
  rate: { id: 'rate', name: 'FIRE RATE', per: 1.08, a: 160, c: 1.45, gem: 2, max: 15, desc: '+8% shots per second per level' },
  dmg: { id: 'dmg', name: 'DAMAGE', per: 1.10, a: 290, c: 1.45, gem: 3, max: 15, desc: '+10% damage per soldier per level' },
  rev: { id: 'rev', name: 'REVENUE', per: 1.55, a: 600, c: 1.05, gem: 4, max: 25, desc: 'Multiplies every coin you pick up' },
};
const UPG_ORDER = ['rate', 'dmg', 'rev'];
function upLevel(p) { return Math.floor(p / 5); }
function isGemPip(p) { return (upLevel(p) + 1) % 5 === 0; }
function pipCost(k, p) {
  const u = UPG[k];
  if (u.max != null && p >= u.max) return null; // maxed
  if (isGemPip(p)) return { gems: u.gem + Math.floor(upLevel(p) / 5) };
  return { coins: niceNum(u.a * Math.pow(u.c, p)) };
}
function upMult(k, p) { return Math.pow(UPG[k].per, (p || 0) / 5); }
// "buys every upgrade they can afford": cheapest first until nothing is affordable
function buyUpgrades(up, wallet, tracks) {
  const bought = [];
  for (let guard = 0; guard < 400; guard++) {
    let best = null;
    for (const k of tracks) {
      const c = pipCost(k, up[k] || 0);
      if (!c) continue;
      const ok = c.gems ? wallet.gems >= c.gems : wallet.coins >= c.coins;
      if (ok && (!best || (c.coins || 0) < (best.c.coins || 0))) best = { k, c };
    }
    if (!best) break;
    if (best.c.gems) wallet.gems -= best.c.gems; else wallet.coins -= best.c.coins;
    up[best.k] = (up[best.k] || 0) + 1;
    bought.push(best.k);
  }
  return bought;
}

// ---------------------------------------------------------------------------
// Gate bands. A band's value moves while you shoot it: green climbs, red worsens,
// and a red band in an all-red set flips to a bonus once enough fire goes in.
// ---------------------------------------------------------------------------
const OP_SYM = { add: '+', sub: '−', mul: '×', div: '÷' };
const isRedOp = op => op === 'sub' || op === 'div';
function fmtOpN(op, n) { return op === 'mul' || op === 'div' ? String(round1(n)) : String(Math.round(n)); }
function bandLabel(b) { return OP_SYM[b.op] + fmtOpN(b.op, b.n); }
function applyBand(N, b, roundUp) {
  let v = N;
  switch (b.op) {
    case 'add': v = N + b.n; break;
    case 'sub': v = N - b.n; break;
    case 'mul': v = Math.round(N * b.n); break;
    case 'div': v = roundUp ? Math.ceil(N / b.n) : Math.floor(N / b.n); break;
  }
  return Math.max(1, Math.min(BAL.squadCap, v));
}
function stepFor(op, n, early) {
  if (op === 'add') return early ? 1 : Math.max(1, Math.round(n * 0.06));
  if (op === 'sub') return Math.max(1, Math.round(n * 0.25));
  if (op === 'mul') return 0.05;
  return 0.5;
}
function makeBand(op, n, early, canFlip) {
  n = op === 'mul' || op === 'div' ? round1(n) : Math.max(1, Math.round(n));
  return { op, n, base: n, step: stepFor(op, n, early), max: early && op === 'add' ? BAL.pumpMax.early : BAL.pumpMax[op], steps: 0, pts: 0, red: isRedOp(op), canFlip: !!canFlip, flipped: false, early: !!early, pop: 0 };
}
// one pump step: green climbs, red worsens; a flippable red turns green past the threshold
function pumpStep(b) {
  if (b.steps >= b.max) return null;
  b.steps++;
  if (b.red && b.canFlip && b.steps >= Math.ceil(b.max * BAL.flipAt)) {
    const was = b.op;
    b.op = was === 'div' ? 'mul' : 'add';
    b.n = was === 'div' ? 1.5 : b.base;
    b.red = false; b.flipped = true; b.canFlip = false;
    b.step = stepFor(b.op, b.n, b.early); b.max = b.early && b.op === 'add' ? BAL.pumpMax.early : BAL.pumpMax[b.op]; b.steps = 0;
    return 'flip';
  }
  b.n = b.op === 'mul' || b.op === 'div' ? round1(b.n + b.step) : b.n + b.step;
  return b.red ? 'worse' : 'up';
}
// soldier-seconds of fire per pump step: a par squad standing in front of the band
// from the moment it comes into range fills it exactly
function pumpCost(par, b, range, v) { return Math.max(par, BAL.pumpFloor) * (range / v) / b.max; }

function awkward(n) { // Stage 4+: numbers that resist mental shortcuts (+17, -23)
  if (n < 6) return n;
  let a = n; while (!(a % 10 === 3 || a % 10 === 7 || a % 10 === 9)) a++;
  return a;
}
// The par path: the squad a player brings into each gate taking the best band unpumped.
function parPath(L) {
  const st = stageOf(L), out = [];
  let N = BAL.startSoldiers;
  for (let i = 0; i < BAL.gates; i++) { out.push(N); N = parBest(N, i, st) * (1 - BAL.parLoss); }
  out.push(N);
  return out;
}
function parBest(N, i, st) {
  if (i === 0) return N + 5;
  if (N < 8) return N + (N < 4 ? 5 : 8);
  return N * BAL.growth[st - 1];
}

// One gate set, valued against the par squad for that gate. Which band is best depends on
// the squad you actually bring: ahead of par a multiplier wins, behind it an add often does.
function makeGateSet(par, i, L, rnd, opt) {
  rnd = rnd || Math.random; opt = opt || {};
  const st = stageOf(L), N = Math.max(1, par), early = N < 8;
  const B = parBest(N, i, st), gap = BAL.gap[st - 1] * (0.7 + rnd() * 0.6);
  const odd = st >= 4 && !early;
  const addN = r => { const n = Math.max(1, Math.round(r - N)); return odd ? awkward(n) : n; };
  // an unavoidable (all-red) set only ever subtracts, and gently; a red you can steer around can bite
  const red = canFlip => {
    if (!canFlip && !early && st >= 2 && rnd() < 0.35) return makeBand('div', 2, early, false);
    return makeBand('sub', Math.max(early ? 2 : 3, Math.round(N * (canFlip ? 0.12 + rnd() * 0.1 : 0.2 + rnd() * 0.15))), early, canFlip);
  };
  let kind = opt.kind || 'choice', bands;
  if (kind === 'red') {
    const n = rnd() < 0.6 ? 1 : 2;
    bands = Array.from({ length: n }, () => red(true));
    if (n === 2 && bandLabel(bands[0]) === bandLabel(bands[1])) bands[1] = makeBand('sub', bands[1].op === 'sub' ? bands[1].n + 2 : 3, early, true);
  } else {
    // best band
    let best;
    if (i === 0) best = makeBand('add', 5, true);
    else if (early) best = makeBand('add', addN(B), true);
    else best = rnd() < 0.55 ? makeBand('mul', round1(Math.max(1.3, B / N)), false) : makeBand('add', addN(B), false);
    const B2 = applyBand(N, best) * (1 - gap);
    let second;
    if (i === 0) second = makeBand('add', 3, true);
    else if (best.op === 'mul') second = makeBand('add', addN(B2), early);
    else if (!early || N >= 3) second = makeBand('mul', round1(Math.max(1.2, Math.min(best.op === 'add' && early ? 2 : 3, B2 / N))), early);
    else second = makeBand('add', Math.max(1, addN(B2)), early);
    if (applyBand(N, second) >= applyBand(N, best)) second = makeBand('add', Math.max(1, Math.round(applyBand(N, best) * (1 - gap) - N)), early);
    if (kind === 'split') bands = [best, second];       // the game seats these by side
    else if (st >= 2 && rnd() < 0.4) bands = shuffleR([best, second, red(false)], rnd);
    else bands = shuffleR(rnd() < 0.6 || i === 0 ? [best, second] : [best, red(false)], rnd);
  }
  return { kind, bands, par: N, i };
}
function shuffleR(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function bestBandIndex(set, N) {
  let bi = 0, bv = -1;
  set.bands.forEach((b, i) => { const v = applyBand(N, b); if (v > bv) { bv = v; bi = i; } });
  return bi;
}

// The whole level's gates, decided up front from the par path.
// kinds: choice | red (all red, flippable) | split (Stage 3+: divider, swarm on one side)
function planGates(L, rnd) {
  rnd = rnd || Math.random;
  const st = stageOf(L), par = parPath(L), out = [];
  let reds = 0;
  const maxReds = st >= 4 ? 2 : 1;
  const splitAt = st >= 3 ? 2 + Math.floor(rnd() * 3) : -1;           // one split per level
  const overlap = st >= 4 ? [1 + Math.floor(rnd() * 2), 4] : [];        // these sets sit right behind the one before
  for (let i = 0; i < BAL.gates; i++) {
    let kind = 'choice';
    if (i === splitAt) kind = 'split';
    else if (i >= 2 && reds < maxReds && rnd() < BAL.redChance[st - 1] * 2) { kind = 'red'; reds++; }
    const set = makeGateSet(par[i], i, L, rnd, { kind });
    set.overlap = overlap.includes(i) && kind !== 'split' && i - 1 !== splitAt;
    out.push(set);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-level tuning: per-soldier damage and base HP (written by tools/sim.mjs --write)
// ---------------------------------------------------------------------------
const TUNING = {};
// per-soldier damage grows with enemy HP, net of the upgrades an average buyer has by then
function dmgPerSoldier(L) {
  const t = TUNING[L];
  const u = t && t.uRef ? t.uRef : 1;
  return BAL.hpBase * Math.pow(BAL.hpGrowth, L - 1) / BAL.hpPerShot / u;
}
function levelTuning(L) {
  const t = TUNING[L] || {};
  const st = stageOf(L);
  // fallback before calibration: a par squad of ~60 for ~12s
  const par = parPath(L)[BAL.gates] * (1 - BAL.parLoss);
  const baseHP = t.baseHP || Math.round(par * dmgPerSoldier(L) * (t.uRef || 1) * 1.3 * (assaultTimer(L) - 5) * (isStageBoss(L) ? 0.7 : 1));
  return { L, st, dmg: dmgPerSoldier(L), baseHP, uRef: t.uRef || 1, timer: assaultTimer(L) };
}
// What the base shows: its own scale (four digits by mid-game), independent of the damage units.
// Hits are converted into it, so the number itself is the drama and the timing stays calibrated.
function baseDisplayHP(L, loop) { return niceNum(150 * Math.pow(1.17, L - 1) * (isStageBoss(L) ? 3 : 1) * Math.pow(1.35, loop || 0)); }
function endlessSpeed(t) { return Math.pow(1.03, Math.floor(t / 30)); }

if (typeof module !== 'undefined') module.exports = { BAL, TUNING, UPG, UPG_ORDER, stageOf, isStageBoss, isBreather, enemyHP, roadSeconds, speedMult, assaultTimer, rng, niceNum, discValue, cartValue, baseBonus, upLevel, isGemPip, pipCost, upMult, buyUpgrades, bandLabel, applyBand, pumpStep, pumpCost, parPath, makeGateSet, planGates, bestBandIndex, dmgPerSoldier, levelTuning, endlessSpeed, baseDisplayHP };
