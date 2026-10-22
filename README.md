# RIFT CLIMB

A single-file HTML5 crowd-runner / squad shooter for iPhone (portrait, touch only).
Kai Vance starts every level **alone**. Steer him through math bands that grow (or shrink) the
squad, pump the bands you want by shooting them, mow through packed enemy blocks, claim weapon
crates, and kill the boss that walks down the road at you all level before it reaches you.

**The game is one file: [`rift-climb.html`](rift-climb.html).** Everything is inline: CSS,
game code, sound, and the Three.js renderer. All 3D geometry is generated in code. No images,
no model files, no CDN, no network calls.

**Play it:** https://shmowzy27.github.io/rift-climb/

## Put it on your iPhone

Open the link above in Safari, then Share → **Add to Home Screen**. It launches full-screen,
portrait, with a black-translucent status bar. `sw.js` keeps a cached copy, so the Home Screen
icon also launches **offline** after the first visit. It is network-first, so a new build shows up
the next time you open it online.

(Serving it yourself works too: `python3 -m http.server 8000` in this folder, then open
`http://<your-mac's-ip>:8000/rift-climb.html` on the phone.)

Progress (coins, gems, upgrades, skins, story, current run, endless best) saves to `localStorage`.

## How it plays

- **One soldier.** Every level and every retry starts with exactly 1: Kai himself (plus any
  `+1 SOLDIER` bought for a gem for that one level). The first gate is always reachable on a
  clear lane, and until the squad outnumbers a block, enemy blocks march down the road's edges.
- **Bands, not doorways.** A gate set is two or three translucent bands painted across the
  road (green = `+N` / `×N`, red = `−N` / `÷N`), value floating above. Early sets add (`+3`, `+5`,
  `+8`), the next two double, later ones are ×1.6; the best path over 7 sets ends at about
  45–130 soldiers. The fourth set lands just before halfway, so the army is there by mid-level.
- **Shoot to pump.** Bullets pass through bands: a green band climbs while you shoot it, a red
  one worsens. All-red sets flip green if you pour enough into one band.
- **Gunfire you can see.** Every soldier fires 3 shots/s on its own timer (random offset, never in
  sync), downrange from its own place in the block, target or not. Each shot is a real projectile
  (25 u/s, 30-unit range): a 1.2 × 0.12 white core inside a gold `#FFD66B` glow with a trail 2.5×
  as long fading out, additive and drawn above the road and the crowd. A 0.5-unit muzzle flash on
  every shot for exactly two frames, 6–10 sparks and a damage number on every hit. Up to 60
  soldiers each fire their own tracer; past 60, 60 representative soldiers spread over the
  formation fire for everyone (damage from the true count) and draw wider and brighter.
- **Enemies in blocks.** Packed rectangles 3–5 ranks deep that advance as one mass: runners in
  front, a core, one or two brutes anchoring the back. Block size `6 + floor(L × 0.6)`, a new block
  every 3.5s (2.0s by L40), and never fewer on screen than 12 / 20 / 30 / 45 / 60 by stage. They
  march out from behind the boss.
- **The army.** One soldier mesh per soldier up to 120 (beyond that the block widens), each with
  its own shadow and a phase-offset walk bob.
- **They shoot back** from Stage 2, **split roads** from Stage 3 (one half is a swarm), and
  **overlapping sets** from Stage 4.
- **Weapon crates.** 3–5 per level: a tire stack, a steel drum, a strapped crate, HP printed
  large and the gun they hold floating above. Shoot one down before you pass it to raise your
  **weapon level** for the rest of the run (`Lv 4` at the left edge). Levels 1–10, bolt rifle to
  heavy automatic: every soldier's gun model changes, damage +15% and fire rate +5% per level.
  Missing one is a loss, never fatal.

### The boss race

The boss is on the road from the first second, far off, 6–8 soldiers tall, walking at you with a
heavy gait; its HP bar and raw HP are pinned near the top all level. Your fire reaches it from
about 40% of the way. Kill it before it reaches you: the level ends the moment it dies, and the
progress bar holds at 99% until it does. Boss HP: 500 (L1–4), 1,200 (L5–9), 2,999 (L10–19),
7,500 (L20–29), 18,000 (L30–40); per-soldier damage is calibrated per level so an average
player kills it right at the wire. If it reaches you, the clash starts: it strikes on a 2s
telegraph, each strike deletes the soldiers inside it, and the longer the clash lasts the
faster and harder it grinds. Your fire hits it point-blank for ×1.6, so a squad that arrives a
little short can still win.

Stage levels (8, 16, 24, 32, 40) bring the stage boss; every other level brings a smaller,
recoloured spawn of it. Three phases at 100/66/33%, each changing the attack mix and visibly
breaking the model (parts detach and tumble away, the colour shifts hot).

Attacks telegraph for 2s on the road and **delete the soldiers standing in them** (one strike takes
at most 35% of the squad): **Sweep** (two thirds of the road), **Slam** (a ring from a marked
point), **Volley** (three marked columns, one on you), **Charge** (a lunge down your lane). The
boss drifts and your squad only fires forward, so dodging pulls you off it: every dodge costs
damage.

| Level | Boss | Breaks | Attacks |
|---|---|---|---|
| 8 | The Brine Mother: bloated translucent slime, a dark core inside | outer layer sheds, the core is exposed; 2 slimelings per phase | Slam, Volley of spat globs |
| 16 | The Kindled Warden: black plate with molten seams, a chained censer | plates burn off to the skeleton | Sweep with the chain; the fire lingers 3s |
| 24 | The Hollow Shogun: an empty lacquered suit, a mask floating where the face should be | shoulders and helm fall; splits into two smaller suits at 33% | Charge, then a Sweep on the return |
| 32 | The Echo: a tall mirrored frame showing a giant copy of your squad | crown shards, then the side pillars | Volleys in the mirrored weapon's pattern; switches squad each phase |
| 40 | The Other Kai: a giant Kai, half void | scarf, then the shards around him | Cycles all four squads' patterns; final phase on a floating platform |

### Between levels

The upgrade screen: three cards along the bottom, each with a level badge, an icon, a 5-pip
bar and an UPGRADE button with its cost. Five pips make a level; every 5th level costs gems.

| Track | Per level | Costs |
|---|---|---|
| Fire Rate | +8% shots per second, compounding | 160 coins, ×1.45 per pip (cheap at first) |
| Damage | +10% damage per soldier, compounding | 290 coins, ×1.45 per pip |
| Revenue | ×1.55 coins, shown as `×8.9` at max | 600 coins, ×1.05 per pip, max 5 levels |

Plus `+1 SOLDIER` (1 gem, starting squad only), the gem shop, settings (gear, top left), and
coin and gem counters (top right). Coins picked up in a level are kept even if you fail it.

### Endless

Unlocked by clearing level 40. One road that never ends: run speed +3% every 30 seconds with no
cap, gates and crowds get harsher, no boss. Your personal best distance is kept.

### In-level HUD

Pause (top left) with the weapon level under it, progress bar with a flag and % (top centre),
the boss's HP bar and raw HP under it, coins with a floating `+N` per pickup (top right), squad
count above the squad. Nothing else.

## The squads

Each stage dresses the squad differently; every squad fires the same 3 shots/s for the same raw
damage and differs in perks (the gun in their hands is the run's weapon level).

| Stage | World | Squad | Weapon |
|---|---|---|---|
| 1 | The Sunken March | Footmen | Crossbows: medium rate and range, bolts lob over frontal shields |
| 2 | The Ember Spire | Apprentices | Staves: slow heavy orbs that bend toward targets and pierce one more |
| 3 | The Thousand Gates | Retainers | Blades: thrown crescents, short reach, cleave three, ignore armor |
| 4 | The Iron Sprawl | Pilots | Beam rifles: fast, low damage, pierce the line; armor and shields stop them |
| 5 | The Rift Itself | You pick | Choose any of the four before each Rift level |

## Controls

Touch anywhere and drag left/right. Firing is automatic.

## Balance

The balance tools run the **real game code** headless in node (`tools/headless.cjs` loads
`src/js/00, 10, 15, 20, 40` with the DOM, audio and renderer stubbed out) with bots that play like
a given player. Nothing is a separate model.

```bash
node tools/calibrate.mjs --write 14     # per-level damage so an average player's boss dies at 100%
node tools/acceptance.mjs               # fix-pass-2 checks A, B, D, E, G (headless)
node tools/accept-render.cjs [outDir]   # check C (PNG frames of level 10) + the F frame-cost probe; needs Playwright
node tools/build.mjs                    # rebuild rift-climb.html from src/
```

## Asset override (optional, for your own licensed art)

The game runs completely on its procedural meshes. When it is **served over http(s)**, at boot
it also looks for your own art and uses it in place of the procedural squad, per archetype:

```
assets/units/<archetype>/unit.glb      GLTF binary   (or unit.gltf)
assets/units/<archetype>/sheet.json    sprite sheet description
assets/units/<archetype>/sheet.png     sprite sheet image
<archetype> = crossbow | staff | blade | beam
```

Order: `unit.glb`, then `unit.gltf`, then `sheet.json`. Anything missing falls back silently,
so the game works perfectly with the folder empty or absent. When the file is opened directly
(not served) it doesn't look at all.

**GLTF/GLB models**
- The first mesh in the file is used and drawn instanced for the whole squad, with the game's
  toon shading and outline.
- Any size: it is scaled to **1.1 units tall** (a soldier), centred, with feet at y = 0.
- Y up, facing **−Z** (away from the camera, toward the enemies). The camera sees their backs.
- A base-colour texture (`map`) and vertex colours are kept. Skeletal animation is not played:
  the game bobs and leans the whole body. Keep it under ~3k triangles; up to 120 are drawn at once.

**Sprite sheets** (`sheet.json`)
```json
{ "image": "sheet.png", "frameWidth": 128, "frameHeight": 192, "run": [0, 1, 2, 3], "fps": 10 }
```
- Frames are laid out left to right, top to bottom, indexed from 0. `run` lists the frames of
  the run cycle.
- Each unit is a billboard 1.2 units tall. Width follows the frame aspect ratio. Draw the
  character from behind, feet at the bottom edge, on a transparent background.
- Suggested frames: 128×192 px, a power-of-two sheet (e.g. 512×512 holds 4×2 frames).

## Rendering

Three.js **r128** (the UMD build from cdnjs) plus the r128 `GLTFLoader`, both vendored in
`src/vendor/` and inlined at build time, so the shipped file never loads anything from a CDN.

- Flat-shaded low-poly geometry with per-vertex colours, a 3-tone toon ramp, a hard rim light
  injected into the toon shader, and inverted-hull outlines.
- Everything numerous is instanced: the squad (bodies + swinging legs), each enemy type, tracers,
  trails, orbs, crescents, muzzle flashes, casings, sparks, discs, bands and scenery.
- Gunfire, return fire and particles live in fixed, preallocated pools (`Pool` in `40-game.js`)
  sized for the worst case; when a pool is full the spawn is skipped, never grown. The per-frame
  path allocates nothing for them.
- Numbers (HP, band values, disc values, squad count, HUD) are crisp 2D text over the WebGL view.
- WebGL renders at up to 2× pixel ratio to keep 120Hz headroom. The text overlay renders at full 3×.
- Audio is synthesized: gunfire is a noise bed that thickens with the squad plus a rattle whose
  rate climbs with the number of guns, louder once the boss is in range.

## Source layout

`src/` holds the readable source; `node tools/build.mjs` inlines it (and `src/vendor/`) into
`rift-climb.html`.

| File | |
|---|---|
| `00-core.js` | save data (v1 → v2 → v3 migrations), synthesized audio + gunfire + music, haptics |
| `10-balance.js` | formulas, band generation and pumping, the upgrade economy |
| `15-tables.js` | generated per-level per-soldier damage |
| `20-content.js` | stages, weapons, story, relics, skins, shop, enemy types |
| `30-art.js` | 2D overlay art: number text, HUD icons, tutorial hand, app icon |
| `32-gfx.js` | Three.js renderer: toon materials, outlines, instanced kits, unit/enemy/boss/scenery meshes |
| `35-assets.js` | optional asset override loader |
| `40-game.js` | world, squad, gunfire pools, bands, crates, enemy blocks, return fire, the boss race, endless |
| `50-input.js` | steering |
| `60-render.js` | syncs game state into the scene each frame; overlay text and HUD |
| `70-ui.js` | DOM menus, upgrade screen, story cards, squad picker, level-clear flow |
| `80-main.js` | boot and main loop |
| `tools/headless.cjs` | runs the game logic in node + the profile bot |
| `tools/calibrate.mjs` | per-level damage calibration |
| `tools/acceptance.mjs`, `tools/accept-render.cjs` | fix-pass-2 acceptance checks |

## Notes

- Saves from the old 10-soldier version migrate on load: gems spent on Reinforcements are
  refunded (a one-time notice says how many), and a run in progress gets a coin wallet worth what
  the levels already climbed would have paid.
- iOS Safari has no `navigator.vibrate`. Haptics fall back to the iOS 18 switch-toggle tick,
  which only fires during a touch, so some haptic moments are silent on iPhone.
- Safari may hold `requestAnimationFrame` at 60fps unless the system allows 120Hz for web
  content. The game runs frame-rate independent either way.
- All characters, enemies, bosses and names are original and generated in code.
