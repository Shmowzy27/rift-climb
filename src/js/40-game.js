// ============================================================================
// GAME: world, squad, gates, combat, base assault, bosses
// World units: x across the road (-5..5), z along it. The leader runs at z = G.P.
// ============================================================================

const ROAD = 5;           // road half-width
const LEAD_DEPTH = 9;     // camera sits this far behind the leader
const RANGE = 48;         // squad fires at targets up to this far ahead
const V = {};

function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  let st = 0, sb = 0;
  const probe = document.getElementById('safe');
  if (probe) { const cs = getComputedStyle(probe); st = parseFloat(cs.paddingTop) || 0; sb = parseFloat(cs.paddingBottom) || 0; }
  V.w = w; V.h = h; V.top = st; V.bot = h - sb;
  V.hudY = V.top + 6;
  V.horizon = V.top + (V.bot - V.top) * 0.2;
  const leadY = V.top + (V.bot - V.top) * 0.64;
  V.F = 0.46 * w * LEAD_DEPTH / ROAD;                 // road half-width at the leader = 46% of screen
  V.camH = (leadY - V.horizon) * LEAD_DEPTH / V.F;
  V.cx = w / 2;
  V.pause = { x: 8, y: V.hudY, w: 44, h: 44 };
}
// project world (x, z, height) to screen
function proj(x, z, y) {
  const d = Math.max(0.6, z - (G.P - LEAD_DEPTH));
  const s = V.F / d;
  return { x: V.cx + (x - G.camX) * s, y: V.horizon + (V.camH - (y || 0)) * s, s, d };
}

const G = {
  mode: 'menu', t: 0, P: 0, camX: 0, timeScale: 1, shake: 0, flash: 0, flashCol: '#fff', push: 0,
  lead: { x: 0, tx: 0, vx: 0 }, N: 10, bodies: [],
  gates: [], enemies: [], bars: [], coins: [], picks: [], hazards: [], tracers: [], parts: [], texts: [], rings: [],
};
const hasRelic = id => G.relics && G.relics.includes(id);

// ---------------------------------------------------------------------------
// Runs and levels
// ---------------------------------------------------------------------------
function newRun(loop) {
  Store.d.run = { level: 1, coins: 0, relics: [], loop: loop || 0, cards: null };
  Store.save();
}
function startSoldiers() { return BAL.startSoldiers + 3 * shopLvl('reinf') + (hasRelic('quarter') ? 3 : 0) + (G.mods && G.mods.plus8 ? 8 : 0); }

function startLevel() {
  const run = Store.d.run, L = run.level;
  G.level = L; G.stage = stageOf(L); G.loop = run.loop || 0;
  G.relics = (run.relics || []).slice();
  G.mods = run.cards || {}; run.cards = null;
  const tune = levelTuning(L);
  G.dmg = tune.dmg;
  G.baseMax = Math.round(tune.baseHP * Math.pow(1.35, G.loop) * (L === 1 ? 0.6 : 1)); // L1 teaches, it doesn't test
  G.timerMax = tune.timer;
  G.v = BAL.runSpeed * speedMult(L);
  G.Lr = roadSeconds(L) * G.v;
  G.P = 0; G.camX = 0; G.lt = 0;
  G.lead = { x: 0, tx: 0, vx: 0 };
  G.N = startSoldiers(); G.Nmax = G.N; G.shownN = G.N; G.punch = 0;
  G.gates = []; G.enemies = []; G.bars = []; G.coins = []; G.picks = []; G.hazards = []; G.tracers = []; G.parts = []; G.texts = []; G.rings = [];
  G.salvoT = 0.6; G.buff = null; G.debuff = null; G.patientT = 0; G.streak = 0;
  G.vanguardAcc = 0; G.medicLeft = shopLvl('medic'); G.rallyUsed = false; G.lossAcc = 0;
  G.stats = { coins: 0, exact: 0, kills: 0, gems: 0, relic: false, bestStreak: 0 };
  G.phase = 'run'; G.base = null; G.boss = null; G.squeezed = false;
  G.timeScale = 1; G.slowT = 0; G.shake = 0; G.flash = 0; G.push = 0;
  G.tut = (L === 1 && !Store.d.tut.base) ? { step: 0, t: 0 } : null;
  G.banner = { title: 'LEVEL ' + L, sub: STAGES[G.stage - 1].short.toUpperCase(), t: 0, max: 2 };
  buildLevel();
  layoutBodies(true);
  G.mode = 'play';
  Music.play(G.stage - 1);
}

// Lay out gates, enemies, barricades and coins along the road.
function buildLevel() {
  const L = G.level, v = G.v, Lr = G.Lr, st = G.stage;
  const sets = gateSetsFor(L);
  const first = (G.tut ? 7 : 5) * v, last = Lr - 4 * v;
  const gz = [];
  for (let i = 0; i < sets; i++) gz.push(first + (last - first) * (sets === 1 ? 0 : i / (sets - 1)));
  if (G.tut) { gz[0] = 7 * v; gz[1] = 11.5 * v; }
  G.gates = gz.map((z, i) => ({ z, set: null, done: false, tut: G.tut ? (i === 0 ? 'obvious' : i === 1 ? 'real' : null) : null }));
  // segments between gates hold the fighting
  const segs = [];
  for (let i = 0; i < gz.length; i++) segs.push([gz[i] + 1.4 * v, (i + 1 < gz.length ? gz[i + 1] : Lr) - 1.4 * v]);
  if (G.tut) { segs[0][0] = 16 * v; } // keep the teaching stretch clean
  const E = enemiesFor(L);
  const hp = enemyHP(L, G.loop);
  const lanes = [-4, -2, 0, 2, 4];
  let placed = 0;
  const per = Math.ceil(E / segs.length);
  for (let si = 0; si < segs.length; si++) {
    const [a, b] = segs[si];
    if (b - a < 4) continue;
    let z = a + rand(0, 2);
    let eliteDone = st < 3;
    while (placed < E && z < b && placed < per * (si + 1)) {
      const roll = Math.random();
      let kind = 'normal';
      if (L >= 4 && roll < 0.14) kind = 'brute';
      else if (L >= 9 && roll < 0.28) kind = 'shielder';
      else if (L >= 13 && roll < 0.38) kind = 'leaper';
      else if (roll < 0.62) kind = 'runner';
      if (kind === 'runner') {
        const n = Math.min(randi(3, 5), E - placed), x0 = pick([-3, -1, 1, 3]);
        for (let i = 0; i < n; i++) addEnemy('runner', clamp(x0 + rand(-1.2, 1.2), -4.5, 4.5), z + i * 0.9, hp);
        placed += n; z += n * 0.9 + rand(4, 7) / spawnRateMult(L) * 1.6;
      } else {
        const elite = !eliteDone && Math.random() < 0.5;
        if (elite) eliteDone = true;
        addEnemy(kind, pick(lanes) + rand(-0.5, 0.5), z, hp, elite);
        placed++; z += rand(5, 9) / spawnRateMult(L) * 1.6;
      }
    }
  }
  // barricades from L4 (and one in the tutorial)
  if (L >= 4) for (let i = 1; i < segs.length; i += 2) {
    const [a, b] = segs[i]; if (b - a < 10) continue;
    const span = randi(1, 3) * 2, x0 = pick([-5, -3, -1, 1, 3].filter(x => x + span <= 5));
    addBarricade(x0, x0 + span, (a + b) / 2 + rand(-2, 2), hp * randi(4, 7));
  }
  if (G.tut) addBarricade(-5, -1, 15 * v, Math.max(10, hp * 3));
  // coins: arcs across the road and small clusters
  for (let z = 3 * v; z < Lr - 2 * v; z += rand(16, 26)) {
    if (G.gates.some(g => Math.abs(g.z - z) < 6)) continue;
    if (Math.random() < 0.55) { const x0 = rand(-4, 0), x1 = x0 + rand(3, 5); for (let i = 0; i < 7; i++) addCoin(lerp(x0, x1, i / 6), z + i * 1.1, 1.2 + Math.sin(i / 6 * Math.PI) * 1.6); }
    else { const x = rand(-4, 4); for (let i = 0; i < 5; i++) addCoin(x + rand(-0.6, 0.6), z + rand(-0.8, 0.8), 0.9); }
  }
  if (G.tut) for (const sd of [-1, 1]) for (let i = 0; i < 7; i++) addCoin(sd * (2 + i * 0.3), 1.5 * v * (sd > 0 ? 2 : 1) + i * 1.2 + 6, 1);
  // scheduled specials
  G.runnerAt = L >= 9 ? rand(0.25, 0.7) * Lr : Infinity;
  G.goldAt = L % 3 === 0 ? rand(0.3, 0.7) * Lr : Infinity;
  G.forceDebuffAt = L === 2 ? 0.25 * Lr : G.tut ? 19 * v : Infinity;
  G.corruptAt = L >= 33 ? rand(0.15, 0.3) * Lr : Infinity;
  G.baseZ = Lr + 16;
}
function looksFor(kind) {
  const st = G.stage;
  const sig = STAGES[st - 1].sig;
  if (kind === 'shielder') return 'husk';
  if (kind === 'leaper') return 'hound';
  if (kind === 'brute') return st === 2 ? 'oni' : sig;
  if (st === 2) return kind === 'runner' ? 'hound' : 'husk';
  return sig;
}
function addEnemy(kind, x, z, hp, elite, o) {
  const T = ENEMY_TYPES[kind];
  const look = (o && o.look) || looksFor(kind);
  let h = Math.max(2, Math.round(hp * T.hp * (elite ? BAL.eliteHpMult || 2.5 : 1)));
  const e = {
    kind, look, x, z, hp: h, maxHp: h, r: T.r * (elite ? 1.2 : 1) * (kind === 'brute' ? 1.1 : 1), speed: T.speed, kill: T.kill * (elite ? 2 : 1),
    elite: !!elite, active: false, t: rand(0, 5), flash: 0, split: kind !== 'runner' && kind !== 'normal', inv: 0, invT: rand(1.5, 3),
    shield: kind === 'shielder', strafe: look === 'ghost' ? rand(-1, 1) : 0, leap: null, dead: false,
  };
  if (look === 'drone') e.armored = true;
  G.enemies.push(e);
  return e;
}
function addBarricade(x0, x1, z, hp) { hp = Math.round(hp / 5) * 5; G.bars.push({ x0, x1, z, hp, maxHp: hp, dead: false, flash: 0 }); }
function addCoin(x, z, y) { G.coins.push({ x, z, y, taken: false, spin: rand(0, 6) }); }

// ---------------------------------------------------------------------------
// Formation
// ---------------------------------------------------------------------------
function spreadMult() { return (G.buff && G.buff.id === 'spread' ? 1.35 : 1) * (G.debuff && G.debuff.id === 'bunch' ? 0.6 : 1); }
function formHalf() { const n = Math.min(G.N, 40); const rows = Math.ceil((Math.sqrt(8 * n + 1) - 1) / 2); return (0.35 + rows * 0.2) * spreadMult(); } // full squad ~3.9 wide: always fits beside a boss sweep
function layoutBodies(snap) {
  const n = Math.min(G.N, 40), sp = 0.46 * spreadMult(), dz = 0.42;
  const old = G.bodies;
  const out = [];
  let row = 1, i = 0;
  while (i < n) {
    const inRow = Math.min(row + 1, n - i);
    for (let k = 0; k < inRow; k++, i++) {
      const ox = (k - (inRow - 1) / 2) * sp, oz = -row * dz - 0.2;
      const prev = old[i];
      out.push({ ox, oz, row, x: prev && !snap ? prev.x : G.lead.x + ox, frame: i % 4, pop: snap ? 0 : 1 - Math.min(1, i / 40) * 0.3, delay: i * 0.012 });
    }
    row++;
  }
  G.bodies = out;
}
function setCount(n, why) {
  const before = G.N;
  n = clamp(Math.round(n), 0, BAL.squadCap);
  G.N = n;
  G.Nmax = Math.max(G.Nmax, n);
  if (n !== before) {
    if (n < before) {
      // stumbling soldiers vanish in a puff
      const lost = Math.min(before, 40) - Math.min(n, 40);
      for (let i = 0; i < Math.max(1, lost); i++) {
        const b = G.bodies[Math.min(G.bodies.length - 1, Math.min(n, 40) + i)] || G.bodies[G.bodies.length - 1];
        if (b) G.parts.push({ kind: 'fall', x: b.x, z: G.P + b.oz, vx: rand(-2, 2), vy: rand(2, 5), y: 0, life: 0.5, max: 0.5 });
      }
    }
    layoutBodies(false);
  }
  if (G.N <= 0) squadDown();
  else if (G.N < 3 && !G.rallyUsed && G.Nmax >= 6 && Store.d.gems >= RALLY_COST && G.mode === 'play') { G.rallyUsed = true; G.mode = 'rally'; UI.rally(); }
}
function loseSoldiers(n) {
  if (n <= 0 || G.N <= 0) return;
  if (hasRelic('vanguard')) { G.vanguardAcc += n; n = Math.floor(G.vanguardAcc / 2); G.vanguardAcc -= n * 2; if (!n) return; }
  if (G.N - n <= 0 && G.medicLeft > 0) { G.medicLeft--; setCount(1); floatText(G.lead.x, G.P, 3, 'MEDIC!', '#5cff7a', 26); SFX.buff(); return; }
  setCount(G.N - n);
  SFX.lose(); Haptic.buzz(12);
  G.shake = Math.max(G.shake, 4);
}
function squadDown() {
  if (G.mode !== 'play') return;
  if (G.phase === 'assault') { baseFailed(); return; }
  G.mode = 'failed';
  SFX.fail();
  UI.failed();
}
function acceptRally() {
  if (Store.d.gems < RALLY_COST) { G.mode = 'play'; return; }
  Store.d.gems -= RALLY_COST; Store.save();
  G.mode = 'play';
  setCount(G.Nmax);
  G.flash = 0.6; G.flashCol = '#5cff7a';
  SFX.rally(); Haptic.buzz(25);
  G.punch = 1;
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------
function dmgBonus(vsBase) {
  let b = 0;
  if (G.buff && G.buff.id === 'dmg') b += 0.15 * G.buff.mag;
  b += 0.08 * shopLvl('marks');
  if (G.mods.dmg25) b += 0.25;
  if (hasRelic('patient')) b += Math.min(0.4, 0.08 * Math.floor(G.patientT / 10));
  if (vsBase) { b += 0.1 * shopLvl('siege'); if (hasRelic('siege')) b += 0.5; }
  return Math.min(BAL.dmgBonusCap, b);
}
function volley(vsBase) {
  let m = 1 + dmgBonus(vsBase);
  if (G.debuff && G.debuff.id === 'dmg') m *= 0.85;
  return Math.max(1, Math.round(G.N * G.dmg * m));
}
function fireRate() {
  let r = BAL.salvoRate;
  if (G.buff && G.buff.id === 'rate') r *= 1 + 0.15 * G.buff.mag;
  if (G.debuff && G.debuff.id === 'rate') r *= 0.85;
  return r;
}
function coinMult() {
  let m = 1;
  if (G.buff && G.buff.id === 'coin') m *= 1 + 0.5 * G.buff.mag;
  if (G.debuff && G.debuff.id === 'coin') m *= 0.75;
  if (G.mods.coin2) m *= 2;
  return m;
}
function gainCoins(n, x, z) {
  n = Math.max(1, Math.round(n * coinMult()));
  G.stats.coins += n;
  HUD.coinPulse = 1; HUD.plus.push({ n, t: 0 });
  return n;
}

function targetable(e) {
  if (e.dead || !e.active) return false;
  const d = e.z - G.P;
  if (d < 0.3 || d > RANGE) return false;
  if (e.inv) return false;
  if (e.shield && Math.abs(e.x - G.lead.x) < 1.6) return false; // frontal shield: flank it
  return true;
}
function findTargets() {
  const list = [];
  for (const e of G.enemies) if (targetable(e)) list.push({ e, d: e.z - G.P });
  const fh = formHalf();
  for (const b of G.bars) if (!b.dead && b.z - G.P > 0.3 && b.z - G.P < RANGE && b.x1 > G.lead.x - fh && b.x0 < G.lead.x + fh) list.push({ b, d: b.z - G.P });
  list.sort((a, b) => a.d - b.d);
  return list;
}
function shoot() {
  const ts = findTargets();
  if (!ts.length) return;
  const dmg = volley(false);
  hitTarget(ts[0], dmg);
  if (G.buff && G.buff.id === 'pierce') {
    // shots pierce one extra target; armored drones stop them
    const next = ts.find((t, i) => i > 0 && !(t.e && t.e.armored));
    if (next && !(ts[0].e && ts[0].e.armored)) hitTarget(next, dmg);
  }
  SFX.shoot(); muzzle(ts[0]);
}
function muzzle(t) {
  const tx = t.e ? t.e.x : clamp(G.lead.x, t.b.x0 + 0.3, t.b.x1 - 0.3);
  const tz = t.e ? t.e.z : t.b.z;
  const n = Math.min(10, G.bodies.length + 1);
  for (let i = 0; i < n; i++) {
    const b = i === 0 ? { x: G.lead.x, oz: 0 } : G.bodies[Math.floor(Math.random() * G.bodies.length)];
    G.tracers.push({ x0: b.x, z0: G.P + b.oz + 0.2, x1: tx + rand(-0.3, 0.3), z1: tz, t: 0.09 });
  }
}
function hitTarget(t, dmg) {
  if (t.e) damageEnemy(t.e, dmg);
  else damageBar(t.b, dmg);
}
function exactBreak(x, z, worth) {
  G.streak++; G.stats.exact++; G.stats.bestStreak = Math.max(G.stats.bestStreak, G.streak);
  SFX.exact(G.streak); Haptic.buzz(18);
  G.flash = Math.max(G.flash, 0.14); G.flashCol = '#ffd23d';
  floatText(x, z, 2.4, 'EXACT', '#ffd23d', 24);
  worldBurst(x, z, 1, 18, '#ffd23d', 7);
  return worth * 3;
}
function damageEnemy(e, dmg) {
  e.hp -= dmg; e.flash = 0.08;
  worldPuff(e.x, e.z, 0.8, '#ffffff');
  if (e.hp <= 0) {
    const exact = e.hp === 0;
    let worth = coinsPerKill(G.level) * (e.elite ? 3 : 1);
    if (e.kind === 'treasure') worth = Math.round(1.5 * enemiesFor(G.level) * coinsPerKill(G.level));
    if (exact) worth = exactBreak(e.x, e.z, worth); else G.streak = 0;
    const got = gainCoins(worth);
    killEnemy(e);
    floatText(e.x, e.z, 2, '+' + got, exact ? '#ffe58a' : '#ffc83d', 16);
    if (e.elite || e.kind === 'treasure') for (let i = 0; i < 6; i++) addCoin(e.x + rand(-1, 1), e.z + rand(-1, 1), 0.8);
    if (e.kind === 'treasure' && G.level >= 10 && Math.random() < 0.25) { G.stats.relic = true; floatText(e.x, e.z, 3.5, 'RELIC FOUND', '#c9a8ff', 22); }
    const chance = hasRelic('scavenger') ? 0.07 : 0.05;
    if (e.kind !== 'treasure' && Math.random() < chance) dropPickup();
    return;
  }
  // slimelings split in two at half HP; total HP is preserved
  if (e.look === 'slime' && !e.split && e.hp <= e.maxHp / 2 && e.hp >= 2) {
    const a = Math.ceil(e.hp / 2);
    e.split = true;
    const o = addEnemy(e.kind, clamp(e.x + 0.7, -4.6, 4.6), e.z + 0.4, 0, false, { look: 'slime' });
    o.hp = o.maxHp = e.hp - a; o.split = true; o.active = true; o.r = e.r * 0.8;
    e.hp = e.maxHp = a; e.r *= 0.8; e.x = clamp(e.x - 0.7, -4.6, 4.6);
    worldBurst(e.x, e.z, 0.6, 8, '#36d6b5', 4);
  }
}
function killEnemy(e) {
  e.dead = true; G.stats.kills++;
  SFX.kill();
  worldBurst(e.x, e.z, 0.7, 12, (ENEMY_LOOK[e.look] || ENEMY_LOOK.slime).c, 5);
}
function damageBar(b, dmg) {
  b.hp -= dmg; b.flash = 0.08;
  worldPuff(clamp(G.lead.x, b.x0 + 0.3, b.x1 - 0.3), b.z, 0.6, '#d8d2c4');
  if (b.hp <= 0) {
    const exact = b.hp === 0;
    let worth = coinsPerKill(G.level) * 2;
    if (exact) worth = exactBreak((b.x0 + b.x1) / 2, b.z, worth); else G.streak = 0;
    gainCoins(worth);
    b.dead = true;
    SFX.crumble();
    for (let i = 0; i < 6; i++) addCoin(rand(b.x0 + 0.3, b.x1 - 0.3), b.z + rand(1, 3), 0.8);
    worldBurst((b.x0 + b.x1) / 2, b.z, 0.5, 20, '#b9b2a4', 6);
  }
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
function warnTime() { return Math.max(1.4, debuffWarnBase(G.level)) + 0.2 * shopLvl('keen') + (hasRelic('hourglass') ? 0.4 : 0); }
function nearGate(z) { return G.gates.some(g => !g.done && z > g.z - 8 && z < g.z + 2); }
function dropPickup(forced) {
  let kind = forced || (Math.random() < 0.65 ? 'buff' : 'debuff');
  const lead = kind === 'debuff' ? warnTime() + (forced ? 1 : 0) : 2.6;
  let z = G.P + lead * G.v;
  if (z > G.Lr - 2) return;
  if (kind === 'debuff') {
    const live = G.picks.filter(p => p.kind === 'debuff' && !p.done);
    if (live.length >= (G.level >= 25 ? 2 : 1)) return;
    if (nearGate(z)) { z += 10; if (nearGate(z) || z > G.Lr - 2) return; }
    if (live.some(p => Math.abs(p.z - z) < 8)) return; // never side by side across the road
  }
  const ids = Object.keys(kind === 'debuff' ? DEBUFFS : BUFFS);
  G.picks.push({ kind, id: pick(ids), x: rand(-3.8, 3.8), z, born: G.lt, done: false, drift: kind === 'gold' ? 0.7 : 0 });
  if (kind === 'debuff') SFX.warn();
}
function updatePicks(dt) {
  const fh = formHalf();
  for (const p of G.picks) {
    if (p.done) continue;
    if (p.kind === 'gold') { p.x = clamp(p.x + Math.sin(G.lt * 0.8) * p.drift * dt * 2, -4, 4); p.z += G.v * 0.55 * dt; } // large and slow
    if (p.z - G.P > 0.4) continue;
    p.done = true;
    const dx = Math.abs(p.x - G.lead.x);
    if (p.kind === 'debuff') {
      if (dx < 0.9 + fh * 0.45) applyDebuff(p.id);
      else { SFX.puff(); worldBurst(p.x, p.z, 0.4, 10, '#ff8a9a', 3); floatText(p.x, p.z, 1.5, 'DODGED', '#ffd6dc', 16); }
      if (G.tut && G.tut.step === 3) G.tut.step = 4;
    } else if (dx < fh + 0.6) applyBuff(p.id, p.kind === 'gold' ? 3 : 1, p.kind === 'gold' ? 20 : 10);
  }
  G.picks = G.picks.filter(p => !p.done || false);
}
function applyBuff(id, mag, dur) {
  G.buff = { id, mag, t: dur, max: dur };
  SFX.buff(); Haptic.buzz(10);
  floatText(G.lead.x, G.P, 3, (mag > 1 ? 'GOLD ' : '') + BUFFS[id].name, mag > 1 ? '#ffd23d' : '#7dff8f', mag > 1 ? 24 : 20);
  worldBurst(G.lead.x, G.P, 1, 18, mag > 1 ? '#ffd23d' : '#5cff7a', 6);
  layoutBodies(false);
}
function applyDebuff(id) {
  G.debuff = { id, t: 8, max: 8 }; G.patientT = 0;
  SFX.debuff(); Haptic.buzz(28);
  G.shake = Math.max(G.shake, 5); G.flash = 0.2; G.flashCol = '#ff2040';
  floatText(G.lead.x, G.P, 3, DEBUFFS[id].name, '#ff8a9a', 20);
  layoutBodies(false);
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------
function gateSpans(n) { const w = ROAD * 2 / n; return Array.from({ length: n }, (_, i) => [-ROAD + i * w, -ROAD + (i + 1) * w]); }
function updateGates() {
  for (const g of G.gates) {
    if (g.done) continue;
    // generated about 3s out, from the count you have right now
    if (!g.set && g.z - G.P < 3.2 * G.v) {
      const idx = G.gates.indexOf(g);
      g.set = makeGateSet(G.N, G.level, Math.random, { tutorial: g.tut, allowSqueeze: idx >= 2 && !G.squeezed });
      if (g.set.squeeze) G.squeezed = true;
    }
    if (g.set && G.P >= g.z) passGate(g);
  }
}
function passGate(g) {
  g.done = true;
  const spans = gateSpans(g.set.length);
  let idx = spans.findIndex(([a, b]) => G.lead.x >= a && G.lead.x < b);
  if (idx < 0) idx = G.lead.x < 0 ? 0 : spans.length - 1;
  const gate = g.set[idx];
  g.picked = idx;
  let ops = gate.ops.map(o => ({ ...o }));
  let note = '';
  if (ops.some(o => o.k === 'add') && Math.random() < 0.03 * shopLvl('lucky')) { ops = ops.map(o => (o.k === 'add' ? { ...o, n: o.n * 2 } : o)); note = 'LUCKY! '; }
  if (ops.some(o => o.k === 'mul') && hasRelic('twin') && Math.random() < 0.05) { ops = ops.flatMap(o => (o.k === 'mul' ? [o, o] : [o])); note = 'TWIN! '; }
  const before = G.N;
  const after = gateResult(G.N, ops, hasRelic('remainder'));
  setCount(after);
  G.punch = 1; G.shownN = after;
  const col = gateColor(gate);
  G.flash = 0.18; G.flashCol = col;
  floatText(G.lead.x, G.P, 4.2, note + (after >= before ? '+' : '−') + fmtInt(Math.abs(after - before)), after >= before ? '#ffffff' : '#ffb3c1', 26);
  worldBurst(G.lead.x, G.P + 0.5, 1.5, 24, col, 7);
  SFX.gate(after >= before); Haptic.buzz(15);
  if (G.tut && G.tut.step < 2) G.tut.step++;
}

// ---------------------------------------------------------------------------
// Enemies on the road
// ---------------------------------------------------------------------------
function updateEnemies(dt) {
  const fh = formHalf();
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    const d = e.z - G.P;
    if (!e.active) { if (d < 55) e.active = true; else continue; }
    // ghosts strafe across lanes unpredictably
    if (e.look === 'ghost') { if (Math.random() < dt * 0.8) e.strafe = rand(-1, 1); e.x = clamp(e.x + e.strafe * 3.2 * dt, -4.6, 4.6); }
    // crawlers blink out, but are always visible 1.5s+ before contact
    if (e.look === 'crawler') {
      const tLeft = d / (G.v + e.speed);
      e.invT -= dt;
      if (e.invT <= 0) { e.inv = e.inv ? 0 : 1; e.invT = e.inv ? rand(0.7, 1.2) : rand(1.6, 2.6); }
      if (tLeft < 1.7) e.inv = 0;
    }
    if (e.kind === 'treasure') {
      e.runT += dt;
      e.z = G.P + 26 + Math.sin(e.runT * 0.5) * 2;
      e.x = lerp(e.fromX, -e.fromX, e.runT / 8);
      if (e.runT >= 8) { e.dead = true; floatText(e.x, e.z, 2, 'ESCAPED', '#bbbbbb', 18); }
      continue;
    }
    if (e.leap) {
      e.leap.t += dt / 0.7;
      const k = Math.min(1, e.leap.t);
      e.x = lerp(e.leap.x0, e.leap.x1, k); e.z = lerp(e.leap.z0, e.leap.z1, k); e.y = Math.sin(k * Math.PI) * 3.5;
      if (k >= 1) {
        e.dead = true;
        if (Math.abs(G.lead.x - e.x) < fh) { contact(e); worldBurst(e.x, e.z, 0.4, 14, '#ff3b5c', 5); }
        else { worldPuff(e.x, e.z, 0.3, '#cccccc'); floatText(e.x, e.z, 1.5, 'MISSED', '#dddddd', 15); }
      }
      continue;
    }
    let sp = e.speed;
    if (e.kind === 'brute' && e.look === 'oni') sp *= (e.t % 3) < 0.7 ? 3 : 0.6; // charging bursts
    e.z -= sp * dt;
    if (e.kind === 'leaper' && d < 7 && d > 2) { e.leap = { t: 0, x0: e.x, z0: e.z, x1: G.lead.x, z1: G.P - 1.2 }; SFX.warn(); continue; }
    if (e.z - G.P < 0.5) {
      if (Math.abs(e.x - G.lead.x) < fh + e.r) { contact(e); e.dead = true; }
      else if (e.z - G.P < -3) e.dead = true;
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}
function contact(e) {
  let n = e.kill;
  if (G.debuff && G.debuff.id === 'bunch') n = Math.ceil(n * 1.5);
  if (G.buff && G.buff.id === 'spread') n = Math.max(1, Math.floor(n * 0.6));
  worldBurst(e.x, G.P, 0.5, 10, '#ff3b5c', 5);
  loseSoldiers(n);
  G.streak = 0;
}
function updateBars() {
  const fh = formHalf();
  for (const b of G.bars) {
    b.flash = Math.max(0, b.flash - 0.016);
    if (b.dead || b.z - G.P > 0.5) continue;
    b.dead = true;
    const lo = Math.max(b.x0, G.lead.x - fh), hi = Math.min(b.x1, G.lead.x + fh);
    if (hi > lo) {
      const frac = (hi - lo) / (2 * fh);
      loseSoldiers(Math.max(2, Math.ceil(G.N * 0.3 * frac)));
      SFX.crumble(); G.shake = Math.max(G.shake, 8);
      worldBurst(G.lead.x, b.z, 0.5, 20, '#b9b2a4', 6);
    }
  }
}
function updateCoins(dt) {
  const fh = formHalf();
  for (const c of G.coins) {
    if (c.taken) continue;
    c.spin += dt * 5;
    const d = c.z - G.P;
    if (hasRelic('magnet') && d < 16 && d > 0) c.x += clamp(G.lead.x - c.x, -6 * dt, 6 * dt);
    if (d < 0.5 && d > -1.5) {
      if (Math.abs(c.x - G.lead.x) < fh + 0.4) { c.taken = true; gainCoins(Math.max(1, Math.round(coinsPerKill(G.level) * 0.4))); SFX.coin(randi(0, 10)); G.parts.push({ kind: 'coinfly', x: c.x, z: c.z, y: c.y, life: 0.5, max: 0.5 }); }
    }
    if (d < -3) c.taken = true;
  }
  G.coins = G.coins.filter(c => !c.taken);
}
function updateHazards(dt) {
  for (const h of G.hazards) {
    h.t += dt;
    if (!h.active && h.t >= h.warn) { h.active = true; h.t = 0; SFX.debuff(); }
    if (h.active) {
      if (h.t >= h.dur) { h.done = true; continue; }
      const fh = formHalf();
      const lo = Math.max(h.x0, G.lead.x - fh), hi = Math.min(h.x1, G.lead.x + fh);
      if (hi > lo) {
        h.tick = (h.tick || 0) + dt;
        if (h.tick > 0.5) { h.tick = 0; loseSoldiers(Math.max(1, Math.ceil(G.N * (h.kind === 'slime' ? 0.015 : 0.04) * (hi - lo) / (2 * fh)))); }
      }
    }
  }
  G.hazards = G.hazards.filter(h => !h.done);
}

// ---------------------------------------------------------------------------
// Base assault / boss
// ---------------------------------------------------------------------------
function startAssault() {
  G.phase = 'assault';
  G.arriveN = G.N;
  for (const e of G.enemies) if (!e.dead) { e.dead = true; worldPuff(e.x, e.z, 0.6, '#ffffff'); }
  G.picks = []; G.hazards = [];
  G.salvoT = 0.3;
  const boss = isStageBoss(G.level);
  G.base = { hp: G.baseMax, max: G.baseMax, timer: G.timerMax, z: G.baseZ, shake: 0, lossAcc: 0, boss };
  if (boss) {
    const kinds = ['brine', 'gorebrand', 'tyrant', 'echo', 'otherkai'];
    G.boss = { kind: kinds[G.stage - 1], atkT: 3, wind: 0, zone: null, flash: 0, plates: 4, slamAnim: 0, swingT: 0, mirror: G.N, rivalT: 6, hp: G.baseMax, maxHp: G.baseMax };
    G.nameCard = { name: STAGES[G.stage - 1].boss, sub: STAGES[G.stage - 1].bossSub, t: 0, max: 2.4 };
    SFX.wind();
  } else {
    G.banner = { title: 'BREAK THE BASE', sub: G.timerMax + ' SECONDS', t: 0, max: 1.4 };
  }
}
function updateAssault(dt) {
  const B = G.base;
  B.timer -= dt; B.shake = Math.max(0, B.shake - dt * 30);
  // defenders fire back: a steady trickle plus telegraphed barrages you can steer out of.
  // Dodging about half of them averages the tuned 3%/s; dodging all of them wins retries.
  const k = B.boss ? BAL.bossTrickle : BAL.decayTrickle;
  B.lossAcc += (G.N * k + BAL.decayFlat) * dt;
  if (B.lossAcc >= 1) { const n = Math.floor(B.lossAcc); B.lossAcc -= n; setCount(G.N - n); if (G.mode !== 'play') return; }
  if (Math.random() < dt * 6) G.tracers.push({ x0: rand(-4, 4), z0: B.z - 1, y0: 3, x1: G.lead.x + rand(-1.5, 1.5), z1: G.P, t: 0.1, enemy: true });
  if (!B.boss) {
    if (B.zone) {
      B.wind -= dt;
      if (B.wind <= 0) {
        const fh = formHalf();
        const lo = Math.max(B.zone[0], G.lead.x - fh), hi = Math.min(B.zone[1], G.lead.x + fh);
        if (hi > lo) loseSoldiers(Math.max(1, Math.round(G.N * BAL.barrageHit * Math.min(1, (hi - lo) / Math.min(2 * fh, B.zone[1] - B.zone[0])))));
        for (let i = 0; i < 8; i++) G.tracers.push({ x0: rand(-4, 4), z0: B.z - 1, y0: 3, x1: rand(B.zone[0], B.zone[1]), z1: G.P, t: 0.14, enemy: true });
        worldBurst((B.zone[0] + B.zone[1]) / 2, G.P, 0.2, 14, '#ff5a3a', 6);
        SFX.baseHit();
        B.zone = null; B.barT = BAL.barrageEvery - 0.8;
      }
    } else {
      B.barT = (B.barT == null ? 1 : B.barT) - dt;
      if (B.barT <= 0) {
        const w = ROAD * 2 * 0.4;
        const x0 = clamp(G.lead.x - w / 2 + rand(-1.5, 1.5), -ROAD, ROAD - w);
        B.zone = [x0, x0 + w]; B.wind = 0.8;
      }
    }
  }
  if (G.boss) updateBoss(dt);
  G.salvoT -= dt;
  if (G.salvoT <= 0) {
    G.salvoT += 1 / fireRate();
    const dmg = volley(true);
    B.hp -= dmg; B.shake = 4; G.shake = Math.max(G.shake, 2.5);
    if (G.boss) G.boss.flash = 0.08;
    const n = Math.min(12, G.bodies.length + 1);
    for (let i = 0; i < n; i++) { const b = i === 0 ? { x: G.lead.x, oz: 0 } : pick(G.bodies); G.tracers.push({ x0: b.x, z0: G.P + b.oz, x1: rand(-3, 3), z1: B.z - 0.5, y1: rand(1, 4), t: 0.09 }); }
    worldPuff(rand(-3, 3), B.z - 0.6, rand(1, 4), '#ffd6a0');
    SFX.shoot(); SFX.baseHit();
    if (B.hp <= 0) { const exact = B.hp === 0; B.hp = 0; baseDown(exact); return; }
  }
  if (B.timer <= 0) baseFailed();
}
function updateBoss(dt) {
  const b = G.boss;
  b.flash = Math.max(0, b.flash - dt); b.slamAnim = Math.max(0, b.slamAnim - dt * 2); b.swingT = Math.max(0, b.swingT - dt);
  b.mirror = G.N;
  if (b.zone) {
    b.wind -= dt;
    if (b.wind <= 0) {
      // the telegraphed strike: wipes the slice of the formation inside the zone
      const fh = formHalf();
      const lo = Math.max(b.zone[0], G.lead.x - fh), hi = Math.min(b.zone[1], G.lead.x + fh);
      if (hi > lo) { loseSoldiers(Math.max(1, Math.ceil(G.N * BAL.bossHit * Math.min(1, (hi - lo) / Math.min(2 * fh, b.zone[1] - b.zone[0]))))); floatText(G.lead.x, G.P, 3, 'HIT!', '#ff3b5c', 24); }
      else floatText(G.lead.x, G.P, 3, 'DODGED', '#ffffff', 22);
      if (b.kind === 'brine') G.hazards.push({ x0: b.zone[0], x1: b.zone[1], t: 0, warn: 0, active: true, dur: 3, kind: 'slime' });
      SFX.swing(); G.shake = Math.max(G.shake, 12); Haptic.buzz(25);
      b.swingT = 0.4; b.slamAnim = 1;
      worldBurst((b.zone[0] + b.zone[1]) / 2, G.P, 0.3, 26, b.kind === 'brine' ? '#36d6b5' : '#ff3b5c', 8);
      b.zone = null; b.atkT = b.kind === 'otherkai' ? 3.6 : b.kind === 'gorebrand' ? 4.5 : 5;
    }
    return;
  }
  b.atkT -= dt;
  if (b.atkT <= 0) {
    const frac = b.kind === 'gorebrand' ? 0.6 : b.kind === 'brine' ? 0.4 : 0.5; // the safe strip always fits a full squad
    const w = ROAD * 2 * frac;
    const x0 = Math.random() < 0.5 ? -ROAD : ROAD - w;
    const center = clamp(G.lead.x - w / 2 + rand(-1, 1), -ROAD, ROAD - w);
    b.zone = b.kind === 'gorebrand' ? [x0, x0 + w] : [center, center + w];
    b.wind = 2; SFX.warn();
  }
  // tyrant sheds plates in phases
  if (b.kind === 'tyrant') {
    const want = Math.ceil(4 * G.base.hp / G.base.max - 1e-9);
    if (b.plates > want) { b.plates = want; worldBurst(0, G.base.z, 3, 30, '#8a7a6a', 9); SFX.crumble(); G.shake = 12; floatText(0, G.base.z - 2, 5, 'PLATE BREAK', '#ffb02e', 24); }
  }
  // the echo and the other kai send a squad exactly your size
  if (b.kind === 'echo' || b.kind === 'otherkai') {
    b.rivalT -= dt;
    if (b.rivalT <= 0) {
      b.rivalT = 7;
      const r = addEnemy('normal', rand(-3, 3), G.base.z - 4, 0, false, { look: b.kind === 'echo' ? 'shade' : 'twin' });
      r.hp = r.maxHp = Math.max(2, G.N * G.dmg); r.kill = Math.max(1, Math.ceil(G.N * 0.25)); r.active = true; r.speed = 4; r.r = 1;
      floatText(r.x, r.z, 2, 'MIRROR ' + G.N, '#2bf0ff', 20);
    }
    updateEnemiesAssault(dt);
  }
}
function updateEnemiesAssault(dt) {
  G.salvoE = (G.salvoE || 0) - dt;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.z -= e.speed * dt; e.t += dt; e.flash = Math.max(0, e.flash - dt);
    if (G.salvoE <= 0) { damageEnemy(e, volley(false)); muzzle({ e }); G.salvoE = 0.5; }
    if (!e.dead && e.z - G.P < 0.5) { if (Math.abs(e.x - G.lead.x) < formHalf() + e.r) contact(e); e.dead = true; }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}
function baseDown(exact) {
  const B = G.base;
  B.dead = true;
  G.phase = 'done';
  let worth = coinsPerKill(G.level) * 25;
  if (exact) worth = exactBreak(0, B.z - 1, worth);
  gainCoins(worth);
  SFX.bossDie(); Haptic.buzz(45);
  G.shake = 18; G.flash = 0.7; G.flashCol = '#ffffff';
  G.timeScale = 0.25; G.slowT = 0.4; G.push = 0.001;
  for (let i = 0; i < 6; i++) worldBurst(rand(-4, 4), B.z - 0.5, rand(1, 5), 30, i % 2 ? '#ffffff' : '#ffb02e', 12);
  // gems: 35% chance, 2-10, rolled independently
  if (Math.random() < 0.35) {
    const n = Math.floor(Math.random() * 9) + 2;
    G.stats.gems = n; Store.d.gems += n; Store.save();
    for (let i = 0; i < n; i++) G.parts.push({ kind: 'gem', sx: V.cx + rand(-60, 60), sy: V.h * 0.4, vx: rand(-260, 260), vy: rand(-420, -160), life: 1.4 + i * 0.07, max: 1.4, delay: 0.4, i });
  }
  if (G.boss && G.level >= 10) G.stats.relic = true;
  G.doneT = 1.6;
}
function baseFailed() {
  if (G.mode !== 'play') return;
  G.mode = 'basefail';
  SFX.fail();
  UI.baseFail();
}
function retryBase() {
  G.mode = 'play';
  setCount(G.arriveN);
  G.base.hp = G.base.max; G.base.timer = G.timerMax; G.base.lossAcc = 0; G.base.zone = null; G.base.barT = 1;
  G.enemies = []; G.hazards = [];
  if (G.boss) { G.boss.zone = null; G.boss.atkT = 3; G.boss.plates = 4; G.boss.rivalT = 6; }
}

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------
function worldBurst(x, z, y, n, col, sp) {
  for (let i = 0; i < n; i++) G.parts.push({ kind: 'spark', x, z, y, vx: rand(-sp, sp), vz: rand(-sp, sp) * 0.5, vy: rand(0, sp), life: rand(0.3, 0.6), max: 0.6, size: rand(0.08, 0.2), col });
}
function worldPuff(x, z, y, col) { for (let i = 0; i < 3; i++) G.parts.push({ kind: 'puff', x: x + rand(-0.2, 0.2), z, y: y + rand(-0.2, 0.2), life: 0.3, max: 0.3, size: rand(0.25, 0.45), col }); }
function floatText(x, z, y, text, col, size) { G.texts.push({ x, z, y, text: String(text), col, size: size || 18, life: 1, max: 1 }); }
const HUD = { coinPulse: 0, plus: [], gemPulse: 0 };
function updateFx(dt) {
  for (const p of G.parts) {
    if (p.kind === 'gem') {
      if (p.delay > 0) { p.delay -= dt; p.vy += 700 * dt; p.sx += p.vx * dt; p.sy += p.vy * dt; continue; }
      const dx = HUD.gemX - p.sx, dy = HUD.gemY - p.sy, d = Math.hypot(dx, dy) || 1;
      const sp = 1400 * dt; p.sx += dx / d * Math.min(d, sp); p.sy += dy / d * Math.min(d, sp);
      if (d < 10) { p.life = 0; HUD.gemPulse = 1; SFX.gem(p.i); }
      continue;
    }
    p.life -= dt;
    if (p.kind === 'spark') { p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y + p.vy * dt); p.vy -= 18 * dt; }
    else if (p.kind === 'puff') p.y += dt * 1.5;
    else if (p.kind === 'fall') { p.y += p.vy * dt; p.vy -= 20 * dt; p.x += p.vx * dt; }
    else if (p.kind === 'coinfly') p.y += dt * 8;
    else if (p.kind === 'confetti') { p.sy += p.vy * dt; p.sx += p.vx * dt; p.vy += 200 * dt; p.rot += p.vr * dt; }
  }
  G.parts = G.parts.filter(p => p.life > 0);
  if (G.parts.length > 600) G.parts.splice(0, G.parts.length - 600);
  for (const t of G.texts) { t.life -= dt; t.y += dt * 1.6; }
  G.texts = G.texts.filter(t => t.life > 0);
  for (const t of G.tracers) t.t -= dt;
  G.tracers = G.tracers.filter(t => t.t > 0);
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt * 2.2);
  G.punch = Math.max(0, (G.punch || 0) - dt * 2.5);
  HUD.coinPulse = Math.max(0, HUD.coinPulse - dt * 5);
  HUD.gemPulse = Math.max(0, HUD.gemPulse - dt * 4);
  for (const p of HUD.plus) p.t += dt;
  HUD.plus = HUD.plus.filter(p => p.t < 0.9).slice(-4);
  for (const b of G.bodies) { b.pop = Math.max(0, b.pop - dt * 3); }
}

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------
function updateSteer(dt) {
  const l = G.lead;
  const spd = 9 * (1 + 0.1 * shopLvl('steady')) * (G.debuff && G.debuff.id === 'steer' ? 0.75 : 1);
  l.tx = clamp(l.tx, -ROAD + 0.4, ROAD - 0.4);
  const want = clamp((l.tx - l.x) * 9, -spd, spd);
  l.vx = lerp(l.vx, want, 1 - Math.exp(-dt * 14));
  l.x = clamp(l.x + l.vx * dt, -ROAD + 0.4, ROAD - 0.4);
  // soldiers follow with a little lag; further back = heavier
  for (const b of G.bodies) {
    const k = 12 / (1 + b.row * 0.35);
    b.x += (l.x + b.ox - b.x) * (1 - Math.exp(-dt * k));
  }
  G.camX = lerp(G.camX, l.x * 0.45, 1 - Math.exp(-dt * 4));
}
function update(dt) {
  G.t += dt;
  updateFx(dt);
  if (G.mode !== 'play') return;
  G.lt += dt;
  if (G.slowT > 0) { G.slowT -= dt / Math.max(0.05, G.timeScale); if (G.slowT <= 0) G.timeScale = 1; }
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.max) G.banner = null; }
  if (G.nameCard) { G.nameCard.t += dt; if (G.nameCard.t > G.nameCard.max) G.nameCard = null; }
  if (G.buff) { G.buff.t -= dt; if (G.buff.t <= 0) { G.buff = null; layoutBodies(false); } }
  if (G.debuff) { G.debuff.t -= dt; if (G.debuff.t <= 0) { G.debuff = null; layoutBodies(false); } }
  if (!G.debuff) G.patientT += dt;
  updateSteer(dt);
  if (G.tut) updateTutorial(dt);
  if (G.phase === 'run') {
    G.P += G.v * dt;
    for (const b of G.bodies) b.frame = (b.frame + dt * 9) % 4;
    G.runFrame = ((G.runFrame || 0) + dt * 9) % 4;
    updateGates();
    updateEnemies(dt);
    updateBars();
    updateCoins(dt);
    updatePicks(dt);
    updateHazards(dt);
    G.salvoT -= dt;
    if (G.salvoT <= 0) { G.salvoT += 1 / fireRate(); shoot(); }
    if (G.P >= G.runnerAt) {
      G.runnerAt = Infinity;
      const e = addEnemy('treasure', 0, G.P + 26, enemyHP(G.level, G.loop), false, { look: 'treasure' });
      e.active = true; e.runT = 0; e.fromX = pick([-1, 1]) * 5.5; e.x = e.fromX;
      floatText(0, e.z, 3, 'TREASURE!', '#ffd23d', 24); SFX.tile();
    }
    if (G.P >= G.goldAt) { G.goldAt = Infinity; G.picks.push({ kind: 'gold', id: pick(Object.keys(BUFFS)), x: rand(-3, 3), z: G.P + 40, done: false, drift: 1, born: G.lt }); floatText(0, G.P + 40, 4, 'GOLD', '#ffd23d', 28); SFX.warn(); }
    if (G.P >= G.forceDebuffAt) { G.forceDebuffAt = Infinity; const was = G.picks.length; dropPickup('debuff'); if (G.picks.length > was) { const p = G.picks[G.picks.length - 1]; p.id = 'rate'; p.x = clamp(G.lead.x, -3, 3); if (G.tut) { p.z = G.P + 4.5 * G.v; G.tut.step = 3; } } }
    if (G.P >= G.corruptAt) {
      G.corruptAt = G.P + rand(18, 26) * G.v / 2;
      const w = randi(1, 3) * 2, x0 = pick([-5, -3, -1, 1, 3].filter(x => x + w <= 5 - 2)); // never the full width
      G.hazards.push({ x0, x1: x0 + w, t: 0, warn: 3, active: false, dur: 10, kind: 'corrupt' });
    }
    if (G.P >= G.Lr) { G.P = G.Lr; startAssault(); }
  } else if (G.phase === 'assault') {
    updateAssault(dt);
    updateHazards(dt);
  } else if (G.phase === 'done') {
    G.push = Math.min(1, G.push + dt * 1.2);
    G.doneT -= dt;
    if (G.doneT <= 0) levelComplete();
  }
}

function updateTutorial(dt) {
  const T = G.tut;
  T.t += dt;
  if (T.step >= 4 && G.P > 24 * G.v) { Store.d.tut.base = true; Store.save(); G.tut = null; }
}

// ---------------------------------------------------------------------------
// Level complete
// ---------------------------------------------------------------------------
function levelComplete() {
  G.mode = 'clear';
  const L = G.level, run = Store.d.run, d = Store.d;
  const rec = d.records[L] || 0;
  let bonus = 0;
  if (G.stats.exact > rec && G.stats.exact > 0) { bonus = G.stats.exact * coinsPerKill(L) * 5; d.records[L] = G.stats.exact; }
  const mult = +(1 + Math.min(2, G.N / 100)).toFixed(2);
  const total = Math.round((G.stats.coins + bonus) * mult);
  const skin = SKINS.find(s => s.unlock === L && !d.skinsOwned.includes(s.id));
  if (skin) d.skinsOwned.push(skin.id);
  if (isStageBoss(L) && !d.story.includes('post' + G.stage)) d.story.push('post' + G.stage);
  d.best = Math.max(d.best, L);
  run.coins = (run.coins || 0) + total;
  d.bestScore = Math.max(d.bestScore || 0, run.coins);
  run.relics = G.relics.slice();
  run.level = L + 1;
  if (L === 40) { d.runsDone = (d.runsDone || 0) + 1; d.loop = (run.loop || 0) + 1; }
  Store.save();
  SFX.clear();
  celebrate(L, isStageBoss(L));
  UI.levelClear({ level: L, coins: G.stats.coins, bonus, mult, total, squad: G.N, exact: G.stats.exact, record: rec, gems: G.stats.gems, relic: G.stats.relic, skin, stageClear: isStageBoss(L), ending: L === 40, streak: G.stats.bestStreak, score: run.coins });
}
function celebrate(L, big) {
  const n = 40 + L * 5 + (big ? 120 : 0);
  const cols = ['#ffd23d', '#ff3b5c', '#2de1c2', '#7ad7ff', '#ff4fb8', '#ffffff'];
  for (let i = 0; i < n; i++) G.parts.push({ kind: 'confetti', sx: rand(0, V.w), sy: rand(-200, -10), vx: rand(-60, 60), vy: rand(60, 240), life: rand(2, 3.5) + L * 0.03, max: 3.5, size: rand(4, 9), col: pick(cols), rot: rand(0, TAU), vr: rand(-8, 8) });
}
