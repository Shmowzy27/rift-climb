// ============================================================================
// GFX: Three.js r128, flat-shaded low-poly with cel shading.
// Two/three-tone toon ramp, hard rim light, inverted-hull outlines, soft shadow
// blobs. All geometry is generated here. Crowds are instanced; per-frame work
// writes into preallocated matrices only.
// World (x, y, z) maps to three.js (x, y, -z): the road runs into -Z.
// ============================================================================

const KAI_LOOK = { id: 'kai', gi: '#2b3350', giS: '#1a2036', trim: '#c4182d', hair: '#1d1b26', hairS: '#0e0d14', skin: '#f2c9a0', fx: ['cape'], cape: '#c4182d' };
const BAND_GREEN = 0x3dff7a, BAND_RED = 0xff2f4f;
const SKIN_TONE = '#f2c9a0';

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3();

// ---- geometry helpers --------------------------------------------------------
const GB = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s || 7),
  cone: (r, h, s) => new THREE.ConeGeometry(r, h, s || 6),
  ico: (r, d) => new THREE.IcosahedronGeometry(r, d || 0),
  sph: (r, w, h) => new THREE.SphereGeometry(r, w || 7, h || 5),
  tor: (R, r, a, b, arc) => new THREE.TorusGeometry(R, r, a || 4, b || 10, arc || TAU),
  oct: r => new THREE.OctahedronGeometry(r, 0),
  dod: r => new THREE.DodecahedronGeometry(r, 0),
};
// part(geometry, color, [x,y,z], [rx,ry,rz], [sx,sy,sz])
const part = (geo, col, p, r, s) => ({ geo, col, p: p || [0, 0, 0], r: r || [0, 0, 0], s: s || [1, 1, 1] });
function build(parts, post) {
  const gs = [];
  let total = 0;
  for (const pt of parts) {
    const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone();
    pt.geo.dispose();
    _e.set(pt.r[0], pt.r[1], pt.r[2]); _q.setFromEuler(_e); _p.set(pt.p[0], pt.p[1], pt.p[2]); _s.set(pt.s[0], pt.s[1], pt.s[2]);
    g.applyMatrix4(_m4.compose(_p, _q, _s));
    gs.push([g, new THREE.Color(pt.col)]);
    total += g.attributes.position.count;
  }
  const pos = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const [g, c] of gs) {
    const a = g.attributes.position.array, n = g.attributes.position.count;
    pos.set(a, o * 3);
    for (let i = 0; i < n; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += n; g.dispose();
  }
  if (post) post(pos, col);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals(); // non-indexed: one flat normal per face
  out.computeBoundingSphere();
  return out;
}
// Inverted hull: push every vertex out along its smoothed normal.
function hullGeo(geo, t) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal, n = pos.count;
  const keys = new Map(), acc = [];
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos.getX(i) * 500) + ',' + Math.round(pos.getY(i) * 500) + ',' + Math.round(pos.getZ(i) * 500);
    let j = keys.get(k);
    if (j === undefined) { j = acc.length / 3; keys.set(k, j); acc.push(0, 0, 0); }
    idx[i] = j; acc[j * 3] += nrm.getX(i); acc[j * 3 + 1] += nrm.getY(i); acc[j * 3 + 2] += nrm.getZ(i);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = idx[i]; let x = acc[j * 3], y = acc[j * 3 + 1], z = acc[j * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    out[i * 3] = pos.getX(i) + x / l * t; out[i * 3 + 1] = pos.getY(i) + y / l * t; out[i * 3 + 2] = pos.getZ(i) + z / l * t;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.computeBoundingSphere();
  return g;
}

// Two quads crossed along the z axis (one flat, one upright) so a streak reads from any camera
// angle without per-frame billboarding. Vertex colour runs from head (z = +len/2) to tail (fade).
function crossQuad(len, w, head, tail) {
  const pos = [], col = [], h = len / 2, a = w / 2;
  const quad = (p0, p1, p2, p3) => { for (const q of [p0, p1, p2, p0, p2, p3]) pos.push(...q); };
  quad([-a, 0, -h], [a, 0, -h], [a, 0, h], [-a, 0, h]);
  quad([0, -a, -h], [0, a, -h], [0, a, h], [0, -a, h]);
  for (let i = 0; i < pos.length; i += 3) { const k = (pos[i + 2] + h) / len; for (let c = 0; c < 3; c++) col.push(tail[c] + (head[c] - tail[c]) * k); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
// a four-point flash star facing the camera, 1 unit across
function starQuad() {
  const pos = [], col = [];
  for (let i = 0; i < 8; i++) {
    const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU, r0 = i % 2 ? 0.16 : 0.5, r1 = i % 2 ? 0.5 : 0.16;
    pos.push(0, 0, 0, Math.cos(a0) * r0, Math.sin(a0) * r0, 0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0);
    col.push(1, 1, 1, 1, 0.85, 0.45, 1, 0.85, 0.45);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
// The gun every soldier carries, by weapon level (1 bolt rifle .. 10 heavy automatic): longer,
// bulkier, more barrels and a hotter accent as it climbs. Held at the right hip, pointing ahead.
function gunParts(lv, x, y, z, sc) {
  sc = sc || 1;
  const metal = lv >= 7 ? '#3a3f4c' : '#4a4f5a', dark = '#1c1d24', wood = '#7a5232';
  const acc = ['#c9ced8', '#c9ced8', '#9fe6ff', '#9fe6ff', '#ffd23d', '#ffd23d', '#ff9a3d', '#ff9a3d', '#ff3b5c', '#ff3b5c'][lv - 1];
  const len = (0.42 + 0.035 * lv) * sc, th = (0.06 + 0.009 * lv) * sc;
  const out = [part(GB.box(th, th * 1.3, len), metal, [x, y, z - len / 2])];
  out.push(part(GB.box(th * 0.9, th * 1.6, len * 0.32), lv <= 2 ? wood : dark, [x, y - th * 0.4, z + len * 0.12])); // stock
  const barrels = lv >= 8 ? 3 : lv >= 5 ? 2 : 1;
  for (let i = 0; i < barrels; i++) out.push(part(GB.cyl(th * 0.28, th * 0.28, len * 0.55, 5), dark, [x + (i - (barrels - 1) / 2) * th * 0.6, y + th * 0.3, z - len - len * 0.2], [Math.PI / 2, 0, 0]));
  if (lv >= 3) out.push(part(GB.box(th * 0.7, th * 1.8, th * 1.2), dark, [x, y - th * 1.3, z - len * 0.45])); // magazine
  if (lv >= 6) out.push(part(GB.cyl(th * 0.35, th * 0.35, len * 0.35, 6), dark, [x, y + th * 1.1, z - len * 0.5], [Math.PI / 2, 0, 0])); // scope
  if (lv >= 9) out.push(part(GB.cyl(th * 1.1, th * 1.1, len * 0.3, 7), metal, [x, y, z - len * 0.75], [Math.PI / 2, 0, 0])); // rotary housing
  out.push(part(GB.box(th * 1.05, th * 0.35, len * 0.6), acc, [x, y + th * 0.75, z - len * 0.45])); // the accent stripe that says which gun it is
  return out;
}
// Weapon crates by rank: a tire stack (easy), a steel drum, a strapped crate (the good stuff)
function crateParts(rank) {
  if (rank === 0) {
    const out = [];
    for (let i = 0; i < 3; i++) out.push(part(GB.tor(0.55, 0.22, 6, 14), '#1e1e24', [0, 0.22 + i * 0.42, 0], [Math.PI / 2, 0, 0]));
    out.push(part(GB.cyl(0.36, 0.36, 1.2, 10), '#3a3a44', [0, 0.62, 0]));
    return out;
  }
  if (rank === 1) return [
    part(GB.cyl(0.62, 0.62, 1.5, 14), '#3f6fa8', [0, 0.75, 0]), part(GB.cyl(0.64, 0.64, 0.12, 14), '#c9ced8', [0, 0.35, 0]),
    part(GB.cyl(0.64, 0.64, 0.12, 14), '#c9ced8', [0, 1.15, 0]), part(GB.cyl(0.5, 0.5, 0.06, 14), '#2a4a72', [0, 1.52, 0]),
  ];
  return [
    part(GB.box(1.5, 1.4, 1.3), '#a8743a', [0, 0.7, 0]), part(GB.box(1.54, 0.16, 1.34), '#5a3a1a', [0, 0.25, 0]), part(GB.box(1.54, 0.16, 1.34), '#5a3a1a', [0, 1.15, 0]),
    part(GB.box(0.16, 1.44, 1.34), '#c9ced8', [-0.5, 0.7, 0]), part(GB.box(0.16, 1.44, 1.34), '#c9ced8', [0.5, 0.7, 0]),
    part(GB.box(0.5, 0.3, 0.05), '#ffd23d', [0, 0.75, 0.66]),
  ];
}

// ---- instanced kit: a pool of one mesh type (+ its outline) -----------------
class Kit {
  constructor(geo, cap, o) {
    o = o || {};
    this.cap = cap; this.n = 0; this.geo = geo;
    this.mesh = new THREE.InstancedMesh(geo, o.mat || GFX.toon, cap);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (o.color) { this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    if (o.order != null) this.mesh.renderOrder = o.order;
    GFX.world.add(this.mesh);
    if (o.outline !== false) {
      this.hull = hullGeo(geo, o.ol || 0.04);
      this.out = new THREE.InstancedMesh(this.hull, o.olMat || GFX.outlineMat, cap);
      this.out.instanceMatrix = this.mesh.instanceMatrix; // shares the same matrices
      this.out.frustumCulled = false; this.out.count = 0;
      GFX.world.add(this.out);
    }
  }
  begin() { this.n = 0; }
  // x,y,z are WORLD coords (z forward)
  add(x, y, z, ry, sx, sy, sz, col, rx, rz) {
    if (this.n >= this.cap) return;
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e);
    _p.set(x, y, -z); _s.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz);
    this.mesh.setMatrixAt(this.n, _m4.compose(_p, _q, _s));
    if (this.mesh.instanceColor) this.mesh.setColorAt(this.n, col == null ? _c.setRGB(1, 1, 1) : typeof col === 'number' ? _c.setHex(col) : col);
    this.n++;
  }
  // raw matrix (for legs pivoting at the hip)
  addMatrix(m) { if (this.n >= this.cap) return; this.mesh.setMatrixAt(this.n++, m); }
  end() {
    this.mesh.count = this.n; if (this.out) this.out.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() {
    GFX.world.remove(this.mesh); this.mesh.geometry.dispose();
    if (this.out) { GFX.world.remove(this.out); this.hull.dispose(); }
  }
}

// ---- unit designs --------------------------------------------------------------
// Soldiers face -Z (away from camera); the camera sees their backs. Legs are a
// separate instanced mesh so they can swing. Heights ~1.1 units, feet at y = 0.
// The starter skin is each archetype's plain issue colours; other skins recolour every archetype.
const ARCH_PLAIN = {
  crossbow: { c: '#3d6a8a', c2: '#2a3a4a', h: '#9aa4ae', t: '#e8d6a0' },
  staff: { c: '#8a1f2e', c2: '#4a1018', h: '#3a1a2e', t: '#ffb02e' },
  blade: { c: '#2a2224', c2: '#141012', h: '#a81e1e', t: '#ffd23d' },
  beam: { c: '#e8eef5', c2: '#5a6a7a', h: '#f4f8ff', t: '#2bf0ff' },
};
function skinPal(skin, arch) {
  if (skin.id === 'conscript' && arch && ARCH_PLAIN[arch]) return ARCH_PLAIN[arch];
  return { c: skin.c, c2: skin.c2, h: skin.h, t: skin.t === '#000000' ? '#2a2a33' : skin.t };
}
function soldierParts(arch, skin) {
  const P = skinPal(skin, arch), wood = '#7a5232', metal = '#c9ced8', dark = '#2a2833';
  const out = [];
  const head = () => out.push(part(GB.sph(0.12, 7, 5), SKIN_TONE, [0, 0.98, 0]));
  switch (arch) {
    case 'crossbow': // Footmen: kettle hat, tabard, wide crossbow = a T from behind
      out.push(part(GB.box(0.42, 0.42, 0.26), P.c, [0, 0.63, 0]));
      out.push(part(GB.box(0.1, 0.42, 0.27), P.t, [0, 0.63, 0]));
      out.push(part(GB.box(0.45, 0.07, 0.29), P.c2, [0, 0.44, 0]));
      head();
      out.push(part(GB.cyl(0.27, 0.27, 0.035, 9), P.h, [0, 1.06, 0]));
      out.push(part(GB.sph(0.15, 8, 4), P.h, [0, 1.07, 0], 0, [1, 0.75, 1]));
      out.push(part(GB.box(0.1, 0.32, 0.09), wood, [-0.13, 0.72, 0.16], [0, 0, 0.3]));
      out.push(part(GB.box(0.07, 0.07, 0.55), wood, [0.02, 0.74, -0.3]));
      out.push(part(GB.box(0.82, 0.05, 0.06), metal, [0.02, 0.76, -0.54]));
      out.push(part(GB.box(0.1, 0.1, 0.12), P.c, [0.24, 0.78, -0.12])); // arm
      break;
    case 'staff': // Apprentices: flared robe, tall bent hat, staff with a lit orb
      out.push(part(GB.cyl(0.15, 0.3, 0.68, 8), P.c, [0, 0.54, 0]));
      out.push(part(GB.box(0.36, 0.06, 0.32), P.t, [0, 0.66, 0]));
      head();
      out.push(part(GB.cyl(0.27, 0.27, 0.03, 9), P.h, [0, 1.07, 0]));
      out.push(part(GB.cone(0.17, 0.52, 7), P.h, [0.03, 1.33, 0], [0, 0, -0.18]));
      out.push(part(GB.cyl(0.028, 0.028, 1.35, 5), wood, [0.3, 0.78, -0.04]));
      out.push(part(GB.ico(0.1, 0), P.t, [0.3, 1.5, -0.04]));
      out.push(part(GB.box(0.1, 0.24, 0.1), P.c2, [0.22, 0.78, 0], [0, 0, 0.4]));
      break;
    case 'blade': // Retainers: small head on broad shoulders, huge blade on the back
      out.push(part(GB.box(0.48, 0.4, 0.3), P.c, [0, 0.66, 0]));
      out.push(part(GB.box(0.52, 0.2, 0.33), P.c2, [0, 0.42, 0]));
      for (const sd of [-1, 1]) out.push(part(GB.box(0.28, 0.12, 0.34), P.h, [sd * 0.34, 0.86, 0], [0, 0, sd * -0.35]));
      out.push(part(GB.sph(0.1, 7, 5), SKIN_TONE, [0, 0.98, 0]));
      out.push(part(GB.sph(0.13, 8, 4), P.h, [0, 1.03, 0], 0, [1, 0.8, 1]));
      for (const sd of [-1, 1]) out.push(part(GB.box(0.04, 0.24, 0.03), P.t, [sd * 0.08, 1.16, -0.05], [0, 0, sd * -0.5]));
      out.push(part(GB.box(0.08, 1.05, 0.03), metal, [0.05, 0.98, 0.2], [0, 0, 0.55]));
      out.push(part(GB.box(0.16, 0.05, 0.06), P.t, [-0.24, 0.5, 0.2], [0, 0, 0.55]));
      out.push(part(GB.box(0.05, 0.22, 0.05), dark, [-0.32, 0.38, 0.2], [0, 0, 0.55]));
      break;
    case 'beam': // Pilots: sleek helmet, thruster pack, oversized rifle on the shoulder
      out.push(part(GB.box(0.38, 0.42, 0.26), P.c, [0, 0.64, 0]));
      out.push(part(GB.box(0.4, 0.06, 0.28), P.t, [0, 0.47, 0]));
      for (const sd of [-1, 1]) out.push(part(GB.cyl(0.065, 0.05, 0.3, 6), P.c2, [sd * 0.1, 0.7, 0.17]));
      out.push(part(GB.sph(0.15, 8, 6), P.h, [0, 1.0, 0], 0, [1, 1.05, 1.05]));
      out.push(part(GB.box(0.03, 0.18, 0.03), dark, [0.1, 1.17, 0.04]));
      out.push(part(GB.box(0.11, 0.13, 0.95), dark, [0.26, 0.93, -0.16]));
      out.push(part(GB.box(0.05, 0.05, 0.6), P.t, [0.26, 1.0, -0.3]));
      break;
  }
  const fx = new Set(skin.fx || []);
  if (fx.has('cape')) out.push(part(GB.box(0.44, 0.5, 0.04), '#c4182d', [0, 0.62, 0.18], [0.12, 0, 0]));
  if (fx.has('lantern')) out.push(part(GB.box(0.1, 0.14, 0.1), '#ffcf6b', [-0.12, 0.55, 0.2]));
  if (fx.has('kelp')) for (let i = -1; i <= 1; i++) out.push(part(GB.box(0.03, 0.4, 0.03), '#3fbf7a', [i * 0.12, 0.62, 0.16], [0.1, 0, i * 0.15]));
  if (fx.has('antenna')) for (const sd of [-1, 1]) { out.push(part(GB.box(0.02, 0.3, 0.02), '#3a3a44', [sd * 0.07, 1.25, 0])); out.push(part(GB.ico(0.035), '#ffe14d', [sd * 0.07, 1.41, 0])); }
  if (fx.has('banner')) { out.push(part(GB.box(0.025, 0.9, 0.025), wood, [-0.15, 1.1, 0.16])); out.push(part(GB.box(0.25, 0.18, 0.02), '#c4182d', [-0.03, 1.45, 0.16])); }
  if (fx.has('wings')) for (const sd of [-1, 1]) out.push(part(GB.ico(0.22), '#b6aedc', [sd * 0.2, 0.75, 0.2], [0, 0, sd * 0.5], [0.7, 1.2, 0.2]));
  if (fx.has('seams')) out.push(part(GB.box(0.04, 0.36, 0.27), '#ff8a1f', [0.12, 0.64, 0.01]));
  if (fx.has('goggles')) out.push(part(GB.box(0.26, 0.05, 0.05), '#6bf0ff', [0, 1.06, -0.12]));
  if (fx.has('chain')) out.push(part(GB.tor(0.06, 0.015, 3, 6), '#8f8f99', [0.25, 0.5, 0]));
  const half = fx.has('halfvoid');
  return { parts: out, post: half ? (pos, col) => { for (let i = 0; i < pos.length / 3; i++) if (pos[i * 3] > 0.005) { col[i * 3] *= 0.06; col[i * 3 + 1] *= 0.06; col[i * 3 + 2] *= 0.08; } } : null };
}
function legGeo(color) {
  const g = build([part(GB.box(0.12, 0.4, 0.14), color, [0, -0.2, 0]), part(GB.box(0.13, 0.07, 0.2), '#1a1720', [0, -0.4, -0.03])]);
  return g;
}
function kaiParts(arch, lv) {
  const out = [
    part(GB.box(0.44, 0.44, 0.28), '#2b3350', [0, 0.65, 0]),
    part(GB.box(0.46, 0.07, 0.3), '#1a2036', [0, 0.45, 0]),
    part(GB.sph(0.13, 7, 5), SKIN_TONE, [0, 1.0, 0]),
    part(GB.box(0.3, 0.1, 0.3), '#c4182d', [0, 0.86, 0]),                    // scarf
    part(GB.box(0.12, 0.42, 0.04), '#c4182d', [0.05, 0.66, 0.2], [0.25, 0, 0.1]),
  ];
  for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; out.push(part(GB.cone(0.06, 0.24, 4), '#1d1b26', [Math.cos(a) * 0.09, 1.1 + Math.abs(Math.sin(a)) * 0.03, Math.sin(a) * 0.09 + 0.02], [Math.sin(a) * 0.9 + 0.3, 0, -Math.cos(a) * 0.9])); }
  out.push(part(GB.cone(0.04, 0.26, 4), '#cfc6ff', [0.02, 1.2, 0.05], [0.4, 0, -0.2]));
  out.push(part(GB.box(0.06, 0.06, 0.7), '#c9ced8', [-0.25, 0.6, 0.1], [0.5, 0, 0])); // a plain blade, slung
  out.push(...gunParts(lv || 1, 0.2, 0.74, -0.05));
  return out;
}

function enemyParts(look) {
  const out = [];
  const eyes = (z, y, sp, col, r) => { for (const sd of [-1, 1]) out.push(part(GB.box(r || 0.08, (r || 0.08) * 1.3, 0.04), col || '#0b0b14', [sd * sp, y, z])); };
  switch (look) {
    case 'slime': case 'bigslime':
      out.push(part(GB.ico(0.46, 1), '#36d6b5', [0, 0.36, 0], 0, [1, 0.78, 1]));
      out.push(part(GB.ico(0.12, 0), '#c9fff2', [-0.18, 0.56, 0.2]));
      eyes(0.36, 0.42, 0.12, '#0b0b14', 0.08);
      break;
    case 'hound':
      out.push(part(GB.box(0.36, 0.3, 0.72), '#6a2a24', [0, 0.5, 0]));
      out.push(part(GB.box(0.32, 0.28, 0.3), '#7a3228', [0, 0.62, 0.42]));
      for (const sd of [-1, 1]) out.push(part(GB.cone(0.06, 0.2, 4), '#3a1410', [sd * 0.1, 0.84, 0.4]));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(part(GB.box(0.07, 0.45, 0.07), '#3a1410', [sx * 0.14, 0.24, sz * 0.25], [sz * 0.25, 0, 0]));
      eyes(0.58, 0.66, 0.08, '#ffb02e', 0.06);
      out.push(part(GB.cone(0.12, 0.3, 4), '#ff7a2a', [0, 0.7, -0.4], [-1.2, 0, 0]));
      break;
    case 'husk':
      out.push(part(GB.box(0.5, 0.62, 0.34), '#5a5a68', [0, 0.6, 0]));
      out.push(part(GB.box(0.36, 0.3, 0.32), '#3b3b47', [0, 1.06, 0]));
      out.push(part(GB.box(0.26, 0.04, 0.04), '#ff3b3b', [0, 1.06, 0.17]));
      out.push(part(GB.cyl(0.4, 0.4, 0.07, 10), '#7d7f8c', [0, 0.66, 0.3], [Math.PI / 2, 0, 0]));
      out.push(part(GB.ico(0.08), '#b9bccb', [0, 0.66, 0.35]));
      for (const sd of [-1, 1]) out.push(part(GB.box(0.14, 0.4, 0.14), '#3b3b47', [sd * 0.14, 0.2, 0]));
      break;
    case 'oni':
      out.push(part(GB.box(0.9, 0.72, 0.55), '#c2262e', [0, 0.8, 0]));
      out.push(part(GB.box(0.3, 0.28, 0.28), '#a81e26', [0, 1.3, 0.05]));
      for (const sd of [-1, 1]) { out.push(part(GB.cone(0.07, 0.3, 5), '#f2ead6', [sd * 0.12, 1.55, 0.05], [0, 0, sd * -0.3])); out.push(part(GB.box(0.24, 0.6, 0.24), '#a81e26', [sd * 0.58, 0.72, 0.05], [0, 0, sd * 0.15])); out.push(part(GB.box(0.22, 0.42, 0.22), '#5a1a1f', [sd * 0.22, 0.22, 0])); }
      eyes(0.2, 1.33, 0.07, '#ffd23d', 0.07);
      out.push(part(GB.box(0.2, 0.05, 0.03), '#f2ead6', [0, 1.21, 0.2]));
      break;
    case 'yokai': case 'bigyokai':
      out.push(part(GB.cyl(0.18, 0.36, 0.8, 7), '#3a2a5e', [0, 0.45, 0]));
      out.push(part(GB.sph(0.17, 7, 5), '#22183a', [0, 1.0, 0]));
      out.push(part(GB.box(0.3, 0.34, 0.06), '#f4f0e8', [0, 1.0, 0.16]));
      out.push(part(GB.box(0.22, 0.03, 0.02), '#d8322a', [0, 1.06, 0.2]));
      out.push(part(GB.box(0.03, 0.12, 0.02), '#d8322a', [0, 0.92, 0.2]));
      for (const sd of [-1, 1]) out.push(part(GB.cone(0.04, 0.16, 4), '#f4f0e8', [sd * 0.1, 1.22, 0.05]));
      for (const sd of [-1, 1]) out.push(part(GB.box(0.1, 0.4, 0.1), '#2a1e44', [sd * 0.3, 0.7, 0.1], [0.4, 0, sd * 0.3]));
      break;
    case 'wisp':
      out.push(part(GB.cyl(0.24, 0.24, 0.44, 8), '#ffcf8a', [0, 1.0, 0]));
      out.push(part(GB.cyl(0.26, 0.26, 0.05, 8), '#5a2a14', [0, 1.24, 0]));
      out.push(part(GB.cyl(0.26, 0.26, 0.05, 8), '#5a2a14', [0, 0.76, 0]));
      out.push(part(GB.cone(0.1, 0.24, 5), '#ffd23d', [0, 1.4, 0]));
      out.push(part(GB.box(0.12, 0.08, 0.02), '#0b0b14', [0, 1.02, 0.24]));
      break;
    case 'drone': case 'bigdrone':
      out.push(part(GB.sph(0.38, 8, 6), '#c9a24a', [0, 0.9, 0]));
      out.push(part(GB.tor(0.5, 0.07, 4, 12), '#6b5a3a', [0, 0.9, 0], [Math.PI / 2, 0, 0]));
      out.push(part(GB.cyl(0.13, 0.13, 0.06, 8), '#ff9a1a', [0, 0.92, 0.36], [Math.PI / 2, 0, 0]));
      out.push(part(GB.box(0.5, 0.04, 0.08), '#8a8a95', [0, 1.36, 0]));
      out.push(part(GB.box(0.06, 0.12, 0.06), '#5a4a2a', [0, 1.28, 0]));
      break;
    case 'ghost':
      out.push(part(GB.cone(0.38, 1.1, 7), '#c06bff', [0, 0.75, 0], [Math.PI, 0, 0]));
      out.push(part(GB.sph(0.34, 7, 5), '#c06bff', [0, 1.25, 0]));
      out.push(part(GB.box(0.5, 0.04, 0.5), '#2bf0ff', [0, 0.95, 0]));
      eyes(0.3, 1.28, 0.11, '#ffffff', 0.08);
      break;
    case 'shieldcrawler':
      out.push(part(GB.cyl(0.42, 0.42, 0.06, 8), '#e8e6ff', [0, 0.5, 0.42], [Math.PI / 2, 0, 0]));
      // falls through to the crawler body
    case 'crawler': case 'bigcrawler':
      out.push(part(GB.ico(0.36, 0), '#121018', [0, 0.45, 0], 0, [1, 0.8, 1.2]));
      for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) out.push(part(GB.box(0.5, 0.05, 0.05), '#1c1a24', [sd * 0.4, 0.35, -0.2 + i * 0.2], [0, 0, sd * -0.5]));
      eyes(0.42, 0.55, 0.1, '#ffffff', 0.07);
      break;
    case 'treasure':
      out.push(part(GB.box(0.5, 0.36, 0.34), '#ffc83d', [0, 1.0, -0.15]));
      out.push(part(GB.box(0.52, 0.06, 0.36), '#7a4a12', [0, 1.06, -0.15]));
      out.push(part(GB.ico(0.26, 0), '#7bb36a', [0, 0.55, 0.05], 0, [1, 1.1, 1]));
      for (const sd of [-1, 1]) out.push(part(GB.cone(0.07, 0.3, 4), '#7bb36a', [sd * 0.3, 0.68, 0.05], [0, 0, sd * 1.3]));
      eyes(0.27, 0.6, 0.09, '#0b0b14', 0.07);
      break;
    case 'shade':
      out.push(part(GB.box(0.4, 0.5, 0.26), '#0d3a44', [0, 0.65, 0]));
      out.push(part(GB.sph(0.16, 7, 5), '#0d3a44', [0, 1.05, 0]));
      out.push(part(GB.box(0.26, 0.05, 0.04), '#2bf0ff', [0, 1.06, 0.15]));
      break;
    case 'twin':
      out.push(part(GB.box(0.44, 0.48, 0.28), '#0c0b12', [0, 0.66, 0]));
      out.push(part(GB.sph(0.14, 7, 5), '#26232f', [0, 1.04, 0]));
      for (let i = 0; i < 5; i++) out.push(part(GB.cone(0.05, 0.2, 4), '#f4f2ff', [(i - 2) * 0.06, 1.18, -0.02], [-0.3, 0, (i - 2) * 0.3]));
      eyes(0.14, 1.05, 0.05, '#ffffff', 0.05);
      break;
  }
  return out;
}

// ---- bosses -----------------------------------------------------------------
// Colossal (5-6x a soldier), built in groups: base stays, p1 breaks off at 66%, p2 at 33%.
// Faces +z toward the squad (rotated at draw time). Heights ~6-7 units.
function kaiWeaponParts(arch) {
  if (arch === 'staff') return [part(GB.cyl(0.1, 0.1, 5.5, 6), '#f4f2ff', [0, 1.2, 0]), part(GB.ico(0.6), '#ffffff', [0, 4.1, 0])];
  if (arch === 'blade') return [part(GB.box(0.3, 5.5, 0.1), '#ffffff', [0, 1.8, 0]), part(GB.box(0.9, 0.2, 0.3), '#c4182d', [0, -0.9, 0])];
  if (arch === 'beam') return [part(GB.box(0.55, 0.65, 4.2), '#0c0b12', [0, 0, -1.2]), part(GB.box(0.22, 0.22, 3), '#ffffff', [0, 0.25, -1.8])];
  return [part(GB.box(0.28, 0.28, 2.6), '#0c0b12', [0, 0, -0.9]), part(GB.box(3.6, 0.2, 0.22), '#ffffff', [0, 0.1, -2.1])];
}
function bossRigParts(kind, arch) {
  const R = { base: [], p1: [], p2: [], glass: [], weapon: null };
  const B = R.base, P1 = R.p1, P2 = R.p2;
  switch (kind) {
    case 'brine': { // bloated slime matriarch: translucent green, a dark core inside
      R.glass.push(part(GB.ico(2.5, 1), '#2fbf8a', [0, 2.3, 0], 0, [1.25, 0.82, 1.05]));           // inner body (stays)
      R.glassP1 = [part(GB.ico(3.5, 1), '#5ff0c0', [0, 2.7, 0], 0, [1.25, 0.78, 1.05])];           // outer layer (sheds)
      B.push(part(GB.ico(1.15, 1), '#0e1a16', [0, 2.5, 0.2]));                                     // the core
      for (const sd of [-1, 1]) B.push(part(GB.sph(0.22, 7, 5), '#ffef6a', [sd * 0.45, 2.75, 1.25]));
      B.push(part(GB.box(0.9, 0.12, 0.1), '#ffef6a', [0, 2.15, 1.3]));
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; P1.push(part(GB.cone(0.32, 1.1, 5), '#5ff0c0', [Math.cos(a) * 3.6, 0.5, Math.sin(a) * 2.6], [Math.PI, 0, 0])); }
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; P2.push(part(GB.ico(0.42, 0), '#bffff0', [Math.cos(a) * 2.0, 4.6 + Math.sin(i * 1.7) * 0.25, Math.sin(a) * 1.4])); }
      for (let i = 0; i < 4; i++) P2.push(part(GB.sph(0.35 - i * 0.05, 6, 4), '#bffff0', [-2.4 + i * 1.6, 1.4 + (i % 2) * 0.6, 2.2]));
      break;
    }
    case 'warden': { // armored giant: molten seams through black plate, a chained censer
      const bone = '#d8cdb8', plate = '#22191b', seam = '#ff7a1a';
      for (const sd of [-1, 1]) { // skeleton (always there; plates hide it)
        B.push(part(GB.box(0.32, 2.6, 0.32), bone, [sd * 0.9, 1.3, 0]));
        B.push(part(GB.box(0.3, 2.2, 0.3), bone, [sd * 2.05, 3.7, 0.1], [0, 0, sd * 0.25]));
      }
      B.push(part(GB.box(0.35, 2.4, 0.35), bone, [0, 3.6, -0.2]));
      for (let i = 0; i < 4; i++) B.push(part(GB.box(2.2 - i * 0.2, 0.16, 1.1), bone, [0, 3.0 + i * 0.45, 0.1]));
      B.push(part(GB.box(1.0, 1.0, 1.0), bone, [0, 5.4, 0.1]));
      for (const sd of [-1, 1]) B.push(part(GB.box(0.22, 0.16, 0.06), '#ffb02e', [sd * 0.24, 5.5, 0.62]));
      // p1: chest plate, pauldrons, helm
      P1.push(part(GB.box(3.0, 2.3, 1.6), plate, [0, 3.7, 0.05]));
      P1.push(part(GB.box(2.6, 0.14, 0.2), seam, [0, 3.4, 0.86]), part(GB.box(0.14, 1.9, 0.2), seam, [0.55, 3.8, 0.86], [0, 0, 0.3]));
      for (const sd of [-1, 1]) P1.push(part(GB.box(1.4, 0.7, 1.6), '#3a2a2c', [sd * 2.0, 4.85, 0], [0, 0, sd * -0.3]), part(GB.box(1.0, 0.1, 0.1), seam, [sd * 2.0, 4.85, 0.82], [0, 0, sd * -0.3]));
      P1.push(part(GB.box(1.3, 1.2, 1.3), plate, [0, 5.45, 0.1]), part(GB.box(0.9, 0.12, 0.05), '#ffd23d', [0, 5.45, 0.78]));
      for (let i = 0; i < 4; i++) P1.push(part(GB.cone(0.25 - i * 0.04, 1.2 - i * 0.15, 5), i % 2 ? '#ffd23d' : '#ff5a1a', [0, 6.3 + i * 0.2, -0.1 - i * 0.05]));
      // p2: greaves, gauntlets, back plate
      for (const sd of [-1, 1]) P2.push(part(GB.box(0.95, 2.4, 0.95), plate, [sd * 0.9, 1.25, 0]), part(GB.box(0.1, 1.8, 0.1), seam, [sd * 0.9, 1.3, 0.5]), part(GB.box(0.9, 0.9, 0.9), '#3a2a2c', [sd * 2.35, 2.5, 0.3]));
      P2.push(part(GB.box(2.8, 2.6, 0.4), plate, [0, 3.9, -0.9]));
      R.weapon = [part(GB.cyl(0.12, 0.12, 0.2, 6), '#5a3a2a', [0, 0, 0])];
      for (let i = 0; i < 6; i++) R.weapon.push(part(GB.tor(0.28, 0.08, 4, 8), '#8f8f99', [0, -0.4 - i * 0.48, 0], [0, i % 2 ? Math.PI / 2 : 0, 0]));
      R.weapon.push(part(GB.cyl(0.6, 0.45, 0.9, 6), '#3a2a2c', [0, -3.4, 0]), part(GB.cone(0.45, 0.9, 5), '#ff7a1a', [0, -2.6, 0]), part(GB.cone(0.25, 0.7, 5), '#ffd23d', [0, -2.5, 0]));
      R.weaponAt = [2.6, 4.6, 0.6];
      break;
    }
    case 'shogun': { // a towering empty suit: no body inside, a mask floats where the face should be
      const lac = '#7a1414', lac2 = '#1a0e0e', gold = '#ffd23d';
      for (let i = 0; i < 4; i++) for (const sd of [-1, 0, 1]) B.push(part(GB.box(1.0, 0.38, 0.18), i % 2 ? lac : lac2, [sd * 1.05, 0.9 + i * 0.4, 0.75 - Math.abs(sd) * 0.15], [0.12, sd * 0.25, 0]));
      B.push(part(GB.box(2.4, 1.7, 1.4), lac, [0, 3.2, 0]), part(GB.box(1.8, 1.3, 0.2), '#050307', [0, 3.3, 0.62])); // cuirass, hollow inside
      for (let i = 0; i < 3; i++) B.push(part(GB.box(2.5, 0.12, 1.45), gold, [0, 2.55 + i * 0.5, 0]));
      B.push(part(GB.box(1.1, 0.35, 1.0), lac2, [0, 4.2, 0])); // collar: empty above it
      B.push(part(GB.box(0.9, 1.0, 0.15), '#f4f0e8', [0, 5.0, 0.35]));                          // the floating mask
      B.push(part(GB.box(0.7, 0.07, 0.05), '#d8322a', [0, 5.2, 0.44]), part(GB.box(0.07, 0.45, 0.05), '#d8322a', [0, 4.85, 0.44]));
      for (const sd of [-1, 1]) B.push(part(GB.box(0.22, 0.1, 0.05), '#0b0b14', [sd * 0.22, 5.1, 0.45]));
      for (const sd of [-1, 1]) P1.push(part(GB.box(1.5, 1.6, 0.3), lac, [sd * 1.75, 3.6, 0.1], [0, 0, sd * -0.35]), part(GB.box(1.5, 0.12, 0.32), gold, [sd * 1.75, 3.0, 0.1], [0, 0, sd * -0.35]));
      P1.push(part(GB.sph(0.95, 8, 4), lac2, [0, 5.55, 0], 0, [1.25, 0.55, 1.25]), part(GB.tor(1.0, 0.1, 3, 12, Math.PI), gold, [0, 5.85, 0.25]));
      P2.push(part(GB.box(0.3, 1.6, 0.3), lac2, [-1.3, 3.0, -0.5]), part(GB.box(0.3, 1.6, 0.3), lac2, [1.3, 3.0, -0.5])); // back banners' poles
      for (const sd of [-1, 1]) P2.push(part(GB.box(0.9, 1.3, 0.05), '#d8322a', [sd * 1.3, 4.3, -0.5]));
      R.weapon = [part(GB.box(0.22, 6.0, 0.08), '#e6ecf5', [0, 3.0, 0]), part(GB.box(0.55, 0.18, 0.3), gold, [0, 0, 0]), part(GB.box(0.16, 1.0, 0.16), lac2, [0, -0.55, 0])];
      R.weaponAt = [2.4, 2.6, 0.9];
      break;
    }
    case 'echo': { // a tall mirrored frame that copies your squad
      const neonA = '#ff2bd6', neonB = '#2bf0ff', dark = '#140b24';
      for (const sd of [-1, 1]) B.push(part(GB.box(0.5, 6.6, 0.5), dark, [sd * 2.6, 3.3, 0]), part(GB.box(0.12, 6.2, 0.12), neonB, [sd * 2.35, 3.3, 0.28]));
      B.push(part(GB.box(5.7, 0.5, 0.5), dark, [0, 0.25, 0]), part(GB.box(5.7, 0.5, 0.5), dark, [0, 6.6, 0]));
      R.mirror = true;
      for (let i = 0; i < 5; i++) P1.push(part(GB.cone(0.35, 1.2 - Math.abs(i - 2) * 0.25, 4), i % 2 ? neonA : dark, [-1.6 + i * 0.8, 7.3, 0]));
      P1.push(part(GB.box(5.2, 0.12, 0.12), neonA, [0, 6.3, 0.28]));
      for (const sd of [-1, 1]) P2.push(part(GB.box(0.9, 2.2, 0.7), dark, [sd * 3.1, 1.2, 0], [0, 0, sd * 0.1]), part(GB.box(0.12, 1.8, 0.12), neonA, [sd * 3.1, 1.2, 0.4]));
      break;
    }
    case 'otherkai': { // a giant version of you, half void
      for (const pt of kaiParts(arch)) { pt.p = pt.p.map(v => v * 5); pt.s = pt.s.map(v => v * 5); B.push(pt); }
      P1.push(part(GB.box(2.2, 3.0, 0.2), '#c4182d', [0.4, 3.0, 1.3], [-0.2, 0, 0.1]));           // the scarf trail, down his back
      for (let i = 0; i < 4; i++) P2.push(part(GB.oct(0.5), '#f4f2ff', [-2.8 + i * 1.9, 6.4 + (i % 2) * 0.6, 0]));
      R.halfVoid = true;
      break;
    }
  }
  return R;
}

// ---- scenery kits per stage -----------------------------------------------------
function sceneryProtos(st) {
  const p = STAGES[st - 1].pal;
  switch (st) {
    case 1: return [ // flooded stone ruins
      { w: 3, parts: [part(GB.box(3, 2.2, 0.8), p.stone, [0, 1.1, 0]), part(GB.box(1, 0.7, 0.8), p.stone, [-0.8, 2.5, 0]), part(GB.box(0.7, 0.4, 0.82), p.stone2, [0.9, 1.6, 0])] },
      { w: 3, parts: [part(GB.box(0.8, 4, 0.8), p.stone, [-1.2, 2, 0]), part(GB.box(0.8, 4, 0.8), p.stone, [1.2, 2, 0]), part(GB.box(3.4, 0.8, 1), p.stone2, [0, 4.3, 0])] },
      { w: 1, parts: [part(GB.cyl(0.4, 0.45, 2.6, 7), p.stone, [0, 1.3, 0]), part(GB.box(1, 0.3, 1), p.stone2, [0, 0.15, 0])] },
      { w: 2, parts: [part(GB.cyl(0.12, 0.18, 2.4, 5), '#4a3a2c', [0, 1.2, 0]), part(GB.box(1.2, 0.08, 0.08), '#4a3a2c', [0.4, 2.0, 0], [0, 0, 0.5]), part(GB.ico(0.9, 0), p.leaf, [0, 2.6, 0], 0, [1, 0.7, 1])] },
    ];
    case 2: return [ // burning tower road
      { w: 3, parts: [part(GB.cyl(1.4, 1.7, 9, 6), p.stone, [0, 4.5, 0]), part(GB.cone(1.7, 2.4, 6), '#1a1012', [0, 10.2, 0]), part(GB.box(0.4, 0.8, 0.2), p.glow, [0, 6, -1.4]), part(GB.box(0.4, 0.8, 0.2), p.glow, [0.7, 3.5, -1.3])] },
      { w: 1, parts: [part(GB.cyl(0.5, 0.3, 0.6, 6), '#2a2022', [0, 1.1, 0]), part(GB.cyl(0.12, 0.12, 0.9, 5), '#2a2022', [0, 0.45, 0]), part(GB.cone(0.4, 0.9, 5), p.lava, [0, 1.8, 0]), part(GB.cone(0.22, 0.6, 5), '#ffd23d', [0, 1.8, 0])] },
      { w: 1, parts: [part(GB.cone(0.6, 5, 4), p.stone2, [0, 2.5, 0]), part(GB.box(0.2, 0.6, 0.05), p.glow, [0, 2.2, -0.35])] },
      { w: 3, parts: [part(GB.box(3, 1.8, 1.2), p.stone, [0, 0.9, 0]), part(GB.box(0.5, 2.6, 0.5), p.stone2, [-1.2, 1.3, 0]), part(GB.box(0.5, 2.6, 0.5), p.stone2, [1.2, 1.3, 0])] },
    ];
    case 3: return [ // torii road at dusk
      { w: 1.2, parts: [part(GB.box(0.5, 0.25, 0.5), p.stone, [0, 0.12, 0]), part(GB.cyl(0.12, 0.12, 0.9, 5), p.stone, [0, 0.7, 0]), part(GB.box(0.55, 0.35, 0.55), '#ffd9a0', [0, 1.3, 0]), part(GB.cone(0.5, 0.35, 4), p.stone, [0, 1.65, 0], [0, Math.PI / 4, 0])] },
      { w: 3, parts: [part(GB.box(2.4, 1.4, 2.4), '#5a3a2a', [0, 0.7, 0]), part(GB.cone(2.3, 0.9, 4), '#2a2226', [0, 1.85, 0], [0, Math.PI / 4, 0]), part(GB.box(1.8, 1.1, 1.8), '#5a3a2a', [0, 2.7, 0]), part(GB.cone(1.9, 0.8, 4), '#2a2226', [0, 3.6, 0], [0, Math.PI / 4, 0]), part(GB.cone(0.6, 0.9, 4), '#2a2226', [0, 4.3, 0], [0, Math.PI / 4, 0])] },
      { w: 2, parts: [part(GB.cyl(0.14, 0.2, 2, 5), '#3a2418', [0, 1, 0]), part(GB.ico(1.0, 0), p.leaf, [0, 2.4, 0]), part(GB.ico(0.7, 0), '#ff9a3d', [0.6, 2.0, 0.2])] },
    ];
    case 4: return [ // neon sprawl
      { w: 3, parts: [part(GB.box(3, 12, 3), p.bld, [0, 6, 0]), part(GB.box(3.05, 0.25, 3.05), p.neonA, [0, 4, 0]), part(GB.box(3.05, 0.25, 3.05), p.neonB, [0, 8, 0]), part(GB.box(0.2, 10, 0.2), p.neonB, [-1.5, 5, -1.5])] },
      { w: 3, parts: [part(GB.box(2.6, 7, 2.6), p.bld2, [0, 3.5, 0]), part(GB.box(2.2, 1.2, 0.1), p.neonA, [0, 5.5, -1.36]), part(GB.box(1.2, 0.4, 0.1), p.neonB, [0, 3.2, -1.36])] },
      { w: 2, parts: [part(GB.box(1.6, 1.4, 1.4), '#3a3a48', [0, 0.7, 0]), part(GB.box(0.5, 0.3, 0.1), '#2bf0ff', [0, 0.9, -0.72]), part(GB.box(2.2, 0.4, 0.5), '#2a2a36', [0.4, 0.3, 0.9], [0, 0.4, 0.2])] },
    ];
    default: return [ // floating rubble in the void
      { w: 2, float: true, parts: [part(GB.ico(1.1, 0), p.rock, [0, 0, 0], 0, [1.3, 0.8, 1])] },
      { w: 1, float: true, parts: [part(GB.oct(0.6), p.rock, [0, 0, 0], 0, [0.6, 1.8, 0.6])] },
      { w: 2, float: true, parts: [part(GB.dod(0.8), p.rock, [0, 0, 0])] },
    ];
  }
}

// ============================================================================
const GFX = {
  ok: false, stageKey: '', world: null,
  init(canvas) {
    try {
      this.R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { console.warn('WebGL unavailable', e); return false; }
    this.R.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.cam = new THREE.PerspectiveCamera(58, 1, 0.5, 260);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404060, 0.42); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.72); this.sun.position.set(-4, 10, 6); this.scene.add(this.sun); this.scene.add(this.sun.target);
    const ramp = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
    this.grad = new THREE.DataTexture(ramp, 3, 1, THREE.RGBAFormat);
    this.grad.minFilter = this.grad.magFilter = THREE.NearestFilter; this.grad.generateMipmaps = false; this.grad.needsUpdate = true;
    this.rimU = { value: new THREE.Color(0xffffff) }; this.rimS = { value: 0.55 };
    this.toon = this.toonMat();
    this.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.outlineMat = new THREE.MeshBasicMaterial({ color: 0x0b0b14, side: THREE.BackSide });
    this.whiteLine = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide });
    this.cyanLine = new THREE.MeshBasicMaterial({ color: 0x2bf0ff, side: THREE.BackSide });
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    this.ghostMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false });
    this.addMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.groundMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: this.grad });
    this.buildShared();
    this.ok = true;
    return true;
  },
  toonMat(extra) {
    const m = new THREE.MeshToonMaterial(Object.assign({ color: 0xffffff, vertexColors: true, gradientMap: this.grad }, extra || {}));
    const rimU = this.rimU, rimS = this.rimS;
    m.onBeforeCompile = sh => {
      sh.uniforms.rimColor = rimU; sh.uniforms.rimStrength = rimS;
      sh.fragmentShader = 'uniform vec3 rimColor;\nuniform float rimStrength;\n' + sh.fragmentShader.replace(
        'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
        'float rimF = 1.0 - clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 );\n\toutgoingLight += rimColor * diffuseColor.rgb * smoothstep( 0.6, 0.66, rimF ) * rimStrength;\n\tgl_FragColor = vec4( outgoingLight, diffuseColor.a );');
    };
    return m;
  },
  resize(w, h, dpr) {
    if (!this.ok) return;
    this.R.setPixelRatio(dpr); this.R.setSize(w, h, false);
    this.cam.aspect = w / h;
    // portrait: widen the vertical FOV so the 10-unit road fits the narrow screen
    this.cam.fov = clamp(32 / Math.max(0.35, Math.min(1, w / h)), 50, 72);
    this.cam.updateProjectionMatrix();
    this.W = w; this.H = h;
  },
  // ---------------------------------------------------------------------------
  buildShared() {
    this.k = {};
    const K = this.k;
    const add = (o) => new THREE.MeshBasicMaterial(Object.assign({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }, o || {}));
    K.blob = new Kit(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), 480, { mat: this.shadowMat, outline: false, order: 1 });
    // coin discs: big upright gold discs, value printed on them by the overlay
    K.disc = new Kit(build([part(GB.cyl(0.62, 0.62, 0.12, 14), '#ffc83d', [0, 0, 0], [Math.PI / 2, 0, 0]), part(GB.cyl(0.48, 0.48, 0.14, 14), '#e8a21a', [0, 0, 0], [Math.PI / 2, 0, 0])]), 40, { ol: 0.04 });
    K.cart = new Kit(build([
      part(GB.box(1.4, 0.6, 1.8), '#7a4a22', [0, 0.65, 0]), part(GB.box(1.5, 0.12, 1.9), '#4a2a12', [0, 0.98, 0]),
      ...[-1, 1].flatMap(sx => [-1, 1].map(sz => part(GB.cyl(0.32, 0.32, 0.12, 10), '#2a1a10', [sx * 0.75, 0.32, sz * 0.6], [0, 0, Math.PI / 2]))),
      part(GB.ico(0.62, 0), '#ffd23d', [0, 1.3, 0], 0, [1.2, 0.7, 1.4]), part(GB.ico(0.3, 0), '#fff3a0', [0.3, 1.6, 0.2]),
      part(GB.box(0.08, 1.4, 0.08), '#4a2a12', [-0.6, 1.5, -0.8]), part(GB.box(0.7, 0.45, 0.04), '#ffd23d', [-0.25, 2.0, -0.8]),
    ]), 4, { ol: 0.05 });
    K.buff = new Kit(build([part(GB.ico(0.42, 0), '#3fdc5c'), part(GB.box(0.5, 0.14, 0.14), '#ffffff', [0, 0, 0.36]), part(GB.box(0.14, 0.5, 0.14), '#ffffff', [0, 0, 0.36])]), 8, { ol: 0.04 });
    const spikes = [part(GB.ico(0.36, 0), '#e8283e')];
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; spikes.push(part(GB.cone(0.12, 0.34, 4), '#8c0f24', [Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0], [0, 0, a - Math.PI / 2])); }
    spikes.push(part(GB.box(0.36, 0.1, 0.1), '#ffffff', [0, 0, 0.36]));
    K.debuff = new Kit(build(spikes), 8, { ol: 0.04 });
    K.gold = new Kit(build([part(GB.dod(0.6), '#ffd23d'), part(GB.oct(0.3), '#ffffff', [0, 0, 0.45])]), 2, { ol: 0.05 });
    K.ring = new Kit(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), 24, { mat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }), outline: false, color: true, order: 2 });
    K.bar = new Kit(build([part(GB.box(1, 1.2, 0.6), '#9a9488', [0, 0.6, 0]), part(GB.box(1.01, 0.22, 0.62), '#ffc83d', [0, 0.95, 0]), part(GB.box(1.01, 0.1, 0.62), '#1a1a22', [0, 0.95, 0])]), 10, { ol: 0.04, color: true });
    // explosive barrel: red drum, hazard bands, a lit fuse cap
    K.barrel = new Kit(build([
      part(GB.cyl(0.5, 0.5, 1.2, 12), '#d8262f', [0, 0.6, 0]), part(GB.cyl(0.52, 0.52, 0.16, 12), '#ffd23d', [0, 0.35, 0]), part(GB.cyl(0.52, 0.52, 0.16, 12), '#ffd23d', [0, 0.85, 0]),
      part(GB.cyl(0.52, 0.52, 0.06, 12), '#1a1a22', [0, 0.35, 0]), part(GB.cyl(0.52, 0.52, 0.06, 12), '#1a1a22', [0, 0.85, 0]),
      part(GB.cyl(0.42, 0.42, 0.06, 12), '#8a141c', [0, 1.22, 0]), part(GB.cyl(0.08, 0.08, 0.2, 6), '#2a2a33', [0.2, 1.32, 0]), part(GB.ico(0.1, 0), '#fff2a0', [0.2, 1.46, 0]),
    ]), 8, { ol: 0.05, color: true });
    // gate bands: a translucent floor band, glowing edge strips and posts at the band edges
    K.band = new Kit(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), 24, { mat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.58, depthWrite: false }), outline: false, color: true, order: 2 });
    K.bandWall = new Kit(new THREE.PlaneGeometry(1, 1), 24, { mat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), outline: false, color: true, order: 3 });
    K.bandEdge = new Kit(new THREE.BoxGeometry(1, 0.08, 0.3), 48, { mat: this.glow, outline: false, color: true });
    K.post = new Kit(build([part(GB.cyl(0.1, 0.12, 3.4, 6), '#e6e8f2', [0, 1.7, 0]), part(GB.box(0.34, 0.2, 0.34), '#2a2a33', [0, 3.45, 0])]), 32, { ol: 0.04 });
    K.postCap = new Kit(new THREE.OctahedronGeometry(0.22, 0), 32, { mat: this.glow, outline: false, color: true });
    K.divider = new Kit(build([part(GB.box(0.35, 1.4, 4), '#2a2a3a', [0, 0.7, 0]), part(GB.box(0.4, 0.12, 4.02), '#ffd23d', [0, 1.35, 0])]), 40, { ol: 0.04 });
    K.haz = new Kit(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), 16, { mat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }), outline: false, color: true, order: 2 });
    K.tdisc = new Kit(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), 6, { mat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }), outline: false, color: true, order: 2 });
    // gunfire. A soldier is 1 unit tall; a tracer is a 1.2 x 0.12 white core inside a #FFD66B glow,
    // with a trail 2.5x its length at 35% that fades to nothing. Additive, no depth writes, drawn
    // after the road and the crowd so nothing hides it.
    const tAdd = o => new THREE.MeshBasicMaterial(Object.assign({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }, o));
    const gold = [1, 0.84, 0.42];
    K.trail = new Kit(crossQuad(3.0, 0.12, gold, [0, 0, 0]), 900, { mat: tAdd({ opacity: 0.35 }), outline: false, color: true, order: 20 });
    K.tglow = new Kit(crossQuad(1.5, 0.36, gold, gold), 900, { mat: tAdd({ opacity: 0.55 }), outline: false, color: true, order: 21 });
    K.tracer = new Kit(crossQuad(1.2, 0.12, [1, 1, 1], [1, 1, 1]), 900, { mat: tAdd({}), outline: false, color: true, order: 22 });
    K.orb = new Kit(build([part(GB.ico(0.26, 0), '#ffb35a'), part(GB.ico(0.14, 0), '#ffffff')]), 160, { mat: this.addMat, outline: false });
    K.slash = new Kit(new THREE.TorusGeometry(0.8, 0.06, 3, 14, Math.PI).rotateX(-Math.PI / 2), 200, { mat: add({ opacity: 0.85 }), outline: false, color: true });
    K.etracer = new Kit(build([part(GB.cone(0.11, 0.6, 5), '#ff5a3a', [0, 0, 0.2], [Math.PI / 2, 0, 0]), part(GB.cyl(0.1, 0.03, 0.9, 5), '#ffb02e', [0, 0, -0.4], [Math.PI / 2, 0, 0])]), 100, { mat: add({ vertexColors: true }), outline: false });
    K.part = new Kit(new THREE.OctahedronGeometry(0.5, 0), 1600, { mat: new THREE.MeshBasicMaterial({ color: 0xffffff }), outline: false, color: true });
    K.casing = new Kit(new THREE.BoxGeometry(0.06, 0.06, 0.13), 200, { mat: new THREE.MeshBasicMaterial({ color: 0xe8b84a }), outline: false });
    K.mflash = new Kit(starQuad(), 240, { mat: tAdd({ opacity: 0.95 }), outline: false, color: true, order: 23 });
    K.crate = [0, 1, 2].map(r => new Kit(build(crateParts(r)), 6, { ol: 0.05, color: true }));
    K.crown = new Kit(build([part(GB.cyl(0.22, 0.2, 0.12, 6), '#ffd23d'), ...[0, 1, 2, 3, 4].map(i => part(GB.cone(0.05, 0.16, 4), '#ffd23d', [Math.cos(i * 1.26) * 0.18, 0.12, Math.sin(i * 1.26) * 0.18]))]), 20, { ol: 0.03 });
    K.platform = new Kit(build([part(GB.cyl(1, 0.55, 1.4, 18), '#101018', [0, -0.72, 0]), part(GB.tor(1, 0.025, 3, 28), '#ffffff', [0, 0, 0], [Math.PI / 2, 0, 0])]), 1, { outline: false });
    this.enemyKits = {};
  },
  enemyKit(look) {
    let k = this.enemyKits[look];
    if (k) return k;
    const geo = build(enemyParts(look));
    const crawl = look === 'crawler' || look === 'bigcrawler' || look === 'shieldcrawler' || look === 'twin';
    k = new Kit(geo, 220, { ol: 0.05, color: true, olMat: crawl ? this.whiteLine : look === 'shade' ? this.cyanLine : this.outlineMat });
    this.enemyKits[look] = k;
    return k;
  },
  // per level: squad meshes for the current archetype + skin, stage world, base
  onLevel() { this.buildSquad(G.arch, skinById(Store.d.skin), G.weapon); this.setStage(G.stage); this.dropBoss(); },
  // one body mesh per soldier up to 120 drawn; the gun in their hands follows the run's weapon level
  buildSquad(arch, skin, lv) {
    lv = lv || 1;
    const key = arch + '|' + skin.id + '|' + lv;
    if (this.squadKey === key) return;
    this.squadKey = key;
    for (const n of ['body', 'leg', 'kai', 'after']) if (this.k[n]) { this.k[n].dispose(); this.k[n] = null; }
    const sp = soldierParts(arch, skin);
    const geo = build(sp.parts.concat(gunParts(lv, 0.2, 0.72, -0.08)), sp.post);
    const asset = ASSETS.units[arch]; // the player's own art, when they dropped some in assets/units/
    if (asset && asset.geo) this.k.body = new Kit(asset.geo, 128, { mat: asset.mat, ol: 0.03 * asset.scale });
    else this.k.body = new Kit(geo, 128, { ol: 0.035, olMat: skin.fx.includes('glitch') ? this.cyanLine : this.outlineMat });
    this.k.leg = new Kit(legGeo(skinPal(skin, arch).c2), 264, { ol: 0.03 });
    this.k.kai = new Kit(build(kaiParts(arch, lv)), 2, { ol: 0.04 });
    if (skin.fx.includes('after')) this.k.after = new Kit(geo.clone(), 128, { mat: this.ghostMat, outline: false });
  },
  setStage(st) {
    if (this.stageKey === 'st' + st) return;
    this.stageKey = 'st' + st;
    const p = STAGES[st - 1].pal;
    document.getElementById('game').style.background = `linear-gradient(180deg, ${p.sky1} 0%, ${p.sky2} 52%, ${p.fog} 70%, ${p.fog} 100%)`;
    this.scene.fog = new THREE.Fog(new THREE.Color(p.fog), 55, 150);
    this.hemi.color.set(st === 4 ? 0xb9a0ff : st === 2 ? 0xffb090 : 0xffffff);
    this.hemi.groundColor.set(st === 5 ? 0x202030 : 0x3a3048);
    this.rimU.value.set(st === 5 ? 0xffffff : st === 4 ? 0xff9af0 : st === 2 ? 0xffd0a0 : 0xffffff);
    for (const n of ['road', 'curb', 'dash', 'side', 'torii', 'sky']) if (this.k[n]) { this.k[n].dispose(); this.k[n] = null; }
    if (this.scen) for (const k of this.scen) k.dispose();
    if (this.ground) { this.world.remove(this.ground); this.ground = null; }
    const K = this.k;
    K.road = new Kit(new THREE.BoxGeometry(ROAD * 2, 0.1, 4), 40, { outline: false, color: true, mat: this.toonMat({ vertexColors: false }) });
    K.curb = new Kit(new THREE.BoxGeometry(0.45, 0.22, 4), 80, { outline: false, color: true, mat: st === 5 || st === 4 ? this.glow : this.toonMat({ vertexColors: false }) });
    K.dash = new Kit(new THREE.BoxGeometry(0.12, 0.04, 1.6), 100, { outline: false, mat: st === 4 || st === 5 ? new THREE.MeshBasicMaterial({ color: new THREE.Color(p.line) }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(p.line), transparent: true, opacity: 0.6 }) });
    if (p.ground) {
      this.ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ color: new THREE.Color(p.ground), gradientMap: this.grad }));
      this.ground.position.y = -0.08; this.world.add(this.ground);
    }
    // stage strips beside the road: water, lava runoff, neon edges
    const stripCol = st === 1 ? p.water : st === 2 ? p.lava : st === 4 ? p.neonB : null;
    if (stripCol) K.side = new Kit(new THREE.BoxGeometry(st === 1 ? 9 : 1, 0.06, 6), 70, { outline: false, mat: st === 1 ? new THREE.MeshBasicMaterial({ color: new THREE.Color(stripCol), transparent: true, opacity: 0.75 }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(stripCol) }) });
    this.scenProtos = sceneryProtos(st);
    this.scen = this.scenProtos.map(pr => new Kit(build(pr.parts), 36, { ol: st === 5 ? 0.08 : 0.07, olMat: st === 5 ? this.whiteLine : this.outlineMat }));
    if (st === 3) K.torii = new Kit(build([part(GB.cyl(0.32, 0.36, 6.4, 8), STAGES[2].pal.torii, [-6.2, 3.2, 0]), part(GB.cyl(0.32, 0.36, 6.4, 8), STAGES[2].pal.torii, [6.2, 3.2, 0]), part(GB.box(15, 0.6, 0.8), STAGES[2].pal.toriiTop, [0, 6.6, 0]), part(GB.box(13.6, 0.4, 0.6), STAGES[2].pal.torii, [0, 5.4, 0]), part(GB.box(0.6, 1.2, 0.5), STAGES[2].pal.torii, [0, 6.0, 0])]), 8, { ol: 0.1 });
    K.sky = new Kit(new THREE.BoxGeometry(1, 1, 1), 26, { outline: false, mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(st === 5 ? '#08080e' : shade(p.fog, -0.28)) }) });
    this.slotKey = '';
  },
  dropBoss() {
    if (this.rig) { this.world.remove(this.rig.root); if (this.rig.twin) this.world.remove(this.rig.twin); for (const f of this.rig.falling) this.world.remove(f.g); }
    this.rig = null; this.rigKey = '';
  },
  // a mesh + its ink hull from a parts list
  partsMesh(parts, mat, line, ol, post) {
    const g = new THREE.Group();
    if (!parts || !parts.length) return g;
    const geo = build(parts, post);
    g.add(new THREE.Mesh(geo, mat));
    g.add(new THREE.Mesh(hullGeo(geo, ol), line));
    return g;
  },
  // Colossal boss rig: base + breakable groups (p1 at 66%, p2 at 33%) + weapon, own material for the phase tint
  bossRig(kind, arch) {
    const key = kind;
    if (this.rigKey === key && this.rig) return this.rig;
    const keep = this.rig && this.rig.kind === kind ? this.rig.broken : 0;
    this.dropBoss();
    const R = bossRigParts(kind, arch);
    const mat = this.toonMat(), glass = this.toonMat({ transparent: true, opacity: 0.55, depthWrite: false });
    const line = kind === 'otherkai' ? this.whiteLine : kind === 'echo' ? this.cyanLine : this.outlineMat;
    const halfVoid = R.halfVoid ? (pos, col) => { for (let i = 0; i < pos.length / 3; i++) if (pos[i * 3] > 0.02) { col[i * 3] *= 0.07; col[i * 3 + 1] *= 0.06; col[i * 3 + 2] *= 0.1; } } : null;
    const make = () => {
      const root = new THREE.Group(), body = new THREE.Group();
      root.add(body);
      if (kind === 'otherkai') body.rotation.y = Math.PI; // kai's parts face away; turn him around
      body.add(this.partsMesh(R.base, mat, line, 0.12, halfVoid));
      if (R.glass.length) body.add(this.partsMesh(R.glass, glass, line, 0.1));
      const p1 = this.partsMesh(R.p1, mat, line, 0.1, halfVoid), p2 = this.partsMesh(R.p2, mat, line, 0.1, halfVoid);
      if (R.glassP1) p1.add(this.partsMesh(R.glassP1, glass, line, 0.1));
      body.add(p1); body.add(p2);
      let weapon = null;
      if (R.weapon) { weapon = this.partsMesh(R.weapon, mat, line, 0.08); weapon.position.set(...R.weaponAt); body.add(weapon); }
      const inners = {}, weapons = {};
      if (R.mirror) { // the echo shows a giant copy of the squad it is mirroring (all four built, one shown)
        const sk = { id: 'echo', c: '#7fe9ff', c2: '#3a8fb0', h: '#e8fbff', t: '#ff2bd6', fx: ['glitch'] };
        for (const a of ARCH_ORDER) {
          const sp = soldierParts(a, sk), inner = this.partsMesh(sp.parts, mat, this.cyanLine, 0.03);
          inner.scale.setScalar(4.6); inner.rotation.y = Math.PI; inner.position.set(0, 0.5, 0); inner.visible = false;
          body.add(inner); inners[a] = inner;
        }
        const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 5.9), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: 0.22, depthWrite: false }));
        glassPane.position.set(0, 3.4, 0.35); body.add(glassPane);
      }
      if (kind === 'otherkai') for (const a of ARCH_ORDER) { // his weapon follows the squad he is copying
        const w = this.partsMesh(kaiWeaponParts(a), mat, line, 0.08, halfVoid);
        w.position.set(-1.6, 3.6, -1.0); w.visible = false; body.add(w); weapons[a] = w;
      }
      return { root, body, p1, p2, weapon, inners, weapons };
    };
    const a = make();
    const rig = Object.assign(a, { kind, arch, mat, glass, falling: [], broken: 0, twin: null });
    if (kind === 'shogun') { const t = make(); rig.twin = t.root; rig.twinBody = t.body; rig.twinWeapon = t.weapon; t.root.visible = false; this.world.add(t.root); }
    this.world.add(rig.root);
    this.rig = rig; this.rigKey = key;
    for (let ph = 1; ph <= keep; ph++) { const g = rig['p' + ph]; if (g) g.visible = false; }
    rig.broken = keep;
    return rig;
  },
  // armor falls off: the group detaches into the world and tumbles away
  breakOff(rig, ph) {
    const g = rig['p' + ph];
    if (!g || !g.visible) return;
    this.world.attach(g);
    rig.falling.push({ g, vy: 4, vx: rand(-2, 2), vz: rand(1, 3), spin: rand(-2, 2), t: 0 });
  },
  tickFalling(rig, dt) {
    for (const f of rig.falling) {
      f.t += dt; f.vy -= 22 * dt;
      f.g.position.x += f.vx * dt; f.g.position.y = Math.max(-6, f.g.position.y + f.vy * dt); f.g.position.z += f.vz * dt;
      f.g.rotation.x += f.spin * dt; f.g.rotation.z += f.spin * 0.7 * dt;
      if (f.t > 1.8) { this.world.remove(f.g); f.done = true; }
    }
    if (rig.falling.some(f => f.done)) rig.falling = rig.falling.filter(f => !f.done);
  },
  // 3D portrait of one soldier for the menus, rendered once and cached as an image
  preview(skin, arch, size) {
    size = size || 192;
    if (!this.pv) {
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      let r;
      try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return null; }
      r.setClearColor(0x000000, 0);
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x404060, 0.6));
      const d = new THREE.DirectionalLight(0xffffff, 0.95); d.position.set(2, 4, -3); sc.add(d);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cam.position.set(1.25, 1.2, -3.1); cam.lookAt(0, 0.66, 0);
      this.pv = { cv, r, sc, cam, cache: {} };
    }
    const key = skin.id + '|' + arch;
    if (this.pv.cache[key]) return this.pv.cache[key];
    const g = new THREE.Group(), geos = [];
    const sp = soldierParts(arch, skin), geo = build(sp.parts, sp.post), hull = hullGeo(geo, 0.03);
    geos.push(geo, hull);
    g.add(new THREE.Mesh(geo, this.toon)); g.add(new THREE.Mesh(hull, this.outlineMat));
    const lg = legGeo(skinPal(skin, arch).c2), lh = hullGeo(lg, 0.03); geos.push(lg, lh);
    for (const sd of [-1, 1]) for (const [gg, mm] of [[lg, this.toon], [lh, this.outlineMat]]) { const m = new THREE.Mesh(gg, mm); m.position.set(sd * 0.1, 0.42, 0); m.rotation.x = sd * 0.25; g.add(m); }
    g.rotation.y = 0.35;
    this.pv.sc.add(g);
    this.pv.r.render(this.pv.sc, this.pv.cam);
    const url = this.pv.cv.toDataURL('image/png');
    this.pv.sc.remove(g); for (const x of geos) x.dispose();
    return (this.pv.cache[key] = url);
  },
  // ---------------------------------------------------------------------------
  // intro (0..1): the 1.5s push-in toward a boss as its name card lands
  camera(P, camX, push, shake, intro, focusZ) {
    const c = this.cam;
    const back = 12.5 - push * 4, h = 9.2 - push * 2.5;
    const k = intro || 0, fz = focusZ || P + 15;
    const cz = P - back + k * Math.max(0, fz - P - 14) * 0.55;
    c.position.set(camX + (shake ? rand(-1, 1) * shake * 0.02 : 0), h + k * 1.5 + (shake ? rand(-1, 1) * shake * 0.02 : 0), -cz);
    _v.set(camX * 0.55, k * 3.5, -lerp(P + 15, fz, k));
    c.lookAt(_v);
    this.sun.position.set(c.position.x - 6, 14, c.position.z + 4);
    this.sun.target.position.set(c.position.x, 0, c.position.z - 20);
    if (this.ground) this.ground.position.set(c.position.x, -0.08, c.position.z - 150);
  },
  // world -> screen (px) and pixels-per-unit at that depth
  project(x, y, z, out) {
    out = out || {};
    _v.set(x, y, -z).project(this.cam);
    out.x = (_v.x + 1) / 2 * this.W; out.y = (1 - _v.y) / 2 * this.H; out.vis = _v.z < 1 && _v.z > -1;
    const d = Math.max(0.5, this.cam.position.distanceTo(_p.set(x, y, -z)));
    out.s = this.H / (2 * Math.tan(this.cam.fov * Math.PI / 360)) / d;
    return out;
  },
  // static-ish world: road tiles, curbs, scenery slots. Only rebuilt when the slot range moves.
  // plat: { z0, z1 } in the last fight's final phase: the road falls away, a floating platform remains
  layoutWorld(st, P, plat) {
    const tile = 4, k0 = Math.floor((P - 16) / tile), k1 = k0 + 38;
    const slot = 8, s0 = Math.floor((P - 16) / slot), s1 = s0 + 22;
    const key = st + ':' + k0 + (plat ? ':plat' : '');
    if (this.slotKey === key) return;
    this.slotKey = key;
    const p = STAGES[st - 1].pal, K = this.k;
    const ra = new THREE.Color(p.road), rb = new THREE.Color(p.road2), ea = new THREE.Color(p.edge), eb = new THREE.Color(shade(p.edge, -0.45));
    K.road.begin(); K.curb.begin(); K.dash.begin(); if (K.side) K.side.begin();
    for (let k = k0; k <= k1; k++) {
      const z = k * tile + tile / 2;
      if (plat && (z < plat.z0 || z > plat.z1)) continue;
      K.road.add(0, -0.05, z, 0, 1, 1, 1, (k & 1) ? ra : rb);
      for (const sd of [-1, 1]) K.curb.add(sd * (ROAD + 0.22), 0.06, z, 0, 1, 1, 1, (k & 1) ? ea : eb);
      if (k % 2 === 0) for (const x of [-3, -1, 1, 3]) K.dash.add(x, 0.02, z);
      if (K.side && k % 2 === 0) for (const sd of [-1, 1]) K.side.add(sd * (st === 1 ? 10 : 6.2), st === 1 ? -0.03 : 0.0, z + 1);
    }
    K.road.end(); K.curb.end(); K.dash.end(); if (K.side) K.side.end();
    for (const kit of this.scen) kit.begin();
    if (!plat) for (let k = s0; k <= s1; k++) for (const sd of [-1, 1]) {
      const r = hash3(k, sd, st), r2 = hash3(sd * 7, k, 3);
      const pi = Math.floor(r * this.scenProtos.length * 1.4);
      if (pi >= this.scenProtos.length) continue;
      const pr = this.scenProtos[pi];
      const x = sd * (6.6 + pr.w / 2 + r2 * 3 + (st === 4 ? 1 : 0));
      const y = pr.float ? -1 + r2 * 5 : 0;
      const sc = 0.8 + r2 * 0.5;
      this.scen[pi].add(x, y, k * slot + r2 * 3, r * 6.28 * (pr.float ? 1 : 0.15), sc, sc, sc);
    }
    for (const kit of this.scen) kit.end();
    if (K.torii) { K.torii.begin(); for (let z = Math.ceil((P + 3) / 26) * 26; z < P + 120; z += 26) K.torii.add(0, 0, z); K.torii.end(); } // only ahead: never across the camera
    // distant skyline that moves with the camera
    K.sky.begin();
    if (st !== 5) for (let i = 0; i < 24; i++) { const x = -70 + i * 6 + hash3(i, st, 1) * 4; const h = 6 + hash3(st, i, 2) * 26; K.sky.add(x, h / 2 - 2, P + 170 + hash3(i, 1, st) * 20, 0, 5, h, 5); }
    K.sky.end();
  },
};
function hash3(a, b, c) { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
