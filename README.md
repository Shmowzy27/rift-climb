# RIFT CLIMB

A single-file HTML5 crowd-runner / squad shooter for iPhone (portrait, touch only).
Kai Vance starts every level with **one soldier**. Steer him through math bands that grow
(or shrink) the squad, pump the bands you want by shooting them, cut through a crowd that fills
the road, and break the enemy base at the end of every level.

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

- **One soldier.** Every level starts with exactly 1 soldier (plus any `+1 SOLDIER` you bought for
  a gem). He walks alone into a few stragglers for the first ~9 seconds.
- **Bands, not doorways.** A gate set is two or three translucent bands painted across the
  road (green = `+N` / `×N`, red = `−N` / `÷N`), posts at their edges, value floating above. There is
  no way through without taking one. Early sets are additive (`+3`, `+5`, `+8`); once the squad
  can multiply, the best band grows a par squad by ×1.6 (the brief allows ×1.6–2.0). Values are
  set against the par squad, so whether the `×` or the `+` is bigger depends on what you bring.
- **Shoot to pump.** The squad fires straight ahead, and bullets pass through bands. A green band
  climbs while you shoot it (`+5` → `+14` from max range), a red one worsens (`−4` → `−11`), and
  damage numbers float off it like off an enemy. Standing in front of the band you want is the
  pump; cutting across at the last moment takes another.
- **All-red sets flip.** When every band in a set is red (sometimes one band across the whole
  road), pour enough fire into one and it flips green, with a colour change and a chime.
- **What's behind the band.** Some bands have an explosive barrel (pulsing red blast ring, HP
  shown) or a barricade behind them. Bullets that pump the band hit them too: blow a barrel early
  and it's harmless, let it die close (or walk into it) and it takes up to a fifth of the squad.
- **Constant, visible gunfire.** Every soldier fires on its own staggered timer with a muzzle
  flash, a white-hot tapered tracer with a tinted trail, sparks and a damage number on impact, and
  brass casings. Past 25 soldiers the front 25 fire for everyone (each shot carries `N/25`
  soldiers' damage) and the formation pours rails of fire that thicken with the count.
- **A crowd, not waves.** The road carries a dense mass of enemies that streams at you, packed
  shoulder to shoulder, sized to the squad you should have by then: 30–55 bodies on screen in
  the second half of a level. A squad that falls well behind par meets a thinner crowd.
- **They shoot back** from Stage 2: slow visible tracers aimed where you are, dodged by steering.
- **Split roads** from Stage 3: a divider runs down the middle for ~8.5s; one side has a roaming
  swarm (and coins), the other the better band. You commit before the divider starts.
- **Overlapping sets** from Stage 4: a second set right behind the first, so you pump one while
  approaching the next.
- **Coins** are large gold discs with their value printed on them (80 at L1, about 260 at L40),
  plus a cart at the road's edge with a bundle worth seven discs for steering wide.
- **The base** shows its HP large and red and ticks down as you fire. 20s to break it in
  Stages 1–2, 16s from Stage 3.
- **No breathers** after Stage 1 except levels 5 and 10. Enemy HP grows ×1.21 per level.

### Bosses (L8, L16, L24, L32, L40)

Each is a colossal single enemy, 5–6 soldiers tall, most of the road wide, built from code
geometry with its own material. Entry: a name card and a 1.5s camera push-in, then an HP bar with
the raw HP above it. Three phases at 100/66/33%, each changing the attack mix and visibly
breaking the model (parts detach and tumble away, the colour shifts hot). A heavy idle (breathing,
sway, leaning into the wind-up) keeps it alive while you shoot.

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
cap, gates and crowds get harsher, no base. Your personal best distance is kept.

### In-level HUD

Pause (top left), progress bar with a flag and % (top centre; the base timer during an assault),
coins with a floating `+N` per pickup (top right), squad count above the squad. Nothing else.

## The squads

Each stage puts a different weapon in your squad's hands. Every soldier fires forward on its own
timer.

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
node tools/sim.mjs --write --seeds=12   # calibrate src/js/15-tables.js, then report
node tools/sim.mjs --seeds=12           # report only
node tools/bench.mjs 30 8               # per-archetype effective DPS
node tools/build.mjs                    # rebuild rift-climb.html from src/
```

`BALANCE_REPORT_PLACEHOLDER`

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
  the game bobs and leans the whole body. Keep it under ~3k triangles; 60 are drawn at once.

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
  rate climbs with the number of guns, louder during the base assault and boss fights.

## Source layout

`src/` holds the readable source; `node tools/build.mjs` inlines it (and `src/vendor/`) into
`rift-climb.html`.

| File | |
|---|---|
| `00-core.js` | save data (and the v1 → v2 migration), synthesized audio + gunfire + music, haptics |
| `10-balance.js` | formulas, band generation and pumping, the upgrade economy |
| `15-tables.js` | generated per-level tuning (base HP, `uRef`) |
| `20-content.js` | stages, weapons, story, relics, skins, shop, enemy types |
| `30-art.js` | 2D overlay art: number text, HUD icons, tutorial hand, app icon |
| `32-gfx.js` | Three.js renderer: toon materials, outlines, instanced kits, unit/enemy/boss/scenery meshes |
| `35-assets.js` | optional asset override loader |
| `40-game.js` | world, squad, gunfire pools, bands, hazards, crowd, return fire, bases, bosses, endless |
| `50-input.js` | steering |
| `60-render.js` | syncs game state into the scene each frame; overlay text and HUD |
| `70-ui.js` | DOM menus, upgrade screen, story cards, squad picker, level-clear flow |
| `80-main.js` | boot and main loop |
| `tools/headless.cjs` | runs the game logic in node + the profile bot |
| `tools/sim.mjs` | campaign simulation, economy, base HP calibration, report |
| `tools/bench.mjs` | per-archetype effective DPS |

## Notes

- Saves from the old 10-soldier version migrate on load: gems spent on Reinforcements are
  refunded (a one-time notice says how many), and a run in progress gets a coin wallet worth what
  the levels already climbed would have paid.
- iOS Safari has no `navigator.vibrate`. Haptics fall back to the iOS 18 switch-toggle tick,
  which only fires during a touch, so some haptic moments are silent on iPhone.
- Safari may hold `requestAnimationFrame` at 60fps unless the system allows 120Hz for web
  content. The game runs frame-rate independent either way.
- All characters, enemies, bosses and names are original and generated in code.
