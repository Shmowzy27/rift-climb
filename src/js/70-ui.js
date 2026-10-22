// ============================================================================
// UI: DOM menus only (the game itself is canvas)
// ============================================================================

const SVG = {
  coin: '<svg viewBox="0 0 20 20" class="ic"><circle cx="10" cy="10" r="8" fill="#ffc83d" stroke="#0b0b14" stroke-width="2"/><circle cx="10" cy="10" r="4.5" fill="none" stroke="#c48a12" stroke-width="1.6"/></svg>',
  gem: '<svg viewBox="0 0 20 20" class="ic"><path d="M10 1.5 18 8 10 18.5 2 8Z" fill="#57e2ff" stroke="#0b0b14" stroke-width="2" stroke-linejoin="round"/><path d="M10 1.5 7 8h6Z" fill="#e3fbff"/></svg>',
  heart: '<svg viewBox="0 0 20 20" class="ic"><path d="M10 17 3 10C0 7 2 2.5 6 3c2 .2 3 1.5 4 3 1-1.5 2-2.8 4-3 4-.5 6 4 3 7Z" fill="#ff3b5c" stroke="#0b0b14" stroke-width="2"/></svg>',
  lock: '<svg viewBox="0 0 20 20" class="ic"><rect x="4" y="9" width="12" height="9" rx="2" fill="#5a5a68" stroke="#0b0b14" stroke-width="2"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" fill="none" stroke="#0b0b14" stroke-width="2.4"/></svg>',
  shield: '<svg viewBox="0 0 20 20" class="ic"><path d="M10 1.5 17.5 4.5 16 12 10 18.5 4 12 2.5 4.5Z" fill="#6ea8ff" stroke="#0b0b14" stroke-width="2" stroke-linejoin="round"/></svg>',
};
const SHOP_ICONS = {
  coin: SVG.coin, heart: SVG.heart,
  helmet: '<svg viewBox="0 0 20 20" class="ic"><path d="M2 13C2 6 18 6 18 13Z" fill="#7d8a5a" stroke="#0b0b14" stroke-width="2"/><rect x="1" y="12.5" width="18" height="3" rx="1.5" fill="#4a5632" stroke="#0b0b14" stroke-width="1.6"/></svg>',
  medic: '<svg viewBox="0 0 20 20" class="ic"><rect x="2" y="2" width="16" height="16" rx="4" fill="#fff" stroke="#0b0b14" stroke-width="2"/><path d="M10 5v10M5 10h10" stroke="#ff3b5c" stroke-width="3.4"/></svg>',
  scope: '<svg viewBox="0 0 20 20" class="ic"><circle cx="10" cy="10" r="7" fill="none" stroke="#0b0b14" stroke-width="3.4"/><circle cx="10" cy="10" r="7" fill="none" stroke="#ff9a2e" stroke-width="1.8"/><path d="M10 1v6M10 13v6M1 10h6M13 10h6" stroke="#0b0b14" stroke-width="2"/></svg>',
  tower: '<svg viewBox="0 0 20 20" class="ic"><path d="M4 18V6h2V3h2v3h4V3h2v3h2v12Z" fill="#6e6874" stroke="#0b0b14" stroke-width="1.8" stroke-linejoin="round"/><rect x="8" y="12" width="4" height="6" fill="#3a2416"/></svg>',
  boot: '<svg viewBox="0 0 20 20" class="ic"><path d="M5 2h5v9l6 3v4H4Z" fill="#7ad7ff" stroke="#0b0b14" stroke-width="2" stroke-linejoin="round"/></svg>',
  clover: '<svg viewBox="0 0 20 20" class="ic"><g fill="#5cff7a" stroke="#0b0b14" stroke-width="1.8"><circle cx="10" cy="6" r="3.6"/><circle cx="6" cy="10" r="3.6"/><circle cx="14" cy="10" r="3.6"/><circle cx="10" cy="14" r="3.6"/></g></svg>',
  grid: '<svg viewBox="0 0 20 20" class="ic"><g fill="#c9a8ff" stroke="#0b0b14" stroke-width="1.6"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></g></svg>',
  eye: '<svg viewBox="0 0 20 20" class="ic"><path d="M1.5 10C5 4 15 4 18.5 10 15 16 5 16 1.5 10Z" fill="#fff" stroke="#0b0b14" stroke-width="2"/><circle cx="10" cy="10" r="3" fill="#3d8bff" stroke="#0b0b14" stroke-width="1.5"/></svg>',
  fist: '<svg viewBox="0 0 20 20" class="ic"><rect x="3" y="6" width="14" height="10" rx="4" fill="#ffd23d" stroke="#0b0b14" stroke-width="2"/><path d="M7 6v4M11 6v4" stroke="#0b0b14" stroke-width="1.6"/></svg>',
  tile: '<svg viewBox="0 0 20 20" class="ic"><rect x="2" y="2" width="16" height="16" rx="4" fill="#1a1a2a" stroke="#ffc83d" stroke-width="2"/><path d="M6.5 6.5l7 7M13.5 6.5l-7 7" stroke="#ffc83d" stroke-width="2.2"/></svg>',
};
const UPG_ICONS = {
  rate: '<svg viewBox="0 0 40 40" class="upi"><g stroke="#0b0b14" stroke-width="2.4" stroke-linejoin="round"><path d="M6 24h18l4-4h6v8h-6l-4-4" fill="#9aa4ae"/><path d="M8 26 12 33h5l-2-7" fill="#5a6a7a"/></g><g stroke="#ffd23d" stroke-width="3" stroke-linecap="round"><path d="M34 12l4-4M30 9l1-5M36 17h4"/></g></svg>',
  dmg: '<svg viewBox="0 0 40 40" class="upi"><path d="M20 3 24 15 37 15 26 23 30 36 20 28 10 36 14 23 3 15 16 15Z" fill="#ff3b5c" stroke="#0b0b14" stroke-width="2.4" stroke-linejoin="round"/><path d="M20 10 22 17 29 17 23 21" fill="none" stroke="#ffb3c1" stroke-width="2"/></svg>',
  rev: '<svg viewBox="0 0 40 40" class="upi"><g stroke="#0b0b14" stroke-width="2.4"><ellipse cx="20" cy="30" rx="14" ry="5" fill="#c48a12"/><ellipse cx="20" cy="25" rx="14" ry="5" fill="#ffc83d"/><ellipse cx="20" cy="18" rx="11" ry="4" fill="#ffc83d"/><ellipse cx="20" cy="11" rx="8" ry="3.4" fill="#ffe58a"/></g></svg>',
  gear: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.6 5.4-1.9-.3a7 7 0 0 1-.7 1.6l1.1 1.6-1.9 1.9-1.6-1.1a7 7 0 0 1-1.6.7l-.3 1.9h-2.6l-.3-1.9a7 7 0 0 1-1.6-.7l-1.6 1.1-1.9-1.9 1.1-1.6a7 7 0 0 1-.7-1.6l-1.9-.3v-2.6l1.9-.3a7 7 0 0 1 .7-1.6L5.3 7.7l1.9-1.9 1.6 1.1a7 7 0 0 1 1.6-.7l.3-1.9h2.6l.3 1.9a7 7 0 0 1 1.6.7l1.6-1.1 1.9 1.9-1.1 1.6a7 7 0 0 1 .7 1.6l1.9.3Z" fill="#e6e8f2" stroke="#0b0b14" stroke-width="1.4"/></svg>',
  soldier: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="7" r="4" fill="#f2c9a0" stroke="#0b0b14" stroke-width="1.8"/><path d="M5 22c0-6 3-9 7-9s7 3 7 9Z" fill="#3d6a8a" stroke="#0b0b14" stroke-width="1.8"/></svg>',
};
const RELIC_ICON = '<svg viewBox="0 0 24 24" class="ic big"><path d="M12 2 21 7v10l-9 5-9-5V7Z" fill="#2a1f3d" stroke="#c9a8ff" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.5" fill="#c9a8ff"/></svg>';

const UI = {
  root: null, preShown: new Set(), timers: [],
  init() {
    this.root = document.getElementById('ui');
    this.root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      AudioSys.unlock();
      SFX.ui();
      this.act(b.dataset.act, b.dataset.arg, b);
    });
  },
  clearTimers() { for (const t of this.timers) { clearTimeout(t); clearInterval(t); } this.timers = []; },
  show(html, cls) {
    this.clearTimers();
    this.root.innerHTML = `<div class="screen ${cls || ''}">${html}</div>`;
    return this.root.firstElementChild;
  },
  hide() { this.clearTimers(); this.root.innerHTML = ''; },
  gemsChip() { return `<div class="chip">${SVG.gem}<b>${Store.d.gems}</b></div>`; },
  coinsChip() { return `<div class="chip">${SVG.coin}<b>${fmtInt(Store.d.coins || 0)}</b></div>`; },

  // ---------------- main menu ----------------
  menu() {
    G.mode = 'menu';
    Gunfire.stop();
    const run = Store.d.run;
    MENU.stage = run ? stageOf(run.level) : 1;
    Music.play(5);
    const cont = run && run.level > 1;
    const loop = Store.d.loop || 0;
    this.show(`
      <div class="top-row"><div class="chips">${this.coinsChip()}${this.gemsChip()}</div>${loop ? `<div class="chip loop">CLIMB +${loop}</div>` : ''}</div>
      <div class="logo">
        <svg viewBox="0 0 320 130" aria-label="Rift Climb">
          <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9b6ff"/></linearGradient></defs>
          <path d="M172 0 158 40 176 62 150 130" fill="none" stroke="#ff2bd6" stroke-width="4"/>
          <text x="160" y="62" text-anchor="middle" class="lt" fill="#0b0b14" stroke="#0b0b14" stroke-width="12" stroke-linejoin="round">RIFT</text>
          <text x="160" y="62" text-anchor="middle" class="lt" fill="url(#lg)">RIFT</text>
          <text x="160" y="118" text-anchor="middle" class="lt" fill="#0b0b14" stroke="#0b0b14" stroke-width="12" stroke-linejoin="round">CLIMB</text>
          <text x="160" y="118" text-anchor="middle" class="lt" fill="#ffc83d">CLIMB</text>
        </svg>
      </div>
      <div class="spacer"></div>
      <div class="menu-btns">
        <button class="btn big" data-act="play">${cont ? 'CONTINUE · LV ' + run.level : 'PLAY'}</button>
        ${cont ? '<button class="btn ghost small" data-act="newclimb">NEW CLIMB</button>' : ''}
        ${Store.d.endless ? `<button class="btn alt" data-act="endless">ENDLESS${Store.d.endlessBest ? ' \u00b7 BEST ' + fmtInt(Store.d.endlessBest) + 'm' : ''}</button>` : ''}
        <div class="row">
          <button class="btn alt" data-act="shop">GEM SHOP</button>
          <button class="btn alt" data-act="skins">SKINS</button>
        </div>
        <div class="row">
          <button class="btn alt" data-act="story">STORY</button>
          <button class="btn alt" data-act="settings">SETTINGS</button>
        </div>
      </div>`, 'menu');
    if (Store.d.refunded) { // Reinforcements is gone: say so once
      const n = Store.d.refunded; delete Store.d.refunded; Store.save();
      this.info('REINFORCEMENTS RETIRED', `Every level now starts with one soldier. The ${n} gems you spent on Reinforcements are back in your pocket.`, () => this.menu());
    }
  },
  info(title, msg, done) {
    this.show(`<div class="panel center"><h2>${title}</h2><p class="msg">${msg}</p><button class="btn big" data-act="infook">OK</button></div>`, 'dim');
    this.root.querySelector('[data-act=infook]').addEventListener('click', e => { e.stopPropagation(); done(); }, { once: true });
  },

  act(a, arg, el) {
    switch (a) {
      case 'play': if (!Store.d.run) newRun(Store.d.loop); this.beginLevel(); break;
      case 'go': this.launch(); break;
      case 'up': this.buyUp(arg, el); break;
      case 'plusone': this.buyPlusOne(); break;
      case 'prepshop': this.shop(true); break;
      case 'prepset': this.settings(false, true); break;
      case 'prep': this.prep(); break;
      case 'endless': this.archPick(() => { this.hide(); startLevel({ endless: true }); }, true); break;
      case 'newclimb': this.confirm('Start a new climb? Your current run ends.', 'NEW CLIMB', () => { newRun(Store.d.loop); this.beginLevel(); }, () => this.menu()); break;
      case 'shop': this.shop(false); break;
      case 'skins': this.skins(); break;
      case 'story': this.storyList(); break;
      case 'settings': this.settings(arg === 'pause', false); break;
      case 'menu': this.menu(); break;
      case 'buy': this.buy(arg, el); break;
      case 'skin': this.pickSkin(arg, el); break;
      case 'set': this.toggle(arg); break;
      case 'reset': this.confirm('Erase all progress, gems and skins? This cannot be undone.', 'ERASE', () => this.confirm('Really erase everything?', 'YES, ERASE', () => { Store.reset(); AudioSys.apply(); this.menu(); }, () => this.settings(this._fromPause, this._fromPrep)), () => this.settings(this._fromPause, this._fromPrep)); break;
      case 'resume': this.hide(); G.mode = 'play'; break;
      case 'restart': this.confirm('Restart this level?', 'RESTART', () => { this.hide(); startLevel(); }, () => this.pause()); break;
      case 'quit': if (G.mode === 'paused' || G.mode === 'play') bankCoins(); Store.save(); this.menu(); break;
      case 'relics': this.relicsPanel(); break;
      case 'sellrelic': this.sellRelic(arg, el); break;
      case 'replay': { const s = STORY.find(x => x.id === arg); if (s) this.storyCard(s, () => this.storyList(), true); break; }
      case 'retry': this.hide(); if (G.endless) startLevel({ endless: true }); else startLevel(); break;
      case 'retrybase': this.hide(); retryBase(); break;
    }
  },
  confirm(msg, yes, onYes, onNo) {
    this.show(`<div class="panel center"><p class="msg">${msg}</p>
      <button class="btn danger" data-act="cy">${yes}</button><button class="btn ghost" data-act="cn">CANCEL</button></div>`, 'dim');
    const el = this.root.firstElementChild;
    el.querySelector('[data-act=cy]').addEventListener('click', e => { e.stopPropagation(); onYes(); }, { once: true });
    el.querySelector('[data-act=cn]').addEventListener('click', e => { e.stopPropagation(); onNo(); }, { once: true });
  },

  // ---------------- level start / story ----------------
  beginLevel() {
    const run = Store.d.run, L = run.level;
    const st = stageOf(L);
    const key = (run.loop || 0) + ':' + L;
    if ((L - 1) % 8 === 0 && !this.preShown.has(key)) {
      this.preShown.add(key);
      const s = STORY.find(x => x.id === 'pre' + st);
      if (!Store.d.story.includes(s.id)) { Store.d.story.push(s.id); Store.save(); }
      MENU.stage = st;
      this.storyCard(s, () => this.prep());
      return;
    }
    this.prep();
  },
  // ---------------- pre-level upgrade screen ----------------
  prep() {
    G.mode = 'menu';
    Gunfire.stop(); Music.play(5);
    const run = Store.d.run, L = run.level, st = stageOf(L), d = Store.d;
    MENU.stage = st;
    const cards = UPG_ORDER.map(k => {
      const u = UPG[k], p = d.up[k] || 0, c = pipCost(k, p), maxed = !c;
      const lv = maxed ? upLevel(p) : upLevel(p) + 1;
      const m = upMult(k, p);
      const val = k === 'rev' ? '\u00d7' + (m < 10 ? m.toFixed(1) : Math.round(m)) : '+' + Math.round((m - 1) * 100) + '%';
      const can = !maxed && (c.gems ? d.gems >= c.gems : d.coins >= c.coins);
      const pips = Array.from({ length: 5 }, (_, i) => `<i class="${maxed || i < p % 5 ? 'on' : ''}"></i>`).join('');
      return `<div class="upg upg-${k}"><span class="badge">LV ${lv}</span>${UPG_ICONS[k]}<b>${u.name}</b><em>${val}</em><div class="pips5">${pips}</div>
        <button class="btn up ${c && c.gems ? 'gem' : ''}" data-act="up" data-arg="${k}" ${can ? '' : 'disabled'}>${maxed ? '<small>MAX</small>' : `<small>UPGRADE</small><span>${c.gems ? SVG.gem + c.gems : SVG.coin + fmtInt(c.coins)}</span>`}</button></div>`;
    }).join('');
    const pal = STAGES[st - 1].pal;
    this.show(`
      <div class="top-row"><button class="btn ghost icon" data-act="prepset" aria-label="Settings">${UPG_ICONS.gear}</button><div class="chips">${this.coinsChip()}${this.gemsChip()}</div></div>
      <div class="prep-title" style="--acc:${pal.accent}"><span>${STAGES[st - 1].short.toUpperCase()}</span><b>LEVEL ${L}</b>${isStageBoss(L) ? `<i>${STAGES[st - 1].boss}</i>` : ''}</div>
      <div class="spacer"></div>
      <div class="prep-row">
        <button class="btn alt plus" data-act="plusone" ${d.gems >= 1 && (d.plusOne || 0) < 9 ? '' : 'disabled'}>${UPG_ICONS.soldier}<span>+1 SOLDIER</span><small>${SVG.gem}1</small></button>
        <div class="startn">START <b>${1 + (d.plusOne || 0)}</b></div>
        <button class="btn alt" data-act="prepshop">SHOP</button>
      </div>
      <div class="upg-cards">${cards}</div>
      <button class="btn big" data-act="go">PLAY</button>`, 'menu prep');
  },
  buyUp(k, el) {
    const d = Store.d, p = d.up[k] || 0, c = pipCost(k, p);
    if (!c || (c.gems ? d.gems < c.gems : d.coins < c.coins)) return;
    if (c.gems) d.gems -= c.gems; else d.coins -= c.coins;
    d.up[k] = p + 1; Store.save();
    if ((p + 1) % 5 === 0) { SFX.rally(); Haptic.buzz(20); } else { SFX.buff(); Haptic.buzz(8); }
    this.prep();
    const card = this.root.querySelector('.upg-' + k);
    if (card) card.classList.add('bump');
  },
  buyPlusOne() {
    const d = Store.d;
    if (d.gems < 1 || (d.plusOne || 0) >= 9) return;
    d.gems -= 1; d.plusOne = (d.plusOne || 0) + 1; Store.save();
    SFX.summon(); Haptic.buzz(8);
    this.prep();
  },
  launch() {
    const run = Store.d.run;
    if (stageOf(run.level) === 5) { this.archPick(() => { this.hide(); startLevel(); }, false); return; }
    this.hide(); startLevel();
  },
  storyCard(s, done, replay) {
    G.mode = G.mode === 'play' ? 'story' : G.mode;
    const pal = STAGES[s.stage - 1].pal;
    const dur = s.lines.length > 2 ? 10 : 7;
    const el = this.show(`
      <div class="story" style="--acc:${pal.accent};--acc2:${pal.accent2}">
        <div class="story-stage">STAGE ${s.stage}</div>
        <h1 class="story-title">${s.title}</h1>
        <div class="story-lines">${s.lines.map((l, i) => `<p style="animation-delay:${0.5 + i * 1.1}s">${l}</p>`).join('')}</div>
        ${s.ending ? '<p class="story-coda" style="animation-delay:3.4s">The climb begins again. It remembers you.</p>' : ''}
        <div class="story-bar"><i style="animation-duration:${dur}s"></i></div>
        <button class="btn ghost skip" data-act="skipstory">SKIP ›</button>
      </div>`, 'storybg');
    SFX.card();
    let fired = false;
    const go = () => { if (fired) return; fired = true; done(); };
    el.querySelector('.skip').addEventListener('click', e => { e.stopPropagation(); go(); }, { once: true });
    this.timers.push(setTimeout(go, dur * 1000));
  },
  storyList() {
    const unlocked = STORY.filter(s => Store.d.story.includes(s.id));
    this.show(`<div class="head"><button class="btn ghost back" data-act="menu">‹</button><h2>STORY</h2><div></div></div>
      <div class="scroll list">
        ${unlocked.length ? unlocked.map(s => `<button class="item story-item" data-act="replay" data-arg="${s.id}" style="--acc:${STAGES[s.stage - 1].pal.accent}">
          <span class="tag">STAGE ${s.stage}</span><b>${s.title}</b></button>`).join('') : '<p class="muted">Cards unlock as you climb.</p>'}
        ${STORY.length - unlocked.length ? `<p class="muted">${STORY.length - unlocked.length} more to find.</p>` : ''}
      </div>`);
  },

  // ---------------- shop ----------------
  shop(fromPrep) {
    this._shopBack = fromPrep ? 'prep' : 'menu';
    const d = Store.d;
    const rows = SHOP.map(u => {
      const n = shopLvl(u.id), maxed = n >= u.max, cost = maxed ? 0 : u.cost(n);
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
      return `<div class="item shop-item">${SHOP_ICONS[u.icon] || ''}<div class="info"><b>${u.name}</b><span>${u.desc}</span><div class="pips">${pips}</div></div>
        <button class="btn buy" data-act="buy" data-arg="${u.id}" ${maxed || d.gems < cost ? 'disabled' : ''}>${maxed ? 'MAX' : SVG.gem + cost}</button></div>`;
    }).join('');
    const skins = SKINS.filter(s => s.price).map(s => {
      const own = d.skinsOwned.includes(s.id);
      return `<div class="item shop-item"><canvas class="mini" data-skin="${s.id}" width="60" height="60"></canvas><div class="info"><b>${s.name}</b><span>${s.desc}</span></div>
        <button class="btn buy" data-act="buy" data-arg="skin:${s.id}" ${own || d.gems < s.price ? 'disabled' : ''}>${own ? 'OWNED' : SVG.gem + s.price}</button></div>`;
    }).join('');
    this.show(`<div class="head"><button class="btn ghost back" data-act="${this._shopBack}">‹</button><h2>GEM SHOP</h2>${this.gemsChip()}</div>
      <div class="scroll list">${rows}<h3>EXCLUSIVE SKINS</h3>${skins}
      <div class="item shop-item">${SVG.heart}<div class="info"><b>Rally</b><span>${RALLY_COST} gems. Offered when your squad is nearly gone, only if you say yes.</span></div></div></div>`);
    this.paintMinis();
  },
  buy(id, el) {
    if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.dataset.label = el.innerHTML; el.innerHTML = 'CONFIRM'; el.classList.add('armed'); setTimeout(() => { if (el.isConnected) { el.dataset.armed = ''; el.innerHTML = el.dataset.label; el.classList.remove('armed'); } }, 2200); return; }
    const d = Store.d;
    if (id.startsWith('skin:')) {
      const s = skinById(id.slice(5));
      if (d.gems < s.price || d.skinsOwned.includes(s.id)) return;
      d.gems -= s.price; d.skinsOwned.push(s.id); Store.save(); SFX.buff();
      this.skinCard(s, () => this.shop(this._shopBack === 'prep'));
      return;
    }
    const u = SHOP.find(x => x.id === id); const n = shopLvl(id);
    if (!u || n >= u.max) return;
    const cost = u.cost(n);
    if (d.gems < cost) return;
    d.gems -= cost; d.shop[id] = n + 1; Store.save(); SFX.buff(); Haptic.buzz(10);
    this.shop(this._shopBack === 'prep');
  },

  // ---------------- skins ----------------
  skins() {
    const d = Store.d;
    const cards = SKINS.map(s => {
      const own = d.skinsOwned.includes(s.id), sel = d.skin === s.id;
      const lock = !own ? (s.price ? `${SVG.gem}${s.price}` : `LV ${s.unlock}`) : sel ? 'EQUIPPED' : 'EQUIP';
      return `<button class="skin-card ${own ? '' : 'locked'} ${sel ? 'sel' : ''}" data-act="skin" data-arg="${s.id}">
        <canvas class="mini" data-skin="${s.id}" data-locked="${own ? 0 : 1}" width="96" height="96"></canvas><b>${s.name}</b><span>${lock}</span></button>`;
    }).join('');
    this.show(`<div class="head"><button class="btn ghost back" data-act="menu">‹</button><h2>SKINS</h2>${this.gemsChip()}</div>
      <p class="muted center-t">Cosmetic only. Swap any time.</p>
      <div class="scroll skin-grid">${cards}</div>`);
    this.paintMinis();
  },
  pickSkin(id) {
    const d = Store.d, s = skinById(id);
    if (d.skinsOwned.includes(id)) { d.skin = id; Store.save(); this.skins(); return; }
    if (s.price) this.shop(false);
  },
  previewArch() { const run = Store.d.run; return (run && stageArch(run.level, run)) || 'crossbow'; },
  paintMinis() {
    for (const cv of this.root.querySelectorAll('canvas.mini')) {
      const s = skinById(cv.dataset.skin), W = cv.width, H = cv.height, k = Math.min(3, window.devicePixelRatio || 1);
      cv.width = W * k; cv.height = H * k; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const c = cv.getContext('2d'); c.scale(k, k);
      const url = GFX.ok && GFX.preview(s, cv.dataset.arch || this.previewArch());
      if (!url) continue;
      const img = new Image();
      img.onload = () => {
        c.drawImage(img, 0, 0, W, H);
        if (cv.dataset.locked === '1') { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(10,10,20,0.85)'; c.fillRect(0, 0, W, H); }
      };
      img.src = url;
      continue;
    }
  },
  // Stage 5 (and endless): pick any of the four squads before each level, re-pick for free
  archPick(done, endless) {
    const run = Store.d.run;
    const cur = endless ? Store.d.endlessArch || 'crossbow' : run.arch || 'crossbow';
    const prof = endless ? null : RIFT_PROFILES[run.level];
    const el = this.show(`<div class="panel"><p class="tag">${endless ? 'ENDLESS' : 'THE RIFT \u00b7 LEVEL ' + run.level}</p><h2>CHOOSE YOUR SQUAD</h2>
      <div class="arch-grid">${ARCH_ORDER.map(id => `<button class="arch ${id === cur ? 'sel' : ''}" data-a="${id}">
        <canvas class="mini" data-skin="${Store.d.skin}" data-arch="${id}" width="84" height="84"></canvas>
        <b>${ARCH[id].squad}</b><span>${ARCH[id].weapon}</span><i>${ARCH[id].desc}</i></button>`).join('')}</div>
      <p class="muted center-t">${endless ? 'The road never ends. It speeds up every 30 seconds.' : prof ? 'This level: ' + { packs: 'swarms of fast crawlers', brutes: 'heavy armored crawlers', shields: 'crawlers behind shields', drift: 'crawlers that drift and blink', mixed: 'everything at once' }[prof] + '.' : 'Everything you learned, at once.'}</p>
      <button class="btn ghost" data-back="1">BACK</button></div>`, 'dim');
    this.paintMinis();
    el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); SFX.buff();
      if (endless) Store.d.endlessArch = b.dataset.a; else run.arch = b.dataset.a;
      Store.save();
      done();
    }, { once: true }));
    el.querySelector('[data-back]').addEventListener('click', e => { e.stopPropagation(); if (endless) this.menu(); else this.prep(); }, { once: true });
  },
  skinCard(s, done) {
    const el = this.show(`<div class="unlock"><div class="rays"></div><p class="tag">NEW CHAMPION SKIN</p>
      <canvas class="mini hero" data-skin="${s.id}" width="220" height="220"></canvas>
      <h1>${s.name}</h1><p class="muted">${s.desc}</p>
      <button class="btn big" data-act="equipnew">EQUIP</button><button class="btn ghost" data-act="later">LATER</button></div>`, 'dim');
    this.paintMinis(); SFX.clear(); Haptic.buzz(20);
    el.querySelector('[data-act=equipnew]').addEventListener('click', e => { e.stopPropagation(); Store.d.skin = s.id; Store.save(); done(); }, { once: true });
    el.querySelector('[data-act=later]').addEventListener('click', e => { e.stopPropagation(); done(); }, { once: true });
  },

  // ---------------- settings ----------------
  settings(fromPause, fromPrep) {
    this._fromPause = !!fromPause; this._fromPrep = !!fromPrep;
    const s = Store.d.settings;
    const tg = (k, label) => `<button class="item toggle ${s[k] ? 'on' : ''}" data-act="set" data-arg="${k}"><b>${label}</b><i></i></button>`;
    this.show(`<div class="head"><button class="btn ghost back" data-act="${fromPause ? 'pauseback' : fromPrep ? 'prep' : 'menu'}">\u2039</button><h2>SETTINGS</h2><div></div></div>
      <div class="scroll list">
        ${tg('sound', 'Sound')}${tg('music', 'Music')}${tg('haptics', 'Haptics')}
        <h3>DATA</h3>
        <button class="item danger-item" data-act="reset"><b>Reset progress</b><span>Erases gems, upgrades, skins and story</span></button>
      </div>`);
    const back = this.root.querySelector('[data-act=pauseback]');
    if (back) back.addEventListener('click', e => { e.stopPropagation(); this.pause(); }, { once: true });
  },
  toggle(k) { Store.d.settings[k] = !Store.d.settings[k]; Store.save(); AudioSys.apply(); if (k === 'haptics' && Store.d.settings.haptics) Haptic.buzz(15); this.settings(this._fromPause, this._fromPrep); },

  // ---------------- in-game panels ----------------
  pause() {
    if (G.mode !== 'play' && G.mode !== 'paused') return;
    G.mode = 'paused';
    Steer.id = null;
    Gunfire.stop();
    this.show(`<div class="panel center">
      <h2>PAUSED</h2><p class="muted">Level ${G.level} \u00b7 ${STAGES[G.stage - 1].short} \u00b7 ${fmtInt(G.N)} soldiers</p>
      <button class="btn big" data-act="resume">RESUME</button>
      <button class="btn alt" data-act="relics">RELICS (${G.relics.length}/3)</button>
      <button class="btn alt" data-act="settings" data-arg="pause">SETTINGS</button>
      <button class="btn ghost" data-act="restart">RESTART LEVEL</button>
      <button class="btn ghost" data-act="quit">QUIT TO MENU</button></div>`, 'dim');
  },
  relicsPanel() {
    const list = G.relics.map(id => { const r = relicById(id); return `<div class="item shop-item">${RELIC_ICON}<div class="info"><b>${r.name}</b><span>${r.desc}</span></div><button class="btn buy" data-act="sellrelic" data-arg="${id}">SELL ${SVG.gem}10</button></div>`; }).join('');
    this.show(`<div class="panel"><h2>RELICS</h2>${list || '<p class="muted">No relics yet. Treasure runners and stage bosses carry them.</p>'}
      <button class="btn" data-act="pauseback2">BACK</button></div>`, 'dim');
    this.root.querySelector('[data-act=pauseback2]').addEventListener('click', e => { e.stopPropagation(); this.pause(); }, { once: true });
  },
  sellRelic(id, el) {
    if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.innerHTML = 'CONFIRM'; el.classList.add('armed'); return; }
    G.relics = G.relics.filter(r => r !== id);
    Store.d.run.relics = (Store.d.run.relics || []).filter(r => r !== id);
    Store.d.gems += 10; Store.save(); SFX.sell();
    this.relicsPanel();
  },
  rally() {
    const el = this.show(`<div class="panel center revive"><h2>RALLY?</h2><p class="muted">Restore the squad to ${fmtInt(G.Nmax)} soldiers.</p>
      <div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/></svg><b>5</b></div>
      <button class="btn big" data-act="rv">RALLY ${SVG.gem}${RALLY_COST}</button>
      <button class="btn ghost" data-act="nrv">NO THANKS</button><p class="muted">You have ${Store.d.gems} gems.</p></div>`, 'dim');
    let left = 5, done = false;
    const b = el.querySelector('.ring b');
    const finish = yes => { if (done) return; done = true; this.hide(); if (yes) acceptRally(); else G.mode = 'play'; };
    this.timers.push(setInterval(() => { left--; if (b) b.textContent = Math.max(0, left); if (left <= 0) finish(false); }, 1000));
    el.querySelector('[data-act=rv]').addEventListener('click', e => { e.stopPropagation(); finish(true); }, { once: true });
    el.querySelector('[data-act=nrv]').addEventListener('click', e => { e.stopPropagation(); finish(false); }, { once: true });
  },
  failed() {
    this.show(`<div class="panel center"><h2 class="bad">SQUAD LOST</h2><p class="muted">Level ${G.level} restarts from the top. Your run is safe${G.stats.coins ? ', and you keep the ' + fmtInt(G.stats.coins) + ' coins you picked up' : ''}.</p>
      <button class="btn big" data-act="retry">TRY AGAIN</button><button class="btn alt" data-act="prep">UPGRADES</button><button class="btn ghost" data-act="quit">MENU</button></div>`, 'dim');
  },
  endlessOver(d, best) {
    this.show(`<div class="panel center"><p class="tag">ENDLESS</p><h2 class="${d > best ? '' : 'bad'}">${d > best ? 'NEW BEST' : 'SQUAD LOST'}</h2>
      <p class="big-num">${fmtInt(d)}<small>m</small></p><p class="muted">${d > best ? (best ? 'Previous best ' + fmtInt(best) + 'm.' : 'Your first climb into the dark.') : 'Best ' + fmtInt(best) + 'm.'}${G.stats.coins ? ' +' + fmtInt(G.stats.coins) + ' coins.' : ''}</p>
      <button class="btn big" data-act="endless">AGAIN</button><button class="btn ghost" data-act="menu">MENU</button></div>`, 'dim');
  },
  baseFail() {
    const pct = Math.round(100 * (1 - G.base.hp / G.base.max));
    this.show(`<div class="panel center"><h2 class="bad">${G.boss ? 'IT STILL STANDS' : 'THE BASE HOLDS'}</h2>
      <p class="msg">${pct}% broken. You keep your coins.</p><p class="muted">Retry the ${G.boss ? 'fight' : 'base'} with the ${fmtInt(G.arriveN)} soldiers you arrived with.</p>
      <button class="btn big" data-act="retrybase">RETRY ${G.boss ? 'FIGHT' : 'BASE'}</button>
      <button class="btn alt" data-act="retry">RESTART LEVEL</button><button class="btn alt" data-act="prep">UPGRADES</button><p class="muted">Pump the green bands. A bigger squad breaks it faster.</p>
      <button class="btn ghost" data-act="quit">MENU</button></div>`, 'dim');
  },

  // ---------------- level clear ----------------
  levelClear(sum) {
    this.timers.push(setTimeout(() => this._clear1(sum), 450));
  },
  _clear1(sum) {
    const pal = STAGES[stageOf(sum.level) - 1].pal;
    const el = this.show(`<div class="clear" style="--acc:${pal.accent}">
      <div class="banner"><span>LEVEL ${sum.level}</span><b>CLEAR</b></div>
      <div class="tally">
        <div class="tl" id="tl-coins">${SVG.coin}<span>COINS</span><b>0</b></div>
        <div class="tl hide" id="tl-squad">${UPG_ICONS.soldier}<span>SQUAD AT THE WALL</span><b>${fmtInt(sum.arrive)}</b>${sum.flips ? `<i>${sum.flips} red band${sum.flips > 1 ? 's' : ''} flipped</i>` : ''}</div>
        ${sum.gems ? `<div class="tl hide" id="tl-gems">${SVG.gem}<span>GEMS</span><b>+${sum.gems}</b></div>` : ''}
      </div>
      <div class="next-area"></div></div>`, 'dim clearbg');
    const coinsB = el.querySelector('#tl-coins b');
    const dur = 900 + Math.min(1400, sum.level * 30);
    const t0 = performance.now();
    let ticks = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      coinsB.textContent = fmtInt(sum.coins * easeOutCubic(k));
      if (Math.floor(k * 24) > ticks) { ticks = Math.floor(k * 24); SFX.coin(ticks * 2); }
      if (k < 1) requestAnimationFrame(step); else this._clear2(sum, el);
    };
    requestAnimationFrame(step);
  },
  _clear2(sum, el) {
    const ids = ['tl-squad', 'tl-gems'];
    let i = 0;
    const next = () => {
      while (i < ids.length && !el.querySelector('#' + ids[i])) i++;
      if (i >= ids.length) { this.timers.push(setTimeout(() => this._clear3(sum), 350)); return; }
      const n = el.querySelector('#' + ids[i++]);
      n.classList.remove('hide'); SFX.coin(30 + i * 6);
      if (n.id === 'tl-gems') for (let g = 0; g < Math.min(sum.gems, 10); g++) setTimeout(() => SFX.gem(g), g * 60);
      this.timers.push(setTimeout(next, 420));
    };
    next();
  },
  _clear3(sum) {
    const steps = [];
    if (sum.relic && sum.level >= 10) steps.push(done => this.relicChoice(done));
    if (sum.skin) steps.push(done => this.skinCard(sum.skin, done));
    const run = () => { const s = steps.shift(); if (s) s(run); else this._clear4(sum); };
    run();
  },
  _clear4(sum) {
    const go = () => {
      if (sum.ending) {
        const s = STORY.find(x => x.id === 'post5');
        this.storyCard(s, () => {
          newRun(Store.d.loop);
          this.show(`<div class="panel center"><h2>CLIMB +${Store.d.loop}</h2><p class="msg">The road starts over. Everything on it hits harder.</p>
            <button class="btn big" data-act="play">CLIMB AGAIN</button><button class="btn alt" data-act="endless">ENDLESS</button><button class="btn ghost" data-act="menu">MENU</button></div>`, 'dim');
        });
        return;
      }
      if (sum.stageClear) {
        const s = STORY.find(x => x.id === 'post' + stageOf(sum.level));
        this.storyCard(s, () => this.beginLevel());
        return;
      }
      this.beginLevel();
    };
    this.show(`<div class="panel center"><h2>LEVEL ${sum.level} CLEAR</h2>
      <p class="muted">${sum.stageClear ? 'Stage ' + stageOf(sum.level) + ' complete.' : 'Next: level ' + (sum.level + 1)}</p>
      <button class="btn big" data-act="nextlvl">${sum.ending ? 'FINISH' : 'UPGRADES'}</button></div>`, 'dim');
    this.root.querySelector('[data-act=nextlvl]').addEventListener('click', e => { e.stopPropagation(); go(); }, { once: true });
  },
  relicChoice(done) {
    const pool = shuffle(RELICS.filter(r => !G.relics.includes(r.id))).slice(0, 2);
    if (!pool.length) { done(); return; }
    const full = G.relics.length >= 3;
    const el = this.show(`<div class="panel"><p class="tag">RELIC FOUND</p><h2>CHOOSE ONE</h2>
      ${pool.map(r => `<button class="item relic" data-r="${r.id}">${RELIC_ICON}<div class="info"><b>${r.name}</b><span>${r.desc}</span></div></button>`).join('')}
      ${full ? '<p class="muted">Slots full (3/3). Picking one replaces a relic you choose.</p>' : ''}
      <button class="btn ghost" data-skip="1">SKIP</button></div>`, 'dim');
    el.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); SFX.buff();
      const id = b.dataset.r;
      if (!full) { G.relics.push(id); Store.d.run.relics = G.relics.slice(); Store.save(); done(); return; }
      const el2 = this.show(`<div class="panel"><h2>REPLACE WHICH?</h2>${G.relics.map(o => `<button class="item relic" data-o="${o}">${RELIC_ICON}<div class="info"><b>${relicById(o).name}</b><span>${relicById(o).desc}</span></div></button>`).join('')}
        <button class="btn ghost" data-cancel="1">KEEP MY RELICS</button></div>`, 'dim');
      el2.querySelectorAll('[data-o]').forEach(o => o.addEventListener('click', ev => { ev.stopPropagation(); G.relics = G.relics.filter(x => x !== o.dataset.o).concat(id); Store.d.run.relics = G.relics.slice(); Store.save(); done(); }, { once: true }));
      el2.querySelector('[data-cancel]').addEventListener('click', ev => { ev.stopPropagation(); done(); }, { once: true });
    }, { once: true }));
    el.querySelector('[data-skip]').addEventListener('click', e => { e.stopPropagation(); done(); }, { once: true });
  },
};
