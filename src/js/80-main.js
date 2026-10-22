// ============================================================================
// BOOT + MAIN LOOP
// ============================================================================
let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const t = ts / 1000;
  let dt = lastTs ? t - lastTs : 1 / 60;
  lastTs = t;
  dt = Math.min(dt, 0.05);
  if (G.mode !== 'paused' && G.mode !== 'revive') {
    const sdt = dt * (G.mode === 'play' ? G.timeScale : 1);
    const n = Math.max(1, Math.ceil(sdt / (1 / 120)));
    for (let i = 0; i < n; i++) update(sdt / n);
  }
  render();
}

function boot() {
  Store.load();
  CV = document.getElementById('game');
  HC = document.getElementById('hud');
  CX = HC.getContext('2d');
  GFX.init(CV);
  resize();
  ASSETS.init(() => { GFX.squadKey = ''; if (G.mode === 'play') GFX.buildSquad(G.arch, skinById(Store.d.skin)); });
  window.addEventListener('resize', () => {
    resize();
    if (V.w > V.h && G.mode === 'play') UI.pause();
  });
  bindInput(HC);
  UI.init();
  Haptic.init();
  const icon = makeAppIcon();
  if (icon) { const l = document.getElementById('touchIcon'); if (l) l.href = icon; }
  document.addEventListener('pointerdown', () => AudioSys.unlock(), { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (G.mode === 'play') UI.pause();
      Store.save();
      if (AudioSys.ctx) { try { AudioSys.ctx.suspend(); } catch (e) {} }
    } else if (AudioSys.ctx) { try { AudioSys.ctx.resume(); } catch (e) {} }
  });
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {}); } catch (e) {}
  // Optional offline cache for Home Screen installs. Only runs when served over http(s)
  // next to sw.js; opening the file directly never touches the network.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  UI.menu();
  requestAnimationFrame(frame);
}
window.addEventListener('DOMContentLoaded', boot);
