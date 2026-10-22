// ============================================================================
// GAME: world, squad, gates, weapons, base assault, bosses (pure logic)
// World units: x across the road (-5..5), z along it. The leader runs at z = G.P.
// ============================================================================

const ROAD = 5;           // road half-width
const V = {};             // screen layout for the HUD

function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  let st = 0, sb = 0;
  const probe = document.getElementById('safe');
  if (probe) { const cs = getComputedStyle(probe); st = parseFloat(cs.paddingTop) || 0; sb = parseFloat(cs.paddingBottom) || 0; }
  V.w = w; V.h = h; V.top = st; V.bot = h - sb;
  V.hudY = V.top + 6;
  V.cx = w / 2;
  V.pause = { x: 8, y: V.hudY, w: 44, h: 44 };
}

const G = {
  mode: 'menu', t: 0, P: 0, camX: 0, timeScale: 1, shake: 0, flash: 0, flashCol: '#fff', push: 0,
  lead: { x: 0, tx: 0, vx: 0 }, N: 10, bodies: [], arch: 'crossbow',
  gates: [], enemies: [], bars: [], coins: [], picks: [], hazards: [], shots: [], beams: [], slashes: [], tracers: [], parts: [], texts: [],
};
const hasRelic = id => G.relics && G.relics.includes(id);
const archDef = () => ARCH[G.arch];

// ---------------------------------------------------------------------------
// Runs and levels
// ---------------------------------------------------------------------------
function newRun(loop) {
  Store.d.run = { level: 1, coins: 0, relics: [], loop: loop || 0, cards: null, arch: null };
  Store.save();
}
function startSoldiers() { return BAL.startSoldiers + 3 * shopLvl('reinf') + (hasRelic('quarter') ? 3 : 0) + (G.mods && G.mods.plus8 ? 8 : 0); }
function stageArch(L, run) { const a = STAGES[stageOf(L) - 1].arch; return a || (run && run.arch) || 'crossbow'; }

function startLevel() {
  const run = Store.d.run, L = run.level;
  G.level = L; G.stage = stageOf(L); G.loop = run.loop || 0;
  G.arch = stageArch(L, run);
  G.relics = (run.relics || []).slice();
  G.mods = run.cards || {}; run.cards = null;
  const tune = levelTuning(L), A = archDef();
  const rift = G.stage === 5;
  G.dmg = tune.dmg * A.dmgF * (rift ? A.riftDmg : 1); // per-soldier damage for this archetype
  // the base is tuned so this archetype's volleys break it in ~14s for an average squad
  const archBase = A.rate * (rift ? A.riftRate : 1) * A.dmgF * (rift ? A.riftDmg : 1) / BAL.salvoRate * (isStageBoss(L) && G.arch === 'blade' ? BAL.meleeBossUptime : 1);
  G.baseMax = Math.round(tune.baseHP * archBase * BAL.arrivalFactor[G.stage - 1] * Math.pow(1.35, G.loop) * (L === 1 ? 0.6 : 1)); // L1 teaches, it doesn't test
  G.timerMax = tune.timer;
  G.v = BAL.runSpeed * speedMult(L);
  G.Lr = roadSeconds(L) * G.v;
  G.P = 0; G.camX = 0; G.lt = 0;
  G.lead = { x: 0, tx: 0, vx: 0 };
  G.N = startSoldiers(); G.Nmax = G.N; G.punch = 0;
  G.gates = []; G.enemies = []; G.bars = []; G.coins = []; G.picks = []; G.hazards = []; G.shots = []; G.beams = []; G.slashes = []; G.tracers = []; G.parts = []; G.texts = [];
  G.fireT = 0.6; G.charges = 3; G.buff = null; G.debuff = null; G.patientT = 0; G.streak = 0;
  G.vanguardAcc = 0; G.medicLeft = shopLvl('medic'); G.rallyUsed = false;
  G.stats = { coins: 0, exact: 0, kills: 0, gems: 0, relic: false, bestStreak: 0, useful: 0, potential: 0 };
  G.phase = 'run'; G.base = null; G.boss = null; G.squeezed = false;
  G.timeScale = 1; G.slowT = 0; G.shake = 0; G.flash = 0; G.push = 0; G.recoil = 0; G.swing = 0;
  G.tut = (L === 1 && !Store.d.tut.base) ? { step: 0, t: 0 } : null;
  G.banner = { title: 'LEVEL ' + L, sub: STAGES[G.stage - 1].short.toUpperCase() + ' · ' + A.squad, t: 0, max: 2.2 };
  buildLevel();
  layoutBodies(true);
  G.mode = 'play';
  Music.play(G.stage - 1);
  if (typeof GFX !== 'undefined') GFX.onLevel();
}

function roleWeights(L) {
  const prof = G.stage === 5 ? RIFT_PROFILES[L] : null;
  const w = { brute: L >= 4 ? 0.14 : 0, shielder: L >= 9 ? 0.14 : 0, leaper: L >= 13 ? 0.1 : 0, runner: 0.24, normal: 0 };
  if (G.stage === 1 || G.stage >= 3) w.shielder = 0; // shielders belong to the Ember Spire
  if (prof === 'packs') { w.runner = 0.5; w.brute = 0.06; }
  if (prof === 'brutes') { w.brute = 0.35; w.runner = 0.12; }
  if (prof === 'drift') { w.leaper = 0.25; w.runner = 0.3; }
  if (prof === 'shields') { w.shielder = 0.7; w.runner = 0.1; w.brute = 0.05; }
  w.normal = Math.max(0.1, 1 - w.brute - w.shielder - w.leaper - w.runner);
  return w;
}
function pickRole(w) {
  let r = Math.random();
  for (const k of ['brute', 'shielder', 'leaper', 'runner', 'normal']) { if ((r -= w[k]) <= 0) return k; }
  return 'normal';
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
  const segs = [];
  for (let i = 0; i < gz.length; i++) segs.push([gz[i] + 1.4 * v, (i + 1 < gz.length ? gz[i + 1] : Lr) - 1.4 * v]);
  if (G.tut) segs[0][0] = 16 * v;
  const E = enemiesFor(L), hp = enemyHP(L, G.loop);
  const lanes = [-4, -2, 0, 2, 4];
  const W = roleWeights(L);
  let placed = 0, quota = 0;
  // the fighting ramps up through the level: light while the squad is small, heavier later
  const wsum = segs.reduce((a, _, i) => a + segWeight(i, segs.length), 0);
  for (let si = 0; si < segs.length; si++) {
    const [a, b] = segs[si];
    quota += E * segWeight(si, segs.length) / wsum;
    if (b - a < 4) continue;
    let z = a + rand(0, 2);
    let eliteDone = st < 3;
    while (placed < E && z < b && placed < Math.round(quota)) {
      const role = pickRole(W);
      if (role === 'runner') {
        const wide = G.stage === 5 && RIFT_PROFILES[L] === 'packs'; // Rift swarms spread across the road
        const n = Math.min(randi(3, 5) + (wide ? 1 : 0), E - placed), x0 = wide ? 0 : pick([-3, -1, 1, 3]);
        for (let i = 0; i < n; i++) addEnemy('runner', clamp(x0 + (wide ? rand(-4, 4) : rand(-1.2, 1.2)), -4.5, 4.5), z + i * (wide ? 0.5 : 0.9), hp);
        placed += n; z += n * 0.9 + rand(4, 7) / spawnRateMult(L) * 1.6;
      } else {
        const elite = !eliteDone && Math.random() < 0.5;
        if (elite) eliteDone = true;
        addEnemy(role, pick(lanes) + rand(-0.5, 0.5), z, hp, elite);
        placed++; z += rand(5, 9) / spawnRateMult(L) * 1.6;
      }
    }
  }
  if (L >= 4) for (let i = 1; i < segs.length; i += 2) {
    const [a, b] = segs[i]; if (b - a < 10) continue;
    const span = randi(1, 3) * 2, x0 = pick([-5, -3, -1, 1, 3].filter(x => x + span <= 5));
    addBarricade(x0, x0 + span, (a + b) / 2 + rand(-2, 2), hp * randi(4, 7));
  }
  if (G.tut) addBarricade(-5, -1, 15 * v, Math.max(10, hp * 3));
  for (let z = 3 * v; z < Lr - 2 * v; z += rand(16, 26)) {
    if (G.gates.some(g => Math.abs(g.z - z) < 6)) continue;
    if (Math.random() < 0.55) { const x0 = rand(-4, 0), x1 = x0 + rand(3, 5); for (let i = 0; i < 7; i++) addCoin(lerp(x0, x1, i / 6), z + i * 1.1, 1.0 + Math.sin(i / 6 * Math.PI) * 1.4); }
    else { const x = rand(-4, 4); for (let i = 0; i < 5; i++) addCoin(x + rand(-0.6, 0.6), z + rand(-0.8, 0.8), 0.8); }
  }
  if (G.tut) for (const sd of [-1, 1]) for (let i = 0; i < 7; i++) addCoin(sd * (2 + i * 0.3), 1.5 * v * (sd > 0 ? 2 : 1) + i * 1.2 + 6, 0.9);
  G.runnerAt = L >= 9 ? rand(0.25, 0.7) * Lr : Infinity;
  G.goldAt = L % 3 === 0 ? rand(0.3, 0.7) * Lr : Infinity;
  G.forceDebuffAt = L === 2 ? 0.25 * Lr : G.tut ? 19 * v : Infinity;
  G.corruptAt = L >= 33 ? rand(0.15, 0.3) * Lr : Infinity;
  // melee squads fight the wall face to face
  G.baseZ = Lr + (G.arch === 'blade' ? 2.6 : 16);
}
function addEnemy(kind, x, z, hp, elite, o) {
  const T = ENEMY_TYPES[kind];
  const look = (o && o.look) || STAGE_LOOKS[G.stage - 1][kind] || 'slime';
  const h = Math.max(2, Math.round(hp * T.hp * (elite ? 2.5 : 1)));
  const e = {
    kind, look, x, z, y: 0, hp: h, maxHp: h, pending: 0, r: T.r * (elite ? 1.2 : 1) * (kind === 'brute' ? 1.1 : 1), speed: T.speed, kill: T.kill * (elite ? 2 : 1),
    elite: !!elite, active: false, t: rand(0, 5), flash: 0, split: look !== 'slime' || kind === 'brute', inv: 0, invT: rand(1.5, 3),
    shield: kind === 'shielder', strafe: 0, leap: null, dead: false, struck: false, id: Math.random(),
  };
  if (look === 'drone' || look === 'bigdrone' || look === 'bigcrawler') e.armored = true; // armor stops beams
  if (G.stage === 5 && kind === 'runner') e.speed *= 0.75; // crawler swarms creep rather than sprint
  if (G.stage === 5 && (kind === 'leaper' || kind === 'brute')) e.kill = Math.max(1, e.kill - 1); // crawlers bite, they don't crush
  const prof = G.stage === 5 ? RIFT_PROFILES[G.level] : null;
  if (look === 'ghost' || look === 'wisp' || (prof === 'drift' && look === 'crawler')) e.strafe = rand(-1, 1);
  G.enemies.push(e);
  return e;
}
function addBarricade(x0, x1, z, hp) { hp = Math.round(hp / 5) * 5; G.bars.push({ x0, x1, z, hp, maxHp: hp, dead: false, flash: 0, pending: 0, struck: false }); }
function addCoin(x, z, y) { G.coins.push({ x, z, y, taken: false, spin: rand(0, 6) }); }

// ---------------------------------------------------------------------------
// Formation
// ---------------------------------------------------------------------------
function spreadMult() { return (G.buff && G.buff.id === 'spread' ? 1.35 : 1) * (G.debuff && G.debuff.id === 'bunch' ? 0.6 : 1); }
function formHalf() { const n = Math.min(G.N, 40); const rows = Math.ceil((Math.sqrt(8 * n + 1) - 1) / 2); return (0.35 + rows * 0.2) * spreadMult(); } // full squad ~3.9 wide: always fits beside a boss sweep
function layoutBodies(snap) {
  const n = Math.min(G.N, 40), sp = 0.52 * spreadMult(), dz = 0.5;
  const old = G.bodies, out = [];
  let row = 1, i = 0;
  while (i < n) {
    const inRow = Math.min(row + 1, n - i);
    for (let k = 0; k < inRow; k++, i++) {
      const ox = (k - (inRow - 1) / 2) * sp, oz = -row * dz - 0.2;
      const prev = old[i];
      out.push({ ox, oz, row, x: prev && !snap ? prev.x : G.lead.x + ox, ph: prev ? prev.ph : rand(0, TAU), pop: snap ? 0 : 1, delay: row * 0.04 });
    }
    row++;
  }
  G.bodies = out;
}
function setCount(n) {
  const before = G.N;
  n = clamp(Math.round(n), 0, BAL.squadCap);
  G.N = n;
  G.Nmax = Math.max(G.Nmax, n);
  if (n !== before) {
    if (n < before) {
      const lost = Math.max(1, Math.min(before, 40) - Math.min(n, 40));
      for (let i = 0; i < lost; i++) {
        const b = G.bodies[Math.min(G.bodies.length - 1, Math.min(n, 40) + i)] || G.bodies[G.bodies.length - 1];
        if (b) G.parts.push({ kind: 'fall', x: b.x, z: G.P + b.oz, y: 0, vx: rand(-2, 2), vy: rand(2, 5), vz: 0, life: 0.5, max: 0.5, col: 0xdddddd, size: 0.3 });
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
  let r = archDef().rate * (G.stage === 5 ? archDef().riftRate : 1);
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
function gainCoins(n) {
  n = Math.max(1, Math.round(n * coinMult()));
  G.stats.coins += n;
  HUD.coinPulse = 1; HUD.plus.push({ n, t: 0 });
  return n;
}
const pierceBuff = () => !!(G.buff && G.buff.id === 'pierce');
function reach() { return archDef().range + (pierceBuff() ? 1.2 : 0); }

function alive(t) { return t && !t.dead; }
// frontal shields: flank them. Only arcing bolts get over a Rift shield wall.
function shieldBlocks(e) { return e.shield && (e.look === 'shieldcrawler' || Math.abs(e.x - G.lead.x) < 1.6); } // Rift shield walls can't be flanked
function canHit(e, ignoreShield, seeInvisible) {
  if (e.dead || !e.active || (e.inv && !seeInvisible)) return false;
  if (!ignoreShield && shieldBlocks(e)) return false;
  return true;
}
// nearest valid target ahead within range, skipping ones already doomed by shots in flight
function nearestTarget(range, ignoreShield, skip, seeInvisible) {
  let best = null, bd = 1e9;
  for (const e of G.enemies) {
    if (e === skip || !canHit(e, ignoreShield, seeInvisible) || e.hp - e.pending <= 0) continue;
    const d = e.z - G.P;
    if (d < 0.3 || d > range) continue;
    if (d < bd) { bd = d; best = e; }
  }
  const fh = formHalf();
  for (const b of G.bars) {
    if (b === skip || b.dead || b.hp - b.pending <= 0) continue;
    const d = b.z - G.P;
    if (d < 0.3 || d > range || b.x1 < G.lead.x - fh || b.x0 > G.lead.x + fh) continue;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
const isBar = t => t.x0 !== undefined;
const tx = t => (isBar(t) ? clamp(G.lead.x, t.x0 + 0.4, t.x1 - 0.4) : t.x);

// ---------------------------------------------------------------------------
// Weapons: each archetype fights differently
// ---------------------------------------------------------------------------
function weapons(dt) {
  const A = archDef();
  G.fireT -= dt;
  if (A.id === 'blade') { G.charges = Math.min(3, (G.charges || 0) + dt * fireRate()); melee(); return; }
  if (G.fireT > 0) return;
  G.fireT += 1 / fireRate();
  if (A.id === 'crossbow') fireBolts();
  else if (A.id === 'staff') fireOrb();
  else if (A.id === 'beam') fireBeam();
}
// Footmen: a volley of bolts fans across up to 3 of the nearest targets, arcing over
// frontal shields to where each target will be. Short range: you have to engage.
function fireBolts() {
  const picks = [];
  for (let i = 0; i < BAL.boltFan; i++) {
    const t = nearestTarget(reach(), true, null);
    if (!t || picks.includes(t)) break;
    picks.push(t); t.pending += 1e9; // reserve while choosing
  }
  for (const t of picks) t.pending -= 1e9;
  if (!picks.length) return;
  const dmg = Math.max(1, Math.round(volley(false) / picks.length));
  for (const t of picks) {
    const dist = t.z - G.P, T = 0.2 + dist / 32;
    const aimZ = isBar(t) ? t.z : t.z - (t.speed || 0) * T;
    t.pending += dmg;
    G.shots.push({ kind: 'bolt', x0: G.lead.x, z0: G.P + 0.3, x1: tx(t), z1: aimZ, t: 0, T, h: 0.6 + dist * 0.12, target: t, dmg, pierce: pierceBuff() ? 1 : 0 });
  }
  G.recoil = 1; SFX.shoot(); muzzle(6);
}
// Apprentices: slow homing bolts that track movers (even through a crawler's blink) and pierce one more
function fireOrb() {
  const t = nearestTarget(reach(), false, null, true);
  if (!t) return;
  const dmg = volley(false);
  t.pending += dmg;
  G.shots.push({ kind: 'orb', x: G.lead.x, z: G.P + 0.4, y: 1.4, vx: rand(-6, 6), vz: 4, vy: 3, target: t, dmg, hops: 1 + (pierceBuff() ? 1 : 0), t: 0 });
  G.recoil = 1; SFX.orb(); muzzle(3);
}
// Pilots: fast beams that pierce the whole line in front of the squad. Armor stops them.
function fireBeam() {
  const dmg = volley(false), range = reach();
  const hits = [];
  for (const e of G.enemies) {
    if (!canHit(e, true)) continue;
    const d = e.z - G.P;
    if (d < 0.3 || d > range || Math.abs(e.x - G.lead.x) > 0.55 + e.r) continue;
    hits.push(e);
  }
  for (const b of G.bars) if (!b.dead && b.z - G.P > 0.3 && b.z - G.P < range && G.lead.x > b.x0 - 0.3 && G.lead.x < b.x1 + 0.3) hits.push(b);
  hits.sort((a, b) => a.z - b.z);
  let end = G.P + range;
  for (const t of hits) {
    if (isBar(t)) { damageBar(t, dmg); end = t.z; break; }
    if (shieldBlocks(t)) { end = t.z; worldPuff(t.x, t.z, 0.8, 0x9fd0ff); break; } // a shield stops the beam
    damageEnemy(t, dmg);
    if (t.armored && !pierceBuff()) { end = t.z; break; } // drones stop the beam
  }
  G.beams.push({ x: G.lead.x, z0: G.P + 0.5, z1: hits.length ? Math.min(end, G.P + range) : G.P + range, t: 0.07 });
  G.recoil = 1; SFX.beam();
}
// Retainers: no projectiles. Swings recharge (up to 3 banked); a swing fires only when
// enemies reach the blades, and cleaves everything at contact for enormous damage.
// Whatever a swing doesn't kill, or arrives while no swing is ready, hits the squad.
function melee() {
  const fh = formHalf(), range = reach();
  const at = [];
  for (const e of G.enemies) {
    if (e.dead || !e.active || e.inv || e.leap) continue;
    const d = e.z - G.P;
    if (d < range && d > -0.6 && Math.abs(e.x - G.lead.x) < fh + e.r + 0.25 && !shieldBlocks(e)) at.push(e);
  }
  for (const b of G.bars) if (!b.dead && b.z - G.P < range && b.z - G.P > -0.6 && b.x1 > G.lead.x - fh && b.x0 < G.lead.x + fh) at.push(b);
  if (!at.length || G.charges < 1) return;
  G.charges -= 1;
  const dmg = volley(false);
  at.sort((a, b) => a.z - b.z);
  for (const t of at.slice(0, BAL.cleaveMax)) { if (isBar(t)) damageBar(t, dmg); else damageEnemy(t, dmg); }
  G.swing = 1;
  G.slashes.push({ x: G.lead.x, z: G.P + range * 0.6, t: 0.18, w: fh * 2 + 0.6 });
  SFX.slash(); Haptic.buzz(6);
}
function muzzle(n) {
  for (let i = 0; i < n && G.bodies.length; i++) {
    const b = G.bodies[Math.floor(Math.random() * G.bodies.length)];
    G.parts.push({ kind: 'flash', x: b.x, z: G.P + b.oz + 0.3, y: 1.0, vx: 0, vy: 0, vz: 0, life: 0.06, max: 0.06, col: 0xfff2a0, size: 0.18 });
  }
}
function updateShots(dt) {
  for (const s of G.shots) {
    s.t += dt;
    if (s.kind === 'bolt') {
      if (s.t >= s.T) { s.done = true; resolveShot(s, s.x1, s.z1); }
      continue;
    }
    // homing orb
    const t = s.target;
    if (!alive(t)) { s.done = true; if (t) t.pending = Math.max(0, t.pending - s.dmg); continue; }
    const txx = tx(t), tz = t.z, ty = 0.8;
    const dx = txx - s.x, dz = tz - s.z, dy = ty - s.y, d = Math.hypot(dx, dz, dy) || 1;
    // turn toward the target; the turn rate tightens over time so it always converges
    const sp = 20 + s.t * 40, turn = 1 - Math.exp(-dt * (5 + s.t * 25));
    s.vx = lerp(s.vx, dx / d * sp, turn); s.vz = lerp(s.vz, dz / d * sp, turn); s.vy = lerp(s.vy, dy / d * sp, turn);
    if (d < 0.9 || d < sp * dt * 1.2 || s.t > 2.5) { s.done = true; resolveShot(s, txx, tz); continue; }
    s.x += s.vx * dt; s.z += s.vz * dt; s.y += s.vy * dt;
  }
  G.shots = G.shots.filter(s => !s.done);
  for (const b of G.beams) b.t -= dt;
  G.beams = G.beams.filter(b => b.t > 0);
  for (const s of G.slashes) s.t -= dt;
  G.slashes = G.slashes.filter(s => s.t > 0);
}
function resolveShot(s, x, z) {
  if (s.fx) { worldBurst(x, z, 1 + Math.random() * 2, 5, 0xffd6a0, 3); return; } // base-assault visuals only
  const t = s.target;
  if (t) t.pending = Math.max(0, t.pending - s.dmg);
  // homing orbs always reach their target; bolts land where they were aimed
  const landed = alive(t) && (s.kind === 'orb' || isBar(t) || Math.abs(t.x - x) < t.r + 0.6);
  if (landed) {
    const before = t.hp;
    if (isBar(t)) damageBar(t, s.dmg); else damageEnemy(t, s.dmg);
    // overkill carries over: the leftover flies on to the next nearest enemy
    const left = s.dmg - before;
    if (t.dead && left > 0 && !isBar(t)) carryOver(s, x, z, left, t);
  } else if (s.kind === 'bolt') { // missed (or the target is gone): hit whatever is there now
    const o = G.enemies.find(e => !e.dead && e.active && Math.abs(e.z - z) < 1.2 && Math.abs(e.x - x) < e.r + 0.5);
    if (o) damageEnemy(o, s.dmg);
  }
  worldBurst(x, z, 0.6, 5, s.kind === 'orb' ? 0xff9a3d : 0xfff2a0, 3);
  // pierce: the orb (and buffed bolts) carry on into the next enemy behind
  const hops = s.kind === 'orb' ? s.hops : s.pierce;
  if (hops > 0) {
    let next = null, bd = 1e9;
    for (const e of G.enemies) {
      if (e === t || e.dead || !e.active || (e.inv && s.kind !== 'orb') || (s.kind === 'orb' && shieldBlocks(e))) continue;
      if (s.kind === 'bolt' && e.armored) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < 10 && e.z >= z - 1 && d < bd) { bd = d; next = e; }
    }
    if (next) {
      next.pending += s.dmg;
      G.shots.push(s.kind === 'orb'
        ? { kind: 'orb', x, z, y: 0.9, vx: 0, vz: 8, vy: 2, target: next, dmg: s.dmg, hops: hops - 1, t: 0 }
        : { kind: 'bolt', x0: x, z0: z, x1: next.x, z1: next.z, t: 0, T: 0.15, h: 0.4, target: next, dmg: s.dmg, pierce: 0 });
    }
  }
}

function carryOver(s, x, z, left, from) {
  let next = null, bd = 1e9;
  for (const e of G.enemies) {
    if (e === from || e.dead || !e.active || e.z < G.P + 0.3 || e.hp - e.pending <= 0) continue;
    if (s.kind === 'orb' ? (e.inv ? false : shieldBlocks(e)) : e.inv) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d < 9 && d < bd) { bd = d; next = e; }
  }
  if (!next) return;
  next.pending += left;
  G.shots.push(s.kind === 'orb'
    ? { kind: 'orb', x, z, y: 0.9, vx: 0, vz: 8, vy: 2, target: next, dmg: left, hops: 0, t: 0 }
    : { kind: 'bolt', x0: x, z0: z, x1: next.x, z1: next.z - (next.speed || 0) * 0.15, t: 0, T: 0.15, h: 0.4, target: next, dmg: left, pierce: 0 });
}
function exactBreak(x, z, worth) {
  G.streak++; G.stats.exact++; G.stats.bestStreak = Math.max(G.stats.bestStreak, G.streak);
  SFX.exact(G.streak); Haptic.buzz(18);
  G.flash = Math.max(G.flash, 0.14); G.flashCol = '#ffd23d';
  floatText(x, z, 2.4, 'EXACT', '#ffd23d', 24);
  worldBurst(x, z, 1, 18, 0xffd23d, 7);
  return worth * 3;
}
function damageEnemy(e, dmg) {
  if (e.dead) return;
  if (G.phase === 'run') { G.stats.useful += Math.min(dmg, e.hp); G.stats.dealt = (G.stats.dealt || 0) + dmg; }
  e.hp -= dmg; e.flash = 0.08;
  worldPuff(e.x, e.z, 0.8, 0xffffff);
  if (e.hp <= 0) {
    const exact = e.hp === 0;
    let worth = coinsPerKill(G.level) * (e.elite ? 3 : 1);
    if (e.kind === 'treasure') worth = Math.round(1.5 * enemiesFor(G.level) * coinsPerKill(G.level));
    if (e.rival) worth = coinsPerKill(G.level) * 4;
    if (exact) worth = exactBreak(e.x, e.z, worth); else G.streak = 0;
    const got = gainCoins(worth);
    killEnemy(e);
    floatText(e.x, e.z, 2, '+' + got, exact ? '#ffe58a' : '#ffc83d', 16);
    if (e.elite || e.kind === 'treasure') for (let i = 0; i < 6; i++) addCoin(e.x + rand(-1, 1), e.z + rand(-1, 1), 0.8);
    if (e.kind === 'treasure' && G.level >= 10 && Math.random() < 0.25) { G.stats.relic = true; floatText(e.x, e.z, 3.5, 'RELIC FOUND', '#c9a8ff', 22); }
    const chance = hasRelic('scavenger') ? 0.07 : 0.05;
    if (e.kind !== 'treasure' && !e.rival && G.phase === 'run' && Math.random() < chance) dropPickup();
    return;
  }
  // slimelings split in two at half HP; total HP is preserved
  if (e.look === 'slime' && !e.split && e.hp <= e.maxHp / 2 && e.hp >= 2) {
    const a = Math.ceil(e.hp / 2);
    e.split = true;
    const o = addEnemy(e.kind, clamp(e.x + 0.7, -4.6, 4.6), e.z + 0.4, 0, false, { look: 'slime' });
    o.hp = o.maxHp = e.hp - a; o.split = true; o.active = true; o.r = e.r * 0.8; o.struck = e.struck;
    e.hp = e.maxHp = a; e.r *= 0.8; e.x = clamp(e.x - 0.7, -4.6, 4.6); e.pending = 0;
    worldBurst(e.x, e.z, 0.6, 8, 0x36d6b5, 4);
  }
}
function killEnemy(e) {
  e.dead = true; G.stats.kills++;
  if (G.phase === 'run') G.stats.stopped = (G.stats.stopped || 0) + e.maxHp; // HP of enemies actually stopped
  SFX.kill();
  worldBurst(e.x, e.z, 0.7, 14, LOOK_COLORS[e.look] || 0xffffff, 5);
}
function damageBar(b, dmg) {
  if (b.dead) return;
  b.hp -= dmg; b.flash = 0.08;
  worldPuff(clamp(G.lead.x, b.x0 + 0.3, b.x1 - 0.3), b.z, 0.6, 0xd8d2c4);
  if (b.hp <= 0) {
    const exact = b.hp === 0;
    let worth = coinsPerKill(G.level) * 2;
    if (exact) worth = exactBreak((b.x0 + b.x1) / 2, b.z, worth); else G.streak = 0;
    gainCoins(worth);
    b.dead = true;
    SFX.crumble();
    for (let i = 0; i < 6; i++) addCoin(rand(b.x0 + 0.3, b.x1 - 0.3), b.z + rand(1, 3), 0.8);
    worldBurst((b.x0 + b.x1) / 2, b.z, 0.5, 22, 0xb9b2a4, 6);
  }
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
function warnTime() { return Math.max(1.4, debuffWarnBase(G.level)) + 0.2 * shopLvl('keen') + (hasRelic('hourglass') ? 0.4 : 0); }
function nearGate(z) { return G.gates.some(g => !g.done && z > g.z - 8 && z < g.z + 2); }
function dropPickup(forced) {
  const kind = forced || (Math.random() < 0.65 ? 'buff' : 'debuff');
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
  G.picks.push({ kind, id: pick(ids), x: rand(-3.8, 3.8), z, done: false, drift: 0 });
  if (kind === 'debuff') SFX.warn();
}
function updatePicks(dt) {
  const fh = formHalf();
  for (const p of G.picks) {
    if (p.done) continue;
    if (p.kind === 'gold') { p.x = clamp(p.x + Math.sin(G.lt * 0.8) * dt * 2, -4, 4); p.z += G.v * 0.55 * dt; }
    if (p.z - G.P > 0.4) continue;
    p.done = true;
    const dx = Math.abs(p.x - G.lead.x);
    if (p.kind === 'debuff') {
      if (dx < 0.9 + fh * 0.45) applyDebuff(p.id);
      else { SFX.puff(); worldBurst(p.x, p.z, 0.4, 10, 0xff8a9a, 3); floatText(p.x, p.z, 1.5, 'DODGED', '#ffd6dc', 16); }
      if (G.tut && G.tut.step === 3) G.tut.step = 4;
    } else if (dx < fh + 0.6) applyBuff(p.id, p.kind === 'gold' ? 3 : 1, p.kind === 'gold' ? 20 : 10);
  }
  G.picks = G.picks.filter(p => !p.done);
}
function applyBuff(id, mag, dur) {
  G.buff = { id, mag, t: dur, max: dur };
  SFX.buff(); Haptic.buzz(10);
  floatText(G.lead.x, G.P, 3, (mag > 1 ? 'GOLD ' : '') + BUFFS[id].name, mag > 1 ? '#ffd23d' : '#7dff8f', mag > 1 ? 24 : 20);
  worldBurst(G.lead.x, G.P, 1, 18, mag > 1 ? 0xffd23d : 0x5cff7a, 6);
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
  G.punch = 1;
  for (const b of G.bodies) b.pop = 1; // ripple runs back through the ranks
  const col = gateColor(gate);
  G.flash = 0.18; G.flashCol = col;
  floatText(G.lead.x, G.P, 4.2, note + (after >= before ? '+' : '−') + fmtInt(Math.abs(after - before)), after >= before ? '#ffffff' : '#ffb3c1', 26);
  worldBurst(G.lead.x, G.P + 0.5, 1.5, 26, parseInt(col.slice(1), 16), 7);
  SFX.gate(after >= before); Haptic.buzz(15);
  if (G.tut && G.tut.step < 2) G.tut.step++;
}

// ---------------------------------------------------------------------------
// Enemies on the road
// ---------------------------------------------------------------------------
function moveEnemies(dt) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    const d = e.z - G.P;
    if (!e.active) { if (d < 55) e.active = true; else continue; }
    if (e.strafe) { const fast = e.look === 'crawler'; if (Math.random() < dt * (fast ? 2.2 : 0.8)) e.strafe = rand(-1, 1); e.x = clamp(e.x + e.strafe * (e.look === 'wisp' ? 2.2 : fast ? 5 : 3.2) * dt, -4.6, 4.6); }
    if (e.look === 'crawler' || e.look === 'bigcrawler') {
      const tLeft = d / (G.v + e.speed);
      e.invT -= dt;
      const driftLv = G.stage === 5 && RIFT_PROFILES[G.level] === 'drift';
      if (e.invT <= 0) { e.inv = e.inv ? 0 : 1; e.invT = e.inv ? (driftLv ? rand(2.4, 3.2) : rand(0.7, 1.2)) : (driftLv ? rand(0.4, 0.7) : rand(1.6, 2.6)); }
      if (tLeft < 1.7) e.inv = 0; // always visible again at least 1.5s before contact
    }
    if (e.kind === 'treasure') {
      e.runT += dt;
      e.z = G.P + (G.arch === 'blade' ? 1.6 : 26) + Math.sin(e.runT * 0.5) * (G.arch === 'blade' ? 0.3 : 2);
      e.x = lerp(e.fromX, -e.fromX, e.runT / 8);
      if (e.runT >= 8) { e.dead = true; floatText(e.x, e.z, 2, 'ESCAPED', '#bbbbbb', 18); }
      continue;
    }
    if (e.leap) {
      e.leap.t += dt / 0.7;
      const k = Math.min(1, e.leap.t);
      e.x = lerp(e.leap.x0, e.leap.x1, k); e.z = lerp(e.leap.z0, e.leap.z1, k); e.y = Math.sin(k * Math.PI) * 3.5;
      continue;
    }
    let sp = e.speed;
    if (e.kind === 'brute' && e.look === 'oni') sp *= (e.t % 3) < 0.7 ? 3 : 0.6; // charging bursts
    e.z -= sp * dt;
    if (e.look === 'slime' || e.look === 'bigslime') e.y = Math.abs(Math.sin(e.t * 6)) * 0.35;
    if (e.kind === 'leaper' && d < 7 && d > 2) { e.leap = { t: 0, x0: e.x, z0: e.z, x1: G.lead.x, z1: G.P - 1.2 }; SFX.warn(); }
  }
}
function resolveContacts() {
  const fh = formHalf();
  for (const e of G.enemies) {
    if (e.dead || !e.active) continue;
    if (e.leap) {
      if (e.leap.t >= 1) {
        e.dead = true;
        if (Math.abs(G.lead.x - e.x) < fh) { contact(e); worldBurst(e.x, e.z, 0.4, 14, 0xff3b5c, 5); }
        else { worldPuff(e.x, e.z, 0.3, 0xcccccc); floatText(e.x, e.z, 1.5, 'MISSED', '#dddddd', 15); }
      }
      continue;
    }
    if (e.kind === 'treasure') continue;
    if (e.z - G.P < 0.5) {
      if (Math.abs(e.x - G.lead.x) < fh + e.r) { contact(e); e.dead = true; }
      else if (e.z - G.P < -3) e.dead = true;
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
  for (const b of G.bars) {
    b.flash = Math.max(0, b.flash - 0.016);
    if (b.dead || b.z - G.P > 0.5) continue;
    b.dead = true;
    const lo = Math.max(b.x0, G.lead.x - fh), hi = Math.min(b.x1, G.lead.x + fh);
    if (hi > lo) {
      loseSoldiers(Math.max(2, Math.ceil(G.N * 0.3 * (hi - lo) / (2 * fh))));
      SFX.crumble(); G.shake = Math.max(G.shake, 8);
      worldBurst(G.lead.x, b.z, 0.5, 20, 0xb9b2a4, 6);
    }
  }
}
function contact(e) {
  let n = e.kill;
  if (G.debuff && G.debuff.id === 'bunch') n = Math.ceil(n * 1.5);
  if (G.buff && G.buff.id === 'spread') n = Math.max(1, Math.floor(n * 0.6));
  worldBurst(e.x, G.P, 0.5, 10, 0xff3b5c, 5);
  loseSoldiers(n);
  G.streak = 0;
}
function updateCoins(dt) {
  const fh = formHalf();
  for (const c of G.coins) {
    if (c.taken) continue;
    c.spin += dt * 5;
    const d = c.z - G.P;
    if (hasRelic('magnet') && d < 16 && d > 0) c.x += clamp(G.lead.x - c.x, -6 * dt, 6 * dt);
    if (d < 0.5 && d > -1.5 && Math.abs(c.x - G.lead.x) < fh + 0.4) {
      c.taken = true; gainCoins(Math.max(1, Math.round(coinsPerKill(G.level) * 0.4))); SFX.coin(randi(0, 10));
      worldBurst(c.x, c.z, c.y, 4, 0xffd23d, 3);
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
        if (h.tick > 0.5) { h.tick = 0; loseSoldiers(Math.max(1, Math.ceil(G.N * (h.kind === 'slime' ? 0.015 : 0.01) * (hi - lo) / (2 * fh)))); }
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
  for (const e of G.enemies) if (!e.dead) { e.dead = true; worldPuff(e.x, e.z, 0.6, 0xffffff); }
  G.enemies = []; G.picks = []; G.hazards = []; G.shots = [];
  G.fireT = 0.3;
  const boss = isStageBoss(G.level);
  G.base = { hp: G.baseMax, max: G.baseMax, timer: G.timerMax, z: G.baseZ, shake: 0, lossAcc: 0, boss, barT: 1 };
  if (boss) {
    const kinds = ['brine', 'warden', 'shogun', 'echo', 'otherkai'];
    const kind = kinds[G.stage - 1];
    G.base.z = G.Lr + 18;
    G.boss = { kind, atkT: 3, wind: 0, zone: null, flash: 0, plates: 4, slamAnim: 0, swingT: 0, mirror: G.N, rivalT: 6, z: G.base.z, homeZ: G.base.z, near: 0, nearT: 5, phase: 0, arch: 'crossbow', lunge: null };
    G.nameCard = { name: STAGES[G.stage - 1].boss, sub: STAGES[G.stage - 1].bossSub, t: 0, max: 2.4 };
    SFX.wind();
  } else {
    G.banner = { title: 'BREAK THE BASE', sub: G.timerMax + ' SECONDS', t: 0, max: 1.4 };
  }
}
// melee squads can only cut the boss while it is close
function bossInReach() { const b = G.boss; return !b || G.arch !== 'blade' || b.z - G.P < reach() + 2.5; }
function updateAssault(dt) {
  const B = G.base;
  B.timer -= dt; B.shake = Math.max(0, B.shake - dt * 30);
  // defenders: a steady trickle plus telegraphed barrages you can steer out of.
  // Dodging about half of them averages the tuned 3%/s; dodging all of them wins retries.
  const k = B.boss ? BAL.bossTrickle : BAL.decayTrickle;
  B.lossAcc += (G.N * k + BAL.decayFlat) * dt;
  if (B.lossAcc >= 1) { const n = Math.floor(B.lossAcc); B.lossAcc -= n; setCount(G.N - n); if (G.mode !== 'play') return; }
  if (!B.boss && Math.random() < dt * 6) G.tracers.push({ x0: rand(-4, 4), z0: B.z - 1, y0: 3, x1: G.lead.x + rand(-1.5, 1.5), z1: G.P, y1: 0.7, t: 0.1 });
  if (!B.boss) updateBarrage(B, dt);
  if (G.boss) { updateBoss(dt); if (G.mode !== 'play') return; }
  G.fireT -= dt;
  if (G.fireT <= 0 && bossInReach()) {
    G.fireT += 1 / fireRate();
    const dmg = volley(true);
    B.hp -= dmg; B.shake = 4; G.shake = Math.max(G.shake, 2.5);
    if (G.boss) G.boss.flash = 0.08;
    const tz = G.boss ? G.boss.z : B.z;
    if (G.arch === 'blade') { G.swing = 1; G.slashes.push({ x: G.lead.x, z: G.P + 1.8, t: 0.18, w: formHalf() * 2 + 0.6 }); SFX.slash(); }
    else if (G.arch === 'beam') { G.beams.push({ x: G.lead.x, z0: G.P + 0.5, z1: tz - 1, t: 0.07 }); SFX.beam(); }
    else for (let i = 0; i < (G.arch === 'staff' ? 2 : 6); i++) G.shots.push(G.arch === 'staff'
      ? { kind: 'orb', x: G.lead.x, z: G.P + 0.4, y: 1.4, vx: rand(-6, 6), vz: 4, vy: 3, target: { x: rand(-3, 3), z: tz - 1, dead: false, pending: 0 }, dmg: 0, hops: 0, t: 0, fx: true }
      : { kind: 'bolt', x0: G.lead.x + rand(-1, 1), z0: G.P + 0.3, x1: rand(-3, 3), z1: tz - 1, t: 0, T: 0.6, h: 3, target: null, dmg: 0, pierce: 0, fx: true });
    worldPuff(rand(-3, 3), tz - 0.6, rand(1, 4), 0xffd6a0);
    if (G.arch === 'crossbow' || G.arch === 'staff') SFX.shoot();
    SFX.baseHit();
    if (B.hp <= 0) { const exact = B.hp === 0; B.hp = 0; baseDown(exact); return; }
  }
  if (B.timer <= 0) baseFailed();
}
function updateBarrage(B, dt) {
  if (B.zone) {
    B.wind -= dt;
    if (B.wind <= 0) {
      const fh = formHalf();
      const lo = Math.max(B.zone[0], G.lead.x - fh), hi = Math.min(B.zone[1], G.lead.x + fh);
      if (hi > lo) loseSoldiers(Math.max(1, Math.round(G.N * BAL.barrageHit * Math.min(1, (hi - lo) / Math.min(2 * fh, B.zone[1] - B.zone[0])))));
      for (let i = 0; i < 8; i++) G.tracers.push({ x0: rand(-4, 4), z0: B.z - 1, y0: 3, x1: rand(B.zone[0], B.zone[1]), z1: G.P, y1: 0.3, t: 0.14 });
      worldBurst((B.zone[0] + B.zone[1]) / 2, G.P, 0.2, 14, 0xff5a3a, 6);
      SFX.baseHit();
      B.zone = null; B.barT = BAL.barrageEvery - 0.8;
    }
  } else {
    B.barT -= dt;
    if (B.barT <= 0) {
      const w = ROAD * 2 * 0.4;
      const x0 = clamp(G.lead.x - w / 2 + rand(-1.5, 1.5), -ROAD, ROAD - w);
      B.zone = [x0, x0 + w]; B.wind = 0.8;
    }
  }
}
function strikeZone(b, frac, wind, aimed) {
  const w = ROAD * 2 * frac;
  const x0 = aimed ? clamp(G.lead.x - w / 2 + rand(-1, 1), -ROAD, ROAD - w) : (Math.random() < 0.5 ? -ROAD : ROAD - w);
  b.zone = [x0, x0 + w]; b.wind = wind; b.windMax = wind; SFX.warn();
}
function updateBoss(dt) {
  const b = G.boss;
  b.flash = Math.max(0, b.flash - dt); b.slamAnim = Math.max(0, b.slamAnim - dt * 2); b.swingT = Math.max(0, b.swingT - dt);
  b.mirror = G.N;
  const hpFrac = G.base.hp / G.base.max;
  const phase = hpFrac > 2 / 3 ? 0 : hpFrac > 1 / 3 ? 1 : 2;
  if (phase !== b.phase) {
    b.phase = phase;
    if (b.kind === 'shogun') floatText(0, b.z - 2, 5, ['', 'SECOND LESSON', 'LAST LESSON'][phase], '#ffd9a0', 26);
    if (b.kind === 'otherkai') { b.arch = ['crossbow', 'staff', 'blade', 'beam'][(phase + 1) % 4]; floatText(0, b.z - 2, 5, ARCH[b.arch].squad, '#ffffff', 24); G.flash = 0.3; G.flashCol = '#ffffff'; }
    if (b.kind === 'brine' || b.kind === 'warden') { G.shake = 10; }
  }
  // melee squads: every boss comes in close on a rhythm, then backs off
  const meleeWindow = G.arch === 'blade';
  if (meleeWindow || b.kind === 'shogun') {
    b.nearT -= dt;
    if (b.nearT <= 0) { b.near = b.near ? 0 : 1; b.nearT = b.near ? 2.6 : 3.2; }
    const want = b.near ? G.P + 3.2 : b.homeZ;
    b.z = lerp(b.z, want, 1 - Math.exp(-dt * 4));
  }
  if (b.zone) {
    b.wind -= dt;
    if (b.wind <= 0) {
      // the telegraphed strike wipes the slice of the formation inside the zone
      const fh = formHalf();
      const lo = Math.max(b.zone[0], G.lead.x - fh), hi = Math.min(b.zone[1], G.lead.x + fh);
      if (hi > lo) { loseSoldiers(Math.max(1, Math.ceil(G.N * BAL.bossHit * Math.min(1, (hi - lo) / Math.min(2 * fh, b.zone[1] - b.zone[0]))))); floatText(G.lead.x, G.P, 3, 'HIT!', '#ff3b5c', 24); }
      else floatText(G.lead.x, G.P, 3, 'DODGED', '#ffffff', 22);
      if (b.kind === 'brine') G.hazards.push({ x0: b.zone[0], x1: b.zone[1], t: 0, warn: 0, active: true, dur: 3, kind: 'slime' });
      SFX.swing(); G.shake = Math.max(G.shake, 12); Haptic.buzz(25);
      b.swingT = 0.4; b.slamAnim = 1;
      worldBurst((b.zone[0] + b.zone[1]) / 2, G.P, 0.3, 26, b.kind === 'brine' ? 0x36d6b5 : b.kind === 'warden' ? 0xff7a1a : 0xff3b5c, 8);
      b.zone = null; b.atkT = b.kind === 'otherkai' ? 3.6 : b.kind === 'warden' ? 4.5 : 5;
    }
  } else {
    b.atkT -= dt;
    if (b.atkT <= 0) {
      switch (b.kind) {
        case 'brine': strikeZone(b, 0.4, 2, true); break;
        case 'warden': strikeZone(b, 0.6, 2, false); break;      // fire arc across 60% of the road
        case 'shogun':                                            // three lessons, three approach patterns
          if (b.phase === 0) strikeZone(b, 0.3, 1.6, true);        // straight charge down your lane
          else if (b.phase === 1) { strikeZone(b, 0.5, 2, false); spawnMasks(); } // a wall of masks, then a sweep
          else strikeZone(b, 0.45, 1.4, true);                     // fast cuts aimed at you
          break;
        case 'echo': strikeZone(b, 0.5, 2, true); break;
        case 'otherkai': { // his attack follows the archetype he is using this phase
          const a = b.arch;
          if (a === 'beam') strikeZone(b, 0.2, 1.2, true);
          else if (a === 'blade') strikeZone(b, 0.55, 1.6, true);
          else if (a === 'staff') strikeZone(b, 0.35, 2.4, true);
          else strikeZone(b, 0.4, 2, false);
        }
      }
    }
  }
  if (b.kind === 'tyrant') {
    const want = Math.ceil(4 * hpFrac - 1e-9);
    if (b.plates > want) b.plates = want;
  }
  // the echo and the other kai send a squad exactly your size
  if (b.kind === 'echo' || b.kind === 'otherkai') {
    b.rivalT -= dt;
    if (b.rivalT <= 0) {
      b.rivalT = 7;
      const r = addEnemy('normal', rand(-3, 3), b.z - 4, 0, false, { look: b.kind === 'echo' ? 'shade' : 'twin' });
      r.hp = r.maxHp = Math.max(2, Math.round(G.N * G.dmg * archDef().rate / 2)); r.kill = Math.max(1, Math.ceil(G.N * 0.25)); r.active = true; r.speed = 4; r.r = 1; r.rival = true;
      floatText(r.x, r.z, 2, 'MIRROR ' + G.N, '#2bf0ff', 20);
    }
  }
  if (G.enemies.length) assaultEnemies(dt);
}
function spawnMasks() {
  for (let i = 0; i < 4; i++) {
    const e = addEnemy('normal', -3 + i * 2, G.boss.z - 2 - i * 0.4, enemyHP(G.level, G.loop), false, { look: 'yokai' });
    e.active = true; e.speed = 3.5;
  }
}
function assaultEnemies(dt) {
  for (const e of G.enemies) { if (e.dead) continue; e.z -= e.speed * dt; e.t += dt; e.flash = Math.max(0, e.flash - dt); }
  // the squad's weapon handles rival squads and masks like any road enemy
  const A = archDef();
  if (A.id === 'blade') melee();
  else {
    G.altT = (G.altT || 0) - dt;
    if (G.altT <= 0) {
      G.altT = 1 / fireRate();
      if (A.id === 'beam') fireBeam(); else if (A.id === 'staff') fireOrb(); else fireBolts();
    }
  }
  resolveContacts();
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
  const z = G.boss ? G.boss.z : B.z;
  for (let i = 0; i < 6; i++) worldBurst(rand(-4, 4), z - 0.5, rand(1, 5), 34, i % 2 ? 0xffffff : 0xffb02e, 12);
  G.debris = 1;
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
  const B = G.base;
  B.hp = B.max; B.timer = G.timerMax; B.lossAcc = 0; B.zone = null; B.barT = 1;
  G.enemies = []; G.hazards = []; G.shots = [];
  if (G.boss) Object.assign(G.boss, { zone: null, atkT: 3, plates: 4, rivalT: 6, phase: 0, near: 0, nearT: 5, z: G.boss.homeZ, arch: 'crossbow' });
}

// ---------------------------------------------------------------------------
// FX (world particles are rendered by GFX from G.parts)
// ---------------------------------------------------------------------------
function worldBurst(x, z, y, n, col, sp) {
  for (let i = 0; i < n; i++) G.parts.push({ kind: 'spark', x, z, y, vx: rand(-sp, sp), vz: rand(-sp, sp) * 0.5, vy: rand(0, sp), life: rand(0.3, 0.6), max: 0.6, size: rand(0.08, 0.2), col });
}
function worldPuff(x, z, y, col) { for (let i = 0; i < 2; i++) G.parts.push({ kind: 'puff', x: x + rand(-0.2, 0.2), z, y: y + rand(-0.2, 0.2), vx: 0, vy: 1.5, vz: 0, life: 0.3, max: 0.3, size: rand(0.25, 0.45), col }); }
function floatText(x, z, y, text, col, size) { G.texts.push({ x, z, y, text: String(text), col, size: size || 18, life: 1, max: 1 }); }
const HUD = { coinPulse: 0, plus: [], gemPulse: 0, gemX: 0, gemY: 0 };
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
    if (p.kind === 'confetti') { p.sy += p.vy * dt; p.sx += p.vx * dt; p.vy += 200 * dt; p.rot += p.vr * dt; continue; }
    p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y + p.vy * dt);
    if (p.kind === 'spark' || p.kind === 'fall') p.vy -= 18 * dt;
  }
  G.parts = G.parts.filter(p => p.life > 0);
  if (G.parts.length > 500) G.parts.splice(0, G.parts.length - 500);
  for (const t of G.texts) { t.life -= dt; t.y += dt * 1.6; }
  G.texts = G.texts.filter(t => t.life > 0);
  for (const t of G.tracers) t.t -= dt;
  G.tracers = G.tracers.filter(t => t.t > 0);
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt * 2.2);
  G.punch = Math.max(0, (G.punch || 0) - dt * 2.5);
  G.recoil = Math.max(0, (G.recoil || 0) - dt * 8);
  G.swing = Math.max(0, (G.swing || 0) - dt * 5);
  HUD.coinPulse = Math.max(0, HUD.coinPulse - dt * 5);
  HUD.gemPulse = Math.max(0, HUD.gemPulse - dt * 4);
  for (const p of HUD.plus) p.t += dt;
  HUD.plus = HUD.plus.filter(p => p.t < 0.9).slice(-4);
  for (const b of G.bodies) { if (b.delay > 0 && b.pop > 0.99) { b.delay -= dt; continue; } b.pop = Math.max(0, b.pop - dt * 3); }
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
  for (const b of G.bodies) b.ph += dt * (G.phase === 'run' ? 11 : 0);
  if (G.tut) updateTutorial(dt);
  updateShots(dt);
  if (G.phase === 'run') {
    G.P += G.v * dt;
    G.stats.potential += G.N * G.dmg * archDef().rate * dt;
    updateGates();
    moveEnemies(dt);
    weapons(dt);
    resolveContacts();
    updateCoins(dt);
    updatePicks(dt);
    updateHazards(dt);
    if (G.P >= G.runnerAt) {
      G.runnerAt = Infinity;
      const e = addEnemy('treasure', 0, G.P + 26, enemyHP(G.level, G.loop), false, { look: 'treasure' });
      e.active = true; e.runT = 0; e.fromX = pick([-1, 1]) * 5.5; e.x = e.fromX;
      floatText(0, G.P + 20, 3, 'TREASURE!', '#ffd23d', 24); SFX.tile();
    }
    if (G.P >= G.goldAt) { G.goldAt = Infinity; G.picks.push({ kind: 'gold', id: pick(Object.keys(BUFFS)), x: rand(-3, 3), z: G.P + 40, done: false }); floatText(0, G.P + 40, 4, 'GOLD', '#ffd23d', 28); SFX.warn(); }
    if (G.P >= G.forceDebuffAt) {
      G.forceDebuffAt = Infinity;
      const was = G.picks.length;
      dropPickup('debuff');
      if (G.picks.length > was) { const p = G.picks[G.picks.length - 1]; p.id = 'rate'; p.x = clamp(G.lead.x, -3, 3); if (G.tut) { p.z = G.P + 4.5 * G.v; G.tut.step = 3; } }
    }
    if (G.P >= G.corruptAt) {
      G.corruptAt = G.P + rand(18, 26) * G.v / 2;
      const w = randi(1, 3) * 2, x0 = pick([-5, -3, -1, 1, 3].filter(x => x + w <= 3)); // never the full width
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
