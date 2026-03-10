function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getHandPresentation({ layoutMode, mode, handCount }) {
  const desktopBattle = layoutMode === "console" && mode === "battle" && handCount > 0;

  return {
    layout: desktopBattle ? "fanned" : "rail",
    dragEnabled: desktopBattle,
    laneVisible: desktopBattle,
  };
}

export function computeFannedHandLayout({ count, railWidth = 900, cardWidth = 176 }) {
  if (count <= 0) {
    return [];
  }

  const midpoint = (count - 1) / 2;
  const spread = clamp((railWidth - cardWidth) / Math.max(count + 1.15, 3), 92, 138);

  return Array.from({ length: count }, (_, index) => {
    const distance = index - midpoint;
    const offset = Math.abs(distance);

    return {
      x: distance * spread,
      y: -Math.max(0, 14 - offset * 6),
      rotation: distance * 4.4,
      zIndex: Math.round((count + 2) - offset),
    };
  });
}

export function evaluateDragCommit({
  layoutMode,
  mode,
  playable,
  originY,
  currentY,
  laneTop,
  cardCenterY,
  threshold = 96,
}) {
  if (layoutMode !== "console" || mode !== "battle") {
    return {
      enabled: false,
      progress: 0,
      armed: false,
      commit: false,
      invalid: false,
    };
  }

  if (!playable) {
    return {
      enabled: false,
      progress: 0,
      armed: false,
      commit: false,
      invalid: true,
    };
  }

  const distance = Math.max(0, originY - currentY);
  const progress = clamp(distance / threshold, 0, 1.25);
  const armed = distance >= threshold || cardCenterY <= laneTop;

  return {
    enabled: true,
    progress,
    armed,
    commit: armed,
    invalid: false,
  };
}
