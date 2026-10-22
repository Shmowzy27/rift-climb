// Playtest bot. Serve the repo (python3 -m http.server), open rift-climb.html, then in the console:
//   eval(await (await fetch('tools/playtest-bot.js')).text()); runBot({ from: 1, to: 40, pBest: 0.7, pDodge: 0.5 })
// It steers like an "average player": best gate 70% of the time, dodges half of the telegraphed strikes.
(function () {
  document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
  Store.d.settings.sound = false; Store.d.settings.music = false; AudioSys.apply();
  UI.levelClear = () => {}; UI.failed = () => {}; UI.baseFail = () => {}; UI.rally = () => { G.mode = 'play'; }; UI.pause = () => {};
  Store.d.tut.base = true;
  const BOT = window.BOT = { rows: [], errors: [], running: false };
  function start(L) {
    Store.d.run = { level: L, coins: 0, relics: [], loop: 0, cards: null };
    UI.hide(); startLevel();
    BOT.cur = { L, tries: (BOT.cur && BOT.cur.L === L ? BOT.cur.tries : 0) + 1, baseTries: 0, minN: 1e9, fails: [] };
  }
  function think() {
    const l = G.lead, fh = formHalf();
    let goal = l.x;
    const g = G.gates.find(g => !g.done && g.set);
    if (g && g.z - G.P < 3.2 * G.v) {
      if (g.choice == null) {
        const order = g.set.map((x, i) => i).sort((a, b) => g.set[b].result - g.set[a].result);
        g.choice = Math.random() < BOT.pBest ? order[0] : order[1 + Math.floor(Math.random() * (order.length - 1))];
      }
      const sp = gateSpans(g.set.length)[g.choice]; goal = (sp[0] + sp[1]) / 2;
    } else {
      for (const e of G.enemies) if (e.active && e.z - G.P < 8 && e.z > G.P && (e.kind === 'brute' || e.shield) && Math.abs(e.x - goal) < fh + e.r) goal = e.x + (e.x > 0 ? -1 : 1) * (fh + e.r + 0.3);
      const bar = G.bars.find(b => !b.dead && b.z - G.P < 12 && b.z > G.P);
      if (bar && goal + fh > bar.x0 && goal - fh < bar.x1 && bar.hp > volley() * 3) goal = bar.x0 > -3 ? bar.x0 - fh - 0.2 : bar.x1 + fh + 0.2;
    }
    for (const p of G.picks) if (p.kind === 'debuff' && p.z - G.P < 10 && Math.abs(p.x - goal) < 1.6) goal = p.x + (p.x > 0 ? -2.4 : 2.4);
    for (const z of [G.boss && G.boss.zone, G.base && G.base.zone]) {
      if (!z) continue;
      if (z.dodge == null) z.dodge = Math.random() < BOT.pDodge;
      if (z.dodge && goal > z[0] - fh && goal < z[1] + fh) goal = z[0] > -ROAD + 1.5 ? z[0] - fh - 0.3 : z[1] + fh + 0.3;
    }
    l.tx = clamp(goal, -4.6, 4.6);
  }
  function chunk() {
    try {
      for (let s = 0; s < 4000 && BOT.running; s++) {
        if (G.mode === 'play') {
          if (s % 4 === 0) think();
          update(1 / 60);
          BOT.cur.minN = Math.min(BOT.cur.minN, G.N);
          if (G.phase === 'assault' && G.base && G.base.timer >= G.timerMax - 0.02) BOT.cur.arrive = G.arriveN;
        } else if (G.mode === 'failed') {
          BOT.cur.died = (BOT.cur.died || 0) + 1;
          if (BOT.cur.tries > 4) { BOT.running = false; BOT.stop = 'stuck on L' + G.level; break; }
          start(G.level);
        } else if (G.mode === 'basefail') {
          BOT.cur.baseTries++; BOT.cur.fails.push(Math.round(100 * (1 - G.base.hp / G.base.max)) + '%');
          if (BOT.cur.baseTries % 3 === 0) { // like a player: a few base retries, then replay the level for a bigger squad
            BOT.cur.restarts = (BOT.cur.restarts || 0) + 1;
            if (BOT.cur.restarts > 5) { BOT.running = false; BOT.stop = 'stuck on base of L' + G.level; break; }
            const keep = BOT.cur; start(G.level); BOT.cur.fails = keep.fails; BOT.cur.baseTries = keep.baseTries; BOT.cur.restarts = keep.restarts;
          } else retryBase();
        } else if (G.mode === 'clear') {
          BOT.rows.push({ L: G.level, restarts: BOT.cur.restarts || 0, arrive: BOT.cur.arrive, end: G.N, t: +(G.timerMax - G.base.timer).toFixed(1), fails: BOT.cur.fails.join(' '), deaths: BOT.cur.died || 0, exact: G.stats.exact });
          if (G.level >= BOT.to) { BOT.running = false; BOT.stop = 'done'; break; }
          start(G.level + 1);
        } else update(1 / 60);
      }
    } catch (e) { BOT.errors.push(String(e.stack || e)); BOT.running = false; }
    if (BOT.running) setTimeout(chunk, 0);
  }
  window.runBot = o => { Object.assign(BOT, { pBest: 0.7, pDodge: 0.5, from: 1, to: 40 }, o, { rows: [], running: true, stop: null, cur: null }); start(BOT.from); setTimeout(chunk, 0); };
  window.botReport = () => JSON.stringify({ running: BOT.running, stop: BOT.stop, errors: BOT.errors, rows: BOT.rows.map(r => `L${r.L}: arrive ${r.arrive} -> ${r.end}, base ${r.t}s${r.fails ? ' (fails ' + r.fails + ')' : ''}${r.restarts ? ' restarts ' + r.restarts : ''}${r.deaths ? ' deaths ' + r.deaths : ''}`) });
})();
