import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseMapNode,
  chooseReward,
  createStartState,
  endTurn,
  playCard,
  renderGameToText,
  restartBattle,
  startBattle,
} from "../src/game.js";

function findCardId(state, name) {
  const card = state.hand.find((entry) => entry.name === name);
  assert.ok(card, `Expected hand to contain ${name}`);
  return card.id;
}

function winCurrentEncounter(state, attackName = "Ping", hp = 6) {
  state.enemy.hp = hp;
  return playCard(state, findCardId(state, attackName));
}

function reachBossMap() {
  let state = startBattle();
  state = chooseMapNode(state, "r1-left-relay");
  state = winCurrentEncounter(state);
  state = chooseReward(state, "r1-left-relay-ping");
  state = chooseMapNode(state, "r2-center-relay");
  state = winCurrentEncounter(state);
  state = chooseReward(state, "r2-center-relay-buffer");
  state = chooseMapNode(state, "r3-left-proxy");
  state = winCurrentEncounter(state);
  state = chooseReward(state, "r3-left-proxy-probe");
  state = chooseMapNode(state, "r4-left-relay");
  state = winCurrentEncounter(state);
  state = chooseReward(state, "r4-left-relay-ping");
  state = chooseMapNode(state, "r5-left-proxy");
  state = winCurrentEncounter(state);
  state = chooseReward(state, "r5-left-proxy-probe");
  return state;
}

test("createStartState prepares the start screen shell", () => {
  const state = createStartState();

  assert.equal(state.mode, "start");
  assert.equal(state.turn, 0);
  assert.equal(state.result, null);
});

test("startBattle enters map mode with the row 1 combat nodes available", () => {
  const state = startBattle();

  assert.equal(state.mode, "map");
  assert.equal(state.phase, "route");
  assert.equal(state.turn, 0);
  assert.equal(state.run.currentRow, 1);
  assert.equal(state.run.totalRows, 5);
  assert.equal(state.run.currentNodeId, null);
  assert.deepEqual(state.run.availableNodeIds, ["r1-left-relay", "r1-right-proxy"]);
  assert.deepEqual(state.run.path, []);
});

test("chooseMapNode starts the selected combat encounter and opens Relay Drone", () => {
  const state = chooseMapNode(startBattle(), "r1-left-relay");

  assert.equal(state.mode, "battle");
  assert.equal(state.phase, "player");
  assert.equal(state.turn, 1);
  assert.equal(state.enemy.hp, 24);
  assert.equal(state.enemy.phase, 1);
  assert.equal(state.enemy.intent.key, "zap");
  assert.equal(state.run.currentNodeId, "r1-left-relay");
  assert.equal(state.run.encounterKey, "relay-drone");
  assert.equal(state.run.encounterName, "Relay Drone");
  assert.deepEqual(
    state.hand.map((card) => card.name),
    ["Probe", "Ping", "Buffer", "Worm", "Burst"],
  );
});

test("playCard still spends energy and damages the selected encounter", () => {
  const started = chooseMapNode(startBattle(), "r1-left-relay");
  const next = playCard(started, findCardId(started, "Ping"));

  assert.equal(next.player.energy, 2);
  assert.equal(next.enemy.hp, 18);
  assert.equal(next.hand.length, 4);
  assert.equal(next.discardPile.at(-1)?.name, "Ping");
});

test("Probe still costs zero, adds Exposed, and replaces itself with a draw", () => {
  const started = chooseMapNode(startBattle(), "r1-left-relay");
  const next = playCard(started, findCardId(started, "Probe"));

  assert.equal(next.player.energy, 3);
  assert.equal(next.enemy.status.exposed, 1);
  assert.equal(next.hand.length, 5);
  assert.deepEqual(
    next.hand.map((card) => card.name),
    ["Ping", "Buffer", "Worm", "Burst", "Buffer"],
  );
  assert.equal(next.discardPile.at(-1)?.name, "Probe");
});

test("combat victory opens node-scoped rewards without the old automatic heal", () => {
  let state = chooseMapNode(startBattle(), "r1-left-relay");
  state.player.hp = 28;

  state = winCurrentEncounter(state);

  assert.equal(state.mode, "reward");
  assert.equal(state.phase, "reward");
  assert.equal(state.player.hp, 28);
  assert.equal(state.run.currentNodeId, "r1-left-relay");
  assert.deepEqual(
    state.run.rewardOptions.map((reward) => reward.id),
    ["r1-left-relay-ping", "r1-left-relay-buffer", "r1-left-relay-worm"],
  );
  assert.equal(state.hand.length, 0);
  assert.equal(state.drawPile.length, 0);
  assert.equal(state.discardPile.length, 0);
});

test("chooseReward installs a node-scoped card and returns to the connected next row on the map", () => {
  let state = chooseMapNode(startBattle(), "r1-left-relay");
  state = winCurrentEncounter(state);

  state = chooseReward(state, "r1-left-relay-ping");

  assert.equal(state.mode, "map");
  assert.equal(state.phase, "route");
  assert.equal(state.turn, 0);
  assert.equal(state.run.currentRow, 2);
  assert.equal(state.run.currentNodeId, "r1-left-relay");
  assert.deepEqual(state.run.availableNodeIds, ["r2-left-repair", "r2-center-relay"]);
  assert.deepEqual(state.run.path, ["r1-left-relay"]);
  assert.equal(state.player.block, 0);
  assert.equal(state.player.status.lag, 0);
  assert.ok(state.run.deck.includes("ping-bonus-r1-left-relay"));
});

test("repair nodes heal 8, clear lag and block, and return to the map without opening battle", () => {
  let state = chooseMapNode(startBattle(), "r1-left-relay");
  state = winCurrentEncounter(state);
  state = chooseReward(state, "r1-left-relay-ping");
  state.player.hp = 25;
  state.player.block = 9;
  state.player.status.lag = 1;

  state = chooseMapNode(state, "r2-left-repair");

  assert.equal(state.mode, "map");
  assert.equal(state.phase, "route");
  assert.equal(state.player.hp, 33);
  assert.equal(state.player.block, 0);
  assert.equal(state.player.status.lag, 0);
  assert.equal(state.run.currentRow, 3);
  assert.equal(state.run.currentNodeId, "r2-left-repair");
  assert.deepEqual(state.run.path, ["r1-left-relay", "r2-left-repair"]);
  assert.deepEqual(state.run.availableNodeIds, ["r3-left-proxy"]);
});

test("five visited nodes are required before the boss becomes selectable", () => {
  const state = reachBossMap();

  assert.equal(state.mode, "map");
  assert.equal(state.run.currentRow, 6);
  assert.deepEqual(state.run.path, [
    "r1-left-relay",
    "r2-center-relay",
    "r3-left-proxy",
    "r4-left-relay",
    "r5-left-proxy",
  ]);
  assert.deepEqual(state.run.availableNodeIds, ["boss-sentinel"]);
});

test("boss combat still phase-shifts under 22 HP after the map route", () => {
  let state = reachBossMap();
  state = chooseMapNode(state, "boss-sentinel");

  state = playCard(state, findCardId(state, "Worm"));
  state = playCard(state, findCardId(state, "Burst"));
  state = endTurn(state);
  state = playCard(state, findCardId(state, "Probe"));
  state = playCard(state, findCardId(state, "Payload"));

  assert.equal(state.mode, "battle");
  assert.equal(state.enemy.hp, 17);
  assert.equal(state.enemy.phase, 2);
  assert.equal(state.enemy.block, 6);
  assert.equal(state.enemy.status.exposed, 0);
  assert.equal(state.enemy.intent.key, "seal");
});

test("boss victory goes directly to result and restart returns to row 1 map mode", () => {
  let state = chooseMapNode(reachBossMap(), "boss-sentinel");
  state = winCurrentEncounter(state);

  assert.equal(state.mode, "result");
  assert.equal(state.result, "victory");

  const restarted = restartBattle();

  assert.equal(restarted.mode, "map");
  assert.equal(restarted.phase, "route");
  assert.equal(restarted.run.currentRow, 1);
  assert.deepEqual(restarted.run.availableNodeIds, ["r1-left-relay", "r1-right-proxy"]);
});

test("defeat on an early combat node goes straight to result and skips rewards", () => {
  let state = chooseMapNode(startBattle(), "r1-right-proxy");
  state.player.hp = 6;

  state = endTurn(state);

  assert.equal(state.mode, "result");
  assert.equal(state.result, "defeat");
  assert.equal(state.run.rewardOptions.length, 0);
});

test("renderGameToText exposes deterministic map state and hides battle-only fields in map mode", () => {
  const payload = JSON.parse(renderGameToText(startBattle()));

  assert.equal(payload.mode, "map");
  assert.equal(payload.coordinateSystem, "origin=top-left,+x=right,+y=down");
  assert.deepEqual(payload.run, {
    encounterIndex: 0,
    totalEncounters: 6,
    encounterKey: null,
    encounterName: null,
  });
  assert.equal(payload.enemy, null);
  assert.deepEqual(payload.hand, []);
  assert.deepEqual(payload.rewardOptions, []);
  assert.deepEqual(payload.map.availableNodeIds, ["r1-left-relay", "r1-right-proxy"]);
  assert.equal(payload.map.currentRow, 1);
  assert.equal(payload.map.totalRows, 5);
  assert.equal(payload.map.currentNodeId, null);
  assert.deepEqual(payload.map.path, []);
  assert.ok(payload.map.nodes.some((node) => node.id === "boss-sentinel" && node.status === "locked"));
});
