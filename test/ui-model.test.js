import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseMapNode,
  chooseReward,
  createStartState,
  endTurn,
  playCard,
  startBattle,
} from "../src/game.js";
import { buildUiModel, computeBattleViewport, getViewportMetrics } from "../src/ui-model.js";

function findCardId(state, name) {
  const card = state.hand.find((entry) => entry.name === name);
  assert.ok(card, `Expected hand to contain ${name}`);
  return card.id;
}

function reachRewardOne() {
  let state = startBattle();
  state = chooseMapNode(state, "r1-left-relay");
  state.enemy.hp = 6;
  state = playCard(state, findCardId(state, "Ping"));
  return state;
}

function reachBossBattle() {
  let state = startBattle();
  state = chooseMapNode(state, "r1-left-relay");
  state.enemy.hp = 6;
  state = playCard(state, findCardId(state, "Ping"));
  state = chooseReward(state, "r1-left-relay-ping");
  state = chooseMapNode(state, "r2-center-relay");
  state.enemy.hp = 6;
  state = playCard(state, findCardId(state, "Ping"));
  state = chooseReward(state, "r2-center-relay-buffer");
  state = chooseMapNode(state, "r3-left-proxy");
  state.enemy.hp = 6;
  state = playCard(state, findCardId(state, "Ping"));
  state = chooseReward(state, "r3-left-proxy-probe");
  state = chooseMapNode(state, "r4-left-relay");
  state.enemy.hp = 6;
  state = playCard(state, findCardId(state, "Ping"));
  state = chooseReward(state, "r4-left-relay-ping");
  state = chooseMapNode(state, "r5-left-proxy");
  state.enemy.hp = 6;
  state = playCard(state, findCardId(state, "Ping"));
  state = chooseReward(state, "r5-left-proxy-probe");
  return chooseMapNode(state, "boss-sentinel");
}

test("getViewportMetrics prefers visual viewport dimensions when available", () => {
  const metrics = getViewportMetrics({
    innerWidth: 623,
    innerHeight: 1059,
    visualViewport: {
      width: 390,
      height: 664,
    },
  });

  assert.deepEqual(metrics, { width: 390, height: 664 });
});

test("computeBattleViewport creates a compact playable canvas for mobile", () => {
  const layout = computeBattleViewport({
    width: 390,
    height: 664,
    fullscreen: false,
  });

  assert.equal(layout.compact, true);
  assert.equal(layout.layoutMode, "stacked");
  assert.ok(layout.canvasWidth <= 366);
  assert.ok(layout.canvasHeight <= 260);
  assert.equal(Math.round((layout.canvasWidth / layout.canvasHeight) * 100), 178);
});

test("computeBattleViewport creates a tactical desktop console that fits one screen", () => {
  const layout = computeBattleViewport({
    width: 1440,
    height: 900,
    fullscreen: false,
  });

  assert.equal(layout.compact, false);
  assert.equal(layout.layoutMode, "console");
  assert.ok(layout.canvasWidth <= 960);
  assert.ok(layout.canvasHeight <= 540);
  assert.ok(layout.sidebarWidth >= 280);
  assert.ok(layout.dockHeight <= 180);
});

test("buildUiModel exposes start mode HUD and map-focused briefing", () => {
  const ui = buildUiModel(createStartState());

  assert.equal(ui.mode, "start");
  assert.equal(ui.actions.start.visible, true);
  assert.equal(ui.actions.endTurn.visible, false);
  assert.equal(ui.actions.restart.visible, false);
  assert.equal(ui.hand.length, 0);
  assert.equal(ui.player.energy.value, 0);
  assert.equal(ui.brief.length, 3);
  assert.match(ui.brief[0], /5-node/);
  assert.equal(ui.handPresentation.layout, "rail");
  assert.equal(ui.handPresentation.dragEnabled, false);
  assert.equal(ui.map.visible, false);
});

test("buildUiModel exposes the full map overlay with row 1 nodes on route start", () => {
  const ui = buildUiModel(startBattle(), { layoutMode: "console" });

  assert.equal(ui.mode, "map");
  assert.equal(ui.hand.length, 0);
  assert.equal(ui.handPresentation.layout, "rail");
  assert.equal(ui.handPresentation.dragEnabled, false);
  assert.equal(ui.map.visible, true);
  assert.equal(ui.map.overlayVisible, true);
  assert.equal(ui.map.minimapVisible, true);
  assert.equal(ui.map.currentRow, 1);
  assert.deepEqual(ui.map.availableNodeIds, ["r1-left-relay", "r1-right-proxy"]);
  assert.equal(ui.map.nodes.filter((node) => node.status === "available").length, 2);
});

test("desktop battles keep the fanned hand and show the compact minimap", () => {
  const state = playCard(chooseMapNode(startBattle(), "r1-left-relay"), "ping-1");
  const ui = buildUiModel(state, { layoutMode: "console" });

  assert.equal(ui.mode, "battle");
  assert.equal(ui.player.energy.value, 2);
  assert.equal(ui.enemy.intent.title, "Zap");
  assert.equal(ui.actions.endTurn.disabled, false);
  assert.equal(ui.hand.find((card) => card.id === "worm-1")?.playable, true);
  assert.equal(ui.handPresentation.layout, "fanned");
  assert.equal(ui.handPresentation.dragEnabled, true);
  assert.equal(ui.handPresentation.laneVisible, true);
  assert.equal(ui.run.progressLabel, "ROW 1/5");
  assert.equal(ui.map.visible, false);
  assert.equal(ui.map.minimapVisible, true);
});

test("mobile battles keep the straight rail and hide the persistent minimap", () => {
  const ui = buildUiModel(chooseMapNode(startBattle(), "r1-left-relay"), { layoutMode: "stacked" });

  assert.equal(ui.handPresentation.layout, "rail");
  assert.equal(ui.handPresentation.dragEnabled, false);
  assert.equal(ui.handPresentation.laneVisible, false);
  assert.equal(ui.map.minimapVisible, false);
});

test("reward mode exposes node-scoped rewards and disables the battle drag lane", () => {
  const ui = buildUiModel(reachRewardOne(), { layoutMode: "console" });

  assert.equal(ui.mode, "reward");
  assert.equal(ui.hand.length, 0);
  assert.equal(ui.rewardOptions.length, 3);
  assert.deepEqual(
    ui.rewardOptions.map((reward) => reward.id),
    ["r1-left-relay-ping", "r1-left-relay-buffer", "r1-left-relay-worm"],
  );
  assert.equal(ui.handPresentation.layout, "rail");
  assert.equal(ui.handPresentation.dragEnabled, false);
  assert.equal(ui.handPresentation.laneVisible, false);
  assert.equal(ui.actions.endTurn.visible, false);
  assert.equal(ui.map.visible, false);
  assert.equal(ui.map.minimapVisible, true);
  assert.match(ui.reward.detail, /row 2/i);
});

test("map mode reflects current, available, visited, and locked nodes after a reward pick", () => {
  let state = reachRewardOne();
  state = chooseReward(state, "r1-left-relay-ping");
  const ui = buildUiModel(state, { layoutMode: "console" });

  assert.equal(ui.mode, "map");
  assert.equal(ui.map.currentRow, 2);
  assert.deepEqual(ui.map.availableNodeIds, ["r2-left-repair", "r2-center-relay"]);
  assert.equal(ui.map.nodes.find((node) => node.id === "r1-left-relay")?.status, "current");
  assert.equal(ui.map.nodes.find((node) => node.id === "r2-left-repair")?.status, "available");
  assert.equal(ui.map.nodes.find((node) => node.id === "r2-center-relay")?.status, "available");
  assert.equal(ui.map.nodes.find((node) => node.id === "r1-right-proxy")?.status, "locked");
});

test("buildUiModel exposes boss labels and phase 2 purge intent copy after a mapped run", () => {
  let state = reachBossBattle();
  state = playCard(state, "worm-1");
  state = playCard(state, "burst-1");
  state = endTurn(state);
  state = playCard(state, "probe-2");
  state = playCard(state, "payload-1");
  state = endTurn(state);
  state = playCard(state, "worm-2");
  state = endTurn(state);
  const ui = buildUiModel(state, { layoutMode: "console" });

  assert.equal(ui.run.progressLabel, "BOSS");
  assert.equal(ui.enemy.phase.label, "Phase");
  assert.equal(ui.enemy.phase.value, "Phase 2");
  assert.equal(ui.enemy.intent.title, "Backtrace");
  assert.equal(ui.enemy.intent.detail, "Incoming damage 8");
  assert.equal(ui.map.minimapVisible, true);
});
