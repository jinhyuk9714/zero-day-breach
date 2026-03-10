import { getHandPresentation } from "./drag-hand.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function describeIntent(intent, mode = "battle") {
  if (!intent) {
    if (mode === "map") {
      return {
        title: "Route board",
        detail: "Select an available node to continue the breach.",
        tag: "route",
      };
    }

    return {
      title: "Reward cache",
      detail: "Install one package before continuing the route.",
      tag: "reward",
    };
  }

  if (intent.clearExposed) {
    return {
      title: intent.label,
      detail: `Clear all Exposed. Gain ${intent.block} block.`,
      tag: intent.type,
    };
  }

  if (intent.damage && intent.lag) {
    return {
      title: intent.label,
      detail: `Incoming damage ${intent.damage} and Lag ${intent.lag}`,
      tag: intent.type,
    };
  }

  if (intent.damage) {
    return {
      title: intent.label,
      detail: `Incoming damage ${intent.damage}`,
      tag: intent.type,
    };
  }

  return {
    title: intent.label,
    detail: `Incoming block ${intent.block}`,
    tag: intent.type,
  };
}

function describeCard(card, availableEnergy, options = {}) {
  const playable = options.forcePlayable ?? (card.cost <= availableEnergy);
  const exposedLive = (card.enemyExposed ?? 0) > 0;
  let summary = "";

  if (card.template === "ping") {
    summary = "Deal 6 damage. Exposed adds +2.";
  } else if (card.template === "buffer") {
    summary = "Gain 5 block.";
  } else if (card.template === "worm") {
    summary = "Set Exposed to 2.";
  } else if (card.template === "probe") {
    summary = "Add 1 Exposed. Draw 1 card.";
  } else if (card.template === "burst") {
    summary = "Hit twice for 4 damage. Exposed adds +2 to each hit.";
  } else {
    summary = "Deal 8 + 4 per Exposed. Consume Exposed.";
  }

  return {
    id: card.id,
    name: card.name,
    cost: card.cost,
    kind: card.kind,
    template: card.template,
    summary,
    playable,
    accented: exposedLive && ["ping", "burst", "payload"].includes(card.template),
  };
}

function formatProgressLabel(run) {
  if (run.currentNodeId === "boss-sentinel" || run.encounterKey === "sentinel-firewall") {
    return "BOSS";
  }

  const row = run.encounterIndex > 0
    ? Math.min(run.totalRows, run.encounterIndex)
    : Math.min(run.totalRows, run.currentRow);
  return `ROW ${row}/${run.totalRows}`;
}

function formatNextProgressLabel(run) {
  if (run.currentRow > run.totalRows) {
    return "BOSS";
  }

  return `ROW ${run.currentRow}/${run.totalRows}`;
}

function summarizeNode(node) {
  if (node.id === "boss-sentinel") {
    return {
      ...node,
      title: "Sentinel Firewall",
      label: "Boss",
    };
  }

  if (node.type === "repair") {
    return {
      ...node,
      title: "Repair Node",
      label: "Repair",
    };
  }

  return {
    ...node,
    title: node.encounterKey === "relay-drone" ? "Relay Drone" : "Proxy Warden",
    label: "Combat",
  };
}

function getNodeStatus(state, nodeId) {
  if (state.run.currentNodeId === nodeId) {
    return "current";
  }

  if (state.run.path.includes(nodeId)) {
    return "visited";
  }

  if (state.run.availableNodeIds.includes(nodeId)) {
    return "available";
  }

  return "locked";
}

export function getViewportMetrics(source = globalThis.window) {
  const visual = source?.visualViewport;
  const width = visual?.width ?? source?.innerWidth ?? 1280;
  const height = visual?.height ?? source?.innerHeight ?? 720;
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function computeBattleViewport({ width, height, fullscreen }) {
  const compact = width < 760;
  const layoutMode = !compact && width >= 1050 && height >= 680 ? "console" : "stacked";

  if (layoutMode === "console") {
    const padding = fullscreen ? 12 : 16;
    const gap = 14;
    const headerHeight = height < 760 ? 88 : 96;
    const dockHeight = height < 760 ? 136 : 148;
    const sidebarWidth = width < 1320 ? 304 : 318;
    const availableWidth = Math.max(480, width - padding * 2 - sidebarWidth - gap);
    const availableHeight = Math.max(
      280,
      height - padding * 2 - headerHeight - dockHeight - gap * 2 - (fullscreen ? 8 : 0),
    );
    const maxCanvasWidth = width < 1320 ? 860 : 960;
    const canvasWidth = clamp(Math.min(availableWidth, availableHeight * (16 / 9)), 480, maxCanvasWidth);
    const canvasHeight = Math.round(canvasWidth * (9 / 16));

    return {
      compact,
      layoutMode,
      padding,
      gap,
      headerHeight,
      dockHeight,
      sidebarWidth,
      canvasWidth: Math.round(canvasWidth),
      canvasHeight,
    };
  }

  const padding = compact ? 12 : 24;
  const controlsAllowance = compact ? 320 : 290;
  const availableWidth = Math.max(240, width - padding * 2);
  const availableHeight = Math.max(180, height - controlsAllowance - (fullscreen ? 24 : 0));
  const canvasWidth = clamp(Math.min(availableWidth, availableHeight * (16 / 9)), 240, 1180);
  const canvasHeight = Math.round(canvasWidth * (9 / 16));

  return {
    compact,
    layoutMode,
    padding,
    canvasWidth: Math.round(canvasWidth),
    canvasHeight,
    dockHeight: compact ? 320 : 230,
    sidebarWidth: 0,
  };
}

export function buildUiModel(state, options = {}) {
  const layoutMode = options.layoutMode ?? "stacked";
  const handPresentation = getHandPresentation({
    layoutMode,
    mode: state.mode,
    handCount: state.hand.length,
  });

  const rewardOptions = state.run.rewardOptions.map((card) =>
    describeCard(card, Number.POSITIVE_INFINITY, { forcePlayable: true }),
  );

  const mapNodes = state.run.board.map((node) => ({
    ...summarizeNode(node),
    status: getNodeStatus(state, node.id),
    selectable: state.mode === "map" && state.run.availableNodeIds.includes(node.id),
  }));
  const minimapVisible = layoutMode === "console" && state.mode !== "start";
  const rewardDetail = state.run.currentRow > state.run.totalRows
    ? "Choose one package before the boss."
    : `Choose one package before row ${state.run.currentRow}.`;

  const enemyView = state.mode === "battle"
    ? {
        phase: { label: "Phase", value: `Phase ${state.enemy.phase}` },
        hp: { label: "HP", value: state.enemy.hp },
        block: { label: "Block", value: state.enemy.block },
        exposed: {
          label: "Exposed",
          value: state.enemy.status.exposed,
          highlighted: state.enemy.status.exposed > 0,
        },
        intent: describeIntent(state.enemy.intent),
      }
    : state.mode === "result"
      ? {
          phase: { label: "Phase", value: "Archive" },
          hp: { label: "HP", value: 0 },
          block: { label: "Block", value: 0 },
          exposed: { label: "Exposed", value: 0, highlighted: false },
          intent: {
            title: "Run archive",
            detail: "Result locked. Review the final route and restart to replay.",
            tag: "result",
          },
        }
      : {
        phase: { label: "Phase", value: state.mode === "map" ? "Route" : "Cache" },
        hp: { label: "HP", value: 0 },
        block: { label: "Block", value: 0 },
        exposed: { label: "Exposed", value: 0, highlighted: false },
        intent: describeIntent(null, state.mode),
      };

  return {
    mode: state.mode,
    phase: state.phase,
    title: "Zero-Day Breach",
    eyebrow: "Deterministic breach run prototype",
    status: state.lastAction,
    brief: [
      "Fixed 5-node branching board plus the Sentinel boss.",
      "Combat nodes award one package. Repair nodes heal 8 and clear Lag.",
      "Press F for fullscreen. Press Esc to exit.",
    ],
    run: {
      encounterIndex: state.run.encounterIndex,
      totalEncounters: state.run.totalEncounters,
      encounterKey: state.run.encounterKey,
      encounterName: state.run.encounterName,
      currentRow: state.run.currentRow,
      totalRows: state.run.totalRows,
      currentNodeId: state.run.currentNodeId,
      progressLabel: formatProgressLabel(state.run),
      nextProgressLabel: formatNextProgressLabel(state.run),
    },
    map: {
      visible: state.mode === "map",
      overlayVisible: state.mode === "map",
      minimapVisible,
      currentRow: state.run.currentRow,
      totalRows: state.run.totalRows,
      currentNodeId: state.run.currentNodeId,
      availableNodeIds: [...state.run.availableNodeIds],
      path: [...state.run.path],
      title: state.mode === "map" ? "Route board" : "Route trace",
      detail: state.mode === "map"
        ? "Select an available node to continue."
        : "Compact route trace for the current run.",
      nodes: mapNodes,
    },
    actions: {
      start: { visible: state.mode === "start", label: "Start Breach" },
      endTurn: {
        visible: state.mode === "battle",
        label: "End Turn",
        disabled: state.mode !== "battle" || state.phase !== "player",
      },
      restart: { visible: state.mode === "result", label: "Restart Run" },
    },
    player: {
      hp: { label: "HP", value: state.player.hp },
      block: { label: "Block", value: state.player.block },
      energy: { label: "Energy", value: state.player.energy },
      turn: { label: "Turn", value: state.turn },
      lag: { label: "Lag", value: state.player.status.lag },
    },
    enemy: enemyView,
    piles: {
      draw: state.drawPile.length,
      discard: state.discardPile.length,
    },
    handPresentation,
    hand: state.mode === "reward" || state.mode === "map"
      ? []
      : state.hand.map((card) =>
          describeCard({ ...card, enemyExposed: state.enemy.status.exposed }, state.player.energy),
        ),
    reward: {
      visible: state.mode === "reward",
      title: "Install one package",
      detail: rewardDetail,
    },
    rewardOptions,
    result: {
      visible: state.mode === "result",
      eyebrow: state.result === "victory" ? "BREACH SUCCESSFUL" : "CONNECTION LOST",
      title: state.result === "victory" ? "Run Completed" : "Breach Collapsed",
      detail: state.result
        ? `Final player HP ${state.player.hp} | ${state.run.currentNodeId === "boss-sentinel" ? "Boss" : "Node"} resolved`
        : "",
    },
  };
}
