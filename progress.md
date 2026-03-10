Original prompt: Build and iterate a playable web game in this workspace, validating changes with a Playwright loop.

## 2026-03-10

- Confirmed workspace was empty and chose a deterministic single-battle STS-style prototype: Zero-Day Breach.
- Locked v1 scope to `start -> battle -> result`, mouse-first controls, canvas presentation, and Playwright-based validation.
- Added the Vite scaffold, deterministic combat engine in `src/game.js`, and Node tests covering opening state, card play, intent rotation, Worm/Exposed, victory, defeat, restart, and text-state serialization.
- Added the browser shell in `index.html`, `src/main.js`, and `src/style.css`: single centered canvas, start/battle/result presentation, canvas card clicks, DOM buttons for start/end turn/restart, and fullscreen toggle with `f` / `Esc`.
- Validation completed with browser captures:
  - Start menu render
  - Battle start after clicking `Start Breach`
  - Single `Ping` play reducing firewall HP to 39
  - `Buffer` + `End Turn` reducing player HP to 38 and advancing intent to `Harden`
  - Stall path to defeat and result overlay
  - Restart after defeat returning to the deterministic opening hand
  - Worm-heavy victory path to result overlay
  - Fullscreen enter/exit verified in browser automation
- Note: the provided `develop-web-game` Playwright client could not resolve `playwright` from its skill directory. A local workspace install plus a temporary symlink at `~/.codex/skills/develop-web-game/node_modules -> /Users/sungjh/Projects/game/node_modules` was used so the required client could run unchanged.
- TODO suggestions for the next pass:
  - Add richer card effects or a second enemy intent cycle without breaking determinism.
  - Expose a reusable scripted browser verification command instead of ad-hoc one-off Playwright snippets.
  - Consider moving start/restart actions into canvas hotspots if future testing needs fewer DOM assumptions.

## UI Recovery 2026-03-10

- Root cause confirmed before editing:
  - canvas text and fixed coordinates were doing layout work
  - the action bar sat outside the play surface and created dead space
  - mobile used the wrong viewport basis, so the shell overflowed even when the body did not
- Added `src/ui-model.js` with test-first coverage for:
  - visual viewport preference
  - compact mobile canvas sizing
  - DOM HUD/action visibility model
  - battle card playability and intent copy
- Reworked the UI into a hybrid layout:
  - canvas now renders only the atmospheric battle scene
  - DOM now owns HUD panels, system log, card rail, and result copy
  - result overlay text is structured DOM, not canvas copy
- Fixed a follow-up bug found during screenshot review:
  - the result overlay stayed visible in non-result modes because `.result-overlay { display: grid; }` overrode the `hidden` attribute
  - resolved by adding a global `[hidden] { display: none !important; }` rule
- Fresh verification completed after the UI rewrite:
  - `npm test`
  - `npm run build`
  - `develop-web-game` Playwright client start-to-battle capture
  - desktop screenshots for menu, battle, ping, end-turn, defeat, and victory
  - mobile screenshots for menu, battle, and ping
  - fullscreen enter/exit scripted verification

## Exposed Combo Expansion 2026-03-10

- Expanded the deterministic starting deck to 12 fixed cards:
  - `3 Ping`, `3 Buffer`, `2 Worm`, `2 Probe`, `1 Burst`, `1 Payload`
  - fixed order: `Probe -> Ping -> Buffer -> Worm -> Burst -> Buffer -> Ping -> Probe -> Payload -> Buffer -> Ping -> Worm`
- Refactored combat resolution around card-effect helpers instead of hard-coded template branches.
  - `Ping` and `Burst` now use shared Exposed-aware attack helpers
  - `Probe` adds `Exposed +1` and replaces itself with a draw
  - `Payload` converts current Exposed into burst damage and clears the status
- Extended `render_game_to_text()` hand payloads with `template` so browser verification can distinguish new cards without parsing names.
- Updated the hybrid DOM HUD and card rail for the new combo package:
  - start-screen briefing now explains `Probe`, `Burst`, and `Payload`
  - empty rail loadout tags match the new fixed deck
  - enemy Exposed chip and payoff cards receive visual emphasis when a combo window is live
- Fresh verification completed for the combo pass:
  - `npm test`
  - `npm run build`
  - `develop-web-game` client captures for menu and battle start
  - Playwright desktop combo flow verifying `Worm -> Burst`, `Probe -> Payload`, victory, and restart
  - Playwright mobile flow verifying no horizontal overflow and `Probe` behavior
  - fullscreen toggle logic rechecked with a document-level fullscreen shim because headless Chromium does not expose real fullscreen
- Artifacts left for the next agent:
  - `output/combo-client-menu`
  - `output/combo-client-battle`
  - `output/combo-victory`
  - `output/combo-mobile`

## Phase-Shift Boss 2026-03-10

- Extended `Sentinel Firewall` into a deterministic two-phase boss.
  - `Phase 1` remains `Scan -> Harden -> Trace`
  - `Phase 2` is `Seal -> Purge -> Backtrace`
  - shift trigger is immediate after a player card resolves if the firewall survives at `HP <= 22`
- Added enemy `phase` state to the battle engine and text-state output.
  - phase shift clears `Exposed`, grants `+6 block`, and resets the next intent to `Seal`
  - `Purge` clears all `Exposed` and gains `5 block`
- Updated HUD/state modeling so the enemy panel explicitly shows `Phase 1` / `Phase 2`.
  - intent copy now distinguishes `Seal` damage + lag and `Purge` cleanse + block
  - start-screen briefing now warns that the Sentinel hardens at half integrity
- Fresh verification completed for the phase-shift pass:
  - targeted RED/GREEN runs for `test/game.test.js` and `test/ui-model.test.js`
  - `develop-web-game` client captures for menu and battle start
  - Playwright desktop captures for phase start, immediate shift, pre-purge, post-purge, and victory/restart
  - Playwright mobile captures for no-overflow battle HUD with `Phase 1` visible
  - fullscreen toggle logic rechecked with the same document-level shim used previously because headless Chromium still does not expose real fullscreen
- Artifacts left for the next agent:
  - `output/phase-client-menu`
  - `output/phase-client-battle`
  - `output/phase-boss-desktop`
  - `output/phase-boss-victory`
  - `output/phase-boss-mobile`

## One-Screen Combat Polish 2026-03-10

- Rebuilt the battle shell into a desktop tactical-console layout:
  - slim command header
  - center stage canvas
  - fixed-height right telemetry panel
  - shallow bottom command dock
- Moved the mission brief fully into a stage overlay and kept result text in-stage so start/result states no longer add extra page height.
- Added internal deterministic visual FX in `src/main.js` without changing combat rules or `render_game_to_text()`:
  - card launch ghost on play
  - enemy/player hit flare and recoil
  - stat and pile pulse feedback on value changes
  - intent swap flash
  - stronger phase-shift beam/glow treatment
- Tightened the console viewport model in `src/ui-model.js` so laptop-height desktop viewports still use the one-screen layout.
- Compressed the right telemetry column after screenshot review:
  - enemy stats in one row
  - player stats in a compact five-chip strip
  - system log restored as a visible third block instead of being clipped
- Fresh verification completed for the one-screen pass:
  - `npm test`
  - `npm run build`
  - `develop-web-game` client captures for menu and battle start
  - full-page Playwright audit for desktop menu, battle, launch feedback, phase shift, purge, victory, restart, and mobile battle
  - desktop metrics now report `scrollHeight === innerHeight === 900` in the tactical console layout
  - mobile metrics report stacked layout with `scrollWidth === innerWidth`
- Artifacts left for the next agent:
  - `output/one-screen-client-menu`
  - `output/one-screen-client-battle`
  - `output/one-screen-audit-final`

## Drag-Hand UX 2026-03-11

- Added desktop-only drag-hand helpers in `src/drag-hand.js` and locked them with new tests:
  - desktop console battles expose a fanned hand and drag lane
  - stacked/mobile battles keep the straight tap rail
  - drag commit threshold and unplayable-card rejection are covered in `test/drag-hand.test.js`
- Reworked the bottom command dock into a desktop fanned hand:
  - cards are narrower, overlap less, and remain fully visible inside the one-screen layout
  - hover now uses highlight/shadow only after fixing a CSS transform collision that broke hit-testing
  - the lane prompt is rendered in-stage and arms cleanly when a card crosses the release threshold
- Added desktop pointer drag flow in `src/main.js`:
  - drag state tracks active card, pointer position, arming, invalid return, and snap-back timing
  - releasing above threshold commits through the existing `playCard()` path
  - short drags cancel cleanly and leave battle state unchanged
  - click fallback remains enabled for desktop and mobile
- Debugged two browser regressions found in the Playwright loop:
  - hand-shell clipping made visible card areas unclickable until the console dock geometry was tightened
  - a generic `.command-card:hover` transform overrode the fanned-card transform and caused hover/click instability until it was scoped back to straight rails only
- Fresh verification completed for the drag-hand pass:
  - `npm test`
  - `npm run build`
  - `develop-web-game` client captures for menu and battle start
  - custom Playwright audit for desktop idle, hover, drag commit, drag cancel, click fallback, phase shift via drag, victory, restart, fullscreen shim, and mobile tap fallback
  - desktop console metrics now report `scrollHeight === innerHeight === 900` with live fanned cards
- Artifacts left for the next agent:
  - `output/drag-client-menu`
  - `output/drag-client-battle`
  - `output/drag-audit-final`

## Short Run Expansion 2026-03-11

- Expanded the prototype from a single boss fight into a deterministic three-encounter run:
  - encounter 1: `Relay Drone`
  - encounter 2: `Proxy Warden`
  - encounter 3: `Sentinel Firewall`
- Reworked `src/game.js` around persistent run state:
  - `startBattle()` now starts encounter 1 of the run
  - `restartBattle()` resets the full run back to `Relay Drone`
  - added top-level `run` data with encounter index, total encounters, key, and name
  - added `mode: reward` and deterministic `chooseReward(state, rewardId)` flow
  - encounter 1 and 2 wins now heal `+4 HP`, clear temporary combat state, and open a fixed three-card reward cache
  - reward picks append deterministic card instance IDs before the next encounter starts with a fresh opening hand
- Added the fixed reward sets with no RNG:
  - reward 1: `reward-1-ping`, `reward-1-buffer`, `reward-1-worm`
  - reward 2: `reward-2-probe`, `reward-2-burst`, `reward-2-payload`
- Extended the UI model and shell for run progression:
  - battle HUD now shows `NODE 1/3`, `NODE 2/3`, and `BOSS 3/3`
  - reward mode uses an in-stage overlay with centered reward cards
  - reward mode hides the battle hand and disables the desktop drag lane
  - mobile keeps the stacked battle layout and tap-first reward selection
- Locked the new run contract with tests:
  - `test/game.test.js` covers encounter transitions, reward healing, deterministic reward IDs, reward selection, boss victory, defeat, and `render_game_to_text()` run metadata
  - `test/ui-model.test.js` covers run progress labels, reward overlays, and drag-hand suppression in reward mode
  - `test/drag-hand.test.js` confirms reward mode never enables the desktop fan hand
- Fresh verification completed for the run expansion pass:
  - `npm test`
  - `npm run build`
  - `develop-web-game` client captures for menu and battle start
  - custom Playwright audit for battle 1, reward 1, battle 2, reward 2, boss start, boss phase shift, victory, restart, mobile reward flow, and fullscreen shim
- Artifacts left for the next agent:
  - `output/run-client-menu`
  - `output/run-client-battle-1`
  - `output/run-audit-final`

## Branching Map Meta 2026-03-11

- Expanded the deterministic run from a linear `3-encounter` path into a fixed `5-node + boss` branching board.
- Reworked `src/game.js` around explicit map mode and node selection:
  - added `mode: map`
  - added `chooseMapNode(state, nodeId)`
  - `startBattle()` now enters the route board instead of launching combat immediately
  - regular combat victories now open node-scoped rewards and return to the map after `chooseReward()`
  - repair nodes resolve instantly with `+8 HP`, `Lag` clear, and `block` clear
  - boss still goes straight to `result`
- Locked the board and reward rules to deterministic IDs:
  - fixed rows and lane connections for `r1-left-relay` through `boss-sentinel`
  - reward IDs now use `<nodeId>-<template>`
  - installed card IDs now use `<template>-bonus-<nodeId>`
- Extended machine-readable state:
  - `render_game_to_text()` now includes a top-level `map` payload with visibility, current row, available nodes, path, and node statuses
  - `enemy` and `hand` are empty in `map` and `reward` modes
- Reworked the UI shell around the route board:
  - full map overlay on the stage during `map` mode
  - compact minimap widget in the right panel on desktop during battle/reward/result
  - mobile keeps stacked layout and shows the full board only in map mode
  - battle HUD now uses `ROW X/5` or `BOSS`
- Added and updated tests:
  - `test/game.test.js` covers map entry, node selection, repair behavior, reward-to-map transitions, boss access gating, defeat, victory, and map JSON
  - `test/ui-model.test.js` covers map overlay visibility, minimap visibility, battle drag-hand preservation, reward suppression, and node status presentation
  - `test/drag-hand.test.js` now also locks map mode to non-drag rail behavior
- Browser issues found and fixed during the Playwright loop:
  - result mode was still showing reward-cache telemetry until result-specific panel copy was added
  - card-launch ghosts persisted into reward/result screens until non-battle transitions cleared the launch FX
  - the mobile map board was clipped until map mode got a taller stacked-stage layout and smaller board nodes
- Fresh verification completed for the map meta pass:
  - `npm test`
  - `npm run build`
  - `develop-web-game` client route capture after start
  - custom Playwright audit for map start, first combat, reward 1, repair node, reward 2, boss access, boss phase shift, final result, restart, and mobile map
- Artifacts left for the next agent:
  - `output/map-client-menu`
  - `output/map-client-route`
  - `output/map-client-route-final`
  - `output/map-audit-final`
