// ============================================================================
// RENDER: fake-3D chase camera. Road recedes to a vanishing point, sprites
// scale with distance, scenery at the edges slides past faster.
// ============================================================================
let CV = null, CX = null;
const SKY = { key: '', cv: null };
const MENU = { stage: 1, P: 0 };
const FAR = 95;

function resize() {
  DPR = Math.min(3, window.devicePixelRatio || 1);
  layout();
  CV.width = Math.round(V.w * DPR); CV.height = Math.round(V.h * DPR);
  CV.style.width = V.w + 'px'; CV.style.height = V.h + 'px';
  SPR.clear(); SKY.key = '';
}
function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

function skyFor(st) {
  const key = st + '_' + V.w + 'x' + V.h;
  if (SKY.key === key) return SKY.cv;
  const cv = SKY.cv || document.createElement('canvas');
  cv.width = Math.round(V.w * DPR); cv.height = Math.round((V.horizon + 4) * DPR);
  const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const p = STAGES[st - 1].pal;
  const g = c.createLinearGradient(0, 0, 0, V.horizon);
  g.addColorStop(0, p.sky1); g.addColorStop(1, p.sky2);
  c.fillStyle = g; c.fillRect(0, 0, V.w, V.horizon + 4);
  if (st === 5) {
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { let x = (i * 71 + 20) % V.w, y = 10 + (i * 37) % (V.horizon * 0.7); c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (hash(i, k) - 0.5) * 30; y += 8 + hash(k, i) * 10; c.lineTo(x, y); } c.stroke(); }
  } else {
    // sun / moon
    c.fillStyle = st === 4 ? '#ff7ae6' : st === 2 ? '#ffd0a0' : '#fff6d8';
    c.globalAlpha = 0.8; c.beginPath(); c.arc(V.w * 0.72, V.horizon * 0.42, V.w * 0.07, 0, TAU); c.fill(); c.globalAlpha = 1;
    // far skyline silhouette
    c.fillStyle = shade(p.fog, -0.25);
    for (let x = -10; x < V.w + 10;) {
      const bw = 14 + hash(x, st) * 30, bh = 10 + hash(st, x) * V.horizon * 0.35;
      c.fillRect(x, V.horizon - bh, bw, bh + 2); x += bw + 2;
    }
    c.fillStyle = p.fog; c.globalAlpha = 0.5; c.fillRect(0, V.horizon - 14, V.w, 16); c.globalAlpha = 1;
  }
  SKY.cv = cv; SKY.key = key;
  return cv;
}

function render() {
  const c = CX;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const inGame = G.mode !== 'menu';
  if (!inGame) { renderMenuScene(c); return; }
  const t = G.t;
  c.save();
  if (G.push > 0) { const k = 1 + easeInOut(G.push) * 0.18; c.translate(V.cx, V.h * 0.45); c.scale(k, k); c.translate(-V.cx, -V.h * 0.45); }
  if (G.shake > 0) c.translate(rand(-1, 1) * G.shake * 0.5, rand(-1, 1) * G.shake * 0.5);
  drawWorld(c, G.stage, t);
  c.restore();
  drawHUD(c, t);
  drawOverlays(c, t);
  drawTutorialHand(c, t);
  if (G.flash > 0) { c.globalAlpha = Math.min(0.5, G.flash * 0.6); c.fillStyle = G.flashCol; c.fillRect(0, 0, V.w, V.h); c.globalAlpha = 1; }
  drawScreenParts(c);
}

function renderMenuScene(c) {
  // a squad running down an empty road behind the menu
  const st = MENU.stage;
  MENU.P += 0.12;
  const save = { P: G.P, camX: G.camX };
  G.P = MENU.P; G.camX = Math.sin(G.t * 0.4) * 0.8;
  drawWorld(c, st, G.t, true);
  const skin = skinById(Store.d.skin);
  const fr = Math.floor(G.t * 9) % 4;
  for (let row = 3; row >= 1; row--) for (let k = 0; k <= row; k++) {
    const x = (k - row / 2) * 0.75 + Math.sin(G.t * 0.4) * 0.8, p = proj(x, G.P + 22 - row * 0.65);
    drawSpr(c, soldierSprite(skin, (fr + k + row) % 4, 60, true), p.x, p.y - 34 * (1.2 * p.s / 68), 1.2 * p.s / 68);
  }
  const lp = proj(Math.sin(G.t * 0.4) * 0.8, G.P + 22);
  c.save(); c.translate(lp.x, lp.y); drawKaiBack(c, 1.25 * lp.s / 56, G.t, fr, 0); c.restore();
  G.P = save.P; G.camX = save.camX;
}

function drawWorld(c, st, t, menu) {
  const p = STAGES[st - 1].pal;
  c.drawImage(skyFor(st), 0, 0, V.w, V.horizon + 4);
  // ground
  if (p.ground) { c.fillStyle = p.ground; c.fillRect(0, V.horizon, V.w, V.h - V.horizon); }
  else {
    c.fillStyle = '#000'; c.fillRect(0, V.horizon, V.w, V.h - V.horizon);
    c.fillStyle = 'rgba(185,182,255,0.5)';
    for (let i = 0; i < 40; i++) { const z = G.P + ((i * 13.7 + t * 2) % FAR), q = proj((hash(i, 3) - 0.5) * 60, z, -2 - hash(i, 9) * 6); c.fillRect(q.x, q.y, 1.5, 1.5); }
  }
  drawRoad(c, st, p, t);
  drawScenery(c, st, p, t);
  if (menu) return;
  drawHazards(c, t);
  // world entities, far to near
  const list = [];
  for (const g of G.gates) if (!g.done && g.z - G.P < FAR && g.z - G.P > -1) list.push({ z: g.z, f: () => drawGateSet(c, g, t) });
  for (const b of G.bars) if (!b.dead && b.z - G.P < FAR) list.push({ z: b.z, f: () => drawBar(c, b, p) });
  for (const k of G.coins) if (k.z - G.P < 70) list.push({ z: k.z, f: () => { const q = proj(k.x, k.z, k.y); const sz = 0.55 * q.s; drawSpr(c, coinSprite(28), q.x, q.y, sz / 28 * Math.max(0.25, Math.abs(Math.cos(k.spin))), sz / 28); } });
  for (const k of G.picks) if (k.z - G.P < FAR) list.push({ z: k.z, f: () => drawPick(c, k, t) });
  for (const e of G.enemies) if (e.active || e.z - G.P < FAR) list.push({ z: e.z, f: () => drawEnemyW(c, e, t) });
  if (G.base && !G.base.dead) list.push({ z: G.base.z, f: () => drawBaseW(c, t) });
  else if (G.Lr && G.Lr + 16 - G.P < FAR && !G.base) list.push({ z: G.Lr + 16, f: () => drawBaseW(c, t) });
  list.sort((a, b) => b.z - a.z);
  for (const it of list) if (it.z >= G.P - 0.2) it.f();
  drawTracers(c);
  drawSquad(c, t);
  for (const it of list) if (it.z < G.P - 0.2) it.f();
  drawWorldParts(c);
  drawWorldTexts(c);
}

function drawRoad(c, st, p, t) {
  const z0 = G.P - LEAD_DEPTH + 1.2;
  const step = 3;
  const startK = Math.floor(z0 / step);
  for (let k = startK + Math.ceil(FAR / step); k >= startK; k--) {
    const za = Math.max(z0, k * step), zb = (k + 1) * step;
    if (zb <= z0) continue;
    const a1 = proj(-ROAD, za), a2 = proj(ROAD, za), b1 = proj(-ROAD, zb), b2 = proj(ROAD, zb);
    c.fillStyle = Math.floor(k / 2) % 2 ? p.road : p.road2;
    c.beginPath(); c.moveTo(a1.x, a1.y); c.lineTo(a2.x, a2.y); c.lineTo(b2.x + 0.5, b2.y - 0.5); c.lineTo(b1.x - 0.5, b1.y - 0.5); c.closePath(); c.fill();
    // curbs
    for (const sd of [-1, 1]) {
      const e1 = proj(sd * ROAD, za), e2 = proj(sd * (ROAD + 0.45), za), f1 = proj(sd * ROAD, zb), f2 = proj(sd * (ROAD + 0.45), zb);
      c.fillStyle = k % 2 ? p.edge : shade(p.edge, -0.5);
      c.beginPath(); c.moveTo(e1.x, e1.y); c.lineTo(e2.x, e2.y); c.lineTo(f2.x, f2.y); c.lineTo(f1.x, f1.y); c.closePath(); c.fill();
    }
    // lane dashes, five gate-widths wide
    if (k % 2 === 0) {
      c.fillStyle = p.line; c.globalAlpha = st === 4 ? 0.9 : 0.55;
      for (const x of [-3, -1, 1, 3]) {
        const q1 = proj(x - 0.06, za), q2 = proj(x + 0.06, za), r1 = proj(x - 0.06, Math.min(zb, za + 1.6)), r2 = proj(x + 0.06, Math.min(zb, za + 1.6));
        c.beginPath(); c.moveTo(q1.x, q1.y); c.lineTo(q2.x, q2.y); c.lineTo(r2.x, r2.y); c.lineTo(r1.x, r1.y); c.closePath(); c.fill();
      }
      c.globalAlpha = 1;
    }
  }
  // stage ground details hugging the road
  if (st === 3) { // molten runoff channels
    for (const sd of [-1, 1]) {
      const a = proj(sd * 5.8, z0), b = proj(sd * 7.2, z0), cc = proj(sd * 7.2, G.P + FAR), d = proj(sd * 5.8, G.P + FAR);
      const gl = 0.75 + Math.sin(t * 3) * 0.15;
      c.fillStyle = `rgba(255,${110 + gl * 40 | 0},20,${gl})`;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(cc.x, cc.y); c.lineTo(d.x, d.y); c.closePath(); c.fill();
    }
  }
  if (st === 1) { // standing water at the edges
    c.fillStyle = 'rgba(80,220,210,0.35)';
    for (const sd of [-1, 1]) { const a = proj(sd * 5.5, z0), b = proj(sd * 12, z0), cc = proj(sd * 12, G.P + FAR), d = proj(sd * 5.5, G.P + FAR); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(cc.x, cc.y); c.lineTo(d.x, d.y); c.closePath(); c.fill(); }
  }
  if (st === 4) { // wet road reflections
    c.globalAlpha = 0.18;
    for (let i = 0; i < 8; i++) { const x = (hash(i, 1) - 0.5) * 9, z = G.P + ((i * 11 + hash(i, 2) * 20) % 60); const q = proj(x, z), q2 = proj(x, z + 6); c.fillStyle = i % 2 ? '#ff2bd6' : '#2bf0ff'; c.fillRect(q.x - 2, q2.y, 4, q.y - q2.y); }
    c.globalAlpha = 1;
  }
  // fog toward the horizon
  const fg = c.createLinearGradient(0, V.horizon, 0, V.horizon + (V.h - V.horizon) * 0.18);
  fg.addColorStop(0, p.fog); fg.addColorStop(1, p.fog + '00');
  c.fillStyle = fg; c.fillRect(0, V.horizon, V.w, (V.h - V.horizon) * 0.18);
}

// ---- side scenery: boxes in perspective, generated from the slot index ----
function box(c, x0, x1, z0, z1, h, front, side, top) {
  const nearInner = x0 > 0 ? x0 : x1;
  const f1 = proj(x0, z0), f2 = proj(x1, z0), f3 = proj(x1, z0, h), f4 = proj(x0, z0, h);
  const s1 = proj(nearInner, z0), s2 = proj(nearInner, z1), s3 = proj(nearInner, z1, h), s4 = proj(nearInner, z0, h);
  c.fillStyle = side; c.beginPath(); c.moveTo(s1.x, s1.y); c.lineTo(s2.x, s2.y); c.lineTo(s3.x, s3.y); c.lineTo(s4.x, s4.y); c.closePath(); c.fill();
  if (h < V.camH) { const t1 = proj(x0, z1, h), t2 = proj(x1, z1, h); c.fillStyle = top; c.beginPath(); c.moveTo(f4.x, f4.y); c.lineTo(f3.x, f3.y); c.lineTo(t2.x, t2.y); c.lineTo(t1.x, t1.y); c.closePath(); c.fill(); }
  c.fillStyle = front; c.beginPath(); c.moveTo(f1.x, f1.y); c.lineTo(f2.x, f2.y); c.lineTo(f3.x, f3.y); c.lineTo(f4.x, f4.y); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(11,11,20,0.8)'; c.lineWidth = Math.max(1, f1.s * 0.06); c.stroke();
  return { f1, f2, f3, f4 };
}
function drawScenery(c, st, p, t) {
  const slot = 7;
  const k0 = Math.floor((G.P - LEAD_DEPTH) / slot), k1 = Math.floor((G.P + FAR) / slot);
  for (let k = k1; k >= k0; k--) {
    for (const sd of [-1, 1]) {
      const r = hash(k, sd + 7 * st), r2 = hash(sd, k + 3);
      const z0 = k * slot + r2 * 2;
      if (z0 < G.P - LEAD_DEPTH + 1) continue;
      const xIn = sd * (6.6 + r * 1.5);
      if (st === 5) { // floating rubble in the void, edged in white
        if (r < 0.55) continue;
        const sz = 1 + r2 * 2.5, y = -2 + r2 * 6;
        const q = proj(xIn + sd * (2 + r * 4), z0, y);
        const w = sz * q.s;
        c.fillStyle = '#0c0c14'; c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, q.s * 0.05);
        c.beginPath(); c.moveTo(q.x - w, q.y); c.lineTo(q.x - w * 0.4, q.y - w * 0.8); c.lineTo(q.x + w * 0.7, q.y - w * 0.6); c.lineTo(q.x + w, q.y + w * 0.2); c.lineTo(q.x, q.y + w * 0.6); c.closePath(); c.fill(); c.stroke();
        continue;
      }
      if (r < 0.62) {
        // building block
        const w = 3 + r2 * 3, d = 4 + r * 3, h = (st === 4 ? 7 : 3.5) + hash(k, sd) * (st === 4 ? 9 : 5);
        const x0 = sd < 0 ? xIn - w : xIn, x1 = sd < 0 ? xIn : xIn + w;
        const col = p.bld[Math.floor(r2 * 3)];
        const f = box(c, x0, x1, z0, z0 + d, h, col, shade(col, -0.25), shade(col, 0.2));
        // windows (some lit, some broken)
        const rows = Math.min(6, Math.floor(h / 1.4)), cols = Math.max(1, Math.floor(w / 1.2));
        const fw = f.f2.x - f.f1.x, fh = f.f1.y - f.f4.y;
        if (fw > 10) {
          for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
            const lit = hash(k * 13 + i, j + sd) > 0.55;
            c.fillStyle = lit ? p.win : 'rgba(0,0,0,0.45)';
            c.fillRect(f.f1.x + fw * (j + 0.25) / cols, f.f4.y + fh * (i + 0.25) / rows, fw * 0.5 / cols, fh * 0.45 / rows);
          }
        }
        if (st === 4 && hash(k, 5) > 0.5) { // neon sign
          c.save(); c.shadowColor = hash(k, 6) > 0.5 ? '#ff2bd6' : '#2bf0ff'; c.shadowBlur = 10; c.strokeStyle = c.shadowColor; c.lineWidth = Math.max(1.5, f.f1.s * 0.1);
          c.strokeRect(f.f1.x + fw * 0.15, f.f4.y + fh * 0.1, fw * 0.7, fh * 0.12); c.restore();
        }
        if (st === 2 && hash(k, 8) > 0.5) { // torch
          const q = proj(sd < 0 ? x1 : x0, z0, 2.4);
          c.fillStyle = `rgba(255,${140 + Math.sin(t * 12 + k) * 40 | 0},40,0.9)`; c.beginPath(); c.arc(q.x, q.y, Math.max(2, q.s * 0.25), 0, TAU); c.fill();
        }
        if (st === 3 && hash(k, 9) > 0.4) { // chimney + smoke
          const cx0 = (x0 + x1) / 2 - 0.4;
          box(c, cx0, cx0 + 0.8, z0 + 1, z0 + 1.8, h + 3, '#3a2a1c', '#2a1e14', '#5a4a3a');
          const q = proj(cx0 + 0.4, z0 + 1.4, h + 3.6 + (t * 0.8 + k) % 3);
          c.fillStyle = 'rgba(60,50,45,0.45)'; c.beginPath(); c.arc(q.x, q.y, q.s * 0.7, 0, TAU); c.fill();
        }
      } else if (r < 0.82) {
        // wrecked car (half-sunk in the Flooded Ward)
        const x0 = sd < 0 ? xIn - 1.9 + 0.8 : xIn - 0.8, cz = z0 + 1;
        const sunk = st === 1 ? 0.35 : 0;
        const bodyCol = ['#8a3a2a', '#3a5a8a', '#c9b48a', '#4a4a52'][Math.floor(r2 * 4)];
        box(c, x0, x0 + 1.9, cz, cz + 4, 0.9 - sunk, bodyCol, shade(bodyCol, -0.3), shade(bodyCol, 0.2));
        box(c, x0 + 0.25, x0 + 1.65, cz + 1.1, cz + 2.8, 1.5 - sunk, '#1a2a33', '#121c22', shade(bodyCol, 0.1));
      } else {
        // rubble pile
        const q = proj(xIn + sd * 0.8, z0);
        const w = (0.8 + r2) * q.s;
        c.fillStyle = shade(p.bld[0], -0.15); c.strokeStyle = INK; c.lineWidth = Math.max(1, q.s * 0.05);
        c.beginPath(); c.moveTo(q.x - w, q.y); c.lineTo(q.x - w * 0.4, q.y - w * 0.7); c.lineTo(q.x + w * 0.2, q.y - w * 0.45); c.lineTo(q.x + w * 0.6, q.y - w * 0.8); c.lineTo(q.x + w, q.y); c.closePath(); c.fill(); c.stroke();
      }
    }
  }
}

function drawHazards(c, t) {
  const zones = [];
  for (const h of G.hazards) zones.push({ x0: h.x0, x1: h.x1, z0: G.P - 3, z1: G.P + (h.kind === 'corrupt' ? 30 : 4), col: h.kind === 'slime' ? '54,214,181' : '150,90,255', active: h.active, warn: !h.active });
  if (G.base && G.base.zone) zones.push({ x0: G.base.zone[0], x1: G.base.zone[1], z0: G.P - 3, z1: G.P + 3, col: '255,90,40', active: false, warn: true, fill: 1 - G.base.wind / 0.8 });
  if (G.boss && G.boss.zone) zones.push({ x0: G.boss.zone[0], x1: G.boss.zone[1], z0: G.P - 4, z1: G.P + 4, col: '255,40,70', active: false, warn: true, fill: 1 - G.boss.wind / 2 });
  for (const zn of zones) {
    const a = proj(zn.x0, zn.z0), b = proj(zn.x1, zn.z0), cc = proj(zn.x1, zn.z1), d = proj(zn.x0, zn.z1);
    const al = zn.active ? 0.45 : 0.18 + 0.2 * Math.abs(Math.sin(t * 10));
    c.fillStyle = `rgba(${zn.col},${al})`;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(cc.x, cc.y); c.lineTo(d.x, d.y); c.closePath(); c.fill();
    c.strokeStyle = `rgba(${zn.col},0.95)`; c.lineWidth = 3; c.stroke();
    if (zn.fill != null) { c.fillStyle = `rgba(${zn.col},0.5)`; const m = proj(zn.x0, zn.z0), n = proj(zn.x1, zn.z0); c.fillRect(m.x, m.y - 6, (n.x - m.x) * zn.fill, 6); }
    if (zn.warn) bigText(c, '!', (a.x + b.x) / 2, a.y - 40, 40, `rgb(${zn.col})`);
  }
}

function drawGateSet(c, g, t) {
  const n = g.set ? g.set.length : 2;
  const spans = gateSpans(n);
  const q0 = proj(0, g.z);
  const h = 3.4;
  const vis = g.set ? clamp((3.2 * G.v - (g.z - G.P)) / (0.6 * G.v), 0, 1) : 0;
  const sel = g.set ? spans.findIndex(([a, b]) => G.lead.x >= a && G.lead.x < b) : -1;
  for (let i = 0; i < n; i++) {
    const [a, b] = spans[i];
    const pa = proj(a, g.z), pb = proj(b, g.z), top = proj(a, g.z, h);
    if (!g.set) { // frame visible from far before the numbers resolve
      c.globalAlpha = 0.5;
      for (const x of [pa.x, pb.x]) { c.fillStyle = INK; c.fillRect(x - 2, top.y, 4, pa.y - top.y); }
      c.globalAlpha = 1;
      continue;
    }
    const res = hasRelic('abacus') ? g.set[i].result : null;
    drawGate(c, pa.x, pb.x, top.y, pa.y, g.set[i], q0.s / 30, 0.35 + 0.65 * vis, i === sel && vis > 0.5, res);
  }
}
function drawBar(c, b, p) {
  const a = proj(b.x0, b.z), bb = proj(b.x1, b.z), top = proj(b.x0, b.z, 1.2);
  drawBarricade(c, a.x, bb.x, top.y, a.y, a.s / 30, p, b.hp, 1 - b.hp / b.maxHp);
  if (b.flash > 0) { c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(a.x, top.y, bb.x - a.x, a.y - top.y); }
}
function drawPick(c, k, t) {
  const gold = k.kind === 'gold';
  const q = proj(k.x, k.z, 1 + Math.sin(t * 3 + k.x) * 0.15);
  const g = proj(k.x, k.z);
  // pulsing warning ring on the road, visible well before you reach it
  const ringR = (gold ? 2.2 : 1.2) * g.s * (1 + 0.12 * Math.sin(t * 8));
  c.save(); c.globalAlpha = 0.85;
  c.strokeStyle = k.kind === 'debuff' ? '#ff2a40' : gold ? '#ffd23d' : '#5cff7a'; c.lineWidth = Math.max(2, g.s * 0.12);
  c.beginPath(); c.ellipse(g.x, g.y, ringR, ringR * 0.32, 0, 0, TAU); c.stroke();
  c.restore();
  const S = 40;
  drawSpr(c, pickupSprite(k.kind, S), q.x, q.y, (gold ? 1.5 : 0.9) * q.s / S * 1.6);
}
function drawEnemyW(c, e, t) {
  const q = proj(e.x, e.z, e.y || 0);
  const rpx = e.r * q.s;
  if (rpx < 1) return;
  let sx = 1, sy = 1, alpha = 1;
  if (e.look === 'slime') { const b = Math.sin(e.t * 9); sx = 1 + b * 0.08; sy = 1 - b * 0.1; }
  if (e.look === 'ghost') alpha = 0.88;
  if (e.inv) alpha = 0.08;
  const yb = q.y - rpx * 1.05;
  c.save(); c.globalAlpha = alpha;
  if (e.look === 'drone') drawSpr(c, gearSprite(22), q.x, yb, rpx / 22, rpx / 22, e.t * 3);
  drawSpr(c, enemySprite(e.look, 22, { elite: e.elite }), q.x, yb, sx * rpx / 22, sy * rpx / 22);
  if (e.flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5; c.fillStyle = '#fff'; c.beginPath(); c.arc(q.x, yb, rpx, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; }
  c.restore();
  if (e.shield && Math.abs(e.x - G.lead.x) < 1.6 && e.z - G.P < RANGE) { // frontal shield glint
    c.save(); c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8); strokeP(c, P.ell(q.x, yb, rpx * 1.2, rpx * 1.25), '#9fd0ff', Math.max(2, rpx * 0.12)); c.restore();
  }
  if (e.kind === 'brute' && e.look === 'oni' && (e.t % 3) < 0.7) for (let i = 0; i < 3; i++) line(c, q.x + rand(-rpx, rpx), yb - rpx - i * 6, q.x + rand(-rpx, rpx), yb - rpx - 14 - i * 6, 'rgba(255,220,220,0.6)', 2);
  if (!e.inv && rpx > 5) bigText(c, fmtHP(e.hp), q.x, yb - rpx * 1.35, clamp(rpx * 0.95, 9, 34), e.elite ? '#ffd23d' : '#ffffff', { maxW: Math.max(30, rpx * 3) });
}
function drawBaseW(c, t) {
  const z = G.base ? G.base.z : G.Lr + 16;
  const q = proj(0, z);
  const W = 13 * q.s;
  if (G.boss && G.base) {
    const b = G.boss;
    c.save(); c.translate(q.x, q.y - W * 0.12);
    drawBoss(c, { ...b, wind: b.zone ? b.wind : 0, hp: G.base.hp, maxHp: G.base.max }, t, W);
    c.restore();
    bigText(c, fmtHP(Math.max(0, G.base.hp)), q.x, q.y - W * 0.62, clamp(W * 0.1, 14, 46), '#ffffff', { maxW: W * 0.7 });
    return;
  }
  if (isStageBoss(G.level) && !G.base) return; // the boss arrives with the assault
  const B = G.base;
  const dmg = B ? 1 - B.hp / B.max : 0;
  drawBase(c, q.x, q.y, W, STAGES[G.stage - 1].pal, t, dmg, B ? Math.max(0, B.hp) : G.baseMax, B ? B.shake : 0);
}
function drawTracers(c) {
  for (const tr of G.tracers) {
    const a = proj(tr.x0, tr.z0, tr.y0 != null ? tr.y0 : 0.8), b = proj(tr.x1, tr.z1, tr.y1 != null ? tr.y1 : 0.7);
    c.strokeStyle = tr.enemy ? 'rgba(255,90,90,0.9)' : 'rgba(255,240,170,0.95)'; c.lineWidth = tr.enemy ? 1.5 : 2;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(lerp(a.x, b.x, 0.85), lerp(a.y, b.y, 0.85)); c.stroke();
    if (!tr.enemy && tr.t > 0.06) { c.fillStyle = '#fff2a0'; c.beginPath(); c.arc(a.x, a.y, Math.max(2, a.s * 0.12), 0, TAU); c.fill(); }
  }
}
function drawSquad(c, t) {
  const skin = skinById(Store.d.skin);
  const after = skin.fx.includes('after') && Math.abs(G.lead.vx) > 2;
  const bodies = G.bodies.slice().sort((a, b) => b.oz - a.oz); // front rows first (farther)
  const run = G.phase === 'run';
  for (const b of bodies) {
    const q = proj(b.x, G.P + b.oz);
    const k = 0.95 * q.s / 68 * (1 + b.pop * 0.25);
    const fr = run ? Math.floor(b.frame) % 4 : 0;
    if (after) { c.globalAlpha = 0.25; drawSpr(c, soldierSprite(skin, fr, 60, true), q.x - G.lead.vx * 0.04 * q.s, q.y - 34 * k, k); c.globalAlpha = 1; }
    drawSpr(c, soldierSprite(skin, fr, 60, true), q.x, q.y - 34 * k, k);
  }
  // Kai leads from the front
  const lq = proj(G.lead.x, G.P);
  c.save(); c.translate(lq.x, lq.y); drawKaiBack(c, 1.05 * lq.s / 56, t, run ? Math.floor(G.runFrame || 0) : 0, G.lead.vx); c.restore();
  // the count: large, above the formation
  const top = proj(G.lead.x, G.P + 0.8, 4.4);
  const px = 44 * (1 + (G.punch || 0) * 0.45);
  bigText(c, fmtInt(G.N), top.x, top.y, px, G.punch > 0.3 ? '#fff7c2' : '#ffffff', { lw: 8 });
  bigText(c, 'HIT ' + fmtInt(volley(G.phase === 'assault')), top.x, top.y + px * 0.62, 13, '#ffe58a', { lw: 3.5 });
}
function drawWorldParts(c) {
  for (const p of G.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === 'spark') { const q = proj(p.x, p.z, p.y); c.globalAlpha = a; c.fillStyle = p.col; const s = Math.max(1.5, p.size * q.s); c.fillRect(q.x - s / 2, q.y - s / 2, s, s); }
    else if (p.kind === 'puff') { const q = proj(p.x, p.z, p.y); c.globalAlpha = a * 0.8; c.fillStyle = p.col; c.beginPath(); c.arc(q.x, q.y, Math.max(2, p.size * q.s * (1.6 - a * 0.6)), 0, TAU); c.fill(); }
    else if (p.kind === 'fall') { const q = proj(p.x, p.z, p.y); c.globalAlpha = a; c.fillStyle = 'rgba(220,220,220,0.9)'; c.beginPath(); c.arc(q.x, q.y - q.s * 0.6, Math.max(3, q.s * 0.35 * (1.5 - a)), 0, TAU); c.fill(); }
    else if (p.kind === 'coinfly') { const q = proj(p.x, p.z, p.y); c.globalAlpha = a; iconCoin(c, q.x, q.y, Math.max(3, q.s * 0.25)); }
  }
  c.globalAlpha = 1;
}
function drawWorldTexts(c) {
  for (const tx of G.texts) {
    const q = proj(tx.x, tx.z, tx.y);
    const age = tx.max - tx.life;
    const sc = age < 0.12 ? 0.5 + age / 0.12 * 0.7 : 1.2 - Math.min(0.2, (age - 0.12));
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
  // coins + gems on the right
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
  // progress bar, or the assault timer
  const bx = p.x + p.w + 14, bw = cx - 30 - bx, by = y - 6;
  if (G.phase === 'run' || !G.base) {
    const k = clamp(G.P / G.Lr, 0, 1);
    cel(c, P.rr(bx, by, bw, 12, 6), '#14141f', null, null, 2.5);
    flat(c, P.rr(bx + 2, by + 2, Math.max(8, (bw - 4) * k), 8, 4), STAGES[G.stage - 1].pal.accent, 0);
    for (const g of G.gates) { const gx = bx + bw * clamp(g.z / G.Lr, 0, 1); c.fillStyle = g.done ? 'rgba(255,255,255,0.35)' : '#ffffff'; c.fillRect(gx - 1, by + 2, 2, 8); }
    // flag at the end
    line(c, bx + bw, by - 10, bx + bw, by + 12, INK, 3);
    flat(c, P.poly([bx + bw, by - 10, bx + bw + 14, by - 5, bx + bw, by]), '#ff3b5c', 2);
    bigText(c, 'LV ' + G.level, bx, by + 24, 13, '#ffffff', { align: 'left', font: dispFont(13), lw: 3 });
  } else {
    const B = G.base, k = clamp(B.timer / G.timerMax, 0, 1);
    const hot = B.timer < 5;
    cel(c, P.rr(bx, by - 2, bw, 16, 8), '#14141f', null, null, 2.5);
    flat(c, P.rr(bx + 2, by, Math.max(8, (bw - 4) * k), 12, 6), hot ? '#ff3b5c' : '#ffd23d', 0);
    bigText(c, Math.max(0, B.timer).toFixed(1), bx + bw / 2, by + 28, hot ? 26 + Math.sin(t * 20) * 2 : 22, hot ? '#ff9aa9' : '#ffffff');
  }
  // streak + buffs under the bar
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
    if (b.sub) bigText(c, b.sub, V.cx, y + 22, 14, '#ffffff', { font: dispFont(14), lw: 3 });
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
    bigText(c, n.name, lerp(V.w * 1.5, V.cx, inK), y - 8, 36, '#ffffff', { font: dispFont(36), lw: 7, maxW: V.w - 24 });
    bigText(c, n.sub, lerp(-V.w, V.cx, inK), y + 32, 14, '#ff9aa9', { font: dispFont(14), lw: 3, maxW: V.w - 24 });
    c.restore();
  }
}

function drawTutorialHand(c, t) {
  const T = G.tut; if (!T || G.mode !== 'play') return;
  const lq = proj(G.lead.x, G.P);
  if (T.step === 0 && G.lt < 6.5) {
    const ph = Math.sin(t * 2.6);
    drawHand(c, V.cx + ph * 70, lq.y + 60, true);
  } else if (T.step === 3) {
    const d = G.picks.find(p => p.kind === 'debuff');
    if (d) {
      const dir = d.x > 0 ? -1 : 1;
      const ph = (t % 1.2) / 1.2;
      drawHand(c, lq.x + dir * ph * 90, lq.y + 60, true);
    }
  }
}
