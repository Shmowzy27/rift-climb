// ============================================================================
// ART: cel-shaded canvas drawing. Hard color blocks, thick dark outlines, one
// rim light. Everything is code-drawn; sprites are cached per size.
// ============================================================================

const INK = '#0b0b14';
const FONT_NUM = '"DIN Condensed","DINCondensed-Bold","Avenir Next Condensed","Arial Narrow",Impact,sans-serif';
const FONT_DISP = '"Avenir Next Condensed","AvenirNextCondensed-Heavy","Futura","Arial Narrow",Impact,sans-serif';
let DPR = 1;

// ---- path builders (each starts with moveTo so they compose with rect()) ----
const P = {
  circ: (x, y, r) => c => { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); },
  ell: (x, y, rx, ry, rot) => c => { rot = rot || 0; c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); c.ellipse(x, y, rx, ry, rot, 0, TAU); },
  rr: (x, y, w, h, r) => c => {
    r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
  },
  poly: pts => c => { c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); },
  multi: (...fns) => c => { for (const f of fns) f(c); },
};

// Cel shading: base fill, lower-right hard shade, upper-left rim light, ink outline.
function cel(c, path, base, shade, rim, lw, d) {
  d = d == null ? 3 : d;
  c.save();
  c.beginPath(); path(c); c.clip();
  if (rim) { c.fillStyle = rim; c.fillRect(-3000, -3000, 6000, 6000); }
  const e = rim ? d * 0.5 : 0;
  c.beginPath(); c.translate(e, e); path(c); c.translate(-e, -e); c.fillStyle = base; c.fill();
  if (shade) {
    c.beginPath(); c.rect(-3000, -3000, 6000, 6000); c.translate(-d, -d); path(c); c.translate(d, d);
    c.fillStyle = shade; c.fill('evenodd');
  }
  c.restore();
  if (lw) { c.beginPath(); path(c); c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
}
function flat(c, path, fill, lw) {
  c.beginPath(); path(c); c.fillStyle = fill; c.fill();
  if (lw) { c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); }
}
function strokeP(c, path, color, lw) { c.beginPath(); path(c); c.lineWidth = lw; c.strokeStyle = color; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
function line(c, x1, y1, x2, y2, color, lw) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.stroke(); }

// ---- text: heavy outline + hard drop shadow ----
function numFont(px) { return `700 ${px}px ${FONT_NUM}`; }
function dispFont(px) { return `italic 800 ${px}px ${FONT_DISP}`; }
function bigText(c, text, x, y, px, fill, o) {
  o = o || {};
  text = String(text);
  c.font = o.font || numFont(px);
  if (o.maxW) {
    const w = c.measureText(text).width;
    if (w > o.maxW) { px = px * o.maxW / w; c.font = o.font ? o.font.replace(/\d+(\.\d+)?px/, px.toFixed(1) + 'px') : numFont(px); }
  }
  c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
  const lw = o.lw || Math.max(2.5, px * 0.2);
  const dy = o.font ? 0 : px * 0.07; // DIN sits high
  c.lineJoin = 'round'; c.miterLimit = 2;
  c.strokeStyle = o.ink || INK; c.fillStyle = o.ink || INK; c.lineWidth = lw;
  if (o.shadow !== false) { const s = px * 0.07; c.strokeText(text, x + s, y + dy + s * 1.2); c.fillText(text, x + s, y + dy + s * 1.2); }
  c.strokeText(text, x, y + dy);
  c.fillStyle = fill; c.fillText(text, x, y + dy);
  return px;
}

// ---- sprite cache ----
const SPR = new Map();
function sprite(key, w, h, draw) {
  let s = SPR.get(key);
  if (s) return s;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * DPR)); cv.height = Math.max(1, Math.ceil(h * DPR));
  const c = cv.getContext('2d');
  c.scale(DPR, DPR); c.translate(w / 2, h / 2);
  draw(c);
  s = { cv, w, h };
  SPR.set(key, s);
  return s;
}
function drawSpr(c, s, x, y, sx, sy, rot) {
  c.save(); c.translate(x, y);
  if (rot) c.rotate(rot);
  if (sx != null) c.scale(sx, sy == null ? sx : sy);
  c.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h);
  c.restore();
}

// ---- common bits ----
function animeEye(c, x, y, s, iris, look, sleepy) {
  // tall eye with highlight; look = horizontal offset
  flat(c, P.ell(x, y, 2.6 * s, 3.6 * s), '#ffffff', 0);
  flat(c, P.ell(x + look * s, y + 0.4 * s, 1.9 * s, 2.9 * s), iris, 0);
  flat(c, P.ell(x + look * s, y + 0.8 * s, 1.1 * s, 1.8 * s), INK, 0);
  flat(c, P.circ(x + look * s - 0.7 * s, y - 1 * s, 0.75 * s), '#ffffff', 0);
  c.beginPath(); c.moveTo(x - 3 * s, y - 3.4 * s); c.quadraticCurveTo(x, y - 4.8 * s, x + 3 * s, y - 3.2 * s);
  c.strokeStyle = INK; c.lineWidth = 1.6 * s; c.lineCap = 'round'; c.stroke();
  if (sleepy) {
    flat(c, P.rr(x - 3 * s, y - 4.2 * s, 6 * s, 3.8 * s, 1 * s), sleepy, 0);
    line(c, x - 3 * s, y - 0.4 * s, x + 3 * s, y - 0.4 * s, INK, 1.4 * s);
  }
}

// ============================================================================
// KAI
// o: { t, walk, lean, slam, face, rift, speed }   feet at (0,0), ~56px tall at s=1
// ============================================================================
function drawKai(c, skin, o, s) {
  s = s || 1;
  const fx = new Set(skin.fx);
  const t = o.t || 0, face = o.face || 1, lean = clamp(o.lean || 0, -1, 1);
  const walk = o.walk || 0, slam = o.slam || 0;
  const lw = 2.4 * s;
  const bob = Math.abs(Math.sin(walk)) * 1.6 * s;
  c.save();
  // ground shadow
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 0, 16 * s, 4 * s, 0, 0, TAU); c.fill();
  // slam crouch
  const crouch = slam > 0 ? Math.sin(Math.min(1, slam) * Math.PI) * 6 * s : 0;
  c.translate(0, -bob + crouch);
  c.rotate(lean * 0.12);
  const hx = 0, hy = -40 * s;
  const skinC = skin.skin, skinS = '#c99a73', skinR = '#fff1de';

  // ----- behind the body -----
  if (fx.has('wings')) {
    const flap = Math.sin(t * 3) * 0.15;
    for (const sd of [-1, 1]) {
      c.save(); c.translate(sd * 4 * s, -28 * s); c.rotate(sd * (0.5 + flap));
      cel(c, P.ell(sd * 13 * s, -2 * s, 14 * s, 9 * s, sd * 0.3), '#b6aedc', '#7d74a6', '#f2ecff', lw, 2.5 * s);
      flat(c, P.circ(sd * 15 * s, -3 * s, 3.4 * s), '#f2e7c9', 1.4 * s);
      flat(c, P.circ(sd * 15 * s, -3 * s, 1.4 * s), INK, 0);
      c.restore();
    }
  }
  if (fx.has('cape') || fx.has('kelp')) {
    const col = fx.has('kelp') ? '#1f7a5a' : skin.cape || '#c4182d';
    const sh = fx.has('kelp') ? '#0f4a36' : '#7a0d1b';
    const sway = Math.sin(t * 4 + walk) * 3 * s - lean * 8 * s;
    const pts = [-9 * s, -30 * s, 9 * s, -30 * s, 13 * s + sway, -2 * s, 6 * s + sway, 1 * s, 0 + sway, -3 * s, -6 * s + sway, 1 * s, -13 * s + sway, -2 * s];
    cel(c, P.poly(pts), col, sh, fx.has('kelp') ? '#7df0c0' : '#ff6b7d', lw, 3 * s);
  }
  if (fx.has('sheath')) {
    c.save(); c.translate(0, -26 * s); c.rotate(-0.7 * face);
    cel(c, P.rr(-2.2 * s, -22 * s, 4.4 * s, 34 * s, 2 * s), '#3a2a24', '#1e1512', '#7a5c50', lw, 1.5 * s);
    flat(c, P.rr(-3 * s, -24 * s, 6 * s, 5 * s, 1 * s), '#d8c38a', 1.6 * s);
    c.restore();
  }
  if (fx.has('lantern')) {
    const sw = Math.sin(t * 2.5) * 0.15;
    line(c, -8 * s * face, -12 * s, -14 * s * face, -60 * s, '#5a3a1e', 2.4 * s);
    line(c, -8 * s * face, -12 * s, -14 * s * face, -60 * s, INK, 0.01);
    c.save(); c.translate(-14 * s * face, -60 * s); c.rotate(sw);
    line(c, 0, 0, 0, 6 * s, INK, 1.4 * s);
    c.fillStyle = 'rgba(255,190,90,0.35)'; c.beginPath(); c.arc(0, 13 * s, 12 * s, 0, TAU); c.fill();
    cel(c, P.ell(0, 13 * s, 6 * s, 7.5 * s), '#ffcf6b', '#e08a2a', '#fff3c8', lw * 0.8, 2 * s);
    c.restore();
  }

  // ----- legs -----
  const lg = Math.sin(walk) * 4 * s;
  const pants = skin.trim === '#000000' ? '#2a2a33' : shade(skin.gi, -0.15);
  for (const [sx, off] of [[-1, lg], [1, -lg]]) {
    cel(c, P.rr(sx * 5 * s - 4 * s + off * 0.3, -15 * s, 8 * s, 13 * s, 3 * s), pants, shade(pants, -0.3), shade(pants, 0.35), lw, 2 * s);
    flat(c, P.ell(sx * 5 * s + off * 0.5, -1.5 * s, 5 * s, 2.6 * s), '#1a1720', lw * 0.8);
  }

  // ----- arms (behind torso when idle) -----
  const armUp = slam > 0 && slam < 0.45;
  const fistY = armUp ? -58 * s : slam >= 0.45 && slam < 1 ? -6 * s : -18 * s + Math.sin(walk + 1) * 2 * s;
  const fistX = armUp ? 6 * s : 15 * s;
  const sleeve = fx.has('armor') ? '#f2c14e' : skin.gi;
  for (const sd of [-1, 1]) {
    c.beginPath(); c.moveTo(sd * 9 * s, -26 * s); c.lineTo(sd * fistX, fistY);
    c.strokeStyle = INK; c.lineWidth = 8 * s; c.lineCap = 'round'; c.stroke();
    c.strokeStyle = sleeve; c.lineWidth = 4.6 * s; c.stroke();
  }

  // ----- torso -----
  const torso = P.poly([-10 * s, -29 * s, 10 * s, -29 * s, 12 * s, -13 * s, -12 * s, -13 * s]);
  cel(c, torso, skin.gi, skin.giS, shade(skin.gi, 0.4), lw, 3 * s);
  if (fx.has('armor')) {
    cel(c, P.ell(-10 * s, -27 * s, 6 * s, 4 * s), '#f2c14e', '#b5862a', '#fff2c2', lw * 0.8, 1.5 * s);
    cel(c, P.ell(10 * s, -27 * s, 6 * s, 4 * s), '#f2c14e', '#b5862a', '#fff2c2', lw * 0.8, 1.5 * s);
  }
  // lapel V
  c.beginPath(); c.moveTo(-6 * s, -29 * s); c.lineTo(0, -19 * s); c.lineTo(6 * s, -29 * s);
  c.strokeStyle = INK; c.lineWidth = 1.6 * s; c.stroke();
  // belt
  flat(c, P.rr(-12 * s, -16.5 * s, 24 * s, 4.5 * s, 1.5 * s), skin.trim, 1.6 * s);
  if (fx.has('bag')) {
    line(c, -9 * s, -29 * s, 9 * s, -14 * s, '#3d2a1a', 2.6 * s);
    cel(c, P.rr(5 * s, -17 * s, 10 * s, 8 * s, 2 * s), '#6b4a2a', '#43301b', '#a07850', lw * 0.8, 1.5 * s);
  }
  if (fx.has('core')) {
    const pulse = 0.7 + Math.sin(t * 6) * 0.3;
    c.fillStyle = `rgba(255,120,30,${0.35 * pulse})`; c.beginPath(); c.arc(0, -22 * s, 9 * s, 0, TAU); c.fill();
    cel(c, P.circ(0, -22 * s, 4 * s), '#ffb02e', '#ff5a1a', '#fff1b0', 1.6 * s, 1.2 * s);
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + t; line(c, Math.cos(a) * 4.5 * s, -22 * s + Math.sin(a) * 4.5 * s, Math.cos(a) * 7 * s, -22 * s + Math.sin(a) * 7 * s, '#ff8a1f', 1.2 * s); }
  }
  if (fx.has('daggers')) {
    for (const sd of [-1, 1]) {
      c.save(); c.translate(sd * 12 * s, -12 * s); c.rotate(sd * 0.5);
      flat(c, P.poly([0, 0, 1.6 * s, 10 * s, 0, 13 * s, -1.6 * s, 10 * s]), '#d9d4f0', 1.4 * s);
      flat(c, P.rr(-2 * s, -3 * s, 4 * s, 3 * s, 1), '#b28cff', 1.2 * s);
      c.restore();
    }
  }
  // ----- fists -----
  for (const sd of [-1, 1]) {
    const fxp = sd * fistX, fyp = fistY;
    const wrap = skin.id === 'rookie' || skin.id === 'ember' ? '#efe2c4' : skin.skin;
    cel(c, P.circ(fxp, fyp, 4.6 * s), wrap, shade(wrap, -0.3), '#ffffff', lw * 0.9, 1.5 * s);
    if (skin.id === 'rookie') line(c, fxp - 3 * s, fyp - 1 * s, fxp + 3 * s, fyp + 1 * s, '#b9a57e', 1 * s);
    if (fx.has('flamefists')) {
      for (let i = 0; i < 3; i++) {
        const ph = t * 12 + i * 2 + sd;
        const fh = (5 + Math.sin(ph) * 2) * s;
        flat(c, P.poly([fxp - 3 * s + i * 3 * s, fyp - 2 * s, fxp - 1.5 * s + i * 3 * s, fyp - 2 * s - fh, fxp + i * 3 * s - 0 * s, fyp - 2 * s]), i === 1 ? '#ffd23d' : '#ff5a1a', 0);
      }
    }
    if (fx.has('chains')) {
      for (let i = 0; i < 3; i++) strokeP(c, P.ell(fxp + sd * 1 * s, fyp + 6 * s + i * 3.4 * s, 1.6 * s, 2.2 * s), '#8f8f99', 1.2 * s);
    }
  }

  // ----- head -----
  const look = face * 0.8;
  cel(c, P.circ(hx, hy, 12.5 * s), skinC, skinS, skinR, lw, 3 * s);
  // hair
  if (!fx.has('bald')) {
    const sp = fx.has('spiky') || fx.has('static') ? 1.5 : 1;
    const hp = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const r1 = 13.5 * s, r2 = (17 + (i % 2 === 0 ? 4 * sp : 0)) * s;
      hp.push(hx + Math.cos(a) * (i % 2 ? r1 : r2), hy + Math.sin(a) * (i % 2 ? r1 : r2) - 1 * s);
    }
    hp.push(hx + 13 * s, hy + 1 * s, hx + 9 * s, hy - 6 * s, hx + 2 * s, hy - 4 * s, hx - 4 * s, hy - 7 * s, hx - 10 * s, hy - 3 * s, hx - 13 * s, hy + 2 * s);
    cel(c, P.poly(hp), skin.hair, skin.hairS, shade(skin.hair, 0.45), lw, 2.5 * s);
    // the rift streak: a single pale lock
    flat(c, P.poly([hx - 3 * s, hy - 13 * s, hx + 1 * s, hy - 19 * s, hx + 2 * s, hy - 6 * s]), '#cfc6ff', 1.2 * s);
  } else {
    flat(c, P.circ(hx, hy - 12 * s, 3 * s), skin.hair, 1.4 * s);
  }
  if (fx.has('headband')) {
    flat(c, P.rr(hx - 13 * s, hy - 8 * s, 26 * s, 4.5 * s, 1.5 * s), skin.band, 1.6 * s);
    const tw = Math.sin(t * 8) * 2 * s;
    flat(c, P.poly([hx - 12 * s * face, hy - 6 * s, hx - 24 * s * face, hy - 9 * s + tw, hx - 22 * s * face, hy - 3 * s + tw]), skin.band, 1.4 * s);
  }
  if (fx.has('goggles')) {
    flat(c, P.rr(hx - 13 * s, hy - 11 * s, 26 * s, 4 * s, 2 * s), '#2a2a33', 1.2 * s);
    cel(c, P.circ(hx - 5 * s, hy - 10 * s, 3.8 * s), '#6bf0ff', '#2a9fb3', '#ffffff', 1.6 * s, 1 * s);
    cel(c, P.circ(hx + 5 * s, hy - 10 * s, 3.8 * s), '#6bf0ff', '#2a9fb3', '#ffffff', 1.6 * s, 1 * s);
  }
  // eyes
  const sleepy = fx.has('sleepy') ? skinC : null;
  const iris = fx.has('halfvoid') ? '#9c8cff' : fx.has('glitch') ? '#ff2bd6' : '#3a2a5e';
  animeEye(c, hx - 4.5 * s + look, hy + 1 * s, s, iris, face * 0.5, sleepy);
  animeEye(c, hx + 4.5 * s + look, hy + 1 * s, s, iris, face * 0.5, sleepy);
  line(c, hx - 1.5 * s + look, hy + 7 * s, hx + 1.5 * s + look, hy + 7 * s, INK, 1.3 * s);
  // rift marks: Kai becomes a little more like the things he fights
  const rift = o.rift || 0;
  if (rift > 0.02) {
    c.save(); c.globalAlpha = 0.5 + rift * 0.5;
    c.strokeStyle = '#c9bfff'; c.lineWidth = 1.2 * s; c.lineCap = 'round';
    c.beginPath();
    const L = 3 + rift * 9;
    c.moveTo(hx - 9 * s, hy + 2 * s); c.lineTo(hx - 7 * s, hy + 2 * s + L * 0.3 * s); c.lineTo(hx - 10 * s, hy + 2 * s + L * 0.6 * s);
    if (rift > 0.4) { c.moveTo(-9 * s, -26 * s); c.lineTo(-6 * s, -22 * s); c.lineTo(-9 * s, -18 * s); }
    c.stroke(); c.restore();
  }
  if (fx.has('crown')) {
    const cb = Math.sin(t * 2.5) * 2 * s;
    cel(c, P.poly([hx - 9 * s, hy - 24 * s + cb, hx - 9 * s, hy - 32 * s + cb, hx - 4.5 * s, hy - 27 * s + cb, hx, hy - 34 * s + cb, hx + 4.5 * s, hy - 27 * s + cb, hx + 9 * s, hy - 32 * s + cb, hx + 9 * s, hy - 24 * s + cb]), '#ffd23d', '#c9961a', '#fff7cf', lw * 0.8, 1.5 * s);
  }
  if (fx.has('halfvoid')) {
    c.save(); c.beginPath(); c.rect(0, -80 * s, 40 * s, 82 * s); c.clip();
    flat(c, torso, '#05040a', lw);
    flat(c, P.circ(hx, hy, 12.5 * s), '#05040a', lw);
    c.restore();
    c.save(); c.strokeStyle = '#ffffff'; c.lineWidth = 1 * s;
    c.beginPath(); c.moveTo(0, -56 * s); c.lineTo(2 * s, -40 * s); c.lineTo(-1 * s, -28 * s); c.lineTo(2 * s, -14 * s); c.lineTo(0, 0); c.stroke();
    flat(c, P.circ(hx + 4.5 * s + look, hy + 1 * s, 2.2 * s), '#ffffff', 0);
    c.restore();
  }
  if (fx.has('static') && Math.sin(t * 17) > 0.2) {
    c.strokeStyle = '#fff36b'; c.lineWidth = 1.4 * s;
    for (let i = 0; i < 2; i++) {
      const a = t * 9 + i * 3;
      const r = 20 * s;
      c.beginPath(); c.moveTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r);
      c.lineTo(hx + Math.cos(a + 0.3) * (r + 5 * s), hy + Math.sin(a + 0.3) * (r - 4 * s));
      c.lineTo(hx + Math.cos(a + 0.5) * (r + 1 * s), hy + Math.sin(a + 0.5) * (r + 4 * s));
      c.stroke();
    }
  }
  if (fx.has('mist') && (t % 2.2) < 0.9) {
    const k = (t % 2.2) / 0.9;
    c.fillStyle = `rgba(230,245,255,${0.6 * (1 - k)})`;
    c.beginPath(); c.arc(hx + face * (6 + k * 8) * s, hy + 7 * s - k * 4 * s, (2 + k * 4) * s, 0, TAU); c.fill();
  }
  c.restore();
  if (fx.has('waterring')) {
    c.save(); c.strokeStyle = 'rgba(140,240,230,0.8)'; c.lineWidth = 2 * s;
    c.beginPath(); c.ellipse(0, -22 * s, 22 * s, 7 * s, 0, 0, TAU); c.stroke();
    for (let i = 0; i < 3; i++) { const a = t * 2 + i * TAU / 3; flat(c, P.circ(Math.cos(a) * 22 * s, -22 * s + Math.sin(a) * 7 * s, 2.2 * s), '#bff9f0', 1 * s); }
    c.restore();
  }
  if (fx.has('glitch')) {
    c.save(); c.globalAlpha = 0.7;
    const g = Math.sin(t * 23) > 0.6 ? 3 : 1.5;
    c.strokeStyle = '#2bf0ff'; c.lineWidth = 1.5 * s;
    c.strokeRect(-14 * s - g, -56 * s, 28 * s, 56 * s);
    c.strokeStyle = '#ff2bd6'; c.strokeRect(-14 * s + g, -56 * s + g, 28 * s, 56 * s);
    c.restore();
  }
}

// lighten (+) / darken (-) a hex color
function shade(hex, amt) {
  if (hex[0] !== '#') return hex;
  let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  const h = v => ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2);
  return '#' + h(r) + h(g) + h(b);
}

// ============================================================================
// ENEMIES
// ============================================================================
const ENEMY_LOOK = {
  slime: { c: '#36d6b5', s: '#1d8f80', r: '#c9fff2' },
  husk: { c: '#5a5a68', s: '#34343e', r: '#a9a9bb' },
  oni: { c: '#c2262e', s: '#7a1218', r: '#ff8a8f' },
  drone: { c: '#c9a24a', s: '#8a6a25', r: '#fff0b8' },
  ghost: { c: '#c06bff', s: '#7a2fd0', r: '#ffd6ff' },
  crawler: { c: '#121018', s: '#050408', r: '#ffffff' },
  runner: { c: '#7bb36a', s: '#4e7a40', r: '#d8ffcc' },
  shade: { c: '#2bf0ff', s: '#1197a6', r: '#d8fdff' },
  twin: { c: '#14121c', s: '#06050a', r: '#ffffff' },
};
function drawEnemy(c, type, r, o) {
  o = o || {};
  const L = ENEMY_LOOK[type] || ENEMY_LOOK.slime;
  const s = r / 22, lw = 2.6 * s;
  if (o.elite) { c.shadowColor = '#ffd23d'; c.shadowBlur = 12 * s; }
  switch (type) {
    case 'slime': {
      const body = c2 => { c2.moveTo(-21 * s, 14 * s); c2.bezierCurveTo(-24 * s, -8 * s, -12 * s, -22 * s, 0, -22 * s); c2.bezierCurveTo(12 * s, -22 * s, 24 * s, -8 * s, 21 * s, 14 * s); c2.quadraticCurveTo(0, 20 * s, -21 * s, 14 * s); c2.closePath(); };
      cel(c, body, L.c, L.s, L.r, lw, 4 * s);
      flat(c, P.ell(-9 * s, -12 * s, 4 * s, 2.5 * s, -0.5), 'rgba(255,255,255,0.8)', 0);
      flat(c, P.ell(-6 * s, -3 * s, 3 * s, 4.2 * s), INK, 0); flat(c, P.ell(6 * s, -3 * s, 3 * s, 4.2 * s), INK, 0);
      flat(c, P.circ(-7 * s, -5 * s, 1.2 * s), '#fff', 0); flat(c, P.circ(5 * s, -5 * s, 1.2 * s), '#fff', 0);
      flat(c, P.ell(14 * s, 15 * s, 2.5 * s, 4 * s), L.c, lw * 0.6);
      break;
    }
    case 'husk': {
      if (!o.broken) {
        cel(c, P.rr(-16 * s, -18 * s, 32 * s, 36 * s, 8 * s), L.c, L.s, L.r, lw, 3 * s);
        cel(c, P.circ(0, 4 * s, 15 * s), '#7d7f8c', '#4c4d57', '#e6e8f5', lw, 3 * s);
        strokeP(c, P.circ(0, 4 * s, 9 * s), INK, 1.6 * s);
        flat(c, P.circ(0, 4 * s, 3 * s), '#b9bccb', 1.4 * s);
      } else {
        cel(c, P.rr(-16 * s, -18 * s, 32 * s, 36 * s, 8 * s), L.c, L.s, L.r, lw, 3 * s);
        flat(c, P.poly([-12 * s, 6 * s, -2 * s, 0, -6 * s, 16 * s]), '#7d7f8c', lw * 0.7);
      }
      cel(c, P.rr(-13 * s, -27 * s, 26 * s, 16 * s, 6 * s), '#3b3b47', '#24242c', '#8b8b9e', lw, 2 * s);
      flat(c, P.rr(-9 * s, -21 * s, 18 * s, 3.4 * s, 1.5 * s), '#ff3b3b', 0);
      break;
    }
    case 'oni': {
      for (const sd of [-1, 1]) cel(c, P.poly([sd * 9 * s, -16 * s, sd * 18 * s, -32 * s, sd * 15 * s, -14 * s]), '#f2ead6', '#b8ad92', null, lw * 0.9, 1.5 * s);
      cel(c, P.ell(0, 0, 21 * s, 19 * s), L.c, L.s, L.r, lw, 4 * s);
      flat(c, P.poly([-12 * s, -6 * s, -3 * s, -3 * s, -12 * s, -2 * s]), '#ffd23d', 1.2 * s);
      flat(c, P.poly([12 * s, -6 * s, 3 * s, -3 * s, 12 * s, -2 * s]), '#ffd23d', 1.2 * s);
      flat(c, P.rr(-11 * s, 5 * s, 22 * s, 7 * s, 3 * s), INK, 0);
      flat(c, P.poly([-8 * s, 6 * s, -6 * s, 1 * s, -4 * s, 6 * s]), '#fff', 0);
      flat(c, P.poly([4 * s, 6 * s, 6 * s, 1 * s, 8 * s, 6 * s]), '#fff', 0);
      break;
    }
    case 'drone': {
      cel(c, P.circ(0, 0, 16 * s), L.c, L.s, L.r, lw, 3.5 * s);
      flat(c, P.rr(-3 * s, -24 * s, 6 * s, 8 * s, 2 * s), '#5a4a2a', lw * 0.7);
      flat(c, P.rr(-12 * s, -27 * s, 24 * s, 4 * s, 2 * s), '#8a8a95', lw * 0.7);
      c.shadowColor = '#ffb02e'; c.shadowBlur = 8 * s;
      flat(c, P.circ(0, 1 * s, 6.5 * s), '#ff9a1a', lw * 0.8);
      c.shadowBlur = 0;
      flat(c, P.circ(0, 1 * s, 2.6 * s), '#fff3c4', 0);
      break;
    }
    case 'ghost': {
      const body = c2 => { c2.moveTo(-17 * s, 18 * s); c2.lineTo(-17 * s, -4 * s); c2.bezierCurveTo(-17 * s, -26 * s, 17 * s, -26 * s, 17 * s, -4 * s); c2.lineTo(17 * s, 18 * s); c2.lineTo(11 * s, 12 * s); c2.lineTo(6 * s, 19 * s); c2.lineTo(0, 12 * s); c2.lineTo(-6 * s, 19 * s); c2.lineTo(-11 * s, 12 * s); c2.closePath(); };
      cel(c, body, L.c, L.s, '#2bf0ff', lw, 3 * s);
      c.save(); c.beginPath(); body(c); c.clip(); c.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = -24; y < 20; y += 4) c.fillRect(-20 * s, y * s, 40 * s, 1.5 * s);
      c.restore();
      flat(c, P.rr(-9 * s, -8 * s, 5 * s, 6 * s, 1), '#ffffff', 0); flat(c, P.rr(4 * s, -8 * s, 5 * s, 6 * s, 1), '#ffffff', 0);
      flat(c, P.rr(-7.5 * s, -6 * s, 2.5 * s, 3 * s, 0), INK, 0); flat(c, P.rr(5.5 * s, -6 * s, 2.5 * s, 3 * s, 0), INK, 0);
      break;
    }
    case 'crawler': {
      c.strokeStyle = '#ffffff'; c.lineWidth = 2 * s;
      for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) {
        c.beginPath(); c.moveTo(sd * 8 * s, (-4 + i * 6) * s); c.lineTo(sd * 20 * s, (-12 + i * 8) * s); c.lineTo(sd * 24 * s, (2 + i * 8) * s);
        c.strokeStyle = INK; c.lineWidth = 4 * s; c.stroke(); c.strokeStyle = '#e8e6ff'; c.lineWidth = 1.6 * s; c.stroke();
      }
      cel(c, P.ell(0, 2 * s, 14 * s, 16 * s), L.c, L.s, '#ffffff', lw, 2.5 * s);
      strokeP(c, P.ell(0, 2 * s, 14 * s, 16 * s), '#ffffff', 1.2 * s);
      c.shadowColor = '#fff'; c.shadowBlur = 6 * s;
      flat(c, P.ell(-5 * s, -4 * s, 2.6 * s, 3.4 * s), '#ffffff', 0); flat(c, P.ell(5 * s, -4 * s, 2.6 * s, 3.4 * s), '#ffffff', 0);
      c.shadowBlur = 0;
      break;
    }
    case 'runner': {
      c.shadowColor = '#ffd23d'; c.shadowBlur = 14 * s;
      cel(c, P.rr(-14 * s, -24 * s, 28 * s, 20 * s, 4 * s), '#ffc83d', '#b38a12', '#fff3c4', lw, 2.5 * s);
      c.shadowBlur = 0;
      flat(c, P.rr(-14 * s, -16 * s, 28 * s, 3.5 * s, 1), '#7a4a12', 1.4 * s);
      flat(c, P.rr(-3 * s, -18 * s, 6 * s, 7 * s, 1.5 * s), '#fff3c4', 1.4 * s);
      cel(c, P.ell(0, 6 * s, 13 * s, 12 * s), L.c, L.s, L.r, lw, 3 * s);
      for (const sd of [-1, 1]) cel(c, P.poly([sd * 9 * s, 0, sd * 22 * s, -6 * s, sd * 12 * s, 6 * s]), L.c, L.s, null, lw * 0.8, 1.5 * s);
      flat(c, P.circ(-4.5 * s, 4 * s, 2.4 * s), INK, 0); flat(c, P.circ(4.5 * s, 4 * s, 2.4 * s), INK, 0);
      flat(c, P.circ(-5 * s, 3.2 * s, 0.9 * s), '#fff', 0); flat(c, P.circ(4 * s, 3.2 * s, 0.9 * s), '#fff', 0);
      break;
    }
    case 'shade': {
      c.globalAlpha = 0.9;
      cel(c, P.poly([-13 * s, 0, 13 * s, 0, 17 * s, 20 * s, -17 * s, 20 * s]), '#0d3a44', '#06222a', '#2bf0ff', lw, 3 * s);
      cel(c, P.circ(0, -10 * s, 12 * s), '#0d3a44', '#06222a', '#2bf0ff', lw, 2.5 * s);
      strokeP(c, P.circ(0, -10 * s, 12 * s), '#2bf0ff', 1.4 * s);
      flat(c, P.rr(-7 * s, -12 * s, 4 * s, 3 * s, 1), '#2bf0ff', 0); flat(c, P.rr(3 * s, -12 * s, 4 * s, 3 * s, 1), '#2bf0ff', 0);
      c.globalAlpha = 1;
      break;
    }
    case 'hound': { // leaper: long-legged, low to the ground, built to jump
      for (const sd of [-1, 1]) {
        c.beginPath(); c.moveTo(sd * 8 * s, 4 * s); c.lineTo(sd * 20 * s, -8 * s); c.lineTo(sd * 22 * s, 16 * s);
        c.strokeStyle = INK; c.lineWidth = 5 * s; c.stroke(); c.strokeStyle = '#8a8f9e'; c.lineWidth = 2.4 * s; c.stroke();
      }
      cel(c, P.ell(0, 2 * s, 15 * s, 11 * s), '#5d6475', '#353a47', '#c9d0e0', lw, 3 * s);
      cel(c, P.poly([-9 * s, -6 * s, 0, -20 * s, 9 * s, -6 * s]), '#4a5060', '#2a2e38', null, lw * 0.8, 2 * s);
      flat(c, P.ell(-5 * s, -2 * s, 2.6 * s, 2 * s), '#ffd23d', 1.2 * s); flat(c, P.ell(5 * s, -2 * s, 2.6 * s, 2 * s), '#ffd23d', 1.2 * s);
      flat(c, P.poly([-6 * s, 6 * s, 6 * s, 6 * s, 0, 11 * s]), INK, 0);
      break;
    }
    case 'twin': {
      c.save(); c.translate(0, 22 * s);
      drawKai(c, { ...SKINS[0], gi: '#14121c', giS: '#06050a', trim: '#ffffff', hair: '#f4f2ff', hairS: '#b5b0d6', skin: '#2a2733', fx: [] }, { t: 0, face: 1 }, 0.82 * s);
      c.restore();
      break;
    }
  }
  if (o.elite) {
    c.shadowBlur = 0;
    for (let i = -1; i <= 1; i++) cel(c, P.poly([i * 7 * s - 3.5 * s, -21 * s - Math.abs(i) * -3 * s, i * 7 * s, -31 * s + Math.abs(i) * 4 * s, i * 7 * s + 3.5 * s, -21 * s]), '#ffd23d', '#b38a12', '#fff3c4', lw * 0.7, 1 * s);
  }
}
function enemySprite(type, r, o) {
  o = o || {};
  if (type === 'treasure') type = 'runner';
  return sprite('e' + type + (o.elite ? 'E' : '') + (o.broken ? 'B' : '') + Math.round(r), r * 3.2, r * 3.2, c => drawEnemy(c, type, r, o));
}
function gearSprite(r) {
  return sprite('gear' + Math.round(r), r * 2.6, r * 2.6, c => {
    const s = r / 22, n = 10, pts = [];
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU, rr = (i % 2 ? 19 : 23) * s; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.beginPath(); P.poly(pts)(c); c.moveTo(16 * s, 0); c.arc(0, 0, 16 * s, 0, TAU, true);
    c.fillStyle = '#6b5a3a'; c.fill('evenodd'); c.lineWidth = 2 * s; c.strokeStyle = INK; c.stroke();
  });
}

// ============================================================================
// BOSSES (drawn live; one at a time)
// ============================================================================
function drawBoss(c, b, t, W) {
  const s = W / 360;
  const lw = 3 * s;
  const hurt = b.flash > 0;
  c.save();
  switch (b.kind) {
    case 'brine': {
      const wob = Math.sin(t * 2.2) * 4 * s;
      const body = c2 => { c2.moveTo(-150 * s, 40 * s); c2.bezierCurveTo(-160 * s, -50 * s - wob, -70 * s, -90 * s, 0, -92 * s - wob); c2.bezierCurveTo(70 * s, -90 * s, 160 * s, -50 * s + wob, 150 * s, 40 * s); c2.quadraticCurveTo(0, 62 * s, -150 * s, 40 * s); c2.closePath(); };
      cel(c, body, hurt ? '#bfffee' : '#2fbfa2', '#177866', '#c9fff2', lw, 9 * s);
      c.save(); c.beginPath(); body(c); c.clip(); c.globalAlpha = 0.35;
      for (let i = 0; i < 7; i++) { const x = Math.sin(i * 7.3 + t * 0.6) * 110 * s, y = Math.cos(i * 3.1 + t * 0.5) * 30 * s; flat(c, P.circ(x, y, (10 + i % 3 * 5) * s), '#0e5a4c', 0); }
      c.restore();
      for (let i = 0; i < 5; i++) {
        const ex = (-50 + i * 25) * s, ey = (-34 + Math.abs(i - 2) * 9) * s, er = (i === 2 ? 12 : 8) * s;
        flat(c, P.ell(ex, ey, er, er * 1.2), INK, 0);
        flat(c, P.circ(ex - er * 0.3, ey - er * 0.4, er * 0.35), '#fff', 0);
      }
      for (let i = 0; i < 6; i++) { const a = Math.PI + 0.3 + i * 0.5; flat(c, P.circ(Math.cos(a) * 100 * s, -70 * s + Math.sin(a) * 30 * s - 20 * s, (5 + i % 2 * 3) * s), '#8ff7e4', lw * 0.6); }
      break;
    }
    case 'gorebrand': {
      // chained axe
      const swing = b.wind > 0 ? -0.9 - (1 - b.wind / 2) * 0.5 : b.swingT > 0 ? 1.4 * (1 - b.swingT / 0.4) - 0.9 : -0.3 + Math.sin(t * 1.4) * 0.15;
      c.save(); c.translate(70 * s, -40 * s); c.rotate(swing);
      for (let i = 0; i < 6; i++) strokeP(c, P.ell(0, -i * 10 * s - 8 * s, 3.5 * s, 5.5 * s), '#8f8f99', 2.4 * s);
      c.translate(0, -70 * s);
      cel(c, P.poly([0, -4 * s, 42 * s, -26 * s, 50 * s, 6 * s, 40 * s, 30 * s, 0, 10 * s]), '#9a9aa8', '#55555f', '#ffffff', lw, 4 * s);
      flat(c, P.poly([42 * s, -26 * s, 50 * s, 6 * s, 40 * s, 30 * s, 46 * s, 4 * s]), '#ff3b5c', 0);
      c.restore();
      cel(c, P.poly([-90 * s, 50 * s, -70 * s, -40 * s, 70 * s, -40 * s, 90 * s, 50 * s]), hurt ? '#ffffff' : '#2a1f22', '#140e10', '#6b4b52', lw, 7 * s);
      for (const sd of [-1, 1]) cel(c, P.ell(sd * 72 * s, -38 * s, 30 * s, 20 * s), '#3a2a2e', '#1c1214', '#a07078', lw, 4 * s);
      cel(c, P.rr(-36 * s, -100 * s, 72 * s, 62 * s, 18 * s), '#3a2a2e', '#1c1214', '#a07078', lw, 5 * s);
      for (const sd of [-1, 1]) cel(c, P.poly([sd * 26 * s, -90 * s, sd * 62 * s, -136 * s, sd * 40 * s, -84 * s]), '#efe4cf', '#b3a587', null, lw, 3 * s);
      c.shadowColor = '#ff2a4a'; c.shadowBlur = 16 * s;
      flat(c, P.rr(-24 * s, -76 * s, 48 * s, 8 * s, 3 * s), '#ff2a4a', 0);
      c.shadowBlur = 0;
      flat(c, P.rr(-50 * s, -6 * s, 100 * s, 10 * s, 4 * s), '#5a1a1f', lw * 0.7);
      break;
    }
    case 'tyrant': {
      const plates = b.plates;
      cel(c, P.rr(-120 * s, -70 * s, 240 * s, 120 * s, 16 * s), hurt ? '#fff1d0' : '#4a3a2c', '#2a2018', '#a38a6a', lw, 8 * s);
      for (let i = 0; i < 4; i++) {
        const x = -110 * s + i * 56 * s;
        if (i < plates) cel(c, P.rr(x, -62 * s, 52 * s, 50 * s, 6 * s), '#8a7a6a', '#55493c', '#e3d3bd', lw, 4 * s);
        else { flat(c, P.rr(x + 6 * s, -56 * s, 40 * s, 38 * s, 4 * s), '#1c1410', lw * 0.6); strokeP(c, P.circ(x + 26 * s, -37 * s, 10 * s), '#ff7a1a', 2 * s); }
      }
      // furnace mouth
      const glow = 0.6 + Math.sin(t * 7) * 0.4;
      c.shadowColor = '#ff7a1a'; c.shadowBlur = 24 * s * glow;
      flat(c, P.rr(-60 * s, 0, 120 * s, 36 * s, 10 * s), '#ff7a1a', lw);
      c.shadowBlur = 0;
      for (let i = 0; i < 6; i++) flat(c, P.rr(-54 * s + i * 19 * s, 4 * s, 10 * s, 28 * s, 3 * s), '#2a1a10', 0);
      for (const sd of [-1, 1]) {
        cel(c, P.rr(sd * 80 * s - 12 * s, -120 * s, 24 * s, 54 * s, 4 * s), '#3d3029', '#221a16', '#8c7563', lw, 3 * s);
        c.fillStyle = 'rgba(60,50,45,0.5)'; c.beginPath(); c.arc(sd * 80 * s + Math.sin(t * 2 + sd) * 6 * s, -130 * s - (t * 30 % 30) * s, 10 * s, 0, TAU); c.fill();
      }
      flat(c, P.circ(-30 * s, -86 * s, 9 * s), '#ffb02e', lw * 0.8); flat(c, P.circ(30 * s, -86 * s, 9 * s), '#ffb02e', lw * 0.8);
      bigText(c, 'MK IV', 0, -84 * s, 14 * s, '#ffd98a', { font: dispFont(14 * s), lw: 3 * s, shadow: false });
      break;
    }
    case 'echo': {
      const g = Math.sin(t * 13) > 0.7 ? 6 * s : 0;
      c.save(); c.globalAlpha = 0.5; c.translate(g, 0);
      drawEchoBody(c, s, '#2bf0ff', t); c.restore();
      c.save(); c.globalAlpha = 0.5; c.translate(-g, 0);
      drawEchoBody(c, s, '#ff2bd6', t); c.restore();
      drawEchoBody(c, s, hurt ? '#ffffff' : '#1b1035', t, true);
      // it carries a number: the size of the squad it is mirroring
      bigText(c, b.mirror || 0, 0, -10 * s, 34 * s, '#2bf0ff', { lw: 5 * s });
      break;
    }
    case 'otherkai': {
      c.save(); c.translate(0, 60 * s);
      const sk = { ...SKINS[0], gi: '#0c0b12', giS: '#000000', trim: '#ffffff', hair: '#f4f2ff', hairS: '#b5b0d6', skin: '#26232f', fx: ['cape'], cape: '#f4f2ff' };
      c.shadowColor = '#ffffff'; c.shadowBlur = 20 * s;
      drawKai(c, sk, { t, face: -1, slam: b.slamAnim || 0, walk: t * 2, rift: 1 }, 2.6 * s);
      c.restore();
      if (hurt) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(-90 * s, -110 * s, 180 * s, 180 * s); c.globalCompositeOperation = 'source-over'; }
      break;
    }
    default: { // regular boss: the stage enemy, huge, crowned
      c.save(); c.scale(2.6, 2.6);
      const spr = enemySprite(b.etype, 22 * s, {});
      drawSpr(c, spr, 0, -6 * s);
      for (let i = -1; i <= 1; i++) cel(c, P.poly([i * 9 * s - 4 * s, -26 * s, i * 9 * s, -38 * s + Math.abs(i) * 3 * s, i * 9 * s + 4 * s, -26 * s]), '#ffd23d', '#b38a12', '#fff3c4', 1.2 * s, 1 * s);
      c.restore();
      if (hurt) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(0, -10 * s, 60 * s, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; }
    }
  }
  c.restore();
}
function drawEchoBody(c, s, col, t, main) {
  const lw = 3 * s;
  const torso = P.poly([-60 * s, 40 * s, -44 * s, -50 * s, 44 * s, -50 * s, 60 * s, 40 * s]);
  if (main) cel(c, torso, col, '#0b0718', '#2bf0ff', lw, 6 * s); else flat(c, torso, col, 0);
  const head = P.circ(0, -80 * s, 28 * s);
  if (main) cel(c, head, col, '#0b0718', '#ff2bd6', lw, 5 * s); else flat(c, head, col, 0);
  if (main) {
    flat(c, P.rr(-18 * s, -86 * s, 12 * s, 6 * s, 2), '#2bf0ff', 0);
    flat(c, P.rr(6 * s, -86 * s, 12 * s, 6 * s, 2), '#2bf0ff', 0);
  }
}

// ---- small HUD icons ----
function iconHeart(c, x, y, r, full) {
  const p = c2 => { c2.moveTo(x, y + r * 0.9); c2.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r * 0.7, y - r * 1.3, x, y - r * 0.4); c2.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.1, x, y + r * 0.9); c2.closePath(); };
  if (full) cel(c, p, '#ff3b5c', '#b01735', '#ffb3c1', 2, r * 0.25); else flat(c, p, '#2a2030', 2);
}
function iconCoin(c, x, y, r) { cel(c, P.circ(x, y, r), '#ffc83d', '#c48a12', '#fff3c4', 2, r * 0.25); strokeP(c, P.circ(x, y, r * 0.55), '#c48a12', 1.4); }
function iconGem(c, x, y, r) { cel(c, P.poly([x, y - r, x + r * 0.9, y - r * 0.2, x, y + r, x - r * 0.9, y - r * 0.2]), '#57e2ff', '#1f8fc4', '#e3fbff', 2, r * 0.25); }
function iconShield(c, x, y, r, col) {
  cel(c, P.poly([x, y - r, x + r * 0.9, y - r * 0.6, x + r * 0.75, y + r * 0.4, x, y + r, x - r * 0.75, y + r * 0.4, x - r * 0.9, y - r * 0.6]), col || '#6ea8ff', shade(col || '#6ea8ff', -0.35), '#ffffff', 2, r * 0.2);
}
function drawHand(c, x, y, press) {
  c.save(); c.translate(x, y); c.rotate(-0.35); const s = press ? 0.9 : 1; c.scale(s, s);
  const hand = c2 => { c2.moveTo(-6, 0); c2.lineTo(-6, -26); c2.quadraticCurveTo(0, -32, 6, -26); c2.lineTo(6, -8); c2.lineTo(18, -6); c2.quadraticCurveTo(24, 0, 20, 14); c2.lineTo(14, 28); c2.lineTo(-10, 28); c2.lineTo(-16, 8); c2.quadraticCurveTo(-14, 0, -6, 0); c2.closePath(); };
  c.translate(0, 26);
  cel(c, hand, '#ffffff', '#c9c9d6', null, 3, 3);
  c.restore();
  if (press) { c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 18, 0, TAU); c.stroke(); }
}

// App icon for the Home Screen (generated at runtime)
function makeAppIcon() {
  try {
    const S = 180, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#1b1035'); g.addColorStop(1, '#07070d');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.strokeStyle = '#ffffff'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(S * 0.55, 0); c.lineTo(S * 0.47, S * 0.3); c.lineTo(S * 0.58, S * 0.5); c.lineTo(S * 0.45, S); c.stroke();
    c.save(); c.translate(S / 2, S * 0.92); drawKai(c, KAI_LOOK, { t: 0, face: 1, rift: 0.5 }, 2.6); c.restore();
    return cv.toDataURL('image/png');
  } catch (e) { return null; }
}
