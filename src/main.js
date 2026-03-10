import "./style.css";

import {
  advanceVisualState,
  createStartState,
  endTurn,
  playCard,
  renderGameToText,
  restartBattle,
  startBattle,
} from "./game.js";

const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
const CARD_WIDTH = 170;
const CARD_HEIGHT = 220;
const CARD_GAP = 22;

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start-btn");
const endTurnButton = document.querySelector("#end-turn-btn");
const restartButton = document.querySelector("#restart-btn");
const statusLine = document.querySelector("#status-line");

let state = createStartState();
let hoverCardId = null;
let rafHandle = 0;
let lastFrameTime = performance.now();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(126, 223, 255, 0.08)";
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

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  gradient.addColorStop(0, "#071725");
  gradient.addColorStop(0.45, "#0a2740");
  gradient.addColorStop(1, "#081019");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const bloom = ctx.createRadialGradient(940, 160, 20, 940, 160, 280);
  bloom.addColorStop(0, "rgba(255, 126, 78, 0.3)");
  bloom.addColorStop(1, "rgba(255, 126, 78, 0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  const coldBloom = ctx.createRadialGradient(200, 620, 20, 200, 620, 260);
  coldBloom.addColorStop(0, "rgba(126, 223, 255, 0.2)");
  coldBloom.addColorStop(1, "rgba(126, 223, 255, 0)");
  ctx.fillStyle = coldBloom;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  drawGrid();
}

function getCardRegions() {
  const totalWidth = state.hand.length * CARD_WIDTH + Math.max(0, state.hand.length - 1) * CARD_GAP;
  const startX = (LOGICAL_WIDTH - totalWidth) / 2;

  return state.hand.map((card, index) => ({
    card,
    x: startX + index * (CARD_WIDTH + CARD_GAP),
    y: 458,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  }));
}

function drawPanel(x, y, width, height, tone) {
  ctx.save();
  roundedRect(x, y, width, height, 26);
  const panelGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  panelGradient.addColorStop(0, tone[0]);
  panelGradient.addColorStop(1, tone[1]);
  ctx.fillStyle = panelGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(126, 223, 255, 0.24)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawStatChip(x, y, label, value, accent) {
  ctx.save();
  roundedRect(x, y, 106, 54, 18);
  ctx.fillStyle = "rgba(5, 13, 23, 0.68)";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#9ecbe0";
  ctx.font = '12px "Avenir Next", "Segoe UI", sans-serif';
  ctx.textTransform = "uppercase";
  ctx.fillText(label, x + 16, y + 18);
  ctx.fillStyle = "#ecfcff";
  ctx.font = '700 24px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(String(value), x + 16, y + 40);
  ctx.restore();
}

function drawEnemyCore() {
  const baseX = 940;
  const baseY = 210;
  const pulse = Math.sin(state.visualTime * 1.9) * 0.5 + 0.5;

  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(state.visualTime * 0.25);

  for (let ring = 0; ring < 3; ring += 1) {
    ctx.beginPath();
    ctx.strokeStyle = ring === 0 ? "rgba(255, 120, 77, 0.85)" : "rgba(126, 223, 255, 0.3)";
    ctx.lineWidth = 4 - ring;
    ctx.arc(0, 0, 58 + ring * 26 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = state.enemy.status.exposed > 0 ? "#ffbe78" : "#ff7e4e";
  ctx.arc(0, 0, 44 + pulse * 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayerCore() {
  const baseX = 210;
  const baseY = 248;
  const pulse = Math.sin(state.visualTime * 2.2) * 8;

  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.strokeStyle = "rgba(126, 223, 255, 0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const radius = 68 + pulse * 0.15;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = "rgba(18, 74, 111, 0.45)";
  ctx.fill();
  ctx.restore();
}

function drawBattleScene() {
  drawPanel(72, 90, 320, 250, ["rgba(8, 25, 43, 0.9)", "rgba(8, 40, 63, 0.62)"]);
  drawPanel(760, 72, 432, 280, ["rgba(34, 14, 19, 0.82)", "rgba(54, 18, 24, 0.54)"]);
  drawPanel(72, 374, 360, 164, ["rgba(10, 32, 45, 0.82)", "rgba(8, 22, 32, 0.58)"]);

  drawPlayerCore();
  drawEnemyCore();

  ctx.fillStyle = "#7edfff";
  ctx.font = '700 18px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText("RUN STATUS", 104, 126);
  ctx.fillText("SENTINEL FIREWALL", 794, 112);
  ctx.fillText("THREAT PROFILE", 104, 410);

  drawStatChip(104, 154, "HP", state.player.hp, "rgba(126, 223, 255, 0.6)");
  drawStatChip(220, 154, "Block", state.player.block, "rgba(159, 255, 213, 0.6)");
  drawStatChip(104, 220, "Energy", state.player.energy, "rgba(255, 190, 120, 0.6)");
  drawStatChip(220, 220, "Turn", state.turn, "rgba(255, 126, 78, 0.6)");

  drawStatChip(794, 146, "HP", state.enemy.hp, "rgba(255, 126, 78, 0.8)");
  drawStatChip(910, 146, "Block", state.enemy.block, "rgba(255, 214, 153, 0.6)");
  drawStatChip(1026, 146, "Exposed", state.enemy.status.exposed, "rgba(255, 190, 120, 0.7)");

  ctx.fillStyle = "#d8faff";
  ctx.font = '700 36px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(state.enemy.intent.label, 796, 246);
  ctx.font = '18px "Avenir Next", "Segoe UI", sans-serif';
  if (state.enemy.intent.damage) {
    ctx.fillText(`Incoming damage ${state.enemy.intent.damage}`, 796, 278);
  } else {
    ctx.fillText(`Incoming block ${state.enemy.intent.block}`, 796, 278);
  }
  if (state.enemy.intent.lag) {
    ctx.fillText(`Applies Lag ${state.enemy.intent.lag}`, 796, 304);
  }

  ctx.fillStyle = "#a6d6ec";
  ctx.font = '18px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(`Draw pile ${state.drawPile.length}`, 104, 456);
  ctx.fillText(`Discard ${state.discardPile.length}`, 104, 486);
  ctx.fillText(`Lag ${state.player.status.lag}`, 104, 516);

  const cardRegions = getCardRegions();
  cardRegions.forEach((region) => drawCard(region));
}

function drawCard(region) {
  const { card, x, y, width, height } = region;
  const isHovered = hoverCardId === card.id;
  const playable = card.cost <= state.player.energy && state.mode === "battle" && state.phase === "player";
  const lift = isHovered && playable ? 18 : 0;

  ctx.save();
  roundedRect(x, y - lift, width, height, 22);
  const gradient = ctx.createLinearGradient(x, y - lift, x + width, y - lift + height);
  if (card.template === "ping") {
    gradient.addColorStop(0, playable ? "#103452" : "#0c2031");
    gradient.addColorStop(1, playable ? "#1f5d89" : "#16374d");
  } else if (card.template === "buffer") {
    gradient.addColorStop(0, playable ? "#11363d" : "#0a2529");
    gradient.addColorStop(1, playable ? "#1c7268" : "#17514a");
  } else {
    gradient.addColorStop(0, playable ? "#3a2716" : "#27180e");
    gradient.addColorStop(1, playable ? "#8b5520" : "#623711");
  }
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = isHovered ? "#ecfcff" : "rgba(236, 252, 255, 0.24)";
  ctx.lineWidth = isHovered ? 3 : 1.2;
  ctx.stroke();

  ctx.fillStyle = "#ebfdff";
  ctx.font = '700 24px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(card.name, x + 22, y + 42 - lift);
  ctx.font = '16px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillStyle = "#c3eef7";
  ctx.fillText(card.kind.toUpperCase(), x + 22, y + 72 - lift);

  ctx.fillStyle = playable ? "#fff0ce" : "rgba(255, 240, 206, 0.45)";
  ctx.font = '700 54px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(String(card.cost), x + 26, y + 146 - lift);

  ctx.font = '17px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillStyle = "#ebfdff";
  if (card.template === "ping") {
    ctx.fillText("Deal 6 damage.", x + 22, y + 182 - lift);
    ctx.fillText("Exposed adds +2.", x + 22, y + 204 - lift);
  } else if (card.template === "buffer") {
    ctx.fillText("Gain 5 block.", x + 22, y + 182 - lift);
    ctx.fillText("Scan hits for 7.", x + 22, y + 204 - lift);
  } else {
    ctx.fillText("Set Exposed to 2.", x + 22, y + 182 - lift);
    ctx.fillText("Amplifies Ping.", x + 22, y + 204 - lift);
  }

  ctx.restore();
}

function drawStartScreen() {
  ctx.fillStyle = "#7edfff";
  ctx.font = '700 28px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText("BREACH BRIEF", 88, 120);
  ctx.fillStyle = "#ebfdff";
  ctx.font = '700 62px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText("Zero-Day Breach", 88, 206);
  ctx.font = '24px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillStyle = "#bddff0";
  ctx.fillText("Single encounter. Deterministic deck. Read intent, spend 3 energy, neutralize the firewall.", 88, 252);

  drawPanel(86, 304, 516, 230, ["rgba(8, 25, 43, 0.88)", "rgba(8, 40, 63, 0.52)"]);
  drawPanel(730, 120, 418, 430, ["rgba(34, 14, 19, 0.7)", "rgba(54, 18, 24, 0.45)"]);

  const lines = [
    "Click cards on the canvas to play them.",
    "Use End Turn to resolve the firewall intent.",
    "Scan deals 7. Harden grants 6 block.",
    "Trace deals 4 and makes next turn 2 energy.",
    "Press F for fullscreen. Esc exits fullscreen.",
  ];

  ctx.fillStyle = "#ecfcff";
  ctx.font = '700 22px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText("OPERATOR NOTES", 116, 350);
  ctx.font = '20px "Avenir Next", "Segoe UI", sans-serif';
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 4 ? "#ffd3b8" : "#c4ebfb";
    ctx.fillText(line, 116, 394 + index * 32);
  });

  drawEnemyCore();
  ctx.fillStyle = "#ffd3b8";
  ctx.font = '700 22px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText("Sentinel Firewall", 820, 430);
  ctx.font = '18px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillStyle = "#f9ece0";
  ctx.fillText("45 HP", 820, 464);
  ctx.fillText("Intent cycle: Scan -> Harden -> Trace", 820, 494);
}

function drawResultScreen() {
  drawBattleScene();
  ctx.save();
  ctx.fillStyle = "rgba(2, 8, 14, 0.68)";
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  drawPanel(316, 180, 648, 280, ["rgba(8, 25, 43, 0.9)", "rgba(11, 31, 52, 0.74)"]);
  ctx.fillStyle = state.result === "victory" ? "#7edfff" : "#ffb189";
  ctx.font = '700 28px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(state.result === "victory" ? "BREACH SUCCESSFUL" : "CONNECTION LOST", 374, 248);
  ctx.fillStyle = "#ebfdff";
  ctx.font = '700 64px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillText(state.result === "victory" ? "Firewall Neutralized" : "Sentinel Overran the Breach", 374, 328);
  ctx.font = '22px "Avenir Next", "Segoe UI", sans-serif';
  ctx.fillStyle = "#bedff0";
  ctx.fillText(`Final player HP ${state.player.hp} | Firewall HP ${state.enemy.hp}`, 374, 382);
  ctx.fillText(state.lastAction, 374, 418);
  ctx.restore();
}

function render() {
  drawBackground();

  if (state.mode === "start") {
    drawStartScreen();
  } else if (state.mode === "battle") {
    drawBattleScene();
  } else {
    drawResultScreen();
  }
}

function setButtonState() {
  startButton.hidden = state.mode !== "start";
  endTurnButton.hidden = state.mode !== "battle";
  restartButton.hidden = state.mode !== "result";
  endTurnButton.disabled = state.mode !== "battle" || state.phase !== "player";
  statusLine.textContent = state.lastAction;
}

function resizeCanvas() {
  const controlsSpace = 180;
  const maxWidth = document.fullscreenElement ? window.innerWidth - 48 : Math.min(window.innerWidth - 48, 1280);
  const maxHeight = document.fullscreenElement
    ? Math.max(320, window.innerHeight - controlsSpace)
    : Math.min(window.innerHeight - 220, 720);
  const scale = clamp(Math.min(maxWidth / LOGICAL_WIDTH, maxHeight / LOGICAL_HEIGHT), 0.45, 1);
  canvas.style.width = `${Math.round(LOGICAL_WIDTH * scale)}px`;
  canvas.style.height = `${Math.round(LOGICAL_HEIGHT * scale)}px`;
}

function renderApp() {
  setButtonState();
  render();
}

function toCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * LOGICAL_WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * LOGICAL_HEIGHT;
  return { x, y };
}

function getHoveredCard(point) {
  return getCardRegions().find((region) => {
    return (
      point.x >= region.x &&
      point.x <= region.x + region.width &&
      point.y >= region.y &&
      point.y <= region.y + region.height
    );
  });
}

function updatePointerHover(event) {
  if (state.mode !== "battle") {
    hoverCardId = null;
    return;
  }

  const hit = getHoveredCard(toCanvasPoint(event));
  hoverCardId = hit?.card.id ?? null;
}

function stepVisuals(dt) {
  state = advanceVisualState(state, dt);
}

function frame(now) {
  const dt = Math.min((now - lastFrameTime) / 1000, 1 / 15);
  lastFrameTime = now;
  stepVisuals(dt);
  render();
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
  resizeCanvas();
  render();
}

startButton.addEventListener("click", () => {
  state = startBattle();
  hoverCardId = null;
  renderApp();
});

endTurnButton.addEventListener("click", () => {
  state = endTurn(state);
  hoverCardId = null;
  renderApp();
});

restartButton.addEventListener("click", () => {
  state = restartBattle();
  hoverCardId = null;
  renderApp();
});

canvas.addEventListener("mousemove", (event) => {
  updatePointerHover(event);
  render();
});

canvas.addEventListener("mouseleave", () => {
  hoverCardId = null;
  render();
});

canvas.addEventListener("click", (event) => {
  if (state.mode !== "battle" || state.phase !== "player") {
    return;
  }

  const hit = getHoveredCard(toCanvasPoint(event));
  if (!hit) {
    return;
  }

  state = playCard(state, hit.card.id);
  hoverCardId = null;
  renderApp();
});

window.addEventListener("resize", () => {
  resizeCanvas();
  render();
});

document.addEventListener("fullscreenchange", () => {
  resizeCanvas();
  render();
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
    stepVisuals(1 / 60);
  }
  render();
};

resizeCanvas();
renderApp();
startLoop();
