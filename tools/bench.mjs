// Archetype benchmark: effective DPS of each squad against its own stage's enemy mix,
// measured in the real game code (headless). Usage: node tools/bench.mjs [secs]
// Effective DPS = HP of enemies actually stopped (killed before they reach the squad) per
// second, per soldier, in units of the level's base per-soldier damage. Damage on enemies
// that still reach you counts for nothing. The road is kept full so every weapon always has
// something to shoot at; steering re-aims every 0.35s like a person.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const H = require('./headless.cjs');

const secs = +process.argv[2] || 40;
const SEEDS = +(process.argv[3] || 6);
const api = H.loadGame();
const G = api.G, ctx = api.ctx;

export function bench(arch, L, seed, N) {
  api.Math.random = api.rng(seed);
  api.Store.d.run = { level: L, relics: [], loop: 0, arch };
  api.Store.d.tut.base = true;
  G.sim = true;
  api.startLevel({ sim: true, up: { rate: 0, dmg: 0, rev: 0 }, rnd: api.rng(seed + 9) });
  G.arch = arch;
  const A = api.ARCH[arch];
  const base = api.levelTuning(L).dmg;
  G.dmg = base * A.dmgF * (G.stage === 5 ? A.riftDmg : 1);
  G.sets = []; G.bars = []; G.barrels = []; G.coins = []; G.carts = []; G.picks = []; G.enemies = []; G.hazards = []; G.splits = [];
  G.runnerAt = G.goldAt = G.corruptAt = Infinity; G.Lr = 1e12;
  G.N = N; api.layoutBodies(true);
  const realLose = ctx.loseSoldiers; ctx.loseSoldiers = () => {};
  const realFire = ctx.updateReturnFire; ctx.updateReturnFire = () => {};
  const hp = api.enemyHP(L, 0), W = api.roleWeights(L);
  let nextZ = G.P + 20, stopped = 0;
  const realKill = ctx.killEnemy;
  ctx.killEnemy = e => { stopped += e.maxHp; realKill(e); };
  const steer = () => {
    const ahead = G.enemies.filter(e => e.active && !e.inv && e.z > G.P + 0.5 && e.z < G.P + 40);
    if (!ahead.length) return;
    if (arch === 'beam') { // line up the densest lane
      let best = G.lead.x, bn = -1;
      for (let x = -4.5; x <= 4.5; x += 0.5) { const n = ahead.filter(e => Math.abs(e.x - x) < 1.4 + e.r && !(e.shield && Math.abs(e.x - x) < 1.6)).length; if (n > bn) { bn = n; best = x; } }
      G.lead.tx = best;
    } else {
      const near = ahead.reduce((a, e) => (e.z < a.z ? e : a));
      G.lead.tx = Math.max(-4.6, Math.min(4.6, near.x + (near.shield && arch !== 'crossbow' ? (near.x > 0 ? -1.9 : 1.9) : 0)));
    }
  };
  // a steady crowd: about what a par squad of this size faces on the road
  const vClose = G.v + 3.4;
  const perM = api.BAL.crowd * api.BAL.crowdSpread * N * A.rate * G.dmg / vClose / hp * 1.6;
  let acc = 0;
  for (let i = 0; i < secs * 60; i++) {
    while (nextZ < G.P + 60) {
      acc += perM;
      while (acc >= 1) { acc -= 1; const role = api.pickRole(W); api.addEnemy(role, Math.max(-4.6, Math.min(4.6, (Math.random() * 2 - 1) * 3.6)), nextZ + Math.random(), hp); }
      nextZ += 1;
    }
    if (i % 21 === 0) steer();
    api.update(1 / 60);
    G.N = N;
  }
  ctx.loseSoldiers = realLose; ctx.updateReturnFire = realFire; ctx.killEnemy = realKill;
  return stopped / (secs * N * base);
}

const own = [['crossbow', 5], ['staff', 12], ['blade', 20], ['beam', 28]];
if (process.argv[1] && process.argv[1].endsWith('bench.mjs') && !process.argv[1].includes('tune')) {
  const N = 30;
  const res = own.map(([a, L]) => { const v = Array.from({ length: SEEDS }, (_, i) => bench(a, L, i + 1, N)); return { arch: a, L, eff: v.reduce((x, y) => x + y) / v.length }; });
  const mean = res.reduce((s, r) => s + r.eff, 0) / res.length;
  console.log('Own stage, squad of ' + N + ' (effective DPS per soldier, units of base per-soldier damage)');
  for (const r of res) console.log(`  ${r.arch.padEnd(9)} L${String(r.L).padEnd(3)} ${r.eff.toFixed(3)}  ${(r.eff / mean * 100 - 100).toFixed(1)}% vs mean   (dmgF ${api.ARCH[r.arch].dmgF}, rate ${api.ARCH[r.arch].rate})`);
  console.log('Rift (Stage 5) levels, each archetype:');
  const sums = {};
  for (const L of [33, 34, 35, 36, 39]) {
    const row = api.ARCH_ORDER.map(a => { const v = Array.from({ length: Math.max(2, SEEDS >> 1) }, (_, i) => bench(a, L, i + 1, N)); const m = v.reduce((x, y) => x + y) / v.length; sums[a] = (sums[a] || 0) + m / 5; return a + ' ' + m.toFixed(3); });
    console.log(`  L${L} ${api.RIFT_PROFILES[L].padEnd(8)} ${row.join('  ')}`);
  }
  console.log('  average  ' + api.ARCH_ORDER.map(a => a + ' ' + sums[a].toFixed(3)).join('  '));
}
