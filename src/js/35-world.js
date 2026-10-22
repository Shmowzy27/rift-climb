// ============================================================================
// WORLD ART: squad soldiers, Kai from behind, gates, pickups, barricades, base
// ============================================================================

const KAI_LOOK = { id: 'kai', gi: '#2b3350', giS: '#1a2036', trim: '#c4182d', hair: '#1d1b26', hairS: '#0e0d14', skin: '#f2c9a0', fx: ['cape'], cape: '#c4182d' };
const OP_COLORS = { add: '#3d9bff', mul: '#22c9a0', sub: '#ff4a5c', div: '#ff8a2e', cmp: '#a55bff' };
const gateColor = g => (g.ops.length > 1 ? OP_COLORS.cmp : OP_COLORS[g.ops[0].k]);

// ---------------------------------------------------------------------------
// Soldier: ~48px tall at s=1, feet at (0,0). back=true for the chase camera.
// ---------------------------------------------------------------------------
function drawSoldier(c, skin, s, back, frame) {
  const fx = new Set(skin.fx);
  const lw = 2.2 * s;
  const ph = (frame || 0) * Math.PI / 2;
  const sw = Math.sin(ph) * 4 * s;
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 0, 11 * s, 3 * s, 0, 0, TAU); c.fill();
  // wings / cape behind the body (from the back they sit in front, so drawn later)
  const legC = shade(skin.c2, -0.25);
  // legs
  for (const [sd, off] of [[-1, sw], [1, -sw]]) {
    cel(c, P.rr(sd * 4.5 * s - 3.5 * s, -14 * s - Math.max(0, off) * 0.3, 7 * s, 13 * s + Math.max(0, off) * 0.3, 2.5 * s), legC, shade(legC, -0.35), shade(legC, 0.3), lw, 1.6 * s);
    flat(c, P.ell(sd * 4.5 * s, -1.2 * s - Math.max(0, off) * 0.4, 4.4 * s, 2.2 * s), '#1a1720', lw * 0.7);
  }
  // torso
  const torso = P.poly([-9 * s, -31 * s, 9 * s, -31 * s, 10.5 * s, -13 * s, -10.5 * s, -13 * s]);
  if (!back && fx.has('wings')) for (const sd of [-1, 1]) cel(c, P.ell(sd * 12 * s, -26 * s, 9 * s, 6 * s, sd * 0.5), '#b6aedc', '#7d74a6', '#f2ecff', lw, 1.5 * s);
  cel(c, torso, skin.c, skin.c2, shade(skin.c, 0.35), lw, 2.6 * s);
  flat(c, P.rr(-10.5 * s, -16 * s, 21 * s, 3.4 * s, 1.2 * s), skin.t === '#000000' ? '#2a2a33' : shade(skin.c2, -0.3), 1.2 * s);
  if (fx.has('seams')) { c.strokeStyle = '#ff8a1f'; c.lineWidth = 1.4 * s; c.beginPath(); c.moveTo(-6 * s, -29 * s); c.lineTo(-2 * s, -22 * s); c.lineTo(-5 * s, -16 * s); c.moveTo(6 * s, -28 * s); c.lineTo(3 * s, -20 * s); c.stroke(); }
  if (fx.has('scorch')) { c.fillStyle = 'rgba(20,10,5,0.5)'; c.beginPath(); c.arc(4 * s, -22 * s, 3 * s, 0, TAU); c.arc(-5 * s, -18 * s, 2 * s, 0, TAU); c.fill(); }
  if (fx.has('kelp')) { c.strokeStyle = '#3fbf7a'; c.lineWidth = 1.6 * s; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 5 * s, -31 * s); c.quadraticCurveTo(i * 5 * s + 3 * s, -22 * s, i * 5 * s - 1 * s, -12 * s); c.stroke(); } }
  // arms + rifle
  for (const sd of [-1, 1]) {
    c.beginPath(); c.moveTo(sd * 8.5 * s, -29 * s); c.lineTo(sd * 10 * s + (back ? 0 : 0), -19 * s);
    c.strokeStyle = INK; c.lineWidth = 6.5 * s; c.lineCap = 'round'; c.stroke(); c.strokeStyle = skin.c; c.lineWidth = 3.6 * s; c.stroke();
  }
  if (back) {
    // backpack
    cel(c, P.rr(-7 * s, -30 * s, 14 * s, 13 * s, 3 * s), shade(skin.c2, -0.1), shade(skin.c2, -0.4), shade(skin.c, 0.2), lw, 1.6 * s);
    line(c, -4 * s, -30 * s, -4 * s, -17 * s, skin.t, 1.4 * s);
    // rifle barrel poking up past the shoulder
    line(c, 7 * s, -22 * s, 12 * s, -40 * s, INK, 4 * s); line(c, 7 * s, -22 * s, 12 * s, -40 * s, '#3a3a44', 2 * s);
  } else {
    line(c, -9 * s, -18 * s, 9 * s, -24 * s, INK, 4.4 * s); line(c, -9 * s, -18 * s, 9 * s, -24 * s, '#3a3a44', 2.2 * s);
  }
  if (fx.has('lantern') && back) {
    c.fillStyle = 'rgba(255,200,100,0.35)'; c.beginPath(); c.arc(-5 * s, -15 * s, 7 * s, 0, TAU); c.fill();
    cel(c, P.rr(-8 * s, -19 * s, 6 * s, 7 * s, 2 * s), '#ffcf6b', '#e08a2a', '#fff3c8', 1.4 * s, 1 * s);
  }
  if (fx.has('cape') && back) cel(c, P.poly([-9 * s, -31 * s, 9 * s, -31 * s, 12 * s, -10 * s, 0, -12 * s, -12 * s, -10 * s]), '#c4182d', '#7a0d1b', '#ff6b7d', lw, 2 * s);
  if (fx.has('chain')) for (let i = 0; i < 3; i++) strokeP(c, P.ell(10 * s, -17 * s + i * 3 * s, 1.4 * s, 2 * s), '#8f8f99', 1.1 * s);
  if (fx.has('wings') && back) for (const sd of [-1, 1]) { cel(c, P.ell(sd * 9 * s, -24 * s, 8 * s, 11 * s, sd * 0.4), '#b6aedc', '#7d74a6', '#f2ecff', lw, 1.5 * s); flat(c, P.circ(sd * 9 * s, -24 * s, 2.4 * s), '#f2e7c9', 1 * s); }
  if (fx.has('banner') && back) { line(c, -6 * s, -28 * s, -6 * s, -52 * s, '#5a3a1e', 1.8 * s); flat(c, P.poly([-6 * s, -52 * s, 6 * s, -49 * s, -6 * s, -44 * s]), '#c4182d', 1.2 * s); }
  // head + helmet
  cel(c, P.circ(0, -37 * s, 7 * s), '#f2c9a0', '#c99a73', '#fff1de', lw, 1.8 * s);
  if (!back) {
    flat(c, P.ell(-2.6 * s, -36 * s, 1.3 * s, 1.8 * s), INK, 0); flat(c, P.ell(2.6 * s, -36 * s, 1.3 * s, 1.8 * s), INK, 0);
  }
  const helm = c2 => { c2.moveTo(-9 * s, -36 * s); c2.bezierCurveTo(-9 * s, -48 * s, 9 * s, -48 * s, 9 * s, -36 * s); c2.lineTo(10 * s, -34.5 * s); c2.lineTo(-10 * s, -34.5 * s); c2.closePath(); };
  cel(c, helm, skin.h, shade(skin.h, -0.35), shade(skin.h, 0.45), lw, 2 * s);
  if (fx.has('dent')) flat(c, P.ell(3 * s, -43 * s, 2 * s, 1.2 * s), shade(skin.h, -0.4), 0);
  if (fx.has('goggles')) { flat(c, P.rr(-7 * s, -42 * s, 14 * s, 3.2 * s, 1.5 * s), '#2a2a33', 0); if (!back) { flat(c, P.circ(-3 * s, -40.5 * s, 2 * s), '#6bf0ff', 1); flat(c, P.circ(3 * s, -40.5 * s, 2 * s), '#6bf0ff', 1); } }
  if (fx.has('antenna')) for (const sd of [-1, 1]) { line(c, sd * 4 * s, -45 * s, sd * 7 * s, -54 * s, '#3a3a44', 1.2 * s); flat(c, P.circ(sd * 7 * s, -54 * s, 1.6 * s), '#ffe14d', 0.8 * s); }
  if (fx.has('halfvoid')) {
    c.save(); c.beginPath(); c.rect(0, -60 * s, 20 * s, 62 * s); c.clip();
    flat(c, torso, '#05040a', lw); flat(c, helm, '#05040a', lw); flat(c, P.circ(0, -37 * s, 7 * s), '#05040a', 0);
    c.restore();
    line(c, 0, -48 * s, 0, -12 * s, '#ffffff', 0.9 * s);
  }
  if (fx.has('glitch')) {
    c.save(); c.globalAlpha = 0.75;
    strokeP(c, torso, '#2bf0ff', 1.2 * s); c.translate(1.5 * s, -1 * s); strokeP(c, helm, '#ff2bd6', 1.2 * s);
    c.restore();
  }
}
function soldierSprite(skin, frame, S, back) {
  return sprite('sol' + skin.id + frame + (back ? 'b' : 'f') + Math.round(S), S * 1.4, S * 1.7, c => { c.translate(0, S * 0.75); drawSoldier(c, skin, S / 48, back, frame); });
}

// Kai from behind: the squad leader, a little bigger, red scarf streaming
function drawKaiBack(c, s, t, frame, vx) {
  const lw = 2.4 * s, sw = Math.sin(frame * Math.PI / 2) * 4.5 * s;
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 0, 13 * s, 3.5 * s, 0, 0, TAU); c.fill();
  for (const [sd, off] of [[-1, sw], [1, -sw]]) {
    cel(c, P.rr(sd * 5 * s - 4 * s, -15 * s, 8 * s, 14 * s + Math.max(0, off) * 0.3, 3 * s), '#1f2233', '#12141f', '#4a4f6b', lw, 1.6 * s);
    flat(c, P.ell(sd * 5 * s, -1.5 * s - Math.max(0, off) * 0.4, 5 * s, 2.4 * s), '#0e0d14', lw * 0.7);
  }
  cel(c, P.poly([-10.5 * s, -33 * s, 10.5 * s, -33 * s, 12 * s, -13 * s, -12 * s, -13 * s]), '#2b3350', '#1a2036', '#5a6a9a', lw, 3 * s);
  // scarf trails opposite the steering direction
  const trail = clamp(-vx * 0.03, -1, 1);
  const wave = Math.sin(t * 9) * 2 * s;
  cel(c, P.poly([-7 * s, -34 * s, 7 * s, -34 * s, 6 * s + trail * 14 * s, -20 * s + wave, 2 * s + trail * 20 * s, -10 * s - wave, -2 * s + trail * 10 * s, -22 * s]), '#c4182d', '#7a0d1b', '#ff6b7d', lw, 2 * s);
  for (const sd of [-1, 1]) {
    c.beginPath(); c.moveTo(sd * 9.5 * s, -31 * s); c.lineTo(sd * 12 * s, -20 * s);
    c.strokeStyle = INK; c.lineWidth = 7 * s; c.lineCap = 'round'; c.stroke(); c.strokeStyle = '#2b3350'; c.lineWidth = 4 * s; c.stroke();
  }
  cel(c, P.circ(0, -41 * s, 9 * s), '#f2c9a0', '#c99a73', '#fff1de', lw, 2 * s);
  // hair from behind: spikes and the single pale rift lock
  const hp = [];
  for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.95 + (i / 8) * Math.PI * 1.1; const r = (i % 2 ? 9.5 : 14) * s; hp.push(Math.cos(a) * r, -41 * s + Math.sin(a) * r); }
  hp.push(9 * s, -36 * s, 0, -33 * s, -9 * s, -36 * s);
  cel(c, P.poly(hp), '#1d1b26', '#0e0d14', '#4a4560', lw, 2 * s);
  flat(c, P.poly([-1 * s, -54 * s, 3 * s, -47 * s, 1 * s, -38 * s]), '#cfc6ff', 1.1 * s);
}

// ---------------------------------------------------------------------------
// Gates: tall translucent panels across the road, numbers huge
// ---------------------------------------------------------------------------
function drawGate(c, x0, x1, yTop, yBot, g, s, alpha, picked, result) {
  const col = gateColor(g);
  const w = x1 - x0, h = yBot - yTop;
  c.save();
  c.globalAlpha = alpha;
  // panel
  const grd = c.createLinearGradient(0, yTop, 0, yBot);
  grd.addColorStop(0, col + 'e6'); grd.addColorStop(1, col + '55');
  c.fillStyle = grd; c.fillRect(x0 + 2 * s, yTop, w - 4 * s, h);
  c.strokeStyle = picked ? '#ffffff' : shade(col, 0.5); c.lineWidth = Math.max(1.5, (picked ? 5 : 3) * s);
  c.strokeRect(x0 + 2 * s, yTop, w - 4 * s, h);
  // posts
  for (const x of [x0, x1]) { c.fillStyle = INK; c.fillRect(x - 3 * s, yTop - 6 * s, 6 * s, h + 6 * s); c.fillStyle = '#e6e8f2'; c.fillRect(x - 1.6 * s, yTop - 6 * s, 3.2 * s, h + 6 * s); }
  // label: one op, or two stacked for a compound gate
  const lines = g.label;
  // numbers stay readable from the full approach distance: never smaller than ~22px
  const natural = Math.min(w * 0.36, h * (lines.length > 1 ? 0.3 : 0.42)) * (lines.length > 1 ? 1 : 1.15);
  const px = Math.max(natural, lines.length > 1 ? 19 : 24);
  const maxW = Math.max(w * 0.9, px * 2.6);
  const cy = yTop + h * 0.46;
  if (lines.length === 1) bigText(c, lines[0], (x0 + x1) / 2, cy, px, '#ffffff', { maxW });
  else lines.forEach((l, i) => bigText(c, l, (x0 + x1) / 2, cy + (i - 0.5) * px * 1.02, px, '#ffffff', { maxW }));
  if (result != null) bigText(c, '= ' + fmtInt(result), (x0 + x1) / 2, cy + px * (lines.length > 1 ? 1.4 : 0.95), Math.max(12, px * 0.5), '#fff7c2', { maxW });
  c.restore();
}

// ---------------------------------------------------------------------------
// Pickups, coins, barricades
// ---------------------------------------------------------------------------
function pickupSprite(kind, S) {
  return sprite('pk' + kind + Math.round(S), S * 2.4, S * 2.4, c => {
    const r = S * 0.5;
    if (kind === 'buff') {
      c.shadowColor = '#5cff7a'; c.shadowBlur = r * 0.8;
      cel(c, P.circ(0, 0, r), '#3fdc5c', '#1f8a34', '#d8ffd2', r * 0.14, r * 0.2);
      c.shadowBlur = 0;
      flat(c, P.poly([-r * 0.45, -r * 0.12, -r * 0.12, -r * 0.12, -r * 0.12, -r * 0.45, r * 0.12, -r * 0.45, r * 0.12, -r * 0.12, r * 0.45, -r * 0.12, r * 0.45, r * 0.12, r * 0.12, r * 0.12, r * 0.12, r * 0.45, -r * 0.12, r * 0.45, -r * 0.12, r * 0.12, -r * 0.45, r * 0.12]), '#ffffff', r * 0.08);
    } else if (kind === 'debuff') {
      const pts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = i % 2 ? r : r * 1.3; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
      cel(c, P.poly(pts), '#e8283e', '#8c0f24', '#ffb3c1', r * 0.14, r * 0.2);
      flat(c, P.rr(-r * 0.45, -r * 0.13, r * 0.9, r * 0.26, r * 0.08), '#ffffff', r * 0.08);
    } else {
      c.shadowColor = '#ffd23d'; c.shadowBlur = r;
      cel(c, P.circ(0, 0, r), '#ffd23d', '#c9961a', '#fff7cf', r * 0.14, r * 0.22);
      c.shadowBlur = 0;
      const st = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, rr = i % 2 ? r * 0.25 : r * 0.6; st.push(Math.cos(a) * rr, Math.sin(a) * rr); }
      flat(c, P.poly(st), '#ffffff', r * 0.07);
    }
  });
}
function coinSprite(S) {
  return sprite('coin' + Math.round(S), S * 1.4, S * 1.4, c => {
    const r = S * 0.5;
    cel(c, P.ell(0, 0, r * 0.82, r), '#ffc83d', '#c48a12', '#fff3c4', r * 0.18, r * 0.22);
    strokeP(c, P.ell(0, 0, r * 0.45, r * 0.6), '#c48a12', r * 0.12);
  });
}
function drawBarricade(c, x0, x1, yTop, yBot, s, pal, hp, dmg) {
  const w = x1 - x0, h = yBot - yTop;
  // concrete blocks with hazard stripes
  cel(c, P.rr(x0, yTop, w, h, 4 * s), '#9a9488', '#6a645a', '#d8d2c4', Math.max(1.5, 3 * s), 3 * s);
  c.save(); c.beginPath(); c.rect(x0 + 2, yTop + h * 0.15, w - 4, h * 0.22); c.clip();
  for (let x = x0 - h; x < x1 + h; x += 16 * s) { c.fillStyle = '#ffc83d'; c.beginPath(); c.moveTo(x, yTop + h * 0.15); c.lineTo(x + 8 * s, yTop + h * 0.15); c.lineTo(x + 8 * s - h * 0.22, yTop + h * 0.37); c.lineTo(x - h * 0.22, yTop + h * 0.37); c.fill(); }
  c.restore();
  if (dmg > 0.3) { c.strokeStyle = INK; c.lineWidth = Math.max(1, 1.5 * s); c.beginPath(); c.moveTo(x0 + w * 0.3, yTop); c.lineTo(x0 + w * 0.36, yTop + h * 0.5); c.lineTo(x0 + w * 0.3, yBot); if (dmg > 0.6) { c.moveTo(x0 + w * 0.7, yTop); c.lineTo(x0 + w * 0.64, yTop + h * 0.6); } c.stroke(); }
  bigText(c, fmtInt(hp), (x0 + x1) / 2, yTop + h * 0.66, Math.min(h * 0.5, w * 0.3), '#ffffff', { maxW: w * 0.9 });
}

// ---------------------------------------------------------------------------
// Enemy base: a walled compound with one big HP number
// ---------------------------------------------------------------------------
function drawBase(c, cx, by, W, pal, t, dmg, hp, shake) {
  const s = W / 300;
  const lw = Math.max(1.5, 3 * s);
  c.save(); c.translate(cx + (shake ? rand(-shake, shake) : 0), by);
  const wallH = 70 * s, wallW = 300 * s;
  // back towers
  for (const sd of [-1, 1]) {
    cel(c, P.rr(sd * 120 * s - 26 * s, -wallH - 60 * s, 52 * s, wallH + 60 * s, 4 * s), '#5a5560', '#3a3640', '#8a8590', lw, 4 * s);
    for (let i = 0; i < 3; i++) flat(c, P.rr(sd * 120 * s - 24 * s + i * 18 * s, -wallH - 72 * s, 12 * s, 14 * s, 2 * s), '#5a5560', lw * 0.8);
    flat(c, P.rr(sd * 120 * s - 6 * s, -wallH - 40 * s, 12 * s, 18 * s, 2 * s), '#1a1720', 0);
    // banner
    flat(c, P.poly([sd * 120 * s - 4 * s, -wallH - 110 * s, sd * 120 * s + 22 * s * sd, -wallH - 102 * s + Math.sin(t * 4 + sd) * 3 * s, sd * 120 * s - 4 * s, -wallH - 94 * s]), pal.accent, lw * 0.6);
    line(c, sd * 120 * s - 4 * s, -wallH - 110 * s, sd * 120 * s - 4 * s, -wallH - 70 * s, INK, 2 * s);
  }
  // wall
  cel(c, P.rr(-wallW / 2, -wallH, wallW, wallH, 3 * s), '#6e6874', '#4a4550', '#a8a2ae', lw, 5 * s);
  for (let i = 0; i < 12; i++) flat(c, P.rr(-wallW / 2 + i * 25.5 * s, -wallH - 12 * s, 14 * s, 13 * s, 2 * s), '#6e6874', lw * 0.8);
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5 * s;
  for (let y = 1; y < 4; y++) { c.beginPath(); c.moveTo(-wallW / 2, -wallH + y * wallH / 4); c.lineTo(wallW / 2, -wallH + y * wallH / 4); c.stroke(); }
  // gate
  cel(c, P.rr(-34 * s, -54 * s, 68 * s, 54 * s, 26 * s), '#3a2416', '#24160c', '#6a4a30', lw, 3 * s);
  for (let i = -2; i <= 2; i++) line(c, i * 12 * s, -50 * s, i * 12 * s, 0, '#24160c', 2 * s);
  // defenders on the wall, firing
  for (let i = 0; i < 7; i++) {
    const x = -wallW / 2 + 22 * s + i * 43 * s;
    flat(c, P.circ(x, -wallH - 18 * s, 5 * s), '#2a2030', lw * 0.6);
    flat(c, P.rr(x - 5 * s, -wallH - 14 * s, 10 * s, 8 * s, 2 * s), '#2a2030', 0);
    if ((Math.floor(t * 6) + i) % 4 === 0) flat(c, P.circ(x, -wallH - 6 * s, 4 * s), '#ffd23d', 0);
  }
  // cracks with damage
  if (dmg > 0.2) {
    c.strokeStyle = INK; c.lineWidth = 2.5 * s; c.beginPath();
    const n = Math.floor(dmg * 8);
    for (let i = 0; i < n; i++) { const x = -wallW / 2 + ((i * 97) % 280) * s + 10 * s; c.moveTo(x, -wallH); c.lineTo(x + 8 * s, -wallH + 22 * s); c.lineTo(x - 4 * s, -wallH + 44 * s); }
    c.stroke();
  }
  // HP plate
  const ph = 46 * s;
  cel(c, P.rr(-90 * s, -wallH - 168 * s, 180 * s, ph, 10 * s), '#14141f', '#0a0a12', '#3a3a55', lw, 3 * s);
  bigText(c, fmtHP(hp), 0, -wallH - 168 * s + ph / 2, 38 * s, dmg > 0.75 ? '#ff9aa9' : '#ffffff', { maxW: 168 * s });
  c.restore();
}
