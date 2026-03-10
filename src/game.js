const MAX_HAND_SIZE = 5;

const INTENTS = [
  { key: "scan", label: "Scan", type: "attack", damage: 7 },
  { key: "harden", label: "Harden", type: "block", block: 6 },
  { key: "trace", label: "Trace", type: "attack+debuff", damage: 4, lag: 1 },
];

const CARD_LIBRARY = {
  ping: { name: "Ping", kind: "attack", cost: 1, damage: 6 },
  buffer: { name: "Buffer", kind: "skill", cost: 1, block: 5 },
  worm: { name: "Worm", kind: "status", cost: 1, exposed: 2 },
};

const STARTING_DECK = [
  "ping-1",
  "buffer-1",
  "ping-2",
  "worm-1",
  "buffer-2",
  "ping-3",
  "buffer-3",
  "ping-4",
  "worm-2",
  "buffer-4",
];

function buildCard(instanceId) {
  const [template] = instanceId.split("-");
  const definition = CARD_LIBRARY[template];
  return {
    id: instanceId,
    template,
    ...definition,
  };
}

function cloneState(state) {
  return structuredClone(state);
}

function createActorState(overrides) {
  return {
    hp: 0,
    maxHp: 0,
    block: 0,
    status: {},
    ...overrides,
  };
}

function createEmptyBattleState() {
  return {
    mode: "start",
    turn: 0,
    phase: "menu",
    result: null,
    visualTime: 0,
    player: createActorState({
      hp: 40,
      maxHp: 40,
      energy: 0,
      maxEnergy: 3,
      status: { lag: 0 },
    }),
    enemy: createActorState({
      hp: 45,
      maxHp: 45,
      intentIndex: 0,
      intent: INTENTS[0],
      status: { exposed: 0 },
    }),
    hand: [],
    drawPile: [],
    discardPile: [],
    lastAction: "Idle",
  };
}

function drawCards(state, count) {
  let remaining = count;
  while (remaining > 0 && state.hand.length < MAX_HAND_SIZE) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      state.drawPile = state.discardPile;
      state.discardPile = [];
    }

    const nextCard = state.drawPile.shift();
    if (!nextCard) break;
    state.hand.push(nextCard);
    remaining -= 1;
  }
}

function applyDamage(target, amount) {
  const absorbed = Math.min(target.block, amount);
  const remaining = amount - absorbed;
  target.block -= absorbed;
  target.hp = Math.max(0, target.hp - remaining);
}

function finalizeResult(state, result, action) {
  state.mode = "result";
  state.phase = "done";
  state.result = result;
  state.lastAction = action;
  state.hand = [];
  return state;
}

function startPlayerTurn(state) {
  state.phase = "player";
  state.turn += 1;
  state.player.block = 0;

  const hasLag = state.player.status.lag > 0;
  state.player.energy = hasLag ? 2 : state.player.maxEnergy;
  if (hasLag) {
    state.player.status.lag -= 1;
  }

  drawCards(state, MAX_HAND_SIZE);
}

function resolveEnemyTurn(state) {
  state.phase = "enemy";
  state.enemy.block = 0;

  const intent = INTENTS[state.enemy.intentIndex];
  if (intent.type === "attack") {
    applyDamage(state.player, intent.damage);
  } else if (intent.type === "block") {
    state.enemy.block += intent.block;
  } else {
    applyDamage(state.player, intent.damage);
    state.player.status.lag = intent.lag;
  }

  if (state.player.hp <= 0) {
    return finalizeResult(state, "defeat", `Firewall executed ${intent.label}.`);
  }

  if (state.enemy.status.exposed > 0) {
    state.enemy.status.exposed -= 1;
  }

  state.enemy.intentIndex = (state.enemy.intentIndex + 1) % INTENTS.length;
  state.enemy.intent = INTENTS[state.enemy.intentIndex];
  state.lastAction = `Firewall prepared ${state.enemy.intent.label}.`;
  return state;
}

function moveHandToDiscard(state) {
  if (state.hand.length === 0) return;
  state.discardPile.push(...state.hand);
  state.hand = [];
}

export function createStartState() {
  return createEmptyBattleState();
}

export function startBattle() {
  const state = createEmptyBattleState();
  state.mode = "battle";
  state.phase = "player";
  state.turn = 1;
  state.player.energy = state.player.maxEnergy;
  state.drawPile = STARTING_DECK.map(buildCard);
  drawCards(state, MAX_HAND_SIZE);
  state.lastAction = "Breach initialized.";
  return state;
}

export function restartBattle() {
  return startBattle();
}

export function playCard(state, cardId) {
  if (state.mode !== "battle" || state.phase !== "player") {
    return state;
  }

  const index = state.hand.findIndex((card) => card.id === cardId);
  if (index === -1) {
    return state;
  }

  const card = state.hand[index];
  if (card.cost > state.player.energy) {
    return state;
  }

  const next = cloneState(state);
  const [played] = next.hand.splice(index, 1);
  next.player.energy -= played.cost;

  if (played.template === "ping") {
    const bonus = next.enemy.status.exposed > 0 ? 2 : 0;
    applyDamage(next.enemy, played.damage + bonus);
  } else if (played.template === "buffer") {
    next.player.block += played.block;
  } else if (played.template === "worm") {
    next.enemy.status.exposed = played.exposed;
  }

  next.discardPile.push(played);
  next.lastAction = `${played.name} executed.`;

  if (next.enemy.hp <= 0) {
    return finalizeResult(next, "victory", "Sentinel Firewall neutralized.");
  }

  return next;
}

export function endTurn(state) {
  if (state.mode !== "battle" || state.phase !== "player") {
    return state;
  }

  const next = cloneState(state);
  moveHandToDiscard(next);
  const resolved = resolveEnemyTurn(next);
  if (resolved.mode === "result") {
    return resolved;
  }
  startPlayerTurn(resolved);
  return resolved;
}

export function advanceVisualState(state, dt) {
  const next = cloneState(state);
  next.visualTime += dt;
  return next;
}

export function renderGameToText(state) {
  const payload = {
    coordinateSystem: "origin=top-left,+x=right,+y=down",
    mode: state.mode,
    phase: state.phase,
    turn: state.turn,
    result: state.result,
    player: {
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      block: state.player.block,
      energy: state.player.energy,
      status: state.player.status,
    },
    enemy: {
      hp: state.enemy.hp,
      maxHp: state.enemy.maxHp,
      block: state.enemy.block,
      intent: state.enemy.intent,
      status: state.enemy.status,
    },
    hand: state.hand.map((card) => ({
      id: card.id,
      name: card.name,
      cost: card.cost,
      kind: card.kind,
    })),
    drawPileSize: state.drawPile.length,
    discardPileSize: state.discardPile.length,
    lastAction: state.lastAction,
  };

  return JSON.stringify(payload);
}

export { CARD_LIBRARY, INTENTS, MAX_HAND_SIZE };
