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
  await browser.close();
})();
