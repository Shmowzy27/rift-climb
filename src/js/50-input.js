// ============================================================================
// INPUT: touch anywhere and drag left/right to steer. Relative drag, so the
// thumb never covers the leader. No tap-to-shoot, no jump, no brake.
// ============================================================================

const Steer = { id: null, x0: 0, tx0: 0 };
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

function onDown(ev) {
  ev.preventDefault();
  AudioSys.unlock();
  if (G.mode !== 'play') return;
  const x = ev.clientX, y = ev.clientY;
  if (inRect(x, y, { x: V.pause.x - 6, y: V.pause.y - 6, w: V.pause.w + 12, h: V.pause.h + 12 })) { UI.pause(); return; }
  try { ev.target.setPointerCapture(ev.pointerId); } catch (e) {}
  Steer.id = ev.pointerId; Steer.x0 = x; Steer.tx0 = G.lead.tx;
}
function onMove(ev) {
  ev.preventDefault();
  if (ev.pointerId !== Steer.id || G.mode !== 'play') return;
  const unit = V.F / LEAD_DEPTH; // screen px per world unit at the leader
  G.lead.tx = clamp(Steer.tx0 + (ev.clientX - Steer.x0) / unit * 1.25, -ROAD + 0.4, ROAD - 0.4);
}
function onUp(ev) {
  ev.preventDefault();
  if (ev.pointerId === Steer.id) Steer.id = null;
}

function bindInput(cv) {
  cv.addEventListener('pointerdown', onDown, { passive: false });
  cv.addEventListener('pointermove', onMove, { passive: false });
  cv.addEventListener('pointerup', onUp, { passive: false });
  cv.addEventListener('pointercancel', onUp, { passive: false });
  // no zoom, no pull-to-refresh, no rubber band, no callouts
  const stop = e => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  document.addEventListener('contextmenu', stop, { passive: false });
  document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => {
    const t = Date.now();
    if (t - lastTouchEnd < 280 && e.target === cv) e.preventDefault();
    lastTouchEnd = t;
  }, { passive: false });
}
