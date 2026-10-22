// ============================================================================
// CONTENT: stages, story, relics, skins, shop, pickups. All names original.
// ============================================================================

const STAGES = [
  { name: 'THE FLOODED WARD', short: 'Flooded Ward',
    pal: { sky1: '#38d6c8', sky2: '#b8fff2', ground: '#2d6a6b', road: '#4b5b5e', road2: '#56686b', edge: '#c9d6d2', line: '#e8f2ee', accent: '#2de1c2', accent2: '#0f8f86', fog: '#a6eee4', bld: ['#5d8a8c', '#46777a', '#6f9c9a'], win: '#c9fff6' },
    sig: 'slime', boss: 'THE BRINE MOTHER', bossSub: 'She nests where the water goes black' },
  { name: 'THE CURSED KEEP ROAD', short: 'Keep Road',
    pal: { sky1: '#d4243b', sky2: '#ff9a6b', ground: '#2a1a1c', road: '#3a3436', road2: '#443c3e', edge: '#7a6a6c', line: '#e8d6c8', accent: '#ff3b5c', accent2: '#8c0f24', fog: '#e8706a', bld: ['#2a2224', '#1f191b', '#3a2e30'], win: '#ff8a5c' },
    sig: 'husk', boss: 'WARDEN GOREBRAND', bossSub: 'Keeper of a door that should stay shut' },
  { name: 'THE IRON FOUNDRY', short: 'Iron Foundry',
    pal: { sky1: '#e8901f', sky2: '#ffd98a', ground: '#3a2a1c', road: '#4a4038', road2: '#544840', edge: '#8a7a6a', line: '#ffe0a0', accent: '#ffb02e', accent2: '#ff5a1a', fog: '#f0b870', bld: ['#5a4632', '#4a3826', '#6a543c'], win: '#ffcf6b' },
    sig: 'drone', boss: 'FORGE-TYRANT MK IV', bossSub: 'Built on the other side. Built to last.' },
  { name: 'THE NEON SPRAWL', short: 'Neon Sprawl',
    pal: { sky1: '#2a0f4a', sky2: '#ff2bd6', ground: '#0e0a18', road: '#16121f', road2: '#1c1728', edge: '#2bf0ff', line: '#ff2bd6', accent: '#ff2bd6', accent2: '#2bf0ff', fog: '#7a2a9a', bld: ['#1c1530', '#231a3c', '#140f24'], win: '#2bf0ff' },
    sig: 'ghost', boss: 'THE ECHO', bossSub: 'It brings a squad exactly like yours' },
  { name: 'THE RIFT ITSELF', short: 'The Rift',
    pal: { sky1: '#000000', sky2: '#1a1830', ground: null, road: '#101018', road2: '#16161f', edge: '#ffffff', line: '#ffffff', accent: '#ffffff', accent2: '#b9b6ff', fog: '#25223d', bld: ['#0c0c14', '#12121c', '#08080e'], win: '#ffffff' },
    sig: 'crawler', boss: 'THE OTHER KAI', bossSub: 'He got here first' },
];

// One card before each stage, a 2-line card after each stage boss.
const STORY = [
  { id: 'pre1', stage: 1, title: 'THE FLOODED WARD', lines: ['A rift tore open under the city.', 'Things started climbing out.', 'I couldn’t do anything about it. Then it started feeding me too.'] },
  { id: 'post1', stage: 1, title: 'AFTER THE BRINE MOTHER', lines: ['She wasn’t nesting near the rift.', 'She was guarding it.'] },
  { id: 'pre2', stage: 2, title: 'THE CURSED KEEP ROAD', lines: ['Under the tunnels, a road to a keep nobody remembers building.', 'Every wall faces inward.'] },
  { id: 'post2', stage: 2, title: 'AFTER GOREBRAND', lines: ['The seals weren’t broken. They were opened, one at a time.', 'From this side.'] },
  { id: 'pre3', stage: 3, title: 'THE IRON FOUNDRY', lines: ['On the other side, something is building.', 'Every machine I break makes more sense than it should.'] },
  { id: 'post3', stage: 3, title: 'AFTER THE TYRANT', lines: ['Every order down here is signed the same way.', 'I know that handwriting.'] },
  { id: 'pre4', stage: 4, title: 'THE NEON SPRAWL', lines: ['There’s a city over here. Brighter than ours. Empty.', 'Whoever opened the rift lives in it.'] },
  { id: 'post4', stage: 4, title: 'AFTER THE ECHO', lines: ['He had my face.', 'He just started climbing sooner.'] },
  { id: 'pre5', stage: 5, title: 'THE RIFT ITSELF', lines: ['No ground. No sky. Only the road, and up.', 'It was opened from the inside. That’s the only way it closes.'] },
  { id: 'post5', stage: 5, title: 'THE END OF THE CLIMB', lines: ['I closed it from the inside.', 'Somewhere below, a nobody looks up.'], ending: true },
];

const RELICS = [
  { id: 'hourglass', name: 'Cracked Hourglass', desc: 'Debuff warning time +0.4s' },
  { id: 'quarter', name: 'Quartermaster', desc: '+3 starting soldiers' },
  { id: 'twin', name: 'Twin Standard', desc: '5% chance a × gate applies twice' },
  { id: 'magnet', name: 'Magnet Coil', desc: 'Coins drift toward the squad' },
  { id: 'siege', name: 'Siege Doctrine', desc: '+50% damage to bases and bosses' },
  { id: 'patient', name: 'Patient Advance', desc: '+8% damage per 10s without a debuff, max +40%' },
  { id: 'abacus', name: 'Abacus', desc: 'Shows each gate’s resulting count before you commit' },
  { id: 'remainder', name: 'Remainder', desc: '÷ gates round up instead of down' },
  { id: 'scavenger', name: 'Scavenger’s Luck', desc: 'Pickup drop chance 5% → 7%' },
  { id: 'vanguard', name: 'Vanguard', desc: 'Front rank takes 2 hits before dying' },
];
const relicById = id => RELICS.find(r => r.id === id);

const BUFFS = {
  rate: { name: '+15% FIRE RATE', short: 'RATE+' },
  dmg: { name: '+15% DAMAGE', short: 'DMG+' },
  coin: { name: '+50% COINS', short: 'COIN+' },
  spread: { name: 'WIDE FORMATION', short: 'WIDE' },
  pierce: { name: 'PIERCING SHOTS', short: 'PIERCE' },
};
const DEBUFFS = {
  rate: { name: '−15% FIRE RATE', short: 'RATE−' },
  dmg: { name: '−15% DAMAGE', short: 'DMG−' },
  coin: { name: '−25% COINS', short: 'COIN−' },
  bunch: { name: 'BUNCHED UP', short: 'BUNCH' },
  steer: { name: 'STEERING −25%', short: 'STEER−' },
};

// Squad skins: cosmetic only. c = coat, c2 = coat shade, h = helmet, t = trim, fx = extras
const SKINS = [
  { id: 'conscript', name: 'Conscripts', desc: 'Plain fatigues, dented helmets.', unlock: 1, c: '#6b7a4a', c2: '#4a5632', h: '#7d8a5a', t: '#3a3a2a', fx: ['dent'] },
  { id: 'ember', name: 'Ember Company', desc: 'Red helmets, scorched gear.', unlock: 3, c: '#5a4a3a', c2: '#3a2e24', h: '#d6262f', t: '#ff8a1f', fx: ['scorch'] },
  { id: 'night', name: 'Night Watch', desc: 'Dark grey, a lantern on every pack.', unlock: 6, c: '#4a4c55', c2: '#30323a', h: '#3a3c44', t: '#ffcf6b', fx: ['lantern'] },
  { id: 'tide', name: 'Tidecallers', desc: 'Stage 1 clear. Kelp-wrapped, dripping.', unlock: 8, c: '#1f6a5a', c2: '#124a3e', h: '#2a8a74', t: '#9ff3e1', fx: ['kelp', 'drip'] },
  { id: 'storm', name: 'Storm Lancers', desc: 'Static-charged, crackling antennae.', unlock: 10, c: '#2b3a6a', c2: '#1b264a', h: '#3d5aa8', t: '#ffe14d', fx: ['antenna'] },
  { id: 'keep', name: 'Keepbreakers', desc: 'Stage 2 clear. Broken chains, red capes.', unlock: 16, c: '#3a3236', c2: '#241e22', h: '#6a6a74', t: '#c4182d', fx: ['cape', 'chain'] },
  { id: 'shadow', name: 'Shadow Cadre', desc: 'Black kit. Leaves afterimages when steering.', unlock: 20, c: '#1c1824', c2: '#0e0b14', h: '#24202e', t: '#b28cff', fx: ['after'] },
  { id: 'forge', name: 'Forgeborn', desc: 'Stage 3 clear. Molten seams in the armor.', unlock: 24, c: '#3a3330', c2: '#221d1b', h: '#4a403a', t: '#ff8a1f', fx: ['seams'] },
  { id: 'frost', name: 'Frostguard', desc: 'Pale coats, breath mist.', unlock: 28, c: '#dfe9f5', c2: '#a9bed6', h: '#f4f8ff', t: '#6aa6ff', fx: ['mist'] },
  { id: 'ghostline', name: 'Ghostline', desc: 'Stage 4 clear. Glitching neon outlines.', unlock: 32, c: '#141026', c2: '#0b0816', h: '#1c1636', t: '#2bf0ff', fx: ['glitch'] },
  { id: 'gilded', name: 'Gilded Legion', desc: 'Gold plate and banners.', unlock: 36, c: '#e8b84a', c2: '#a8822a', h: '#ffd86b', t: '#c4182d', fx: ['banner'] },
  { id: 'riftborn', name: 'Riftborn', desc: 'Stage 5 clear. Half void, half human.', unlock: 40, c: '#e8e6f0', c2: '#a9a5b8', h: '#f4f2ff', t: '#000000', fx: ['halfvoid'] },
  // gem shop exclusives
  { id: 'paper', name: 'Paper Lantern Guard', desc: 'Festival coats, glowing paper lanterns.', price: 120, c: '#d9822b', c2: '#9c5a19', h: '#f2e7c9', t: '#ff4a4a', fx: ['lantern'] },
  { id: 'courier', name: 'Circuit Couriers', desc: 'Teal jackets, goggles, never late.', price: 120, c: '#1f8f8a', c2: '#13605c', h: '#2a2a33', t: '#f5f06b', fx: ['goggles'] },
  { id: 'moth', name: 'Moth Heralds', desc: 'Dust-wing capes that glow at night.', price: 120, c: '#8f86b8', c2: '#615a85', h: '#e8dcff', t: '#f2e7c9', fx: ['wings'] },
];
const skinById = id => SKINS.find(s => s.id === id) || SKINS[0];

const SHOP = [
  { id: 'reinf', name: 'Reinforcements', desc: '+3 starting soldiers', cost: n => Math.round(8 * Math.pow(1.5, n)), max: 10, icon: 'helmet' },
  { id: 'steady', name: 'Steady Hands', desc: '+10% steering speed', cost: n => Math.round(12 * Math.pow(1.5, n)), max: 5, icon: 'boot' },
  { id: 'medic', name: 'Field Medic', desc: 'Survive once at 1 soldier per level', cost: n => [40, 90][n], max: 2, icon: 'medic' },
  { id: 'lucky', name: 'Lucky Gate', desc: '+3% chance a + gate doubles', cost: n => Math.round(15 * Math.pow(1.6, n)), max: 5, icon: 'clover' },
  { id: 'marks', name: 'Marksman', desc: '+8% per-soldier damage', cost: n => Math.round(25 * Math.pow(1.6, n)), max: 5, icon: 'scope' },
  { id: 'keen', name: 'Keen Eye', desc: '+0.2s debuff warning', cost: n => Math.round(20 * Math.pow(1.6, n)), max: 3, icon: 'eye' },
  { id: 'siege', name: 'Siege Training', desc: '+10% damage to bases', cost: n => Math.round(30 * Math.pow(1.6, n)), max: 4, icon: 'tower' },
];
const shopLvl = id => (Store.d.shop[id] || 0);
const RALLY_COST = 25;

// Enemy archetypes. hp = multiplier on the level's enemy HP; kill = soldiers lost on contact.
const ENEMY_TYPES = {
  runner: { hp: 0.55, speed: 7, kill: 1, r: 0.45 },
  normal: { hp: 1, speed: 4, kill: 1, r: 0.5 },
  brute: { hp: 2.6, speed: 2, kill: 3, r: 0.8 },
  shielder: { hp: 1.4, speed: 2.8, kill: 2, r: 0.6 },
  leaper: { hp: 0.9, speed: 4.5, kill: 2, r: 0.5 },
  treasure: { hp: 0.6, speed: 0, kill: 0, r: 0.55 },
};
