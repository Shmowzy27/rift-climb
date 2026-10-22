// Acceptance C (and a frame-cost probe for F): renders the real game in headless Chromium.
// Plays level 10 with the same bot as the headless sim, stops at 20%, 50% and 84%, saves a PNG
// at each and prints what was on screen. Needs Playwright with a Chromium build:
//   node tools/accept-render.cjs [outDir]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const OUT = process.argv[2] || path.join(__dirname, '..', 'acceptance');
fs.mkdirSync(OUT, { recursive: true });
const BOT = fs.readFileSync(path.join(__dirname, 'headless.cjs'), 'utf8').match(/function makeBot[\s\S]*?\n}\n/)[0];

(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'rift-climb.html'));
  await page.waitForTimeout(800);
  await page.evaluate(BOT => {
    // drive the game by hand: stop the real loop from stepping the logic, step it ourselves
    window.__bot = eval('(' + BOT + ')');
    Store.d.tut.base = true; Store.d.plusOne = 0;
    newRun(0); Store.d.run.level = 10; Store.d.run.weapon = 3; Store.save();
    UI.hide();
    let s = 77; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    startLevel({});
    G.realUpdate = update;
    window.__api = { G, formHalf, reach, applyBand, guns, fireRate, shotDamage, ESHOTS, ctx: { enemyHP, blockSize, inAttack } };
    window.__think = window.__bot(window.__api, { pBest: 1, pPump: 0.6, pDodge: 0.9 }, (() => { let q = 5; return () => ((q = (q * 48271) % 2147483647) / 2147483647); })());
  }, BOT);
  // freeze the page's own loop: we step and render manually
  await page.evaluate(() => { window.__frozen = true; G.timeScale = 0; });
  const rows = [];
  for (const target of [0.2, 0.5, 0.84]) {
    const r = await page.evaluate(target => {
      G.timeScale = 1;
      let i = 0;
      while (G.mode === 'play' && G.P / G.Lr < target && i < 60 * 200) { if (i % 3 === 0) window.__think(); G.realUpdate(1 / 60); i++; }
      G.timeScale = 0;
      render(); render(); // two frames so muzzle flashes and tracers are drawn as the player sees them
      const b = G.boss;
      const top = GFX.project(b.x, 8 * b.scale, b.z, {}), foot = GFX.project(b.x, 0, b.z, {});
      return { p: +(G.P / G.Lr).toFixed(3), mode: G.mode, N: G.N, drawnSoldiers: Math.min(G.bodies.length + 1, 121), liveTracers: HUD.liveTracers, shots: SHOTS.n,
        bossHP: Math.round(b.hp), bossMax: b.max, bossOnScreenPx: Math.round(foot.y - top.y), bossVisible: !!(GFX.rig && GFX.rig.root.visible), hpBarDrawn: !G.nameCard && !b.dead };
    }, target);
    await page.screenshot({ path: path.join(OUT, `C-L10-${Math.round(target * 100)}pct.png`) });
    rows.push(r);
    console.log(JSON.stringify(r));
  }
  const ok = rows.every(r => r.bossVisible && r.hpBarDrawn && r.liveTracers >= 20) && rows[1].drawnSoldiers >= 40 && rows[0].bossOnScreenPx < rows[1].bossOnScreenPx && rows[1].bossOnScreenPx < rows[2].bossOnScreenPx;
  console.log('C ' + (ok ? 'PASS' : 'FAIL') + (errs.length ? '  errors: ' + errs.join(' | ') : ''));

  // F probe: level 40 at full load (150 enemies on screen, 120 soldiers drawn, a full volley in the
  // air), CPU cost per frame of the game logic and of building + submitting the scene. This is a
  // desktop CPU with a software GPU, not an iPhone: it shows the JS budget, not real frame rate.
  const f = await page.evaluate(() => {
    Store.d.run.level = 40; Store.d.run.weapon = 8;
    startLevel({});
    G.phase = 'run'; G.bossIntro = 0; G.nameCard = null; G.N = 300; layoutBodies(true);
    G.timeScale = 1;
    for (let i = 0; i < 240; i++) G.realUpdate(1 / 120); // fill the air with tracers
    const fillEnemies = () => { let n = 0; for (const e of G.enemies) if (!e.dead && e.z > G.P && e.z - G.P < 80) n++; while (n < 150) { const e = addEnemy('normal', (Math.random() * 2 - 1) * 4.4, G.P + 35 + Math.random() * 40, 1e9); e.active = true; e.block = true; e.speed = 0; n++; } };
    let logic = 0, draw = 0, calls = 0, tris = 0, frames = 0, enemiesOn = 0, tracers = 0, gl = 0;
    const R = GFX.R, realRender = R.render.bind(R);
    R.render = (sc, cam) => { const a = performance.now(); realRender(sc, cam); gl += performance.now() - a; };
    for (let i = 0; i < 240; i++) {
      fillEnemies(); G.N = 300;
      const t0 = performance.now(); G.realUpdate(1 / 120); const t1 = performance.now(); render(); const t2 = performance.now();
      if (i === 39) gl = 0;
      if (i >= 40) { logic += t1 - t0; draw += t2 - t1; frames++; calls += GFX.R.info.render.calls; tris += GFX.R.info.render.triangles; tracers += HUD.liveTracers; }
    }
    R.render = realRender;
    for (const e of G.enemies) if (!e.dead && e.z > G.P && e.z - G.P < 80) enemiesOn++;
    G.timeScale = 0;
    return { frames, enemiesOnScreen: enemiesOn, soldiersDrawn: G.bodies.length + 1, avgLiveTracers: Math.round(tracers / frames), logicMs: +(logic / frames).toFixed(2), sceneSyncAndHudMs: +((draw - gl) / frames).toFixed(2), glSubmitAndSoftwareRasterMs: +(gl / frames).toFixed(2), drawCalls: Math.round(calls / frames), triangles: Math.round(tris / frames) };
  });
  console.log('F probe ' + JSON.stringify(f));
  const fOk = f.enemiesOnScreen >= 150 && f.soldiersDrawn >= 120 && f.avgLiveTracers >= 300 && f.logicMs + f.sceneSyncAndHudMs <= 4 && f.drawCalls <= 60;
  console.log('F (proxy: game JS <= 4ms, half the 120Hz budget, and <= 60 draw calls at that load) ' + (fOk ? 'PASS' : 'FAIL') + ' — confirm 120fps on the device itself');
  await page.screenshot({ path: path.join(OUT, 'F-L40-load.png'), timeout: 120000 }).catch(() => console.log('(F screenshot timed out under the software GPU)'));
  console.log(`F: game JS per frame ${(f.logicMs + f.sceneSyncAndHudMs).toFixed(2)}ms (logic + scene sync + HUD) of the 8.33ms a 120Hz frame allows, ${f.drawCalls} draw calls, ${Math.round(f.triangles / 1000)}k triangles. GL time here is a software rasterizer on a desktop CPU and says nothing about an iPhone GPU; this is not an on-device measurement.`);
  await browser.close();
})();
