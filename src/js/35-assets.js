// ============================================================================
// ASSET OVERRIDE (optional). At boot, when the game is served over http(s), it
// looks for your own art in assets/units/<archetype>/ and uses it instead of the
// procedural meshes. Nothing there? It falls back silently. See README.md.
//
//   assets/units/<archetype>/unit.glb  (or unit.gltf)   a GLTF model, or
//   assets/units/<archetype>/sheet.json + sheet.png     a sprite sheet
//
// <archetype> is one of: crossbow, staff, blade, beam
// ============================================================================
const ASSETS = {
  units: {},
  init(onChange) {
    if (!/^https?:$/.test(location.protocol)) return; // opened as a file: nothing to look for
    for (const id of ARCH_ORDER) this.tryUnit(id, onChange);
  },
  tryUnit(id, onChange) {
    const base = 'assets/units/' + id + '/';
    const tryModel = names => {
      if (!names.length || !THREE.GLTFLoader) { trySheet(); return; }
      new THREE.GLTFLoader().load(base + names[0], gltf => { if (this.useModel(id, gltf)) onChange(); else trySheet(); }, undefined, () => tryModel(names.slice(1)));
    };
    const trySheet = () => {
      fetch(base + 'sheet.json').then(r => (r.ok ? r.json() : Promise.reject(new Error('none'))))
        .then(meta => new Promise((res, rej) => new THREE.TextureLoader().load(base + (meta.image || 'sheet.png'), tex => res([meta, tex]), undefined, rej)))
        .then(([meta, tex]) => { this.useSheet(id, meta, tex); onChange(); })
        .catch(() => {}); // absent: keep the procedural squad
    };
    tryModel(['unit.glb', 'unit.gltf']);
  },
  // First mesh in the file. Scaled to 1.1 units tall, feet on the ground, centred.
  useModel(id, gltf) {
    let mesh = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
    if (!mesh) return false;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    geo.computeBoundingBox();
    const bb = geo.boundingBox, h = Math.max(1e-3, bb.max.y - bb.min.y), k = 1.1 / h;
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    geo.scale(k, k, k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const mat = GFX.toonMat({ vertexColors: !!geo.attributes.color, map: src && src.map ? src.map : null, color: src && src.color ? src.color.clone() : 0xffffff });
    this.units[id] = { geo, mat, scale: 1 };
    return true;
  },
  // Sprite sheet: billboard quads; the whole squad shares the current run frame.
  useSheet(id, meta, tex) {
    tex.magFilter = THREE.NearestFilter;
    const cols = Math.max(1, Math.round(tex.image.width / meta.frameWidth)), rows = Math.max(1, Math.round(tex.image.height / meta.frameHeight));
    tex.repeat.set(1 / cols, 1 / rows);
    const aspect = meta.frameWidth / meta.frameHeight;
    const geo = new THREE.PlaneGeometry(1.2 * aspect, 1.2).translate(0, 0.6, 0).rotateY(Math.PI);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    this.units[id] = { geo, mat, scale: 1, sheet: { cols, rows, run: meta.run || [0], fps: meta.fps || 10, tex } };
  },
  // advance sprite-sheet animation (called each frame)
  tick(t) {
    for (const id in this.units) {
      const s = this.units[id].sheet; if (!s) continue;
      const f = s.run[Math.floor(t * s.fps) % s.run.length];
      s.tex.offset.set((f % s.cols) / s.cols, 1 - (Math.floor(f / s.cols) + 1) / s.rows);
    }
  },
};
