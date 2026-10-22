// Archetype benchmark: effective DPS of each squad against its own stage's enemy mix.
// Serve the repo, open rift-climb.html, then in the console:
//   eval(await (await fetch('tools/archetype-bench.js')).text()); benchAll()
// Effective DPS = HP of enemies actually stopped (killed before they reach the squad) per
// second, per soldier, in units of the level's base per-soldier damage. Damage on enemies
// that still reach you counts for nothing. The road is kept saturated so every weapon always
// has something to shoot at; steering suits each weapon (beams line up a lane, blades meet
// the nearest enemy, the rest weave toward targets).
(function () {
  document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
  Store.d.settings.sound = false; Store.d.settings.music = false; AudioSys.apply();
  UI.levelClear = () => {}; UI.failed = () => {}; UI.baseFail = () => {}; UI.rally = () => { G.mode = 'play'; }; UI.pause = () => {};
  const steer = arch => {
    const ahead = G.enemies.filter(e => e.active && !e.inv && e.z > G.P + 0.5 && e.z < G.P + 40);
    if (!ahead.length) return;
    if (arch === 'beam') {
      let best = G.lead.x, bn = -1;
      for (let x = -4.5; x <= 4.5; x += 0.5) { const n = ahead.filter(e => Math.abs(e.x - x) < 0.6 + e.r && !(e.shield && Math.abs(e.x - x) < 1.6)).length; if (n > bn) { bn = n; best = x; } }
      G.lead.tx = best;
    } else {
      const near = ahead.reduce((a, e) => (e.z < a.z ? e : a));
      G.lead.tx = clamp(near.x + (near.shield && arch !== 'staff' ? 1.8 : 0), -4.6, 4.6);
    }
  };
  window.benchArch = (arch, L, secs, seed) => {
    const realRandom = Math.random;
    Math.random = rng(seed || 4242); // reproducible: same enemy stream for every run
    Store.d.tut.base = true;
    Store.d.run = { level: L, coins: 0, relics: [], loop: 0, cards: null, arch };
    UI.hide(); startLevel();
    G.arch = arch;
    const tune = levelTuning(L, true);
    G.dmg = tune.dmg * ARCH[arch].dmgF * (G.stage === 5 ? ARCH[arch].riftDmg : 1);
    G.gates = []; G.bars = []; G.coins = []; G.picks = []; G.enemies = []; G.hazards = [];
    G.runnerAt = G.goldAt = G.forceDebuffAt = G.corruptAt = Infinity; G.Lr = 1e12;
    const N = Math.max(10, tune.N2); // the squad size per-soldier damage is tuned around (two gates in)
    G.N = N; layoutBodies(true);
    const realLose = loseSoldiers; loseSoldiers = () => {};
    G.stats.useful = 0; G.stats.stopped = 0;
    const hp = enemyHP(L, 0), W = roleWeights(L);
    let nextZ = G.P + 20;
    for (let i = 0; i < secs * 60; i++) {
      while (nextZ < G.P + 70) {
        const role = pickRole(W);
        if (role === 'runner') { const wide = G.stage === 5 && RIFT_PROFILES[L] === 'packs', x0 = wide ? 0 : pick([-3, -1, 1, 3]); for (let k = 0; k < (wide ? 5 : 4); k++) addEnemy('runner', clamp(x0 + (wide ? rand(-4, 4) : rand(-1.2, 1.2)), -4.5, 4.5), nextZ + k * (wide ? 0.5 : 0.9), hp); nextZ += 3.6; }
        else addEnemy(role, pick([-4, -2, 0, 2, 4]) + rand(-0.5, 0.5), nextZ, hp);
        nextZ += rand(2.5, 4.5);
      }
      if (i % 21 === 0) steer(arch); // re-aim every 0.35s, like a person
      update(1 / 60);
      G.N = N;
    }
    loseSoldiers = realLose;
    Math.random = realRandom;
    G.mode = 'menu';
    return { arch, L, N, eff: G.stats.stopped / (secs * N * tune.dmg) };
  };
  window.benchAll = (secs) => {
    secs = secs || 40;
    const own = [['crossbow', 5], ['staff', 12], ['blade', 20], ['beam', 28]].map(([a, L]) => benchArch(a, L, secs));
    const mean = own.reduce((s, r) => s + r.eff, 0) / own.length;
    return { own: own.map(r => ({ ...r, eff: +r.eff.toFixed(3), vsMean: +(r.eff / mean).toFixed(3), dmgF: ARCH[r.arch].dmgF })), mean: +mean.toFixed(3) };
  };
  window.benchRift = (secs) => {
    secs = secs || 30;
    const out = {};
    const sums = {};
    for (const L of [33, 34, 35, 36, 39]) out['L' + L + ' ' + RIFT_PROFILES[L]] = ARCH_ORDER.map(a => { const v = [11, 222].map(sd => benchArch(a, L, secs, sd).eff); const m = (v[0] + v[1]) / 2; sums[a] = (sums[a] || 0) + m / 5; return a + ' ' + m.toFixed(3); }).join(', ');
    out.average = ARCH_ORDER.map(a => a + ' ' + sums[a].toFixed(3)).join(', ');
    return out;
  };
})();
