// ============================================================================
// CONTENT: stages, story, relics, skins, shop, pickups. All names original.
// ============================================================================

const STAGES = [
  { name: 'THE SUNKEN MARCH', short: 'Sunken March', arch: 'crossbow',
    pal: { sky1: '#2fb7b0', sky2: '#c4fff2', fog: '#9fe6dc', ground: '#2c5f5c', road: '#4f5d5a', road2: '#46524f', edge: '#a9b6af', line: '#d8e6de', accent: '#2de1c2', stone: '#7f8f88', stone2: '#5f6d68', water: '#2fa39a', leaf: '#3f6f4a' },
    boss: 'THE BRINE MOTHER', bossSub: 'She nests where the water goes black' },
  { name: 'THE EMBER SPIRE', short: 'Ember Spire', arch: 'staff',
    pal: { sky1: '#7a0a1c', sky2: '#ff7a3d', fog: '#c8402e', ground: '#1e1012', road: '#3a2a2c', road2: '#2e2022', edge: '#6a4a46', line: '#ff9a4a', accent: '#ff3b5c', stone: '#3a2c2e', stone2: '#241a1c', glow: '#ff8a2a', lava: '#ff5a1a' },
    boss: 'THE KINDLED WARDEN', bossSub: 'It keeps the tower burning. It keeps the door shut.' },
  { name: 'THE THOUSAND GATES', short: 'Thousand Gates', arch: 'blade',
    pal: { sky1: '#ff8a3d', sky2: '#ffd9a0', fog: '#f0a070', ground: '#3a2a24', road: '#8a6a50', road2: '#7a5c44', edge: '#c9a27a', line: '#f2d6b0', accent: '#e8332a', torii: '#d8322a', toriiTop: '#1e1a1e', stone: '#9a9088', leaf: '#ff6a2a' },
    boss: 'THE HOLLOW SHOGUN', bossSub: 'Three lessons. Each one sharper.' },
  { name: 'THE IRON SPRAWL', short: 'Iron Sprawl', arch: 'beam',
    pal: { sky1: '#12061f', sky2: '#4a1660', fog: '#2a1240', ground: '#0a0812', road: '#16131e', road2: '#1b1726', edge: '#2bf0ff', line: '#ff2bd6', accent: '#ff2bd6', bld: '#1c1830', bld2: '#141024', neonA: '#ff2bd6', neonB: '#2bf0ff' },
    boss: 'THE ECHO', bossSub: 'It brings a squad exactly like yours' },
  { name: 'THE RIFT ITSELF', short: 'The Rift', arch: null,
    pal: { sky1: '#000000', sky2: '#15132a', fog: '#0c0b18', ground: null, road: '#101018', road2: '#15151f', edge: '#ffffff', line: '#ffffff', accent: '#ffffff', rock: '#0e0e16' },
    boss: 'THE OTHER KAI', bossSub: 'He got here first' },
];

// Weapon archetypes. rate/dmgF are tuned so effective DPS against each archetype's own
// stage mix lands within 10% (tools/archetype-bench.js). riftRate/riftDmg retune them for
// the void crawlers so the Rift's average is even while each Rift profile has its own winner.
// Every soldier fires on its own timer. rate = shots per second per soldier, speed = projectile
// speed, dmgF = damage per hit relative to the level's per-soldier damage.
const ARCH = {
  crossbow: { id: 'crossbow', squad: 'FOOTMEN', weapon: 'Crossbows', rate: 1.3, range: 26, speed: 44, dmgF: 1.01, riftRate: 1, riftDmg: 0.997, desc: 'Bolts lob over frontal shields. Medium rate, short range.' },
  staff: { id: 'staff', squad: 'APPRENTICES', weapon: 'Staves', rate: 0.5, range: 40, speed: 24, dmgF: 3.072, riftRate: 1, riftDmg: 0.882, desc: 'Slow, heavy orbs that bend toward the nearest target and pierce one more.' },
  blade: { id: 'blade', squad: 'RETAINERS', weapon: 'Blades', rate: 1.1, range: 14, speed: 30, dmgF: 1.296, riftRate: 1, riftDmg: 1.073, desc: 'Thrown crescent cuts. Short reach, cleave three, armor means nothing. Shields stop them.' },
  beam: { id: 'beam', squad: 'PILOTS', weapon: 'Beam rifles', rate: 4.0, range: 40, speed: 95, dmgF: 0.327, riftRate: 1, riftDmg: 1.049, desc: 'Fast beams pierce a whole line. Armor and shields stop them. Pick your lane.' },
};
const ARCH_ORDER = ['crossbow', 'staff', 'blade', 'beam'];

// One card before each stage, a 2-line card after each stage boss.
const STORY = [
  { id: 'pre1', stage: 1, title: 'THE SUNKEN MARCH', lines: ['A rift tore open under the city. Things started climbing out.', 'I couldn\u2019t do anything about it. Then it started feeding me too.', 'The first door it opened led into a drowned kingdom.'] },
  { id: 'post1', stage: 1, title: 'AFTER THE BRINE MOTHER', lines: ['She wasn\u2019t nesting near the rift.', 'She was guarding it.'] },
  { id: 'pre2', stage: 2, title: 'THE EMBER SPIRE', lines: ['A tower that burns and never falls.', 'Every seal on its stairs was broken by hand.'] },
  { id: 'post2', stage: 2, title: 'AFTER THE WARDEN', lines: ['The seals weren\u2019t broken. They were opened, one at a time.', 'From this side.'] },
  { id: 'pre3', stage: 3, title: 'THE THOUSAND GATES', lines: ['A road of red gates, and someone walked it before me.', 'Every gate was left open behind him.'] },
  { id: 'post3', stage: 3, title: 'AFTER THE SHOGUN', lines: ['Every gate was unbarred the same way.', 'I know that hand.'] },
  { id: 'pre4', stage: 4, title: 'THE IRON SPRAWL', lines: ['A city of machines. Brighter than ours. Empty.', 'Whoever opened the rift lives here.'] },
  { id: 'post4', stage: 4, title: 'AFTER THE ECHO', lines: ['He had my face.', 'He just started climbing sooner.'] },
  { id: 'pre5', stage: 5, title: 'THE RIFT ITSELF', lines: ['No ground. No sky. Only the road, and up.', 'It was opened from the inside. That\u2019s the only way it closes.'] },
  { id: 'post5', stage: 5, title: 'THE END OF THE CLIMB', lines: ['I closed it from the inside.', 'Somewhere below, a nobody looks up.'], ending: true },
];

const RELICS = [
  { id: 'hourglass', name: 'Cracked Hourglass', desc: 'Debuff warning time +0.4s' },
  { id: 'powder', name: 'Blast Wardens', desc: 'Barrels you detonate never hurt your squad' },
  { id: 'twin', name: 'Twin Standard', desc: '5% chance a × band applies twice' },
  { id: 'magnet', name: 'Magnet Coil', desc: 'Coins drift toward the squad' },
  { id: 'siege', name: 'Siege Doctrine', desc: '+50% damage to bases and bosses' },
  { id: 'patient', name: 'Patient Advance', desc: '+8% damage per 10s without a debuff, max +40%' },
  { id: 'abacus', name: 'Abacus', desc: 'Shows each band’s resulting count before you commit' },
  { id: 'remainder', name: 'Remainder', desc: '÷ bands round up instead of down' },
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
  { id: 'conscript', name: 'Conscripts', desc: 'Plain issue for every squad: footmen, apprentices, retainers, pilots.', unlock: 1, c: '#6b7a4a', c2: '#4a5632', h: '#7d8a5a', t: '#3a3a2a', fx: ['dent'] },
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
  { id: 'steady', name: 'Steady Hands', desc: '+10% steering speed', cost: n => Math.round(12 * Math.pow(1.5, n)), max: 5, icon: 'boot' },
  { id: 'medic', name: 'Field Medic', desc: 'Survive once at 1 soldier per level', cost: n => [40, 90][n], max: 2, icon: 'medic' },
  { id: 'lucky', name: 'Lucky Gate', desc: '+3% chance a + band doubles', cost: n => Math.round(15 * Math.pow(1.6, n)), max: 5, icon: 'clover' },
  { id: 'marks', name: 'Marksman', desc: '+8% per-soldier damage', cost: n => Math.round(25 * Math.pow(1.6, n)), max: 5, icon: 'scope' },
  { id: 'keen', name: 'Keen Eye', desc: '+0.2s debuff warning', cost: n => Math.round(20 * Math.pow(1.6, n)), max: 3, icon: 'eye' },
  { id: 'siege', name: 'Siege Training', desc: '+10% damage to bases', cost: n => Math.round(30 * Math.pow(1.6, n)), max: 4, icon: 'tower' },
];
const shopLvl = id => (Store.d.shop[id] || 0);
const RALLY_COST = 25;
// Retired gem-shop items: gems spent on them are refunded on load (see Store.load)
const RETIRED_SHOP = { reinf: n => Math.round(8 * Math.pow(1.5, n)) };

// Enemy looks per stage and role (all original)
const STAGE_LOOKS = [
  { runner: 'slime', normal: 'slime', brute: 'bigslime', shielder: 'slime', leaper: 'slime' },
  { runner: 'hound', normal: 'husk', brute: 'oni', shielder: 'husk', leaper: 'hound' },
  { runner: 'wisp', normal: 'yokai', brute: 'bigyokai', shielder: 'yokai', leaper: 'hound' },
  { runner: 'ghost', normal: 'drone', brute: 'bigdrone', shielder: 'drone', leaper: 'ghost' },
  { runner: 'crawler', normal: 'crawler', brute: 'bigcrawler', shielder: 'shieldcrawler', leaper: 'crawler' },
];
// Stage 5 levels lean on different problems, so each archetype has levels it makes easier
const RIFT_PROFILES = { 33: 'packs', 34: 'brutes', 35: 'shields', 36: 'drift', 37: 'shields', 38: 'drift', 39: 'mixed' };
// Enemy archetypes. hp = multiplier on the level's enemy HP; kill = soldiers lost on contact.
const ENEMY_TYPES = {
  runner: { hp: 0.55, speed: 7, kill: 1, r: 0.45 },
  normal: { hp: 1, speed: 4, kill: 1, r: 0.5 },
  brute: { hp: 2.6, speed: 2, kill: 2, r: 0.8 },
  shielder: { hp: 1.4, speed: 2.8, kill: 1, r: 0.6 },
  leaper: { hp: 0.9, speed: 4.5, kill: 1, r: 0.5 },
  treasure: { hp: 0.6, speed: 0, kill: 0, r: 0.55 },
};

// Body colours (spark bursts on a kill) and size multipliers per enemy look
const LOOK_COLORS = { slime: 0x36d6b5, bigslime: 0x36d6b5, hound: 0x8a3a2a, husk: 0x6a6a78, oni: 0xc2262e, yokai: 0x3a2a5e, bigyokai: 0x3a2a5e, wisp: 0xffa040, drone: 0xc9a24a, bigdrone: 0xc9a24a, ghost: 0xc06bff, crawler: 0xffffff, bigcrawler: 0xffffff, shieldcrawler: 0xffffff, treasure: 0xffd23d, shade: 0x2bf0ff, twin: 0xffffff };
const LOOK_SCALE = { bigslime: 1.7, bigyokai: 1.6, bigdrone: 1.5, bigcrawler: 1.6, oni: 1, slime: 1.05 };
