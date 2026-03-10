const MAX_HAND_SIZE = 5;
const REPAIR_HEAL = 8;
const TOTAL_ROWS = 5;
const TOTAL_COMBAT_ENCOUNTERS = 6;
const PHASE_SHIFT_THRESHOLD = 22;

const RELAY_DRONE_INTENTS = [
  { key: "zap", label: "Zap", type: "attack", damage: 5 },
  { key: "shield", label: "Shield", type: "block", block: 4 },
  { key: "mark", label: "Mark", type: "attack+debuff", damage: 3, lag: 1 },
];

const PROXY_WARDEN_INTENTS = [
  { key: "swipe", label: "Swipe", type: "attack", damage: 6 },
  { key: "scrub", label: "Scrub", type: "cleanse+block", clearExposed: true, block: 4 },
  { key: "crush", label: "Crush", type: "attack", damage: 8 },
];

const PHASE_ONE_INTENTS = [
  { key: "scan", label: "Scan", type: "attack", damage: 7 },
  { key: "harden", label: "Harden", type: "block", block: 6 },
  { key: "trace", label: "Trace", type: "attack+debuff", damage: 4, lag: 1 },
];

const PHASE_TWO_INTENTS = [
  { key: "seal", label: "Seal", type: "attack+debuff", damage: 6, lag: 1 },
  { key: "purge", label: "Purge", type: "cleanse+block", clearExposed: true, block: 5 },
  { key: "backtrace", label: "Backtrace", type: "attack", damage: 8 },
];

const CARD_LIBRARY = {
  ping: { name: "Ping", kind: "attack", cost: 1, damage: 6 },
  buffer: { name: "Buffer", kind: "skill", cost: 1, block: 5 },
  worm: { name: "Worm", kind: "status", cost: 1, exposed: 2 },
  probe: { name: "Probe", kind: "setup", cost: 0, exposed: 1, draw: 1 },
  burst: { name: "Burst", kind: "attack", cost: 1, damage: 4, hits: 2 },
  payload: { name: "Payload", kind: "finisher", cost: 2, damage: 8, exposedScale: 4 },
};

const STARTING_DECK = [
  "probe-1",
  "ping-1",
  "buffer-1",
  "worm-1",
  "burst-1",
  "buffer-2",
  "ping-2",
  "probe-2",
  "payload-1",
  "buffer-3",
  "ping-3",
  "worm-2",
];

const ENCOUNTER_TEMPLATES = {
  "relay-drone": {
    key: "relay-drone",
    name: "Relay Drone",
    hp: 24,
    intents: RELAY_DRONE_INTENTS,
  },
  "proxy-warden": {
    key: "proxy-warden",
    name: "Proxy Warden",
    hp: 34,
    intents: PROXY_WARDEN_INTENTS,
  },
  "sentinel-firewall": {
    key: "sentinel-firewall",
    name: "Sentinel Firewall",
    hp: 45,
    intents: PHASE_ONE_INTENTS,
    boss: true,
  },
};

const REWARD_POOLS = {
  core: ["ping", "buffer", "worm"],
  combo: ["probe", "burst", "payload"],
};

const MAP_BOARD = [
  { id: "r1-left-relay", row: 1, lane: "left", type: "combat", encounterKey: "relay-drone", rewardSet: "core" },
  { id: "r1-right-proxy", row: 1, lane: "right", type: "combat", encounterKey: "proxy-warden", rewardSet: "combo" },
  { id: "r2-left-repair", row: 2, lane: "left", type: "repair" },
  { id: "r2-center-relay", row: 2, lane: "center", type: "combat", encounterKey: "relay-drone", rewardSet: "core" },
  { id: "r2-right-repair", row: 2, lane: "right", type: "repair" },
  { id: "r3-left-proxy", row: 3, lane: "left", type: "combat", encounterKey: "proxy-warden", rewardSet: "combo" },
  { id: "r3-right-relay", row: 3, lane: "right", type: "combat", encounterKey: "relay-drone", rewardSet: "core" },
  { id: "r4-left-relay", row: 4, lane: "left", type: "combat", encounterKey: "relay-drone", rewardSet: "core" },
  { id: "r4-center-repair", row: 4, lane: "center", type: "repair" },
  { id: "r4-right-proxy", row: 4, lane: "right", type: "combat", encounterKey: "proxy-warden", rewardSet: "combo" },
  { id: "r5-left-proxy", row: 5, lane: "left", type: "combat", encounterKey: "proxy-warden", rewardSet: "combo" },
  { id: "r5-right-relay", row: 5, lane: "right", type: "combat", encounterKey: "relay-drone", rewardSet: "core" },
  { id: "boss-sentinel", row: 6, lane: "center", type: "combat", encounterKey: "sentinel-firewall", boss: true },
];

const LANE_ORDER = {
  left: 0,
  center: 1,
  right: 2,
};

function getEncounterTemplate(key) {
  return ENCOUNTER_TEMPLATES[key];
}

function getMapNode(nodeId) {
  return MAP_BOARD.find((node) => node.id === nodeId) ?? null;
}

function getNodesForRow(row) {
  return MAP_BOARD.filter((node) => node.row === row);
}

function buildCard(instanceId) {
  const [template] = instanceId.split("-");
  const definition = CARD_LIBRARY[template];
  return {
    id: instanceId,
    template,
    ...definition,
  };
}

function buildRewardOption(nodeId, template) {
  const definition = CARD_LIBRARY[template];
  return {
    id: `${nodeId}-${template}`,
    template,
    name: definition.name,
    kind: definition.kind,
    cost: definition.cost,
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

function getConnectedNodeIds(nodeId) {
  if (!nodeId) {
    return getNodesForRow(1).map((node) => node.id);
  }

  const node = getMapNode(nodeId);
  if (!node) {
    return [];
  }

  const nextRow = node.row + 1;
  const candidates = getNodesForRow(nextRow);
  if (candidates.length === 0) {
    return [];
  }

  const currentLane = LANE_ORDER[node.lane];
  return candidates
    .filter((candidate) => Math.abs(LANE_ORDER[candidate.lane] - currentLane) <= 1)
    .map((candidate) => candidate.id);
}

function createRunState() {
  return {
    encounterIndex: 0,
    totalEncounters: TOTAL_COMBAT_ENCOUNTERS,
    encounterKey: null,
    encounterName: null,
    currentRow: 1,
    totalRows: TOTAL_ROWS,
    currentNodeId: null,
    availableNodeIds: getConnectedNodeIds(null),
    path: [],
    board: structuredClone(MAP_BOARD),
    rewardOptions: [],
    deck: [...STARTING_DECK],
  };
}

function createEmptyBattleState() {
  const placeholder = getEncounterTemplate("relay-drone");

  return {
    mode: "start",
    turn: 0,
    phase: "menu",
    result: null,
    visualTime: 0,
    run: createRunState(),
    player: createActorState({
      hp: 40,
      maxHp: 40,
      energy: 0,
      maxEnergy: 3,
      status: { lag: 0 },
    }),
    enemy: createActorState({
      hp: placeholder.hp,
      maxHp: placeholder.hp,
      encounterKey: placeholder.key,
      encounterName: placeholder.name,
      phase: 1,
      intentIndex: 0,
      intent: placeholder.intents[0],
      status: { exposed: 0 },
    }),
    hand: [],
    drawPile: [],
    discardPile: [],
    lastAction: "Idle",
  };
}

function clearCombatCollections(state) {
  state.hand = [];
  state.drawPile = [];
  state.discardPile = [];
}

function clearTemporaryPlayerState(state) {
  state.player.block = 0;
  state.player.energy = 0;
  state.player.status.lag = 0;
}

function resetRunEncounter(state) {
  state.run.encounterIndex = 0;
  state.run.encounterKey = null;
  state.run.encounterName = null;
}

function appendVisitedNode(state, nodeId) {
  if (!state.run.path.includes(nodeId)) {
    state.run.path.push(nodeId);
  }
}

function enterMapMode(state, action, currentNodeId = state.run.currentNodeId) {
  state.mode = "map";
  state.phase = "route";
  state.turn = 0;
  state.result = null;
  clearCombatCollections(state);
  clearTemporaryPlayerState(state);
  state.run.currentNodeId = currentNodeId;
  state.run.currentRow = currentNodeId ? Math.min(TOTAL_ROWS + 1, getMapNode(currentNodeId).row + 1) : 1;
  state.run.availableNodeIds = getConnectedNodeIds(currentNodeId);
  state.run.rewardOptions = [];
  resetRunEncounter(state);
  state.lastAction = action;
  return state;
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

function getExposedBonus(target) {
  return target.status.exposed > 0 ? 2 : 0;
}

function applyAttackHits(target, damage, hits = 1) {
  for (let hit = 0; hit < hits; hit += 1) {
    applyDamage(target, damage + getExposedBonus(target));
    if (target.hp <= 0) {
      return;
    }
  }
}

function setExposed(target, amount) {
  target.status.exposed = amount;
}

function addExposed(target, amount) {
  target.status.exposed += amount;
}

function consumeExposed(target) {
  const current = target.status.exposed;
  target.status.exposed = 0;
  return current;
}

function getIntentSet(enemy) {
  if (enemy.encounterKey === "relay-drone") {
    return RELAY_DRONE_INTENTS;
  }

  if (enemy.encounterKey === "proxy-warden") {
    return PROXY_WARDEN_INTENTS;
  }

  return enemy.phase === 2 ? PHASE_TWO_INTENTS : PHASE_ONE_INTENTS;
}

function setEnemyIntent(state, intentIndex) {
  const intents = getIntentSet(state.enemy);
  state.enemy.intentIndex = intentIndex;
  state.enemy.intent = intents[intentIndex];
}

function advanceEnemyIntent(state) {
  const intents = getIntentSet(state.enemy);
  const nextIndex = (state.enemy.intentIndex + 1) % intents.length;
  setEnemyIntent(state, nextIndex);
}

function maybeShiftEnemyPhase(state) {
  if (
    state.enemy.encounterKey !== "sentinel-firewall"
    || state.enemy.phase === 2
    || state.enemy.hp <= 0
    || state.enemy.hp > PHASE_SHIFT_THRESHOLD
  ) {
    return false;
  }

  state.enemy.phase = 2;
  state.enemy.status.exposed = 0;
  state.enemy.block += 6;
  setEnemyIntent(state, 0);
  return true;
}

const CARD_EFFECTS = {
  ping(state, card) {
    applyAttackHits(state.enemy, card.damage);
  },
  buffer(state, card) {
    state.player.block += card.block;
  },
  worm(state, card) {
    setExposed(state.enemy, card.exposed);
  },
  probe(state, card) {
    addExposed(state.enemy, card.exposed);
    drawCards(state, card.draw);
  },
  burst(state, card) {
    applyAttackHits(state.enemy, card.damage, card.hits);
  },
  payload(state, card) {
    const exposed = consumeExposed(state.enemy);
    applyDamage(state.enemy, card.damage + (exposed * card.exposedScale));
  },
};

function finalizeResult(state, result, action) {
  state.mode = "result";
  state.phase = "done";
  state.result = result;
  clearCombatCollections(state);
  clearTemporaryPlayerState(state);
  state.run.rewardOptions = [];
  state.run.availableNodeIds = [];
  state.lastAction = action;
  return state;
}

function buildEnemy(encounterKey) {
  const encounter = getEncounterTemplate(encounterKey);
  return createActorState({
    hp: encounter.hp,
    maxHp: encounter.hp,
    encounterKey: encounter.key,
    encounterName: encounter.name,
    phase: 1,
    intentIndex: 0,
    intent: encounter.intents[0],
    status: { exposed: 0 },
  });
}

function startEncounter(state, node) {
  const encounter = getEncounterTemplate(node.encounterKey);
  state.mode = "battle";
  state.phase = "player";
  state.result = null;
  state.turn = 1;
  state.run.currentNodeId = node.id;
  state.run.currentRow = node.row;
  state.run.encounterIndex = node.row;
  state.run.encounterKey = encounter.key;
  state.run.encounterName = encounter.name;
  state.run.rewardOptions = [];
  state.player.block = 0;
  state.player.energy = state.player.maxEnergy;
  state.player.status.lag = 0;
  state.enemy = buildEnemy(node.encounterKey);
  clearCombatCollections(state);
  state.drawPile = state.run.deck.map(buildCard);
  drawCards(state, MAX_HAND_SIZE);
  state.lastAction = `${encounter.name} engaged.`;
  return state;
}

function enterRewardMode(state, node) {
  const rewardOptions = REWARD_POOLS[node.rewardSet].map((template) => buildRewardOption(node.id, template));

  state.mode = "reward";
  state.phase = "reward";
  clearCombatCollections(state);
  clearTemporaryPlayerState(state);
  appendVisitedNode(state, node.id);
  state.run.currentNodeId = node.id;
  state.run.currentRow = Math.min(TOTAL_ROWS + 1, node.row + 1);
  state.run.availableNodeIds = getConnectedNodeIds(node.id);
  state.run.rewardOptions = rewardOptions;
  state.lastAction = `${state.run.encounterName} neutralized. Reward cache opened for row ${state.run.currentRow}.`;
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

  const intent = state.enemy.intent;
  if (intent.damage) {
    applyDamage(state.player, intent.damage);
  }

  if (intent.lag) {
    state.player.status.lag = intent.lag;
  }

  if (intent.clearExposed) {
    state.enemy.status.exposed = 0;
  }

  if (intent.block) {
    state.enemy.block += intent.block;
  }

  if (state.player.hp <= 0) {
    return finalizeResult(state, "defeat", `${state.run.encounterName} executed ${intent.label}.`);
  }

  if (state.enemy.status.exposed > 0) {
    state.enemy.status.exposed -= 1;
  }

  advanceEnemyIntent(state);
  state.lastAction = `${state.run.encounterName} prepared ${state.enemy.intent.label}.`;
  return state;
}

function moveHandToDiscard(state) {
  if (state.hand.length === 0) return;
  state.discardPile.push(...state.hand);
  state.hand = [];
}

function serializeRewardOptions(state) {
  if (state.mode !== "reward") {
    return [];
  }

  return state.run.rewardOptions.map((reward) => ({
    id: reward.id,
    name: reward.name,
    template: reward.template,
    cost: reward.cost,
    kind: reward.kind,
  }));
}

function getNodeStatus(state, node) {
  if (state.run.currentNodeId === node.id) {
    return "current";
  }

  if (state.run.path.includes(node.id)) {
    return "visited";
  }

  if (state.run.availableNodeIds.includes(node.id)) {
    return "available";
  }

  return "locked";
}

function serializeMap(state) {
  return {
    visible: state.mode === "map",
    currentRow: state.run.currentRow,
    totalRows: state.run.totalRows,
    currentNodeId: state.run.currentNodeId,
    availableNodeIds: [...state.run.availableNodeIds],
    path: [...state.run.path],
    nodes: state.run.board.map((node) => ({
      id: node.id,
      row: node.row,
      lane: node.lane,
      type: node.type,
      encounterKey: node.encounterKey ?? null,
      status: getNodeStatus(state, node),
    })),
  };
}

export function createStartState() {
  return createEmptyBattleState();
}

export function startBattle() {
  const state = createEmptyBattleState();
  return enterMapMode(state, "Route board online. Select a breach node.", null);
}

export function restartBattle() {
  return startBattle();
}

export function chooseMapNode(state, nodeId) {
  if (state.mode !== "map") {
    return state;
  }

  if (!state.run.availableNodeIds.includes(nodeId)) {
    return state;
  }

  const node = getMapNode(nodeId);
  if (!node) {
    return state;
  }

  const next = cloneState(state);

  if (node.type === "repair") {
    next.player.hp = Math.min(next.player.maxHp, next.player.hp + REPAIR_HEAL);
    appendVisitedNode(next, node.id);
    return enterMapMode(next, `Repair cycle completed. +${REPAIR_HEAL} HP.`, node.id);
  }

  return startEncounter(next, node);
}

export function chooseReward(state, rewardId) {
  if (state.mode !== "reward") {
    return state;
  }

  const reward = state.run.rewardOptions.find((entry) => entry.id === rewardId);
  if (!reward) {
    return state;
  }

  const next = cloneState(state);
  next.run.deck.push(`${reward.template}-bonus-${next.run.currentNodeId}`);
  return enterMapMode(
    next,
    `${reward.name} injected. Row ${next.run.currentRow} routes unlocked.`,
    next.run.currentNodeId,
  );
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
  CARD_EFFECTS[played.template]?.(next, played);

  next.discardPile.push(played);

  if (next.enemy.hp <= 0) {
    const node = getMapNode(next.run.currentNodeId);
    if (node?.boss) {
      appendVisitedNode(next, node.id);
      return finalizeResult(next, "victory", "Sentinel Firewall neutralized.");
    }
    return enterRewardMode(next, node);
  }

  if (maybeShiftEnemyPhase(next)) {
    next.lastAction = `${next.run.encounterName} entered Phase 2 and prepared ${next.enemy.intent.label}.`;
    return next;
  }

  next.lastAction = `${played.name} executed.`;

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
    run: {
      encounterIndex: state.run.encounterIndex,
      totalEncounters: state.run.totalEncounters,
      encounterKey: state.run.encounterKey,
      encounterName: state.run.encounterName,
    },
    map: serializeMap(state),
    player: {
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      block: state.player.block,
      energy: state.player.energy,
      status: state.player.status,
    },
    enemy: state.mode === "map" || state.mode === "reward"
      ? null
      : {
          hp: state.enemy.hp,
          maxHp: state.enemy.maxHp,
          phase: state.enemy.phase,
          block: state.enemy.block,
          intent: state.enemy.intent,
          status: state.enemy.status,
        },
    hand: state.mode === "map" || state.mode === "reward"
      ? []
      : state.hand.map((card) => ({
          id: card.id,
          name: card.name,
          template: card.template,
          cost: card.cost,
          kind: card.kind,
        })),
    rewardOptions: serializeRewardOptions(state),
    drawPileSize: state.drawPile.length,
    discardPileSize: state.discardPile.length,
    lastAction: state.lastAction,
  };

  return JSON.stringify(payload);
}

export {
  CARD_LIBRARY,
  ENCOUNTER_TEMPLATES,
  MAP_BOARD,
  MAX_HAND_SIZE,
  PHASE_ONE_INTENTS as INTENTS,
  PHASE_SHIFT_THRESHOLD,
  PHASE_TWO_INTENTS,
  REWARD_POOLS,
  STARTING_DECK,
};
