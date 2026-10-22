// ============================================================================
// GAME: world, squad, gunfire, gate bands, hazards, crowds, base assault, bosses,
// endless mode (pure logic; the renderer reads G every frame)
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

// Fixed-size object pool: spawn() hands out a preallocated object or null when full
// (callers skip the spawn rather than grow the pool). kill(i) swaps with the last live one.
class Pool {
  constructor(cap, make) { this.cap = cap; this.n = 0; this.a = new Array(cap); for (let i = 0; i < cap; i++) this.a[i] = make(); }
  spawn() { return this.n < this.cap ? this.a[this.n++] : null; }
  kill(i) { const j = --this.n; if (i !== j) { const t = this.a[i]; this.a[i] = this.a[j]; this.a[j] = t; } }
  clear() { this.n = 0; }
}
// Worst case: 60 guns x ~8 shots/s (weapon Lv10 + every upgrade + a rate buff) x 1.2s of flight
// (30 units at 25 u/s) = ~580, plus homing orbs that live a little longer. Sized once; never grown.
const SHOTS = new Pool(900, () => ({ x: 0, y: 0, z: 0, pz: 0, vx: 0, vz: 0, kind: 0, dmg: 0, w: 0, zEnd: 0, pierce: 0, last: null, last2: null, vis: false, t: 0 }));
const ESHOTS = new Pool(96, () => ({ x: 0, y: 0, z: 0, vx: 0, vz: 0, t: 0, kind: 0 }));
const FX = new Pool(2400, () => ({ kind: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0, col: 0, frames: 0, rot: 0 }));
const FXK = { spark: 0, flash: 1, casing: 2, puff: 3, fall: 4, ember: 5 };
const SHOT_KIND = { crossbow: 0, staff: 1, blade: 2, beam: 3 };

const G = {
  mode: 'menu', t: 0, P: 0, camX: 0, timeScale: 1, shake: 0, flash: 0, flashCol: '#fff', push: 0,
  lead: { x: 0, tx: 0, vx: 0 }, N: 1, bodies: [], arch: 'crossbow', guns: [],
  sets: [], enemies: [], bars: [], barrels: [], crates: [], coins: [], carts: [], picks: [], hazards: [], splits: [], texts: [], parts: [],
  weapon: 1,
};
for (let i = 0; i < 60; i++) G.guns.push({ t: Math.random() });
const hasRelic = id => G.relics && G.relics.includes(id);
const archDef = () => ARCH[G.arch];
const up = k => (G.up && G.up[k]) || 0;

// ---------------------------------------------------------------------------
// Runs and levels
// ---------------------------------------------------------------------------
function newRun(loop) {
  Store.d.run = { level: 1, relics: [], loop: loop || 0, arch: null, weapon: 1 };
  Store.save();
}
function stageArch(L, run) { const a = STAGES[stageOf(L) - 1].arch; return a || (run && run.arch) || 'crossbow'; }

// The ONE place a level's starting squad is set: 1 soldier, plus any +1 SOLDIER the player
// bought with gems for this level (consumed here, so a retry starts at 1 again).
function startingSquad(opt, endless) {
  if (endless) return BAL.startSoldiers;
  const plus = opt.plusOne != null ? opt.plusOne : (Store.d.plusOne || 0);
  if (!opt.sim) { Store.d.plusOne = 0; Store.save(); }
  return BAL.startSoldiers + plus;
}

function startLevel(opt) {
  opt = opt || {};
  const run = Store.d.run, endless = !!opt.endless;
  const L = endless ? 40 : run.level;
  G.endless = endless; G.endT = 0; G.dist = 0; G.banked = false;
  G.level = L; G.stage = stageOf(L); G.loop = endless ? 0 : (run.loop || 0);
  G.arch = endless ? (Store.d.endlessArch || 'crossbow') : stageArch(L, run);
  G.relics = endless ? [] : (run.relics || []).slice();
  G.up = Object.assign({ rate: 0, dmg: 0, rev: 0 }, opt.up || Store.d.up);
  G.weapon = clamp(opt.weapon || (endless ? Store.d.endlessWeapon : run.weapon) || 1, 1, 10);
  const tune = levelTuning(L), A = archDef();
  G.tune = tune;
  G.dmg = tune.dmg; // every squad fires 3 shots/s for the same raw damage; the archetypes differ in perks
  G.v = BAL.runSpeed * speedMult(L);
  G.Lr = endless ? 1e9 : roadSeconds(L) * G.v;
  G.P = 0; G.camX = 0; G.lt = 0;
  G.lead = { x: 0, tx: 0, vx: 0 };
  G.N = startingSquad(opt, endless); G.Nmax = G.N; G.punch = 0; G.startN = G.N;
  G.sets = []; G.enemies = []; G.bars = []; G.barrels = []; G.crates = []; G.coins = []; G.carts = []; G.picks = []; G.hazards = []; G.splits = []; G.texts = []; G.parts = [];
  SHOTS.clear(); ESHOTS.clear(); FX.clear();
  for (const g of G.guns) g.t = Math.random() / BAL.fireRate; // never in sync
  G.buff = null; G.debuff = null; G.patientT = 0; G.shotN = 0; G.efT = 0; G.streamEnd = 0;
  G.vanguardAcc = 0; G.medicLeft = endless ? 0 : shopLvl('medic'); G.rallyUsed = false;
  G.stats = { coins: 0, kills: 0, gems: 0, relic: false, lost: 0, flips: 0, pumped: 0, blasts: 0, dodged: 0, hits: 0, arrive: 0, crates: 0, cratesMissed: 0, blocks: 0, spawned: 0 };
  G.phase = endless ? 'run' : 'intro'; G.base = null; G.boss = null; G.split = null; G.bossIntro = 0;
  G.blockT = 1.5; G.floorT = 0; G.loneSide = 1; G.blocksLeft = endless ? Infinity : blocksPerLevel(L);
  G.timeScale = 1; G.slowT = 0; G.shake = 0; G.flash = 0; G.push = 0; G.recoil = 0;
  G.tut = (L === 1 && !endless && !Store.d.tut.base && !opt.sim) ? { step: 0, t: 0 } : null;
  G.banner = endless ? { title: 'ENDLESS', sub: 'HOW FAR CAN YOU CLIMB', t: 0, max: 2.2 } : null;
  G.rnd = opt.rnd || Math.random;
  if (endless) { G.genZ = 0; G.endSet = 0; extendEndless(); } else { buildLevel(); startBoss(); }
  layoutBodies(true);
  G.mode = 'play';
  if (!opt.sim) {
    Music.play(G.stage - 1);
    if (typeof GFX !== 'undefined') GFX.onLevel();
  }
}
function roleWeights(L) {
  const prof = G.stage === 5 ? RIFT_PROFILES[L] : null;
  const w = { brute: L >= 4 ? 0.1 : 0, shielder: L >= 9 ? 0.1 : 0, leaper: L >= 13 ? 0.06 : 0, runner: 0.3, normal: 0 };
  if (G.stage === 1 || G.stage >= 3) w.shielder = 0; // shielders belong to the Ember Spire
  if (prof === 'packs') { w.runner = 0.55; w.brute = 0.05; }
  if (prof === 'brutes') { w.brute = 0.25; w.runner = 0.15; }
  if (prof === 'drift') { w.leaper = 0.18; w.runner = 0.35; }
  if (prof === 'shields') { w.shielder = 0.4; w.runner = 0.15; w.brute = 0.05; }
  w.normal = Math.max(0.1, 1 - w.brute - w.shielder - w.leaper - w.runner);
  return w;
}
function pickRole(w, r) {
  r = r == null ? Math.random() : r;
  for (const k of ['brute', 'shielder', 'leaper', 'runner', 'normal']) { if ((r -= w[k]) <= 0) return k; }
  return 'normal';
}
// expected squad (par) at road position z, for crowd density
function parAt(z) {
  const S = G.sets;
  if (!S.length) return 1;
  if (z <= S[0].z) return S[0].par;
  for (let i = 0; i < S.length; i++) {
    const next = S[i + 1];
    const after = applyBand(Math.round(S[i].par), S[i].bands[bestBandIndex(S[i], Math.round(S[i].par))]);
    if (!next || z < next.z) return next ? lerp(after, next.par, clamp((z - S[i].z) / Math.max(1, next.z - S[i].z), 0, 1)) : after * (1 - BAL.parLoss * 0.5);
  }
  return S[S.length - 1].par;
}
// The squad is a dense rectangular block that widens and deepens with the count.
// Up to 120 are drawn one mesh each; past that the block's footprint keeps widening.
function formSpacing(n) { return 0.52 * (n > BAL.drawCap ? Math.min(1.5, Math.sqrt(n / BAL.drawCap)) : 1); }
function formCols(n) { const d = Math.min(n, BAL.drawCap); return clamp(Math.ceil(Math.sqrt(d * 1.6)), 1, 16); }
function formHalfFor(n) { return Math.max(0.35, (formCols(n) - 1) / 2 * formSpacing(n) + 0.3); }
function buildLevel() {
  const L = G.level, v = G.v, Lr = G.Lr, rnd = G.rnd;
  const plan = planGates(L, rnd);
  const first = 9 * v, last = Lr - 5 * v;
  const slots = plan.filter(s => !s.overlap).length;
  let k = 0, prevZ = 0;
  for (const s of plan) {
    s.z = s.overlap ? prevZ + 13 : first + (last - first) * (slots === 1 ? 0 : k++ / (slots - 1));
    prevZ = s.z;
    addSet(s);
  }
  // weapon crates: 3-5 per level, HP printed on the face; the higher the HP, the better the gun
  const n = 3 + Math.floor(rnd() * 3), ranks = [2, 1, 0, 1, 0].slice(0, n);
  shuffleR(ranks, rnd);
  for (let i = 0; i < n; i++) {
    let z = (0.16 + 0.7 * (i + 0.2 + rnd() * 0.6) / n) * Lr;
    for (let t = 0; t < 6 && G.sets.some(s => Math.abs(s.z - z) < 9); t++) z += 10;
    const rank = ranks[i], next = G.sets.find(s => s.z > z), hp = crateHP(L, rank, next ? next.par : 46, G.loop);
    // in the middle of the road, where even a small squad can stand in front of it
    G.crates.push({ x: (rnd() * 2 - 1) * 1.3, z, rank, tier: crateTier(L, rank), kind: ['tires', 'barrel', 'crate'][rank], hp, max: hp, dead: false, flash: 0, acc: 0, accT: 0 });
  }
  // coin discs in lanes, a cart at the edge for steering wide
  const val = discValue(L, G.loop);
  for (let i = 0; i < 14; i++) {
    const z = (0.12 + 0.82 * (i + rnd() * 0.6) / 14) * Lr;
    if (G.sets.some(s => Math.abs(s.z - z) < 6) || G.crates.some(c => Math.abs(c.z - z) < 4)) continue;
    G.coins.push({ x: (rnd() * 2 - 1) * 4, z, val, taken: false, spin: rnd() * 6 });
  }
  if (rnd() < 0.6) {
    const z = (0.35 + rnd() * 0.4) * Lr;
    G.carts.push({ x: rnd() < 0.5 ? -4.2 : 4.2, z, val: cartValue(L, G.loop), taken: false });
  }
  G.runnerAt = L >= 9 ? (0.25 + rnd() * 0.45) * Lr : Infinity;
  G.goldAt = L % 3 === 0 ? (0.3 + rnd() * 0.4) * Lr : Infinity;
  G.corruptAt = L >= 33 ? (0.15 + rnd() * 0.15) * Lr : Infinity;
}
function addSet(s) {
  const n = s.bands.length, rnd = G.rnd;
  const A = archDef();
  if (s.kind === 'split') {
    const side = rnd() < 0.5 ? -1 : 1; // swarm side
    // the better band sits on the side without the swarm
    const order = side < 0 ? [s.bands[1], s.bands[0]] : [s.bands[0], s.bands[1]];
    s.bands = order;
    const z0 = s.z - 8.5 * G.v, z1 = s.z + 4;
    G.splits.push({ z0, z1, side, set: s });
    // the swarm side gets its own enemy block when the divider starts (updateSplit), and coins
    for (let i = 0; i < 6; i++) G.coins.push({ x: side * (1.2 + rnd() * 3), z: z0 + 10 + i * (s.z - z0 - 14) / 6, val: discValue(G.level, G.loop), taken: false, spin: 0 });
  }
  const w = ROAD * 2 / n;
  s.bands.forEach((b, i) => {
    b.x0 = -ROAD + i * w; b.x1 = b.x0 + w;
    b.cost = pumpCost(s.par, b, BAL.shotRange, G.v);
    b.acc = 0; b.accT = 0;
  });
  s.done = false; s.picked = -1;
  G.sets.push(s);
  // hazards behind bands, telegraphed: an explosive barrel or a barricade with HP
  if (G.level >= 3 && s.kind === 'choice' && s.i >= 2 && rnd() < 0.45) {
    const bi = Math.floor(rnd() * n), b = s.bands[bi];
    const commit = Math.max(s.par, BAL.pumpFloor) * (BAL.shotRange / G.v) * BAL.fireRate * G.dmg * weaponMult(G.weapon).dmg;
    if (rnd() < 0.55) G.barrels.push({ x: (b.x0 + b.x1) / 2, z: s.z + 4.5, hp: commit * 0.9, max: commit * 0.9, dead: false, flash: 0, acc: 0, accT: 0, blast: 3.4 });
    else addBarricade(b.x0 + 0.2, b.x1 - 0.2, s.z + 5, commit * 0.75);
  }
}
function addEnemy(kind, x, z, hp, elite, o) {
  const T = ENEMY_TYPES[kind];
  const look = (o && o.look) || STAGE_LOOKS[G.stage - 1][kind] || 'slime';
  const h = hp * T.hp * (elite ? 3 : 1);
  const e = {
    kind, look, x, z, y: 0, hp: h, maxHp: h, r: T.r * (elite ? 1.25 : 1), speed: T.speed * 0.8, kill: T.kill,
    elite: !!elite, active: false, t: Math.random() * 5, flash: 0, inv: 0, invT: 1.5 + Math.random() * 1.5,
    shield: kind === 'shielder', strafe: 0, leap: null, dead: false, acc: 0, accT: 0, half: 0,
  };
  if (look === 'drone' || look === 'bigdrone' || look === 'bigcrawler') e.armored = true; // armor stops beams
  if (G.stage === 5 && kind === 'runner') e.speed *= 0.8;
  const prof = G.stage === 5 ? RIFT_PROFILES[G.level] : null;
  if (look === 'ghost' || look === 'wisp' || (prof === 'drift' && look === 'crawler')) e.strafe = Math.random() * 2 - 1;
  G.enemies.push(e);
  return e;
}
function addBarricade(x0, x1, z, hp) { G.bars.push({ x0, x1, z, hp, maxHp: hp, dead: false, flash: 0, acc: 0, accT: 0 }); }

// ---------------------------------------------------------------------------
// Endless: the road is generated ahead in chunks. Speed +3% every 30s, gates harsher.
// ---------------------------------------------------------------------------
function extendEndless() {
  const v = G.v, rnd = G.rnd;
  while (G.genZ < G.P + 220) {
    const z0 = G.genZ, i = G.endSet++;
    const harsh = Math.min(0.6, G.endT / 600);
    const par = Math.max(8, G.N * (1 - harsh * 0.3));
    const kind = i > 0 && rnd() < 0.25 + harsh * 0.4 ? 'red' : 'choice';
    const s = makeGateSet(i === 0 ? 1 : par, Math.min(i, 6), 40, rnd, { kind });
    s.z = z0 + (i === 0 ? 9 * v : 9 * v);
    s.par = i === 0 ? 1 : par;
    addSet(s);
    if (rnd() < 0.7) G.coins.push({ x: (rnd() * 2 - 1) * 4, z: s.z - 4 * v, val: discValue(40), taken: false, spin: 0 });
    G.genZ = s.z + 5;
  }
  // forget what is far behind
  if (G.sets.length > 6) G.sets = G.sets.filter(s => s.z > G.P - 30);
}

// ---------------------------------------------------------------------------
// Formation
// ---------------------------------------------------------------------------
function spreadMult() { return (G.buff && G.buff.id === 'spread' ? 1.35 : 1) * (G.debuff && G.debuff.id === 'bunch' ? 0.6 : 1); }
function formHalf() { return formHalfFor(G.N) * spreadMult(); }
// Kai is soldier #1: a squad of N draws Kai plus N-1 soldiers behind him (so a level opens on Kai alone)
function layoutBodies(snap) {
  const n = Math.min(Math.max(0, G.N - 1), BAL.drawCap), sp = formSpacing(G.N) * spreadMult(), dz = 0.5 * Math.min(1.3, formSpacing(G.N) / 0.52);
  const cols = formCols(G.N);
  const old = G.bodies, out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), k = i - row * cols;
    const ox = (k - (inRow - 1) / 2) * sp, oz = -(row + 1) * dz - 0.2;
    const prev = old[i];
    out.push({ ox, oz, row: row + 1, x: prev && !snap ? prev.x : G.lead.x + ox, ph: prev ? prev.ph : Math.random() * TAU, pop: snap ? 0 : 1, delay: row * 0.04 });
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
      const lost = Math.max(1, Math.min(before, BAL.drawCap) - Math.min(n, BAL.drawCap));
      for (let i = 0; i < lost; i++) {
        const b = G.bodies[Math.min(G.bodies.length - 1, Math.min(n, BAL.drawCap) + i)] || G.bodies[G.bodies.length - 1];
        if (b) fx(FXK.fall, b.x, 0, G.P + b.oz, rand(-2, 2), rand(2, 5), 0, 0.5, 0.3, 0xdddddd);
      }
    } else for (let i = Math.min(before, 25); i < Math.min(n, 25); i++) G.guns[i].t = Math.random() / fireRate(); // new guns join off-beat
    layoutBodies(false);
  }
  if (G.N <= 0) squadDown();
  else if (G.N < 3 && !G.rallyUsed && G.Nmax >= 12 && Store.d.gems >= RALLY_COST && G.mode === 'play' && !G.sim) { G.rallyUsed = true; G.mode = 'rally'; UI.rally(); }
}
function loseSoldiers(n) {
  if (n <= 0 || G.N <= 0) return;
  if (hasRelic('vanguard')) { G.vanguardAcc += n; n = Math.floor(G.vanguardAcc / 2); G.vanguardAcc -= n * 2; if (!n) return; }
  if (G.N - n <= 0 && G.medicLeft > 0) { G.medicLeft--; setCount(1); floatText(G.lead.x, G.P, 3, 'MEDIC!', '#5cff7a', 26); SFX.buff(); return; }
  G.stats.lost += Math.min(n, G.N);
  setCount(G.N - n);
  SFX.lose(); Haptic.buzz(12);
  G.shake = Math.max(G.shake, 4);
}
// kill the soldiers standing inside [x0, x1] (boss strikes delete whoever is in the zone)
function killInZone(test, cap) {
  const bodies = G.bodies;
  if (!bodies.length) { if (test(G.lead.x)) { loseSoldiers(G.N); return 1; } return 0; } // Kai alone
  let inside = 0;
  for (const b of bodies) if (test(b.x)) inside++;
  if (test(G.lead.x) && inside === 0) inside = 1;
  const n = Math.min(G.N, Math.ceil(G.N * Math.min(cap || 1, inside / bodies.length)));
  if (n > 0) loseSoldiers(n);
  return n;
}
function squadDown() {
  if (G.mode !== 'play') return;
  if (G.endless) { endlessOver(); return; }
  G.mode = 'failed';
  bankCoins();
  SFX.fail(); Gunfire.stop();
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
// Damage, fire rate, coins
// ---------------------------------------------------------------------------
function dmgBonus(vsBase) {
  let b = 0;
  if (G.buff && G.buff.id === 'dmg') b += 0.15 * G.buff.mag;
  b += 0.08 * shopLvl('marks');
  if (hasRelic('patient')) b += Math.min(0.4, 0.08 * Math.floor(G.patientT / 10));
  if (vsBase) { b += 0.1 * shopLvl('siege'); if (hasRelic('siege')) b += 0.5; }
  return Math.min(2.5, b);
}
function shotDamage(vsBase) {
  let m = upMult('dmg', up('dmg')) * weaponMult(G.weapon).dmg * (1 + dmgBonus(vsBase));
  if (G.debuff && G.debuff.id === 'dmg') m *= 0.85;
  return G.dmg * m;
}
// 3 shots/s per soldier before upgrades; the weapon level and Fire Rate upgrades raise it
function fireRate() {
  let r = BAL.fireRate * upMult('rate', up('rate')) * weaponMult(G.weapon).rate;
  if (G.buff && G.buff.id === 'rate') r *= 1 + 0.15 * G.buff.mag;
  if (G.debuff && G.debuff.id === 'rate') r *= 0.85;
  return r;
}
function coinMult() {
  let m = upMult('rev', up('rev'));
  if (G.buff && G.buff.id === 'coin') m *= 1 + 0.5 * G.buff.mag;
  if (G.debuff && G.debuff.id === 'coin') m *= 0.75;
  return m;
}
function gainCoins(n, x, z) {
  n = Math.max(1, Math.round(n * coinMult()));
  G.stats.coins += n;
  HUD.coinPulse = 1; HUD.plus.push({ n, t: 0 });
  if (x != null) floatText(x, z, 2.2, '+' + fmtInt(n), '#ffd23d', 22);
  return n;
}
function bankCoins() {
  if (G.sim || G.banked) return;
  G.banked = true;
  Store.d.coins = (Store.d.coins || 0) + G.stats.coins;
  Store.save();
}
const pierceBuff = () => !!(G.buff && G.buff.id === 'pierce');
function reach() { return BAL.shotRange + (pierceBuff() ? 2 : 0); }

function alive(t) { return t && !t.dead; }
// frontal shields: flank them. Rift shield walls can't be flanked.
function shieldBlocks(e, x) { return e.shield && (e.look === 'shieldcrawler' || Math.abs(e.x - (x == null ? G.lead.x : x)) < 1.1); }

// ---------------------------------------------------------------------------
// Gunfire: every soldier fires on its own staggered timer, straight ahead.
// Up to 25 guns fire individually; past that the front 25 fire for everyone
// (each shot carries N/25 soldiers' damage) and the renderer draws a stream.
// ---------------------------------------------------------------------------
function guns() { return Math.min(G.N, BAL.gunCap); }
// Every soldier fires on its own timer (offset at spawn, jittered each shot: never in sync), from
// its own place in the block, so the volley fans across the whole formation. Up to 60 soldiers
// each gun is one soldier; past 60, 60 representative soldiers spread across the block fire
// for everyone (each shot carries N/60 soldiers' damage and draws wider and brighter).
function updateGuns(dt, firing) {
  const n = guns();
  if (!firing || !n) return;
  const rate = fireRate(), A = archDef();
  const w = G.N > BAL.gunCap ? G.N / BAL.gunCap : 1;
  const dmg = shotDamage(G.phase !== 'run') * w;
  const kind = SHOT_KIND[A.id], nb = Math.max(1, G.bodies.length);
  for (let i = 0; i < n; i++) {
    const gun = G.guns[i];
    gun.t -= dt;
    if (gun.t > 0) continue;
    gun.t += (0.8 + Math.random() * 0.4) / rate;
    if (gun.t < 0) gun.t = Math.random() / rate;
    const b = G.N > BAL.gunCap ? G.bodies[Math.floor((i + 0.5) * nb / n)] : i < G.bodies.length ? G.bodies[i] : null; // the last gun is Kai's
    const s = SHOTS.spawn();
    if (!s) continue; // pool exhausted: skip the shot rather than grow
    const bx = b ? b.x : G.lead.x, bz = G.P + (b ? b.oz : 0);
    s.kind = kind; s.x = bx + 0.16; s.z = bz + 0.55; s.pz = s.z; s.y = 0.78;
    // a slight outward fan: the volley covers the block's full width and a little beyond by mid-range
    s.vz = BAL.shotSpeed; s.vx = (b ? b.ox : 0) / Math.max(0.5, formHalf()) * 0.9 + rand(-0.15, 0.15); s.dmg = dmg; s.w = w / rate; s.zEnd = reach(); s.t = 0; // range is measured from the squad, which is moving too
    // archetype perks: crossbow bolts lob over frontal shields, orbs bend and pierce one,
    // blades cleave the next body, beams pierce two (armor stops them)
    s.pierce = kind === 1 ? 1 : kind === 2 ? 1 : kind === 3 ? 2 : 0;
    if (pierceBuff()) s.pierce++;
    s.last = null; s.last2 = null; s.vis = true;
    G.shotN++;
    // muzzle flash on every shot: 0.5 units, exactly 2 rendered frames, random rotation
    fx(FXK.flash, s.x, s.y, s.z + 0.1, 0, 0, 0, 0.25, 0.5, 0xfff2b0);
    if (Math.random() < 0.3) fx(FXK.casing, bx + 0.2, 0.8, bz, rand(1.5, 3), rand(2, 4), rand(-1.5, 0), 0.5, 0.06, 0xe8b84a);
  }
  G.recoil = Math.min(1, (G.recoil || 0) + dt * 6);
}
let ESORT = [];
function sortEnemies() { ESORT = G.enemies; ESORT.sort((a, b) => a.z - b.z); }
function firstIdx(z) { let lo = 0, hi = ESORT.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ESORT[m].z < z) lo = m + 1; else hi = m; } return lo; }

function updateShots(dt) {
  const A = archDef(), rate = fireRate();
  let streamEnd = 0;
  for (let i = SHOTS.n - 1; i >= 0; i--) {
    const s = SHOTS.a[i];
    s.t += dt;
    s.pz = s.z;
    if (s.kind !== 1) s.x += s.vx * dt;
    if (s.kind === 1) { // orbs bend toward the nearest target ahead
      let best = null, bd = 2.6;
      for (let k = firstIdx(s.z); k < ESORT.length && ESORT[k].z < s.z + 12; k++) { const e = ESORT[k]; if (e.dead || !e.active || e === s.last || e.shield) continue; const d = Math.abs(e.x - s.x); if (d < bd) { bd = d; best = e; } }
      if (best) s.vx = lerp(s.vx, clamp((best.x - s.x) * 6, -8, 8), 1 - Math.exp(-dt * 6));
      s.x += s.vx * dt;
    }
    s.z += s.vz * dt;
    let dead = false;
    // bands: bullets pass through and pump whatever band they cross
    for (const set of G.sets) {
      if (set.done || set.z <= s.pz || set.z > s.z) continue;
      for (const b of set.bands) if (s.x >= b.x0 && s.x < b.x1) { pumpBand(set, b, s.w * (s.kind === 1 ? 1 : 1), s.dmg); break; }
    }
    // weapon crates: shoot them down before you pass them
    for (const c of G.crates) {
      if (c.dead || c.z <= s.pz - 0.6 || c.z > s.z + 0.6 || Math.abs(c.x - s.x) > 0.85) continue;
      hitCrate(c, s.dmg, s.x); dead = true; break;
    }
    // barrels and barricades
    if (!dead) for (const br of G.barrels) {
      if (br.dead || br.z <= s.pz - 0.5 || br.z > s.z + 0.5 || Math.abs(br.x - s.x) > 0.75) continue;
      hitBarrel(br, s.dmg); dead = true; break;
    }
    if (!dead) for (const bar of G.bars) {
      if (bar.dead || bar.z <= s.pz || bar.z > s.z || s.x < bar.x0 || s.x > bar.x1) continue;
      damageBar(bar, s.dmg, s.x); dead = true; break;
    }
    // enemies in the swept segment
    if (!dead) {
      const r = s.kind === 2 ? 1.0 : s.kind === 1 ? 0.25 : 0.22;
      for (let k = firstIdx(s.pz - 0.6); k < ESORT.length; k++) {
        const e = ESORT[k];
        if (e.z > s.z + 0.6) break;
        if (e.dead || !e.active || e.inv || e === s.last || e === s.last2) continue;
        if (Math.abs(e.x - s.x) > e.r + r) continue;
        if (e.leap && e.y > 1.2) continue;
        if (s.kind !== 0 && shieldBlocks(e, s.x)) { worldPuff(e.x, e.z, 0.8, 0x9fd0ff); dead = true; break; }
        damageEnemy(e, s.dmg, s.x);
        streamEnd = Math.max(streamEnd, e.z);
        if (s.kind === 3 && e.armored && !pierceBuff()) { dead = true; break; }
        if (s.pierce-- <= 0) { dead = true; break; }
        s.last2 = s.last; s.last = e;
        if (s.kind === 2 && s.pierce < 0) { dead = true; break; }
      }
    }
    // the boss: always on the road, in reach once it is within 30 units
    if (!dead && G.boss && !G.boss.dead) {
      const bz = G.boss.z - 1.4;
      if (s.z >= bz && bossHitX(s.x)) { hitBoss(s.dmg, s.x, bz); dead = true; }
    }
    if (!dead && s.z - G.P > s.zEnd) dead = true;
    if (dead) { if (s.z > G.P) streamEnd = Math.max(streamEnd, Math.min(s.z, G.P + s.zEnd)); SHOTS.kill(i); }
  }
  G.streamEnd = lerp(G.streamEnd || G.P + reach(), streamEnd > G.P ? streamEnd : G.P + reach(), 1 - Math.exp(-dt * 10));
  // return fire
  for (let i = ESHOTS.n - 1; i >= 0; i--) {
    const s = ESHOTS.a[i];
    s.t += dt;
    s.x += s.vx * dt; s.z += s.vz * dt;
    if (s.z <= G.P + 0.2) {
      const fh = formHalf();
      if (Math.abs(s.x - G.lead.x) < fh * 0.9 + 0.2) { loseSoldiers(1); G.stats.hits++; spark(s.x, 0.8, G.P, 6, 0xff5a4a); }
      else G.stats.dodged++;
      ESHOTS.kill(i);
    } else if (s.t > 6) ESHOTS.kill(i);
  }
}
function enemyFire(x, z, tx, kind, speed) {
  const s = ESHOTS.spawn();
  if (!s) return;
  const sp = speed || 16, d = Math.max(1, z - G.P);
  s.x = x; s.z = z; s.y = 1.0; s.vz = -sp; s.vx = (tx - x) / (d / sp); s.t = 0; s.kind = kind || 0; s.dk = -1;
  SFX.enemyShot();
}

// ---------------------------------------------------------------------------
// Bands: pumping, flipping, passing
// ---------------------------------------------------------------------------
function pumpBand(set, b, pts, dmg) {
  b.acc += dmg; // the floating number shows damage like any target
  if (Math.random() < 0.5) impact(clamp(G.lead.x, b.x0 + 0.3, b.x1 - 0.3), 1.2, set.z, set.bands.length && b.red ? 0xff6a7a : 0x9dff9a);
  // a squad bigger than par pumps no faster than par; a smaller one pumps slower
  pts *= Math.max(set.par, BAL.pumpFloor) / Math.max(G.N, set.par, BAL.pumpFloor);
  b.pts += pts;
  G.stats.pumped += pts;
  while (b.pts >= b.cost && b.steps < b.max) {
    b.pts -= b.cost;
    const r = pumpStep(b);
    b.pop = 1;
    if (r === 'flip') {
      b.cost = pumpCost(set.par, b, BAL.shotRange, G.v);
      G.stats.flips++;
      SFX.flip(); Haptic.buzz(20);
      G.flash = Math.max(G.flash, 0.22); G.flashCol = '#5cff7a';
      floatText((b.x0 + b.x1) / 2, set.z, 4.6, 'FLIPPED!', '#7dff8f', 28);
      spark((b.x0 + b.x1) / 2, 2, set.z, 30, 0x5cff7a, 8);
    } else SFX.pump(r === 'up');
  }
  if (b.steps >= b.max) b.pts = 0;
}
function bandSpans(set) { return set.bands.map(b => [b.x0, b.x1]); }
function bandUnder(set, x) { for (let i = 0; i < set.bands.length; i++) { const b = set.bands[i]; if (x >= b.x0 && x < b.x1) return i; } return x < 0 ? 0 : set.bands.length - 1; }
function passSet(set) {
  set.done = true;
  const idx = bandUnder(set, G.lead.x);
  const b = set.bands[idx];
  set.picked = idx;
  let note = '', eff = b;
  if (b.op === 'add' && Math.random() < 0.03 * shopLvl('lucky')) { eff = Object.assign({}, b, { n: b.n * 2 }); note = 'LUCKY! '; }
  const before = G.N;
  let after = applyBand(G.N, eff, hasRelic('remainder'));
  if (b.op === 'mul' && hasRelic('twin') && Math.random() < 0.05) { after = applyBand(after, b); note = 'TWIN! '; }
  setCount(after);
  G.punch = 1;
  for (const bd of G.bodies) bd.pop = 1; // ripple runs back through the ranks
  const col = b.red ? '#ff3b5c' : '#5cff7a';
  G.flash = 0.18; G.flashCol = col;
  floatText(G.lead.x, G.P, 4.2, note + (after >= before ? '+' : '−') + fmtInt(Math.abs(after - before)), after >= before ? '#ffffff' : '#ffb3c1', 28);
  spark(G.lead.x, 1.5, G.P + 0.5, 26, b.red ? 0xff3b5c : 0x5cff7a, 7);
  SFX.gate(after >= before); Haptic.buzz(15);
  if (G.tut && G.tut.step < 2) G.tut.step++;
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------
function damageEnemy(e, dmg, x) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.06; e.acc += dmg;
  impact(x == null ? e.x : x, 0.8, e.z - e.r * 0.6, 0xfff2c0);
  if (e.hp <= 0) {
    if (e.kind === 'treasure') { gainCoins(cartValue(G.level, G.loop), e.x, e.z); if (G.level >= 10 && Math.random() < 0.25) { G.stats.relic = true; floatText(e.x, e.z, 3.5, 'RELIC FOUND', '#c9a8ff', 22); } }
    else if (e.elite) for (let i = 0; i < 2; i++) G.coins.push({ x: clamp(e.x + rand(-0.8, 0.8), -4.4, 4.4), z: e.z + rand(-0.5, 1), val: discValue(G.level, G.loop), taken: false, spin: 0 });
    killEnemy(e);
    if (e.kind !== 'treasure' && !e.rival && G.phase === 'run' && Math.random() < (hasRelic('scavenger') ? 0.021 : 0.015)) dropPickup();
  }
}
function killEnemy(e) {
  e.dead = true; G.stats.kills++;
  flushAcc(e, e.x, e.z, 1.6);
  SFX.kill();
  spark(e.x, 0.7, e.z, 10, LOOK_COLORS[e.look] || 0xffffff, 5);
}
function damageBar(b, dmg, x) {
  if (b.dead) return;
  b.hp -= dmg; b.flash = 0.06; b.acc += dmg;
  impact(x, 0.8, b.z - 0.35, 0xd8d2c4);
  if (b.hp <= 0) {
    b.dead = true; flushAcc(b, (b.x0 + b.x1) / 2, b.z, 1.6);
    SFX.crumble();
    spark((b.x0 + b.x1) / 2, 0.5, b.z, 22, 0xb9b2a4, 6);
  }
}
const WEAPON_NAMES = ['', 'BOLT RIFLE', 'TWIN BOLT', 'CARBINE', 'BATTLE RIFLE', 'BURST RIFLE', 'MARKSMAN RIFLE', 'ASSAULT RIFLE', 'ROTARY RIFLE', 'HEAVY REPEATER', 'HEAVY AUTOMATIC'];
function hitCrate(c, dmg, x) {
  c.hp -= dmg; c.flash = 0.06; c.acc += dmg;
  impact(x, 0.9, c.z - 0.6, 0xffd23d);
  if (c.hp > 0) return;
  c.dead = true; G.stats.crates++;
  flushAcc(c, c.x, c.z, 2);
  SFX.crumble(); SFX.buff(); Haptic.buzz(20);
  spark(c.x, 1, c.z, 26, 0xffd23d, 7);
  if (c.tier > G.weapon) {
    G.weapon = c.tier;
    if (!G.endless && Store.d.run) { Store.d.run.weapon = G.weapon; Store.save(); }
    else if (G.endless) Store.d.endlessWeapon = G.weapon;
    floatText(G.lead.x, G.P, 4.4, 'Lv ' + G.weapon + ' ' + WEAPON_NAMES[G.weapon], '#ffd23d', 26);
    G.flash = Math.max(G.flash, 0.25); G.flashCol = '#ffd23d';
    if (typeof GFX !== 'undefined' && !G.sim) GFX.squadKey = ''; // the gun in every soldier's hands changes
  } else floatText(c.x, c.z, 2.6, 'Lv ' + c.tier + ' (have Lv ' + G.weapon + ')', '#dddddd', 16);
}
function hitBarrel(br, dmg) {
  br.hp -= dmg; br.flash = 0.06; br.acc += dmg;
  impact(br.x, 0.8, br.z - 0.5, 0xffd23d);
  if (br.hp <= 0) explodeBarrel(br);
}
function explodeBarrel(br) {
  if (br.dead) return;
  br.dead = true;
  G.stats.blasts++;
  SFX.explode(); Haptic.buzz(35);
  G.shake = Math.max(G.shake, 14); G.flash = Math.max(G.flash, 0.35); G.flashCol = '#ffb02e';
  for (let i = 0; i < 4; i++) spark(br.x + rand(-1, 1), rand(0.5, 2), br.z + rand(-1, 1), 22, i % 2 ? 0xff7a1a : 0xffd23d, 10);
  G.blasts = G.blasts || []; G.blasts.push({ x: br.x, z: br.z, r: br.blast, t: 0 });
  // enemies caught in it die; so does whoever stands in it
  for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - br.x, e.z - br.z) < br.blast + e.r) damageEnemy(e, e.hp + 1);
  if (hasRelic('powder')) return;
  const dz = G.P - br.z;
  if (Math.abs(dz) < br.blast) {
    const half = Math.sqrt(br.blast * br.blast - dz * dz);
    const n = killInZone(x => Math.abs(x - br.x) < half, 0.2); // a disaster, never a wipe
    if (n) floatText(G.lead.x, G.P, 3.2, '−' + n, '#ff8a5a', 26);
  }
}
// floating damage numbers: hits pile up per target and float off every ~0.12s
function flushAcc(t, x, z, y) {
  if (t.acc >= 0.5) floatText(x + rand(-0.3, 0.3), z, y, fmtHP(Math.round(t.acc)), '#ffffff', 15, true);
  t.acc = 0; t.accT = 0;
}
function tickAcc(t, dt, x, z, y) { if (t.acc > 0 && (t.accT += dt) > 0.12) flushAcc(t, x, z, y); }

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
function warnTime() { return Math.max(1.4, G.level <= 8 ? 3 : G.level <= 16 ? 2.4 : G.level <= 24 ? 1.8 : 1.4) + 0.2 * shopLvl('keen') + (hasRelic('hourglass') ? 0.4 : 0); }
function nearSet(z) { return G.sets.some(s => !s.done && z > s.z - 8 && z < s.z + 2); }
function dropPickup(forced) {
  const kind = forced || (Math.random() < 0.65 ? 'buff' : 'debuff');
  const lead = kind === 'debuff' ? warnTime() : 2.6;
  let z = G.P + lead * G.v;
  if (z > G.Lr - 2) return;
  if (kind === 'debuff') {
    const live = G.picks.filter(p => p.kind === 'debuff' && !p.done);
    if (live.length >= 1) return;
    if (nearSet(z)) { z += 10; if (nearSet(z) || z > G.Lr - 2) return; }
  }
  const ids = Object.keys(kind === 'debuff' ? DEBUFFS : BUFFS);
  G.picks.push({ kind, id: pick(ids), x: rand(-3.8, 3.8), z, done: false });
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
      else { SFX.puff(); spark(p.x, 0.4, p.z, 10, 0xff8a9a, 3); floatText(p.x, p.z, 1.5, 'DODGED', '#ffd6dc', 16); }
    } else if (dx < fh + 0.6) applyBuff(p.id, p.kind === 'gold' ? 3 : 1, p.kind === 'gold' ? 20 : 10);
  }
  G.picks = G.picks.filter(p => !p.done);
}
function applyBuff(id, mag, dur) {
  G.buff = { id, mag, t: dur, max: dur };
  SFX.buff(); Haptic.buzz(10);
  floatText(G.lead.x, G.P, 3, (mag > 1 ? 'GOLD ' : '') + BUFFS[id].name, mag > 1 ? '#ffd23d' : '#7dff8f', mag > 1 ? 24 : 20);
  spark(G.lead.x, 1, G.P, 18, mag > 1 ? 0xffd23d : 0x5cff7a, 6);
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
// Road: gates, enemies, contacts, coins, splits, return fire
// ---------------------------------------------------------------------------
function updateSets(dt) {
  for (const s of G.sets) {
    if (s.done) continue;
    for (const b of s.bands) { b.pop = Math.max(0, b.pop - dt * 4); tickAcc(b, dt, clamp(G.lead.x, b.x0 + 0.5, b.x1 - 0.5), s.z, 2.6); }
    if (G.P >= s.z) passSet(s);
  }
}
function moveEnemies(dt) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    tickAcc(e, dt, e.x, e.z, 1.7 * (LOOK_SCALE[e.look] || 1));
    const d = e.z - G.P;
    if (!e.active) { if (d >= 80) continue; e.active = true; }
    if (e.half) { // split-road swarms roam their own half
      if (Math.random() < dt * 1.5) e.strafe = rand(-1, 1);
      e.x = clamp(e.x + e.strafe * 3.5 * dt, e.half < 0 ? -4.6 : 0.8, e.half < 0 ? -0.8 : 4.6);
    } else if (e.strafe) { const fast = e.look === 'crawler'; if (Math.random() < dt * (fast ? 2.2 : 0.8)) e.strafe = rand(-1, 1); e.x = clamp(e.x + e.strafe * (e.look === 'wisp' ? 2.2 : fast ? 5 : 3.2) * dt, -4.6, 4.6); }
    if (e.look === 'crawler' || e.look === 'bigcrawler') {
      const tLeft = d / (G.v + e.speed);
      e.invT -= dt;
      const driftLv = G.stage === 5 && RIFT_PROFILES[G.level] === 'drift';
      if (e.invT <= 0) { e.inv = e.inv ? 0 : 1; e.invT = e.inv ? (driftLv ? rand(1.2, 1.8) : rand(0.5, 0.9)) : (driftLv ? rand(0.8, 1.2) : rand(1.6, 2.6)); }
      if (tLeft < 1.7) e.inv = 0; // always visible at least 1.5s before contact
    }
    if (e.kind === 'treasure') {
      e.runT += dt;
      e.z = G.P + 24 + Math.sin(e.runT * 0.5) * 2;
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
        if (Math.abs(G.lead.x - e.x) < fh) { contact(e); spark(e.x, 0.4, e.z, 14, 0xff3b5c, 5); }
        else { worldPuff(e.x, e.z, 0.3, 0xcccccc); floatText(e.x, e.z, 1.5, 'MISSED', '#dddddd', 15); }
      }
      continue;
    }
    if (e.kind === 'treasure') continue;
    if (e.half && G.split && e.half !== G.split.mine) { if (e.z - G.P < -3) e.dead = true; continue; } // the divider is between you
    if (e.z - G.P < 0.5) {
      if (Math.abs(e.x - G.lead.x) < fh + e.r * 0.5) { contact(e); e.dead = true; }
      else if (e.z - G.P < -3) e.dead = true;
    }
  }
  if (G.enemies.some(e => e.dead)) G.enemies = G.enemies.filter(e => !e.dead);
  for (const b of G.bars) {
    b.flash = Math.max(0, b.flash - 0.016);
    if (b.dead || b.z - G.P > 0.5) continue;
    b.dead = true;
    const lo = Math.max(b.x0, G.lead.x - fh), hi = Math.min(b.x1, G.lead.x + fh);
    if (hi > lo) {
      loseSoldiers(Math.max(1, Math.ceil(G.N * 0.15 * (hi - lo) / (2 * fh))));
      SFX.crumble(); G.shake = Math.max(G.shake, 8);
      spark(G.lead.x, 0.5, b.z, 20, 0xb9b2a4, 6);
    }
  }
  for (const br of G.barrels) {
    br.flash = Math.max(0, br.flash - 0.016);
    if (br.dead) continue;
    if (br.z - G.P < 0.6 && br.z - G.P > -1 && Math.abs(br.x - G.lead.x) < fh + 0.5) explodeBarrel(br); // walked into it
    else if (br.z - G.P < -2) br.dead = true;
  }
  for (const c of G.crates) { // a crate you didn't shoot down is gone once you pass it
    if (c.dead || c.z - G.P > -0.5) continue;
    c.dead = true; c.missed = true; G.stats.cratesMissed++;
  }
}
function contact(e) {
  let n = e.kill;
  if (G.debuff && G.debuff.id === 'bunch') n = Math.ceil(n * 1.5);
  if (G.buff && G.buff.id === 'spread') n = Math.max(1, Math.floor(n * 0.6));
  spark(e.x, 0.5, G.P, 10, 0xff3b5c, 5);
  loseSoldiers(n);
}
function updateCoins(dt) {
  const fh = formHalf();
  for (const c of G.coins) {
    if (c.taken) continue;
    c.spin += dt * 3;
    const d = c.z - G.P;
    if (hasRelic('magnet') && d < 16 && d > 0) c.x += clamp(G.lead.x - c.x, -6 * dt, 6 * dt);
    if (d < 0.6 && d > -1.2 && Math.abs(c.x - G.lead.x) < fh + 0.6) {
      c.taken = true; gainCoins(c.val, c.x, c.z); SFX.disc();
      spark(c.x, 0.8, c.z, 8, 0xffd23d, 4);
    }
    if (d < -3) c.taken = true;
  }
  if (G.coins.some(c => c.taken)) G.coins = G.coins.filter(c => !c.taken);
  for (const c of G.carts) {
    if (c.taken) continue;
    const d = c.z - G.P;
    if (d < 0.8 && d > -1.5 && Math.abs(c.x - G.lead.x) < fh + 0.9) {
      c.taken = true; gainCoins(c.val, c.x, c.z); SFX.cart(); Haptic.buzz(15);
      spark(c.x, 1, c.z, 30, 0xffd23d, 7);
    } else if (d < -2) c.taken = true;
  }
}
function updateSplit() {
  const s = G.splits.find(s => G.P >= s.z0 && G.P < s.z1);
  if (s && !G.split) {
    G.split = s; s.mine = G.lead.x < 0 ? -1 : 1; G.stats.split = s.mine === s.side ? 'swarm' : 'gates';
    spawnBlock(s.side); spawnBlock(s.side); // the swarm side fills up as the divider starts
  }
  if (!s) G.split = null;
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
        h.acc = (h.acc || 0) + G.N * (h.kind === 'fire' ? 0.1 : 0.03) * dt * (hi - lo) / (2 * fh);
        if (h.acc >= 1) { const n = Math.floor(h.acc); h.acc -= n; loseSoldiers(n); }
      }
    }
  }
  if (G.hazards.some(h => h.done)) G.hazards = G.hazards.filter(h => !h.done);
}
// From Stage 2 the crowd shoots back: slow visible tracers aimed where you are now
function updateReturnFire(dt) {
  // stray fire scales with the squad: a lone soldier isn't worth the crowd's aim
  const rate = BAL.shotsPerSec[G.stage - 1] * (G.endless ? 1.5 : 1) * Math.min(1, G.N / 20);
  if (!rate || !G.sets.length || G.P < G.sets[0].z) return;
  G.efT += dt * rate;
  while (G.efT >= 1) {
    G.efT -= 1;
    let e = null;
    for (let k = 0; k < 6 && !e; k++) { const c = ESORT[Math.floor(Math.random() * ESORT.length)]; if (c && !c.dead && c.active && !c.inv && c.z - G.P > 8 && c.z - G.P < 40) e = c; }
    if (e) enemyFire(e.x, e.z, G.lead.x + rand(-0.5, 0.5));
  }
}

// ---------------------------------------------------------------------------
// Base assault / boss
// ---------------------------------------------------------------------------
// Bosses: colossal, 3 phases (100/66/33%), attacks on a 2s telegraph that delete soldiers.
const BOSS_DEF = {
  brine: { w: 3.2, attacks: [['slam', 'volley'], ['slam', 'volley', 'slam'], ['volley', 'slam', 'volley']] },
  warden: { w: 3.0, attacks: [['sweep'], ['sweep', 'slam'], ['sweep', 'sweep', 'slam']] },
  shogun: { w: 2.8, attacks: [['charge'], ['charge', 'sweep'], ['charge', 'sweep']] },
  echo: { w: 2.6, attacks: [['volley'], ['volley'], ['volley', 'volley']] },
  otherkai: { w: 2.8, attacks: [['volley', 'slam', 'sweep', 'charge'], ['slam', 'sweep', 'charge', 'volley'], ['sweep', 'charge', 'volley', 'slam']] },
};
// The boss is on the road from the first second: far down the road, huge in silhouette, walking
// toward you while you advance. It meets you at 100%; your fire reaches it from ~40%.
function bossDist(p) { return BAL.bossGap + BAL.bossD0 * Math.max(0, 1 - p); }
function startBoss() {
  const kinds = ['brine', 'warden', 'shogun', 'echo', 'otherkai'];
  const kind = kinds[G.stage - 1], D = BOSS_DEF[kind], stageBoss = isStageBoss(G.level);
  const scale = stageBoss ? 1.25 : 1.05; // 6-8 soldiers tall
  const hp = bossHP(G.level, G.loop);
  G.boss = { kind, variant: !stageBoss, scale, hue: stageBoss ? 0 : ((G.level * 47) % 360) / 360, x: 0, z: bossDist(0), homeZ: 0, w: D.w * scale * 0.9,
    hp, max: hp, phase: 0, flash: 0, atk: null, atkT: 1.5, seq: 0, t: 0, lunge: 0, split: false, platform: false, dead: false,
    arch: kind === 'echo' ? G.arch : 'crossbow', archI: 0, recoil: 0, acc: 0, accT: 0, firstHitP: null, walk: 0 };
  const S = STAGES[G.stage - 1];
  G.nameCard = { name: stageBoss ? S.boss : 'SPAWN OF ' + S.boss.replace(/^THE /, ''), sub: stageBoss ? S.bossSub : 'LEVEL ' + G.level + ' · ' + S.short.toUpperCase(), t: 0, max: 2.4 };
  G.bossIntro = 1.5; // camera push-in; the run starts after it
  if (!G.sim) { SFX.sting(); SFX.wind(); }
}
function bossHitX(x) {
  const b = G.boss;
  if (b.split) return Math.abs(x - (b.x - 2.6)) < b.w * 0.6 || Math.abs(x - (b.x + 2.6)) < b.w * 0.6;
  return Math.abs(x - b.x) < b.w;
}
function hitBoss(dmg, x, z) {
  const b = G.boss;
  if (b.firstHitP == null) b.firstHitP = G.P / G.Lr;
  b.hp -= dmg; b.acc += dmg; b.flash = 0.06;
  G.stats.bossDmg = (G.stats.bossDmg || 0) + dmg;
  impact(x, rand(1, 4), z, 0xffd6a0);
  SFX.bossHit();
  const frac = b.hp / b.max, phase = frac > 2 / 3 ? 0 : frac > 1 / 3 ? 1 : 2;
  if (phase > b.phase) bossPhase(phase);
  if (b.hp <= 0 && !G.noBreak) { b.hp = 0; bossDown(); }
}
// while the road runs: the boss walks at you, sways across the road, breaks as it is hurt
function updateBossRun(dt) {
  const b = G.boss;
  b.t += dt; b.walk += dt;
  b.flash = Math.max(0, b.flash - dt); b.recoil = Math.max(0, b.recoil - dt * 2);
  b.z = G.P + bossDist(G.P / G.Lr);
  b.x = lerp(b.x, Math.sin(b.t * 0.35) * 1.4, 1 - Math.exp(-dt * 1.2));
  tickAcc(b, dt, b.x + rand(-1, 1), b.z - 1, 4.5);
}
function bossDown() {
  const b = G.boss;
  if (b.dead) return;
  b.dead = true;
  G.phase = 'done';
  G.stats.killP = G.P / G.Lr; G.stats.killT = G.lt;
  gainCoins(baseBonus(G.level, G.loop));
  SFX.bossDie(); Haptic.buzz(45); Gunfire.stop();
  G.shake = 18; G.flash = 0.7; G.flashCol = '#ffffff';
  G.timeScale = 0.25; G.slowT = 0.4; G.push = 0.001;
  for (let i = 0; i < 6; i++) spark(b.x + rand(-4, 4), rand(1, 6), b.z - 0.5, 30, i % 2 ? 0xffffff : 0xffb02e, 12);
  for (const e of G.enemies) if (!e.dead) { e.dead = true; worldPuff(e.x, e.z, 0.6, 0xffffff); }
  if (!G.sim && (Math.random() < 0.35 || isStageBoss(G.level))) {
    const n = Math.floor(Math.random() * 9) + 2;
    G.stats.gems = n; Store.d.gems += n; Store.save();
    for (let i = 0; i < n; i++) G.parts.push({ kind: 'gem', sx: V.cx + rand(-60, 60), sy: V.h * 0.4, vx: rand(-260, 260), vy: rand(-420, -160), life: 1.4 + i * 0.07, max: 1.4, delay: 0.4, i });
  }
  if (isStageBoss(G.level) && G.level >= 10) G.stats.relic = true;
  G.doneT = 1.6;
}

// ---------------------------------------------------------------------------
// Enemy blocks: packed rectangles, 3-5 ranks deep, advancing as one mass. Front rank runners,
// a core of standard bodies, one or two brutes anchoring the back.
// ---------------------------------------------------------------------------
function liveAhead() { let n = 0; for (const e of G.enemies) if (!e.dead && e.z > G.P) n++; return n; }
function spawnBlock(half) {
  const L = G.endless ? 40 : G.level, rnd = G.rnd;
  // before the first gate the lone soldier walks a clear middle lane while blocks march down both edges
  // ...and until the squad outnumbers a block, blocks keep out of its lane: it should feel the army, not drown in it
  const lone = !half && !G.endless && G.N < Math.max(8, 2 * blockSize(L));
  const size = blockSize(L), room = lone ? ROAD - 2.7 : half ? ROAD - 1.2 : 2 * ROAD - 1;
  // edge blocks beside a small squad go deeper rather than wider so the middle lane stays clear
  const R = lone ? Math.max(3, Math.ceil(size / (Math.floor(room / 0.6) + 1))) : clamp(3 + Math.floor(size / 12), 3, 5), cols = Math.ceil(size / R);
  const spx = Math.min(0.85, room / Math.max(1, cols - 1)), spz = 0.85, wid = (cols - 1) * spx;
  let lo = -ROAD + 0.5 + wid / 2, hi = ROAD - 0.5 - wid / 2;
  if (half) { lo = half < 0 ? -ROAD + 0.5 + wid / 2 : 0.8 + wid / 2; hi = half < 0 ? -0.8 - wid / 2 : ROAD - 0.5 - wid / 2; }
  let cx = lo < hi ? lo + rnd() * (hi - lo) : (lo + hi) / 2;
  if (lone) G.loneSide = -(G.loneSide || 1);
  let front = G.boss && !G.boss.dead ? Math.min(G.P + 70, G.boss.z - 2 - (R - 1) * spz) : G.P + 70;
  if (lone) { // a small squad must be able to take a gate without a block arriving on top of it
    const meets = f => { const tm = (f - G.P) / (G.v + 2.6), pm = G.P + G.v * tm, back = pm + (R - 1) * spz * G.v / (G.v + 2.6); return G.sets.some(st => !st.done && st.z > pm - 5 && st.z < back + 24); };
    let ok = false;
    for (let k = 0; k < 6 && !ok; k++) { if (!meets(front)) ok = true; else front -= 8; }
    if (!ok || front < G.P + 25) return false;
    // on a split road the gate half must stay clear: edge blocks march down the swarm half only
    const tm = (front - G.P) / (G.v + 2.6), pm = G.P + G.v * tm;
    const sp = G.splits.find(q => pm > q.z0 - 12 && pm < q.z1 + 4);
    if (sp) G.loneSide = sp.side;
    cx = G.loneSide * (ROAD - 0.4 - wid / 2);
  }
  const hp = enemyHP(L, G.loop), W = roleWeights(L), prof = G.stage === 5 ? RIFT_PROFILES[L] : null;
  const brutes = L >= 4 ? 1 + (size >= 20 ? 1 : 0) : 0, speed = 2.6;
  let made = 0;
  for (let r = 0; r < R && made < size; r++) for (let c = 0; c < cols && made < size; c++, made++) {
    let role = 'normal';
    if (r === 0) role = G.stage === 2 && L >= 9 && rnd() < 0.5 ? 'shielder' : prof === 'shields' && rnd() < 0.6 ? 'shielder' : 'runner';
    else if (r === R - 1 && c >= Math.floor((cols - brutes) / 2) && c < Math.floor((cols - brutes) / 2) + brutes) role = 'brute';
    else if (rnd() < 0.15) role = pickRole(W, rnd());
    if (role === 'leaper') role = 'normal';
    const e = addEnemy(role, cx + (c - (cols - 1) / 2) * spx + rand(-0.08, 0.08), front + r * spz + rand(-0.1, 0.1), hp, false);
    e.speed = speed; e.active = true; e.block = true; e.strafe = 0; e.lone = lone;
    if (half) { e.half = half; }
  }
  G.stats.blocks++; G.stats.spawned += made;
  return true;
}
function updateBlocks(dt) {
  if (G.phase !== 'run') return;
  const L = G.endless ? 40 : G.level;
  G.blockT -= dt; G.floorT -= dt;
  if (G.blockT <= 0) { if (spawnBlock()) G.blockT += blockInterval(L) / (G.endless ? endlessSpeed(G.endT) : 1); else G.blockT = 0.3; }
  else if (G.lt > 1 && G.floorT <= 0 && liveAhead() < enemyFloor(L)) { spawnBlock(); G.floorT = 0.3; } // never let the road look empty
}

function bossTelegraph(type) {
  const b = G.boss, fh = formHalf();
  const a = { type, wind: 2, max: 2, zones: [] };
  if (type === 'sweep') { // two thirds of the road, from one side
    const w = ROAD * 2 * 2 / 3, left = G.lead.x < 0 ? Math.random() < 0.75 : Math.random() < 0.25;
    a.x0 = left ? -ROAD : ROAD - w; a.x1 = a.x0 + w;
  } else if (type === 'slam') { // circular shockwave from a marked point near you
    a.cx = clamp(G.lead.x + rand(-1.2, 1.2), -3.5, 3.5); a.r = 2.6 + (b.phase * 0.3);
  } else if (type === 'volley') { // three marked columns; one is on you
    const w = b.kind === 'echo' ? { crossbow: 1.4, staff: 2.0, blade: 2.4, beam: 1.1 }[b.arch] : 1.6;
    const cols = [clamp(G.lead.x, -4, 4)];
    for (let t = 0; cols.length < 3 && t < 40; t++) { const c = rand(-4, 4); if (cols.every(o => Math.abs(o - c) > w + 0.4)) cols.push(c); }
    a.cols = cols; a.cw = w;
  } else if (type === 'charge') { // a lunge down one lane
    a.x0 = clamp(G.lead.x - 1.6, -ROAD, ROAD - 3.2); a.x1 = a.x0 + 3.2;
  }
  b.atk = a;
  SFX.telegraph();
}
function inAttack(a, x) {
  switch (a.type) {
    case 'sweep': case 'charge': return x > a.x0 && x < a.x1;
    case 'slam': return Math.abs(x - a.cx) < a.r;
    case 'volley': return a.cols.some(c => Math.abs(x - c) < a.cw / 2);
  }
  return false;
}
// The clash: the boss has reached the squad. Telegraphed strikes grind the squad down; it can still win.
function updateBoss(dt) {
  const b = G.boss;
  b.t += dt;
  b.flash = Math.max(0, b.flash - dt); b.recoil = Math.max(0, b.recoil - dt * 2);
  // heavy drift across the road: following it is part of the fight
  const drift = b.kind === 'brine' ? 1.6 : b.kind === 'warden' ? 1.2 : 2.0;
  if (!b.atk || b.atk.type !== 'charge') b.x = lerp(b.x, Math.sin(b.t * 0.45) * drift, 1 - Math.exp(-dt * 1.5));
  if (b.lunge > 0) { b.lunge = Math.max(0, b.lunge - dt * 1.4); b.z = lerp(b.homeZ, G.P + 3, Math.sin(Math.min(1, b.lunge) * Math.PI)); }
  else b.z = lerp(b.z, b.homeZ, 1 - Math.exp(-dt * 3));
  if (b.atk) {
    const a = b.atk;
    a.wind -= dt;
    if (a.type === 'charge' && a.wind < 0.6) b.x = lerp(b.x, (a.x0 + a.x1) / 2, 1 - Math.exp(-dt * 8));
    if (a.wind <= 0) {
      const n = killInZone(x => inAttack(a, x), BAL.bossHitCap);
      if (n) floatText(G.lead.x, G.P, 3, '−' + n, '#ff3b5c', 28); else { floatText(G.lead.x, G.P, 3, 'DODGED', '#ffffff', 22); G.stats.dodged++; }
      if (n) G.stats.hits++;
      SFX.slam(); G.shake = Math.max(G.shake, 14); Haptic.buzz(25);
      b.recoil = 1;
      if (a.type === 'charge') b.lunge = 1;
      const col = b.kind === 'brine' ? 0x36d6b5 : b.kind === 'warden' ? 0xff7a1a : 0xff3b5c;
      if (a.type === 'sweep' || a.type === 'charge') for (let i = 0; i < 6; i++) spark(rand(a.x0, a.x1), 0.4, G.P + rand(-2, 2), 6, col, 7);
      else if (a.type === 'slam') { spark(a.cx, 0.3, G.P, 30, col, 9); G.blasts = G.blasts || []; G.blasts.push({ x: a.cx, z: G.P, r: a.r, t: 0 }); }
      else for (const c of a.cols) spark(c, 0.5, G.P, 10, col, 6);
      // the warden's chain leaves fire on the road for 3s
      if (b.kind === 'warden' && a.type === 'sweep') G.hazards.push({ x0: a.x0, x1: a.x1, t: 0, warn: 0, active: true, dur: 3, kind: 'fire' });
      b.atk = null;
      // the shogun's charge comes back as a sweep
      if (b.kind === 'shogun' && a.type === 'charge' && b.phase >= 1) { b.atkT = 0.4; b.nextForce = 'sweep'; }
      else b.atkT = [3.0, 2.6, 2.2][b.phase] + (b.kind === 'brine' ? 0.4 : 0);
    }
  } else if ((b.atkT -= dt) <= 0) {
    const list = BOSS_DEF[b.kind].attacks[b.phase];
    let type = b.nextForce || list[b.seq++ % list.length];
    b.nextForce = null;
    if (b.kind === 'otherkai') { // he cycles through all four squads
      b.archI = (b.archI + 1) % 4; b.arch = ARCH_ORDER[b.archI];
      type = { crossbow: 'volley', staff: 'slam', blade: 'sweep', beam: 'charge' }[b.arch];
    }
    bossTelegraph(type);
  }
}
function bossPhase(phase) {
  const b = G.boss;
  b.phase = phase; b.broke = 1;
  G.shake = Math.max(G.shake, 16); G.flash = 0.35; G.flashCol = '#ffffff';
  SFX.crumble(); SFX.slam(); Haptic.buzz(40);
  const hp = enemyHP(G.level, G.loop);
  spark(b.x, 4, b.z - 1, 40, 0xffffff, 10);
  switch (b.kind) {
    case 'brine': // sheds a layer; two slimelings drop off it
      for (const sd of [-1, 1]) { const e = addEnemy('normal', clamp(b.x + sd * 2, -4, 4), b.z - 3, hp * 4, false, { look: 'slime' }); e.active = true; e.speed = 2.6; e.kill = 3; }
      floatText(b.x, b.z - 2, 6, phase === 1 ? 'THE SKIN SPLITS' : 'THE CORE', '#8ff7e4', 24);
      break;
    case 'warden': floatText(b.x, b.z - 2, 6, phase === 1 ? 'THE PLATES BURN' : 'BARE IRON', '#ffb02e', 24); break;
    case 'shogun':
      if (phase === 2) { b.split = true; floatText(0, b.z - 2, 6, 'IT SPLITS IN TWO', '#ffd9a0', 24); }
      else floatText(0, b.z - 2, 6, 'SECOND LESSON', '#ffd9a0', 24);
      break;
    case 'echo': {
      const others = ARCH_ORDER.filter(a => a !== G.arch);
      b.arch = others[(phase - 1) % others.length];
      floatText(b.x, b.z - 2, 6, 'IT TURNS INTO ' + ARCH[b.arch].squad, '#2bf0ff', 22);
      for (const sd of [-1, 1]) { const e = addEnemy('normal', clamp(b.x + sd * 2.5, -4, 4), b.z - 3, hp * 3, false, { look: 'shade' }); e.active = true; e.speed = 3; e.rival = true; }
      break;
    }
    case 'otherkai':
      if (phase === 2) { b.platform = true; floatText(0, b.z - 2, 6, 'THE ROAD FALLS AWAY', '#ffffff', 24); }
      break;
  }
}
function endlessOver() {
  G.mode = 'failed';
  const d = Math.floor(G.P);
  const best = Store.d.endlessBest || 0;
  G.stats.dist = d; G.stats.newBest = d > best;
  if (d > best) Store.d.endlessBest = d;
  bankCoins();
  SFX.fail(); Gunfire.stop();
  UI.endlessOver(d, best);
}

// ---------------------------------------------------------------------------
// FX (pooled world particles; the renderer draws FX directly)
// ---------------------------------------------------------------------------
function fx(kind, x, y, z, vx, vy, vz, life, size, col) {
  if (G.sim) return; // the headless sim never draws
  const p = FX.spawn();
  if (!p) return;
  p.kind = kind; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life; p.size = size; p.col = col;
  p.frames = kind === FXK.flash ? 2 : 0; p.rot = Math.random() * TAU; // flashes live exactly 2 drawn frames (the renderer counts them)
}
function spark(x, y, z, n, col, sp) { for (let i = 0; i < n; i++) fx(FXK.spark, x, y, z, rand(-sp, sp), rand(0, sp), rand(-sp, sp) * 0.5, rand(0.2, 0.45), rand(0.07, 0.17), col); }
// a bullet impact: 6-10 sparks, 0.15 units, radiating for 0.3s
function impact(x, y, z, col) {
  if (G.sim) return;
  const n = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = Math.random() * 1.2 - 0.2, sp = 3 + Math.random() * 3; fx(FXK.spark, x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp, Math.sin(a) * Math.cos(e) * sp * 0.6, 0.3, 0.15, col); }
}
function worldBurst(x, z, y, n, col, sp) { spark(x, y, z, n, col, sp); }
function worldPuff(x, z, y, col) { for (let i = 0; i < 2; i++) fx(FXK.puff, x + rand(-0.2, 0.2), y + rand(-0.2, 0.2), z, 0, 1.5, 0, 0.3, rand(0.25, 0.45), col); }
function floatText(x, z, y, text, col, size, small) {
  if (G.sim) return;
  if (G.texts.length > 70) G.texts.shift();
  G.texts.push({ x, z, y, text: String(text), col, size: size || 18, life: small ? 0.6 : 1, max: small ? 0.6 : 1, small: !!small });
}
const HUD = { coinPulse: 0, plus: [], gemPulse: 0, gemX: 0, gemY: 0 };
function updateFx(dt) {
  for (let i = FX.n - 1; i >= 0; i--) {
    const p = FX.a[i];
    p.life -= dt;
    if (p.life <= 0 || (p.kind === FXK.flash && p.frames <= 0)) { FX.kill(i); continue; }
    if (p.kind === FXK.spark && p.size === 0.15) { p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y + p.vy * dt); continue; } // impact sparks fly straight
    p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y + p.vy * dt);
    if (p.kind === FXK.spark || p.kind === FXK.fall || p.kind === FXK.casing) p.vy -= 18 * dt;
  }
  for (const p of G.parts) {
    if (p.kind === 'gem') {
      if (p.delay > 0) { p.delay -= dt; p.vy += 700 * dt; p.sx += p.vx * dt; p.sy += p.vy * dt; continue; }
      const dx = HUD.gemX - p.sx, dy = HUD.gemY - p.sy, d = Math.hypot(dx, dy) || 1;
      const sp = 1400 * dt; p.sx += dx / d * Math.min(d, sp); p.sy += dy / d * Math.min(d, sp);
      if (d < 10) { p.life = 0; HUD.gemPulse = 1; SFX.gem(p.i); }
      continue;
    }
    p.life -= dt;
    if (p.kind === 'confetti') { p.sy += p.vy * dt; p.sx += p.vx * dt; p.vy += 200 * dt; p.rot += p.vr * dt; }
  }
  if (G.parts.length) G.parts = G.parts.filter(p => p.life > 0);
  for (const t of G.texts) { t.life -= dt; t.y += dt * (t.small ? 2.4 : 1.6); }
  if (G.texts.length) G.texts = G.texts.filter(t => t.life > 0);
  if (G.blasts) { for (const b of G.blasts) b.t += dt; G.blasts = G.blasts.filter(b => b.t < 0.5); }
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt * 2.2);
  G.punch = Math.max(0, (G.punch || 0) - dt * 2.5);
  G.recoil = Math.max(0, (G.recoil || 0) - dt * 8);
  HUD.coinPulse = Math.max(0, HUD.coinPulse - dt * 5);
  HUD.gemPulse = Math.max(0, HUD.gemPulse - dt * 4);
  for (const p of HUD.plus) p.t += dt;
  if (HUD.plus.length) HUD.plus = HUD.plus.filter(p => p.t < 0.9).slice(-4);
  for (const b of G.bodies) { if (b.delay > 0 && b.pop > 0.99) { b.delay -= dt; continue; } b.pop = Math.max(0, b.pop - dt * 3); }
}

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------
function updateSteer(dt) {
  const l = G.lead;
  const spd = 9 * (1 + 0.1 * shopLvl('steady')) * (G.debuff && G.debuff.id === 'steer' ? 0.75 : 1);
  let lo = -ROAD + 0.4, hi = ROAD - 0.4;
  if (G.split) { const fh = formHalf(); if (G.split.mine < 0) hi = Math.min(-0.6, -0.35 - fh); else lo = Math.max(0.6, 0.35 + fh); } // the divider holds you to your side
  l.tx = clamp(l.tx, -ROAD + 0.4, ROAD - 0.4);
  const want = clamp((clamp(l.tx, lo, hi) - l.x) * 9, -spd, spd);
  l.vx = lerp(l.vx, want, 1 - Math.exp(-dt * 14));
  l.x = clamp(l.x + l.vx * dt, lo, hi);
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
  sortEnemies();
  if (G.phase === 'intro') { G.bossIntro -= dt; if (G.bossIntro <= 0) G.phase = 'run'; }
  const firing = G.phase === 'run' || G.phase === 'clash';
  updateGuns(dt, firing);
  updateShots(dt);
  if (!G.sim) Gunfire.tick(dt, firing ? guns() * (G.N > BAL.gunCap ? Math.sqrt(G.N / BAL.gunCap) : 1) : 0, fireRate(), G.phase === 'clash' || (G.boss && G.boss.firstHitP != null));
  if (G.mode !== 'play') return;
  for (const c of G.crates) if (!c.dead) { tickAcc(c, dt, c.x, c.z, 2.2); c.flash = Math.max(0, c.flash - dt); }
  for (const b of G.barrels) if (!b.dead) tickAcc(b, dt, b.x, b.z, 1.6);
  for (const b of G.bars) if (!b.dead) tickAcc(b, dt, (b.x0 + b.x1) / 2, b.z, 1.6);
  if (G.phase === 'run') {
    if (G.endless) {
      G.endT += dt;
      G.v = BAL.runSpeed * speedMult(40) * endlessSpeed(G.endT);
      extendEndless();
    }
    G.P += G.v * dt;
    if (G.boss && !G.boss.dead) updateBossRun(dt);
    updateBlocks(dt);
    updateSplit();
    updateSets(dt);
    moveEnemies(dt);
    resolveContacts();
    updateReturnFire(dt);
    updateCoins(dt);
    updatePicks(dt);
    updateHazards(dt);
    if (G.P >= G.runnerAt) {
      G.runnerAt = Infinity;
      const e = addEnemy('treasure', 0, G.P + 24, enemyHP(G.level, G.loop) * 6, false, { look: 'treasure' });
      e.active = true; e.runT = 0; e.fromX = pick([-1, 1]) * 5.5; e.x = e.fromX;
      floatText(0, G.P + 20, 3, 'TREASURE!', '#ffd23d', 24); SFX.tile();
    }
    if (G.P >= G.goldAt) { G.goldAt = Infinity; G.picks.push({ kind: 'gold', id: pick(Object.keys(BUFFS)), x: rand(-3, 3), z: G.P + 40, done: false }); floatText(0, G.P + 40, 4, 'GOLD', '#ffd23d', 28); SFX.warn(); }
    if (G.P >= G.corruptAt) {
      G.corruptAt = G.P + rand(18, 26) * G.v / 2;
      const w = randi(1, 3) * 2, x0 = pick([-5, -3, -1, 1, 3].filter(x => x + w <= 3)); // never the full width
      G.hazards.push({ x0, x1: x0 + w, t: 0, warn: 3, active: false, dur: 10, kind: 'corrupt' });
    }
    if (G.P >= G.Lr && !G.endless) { // the boss has reached you: the clash
      G.P = G.Lr; G.phase = 'clash'; G.stats.arrive = G.N; G.arriveN = G.N;
      const b = G.boss; b.homeZ = G.P + BAL.bossGap; b.atkT = 1.0;
      G.banner = { title: 'IT REACHED YOU', sub: 'KEEP FIRING', t: 0, max: 1.4 };
    }
  } else if (G.phase === 'clash') {
    const b = G.boss;
    b.homeZ = G.P + BAL.bossGap;
    updateBoss(dt);
    tickAcc(b, dt, b.x + rand(-1, 1), b.z - 1, 4.5);
    moveEnemies(dt);
    resolveContacts();
    updateReturnFire(dt);
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
  if (G.P > 30 * G.v) { Store.d.tut.base = true; Store.save(); G.tut = null; }
}

// ---------------------------------------------------------------------------
// Level complete
// ---------------------------------------------------------------------------
function levelComplete() {
  G.mode = 'clear';
  if (G.sim) return;
  const L = G.level, run = Store.d.run, d = Store.d;
  bankCoins();
  const skin = SKINS.find(s => s.unlock === L && !d.skinsOwned.includes(s.id));
  if (skin) d.skinsOwned.push(skin.id);
  if (isStageBoss(L) && !d.story.includes('post' + G.stage)) d.story.push('post' + G.stage);
  d.best = Math.max(d.best, L);
  run.relics = G.relics.slice();
  run.level = L + 1;
  if (L === 40) { d.runsDone = (d.runsDone || 0) + 1; d.loop = (run.loop || 0) + 1; d.endless = true; }
  Store.save();
  SFX.clear();
  celebrate(L, isStageBoss(L));
  UI.levelClear({ level: L, coins: G.stats.coins, squad: G.N, arrive: G.stats.arrive, gems: G.stats.gems, relic: G.stats.relic, skin, stageClear: isStageBoss(L), ending: L === 40, flips: G.stats.flips });
}
function celebrate(L, big) {
  const n = 40 + L * 5 + (big ? 120 : 0);
  const cols = ['#ffd23d', '#ff3b5c', '#2de1c2', '#7ad7ff', '#ff4fb8', '#ffffff'];
  for (let i = 0; i < n; i++) G.parts.push({ kind: 'confetti', sx: rand(0, V.w), sy: rand(-200, -10), vx: rand(-60, 60), vy: rand(60, 240), life: rand(2, 3.5) + L * 0.03, max: 3.5, size: rand(4, 9), col: pick(cols), rot: rand(0, TAU), vr: rand(-8, 8) });
}
