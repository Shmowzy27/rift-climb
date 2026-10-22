// ============================================================================
// RENDER: sync game state into the Three.js scene, then draw the 2D overlay
// (numbers, gate labels, HUD) on a canvas above it. Numbers are the art
// direction, so they stay crisp 2D text with thick outlines.
// ============================================================================
let CV = null, HC = null, CX = null;
const MENU = { stage: 1, P: 0, bodies: null };
const SP = {}, SP2 = {}; // scratch projection results (no per-frame allocation)
const C_WHITE = new THREE.Color(1, 1, 1), C_FLASH = new THREE.Color(2.4, 2.4, 2.4), C_ELITE = new THREE.Color(1.25, 1.08, 0.55), C_TMP = new THREE.Color();

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

function render() {
  const c = CX;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, V.w, V.h);
  if (!GFX.ok) { bigText(c, 'WebGL is unavailable', V.cx, V.h / 2, 22, '#ffffff', { font: dispFont(22) }); return; }
  ASSETS.tick(G.t);
  const menu = G.mode === 'menu';
  if (menu) renderMenu();
  else {
    GFX.camera(G.P, G.camX, G.push ? easeInOut(G.push) : 0, G.shake);
    GFX.layoutWorld(G.stage, G.P);
    syncSquad(G.bodies, G.P, G.lead.x, G.phase === 'run', G.lead.vx);
    syncEnemies();
    syncProps();
    syncFx();
    syncBase();
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
  if (!MENU.bodies) {
    MENU.bodies = [];
    let row = 1, i = 0;
    while (i < 10) { const inRow = Math.min(row + 1, 10 - i); for (let k = 0; k < inRow; k++, i++) MENU.bodies.push({ ox: (k - (inRow - 1) / 2) * 0.46, oz: -row * 0.42 - 0.2, row, x: 0, ph: rand(0, TAU), pop: 0 }); row++; }
  }
  const lx = Math.sin(G.t * 0.4) * 1.2;
  for (const b of MENU.bodies) { b.x = lx + b.ox; b.ph += 0.19; }
  GFX.setStage(st);
  G.arch = STAGES[st - 1].arch || (Store.d.run && Store.d.run.arch) || 'crossbow';
  GFX.buildSquad(G.arch, skinById(Store.d.skin));
  GFX.camera(MENU.P - 6, lx * 0.4, 0, 0);
  GFX.layoutWorld(st, MENU.P);
  syncSquad(MENU.bodies, MENU.P, lx, true, Math.cos(G.t * 0.4));
  GFX.k.blob.end();
  for (const k of Object.values(GFX.enemyKits)) { k.begin(); k.end(); }
  for (const n of ['coin', 'buff', 'debuff', 'gold', 'ring', 'bar', 'post', 'panel', 'frame', 'haz', 'bolt', 'orb', 'beam', 'slash', 'tracer', 'part', 'crown', 'defender', 'mflash']) { GFX.k[n].begin(); GFX.k[n].end(); }
  if (GFX.base) GFX.base.visible = false;
  if (GFX.boss) GFX.boss.visible = false;
}

function syncSquad(bodies, P, lx, running, vx) {
  const K = GFX.k;
  K.body.begin(); K.leg.begin(); K.kai.begin(); K.blob.begin(); if (K.after) K.after.begin();
  const rec = -(G.recoil || 0) * 0.07, sw = -(G.swing || 0) * 0.55;
  const a = ASSETS.units[G.arch];
  for (const b of bodies) {
    const z = P + b.oz + rec;
    const bob = running ? Math.abs(Math.sin(b.ph)) * 0.07 : 0;
    const sc = 1 + Math.sin(Math.min(1, b.pop) * Math.PI) * 0.28;
    const lean = running ? -0.08 : 0;
    K.body.add(b.x, bob, z, 0, sc, sc, sc, null, lean + sw);
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
  K.kai.add(lx, kb, P + 0.3, -clamp(vx, -9, 9) * 0.03, 1.18, 1.18, 1.18, null, sw * 0.6, -clamp(vx, -9, 9) * 0.015);
  const ks = running ? Math.sin(ph) * 0.8 : 0;
  K.leg.add(lx - 0.12, 0.5 + kb, P + 0.3, 0, 1.18, 1.18, 1.18, null, ks);
  K.leg.add(lx + 0.12, 0.5 + kb, P + 0.3, 0, 1.18, 1.18, 1.18, null, -ks);
  K.blob.add(lx, 0.02, P + 0.3, 0, 1.1, 1, 1.1);
  K.body.end(); K.leg.end(); K.kai.end(); if (K.after) K.after.end();
  // blob stays open: enemies add their shadows too (closed in syncBase)
}

function syncEnemies() {
  const K = GFX.k;
  for (const k of Object.values(GFX.enemyKits)) k.begin();
  K.crown.begin();
  for (const e of G.enemies) {
    if (e.z - G.P > 90 || e.inv) continue;
    const kit = GFX.enemyKit(e.look);
    let sc = (LOOK_SCALE[e.look] || 1) * (e.elite ? 1.2 : 1);
    if (e.look === 'slime') sc *= e.r / 0.45;
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
  const K = GFX.k;
  K.coin.begin();
  for (const c of G.coins) if (c.z - G.P < 80) K.coin.add(c.x, c.y, c.z, c.spin);
  K.coin.end();
  K.buff.begin(); K.debuff.begin(); K.gold.begin(); K.ring.begin();
  for (const p of G.picks) {
    if (p.z - G.P > 95) continue;
    const bob = 1 + Math.sin(G.t * 3 + p.x) * 0.15;
    const kit = p.kind === 'gold' ? K.gold : p.kind === 'debuff' ? K.debuff : K.buff;
    kit.add(p.x, bob, p.z, G.t * 2, p.kind === 'gold' ? 1.4 : 1);
    const pulse = 1 + 0.15 * Math.sin(G.t * 9);
    K.ring.add(p.x, 0.03, p.z, 0, (p.kind === 'gold' ? 2.2 : 1.25) * pulse, 1, (p.kind === 'gold' ? 2.2 : 1.25) * pulse, p.kind === 'debuff' ? 0xff2a40 : p.kind === 'gold' ? 0xffd23d : 0x5cff7a);
  }
  K.buff.end(); K.debuff.end(); K.gold.end(); K.ring.end();
  K.bar.begin();
  for (const b of G.bars) if (!b.dead && b.z - G.P < 95) K.bar.add((b.x0 + b.x1) / 2, 0, b.z, 0, b.x1 - b.x0, 1, 1, b.flash > 0 ? C_FLASH : C_WHITE);
  K.bar.end();
  // gates: posts appear far out, the numbers resolve ~3s before you reach them
  K.post.begin(); K.panel.begin(); K.frame.begin();
  for (const g of G.gates) {
    if (g.done || g.z - G.P > 110 || g.z < G.P - 1) continue;
    const n = g.set ? g.set.length : 2;
    const spans = gateSpans(n);
    const sel = g.set ? spans.findIndex(([a, b]) => G.lead.x >= a && G.lead.x < b) : -1;
    for (let i = 0; i <= n; i++) K.post.add(-ROAD + i * ROAD * 2 / n, 0, g.z);
    if (!g.set) continue;
    for (let i = 0; i < n; i++) {
      const [a, b] = spans[i];
      C_TMP.set(gateColor(g.set[i]));
      if (i === sel) C_TMP.multiplyScalar(1.35);
      K.panel.add((a + b) / 2, 1.8, g.z, 0, b - a - 0.25, 3.3, 1, C_TMP);
      K.frame.add((a + b) / 2, 3.5, g.z, 0, b - a - 0.1, 1, 1, i === sel ? C_WHITE : C_TMP);
    }
  }
  K.post.end(); K.panel.end(); K.frame.end();
  K.haz.begin();
  const zone = (x0, x1, z0, z1, col, k) => K.haz.add((x0 + x1) / 2, 0.04, (z0 + z1) / 2, 0, x1 - x0, 1, z1 - z0, C_TMP.setHex(col).multiplyScalar(k));
  for (const h of G.hazards) zone(h.x0, h.x1, G.P - 3, G.P + (h.kind === 'corrupt' ? 30 : 4), h.kind === 'slime' ? 0x36d6b5 : 0x965aff, h.active ? 1 : 0.5 + 0.5 * Math.abs(Math.sin(G.t * 10)));
  const zz = (G.boss && G.boss.zone) || (G.base && G.base.zone);
  if (zz) { const w = G.boss && G.boss.zone ? G.boss : G.base; zone(zz[0], zz[1], G.P - 4, G.P + 4, G.boss && G.boss.kind === 'warden' ? 0xff7a1a : 0xff2846, 0.5 + 0.5 * Math.abs(Math.sin(G.t * 12)) + 0.5 * (1 - w.wind / (w.windMax || 0.8))); }
  K.haz.end();
}

function syncFx() {
  const K = GFX.k, st = G.stage;
  K.bolt.begin(); K.orb.begin(); K.beam.begin(); K.slash.begin(); K.tracer.begin(); K.part.begin(); K.mflash.begin();
  for (const s of G.shots) {
    if (s.kind === 'bolt') {
      const k = Math.min(1, s.t / s.T);
      const x = lerp(s.x0, s.x1, k), z = lerp(s.z0, s.z1, k), y = 0.9 + s.h * 4 * k * (1 - k);
      const dz = s.z1 - s.z0, dx = s.x1 - s.x0, vy = s.h * 4 * (1 - 2 * k);
      K.bolt.add(x, y, z, Math.atan2(-dx, dz), 1.3, 1.3, 1.3, null, Math.atan2(vy, Math.hypot(dx, dz)));
    } else K.orb.add(s.x, s.y, s.z, s.t * 6, 1 + Math.sin(s.t * 30) * 0.15);
  }
  const beamCol = st === 4 ? 0xff2bd6 : 0x2bf0ff;
  for (const b of G.beams) {
    const len = Math.max(0.5, b.z1 - b.z0);
    K.beam.add(b.x, 1.0, (b.z0 + b.z1) / 2, 0, 1 + b.t * 6, 1 + b.t * 6, len, beamCol);
    K.beam.add(b.x, 1.0, (b.z0 + b.z1) / 2, 0, 0.4, 0.4, len, 0xffffff);
  }
  for (const s of G.slashes) K.slash.add(s.x, 0.8, s.z, Math.PI, s.w / 2 * (1.2 - s.t), 1, 1.4);
  for (const t of G.tracers) {
    const y0 = t.y0 == null ? 3 : t.y0, y1 = t.y1 == null ? 0.7 : t.y1;
    const dx = t.x1 - t.x0, dz = t.z1 - t.z0, dy = y1 - y0, len = Math.hypot(dx, dz, dy);
    K.tracer.add((t.x0 + t.x1) / 2, (y0 + y1) / 2, (t.z0 + t.z1) / 2, Math.atan2(-dx, dz), 1, 1, len, null, Math.atan2(dy, Math.hypot(dx, dz)));
  }
  for (const p of G.parts) {
    if (p.kind === 'gem' || p.kind === 'confetti') continue;
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === 'flash') { K.mflash.add(p.x, p.y, p.z, 0, 0.8 + a); continue; }
    const s = p.kind === 'puff' ? p.size * (1.8 - a) : p.size * (0.4 + a * 0.8);
    K.part.add(p.x, p.y, p.z, p.life * 9, s, s, s, p.col);
  }
  K.bolt.end(); K.orb.end(); K.beam.end(); K.slash.end(); K.tracer.end(); K.part.end();
  // muzzle flashes stay open for the base defenders (closed in syncBase)
}

function syncBase() {
  const K = GFX.k;
  K.defender.begin();
  const B = G.base;
  const baseZ = B ? B.z : G.baseZ;
  const bossLevel = isStageBoss(G.level);
  if (GFX.base) {
    const show = !bossLevel && !(B && B.dead) && baseZ - G.P < 170;
    GFX.base.visible = show;
    if (show) {
      GFX.base.position.set(B && B.shake ? rand(-1, 1) * B.shake * 0.03 : 0, 0, -baseZ);
      for (let i = 0; i < 8; i++) {
        const x = -4.9 + i * 1.4;
        K.defender.add(x, 3.8, baseZ - 0.1, Math.PI);
        if (B && !B.dead && ((Math.floor(G.t * 7) + i) % 5 === 0)) K.mflash.add(x, 4.3, baseZ + 0.4, 0, 1.4);
      }
    }
  }
  if (G.boss && B && !B.dead) {
    const b = G.boss;
    const m = GFX.bossMesh(b.kind, b.arch);
    m.visible = true;
    const breathe = 1 + Math.sin(G.t * 2) * 0.02 + b.flash * 0.6;
    m.position.set(b.slamAnim ? rand(-0.1, 0.1) : 0, 0, -b.z);
    m.scale.set(breathe, b.kind === 'brine' ? 1 + Math.sin(G.t * 2.2) * 0.05 : breathe, breathe);
    const w = m.userData.weapon;
    if (w) {
      const wind = b.zone ? 1 - b.wind / (b.windMax || 2) : 0;
      w.rotation.z = b.swingT > 0 ? lerp(1.4, -1.0, 1 - b.swingT / 0.4) : 0.3 + wind * 1.1;
    }
  } else if (GFX.boss) GFX.boss.visible = false;
  K.defender.end(); K.mflash.end();
  K.blob.end();
}

// ---------------------------------------------------------------------------
// Overlay text in world space
// ---------------------------------------------------------------------------
function drawWorldLabels(c) {
  // gate labels: one op, or two stacked for a compound gate
  for (const g of G.gates) {
    if (g.done || !g.set || g.z - G.P > 3.2 * G.v + 2) continue;
    const vis = clamp((3.2 * G.v - (g.z - G.P)) / (0.6 * G.v), 0, 1);
    const spans = gateSpans(g.set.length);
    for (let i = 0; i < g.set.length; i++) {
      const [a, b] = spans[i];
      const q = proj((a + b) / 2, g.z, 2.1);
      if (!q.vis) continue;
      const w = (b - a) * q.s;
      const lines = g.set[i].label;
      const px = Math.max(lines.length > 1 ? 19 : 24, Math.min(w * 0.34, (lines.length > 1 ? 0.75 : 1.05) * q.s));
      c.globalAlpha = 0.25 + vis * 0.75;
      if (lines.length === 1) bigText(c, lines[0], q.x, q.y, px, '#ffffff', { maxW: Math.max(w * 0.9, px * 2.6) });
      else lines.forEach((l, k) => bigText(c, l, q.x, q.y + (k - 0.5) * px * 1.02, px, '#ffffff', { maxW: Math.max(w * 0.9, px * 2.6) }));
      if (hasRelic('abacus')) bigText(c, '= ' + fmtInt(g.set[i].result), q.x, q.y + px * (lines.length > 1 ? 1.4 : 0.95), Math.max(12, px * 0.5), '#fff7c2');
    }
  }
  c.globalAlpha = 1;
  for (const b of G.bars) {
    if (b.dead || b.z - G.P > 60) continue;
    const q = proj((b.x0 + b.x1) / 2, b.z, 1.6);
    if (q.vis) bigText(c, fmtInt(b.hp), q.x, q.y, clamp(q.s * 0.7, 11, 30), '#ffffff', { maxW: (b.x1 - b.x0) * q.s });
  }
  for (const e of G.enemies) {
    if (e.inv || e.z - G.P > 55 || e.z < G.P - 1) continue;
    const sc = (LOOK_SCALE[e.look] || 1) * (e.elite ? 1.2 : 1);
    const q = proj(e.x, e.z, (e.y || 0) + 1.55 * sc + (e.look === 'wisp' || e.look === 'ghost' ? 0.4 : 0));
    if (!q.vis) continue;
    bigText(c, fmtHP(e.hp), q.x, q.y, clamp(q.s * 0.42 * Math.sqrt(sc), 10, 32), e.elite ? '#ffd23d' : e.rival ? '#9ff6ff' : '#ffffff');
  }
  // base / boss HP
  const B = G.base;
  if (!isStageBoss(G.level) && !(B && B.dead) && (B || G.baseZ - G.P < 90)) {
    const q = proj(0, B ? B.z : G.baseZ, 6.6);
    if (q.vis) {
      const px = clamp(q.s * 1.4, 16, 52);
      cel(c, P.rr(q.x - px * 2.4, q.y - px * 0.62, px * 4.8, px * 1.24, 10), '#14141f', '#0a0a12', '#3a3a55', 3, 3);
      bigText(c, fmtHP(B ? Math.max(0, B.hp) : G.baseMax), q.x, q.y, px, B && B.hp / B.max < 0.25 ? '#ff9aa9' : '#ffffff', { maxW: px * 4.5 });
    }
  }
  if (G.boss && B && !B.dead) {
    const q = proj(0, G.boss.z, 9.2);
    if (q.vis) bigText(c, fmtHP(Math.max(0, B.hp)), q.x, Math.max(V.top + 120, q.y), clamp(q.s * 1.2, 22, 48), '#ffffff');
    if (G.boss.kind === 'echo' || G.boss.kind === 'otherkai') { const q2 = proj(0, G.boss.z, 4.5, SP2); if (q2.vis) bigText(c, fmtInt(G.boss.mirror), q2.x, q2.y, 30, G.boss.kind === 'echo' ? '#2bf0ff' : '#ffffff'); }
  }
  // squad count, large, above the formation
  const top = proj(G.lead.x, G.P + 1.6, 3.4);
  const px = 46 * (1 + (G.punch || 0) * 0.45);
  bigText(c, fmtInt(G.N), top.x, top.y, px, G.punch > 0.3 ? '#fff7c2' : '#ffffff', { lw: 8 });
  bigText(c, archDef().weapon.toUpperCase() + ' · HIT ' + fmtInt(volley(G.phase === 'assault')), top.x, top.y + px * 0.62, 12, '#ffe58a', { lw: 3.5, font: dispFont(12) });
  for (const tx of G.texts) {
    const q = proj(tx.x, tx.z, tx.y);
    if (!q.vis) continue;
    const age = tx.max - tx.life;
    const sc = age < 0.12 ? 0.5 + age / 0.12 * 0.7 : 1.2 - Math.min(0.2, age - 0.12);
    c.globalAlpha = clamp(tx.life * 2.5, 0, 1);
    const isWord = /[A-Z]/.test(tx.text);
    bigText(c, tx.text, q.x, q.y, tx.size * sc, tx.col, isWord ? { font: dispFont(tx.size * sc), lw: Math.max(3, tx.size * 0.22) } : {});
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
// HUD: pause (left), progress bar with flag, coins (right), streak, buffs
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
  for (const pl of HUD.plus) { c.globalAlpha = 1 - pl.t / 0.9; bigText(c, '+' + pl.n, V.w - 14, y + 22 + pl.t * 20, 16, '#ffe58a', { align: 'right' }); }
  c.globalAlpha = 1;
  const gemStr = String(Store.d.gems);
  HUD.gemX = V.w - 30; HUD.gemY = y + 26;
  if (!HUD.plus.length) { iconGem(c, V.w - 40 - gemStr.length * 6, y + 26, 7 * (1 + HUD.gemPulse * 0.4)); bigText(c, gemStr, V.w - 12, y + 26, 16, '#9fefff', { align: 'right' }); }
  const bx = p.x + p.w + 14, bw = cx - 30 - bx, by = y - 6;
  if (G.phase === 'run' || !G.base) {
    const k = clamp(G.P / G.Lr, 0, 1);
    cel(c, P.rr(bx, by, bw, 12, 6), '#14141f', null, null, 2.5);
    flat(c, P.rr(bx + 2, by + 2, Math.max(8, (bw - 4) * k), 8, 4), STAGES[G.stage - 1].pal.accent, 0);
    for (const g of G.gates) { const gx = bx + bw * clamp(g.z / G.Lr, 0, 1); c.fillStyle = g.done ? 'rgba(255,255,255,0.35)' : '#ffffff'; c.fillRect(gx - 1, by + 2, 2, 8); }
    line(c, bx + bw, by - 10, bx + bw, by + 12, INK, 3);
    flat(c, P.poly([bx + bw, by - 10, bx + bw + 14, by - 5, bx + bw, by]), '#ff3b5c', 2);
    bigText(c, 'LV ' + G.level, bx, by + 24, 13, '#ffffff', { align: 'left', font: dispFont(13), lw: 3 });
  } else {
    const B = G.base, k = clamp(B.timer / G.timerMax, 0, 1), hot = B.timer < 5;
    cel(c, P.rr(bx, by - 2, bw, 16, 8), '#14141f', null, null, 2.5);
    flat(c, P.rr(bx + 2, by, Math.max(8, (bw - 4) * k), 12, 6), hot ? '#ff3b5c' : '#ffd23d', 0);
    bigText(c, Math.max(0, B.timer).toFixed(1), bx + bw / 2, by + 28, hot ? 26 + Math.sin(t * 20) * 2 : 22, hot ? '#ff9aa9' : '#ffffff');
  }
  let rowY = by + 46;
  if (G.streak >= 2) { bigText(c, 'EXACT ×' + G.streak, V.cx, rowY, 18 * (1 + Math.min(0.4, G.streak * 0.03)), '#ffd23d', { font: dispFont(18), lw: 4 }); rowY += 24; }
  let chipX = V.cx - 72;
  for (const [d, info, col] of [[G.buff, G.buff && BUFFS[G.buff.id], '#3fdc5c'], [G.debuff, G.debuff && DEBUFFS[G.debuff.id], '#e8283e']]) {
    if (!d) continue;
    const w = 68;
    cel(c, P.rr(chipX, rowY - 10, w, 20, 6), '#14141f', null, null, 2);
    c.fillStyle = d.mag > 1 ? '#ffd23d' : col; c.globalAlpha = 0.5; c.fillRect(chipX + 2, rowY - 8, (w - 4) * d.t / d.max, 16); c.globalAlpha = 1;
    bigText(c, info.short, chipX + w / 2, rowY, 12, '#ffffff', { font: dispFont(12), lw: 3, maxW: w - 6 });
    chipX += w + 8;
  }
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
    const y = V.top + (V.bot - V.top) * 0.35;
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
  if (T.step === 0 && G.lt < 6.5) drawHand(c, V.cx + Math.sin(t * 2.6) * 70, lq.y + 50, true);
  else if (T.step === 3) {
    const d = G.picks.find(p => p.kind === 'debuff');
    if (d) { const dir = d.x > 0 ? -1 : 1, ph = (t % 1.2) / 1.2; drawHand(c, lq.x + dir * ph * 90, lq.y + 50, true); }
  }
}
