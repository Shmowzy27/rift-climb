# RIFT CLIMB

A single-file HTML5 crowd-runner / squad lane shooter for iPhone (portrait, touch only).
Steer Kai Vance's squad down the road, pick math gates that grow (or shrink) your count,
fight what's coming with your stage's weapon, and break the enemy base at the end of every level.

**The game is one file: [`rift-climb.html`](rift-climb.html).** Everything is inline: CSS,
game code, sound, and the Three.js renderer. All 3D geometry is generated in code. No images,
no model files, no CDN, no network calls.

## Put it on your iPhone

iOS Safari won't run a local `.html` file from the Files app with full JavaScript, and a Home
Screen web app needs a URL. So serve it once from your Mac:

1. On the Mac, in this folder: `python3 -m http.server 8000`
2. On the iPhone (same Wi-Fi), open Safari at `http://<your-mac's-ip>:8000/rift-climb.html`
3. Share → **Add to Home Screen**. It launches full-screen, portrait, black-translucent status bar.

`sw.js` sits next to the game and is optional: when it's served alongside the page, iOS keeps a
cached copy so the Home Screen icon still launches **offline**. It is network-first, so a new
build shows up the next time you open it online.

Progress (gems, upgrades, skins, story, current run) saves to `localStorage`.

## Rendering

Three.js **r128**, the UMD build from cdnjs
(`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`), plus the r128
`GLTFLoader`. Both are vendored in `src/vendor/` and inlined at build time, so the shipped
file never loads anything from a CDN.

- Flat-shaded low-poly geometry with per-vertex colours, a 3-tone toon ramp, a hard rim light
  injected into the toon shader, and inverted-hull outlines.
- Soft shadow blobs under units, no shadow maps.
- Every crowd is instanced: the squad (bodies + swinging legs), each enemy type, coins,
  projectiles, beams, particles and scenery. Outlines share their mesh's instance matrices.
  Per-frame work only writes into preallocated matrices.
- Numbers (HP, gate values, squad count, HUD) are crisp 2D text on a canvas over the WebGL view.
- WebGL renders at up to 2× pixel ratio to keep 120Hz headroom. The text overlay renders at full 3×.

## The squads

Each stage puts a different weapon in your squad's hands:

| Stage | World | Squad | Weapon |
|---|---|---|---|
| 1 | The Sunken March | Footmen | Crossbows: medium rate, short range, bolts arc over frontal shields, land where aimed, overkill carries on |
| 2 | The Ember Spire | Apprentices | Staves: one huge homing bolt every ~2s; pierces one more, carries overkill, tracks movers even through a blink |
| 3 | The Thousand Gates | Retainers | Blades: melee only. Swings recharge (3 banked) and cleave everything that reaches the squad. Armor doesn't matter; shields do |
| 4 | The Iron Sprawl | Pilots | Beam rifles: fast, low damage per hit, pierce the whole line. Armor and shields stop the beam |
| 5 | The Rift Itself | You pick | Choose any of the four before each Rift level, free |

Each Rift level leans on a different problem (wide swarms, armored heavies, shield walls,
fast-drifting crawlers, everything), so each squad has levels it makes easier.

## Controls

Touch anywhere and drag left/right. Firing is automatic.

## Balance

```bash
node tools/balance.mjs            # gate/base simulation + per-archetype base assault report
node tools/balance.mjs --write    # recalibrate src/js/15-tables.js (gate spread, damage, base HP)
```

**Squad math** (unchanged by the archetype work): the average player (best gate 70%, 60% of coins,
one debuff) breaks every base in **14.0s**; the careless player (best gate 35%) in **19.3–21.8s**
on a 20s timer. Bosses: ~45s of 55s for average, careless fails. No gate set breaks the
best-vs-second 25% rule.

**Archetypes**: each archetype's base HP is scaled by its own base DPS, so the base assault
re-run per stage and per Rift squad lands at 14.0s average / 20.7–21.3s careless everywhere.

**Effective DPS** is measured with `tools/archetype-bench.js` in the real game code: the squad at
the size its damage is tuned around, the road kept full of the stage's enemy mix, steering that
re-aims every 0.35s like a person. Only HP of enemies actually **stopped** counts; damage on
enemies that still reach the squad counts for nothing. Units: stopped HP per soldier-second ÷
base per-soldier damage. Own stage: 3 seeds. Rift: 5 levels × 2 seeds (run-to-run noise ~±7%).

| | Crossbow | Staff | Blade | Beam |
|---|---|---|---|---|
| Own stage | 0.435 | 0.437 | 0.431 | 0.446 |
| Rift average | 0.429 | 0.455 | 0.449 | 0.489 |
| Best Rift level | shield walls | (2nd on heavies; never strictly worse) | armored heavies | swarms, drifters, mixed |

No squad is strictly better than another anywhere: each one beats each other one on at least one
Rift level. Staves never top a Rift level outright; they're the steadiest all-rounder there.

Settled weapon numbers:

| | rate /s | damage factor | Rift rate × | Rift damage × |
|---|---|---|---|---|
| Crossbow | 1.3 | 1.0 | 1.78 | 1 |
| Staff | 0.49 | 2.0 | 2.08 | 1 |
| Blade | 1.5 swings (3 banked) | 1.6 | 0.88 | 1 |
| Beam | 5.0 | 0.107 | 1 | 0.66 |

Overkill from a killing bolt or orb carries over to the next nearest enemy (it still pays normal
coins), so a big squad shreds a pack instead of spending a volley per crawler.

**Real arrivals.** The model above assumes ideal road combat. The average-player bot
(`measureArrivals`) brings this share of the model's squad to the wall: Stage 1 1.15, Stage 2
1.02, Stage 3 0.65, Stage 4 0.32, Rift 0.13. Base HP is scaled by those factors
(`BAL.arrivalFactor`) so bases play at the intended timing. With that, the bot clears all 40
levels (7 needed one restart).

Per-soldier damage on top of that comes from the level table, sized so an average squad one gate
into a level kills a normal enemy in about one volley.
Level 1's base is 60% of the formula so the teaching level is near impossible to lose.

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
  the game bobs and leans the whole body. Keep it under ~3k triangles; 40 are drawn at once.

**Sprite sheets** (`sheet.json`)
```json
{ "image": "sheet.png", "frameWidth": 128, "frameHeight": 192, "run": [0, 1, 2, 3], "fps": 10 }
```
- Frames are laid out left to right, top to bottom, indexed from 0. `run` lists the frames of
  the run cycle.
- Each unit is a billboard 1.2 units tall. Width follows the frame aspect ratio. Draw the
  character from behind, feet at the bottom edge, on a transparent background.
- Suggested frames: 128×192 px, a power-of-two sheet (e.g. 512×512 holds 4×2 frames).

## Playtest tools

Serve the folder, open the game, then in the browser console:

```js
eval(await (await fetch('tools/playtest-bot.js')).text()); runBot({ from: 1, to: 40 }); botReport()
eval(await (await fetch('tools/archetype-bench.js')).text()); benchAll(); benchRift()
```

## Source layout

`src/` holds the readable source; `node tools/build.mjs` inlines it (and `src/vendor/`) into
`rift-climb.html`.

| File | |
|---|---|
| `00-core.js` | save data, synthesized audio + music, haptics |
| `10-balance.js` | formulas, gate generator, balance simulation, per-archetype base report |
| `15-tables.js` | generated per-level tuning |
| `20-content.js` | stages, archetypes, story, relics, skins, shop |
| `30-art.js` | 2D overlay art: number text, HUD icons, tutorial hand, app icon |
| `32-gfx.js` | Three.js renderer: toon materials, outlines, instanced kits, all unit/enemy/boss/scenery meshes |
| `35-assets.js` | optional asset override loader |
| `40-game.js` | world, squad, gates, the four weapons, base assault, bosses |
| `50-input.js` | steering |
| `60-render.js` | syncs game state into the scene each frame; overlay text and HUD |
| `70-ui.js` | DOM menus, story cards, squad picker, level-clear flow |
| `80-main.js` | boot and main loop |

## Notes

- iOS Safari has no `navigator.vibrate`. Haptics fall back to the iOS 18 switch-toggle tick,
  which only fires during a touch, so some haptic moments are silent on iPhone.
- Safari may hold `requestAnimationFrame` at 60fps unless the system allows 120Hz for web
  content. The game runs frame-rate independent either way.
- All characters, enemies, bosses and names are original and generated in code.
