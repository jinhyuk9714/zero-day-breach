import "./style.css";

import {
  advanceVisualState,
  chooseMapNode,
  chooseReward,
  createStartState,
  endTurn,
  playCard,
  renderGameToText,
  restartBattle,
  startBattle,
} from "./game.js";
import { computeFannedHandLayout, evaluateDragCommit } from "./drag-hand.js";
import { buildUiModel, computeBattleViewport, getViewportMetrics } from "./ui-model.js";

const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
const LOADOUT_TAGS = ["3 Ping", "3 Buffer", "2 Worm", "2 Probe", "1 Burst", "1 Payload"];
const FX_LIMITS = {
  enemyHit: 0.44,
  playerHit: 0.44,
  phaseShift: 1.1,
  intentSwap: 0.42,
  beamSurge: 0.5,
  statusFlash: 0.56,
  resultGlow: 0.9,
};
const STAT_PULSE_DURATION = 0.62;
const CARD_LAUNCH_DURATION = 0.48;
const INVALID_RETURN_DURATION = 0.24;
const MAP_LANE_COLUMNS = {
  left: 1,
  center: 2,
  right: 3,
};
const MAP_LANE_POINTS = {
  left: 50,
  center: 150,
  right: 250,
};

const root = document.documentElement;
const shell = document.querySelector(".game-shell");
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start-btn");
const endTurnButton = document.querySelector("#end-turn-btn");
const restartButton = document.querySelector("#restart-btn");
const handRailShell = document.querySelector(".hand-rail-shell");
const handRail = document.querySelector("#hand-rail");
const statusLine = document.querySelector("#status-line");
const drawCount = document.querySelector("#draw-count");
const discardCount = document.querySelector("#discard-count");
const lagCount = document.querySelector("#lag-count");
const playerStats = document.querySelector("#player-stats");
const enemyStats = document.querySelector("#enemy-stats");
const playerPanel = document.querySelector("#player-panel");
const enemyPanel = document.querySelector("#enemy-panel");
const enemyPanelLabel = document.querySelector("#enemy-panel-label");
const enemyPanelTitle = document.querySelector("#enemy-panel-title");
const phasePill = document.querySelector("#phase-pill");
const headerNote = document.querySelector("#header-note");
const enemyIntentTag = document.querySelector("#enemy-intent-tag");
const enemyIntentTitle = document.querySelector("#enemy-intent-title");
const enemyIntentDetail = document.querySelector("#enemy-intent-detail");
const intentCard = document.querySelector(".intent-card");
const stage = document.querySelector(".battle-stage");
const startOverlay = document.querySelector("#start-overlay");
const briefList = document.querySelector("#brief-list");
const playLane = document.querySelector("#play-lane");
const playLaneLabel = document.querySelector("#play-lane-label");
const mapOverlay = document.querySelector("#map-overlay");
const mapTitle = document.querySelector("#map-title");
const mapDetail = document.querySelector("#map-detail");
const mapLinks = document.querySelector("#map-links");
const mapBoard = document.querySelector("#map-board");
const rewardOverlay = document.querySelector("#reward-overlay");
const rewardTitle = document.querySelector("#reward-title");
const rewardDetail = document.querySelector("#reward-detail");
const rewardChoices = document.querySelector("#reward-choices");
const resultOverlay = document.querySelector("#result-overlay");
const resultEyebrow = document.querySelector("#result-eyebrow");
const resultTitle = document.querySelector("#result-title");
const resultDetail = document.querySelector("#result-detail");
const resultAction = document.querySelector("#result-action");
const dockTitle = document.querySelector("#dock-title");
const launchGhost = document.querySelector("#launch-ghost");
const launchGhostCost = document.querySelector("#launch-ghost-cost");
const launchGhostName = document.querySelector("#launch-ghost-name");
const launchGhostKind = document.querySelector("#launch-ghost-kind");
const minimapShell = document.querySelector("#minimap-shell");
const minimapTitle = document.querySelector("#minimap-title");
const minimapLinks = document.querySelector("#minimap-links");
const minimapBoard = document.querySelector("#minimap-board");

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let state = createStartState();
let currentUi = buildUiModel(state);
let layout = null;
let rafHandle = 0;
let lastFrameTime = performance.now();
let motionScale = reduceMotionQuery.matches ? 0.6 : 1;
let visualFx = createVisualFx();
let dragState = createDragState();
let suppressClickUntil = 0;

function createVisualFx() {
  return {
    enemyHit: 0,
    playerHit: 0,
    phaseShift: 0,
    intentSwap: 0,
    beamSurge: 0,
    statusFlash: 0,
    resultGlow: 0,
    stats: Object.create(null),
    piles: Object.create(null),
    cardLaunch: null,
  };
}

function createDragState() {
  return {
    activeCardId: null,
    pointerId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    offsetX: 0,
    offsetY: 0,
    armed: false,
    invalid: false,
    returnTimer: 0,
    returningCardId: null,
    progress: 0,
    moved: false,
    originHeight: 0,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

function normalizedTimer(value, max) {
  if (max <= 0) {
    return 0;
  }
  return easeOutCubic(clamp(value / max, 0, 1));
}

function effectLevel(key) {
  return normalizedTimer(visualFx[key], FX_LIMITS[key] * motionScale);
}

function pulseLevel(scope, key) {
  const map = scope === "piles" ? visualFx.piles : visualFx.stats;
  return normalizedTimer(map[key] ?? 0, STAT_PULSE_DURATION * motionScale);
}

function triggerFx(key, multiplier = 1) {
  const duration = FX_LIMITS[key] * motionScale * multiplier;
  visualFx[key] = Math.max(visualFx[key], duration);
}

function pulseStat(key, multiplier = 1) {
  visualFx.stats[key] = Math.max(
    visualFx.stats[key] ?? 0,
    STAT_PULSE_DURATION * motionScale * multiplier,
  );
}

function pulsePile(key, multiplier = 1) {
  visualFx.piles[key] = Math.max(
    visualFx.piles[key] ?? 0,
    STAT_PULSE_DURATION * motionScale * multiplier,
  );
}

function tickVisualFx(dt) {
  Object.keys(FX_LIMITS).forEach((key) => {
    visualFx[key] = Math.max(0, visualFx[key] - dt);
  });

  Object.keys(visualFx.stats).forEach((key) => {
    visualFx.stats[key] = Math.max(0, visualFx.stats[key] - dt);
    if (visualFx.stats[key] === 0) {
      delete visualFx.stats[key];
    }
  });

  Object.keys(visualFx.piles).forEach((key) => {
    visualFx.piles[key] = Math.max(0, visualFx.piles[key] - dt);
    if (visualFx.piles[key] === 0) {
      delete visualFx.piles[key];
    }
  });

  if (visualFx.cardLaunch) {
    visualFx.cardLaunch.time = Math.max(0, visualFx.cardLaunch.time - dt);
    if (visualFx.cardLaunch.time === 0) {
      visualFx.cardLaunch = null;
    }
  }
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function createStatChip(scope, name, stat, tone) {
  const chip = document.createElement("article");
  chip.className = `stat-chip ${tone}`;
  if (stat.highlighted) {
    chip.classList.add("stat-chip--highlighted");
  }

  const label = document.createElement("span");
  label.className = "stat-chip__label";
  label.textContent = stat.label;

  const value = document.createElement("strong");
  value.className = "stat-chip__value";
  value.textContent = String(stat.value);

  chip.append(label, value);
  chip.dataset.statKey = `${scope}-${name}`;
  return chip;
}

function renderStatCollection(container, scope, entries, tone) {
  container.replaceChildren(
    ...entries.map(([name, stat]) => createStatChip(scope, name, stat, tone)),
  );
}

function createCardButton(card) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `command-card command-card--${card.template}`;
  if (card.accented) {
    button.classList.add("command-card--accented");
  }
  button.dataset.cardId = card.id;
  button.disabled = !card.playable;
  button.setAttribute("aria-label", `${card.name}, cost ${card.cost}. ${card.summary}`);

  const top = document.createElement("div");
  top.className = "command-card__top";

  const cost = document.createElement("span");
  cost.className = "command-card__cost";
  cost.textContent = String(card.cost);

  const meta = document.createElement("div");
  meta.className = "command-card__meta";

  const title = document.createElement("h3");
  title.textContent = card.name;

  const kind = document.createElement("p");
  kind.className = "command-card__kind";
  kind.textContent = card.kind;

  meta.append(title, kind);
  top.append(cost, meta);

  const summary = document.createElement("p");
  summary.className = "command-card__summary";
  summary.textContent = card.summary;

  const availability = document.createElement("span");
  availability.className = "command-card__availability";
  availability.textContent = card.playable ? "Ready" : "Low energy";

  button.append(top, summary, availability);
  return button;
}

function createRewardButton(card) {
  const button = createCardButton({ ...card, playable: true, accented: false });
  button.classList.add("reward-card");
  button.dataset.rewardId = card.id;
  button.setAttribute("aria-label", `${card.name}. ${card.summary}. Install package.`);
  button.querySelector(".command-card__availability").textContent = "Install";
  return button;
}

function createMapNodeButton(node, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `map-node map-node--${node.type} map-node--${node.status}`;
  if (node.id === "boss-sentinel") {
    button.classList.add("map-node--boss");
  }
  if (options.compact) {
    button.classList.add("map-node--mini");
  }

  button.dataset.mapNodeId = node.id;
  button.style.gridColumn = String(MAP_LANE_COLUMNS[node.lane]);
  button.style.gridRow = String(node.row);
  button.disabled = !options.interactive || !node.selectable;
  button.setAttribute(
    "aria-label",
    `${node.title}. ${node.label}. ${node.status}.`,
  );

  const label = document.createElement("span");
  label.className = "map-node__label";
  label.textContent = node.label;

  const title = document.createElement("strong");
  title.className = "map-node__title";
  title.textContent = node.title;

  const meta = document.createElement("span");
  meta.className = "map-node__meta";
  meta.textContent = node.status;

  button.append(label, title, meta);
  return button;
}

function getMapNodePoint(node) {
  return {
    x: MAP_LANE_POINTS[node.lane],
    y: 48 + ((node.row - 1) * 92),
  };
}

function getConnectedMapNodes(nodes, node) {
  if (node.row >= 6) {
    return [];
  }

  const currentLane = MAP_LANE_COLUMNS[node.lane] - 1;
  return nodes.filter((candidate) =>
    candidate.row === node.row + 1
    && Math.abs((MAP_LANE_COLUMNS[candidate.lane] - 1) - currentLane) <= 1
  );
}

function renderMapLinks(svg, nodes) {
  const lineNodes = [];

  nodes.forEach((node) => {
    getConnectedMapNodes(nodes, node).forEach((target) => {
      const start = getMapNodePoint(node);
      const end = getMapNodePoint(target);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(start.x));
      line.setAttribute("y1", String(start.y));
      line.setAttribute("x2", String(end.x));
      line.setAttribute("y2", String(end.y));
      line.classList.add("map-link");
      if (node.status === "current" || target.status === "current") {
        line.classList.add("map-link--current");
      } else if (node.status === "visited" && target.status !== "locked") {
        line.classList.add("map-link--visited");
      } else if (node.status === "available" || target.status === "available") {
        line.classList.add("map-link--available");
      }
      lineNodes.push(line);
    });
  });

  svg.replaceChildren(...lineNodes);
}

function renderMapBoard(container, svg, nodes, options = {}) {
  renderMapLinks(svg, nodes);
  container.replaceChildren(...nodes.map((node) => createMapNodeButton(node, options)));
}

function createBriefChip(line) {
  const item = document.createElement("article");
  item.className = "brief-chip";
  item.textContent = line;
  return item;
}

function renderBrief(brief) {
  briefList.replaceChildren(...brief.map(createBriefChip));
}

function renderEmptyHand(ui) {
  const rail = document.createElement("article");
  rail.className = "empty-rail";

  const message = document.createElement("p");
  if (ui.mode === "start") {
    message.textContent = "Deterministic loadout locked. Start Breach to open the route board.";
  } else if (ui.mode === "map") {
    message.textContent = "Route selection active. Choose an available node in the stage board.";
  } else if (ui.mode === "reward") {
    message.textContent = "Reward cache active. Install one package in the stage overlay to continue the run.";
  } else if (ui.mode === "result") {
    message.textContent = "Run resolved. Restart Run to replay the same fixed map.";
  } else {
    message.textContent = "Hand empty. End the turn to force the firewall response.";
  }

  rail.append(message);
  if (ui.mode === "start") {
    const tags = document.createElement("div");
    tags.className = "empty-rail__tags";
    LOADOUT_TAGS.forEach((label) => {
      const pill = document.createElement("span");
      pill.textContent = label;
      tags.append(pill);
    });
    rail.append(tags);
  }
  handRail.replaceChildren(rail);
}

function getModePresentation(ui) {
  if (ui.mode === "start") {
    return {
      phase: "MENU",
      note: "Fixed 5-node route with combat and repair branches before the Sentinel boss.",
      dock: "Ready rail",
    };
  }

  if (ui.mode === "map") {
    return {
      phase: ui.run.nextProgressLabel,
      note: "Route board active. Choose one connected node to continue the breach.",
      dock: "Route board",
    };
  }

  if (ui.mode === "reward") {
    return {
      phase: "CACHE",
      note: `Install one package before ${ui.run.nextProgressLabel}.`,
      dock: "Reward cache",
    };
  }

  if (ui.mode === "result") {
    return {
      phase: "DEBRIEF",
      note: "Run resolved. Restart to replay the fixed branching map.",
      dock: "Run archive",
    };
  }

  return {
    phase: ui.run.progressLabel,
    note: `${ui.run.encounterName} live. Spend energy, pressure Exposed, then end the turn.`,
    dock: "Command rail",
  };
}

function renderStaticHud(ui) {
  document.body.dataset.mode = ui.mode;
  const presentation = getModePresentation(ui);

  phasePill.textContent = presentation.phase;
  headerNote.textContent = presentation.note;
  dockTitle.textContent = presentation.dock;
  enemyPanelLabel.textContent = ui.mode === "map"
    ? "Route board"
    : ui.mode === "reward"
      ? "Reward cache"
      : ui.mode === "result"
        ? "Run archive"
      : ui.run.progressLabel === "BOSS"
        ? "Sentinel core"
        : "Node target";
  enemyPanelTitle.textContent = ui.mode === "map"
    ? `Select ${ui.run.nextProgressLabel}`
    : ui.mode === "reward"
      ? `Next: ${ui.run.nextProgressLabel}`
      : ui.mode === "result"
        ? "Final trace"
      : ui.run.encounterName ?? "Route trace";

  renderBrief(ui.brief);

  renderStatCollection(
    playerStats,
    "player",
    [
      ["hp", ui.player.hp],
      ["block", ui.player.block],
      ["energy", ui.player.energy],
      ["turn", ui.player.turn],
      ["lag", ui.player.lag],
    ],
    "stat-chip--accent",
  );

  renderStatCollection(
    enemyStats,
    "enemy",
    [
      ["phase", ui.enemy.phase],
      ["hp", ui.enemy.hp],
      ["block", ui.enemy.block],
      ["exposed", ui.enemy.exposed],
    ],
    "stat-chip--warm",
  );

  enemyIntentTag.textContent = ui.enemy.intent.tag;
  enemyIntentTitle.textContent = ui.enemy.intent.title;
  enemyIntentDetail.textContent = ui.enemy.intent.detail;

  statusLine.textContent = ui.status;
  drawCount.textContent = `Draw ${ui.piles.draw}`;
  discardCount.textContent = `Discard ${ui.piles.discard}`;
  lagCount.textContent = `Lag ${ui.player.lag.value}`;

  startButton.hidden = !ui.actions.start.visible;
  endTurnButton.hidden = !ui.actions.endTurn.visible;
  restartButton.hidden = !ui.actions.restart.visible;
  startButton.textContent = ui.actions.start.label;
  endTurnButton.textContent = ui.actions.endTurn.label;
  restartButton.textContent = ui.actions.restart.label;
  endTurnButton.disabled = ui.actions.endTurn.disabled;

  if (ui.hand.length > 0) {
    handRail.replaceChildren(...ui.hand.map(createCardButton));
  } else {
    renderEmptyHand(ui);
  }

  startOverlay.hidden = ui.mode !== "start";
  mapOverlay.hidden = !ui.map.overlayVisible;
  mapTitle.textContent = ui.map.title;
  mapDetail.textContent = ui.map.detail;
  renderMapBoard(mapBoard, mapLinks, ui.map.nodes, { interactive: ui.mode === "map" });
  rewardOverlay.hidden = !ui.reward.visible;
  rewardTitle.textContent = ui.reward.title;
  rewardDetail.textContent = ui.reward.detail;
  rewardChoices.replaceChildren(...ui.rewardOptions.map(createRewardButton));
  resultOverlay.hidden = !ui.result.visible;
  resultEyebrow.textContent = ui.result.eyebrow;
  resultTitle.textContent = ui.result.title;
  resultDetail.textContent = ui.result.detail;
  resultAction.textContent = ui.result.visible ? `${ui.status} Use Restart Run to breach again.` : "";

  minimapShell.hidden = !ui.map.minimapVisible;
  minimapTitle.textContent = ui.mode === "map" ? "Select route" : ui.run.progressLabel;
  renderMapBoard(minimapBoard, minimapLinks, ui.map.nodes, { interactive: ui.mode === "map", compact: true });
}

function resetDragGesture() {
  dragState.activeCardId = null;
  dragState.pointerId = null;
  dragState.startX = 0;
  dragState.startY = 0;
  dragState.currentX = 0;
  dragState.currentY = 0;
  dragState.offsetX = 0;
  dragState.offsetY = 0;
  dragState.armed = false;
  dragState.progress = 0;
  dragState.moved = false;
  dragState.originHeight = 0;
}

function scheduleReturn(cardId, invalid = true) {
  dragState.returningCardId = cardId;
  dragState.invalid = invalid;
  dragState.returnTimer = INVALID_RETURN_DURATION * motionScale;
  resetDragGesture();
}

function getPlayLaneTop() {
  if (playLane.hidden) {
    return Number.POSITIVE_INFINITY;
  }
  const rect = playLane.getBoundingClientRect();
  return rect.top + (rect.height * 0.65);
}

function evaluateActiveDrag(card = null) {
  if (!dragState.activeCardId || !card) {
    return null;
  }

  const evaluation = evaluateDragCommit({
    layoutMode: layout?.layoutMode ?? "stacked",
    mode: state.mode,
    playable: card.cost <= state.player.energy,
    originY: dragState.startY,
    currentY: dragState.currentY,
    laneTop: getPlayLaneTop(),
    cardCenterY: dragState.currentY - dragState.offsetY + (dragState.originHeight / 2),
  });

  dragState.armed = evaluation.armed;
  dragState.invalid = evaluation.invalid;
  dragState.progress = evaluation.progress;
  return evaluation;
}

function applyHandPresentation(ui) {
  const cards = [...handRail.querySelectorAll(".command-card")];
  const fanned = ui.handPresentation.layout === "fanned";

  handRail.classList.toggle("hand-rail--fanned", fanned);
  handRailShell.classList.toggle("hand-rail-shell--fanned", fanned);

  if (!cards.length) {
    return;
  }

  if (!fanned) {
    cards.forEach((card) => {
      card.classList.remove(
        "command-card--dragging",
        "command-card--armed",
        "command-card--invalid",
        "command-card--returning",
      );
      card.style.removeProperty("--fan-x");
      card.style.removeProperty("--fan-y");
      card.style.removeProperty("--fan-rotation");
      card.style.removeProperty("--fan-z");
      card.style.removeProperty("--drag-x");
      card.style.removeProperty("--drag-y");
      card.style.removeProperty("--drag-rotation");
      card.style.removeProperty("--card-scale");
      card.style.removeProperty("--bottom-lift");
      card.style.removeProperty("z-index");
    });
    return;
  }

  const railWidth = handRailShell.clientWidth || handRail.clientWidth || 900;
  const fanLayout = computeFannedHandLayout({
    count: cards.length,
    railWidth,
    cardWidth: Math.min(railWidth * 0.155, 168),
  });

  cards.forEach((card, index) => {
    const fan = fanLayout[index];
    const isDragging = dragState.activeCardId === card.dataset.cardId;
    const isReturning = dragState.returningCardId === card.dataset.cardId && dragState.returnTimer > 0;
    const dragX = isDragging ? dragState.currentX - dragState.startX : 0;
    const dragY = isDragging ? dragState.currentY - dragState.startY : 0;

    card.style.setProperty("--fan-x", `${fan.x}px`);
    card.style.setProperty("--fan-y", `${fan.y}px`);
    card.style.setProperty("--fan-rotation", `${fan.rotation}deg`);
    card.style.setProperty("--fan-z", String(fan.zIndex));
    card.style.setProperty("--drag-x", `${dragX}px`);
    card.style.setProperty("--drag-y", `${dragY}px`);
    card.style.setProperty("--drag-rotation", `${clamp(dragX / 16, -8, 8)}deg`);
    card.style.setProperty("--card-scale", isDragging ? "1.05" : "1");
    card.style.zIndex = String(isDragging ? 90 : fan.zIndex);
    card.classList.toggle("command-card--dragging", isDragging);
    card.classList.toggle("command-card--armed", isDragging && dragState.armed);
    card.classList.toggle("command-card--invalid", isReturning && dragState.invalid);
    card.classList.toggle("command-card--returning", isReturning);
  });
}

function renderPlayLane(ui) {
  const visible = ui.handPresentation.laneVisible;
  const active = visible && Boolean(dragState.activeCardId);

  playLane.hidden = !visible;
  if (!visible) {
    return;
  }

  playLane.classList.toggle("play-lane--active", active);
  playLane.classList.toggle("play-lane--armed", active && dragState.armed);
  playLane.classList.toggle("play-lane--invalid", active && !dragState.armed && dragState.progress > 0.1);

  if (!active) {
    playLaneLabel.textContent = "Drag a card upward to execute";
    return;
  }

  const card = state.hand.find((entry) => entry.id === dragState.activeCardId);
  playLaneLabel.textContent = dragState.armed
    ? `Release to execute ${card?.name ?? "card"}`
    : `Pull ${card?.name ?? "card"} into the lane`;
}

function applyPulse(element, level, className = "is-pulsing") {
  element.classList.toggle(className, level > 0.02);
  element.style.setProperty("--pulse", level.toFixed(3));
}

function renderLaunchGhost() {
  if (!visualFx.cardLaunch) {
    launchGhost.hidden = true;
    return;
  }

  const progress = 1 - clamp(visualFx.cardLaunch.time / visualFx.cardLaunch.duration, 0, 1);
  const arc = Math.sin(progress * Math.PI);
  const x = lerp(10, 46, progress);
  const y = lerp(76, 34, progress) - arc * 6;
  const rotation = lerp(-10, 6, progress);
  const scale = lerp(0.92, 1.02, arc);
  const opacity = progress < 0.1 ? progress / 0.1 : 1 - clamp((progress - 0.78) / 0.22, 0, 1);

  launchGhost.hidden = false;
  launchGhost.className = `launch-ghost launch-ghost--${visualFx.cardLaunch.template}`;
  launchGhostCost.textContent = String(visualFx.cardLaunch.cost);
  launchGhostName.textContent = visualFx.cardLaunch.name;
  launchGhostKind.textContent = visualFx.cardLaunch.kind;
  launchGhost.style.setProperty("--launch-x", `${x}%`);
  launchGhost.style.setProperty("--launch-y", `${y}%`);
  launchGhost.style.setProperty("--launch-rotation", `${rotation}deg`);
  launchGhost.style.setProperty("--launch-scale", scale.toFixed(3));
  launchGhost.style.setProperty("--launch-opacity", opacity.toFixed(3));
}

function renderDynamicHud() {
  const enemyHit = effectLevel("enemyHit");
  const playerHit = effectLevel("playerHit");
  const phaseShift = effectLevel("phaseShift");
  const intentSwap = effectLevel("intentSwap");
  const statusFlash = effectLevel("statusFlash");
  const resultGlow = effectLevel("resultGlow");

  shell.dataset.layout = layout.layoutMode;
  stage.dataset.phase = state.mode === "battle" ? String(state.enemy.phase) : "0";
  stage.classList.toggle("battle-stage--phase-shift", phaseShift > 0.04);
  stage.classList.toggle("battle-stage--dragging", Boolean(dragState.activeCardId));
  stage.style.setProperty("--enemy-hit", enemyHit.toFixed(3));
  stage.style.setProperty("--player-hit", playerHit.toFixed(3));
  stage.style.setProperty("--phase-shift", phaseShift.toFixed(3));
  stage.style.setProperty("--drag-glow", dragState.progress.toFixed(3));
  stage.style.setProperty("--beam-surge", (effectLevel("beamSurge") + dragState.progress * 0.2).toFixed(3));
  resultOverlay.style.setProperty("--result-glow", resultGlow.toFixed(3));

  enemyPanel.classList.toggle("panel--hot", enemyHit > 0.08 || phaseShift > 0.08);
  playerPanel.classList.toggle("panel--hot", playerHit > 0.08);
  phasePill.classList.toggle("phase-pill--shift", phaseShift > 0.08);
  intentCard.classList.toggle("intent-card--swap", intentSwap > 0.04);
  intentCard.style.setProperty("--swap", intentSwap.toFixed(3));

  applyPulse(statusLine, statusFlash, "status-line--flash");
  applyPulse(drawCount, pulseLevel("piles", "draw"));
  applyPulse(discardCount, pulseLevel("piles", "discard"));
  applyPulse(lagCount, pulseLevel("piles", "lag"));

  document.querySelectorAll("[data-stat-key]").forEach((chip) => {
    const level = pulseLevel("stats", chip.dataset.statKey);
    applyPulse(chip, level, "stat-chip--pulse");
  });

  applyHandPresentation(currentUi);
  renderPlayLane(currentUi);
  renderLaunchGhost();
}

function drawGrid(alpha = 0.08) {
  ctx.save();
  ctx.strokeStyle = `rgba(102, 224, 255, ${alpha})`;
  ctx.lineWidth = 1;
  for (let x = 0; x <= LOGICAL_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LOGICAL_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= LOGICAL_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(LOGICAL_WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBackdrop() {
  const phaseShift = effectLevel("phaseShift");
  const beamSurge = effectLevel("beamSurge");
  const phaseTwo = state.mode === "battle" && state.enemy.phase === 2 ? 1 : 0;
  const danger = clamp((phaseTwo * 0.6) + phaseShift * 0.7, 0, 1);

  const gradient = ctx.createLinearGradient(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  gradient.addColorStop(0, phaseTwo ? "#07131f" : "#05111c");
  gradient.addColorStop(0.48, phaseTwo ? "#24152b" : "#092237");
  gradient.addColorStop(1, phaseTwo ? "#160d16" : "#06131f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const cold = ctx.createRadialGradient(180, 560, 40, 180, 560, 320);
  cold.addColorStop(0, `rgba(102, 224, 255, ${0.22 + beamSurge * 0.18})`);
  cold.addColorStop(1, "rgba(102, 224, 255, 0)");
  ctx.fillStyle = cold;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const warm = ctx.createRadialGradient(1030, 180, 20, 1030, 180, 320);
  warm.addColorStop(0, `rgba(255, 138, 91, ${0.2 + danger * 0.22})`);
  warm.addColorStop(1, "rgba(255, 138, 91, 0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  if (phaseShift > 0.02) {
    ctx.fillStyle = `rgba(255, 220, 181, ${phaseShift * 0.1})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  drawGrid(0.08 + beamSurge * 0.05);
}

function drawCircuitBands() {
  const beamSurge = effectLevel("beamSurge");

  ctx.save();
  ctx.strokeStyle = `rgba(102, 224, 255, ${0.14 + beamSurge * 0.12})`;
  ctx.lineWidth = 2;
  for (let index = 0; index < 5; index += 1) {
    const y = 120 + index * 100;
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(220, y);
    ctx.lineTo(260, y + 24);
    ctx.lineTo(430, y + 24);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHitFlare(x, y, color, intensity) {
  if (intensity <= 0.02) {
    return;
  }

  const radius = 90 + intensity * 110;
  const flare = ctx.createRadialGradient(x, y, 12, x, y, radius);
  flare.addColorStop(0, color);
  flare.addColorStop(0.45, color.replace("1)", `${0.22 + intensity * 0.22})`));
  flare.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = flare;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawRingBurst(x, y, intensity, color) {
  if (intensity <= 0.02) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (let ring = 0; ring < 3; ring += 1) {
    const radius = 110 + ring * 26 + intensity * 28;
    ctx.globalAlpha = clamp(0.24 - ring * 0.05 + intensity * 0.18, 0, 0.9);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCore(x, y, options) {
  const pulse = Math.sin(state.visualTime * options.speed + options.offset) * 0.5 + 0.5;
  const recoil = options.recoil * 18;
  const flash = options.flash;

  ctx.save();
  ctx.translate(x + options.recoilX * recoil, y + options.recoilY * recoil);
  ctx.rotate(state.visualTime * options.rotation + options.phaseTwist * 0.08);

  ctx.shadowBlur = 24 + flash * 24;
  ctx.shadowColor = options.shadow;

  for (let ring = 0; ring < 3; ring += 1) {
    ctx.beginPath();
    ctx.strokeStyle = ring === 0 ? options.ring : options.ringSoft;
    ctx.lineWidth = 4 - ring + flash * 0.7;
    ctx.arc(0, 0, options.radius + ring * 22 + pulse * 4 + options.phaseTwist * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = options.fill;
  ctx.arc(0, 0, options.inner + pulse * 5 + flash * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawLinkBeam() {
  const beamSurge = effectLevel("beamSurge");
  const phaseShift = effectLevel("phaseShift");
  const wobble = Math.sin(state.visualTime * 2.6) * (14 + beamSurge * 8 + phaseShift * 14);

  ctx.save();
  ctx.strokeStyle = `rgba(102, 224, 255, ${0.34 + beamSurge * 0.3})`;
  ctx.lineWidth = 3 + beamSurge * 2;
  ctx.beginPath();
  ctx.moveTo(270, 495);
  ctx.bezierCurveTo(470, 450 + wobble, 740, 360 - wobble, 992, 240);
  ctx.stroke();

  ctx.fillStyle = `rgba(102, 224, 255, ${0.22 + beamSurge * 0.18})`;
  for (let point = 0; point < 5; point += 1) {
    const t = ((state.visualTime * (0.35 + beamSurge * 0.18)) + point * 0.18) % 1;
    const x = 270 + t * 722;
    const y = 495 - t * 250 + Math.sin(t * Math.PI * 2 + state.visualTime * 2) * (18 + beamSurge * 8);
    ctx.beginPath();
    ctx.arc(x, y, 5 + beamSurge * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawScene() {
  const enemyHit = effectLevel("enemyHit");
  const playerHit = effectLevel("playerHit");
  const phaseShift = effectLevel("phaseShift");
  const enemyExposed = state.mode === "battle" ? state.enemy.status.exposed : 0;

  drawBackdrop();
  drawCircuitBands();
  drawLinkBeam();

  drawCore(242, 504, {
    speed: 2.2,
    offset: 0.5,
    rotation: 0.18,
    ring: "rgba(102, 224, 255, 0.78)",
    ringSoft: "rgba(102, 224, 255, 0.28)",
    fill: "rgba(21, 86, 129, 0.72)",
    shadow: "rgba(102, 224, 255, 0.55)",
    radius: 78,
    inner: 42,
    recoil: playerHit,
    recoilX: -1,
    recoilY: 0.1,
    flash: playerHit,
    phaseTwist: 0,
  });

  drawCore(1002, 216, {
    speed: 1.8,
    offset: 1.2,
    rotation: 0.28,
    ring: enemyExposed > 0 ? "rgba(255, 205, 122, 0.84)" : "rgba(255, 138, 91, 0.82)",
    ringSoft: enemyExposed > 0 ? "rgba(255, 205, 122, 0.26)" : "rgba(255, 138, 91, 0.24)",
    fill: enemyExposed > 0 ? "rgba(255, 191, 109, 0.88)" : "rgba(255, 128, 80, 0.9)",
    shadow: "rgba(255, 138, 91, 0.55)",
    radius: 92,
    inner: 46,
    recoil: enemyHit + phaseShift * 0.3,
    recoilX: 1,
    recoilY: -0.08,
    flash: enemyHit + phaseShift * 0.35,
    phaseTwist: phaseShift,
  });

  drawHitFlare(242, 504, "rgba(102, 224, 255, 1)", playerHit);
  drawHitFlare(1002, 216, enemyExposed > 0 ? "rgba(255, 208, 118, 1)" : "rgba(255, 138, 91, 1)", enemyHit + phaseShift * 0.2);
  drawRingBurst(1002, 216, phaseShift, "rgba(255, 224, 186, 0.9)");

  if (state.mode === "start") {
    ctx.save();
    ctx.fillStyle = "rgba(237, 251, 255, 0.06)";
    ctx.font = '700 64px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText("ZERO-DAY", 84, 112);
    ctx.fillStyle = "rgba(237, 251, 255, 0.04)";
    ctx.font = '700 34px "Avenir Next", "Segoe UI", sans-serif';
    ctx.fillText("TACTICAL BREACH CONSOLE", 86, 154);
    ctx.restore();
  }

  if (state.mode === "result") {
    ctx.save();
    ctx.fillStyle = `rgba(2, 8, 14, ${0.36 + effectLevel("resultGlow") * 0.16})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.restore();
  }
}

function renderCanvas() {
  drawScene();
}

function updateLayout() {
  const viewport = getViewportMetrics(window);
  layout = computeBattleViewport({
    width: viewport.width,
    height: viewport.height,
    fullscreen: Boolean(document.fullscreenElement),
  });

  const appWidth = layout.layoutMode === "console"
    ? layout.canvasWidth + layout.sidebarWidth + layout.gap
    : Math.max(layout.canvasWidth, 320);

  root.style.setProperty("--viewport-height", `${viewport.height}px`);
  root.style.setProperty("--layout-padding", `${layout.padding}px`);
  root.style.setProperty("--app-width", `${Math.max(320, appWidth)}px`);
  root.style.setProperty("--stage-width", `${layout.canvasWidth}px`);
  root.style.setProperty("--stage-height", `${layout.canvasHeight}px`);
  root.style.setProperty("--console-sidebar-width", `${layout.sidebarWidth}px`);
  root.style.setProperty("--dock-height", `${layout.dockHeight}px`);
  root.style.setProperty("--console-gap", `${layout.gap ?? 14}px`);
  stage.dataset.compact = layout.compact ? "true" : "false";
}

function renderApp(refreshHud = true) {
  updateLayout();
  const nextUi = buildUiModel(state, { layoutMode: layout.layoutMode });
  const handPresentationChanged = nextUi.handPresentation.layout !== currentUi.handPresentation?.layout
    || nextUi.handPresentation.laneVisible !== currentUi.handPresentation?.laneVisible;

  currentUi = nextUi;

  if (refreshHud || handPresentationChanged) {
    renderStaticHud(currentUi);
  }
  renderDynamicHud();
  renderCanvas();
}

function applyStateTransitionFeedback(previous, next, cause = { type: "system" }) {
  if (cause.type === "start" || cause.type === "restart") {
    visualFx = createVisualFx();
    triggerFx("beamSurge", 0.8);
    triggerFx("statusFlash", 0.8);
    pulseStat("player-energy");
    pulseStat("player-turn");
    pulseStat("enemy-phase");
    pulseStat("enemy-hp");
    return;
  }

  if (cause.type === "choose-reward") {
    triggerFx("beamSurge", 0.9);
    triggerFx("statusFlash", 0.8);
    pulseStat("player-energy");
    pulseStat("player-turn");
    pulseStat("enemy-hp");
  }

  if (cause.type === "choose-node") {
    triggerFx("beamSurge", 0.7);
    triggerFx("statusFlash", 0.7);
  }

  if (cause.type === "play-card" && cause.card) {
    const duration = CARD_LAUNCH_DURATION * motionScale;
    visualFx.cardLaunch = {
      cost: cause.card.cost,
      duration,
      kind: cause.card.kind,
      name: cause.card.name,
      template: cause.card.template,
      time: duration,
    };
    triggerFx("beamSurge", 0.5);
  }

  if (next.mode !== "battle") {
    visualFx.cardLaunch = null;
  }

  if (next.lastAction !== previous.lastAction) {
    triggerFx("statusFlash");
  }

  if (next.enemy.intent.key !== previous.enemy.intent.key) {
    triggerFx("intentSwap");
  }

  if (next.enemy.hp < previous.enemy.hp) {
    triggerFx("enemyHit", 1 + Math.min(0.6, (previous.enemy.hp - next.enemy.hp) / 12));
    pulseStat("enemy-hp");
  }

  if (next.player.hp < previous.player.hp) {
    triggerFx("playerHit", 1 + Math.min(0.6, (previous.player.hp - next.player.hp) / 10));
    pulseStat("player-hp");
  }

  if (next.enemy.phase !== previous.enemy.phase) {
    triggerFx("phaseShift");
    triggerFx("enemyHit", 1.1);
    triggerFx("intentSwap", 1.2);
    triggerFx("beamSurge", 1.1);
    pulseStat("enemy-phase", 1.2);
    pulseStat("enemy-block", 1.1);
    pulseStat("enemy-exposed", 1.1);
  }

  if (next.player.energy !== previous.player.energy) {
    pulseStat("player-energy");
  }

  if (next.player.block !== previous.player.block) {
    pulseStat("player-block");
  }

  if (next.player.status.lag !== previous.player.status.lag) {
    pulseStat("player-lag");
    pulsePile("lag");
  }

  if (next.turn !== previous.turn) {
    pulseStat("player-turn");
  }

  if (next.enemy.block !== previous.enemy.block) {
    pulseStat("enemy-block");
  }

  if (next.enemy.status.exposed !== previous.enemy.status.exposed) {
    pulseStat("enemy-exposed");
  }

  if (next.drawPile.length !== previous.drawPile.length) {
    pulsePile("draw");
  }

  if (next.discardPile.length !== previous.discardPile.length) {
    pulsePile("discard");
  }

  if (next.mode === "result" && previous.mode !== "result") {
    triggerFx("beamSurge", 0.9);
    triggerFx("resultGlow");
    triggerFx("statusFlash", 1.1);
  }
}

function commitState(nextState, cause) {
  const previous = state;
  dragState = createDragState();
  state = nextState;
  applyStateTransitionFeedback(previous, nextState, cause);
  renderApp(true);
}

function advanceVisuals(dt) {
  state = advanceVisualState(state, dt);
  tickVisualFx(dt);
  if (dragState.returnTimer > 0) {
    dragState.returnTimer = Math.max(0, dragState.returnTimer - dt);
    if (dragState.returnTimer === 0) {
      dragState.returningCardId = null;
      dragState.invalid = false;
    }
  }
}

function frame(now) {
  const dt = clamp((now - lastFrameTime) / 1000, 0, 1 / 15);
  lastFrameTime = now;
  advanceVisuals(dt);
  renderDynamicHud();
  renderCanvas();
  rafHandle = window.requestAnimationFrame(frame);
}

function startLoop() {
  if (rafHandle) {
    window.cancelAnimationFrame(rafHandle);
  }
  lastFrameTime = performance.now();
  rafHandle = window.requestAnimationFrame(frame);
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
  renderApp(false);
}

startButton.addEventListener("click", () => {
  commitState(startBattle(), { type: "start" });
});

endTurnButton.addEventListener("click", () => {
  commitState(endTurn(state), { type: "end-turn" });
});

restartButton.addEventListener("click", () => {
  commitState(restartBattle(), { type: "restart" });
});

rewardChoices.addEventListener("click", (event) => {
  const target = event.target.closest("[data-reward-id]");
  if (!target) {
    return;
  }

  const reward = currentUi.rewardOptions.find((entry) => entry.id === target.dataset.rewardId);
  commitState(chooseReward(state, target.dataset.rewardId), { type: "choose-reward", reward });
});

function handleMapSelection(event) {
  const target = event.target.closest("[data-map-node-id]");
  if (!target || target.disabled) {
    return;
  }

  const node = currentUi.map.nodes.find((entry) => entry.id === target.dataset.mapNodeId);
  if (!node) {
    return;
  }

  commitState(chooseMapNode(state, target.dataset.mapNodeId), { type: "choose-node", node });
}

mapBoard.addEventListener("click", handleMapSelection);
minimapBoard.addEventListener("click", handleMapSelection);

handRail.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.pointerType !== "mouse" || currentUi.handPresentation.dragEnabled !== true) {
    return;
  }

  const target = event.target.closest(".command-card");
  if (!target || target.disabled) {
    return;
  }

  const card = state.hand.find((entry) => entry.id === target.dataset.cardId);
  if (!card) {
    return;
  }

  const rect = target.getBoundingClientRect();
  dragState = createDragState();
  dragState.activeCardId = card.id;
  dragState.pointerId = event.pointerId;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.currentX = event.clientX;
  dragState.currentY = event.clientY;
  dragState.offsetX = event.clientX - rect.left;
  dragState.offsetY = event.clientY - rect.top;
  dragState.originHeight = rect.height;
  target.setPointerCapture?.(event.pointerId);
  evaluateActiveDrag(card);
  event.preventDefault();
  renderDynamicHud();
});

window.addEventListener("pointermove", (event) => {
  if (!dragState.activeCardId || dragState.pointerId !== event.pointerId) {
    return;
  }

  dragState.currentX = event.clientX;
  dragState.currentY = event.clientY;
  dragState.moved = dragState.moved
    || Math.hypot(dragState.currentX - dragState.startX, dragState.currentY - dragState.startY) > 6;

  const card = state.hand.find((entry) => entry.id === dragState.activeCardId);
  evaluateActiveDrag(card);
});

function finalizeDrag(event) {
  if (!dragState.activeCardId || dragState.pointerId !== event.pointerId) {
    return;
  }

  const cardId = dragState.activeCardId;
  const card = state.hand.find((entry) => entry.id === cardId);
  const moved = dragState.moved;
  const shouldCommit = Boolean(card && dragState.armed);
  const target = handRail.querySelector(`[data-card-id="${cardId}"]`);
  target?.releasePointerCapture?.(event.pointerId);

  if (shouldCommit && card) {
    suppressClickUntil = performance.now() + 240;
    commitState(playCard(state, cardId), { type: "play-card", card });
    return;
  }

  if (moved) {
    suppressClickUntil = performance.now() + 220;
    scheduleReturn(cardId, true);
  } else {
    resetDragGesture();
  }
}

window.addEventListener("pointerup", finalizeDrag);
window.addEventListener("pointercancel", finalizeDrag);

handRail.addEventListener("click", (event) => {
  if (dragState.activeCardId || performance.now() < suppressClickUntil) {
    return;
  }

  const target = event.target.closest("[data-card-id]");
  if (!target || target.disabled) {
    return;
  }

  const card = state.hand.find((entry) => entry.id === target.dataset.cardId);
  if (!card) {
    return;
  }

  commitState(playCard(state, target.dataset.cardId), { type: "play-card", card });
});

window.addEventListener("resize", () => {
  renderApp(false);
});

window.visualViewport?.addEventListener("resize", () => {
  renderApp(false);
});

document.addEventListener("fullscreenchange", () => {
  renderApp(false);
});

reduceMotionQuery.addEventListener("change", (event) => {
  motionScale = event.matches ? 0.6 : 1;
  visualFx = createVisualFx();
  renderApp(false);
});

document.addEventListener("keydown", async (event) => {
  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    await toggleFullscreen();
  } else if (event.key === "Escape" && document.fullscreenElement) {
    event.preventDefault();
    await document.exitFullscreen();
  }
});

window.render_game_to_text = () => renderGameToText(state);
window.advanceTime = async (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let step = 0; step < steps; step += 1) {
    advanceVisuals(1 / 60);
  }
  renderDynamicHud();
  renderCanvas();
};

renderApp(true);
startLoop();
