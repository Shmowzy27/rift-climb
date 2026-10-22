# RIFT CLIMB

A single-file HTML5 crowd-runner / squad lane shooter for iPhone (portrait, touch only).
Steer Kai Vance's squad down the road, pick math gates that grow (or shrink) your count,
shoot through what's coming, and break the enemy base at the end of every level.

**The game is one file: [`rift-climb.html`](rift-climb.html).** Everything (CSS, JS, art,
sound) is inline. No images, no CDN, no network calls.

## Put it on your iPhone

iOS Safari won't run a local `.html` file from the Files app with full JavaScript, and a Home
Screen web app needs a URL. So you serve it once from your Mac:

1. On the Mac, in this folder: `python3 -m http.server 8000`
2. On the iPhone (same Wi-Fi), open Safari at `http://<your-mac's-ip>:8000/rift-climb.html`
3. Share → **Add to Home Screen**. It launches full-screen, portrait, black-translucent status bar.

`sw.js` sits next to the game and is optional: when it's served alongside the page, iOS caches
the game so the Home Screen icon keeps working **offline** after that first visit. The game
itself never fetches anything; opening it without `sw.js` works the same, just not offline.

Progress (gems, upgrades, skins, story, current run) saves to `localStorage`.

## Controls

Touch anywhere and drag left/right. Firing is automatic. That's it.

## How it plays

- **Squad count is everything**: damage, health and score. Volley damage = count × per-soldier damage.
- **Math gates** (sets of 2–3, pass through one): `+N ×N −N ÷N` and compound gates (`×3 −86`).
  Values are generated from your *current* count; the best and second-best always land within 25%.
- **Enemies**: runners (packs), brutes, shielders (flank them), leapers (sidestep the landing),
  elites. Barricades: shoot through for coins or steer around.
- **Exact break**: drop a target to exactly 0 with the killing volley → triple coins.
- **Base assault**: 20 seconds to break the base's HP while defenders fire back. Red barrages are
  telegraphed: steer out of them. Fail the timer and you retry the base, not the level.
- **Stage bosses** (L8/16/24/32/40): 3× HP, 55-second fight, telegraphed strikes that are always
  dodgeable.

## Balance (run it yourself)

```bash
node tools/balance.mjs
```

The balance check simulates an average player (best gate 70%, 60% of coins, one debuff) and a
careless one (best gate 35%) for all 40 levels and prints arrival squad, base HP and break time.
Current result: **average 14.0s on every level, careless 19.3–21.8s** (bands 13–15 / 19–23),
bosses ~45s of 55s. `node tools/balance.mjs --write` recalibrates the per-level table in
`src/js/15-tables.js` (gate spread, per-soldier damage, base HP).

Settled numbers:

| Constant | Value |
|---|---|
| Start squad | 10 (+3 per Reinforcements, +3 Quartermaster, +8 card) |
| Volleys | 2 per second; volley = count × per-soldier damage |
| Per-soldier damage | 1 at L1 → 1,036 at L40 (table) |
| Enemy HP | 15 × 1.17^L, breather ×1.11/1.17 on every 5th level and each stage's first |
| Base HP | 16,400 at L1 → 3.29M at L39; bosses 3× (L40: 9.25M) |
| Gate best-growth | ×2.0 / 1.55 / 1.5 / 1.45 / 1.42 by stage, second-best within 25% |
| Defenders | 1%/s trickle + 6.4% barrage every 1.6s (dodge half ≈ 3%/s) |
| Boss | 0.4%/s trickle + 12% strike every ~5s (dodge half ≈ 1.2%/s) |
| Damage bonus cap | +250% from buffs + relics + upgrades |

Deliberate exception: Level 1's base is 60% of the formula so the teaching level is near
impossible to lose.

## Playtest bot

Serve the folder, open the game, then in the browser console:

```js
eval(await (await fetch('tools/playtest-bot.js')).text()); runBot({ from: 1, to: 40 })
botReport()
```

## Source layout

`src/` holds the readable source; `node tools/build.mjs` inlines it into `rift-climb.html`.

| File | |
|---|---|
| `00-core.js` | save data, synthesized audio + music, haptics |
| `10-balance.js` | formulas, gate generator, balance simulation |
| `15-tables.js` | generated per-level tuning |
| `20-content.js` | stages, story, relics, skins, shop |
| `30-art.js`, `35-world.js` | cel-shaded canvas art: Kai, enemies, bosses, soldiers, gates, base |
| `40-game.js` | world, squad, gates, combat, base assault, bosses |
| `50-input.js` | steering |
| `60-render.js` | fake-3D road, scenery, HUD |
| `70-ui.js` | DOM menus, story cards, level-clear flow |
| `80-main.js` | boot and main loop |

## Notes

- iOS Safari has no `navigator.vibrate`. Haptics fall back to the iOS 18 switch-toggle tick,
  which only fires during a touch, so some haptic moments are silent on iPhone.
- iOS Safari caps `requestAnimationFrame` at 60fps unless the system allows 120Hz for web
  content; the game is frame-rate independent either way.
- All characters, enemies, bosses and names are original.
