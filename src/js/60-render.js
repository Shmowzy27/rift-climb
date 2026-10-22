// ============================================================================
// RENDER: sync game state into the Three.js scene, then draw the 2D overlay
// (numbers, band values, HUD) on a canvas above it. Numbers are the art
// direction, so they stay crisp 2D text with thick outlines.
// ============================================================================
let CV = null, HC = null, CX = null;
const MENU = { stage: 1, P: 0, bodies: null };
const SP = {}, SP2 = {}; // scratch projection results (no per-frame allocation)
const C_WHITE = new THREE.Color(1, 1, 1), C_FLASH = new THREE.Color(2.4, 2.4, 2.4), C_ELITE = new THREE.Color(1.25, 1.08, 0.55), C_TMP = new THREE.Color(), C_TMP2 = new THREE.Color();
const C_GREEN = new THREE.Color(BAND_GREEN), C_RED = new THREE.Color(BAND_RED);
const ARCH_TINT = { crossbow: 0xffd27a, staff: 0xff9a3d, blade: 0xbff6ff, beam: 0x2bf0ff };
const ALL_KITS = ['disc', 'cart', 'buff', 'debuff', 'gold', 'ring', 'bar', 'barrel', 'band', 'bandWall', 'bandEdge', 'post', 'postCap', 'divider', 'haz', 'tdisc', 'tracer', 'tglow', 'trail', 'orb', 'slash', 'etracer', 'part', 'casing', 'mflash', 'crown', 'platform'];

function resize() {
  DPR = Math.min(3, window.devicePixelRatio || 1);
  layout();
  HC.width = Math.round(V.w * DPR); HC.height = Math.round(V.h * DPR);
  HC.style.width = V.w + 'px'; HC.style.height = V.h + 'px';
  CV.style.width = V.w + 'px'; CV.style.height = V.h + 'px';
  GFX.resize(V.w, V.h, Math.min(2, DPR)); // WebGL at 2x keeps 120Hz headroom; text overlay at full DPR
  SPR.clear();
}
function proj(x, z, y, out) { return GFX.project(x, y || 0, z, out || SP); }
let lastRenderT = 0;

function render() {
  const c = CX;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, V.w, V.h);
  if (!GFX.ok) { bigText(c, 'WebGL is unavailable', V.cx, V.h / 2, 22, '#ffffff', { font: dispFont(22) }); return; }
  ASSETS.tick(G.t);
  const rdt = Math.min(0.05, Math.max(0, G.t - lastRenderT)); lastRenderT = G.t;
  const menu = G.mode === 'menu';
  if (menu) renderMenu();
  else {
    const b = G.boss;
    const intro = G.bossIntro > 0 ? Math.sin(clamp(1 - G.bossIntro / 1.5, 0, 1) * Math.PI * 0.5) : (G.introOut = Math.max(0, (G.introOut || 0) - rdt * 1.5));
    if (G.bossIntro > 0) G.introOut = intro;
    GFX.camera(G.P, G.camX, G.push ? easeInOut(G.push) : 0, G.shake, intro, b ? b.z : 0);
    const plat = b && b.platform ? { z0: G.P - 7, z1: b.z + 5 } : null;
    GFX.layoutWorld(G.stage, G.P, plat);
    GFX.buildSquad(G.arch, skinById(Store.d.skin), G.weapon); // a new weapon level swaps the gun in every soldier's hands
    syncSquad(G.bodies, G.P, G.lead.x, G.phase === 'run', G.lead.vx);
    syncEnemies();
    syncProps();
    syncFx();
    syncBoss(rdt, plat);
  }
  GFX.R.render(GFX.scene, GFX.cam);
  if (!menu) {
    drawWorldLabels(c);
    drawHUD(c, G.t);
    drawOverlays(c, G.t);
    drawTutorialHand(c, G.t);
    if (G.flash > 0) { c.globalAlpha = Math.min(0.5, G.flash * 0.6); c.fillStyle = G.flashCol; c.fillRect(0, 0, V.w, V.h); c.globalAlpha = 1; }
  }
  drawScreenParts(c);
}

function renderMenu() {
  const st = MENU.stage;
  MENU.P += 0.14;
  const extra = Store.d.plusOne || 0; // Kai alone, plus any +1 SOLDIER bought for the next level
  if (!MENU.bodies || MENU.bodies.length !== extra) {
    MENU.bodies = [];
    for (let i = 0; i < extra; i++) MENU.bodies.push({ ox: ((i % 3) - 1) * 0.5, oz: -(Math.floor(i / 3) + 1) * 0.5 - 0.2, row: 1, x: 0, ph: rand(0, TAU), pop: 0 });
  }
  const lx = Math.sin(G.t * 0.4) * 1.2;
  for (const b of MENU.bodies) { b.x = lx + b.ox; b.ph += 0.19; }
  GFX.setStage(st);
  G.arch = STAGES[st - 1].arch || (Store.d.run && Store.d.run.arch) || 'crossbow';
  GFX.buildSquad(G.arch, skinById(Store.d.skin), (Store.d.run && Store.d.run.weapon) || 1);
  GFX.camera(MENU.P - 6, lx * 0.4, 0, 0, 0, 0);
  GFX.layoutWorld(st, MENU.P, null);
  syncSquad(MENU.bodies, MENU.P, lx, true, Math.cos(G.t * 0.4));
  GFX.k.blob.end();
  for (const k of Object.values(GFX.enemyKits)) { k.begin(); k.end(); }
  for (const n of ALL_KITS) { GFX.k[n].begin(); GFX.k[n].end(); }
  for (const k of GFX.k.crate) { k.begin(); k.end(); }
  if (GFX.rig) { GFX.rig.root.visible = false; if (GFX.rig.twin) GFX.rig.twin.visible = false; }
}

function syncSquad(bodies, P, lx, running, vx) {
  const K = GFX.k;
  K.body.begin(); K.leg.begin(); K.kai.begin(); K.blob.begin(); if (K.after) K.after.begin();
  const rec = -(G.recoil || 0) * 0.04;
  const a = ASSETS.units[G.arch];
  for (const b of bodies) {
    const z = P + b.oz + rec;
    const bob = running ? Math.abs(Math.sin(b.ph)) * 0.07 : 0;
    const sc = 1 + Math.sin(Math.min(1, b.pop) * Math.PI) * 0.28;
    const lean = running ? -0.08 : 0;
    K.body.add(b.x, bob, z, 0, sc, sc, sc, null, lean);
    if (!a || !a.geo) {
      const swing = running ? Math.sin(b.ph) * 0.75 : 0;
      K.leg.add(b.x - 0.1 * sc, 0.42 * sc + bob, z, 0, sc, sc, sc, null, swing);
      K.leg.add(b.x + 0.1 * sc, 0.42 * sc + bob, z, 0, sc, sc, sc, null, -swing);
    }
    K.blob.add(b.x, 0.02, z, 0, 0.8 * sc, 1, 0.8 * sc);
    if (K.after && Math.abs(vx) > 2) K.after.add(b.x - vx * 0.05, bob, z, 0, sc, sc, sc);
  }
  // Kai leads from the front, a head taller
  const ph = (G.t * 11) % TAU;
  const kb = running ? Math.abs(Math.sin(ph)) * 0.08 : 0;
  K.kai.add(lx, kb, P + 0.3, -clamp(vx, -9, 9) * 0.03, 1.18, 1.18, 1.18, null, 0, -clamp(vx, -9, 9) * 0.015);
  const ks = running ? Math.sin(ph) * 0.8 : 0;
  K.leg.add(lx - 0.12, 0.5 + kb, P + 0.3, 0, 1.18, 1.18, 1.18, null, ks);
  K.leg.add(lx + 0.12, 0.5 + kb, P + 0.3, 0, 1.18, 1.18, 1.18, null, -ks);
  K.blob.add(lx, 0.02, P + 0.3, 0, 1.1, 1, 1.1);
  K.body.end(); K.leg.end(); K.kai.end(); if (K.after) K.after.end();
  // blob stays open: enemies add their shadows too (closed in syncBoss)
}

// the boss walks the road toward you; whatever is still behind it stays hidden until it passes
function farZ() { const b = G.boss; return b && !b.dead && !G.endless ? b.z + 1.5 : G.P + 130; }
function syncEnemies() {
  const K = GFX.k;
  for (const k of Object.values(GFX.enemyKits)) k.begin();
  K.crown.begin();
  for (const e of G.enemies) {
    if (e.z - G.P > 80 || e.inv || e.dead) continue;
    const kit = GFX.enemyKit(e.look);
    let sc = (LOOK_SCALE[e.look] || 1) * (e.elite ? 1.25 : 1) * (e.rival ? 1.3 : 1);
    let sx = sc, sy = sc, ry = 0, rz = 0, rx = 0, y = e.y || 0;
    if (e.look === 'slime' || e.look === 'bigslime') { const q = Math.sin(e.t * 12); sx *= 1 + q * 0.08; sy *= 1 - q * 0.1; }
    else y += Math.abs(Math.sin(e.t * 8)) * 0.05;
    if (e.look === 'drone' || e.look === 'bigdrone') ry = e.t * 2;
    if (e.strafe) rz = -e.strafe * 0.25;
    if (e.look === 'oni' && (e.t % 3) < 0.7) rx = 0.3;
    if (e.look === 'wisp') y += 0.3 + Math.sin(e.t * 3) * 0.15;
    if (e.look === 'ghost') y += 0.2 + Math.sin(e.t * 4) * 0.12;
    kit.add(e.x, y, e.z, ry, sx, sy, sc, e.flash > 0 ? C_FLASH : e.elite ? C_ELITE : C_WHITE, rx, rz);
    K.blob.add(e.x, 0.02, e.z, 0, sc * 1.1, 1, sc * 1.1);
    if (e.elite) K.crown.add(e.x, y + 1.5 * sc, e.z, e.t);
  }
  for (const k of Object.values(GFX.enemyKits)) k.end();
  K.crown.end();
}

function syncProps() {
  const K = GFX.k, P = G.P, fz = farZ();
  K.disc.begin(); K.cart.begin();
  for (const c of G.coins) if (c.z - P < 80 && c.z < fz) K.disc.add(c.x, 1.05 + Math.sin(G.t * 3 + c.z) * 0.08, c.z, Math.sin(c.spin) * 0.35, 1.15);
  for (const c of G.carts) if (!c.taken && c.z - P < 90) K.cart.add(c.x, 0, c.z, c.x > 0 ? -0.3 : 0.3, 1.2);
  K.disc.end(); K.cart.end();
  K.buff.begin(); K.debuff.begin(); K.gold.begin(); K.ring.begin();
  for (const p of G.picks) {
    if (p.z - P > 95) continue;
    const bob = 1 + Math.sin(G.t * 3 + p.x) * 0.15;
    const kit = p.kind === 'gold' ? K.gold : p.kind === 'debuff' ? K.debuff : K.buff;
    kit.add(p.x, bob, p.z, G.t * 2, p.kind === 'gold' ? 1.4 : 1);
    const pulse = 1 + 0.15 * Math.sin(G.t * 9);
    K.ring.add(p.x, 0.03, p.z, 0, (p.kind === 'gold' ? 2.2 : 1.25) * pulse, 1, (p.kind === 'gold' ? 2.2 : 1.25) * pulse, p.kind === 'debuff' ? 0xff2a40 : p.kind === 'gold' ? 0xffd23d : 0x5cff7a);
  }
  K.buff.end(); K.debuff.end(); K.gold.end();
  K.bar.begin();
  for (const b of G.bars) if (!b.dead && b.z < fz) K.bar.add((b.x0 + b.x1) / 2, 0, b.z, 0, b.x1 - b.x0, 1, 1, b.flash > 0 ? C_FLASH : C_WHITE);
  K.bar.end();
  // barrels: red drums with a pulsing danger ring the size of their blast
  K.barrel.begin();
  for (const br of G.barrels) {
    if (br.dead || br.z > fz) continue;
    const hot = 1 - br.hp / br.max;
    K.barrel.add(br.x, 0, br.z, 0, 1.15, 1.15, 1.15, br.flash > 0 ? C_FLASH : C_TMP.setRGB(1 + hot * 0.6, 1, 1));
    const pulse = 0.85 + 0.15 * Math.sin(G.t * (8 + hot * 14));
    K.ring.add(br.x, 0.05, br.z, 0, br.blast * pulse, 1, br.blast * pulse, 0xff3b2a);
  }
  K.barrel.end();
  // weapon crates: tires, a steel drum, a strapped crate. They shake when hit.
  for (const k of K.crate) k.begin();
  for (const c of G.crates) {
    if (c.dead || c.z > fz) continue;
    const j = c.flash > 0 ? rand(-0.05, 0.05) : 0;
    K.crate[c.rank].add(c.x + j, 0, c.z, 0.15, 1, 1, 1, c.flash > 0 ? C_FLASH : C_WHITE);
    K.ring.add(c.x, 0.04, c.z, 0, 1.2, 1, 1.2, 0xffd23d);
  }
  for (const k of K.crate) k.end();
  // gate bands: translucent green/red floor zones across the road, posts at their edges
  K.band.begin(); K.bandWall.begin(); K.bandEdge.begin(); K.post.begin(); K.postCap.begin();
  for (const s of G.sets) {
    if (s.done || s.z > fz || s.z < P - 4) continue;
    for (let i = 0; i < s.bands.length; i++) {
      const b = s.bands[i], w = b.x1 - b.x0, cx = (b.x0 + b.x1) / 2;
      const base = b.red ? C_RED : C_GREEN;
      const glow = 1 + b.pop * 0.9 + (b.flipped ? 0.25 : 0);
      C_TMP.copy(base).multiplyScalar(glow);
      K.band.add(cx, 0.035, s.z + 1.5, 0, w - 0.1, 1, 3, C_TMP);
      K.bandWall.add(cx, 1.3, s.z, 0, w - 0.1, 2.6, 1, C_TMP); // a faint shimmer curtain on the band's front edge
      C_TMP2.copy(base).multiplyScalar(1.4 + b.pop);
      K.bandEdge.add(cx, 0.06, s.z, 0, w - 0.1, 1, 1, C_TMP2);
      K.bandEdge.add(cx, 0.06, s.z + 3, 0, w - 0.1, 1, 1, C_TMP2);
    }
    for (let i = 0; i <= s.bands.length; i++) {
      const x = i === s.bands.length ? ROAD : s.bands[i].x0;
      K.post.add(x, 0, s.z);
      const nb = s.bands[Math.min(i, s.bands.length - 1)];
      K.postCap.add(x, 3.7, s.z, G.t * 2, 1, 1, 1, nb.red ? C_RED : C_GREEN);
    }
  }
  K.band.end(); K.bandWall.end(); K.bandEdge.end(); K.post.end(); K.postCap.end();
  // split-road divider
  K.divider.begin();
  for (const sp of G.splits) {
    if (sp.z1 < P - 6 || sp.z0 > P + 110) continue;
    for (let z = Math.max(sp.z0, P - 6) + 2; z < Math.min(sp.z1, P + 110); z += 4) K.divider.add(0, 0, z);
  }
  K.divider.end();
  // hazards + telegraphs on the road
  K.haz.begin(); K.tdisc.begin();
  const zone = (x0, x1, z0, z1, col, k) => K.haz.add((x0 + x1) / 2, 0.045, (z0 + z1) / 2, 0, x1 - x0, 1, z1 - z0, C_TMP.setHex(col).multiplyScalar(k));
  for (const h of G.hazards) zone(h.x0, h.x1, P - 3, P + (h.kind === 'corrupt' ? 30 : 6), h.kind === 'fire' ? 0xff6a1a : 0x965aff, h.active ? 1 + Math.sin(G.t * 20) * 0.15 : 0.5 + 0.5 * Math.abs(Math.sin(G.t * 10)));
  const a = G.boss && G.boss.atk;
  if (a) {
    const k = 1 - a.wind / a.max, blink = 0.5 + 0.5 * Math.abs(Math.sin(G.t * (6 + k * 18))) + k * 0.6;
    const col = G.boss.kind === 'warden' ? 0xff7a1a : G.boss.kind === 'brine' ? 0x36d6b5 : 0xff2846;
    if (a.type === 'sweep') zone(a.x0, a.x1, P - 4, P + 5, col, blink);
    else if (a.type === 'charge') zone(a.x0, a.x1, P - 4, G.boss.z - 2, col, blink);
    else if (a.type === 'volley') for (const cx of a.cols) zone(cx - a.cw / 2, cx + a.cw / 2, P - 4, P + 12, col, blink);
    else if (a.type === 'slam') { K.tdisc.add(a.cx, 0.05, P, 0, a.r, 1, a.r, C_TMP.setHex(col).multiplyScalar(blink)); K.ring.add(a.cx, 0.07, P, 0, a.r * (0.3 + 0.7 * k), 1, a.r * (0.3 + 0.7 * k), 0xffffff); }
  }
  K.haz.end(); K.tdisc.end();
  for (const bl of G.blasts || []) { const k = bl.t / 0.5; K.ring.add(bl.x, 0.1, bl.z, 0, bl.r * (0.3 + k), 1, bl.r * (0.3 + k), C_TMP.setRGB(1, 0.6 * (1 - k) + 0.2, 0.1)); }
  K.ring.end();
}

// Gunfire: one tracer per shot in flight (the logic caps the guns at 60; past that each of the 60
// stands for N/60 soldiers and draws wider and brighter). Core + glow + a fading trail behind it.
function syncFx() {
  const K = GFX.k;
  K.tracer.begin(); K.tglow.begin(); K.trail.begin(); K.orb.begin(); K.slash.begin(); K.etracer.begin(); K.part.begin(); K.casing.begin(); K.mflash.begin();
  const tint = ARCH_TINT[G.arch] || 0xffffff;
  let live = 0;
  for (let i = 0; i < SHOTS.n; i++) {
    const s = SHOTS.a[i];
    if (!s.vis) continue;
    const k = s.k || 1, wk = Math.min(2.4, Math.sqrt(k)) * (DEBUG_TRACER || 1), bright = Math.min(1.9, 0.75 + 0.25 * k);
    const ry = Math.atan2(-s.vx, s.vz), lk = DEBUG_TRACER || 1;
    if (s.kind === 1) K.orb.add(s.x, s.y, s.z, s.t * 6, 1.25 + Math.sin(s.t * 30) * 0.15);
    if (s.kind === 2) K.slash.add(s.x, s.y, s.z, Math.PI, 1.1 + s.t * 0.8, 1, 1.1, tint);
    C_TMP.setRGB(bright, bright, bright);
    K.tracer.add(s.x, s.y, s.z, ry, wk, wk, lk, C_TMP);
    K.tglow.add(s.x, s.y, s.z, ry, wk, wk, lk, C_TMP);
    const trav = Math.max(0.2, s.t * s.vz), len = Math.min(3.0 * lk, trav);
    K.trail.add(s.x - s.vx * len / s.vz * 0.5, s.y, s.z - 0.6 * lk - len / 2, ry, wk, wk, len / 3.0, C_TMP);
    live++;
  }
  HUD.liveTracers = live;
  for (let i = 0; i < ESHOTS.n; i++) { const s = ESHOTS.a[i]; K.etracer.add(s.x, s.y, s.z, Math.atan2(-s.vx, -s.vz), 1.5); }
  for (let i = 0; i < FX.n; i++) {
    const p = FX.a[i];
    const a = clamp(p.life / p.max, 0, 1);
    // muzzle flash: 0.5 units, random rotation, exactly two rendered frames
    if (p.kind === FXK.flash) { if (p.frames-- > 0) K.mflash.add(p.x, p.y, p.z, 0, p.size, p.size, p.size, p.col, 0, p.rot); continue; }
    if (p.kind === FXK.casing) { K.casing.add(p.x, p.y, p.z, p.life * 20, 1, 1, 1, null, p.life * 15); continue; }
    const sz = p.kind === FXK.puff ? p.size * (1.8 - a) : p.size * (0.4 + a * 0.8);
    K.part.add(p.x, p.y, p.z, p.life * 9, sz, sz, sz, p.col);
  }
  K.tracer.end(); K.tglow.end(); K.trail.end(); K.orb.end(); K.slash.end(); K.etracer.end(); K.part.end(); K.casing.end(); K.mflash.end();
}
let DEBUG_TRACER = 0; // set to 5 from the console to draw every tracer 5x (diagnostic)

const BOSS_TINT = [new THREE.Color(1, 1, 1), new THREE.Color(1.15, 0.85, 0.8), new THREE.Color(1.3, 0.62, 0.6)];
const C_VAR = new THREE.Color();
// The boss is on the road from the first second: far off, huge, walking at you with a heavy gait.
// Non-stage levels draw a recoloured, smaller spawn of the stage boss.
function syncBoss(dt, plat) {
  const K = GFX.k;
  K.platform.begin();
  const b = G.boss;
  if (b && !b.dead) {
    const rig = GFX.bossRig(b.kind, b.arch);
    rig.root.visible = true;
    while (rig.broken < b.phase) { rig.broken++; GFX.breakOff(rig, rig.broken); }
    GFX.tickFalling(rig, dt);
    rig.mat.color.copy(BOSS_TINT[Math.min(2, b.phase)]);
    if (b.variant) rig.mat.color.multiply(C_VAR.setHSL(b.hue, 0.55, 0.62).lerp(C_WHITE, 0.35));
    if (b.flash > 0) rig.mat.color.multiplyScalar(1.6);
    const walking = G.phase === 'run' || G.phase === 'intro';
    const step = walking ? b.walk * 2.4 : 0, stomp = walking ? Math.abs(Math.sin(step)) : 0;
    const breathe = 1 + Math.sin(G.t * 1.8) * 0.025, lean = b.atk ? (1 - b.atk.wind / b.atk.max) : 0;
    const place = (root, body, x, sc) => {
      sc *= b.scale;
      root.position.set(x + (b.recoil ? rand(-0.08, 0.08) * b.recoil : 0), 0, -b.z);
      root.scale.set(sc * breathe, sc * (b.kind === 'brine' ? 1 + Math.sin(G.t * 2.2) * 0.06 : breathe), sc * breathe);
      body.rotation.z = walking ? Math.sin(step) * 0.07 : Math.sin(G.t * 0.7) * 0.04; // heavy side-to-side as it walks
      body.rotation.x = -lean * 0.18 + b.recoil * 0.12 + (walking ? -0.05 : 0);
      body.position.y = walking ? (1 - stomp) * 0.35 : Math.sin(G.t * 1.4) * 0.1;
    };
    if (b.split && rig.twin) { place(rig.root, rig.body, b.x - 2.6, 0.62); rig.twin.visible = true; place(rig.twin, rig.twinBody, b.x + 2.6, 0.62); }
    else { place(rig.root, rig.body, b.x, 1); if (rig.twin) rig.twin.visible = false; }
    const swing = w => { if (!w) return; w.rotation.z = b.recoil > 0 ? lerp(1.4, -1.1, 1 - b.recoil) : 0.25 + lean * 1.2 + Math.sin(G.t * 1.3) * 0.08; };
    swing(rig.weapon); if (b.split) swing(rig.twinWeapon);
    for (const a in rig.inners) rig.inners[a].visible = a === b.arch;
    for (const a in rig.weapons) { rig.weapons[a].visible = a === b.arch; swing(rig.weapons[a]); }
    if (plat) K.platform.add(0, 0, (plat.z0 + plat.z1) / 2, 0, 7.5, 3, (plat.z1 - plat.z0) / 2 + 2);
  } else if (GFX.rig) { GFX.rig.root.visible = false; if (GFX.rig.twin) GFX.rig.twin.visible = false; GFX.tickFalling(GFX.rig, dt); }
  K.platform.end();
  K.blob.end();
}

// ---------------------------------------------------------------------------
// Overlay text in world space
// ---------------------------------------------------------------------------
function drawWorldLabels(c) {
  const P = G.P, fz = farZ();
  // band values: floating large above each band; they tick while you shoot them
  for (const s of G.sets) {
    if (s.done || s.z - P > 95 || s.z > fz || s.z < P - 1) continue;
    const vis = clamp((95 - (s.z - P)) / 20, 0, 1);
    for (const b of s.bands) {
      const cx = (b.x0 + b.x1) / 2;
      const q = proj(cx, s.z + 0.4, 2.9);
      if (!q.vis) continue;
      const w = (b.x1 - b.x0) * q.s;
      const px = clamp(q.s * 1.15, 16, 60) * (1 + b.pop * 0.35);
      c.globalAlpha = 0.35 + vis * 0.65;
      bigText(c, bandLabel(b), q.x, q.y, px, b.red ? '#ffb3bd' : b.flipped ? '#d8ffb0' : '#c9ffd6', { maxW: Math.max(w * 0.92, px * 2), lw: Math.max(4, px * 0.2), ink: b.red ? '#4a0010' : '#003a12' });
      if (hasRelic('abacus')) bigText(c, '= ' + fmtInt(applyBand(G.N, b, hasRelic('remainder'))), q.x, q.y + px * 0.85, Math.max(12, px * 0.42), '#fff7c2');
    }
  }
  c.globalAlpha = 1;
  for (const b of G.bars) {
    if (b.dead || b.z - P > 60) continue;
    const q = proj((b.x0 + b.x1) / 2, b.z, 1.7);
    if (q.vis) bigText(c, fmtHP(Math.ceil(b.hp)), q.x, q.y, clamp(q.s * 0.6, 11, 28), '#ffffff', { maxW: (b.x1 - b.x0) * q.s });
  }
  for (const br of G.barrels) {
    if (br.dead || br.z - P > 60) continue;
    const q = proj(br.x, br.z, 1.9);
    if (q.vis) bigText(c, fmtHP(Math.ceil(br.hp)), q.x, q.y, clamp(q.s * 0.55, 11, 26), '#ff6a5a');
  }
  // coin discs carry their value; carts show their bundle
  for (const d of G.coins) {
    if (d.z - P > 55 || d.z < P) continue;
    const q = proj(d.x, d.z - 0.1, 1.05);
    if (q.vis) bigText(c, fmtInt(d.val), q.x, q.y, clamp(q.s * 0.42, 9, 24), '#5a3200', { ink: '#fff3c4', lw: 2.5, shadow: false });
  }
  for (const k of G.carts) {
    if (k.taken || k.z - P > 70 || k.z < P) continue;
    const q = proj(k.x, k.z, 3.1);
    if (q.vis) bigText(c, '+' + fmtInt(k.val), q.x, q.y, clamp(q.s * 0.6, 12, 30), '#ffd23d');
  }
  // enemy HP: the nearest ones only, so the crowd reads as a wall first
  let shown = 0;
  for (let i = 0; i < ESORT.length && shown < 28; i++) {
    const e = ESORT[i];
    if (e.dead || e.inv || e.z - P > 34 || e.z < P - 1) continue;
    const sc = (LOOK_SCALE[e.look] || 1) * (e.elite ? 1.25 : 1);
    const q = proj(e.x, e.z, (e.y || 0) + 1.5 * sc + (e.look === 'wisp' || e.look === 'ghost' ? 0.4 : 0));
    if (!q.vis) continue;
    shown++;
    bigText(c, fmtHP(Math.ceil(e.hp)), q.x, q.y, clamp(q.s * 0.36 * Math.sqrt(sc), 9, 24), e.elite ? '#ffd23d' : e.rival ? '#9ff6ff' : '#ffffff');
  }
  // weapon crates: the HP printed large, the gun it holds floating above with its level
  for (const cr of G.crates) {
    if (cr.dead || cr.z > fz || cr.z - P > 75 || cr.z < P - 1) continue;
    const q = proj(cr.x, cr.z, 1.85);
    if (!q.vis) continue;
    const px = clamp(q.s * 0.75, 14, 46);
    bigText(c, fmtInt(Math.ceil(Math.max(0, cr.hp))), q.x, q.y, px, cr.flash > 0 ? '#ffffff' : '#ffe58a', { lw: Math.max(4, px * 0.18) });
    const qi = proj(cr.x, cr.z, 3.2 + Math.sin(G.t * 3 + cr.z) * 0.15, SP2);
    if (qi.vis) gunIcon(c, qi.x, qi.y, clamp(q.s * 0.5, 10, 30), cr.tier, cr.tier > G.weapon);
  }
  // squad count, large, above the formation
  const top = proj(G.lead.x, P + 0.6, 2.5);
  const px = 46 * (1 + (G.punch || 0) * 0.45);
  bigText(c, fmtInt(G.N), top.x, top.y, px, G.punch > 0.3 ? '#fff7c2' : '#ffffff', { lw: 8 });
  for (const tx of G.texts) {
    const q = proj(tx.x, tx.z, tx.y);
    if (!q.vis) continue;
    const age = tx.max - tx.life;
    const sc = age < 0.1 ? 0.5 + age / 0.1 * 0.7 : 1.2 - Math.min(0.2, age - 0.1);
    c.globalAlpha = clamp(tx.life * (tx.small ? 3 : 2.5), 0, 1);
    const isWord = /[A-Z]/.test(tx.text);
    bigText(c, tx.text, q.x, q.y, tx.size * sc, tx.col, isWord ? { font: dispFont(tx.size * sc), lw: Math.max(3, tx.size * 0.22) } : { lw: tx.small ? 3 : undefined });
  }
  c.globalAlpha = 1;
}
function drawScreenParts(c) {
  for (const p of G.parts) {
    if (p.kind === 'gem') iconGem(c, p.sx, p.sy, 8);
    else if (p.kind === 'confetti') { c.globalAlpha = Math.min(1, p.life / p.max * 2); c.save(); c.translate(p.sx, p.sy); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); c.restore(); c.globalAlpha = 1; }
  }
}

// ---------------------------------------------------------------------------
// HUD: pause (left), progress bar with a flag and % (center), coins (right). Nothing else.
// ---------------------------------------------------------------------------
function drawHUD(c, t) {
  const y = V.hudY + 22;
  const p = V.pause;
  cel(c, P.rr(p.x + 2, p.y + 2, p.w - 4, p.h - 4, 12), '#ffffff', '#c9c9d6', null, 3, 3);
  flat(c, P.rr(p.x + 15, p.y + 13, 5, 18, 2), INK, 0); flat(c, P.rr(p.x + 24, p.y + 13, 5, 18, 2), INK, 0);
  const coinStr = fmtInt(G.stats.coins);
  c.font = numFont(24);
  const cw = c.measureText(coinStr).width;
  const cx = V.w - 12 - cw;
  iconCoin(c, cx - 14, y, 10 * (1 + HUD.coinPulse * 0.35));
  bigText(c, coinStr, cx, y, 24, '#ffe58a', { align: 'left' });
  for (const pl of HUD.plus) { c.globalAlpha = 1 - pl.t / 0.9; bigText(c, '+' + fmtInt(pl.n), V.w - 14, y + 24 + pl.t * 22, 17, '#ffe58a', { align: 'right' }); }
  c.globalAlpha = 1;
  HUD.gemX = V.w - 30; HUD.gemY = y;
  const bx = p.x + p.w + 14, bw = cx - 34 - bx, by = y - 6;
  // progress: the boss's death and 100% are the same moment, so it holds at 99% until it falls
  const b = G.boss, bossDead = b && b.dead;
  const k = G.endless ? 0 : bossDead ? 1 : Math.min(0.99, G.P / G.Lr);
  cel(c, P.rr(bx, by, bw, 12, 6), '#14141f', null, null, 2.5);
  flat(c, P.rr(bx + 2, by + 2, Math.max(8, (bw - 4) * k), 8, 4), STAGES[G.stage - 1].pal.accent, 0);
  line(c, bx + bw, by - 10, bx + bw, by + 12, INK, 3);
  flat(c, P.poly([bx + bw, by - 10, bx + bw + 14, by - 5, bx + bw, by]), '#ff3b5c', 2);
  bigText(c, G.endless ? fmtInt(G.P) + 'm' : Math.floor(k * 100) + '%', bx + bw / 2, by + 24, 14, '#ffffff', { lw: 3 });
  // weapon level, at the left edge under pause
  const wy = p.y + p.h + 26;
  gunIcon(c, p.x + 16, wy, 14, G.weapon, false);
  bigText(c, 'Lv ' + G.weapon, p.x + 34, wy, 20, '#ffe58a', { align: 'left', lw: 4 });
  // the boss: HP bar and raw HP pinned near the top for the whole level, while it is still far off
  if (b && !b.dead && !G.nameCard && !G.endless) {
    const hk = clamp(b.hp / b.max, 0, 1);
    const w = V.w - 40, x = 20, yy = by + 62;
    cel(c, P.rr(x, yy, w, 14, 7), '#14141f', null, null, 2.5);
    flat(c, P.rr(x + 2, yy + 2, Math.max(6, (w - 4) * hk), 10, 5), hk > 2 / 3 ? '#ff3b5c' : hk > 1 / 3 ? '#ff7a2e' : '#ffd23d', 0);
    for (const m of [1 / 3, 2 / 3]) { c.fillStyle = INK; c.fillRect(x + w * m - 1, yy + 1, 2, 12); }
    bigText(c, fmtHP(Math.ceil(Math.max(0, b.hp))), V.cx, yy - 14, 24, '#ff6a7a', { lw: 5 });
  }
}
// a small side-on gun, longer and bulkier with the level; gold when it is an upgrade
function gunIcon(c, x, y, s, lv, up) {
  const len = s * (1.3 + lv * 0.09), th = s * (0.28 + lv * 0.02);
  c.save(); c.translate(x - len / 2, y);
  c.fillStyle = INK; c.fillRect(-2, -th / 2 - 2, len + 4, th + 4); c.fillRect(len * 0.18 - 2, th / 2 - 2, th * 0.9 + 4, th * 1.3 + 4);
  c.fillStyle = up ? '#ffd23d' : '#e6e8f2'; c.fillRect(0, -th / 2, len, th); c.fillRect(len * 0.18, th / 2, th * 0.9, th * 1.3);
  if (lv >= 3) { c.fillStyle = INK; c.fillRect(len * 0.5 - 2, th / 2 - 2, th * 0.7 + 4, th * 1.5 + 4); c.fillStyle = up ? '#ffb02e' : '#b9bccb'; c.fillRect(len * 0.5, th / 2, th * 0.7, th * 1.5); }
  c.restore();
}

function drawOverlays(c, t) {
  const b = G.banner;
  if (b) {
    const k = b.t / b.max;
    const inK = easeOutBack(Math.min(1, b.t / 0.35)), outK = k > 0.8 ? (k - 0.8) / 0.2 : 0;
    const x = lerp(-V.w, 0, inK) + outK * V.w * 1.2;
    const y = V.top + (V.bot - V.top) * 0.3;
    c.save(); c.translate(x, 0);
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, y - 38, V.w, 76);
    c.fillStyle = STAGES[G.stage - 1].pal.accent; c.fillRect(0, y - 38, V.w, 4); c.fillRect(0, y + 34, V.w, 4);
    bigText(c, b.title, V.cx, y - 6, 38, '#ffffff', { font: dispFont(38), lw: 7, maxW: V.w - 30 });
    if (b.sub) bigText(c, b.sub, V.cx, y + 22, 14, '#ffffff', { font: dispFont(14), lw: 3, maxW: V.w - 30 });
    c.restore();
  }
  const n = G.nameCard;
  if (n) {
    const k = n.t / n.max;
    const inK = easeOutCubic(Math.min(1, n.t / 0.4)), outK = k > 0.85 ? (k - 0.85) / 0.15 : 0;
    c.save(); c.globalAlpha = 1 - outK;
    const y = V.top + (V.bot - V.top) * 0.2;
    c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(0, y - 66, V.w, 132);
    c.fillStyle = '#ff3b5c'; c.fillRect(0, y - 66, V.w * inK, 5); c.fillRect(V.w * (1 - inK), y + 61, V.w, 5);
    for (let i = 0; i < 12; i++) line(c, (i * 47 + t * 600) % (V.w + 60) - 30, y - 56 + (i * 13) % 112, (i * 47 + t * 600) % (V.w + 60) - 90, y - 56 + (i * 13) % 112, 'rgba(255,255,255,0.15)', 2);
    bigText(c, n.name, lerp(V.w * 1.5, V.cx, inK), y - 8, 34, '#ffffff', { font: dispFont(34), lw: 7, maxW: V.w - 24 });
    bigText(c, n.sub, lerp(-V.w, V.cx, inK), y + 32, 14, '#ff9aa9', { font: dispFont(14), lw: 3, maxW: V.w - 24 });
    c.restore();
  }
}

function drawTutorialHand(c, t) {
  const T = G.tut; if (!T || G.mode !== 'play') return;
  const lq = proj(G.lead.x, G.P, 0, SP2);
  if (G.lt < 6) drawHand(c, V.cx + Math.sin(t * 2.6) * 70, lq.y + 50, true);
}
