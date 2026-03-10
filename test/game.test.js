import test from "node:test";
import assert from "node:assert/strict";

import {
  createStartState,
  startBattle,
  playCard,
  endTurn,
  restartBattle,
  renderGameToText,
} from "../src/game.js";

function findCardId(state, name) {
  const card = state.hand.find((entry) => entry.name === name);
  assert.ok(card, `Expected hand to contain ${name}`);
  return card.id;
}

test("createStartState prepares the start screen shell", () => {
  const state = createStartState();

  assert.equal(state.mode, "start");
  assert.equal(state.turn, 0);
  assert.equal(state.result, null);
});

test("startBattle creates the deterministic opening battle state", () => {
  const state = startBattle();

  assert.equal(state.mode, "battle");
  assert.equal(state.turn, 1);
  assert.equal(state.player.hp, 40);
  assert.equal(state.player.energy, 3);
  assert.equal(state.enemy.hp, 45);
  assert.equal(state.enemy.intent.key, "scan");
  assert.deepEqual(
    state.hand.map((card) => card.name),
    ["Ping", "Buffer", "Ping", "Worm", "Buffer"],
  );
  assert.equal(state.drawPile.length, 5);
  assert.equal(state.discardPile.length, 0);
});

test("playCard spends energy, discards the card, and damages the firewall", () => {
  const started = startBattle();
  const next = playCard(started, findCardId(started, "Ping"));

  assert.equal(next.player.energy, 2);
  assert.equal(next.enemy.hp, 39);
  assert.equal(next.hand.length, 4);
  assert.equal(next.discardPile.at(-1)?.name, "Ping");
});

test("Worm amplifies attack damage and remains active into the next player turn", () => {
  let state = startBattle();

  state = playCard(state, findCardId(state, "Worm"));
  state = playCard(state, findCardId(state, "Ping"));

  assert.equal(state.enemy.hp, 37);
  assert.equal(state.enemy.status.exposed, 2);

  state = endTurn(state);

  assert.equal(state.player.hp, 33);
  assert.equal(state.enemy.intent.key, "harden");
  assert.equal(state.enemy.status.exposed, 1);

  state = playCard(state, findCardId(state, "Ping"));

  assert.equal(state.enemy.hp, 29);
});

test("Buffer absorbs Scan damage and intent rotates to Harden", () => {
  let state = startBattle();

  state = playCard(state, findCardId(state, "Buffer"));
  state = endTurn(state);

  assert.equal(state.player.hp, 38);
  assert.equal(state.player.block, 0);
  assert.equal(state.enemy.intent.key, "harden");
});

test("Trace lowers the next player turn energy to two", () => {
  let state = startBattle();

  state = endTurn(state);
  state = endTurn(state);
  state = endTurn(state);

  assert.equal(state.enemy.intent.key, "scan");
  assert.equal(state.player.energy, 2);
});

test("battle can end in victory and restart to the initial deterministic state", () => {
  let state = startBattle();

  state = playCard(state, findCardId(state, "Worm"));
  state = playCard(state, findCardId(state, "Ping"));
  state = playCard(state, findCardId(state, "Ping"));
  state = endTurn(state);

  state = playCard(state, findCardId(state, "Worm"));
  state = playCard(state, findCardId(state, "Ping"));
  state = playCard(state, findCardId(state, "Ping"));
  state = endTurn(state);

  state = playCard(state, findCardId(state, "Worm"));
  state = playCard(state, findCardId(state, "Ping"));
  state = playCard(state, findCardId(state, "Ping"));
  state = endTurn(state);

  state = playCard(state, findCardId(state, "Ping"));

  assert.equal(state.mode, "result");
  assert.equal(state.result, "victory");

  const restarted = restartBattle();

  assert.equal(restarted.mode, "battle");
  assert.equal(restarted.turn, 1);
  assert.equal(restarted.enemy.hp, 45);
});

test("battle can end in defeat when the player stalls", () => {
  let state = startBattle();

  for (let i = 0; i < 10 && state.mode === "battle"; i += 1) {
    state = endTurn(state);
  }

  assert.equal(state.mode, "result");
  assert.equal(state.result, "defeat");
  assert.equal(state.player.hp, 0);
});

test("renderGameToText exposes concise machine-readable battle state", () => {
  const state = startBattle();
  const payload = JSON.parse(renderGameToText(state));

  assert.equal(payload.mode, "battle");
  assert.equal(payload.coordinateSystem, "origin=top-left,+x=right,+y=down");
  assert.equal(payload.player.hp, 40);
  assert.equal(payload.enemy.intent.key, "scan");
  assert.deepEqual(payload.hand.map((card) => card.name), ["Ping", "Buffer", "Ping", "Worm", "Buffer"]);
});
