import test from "node:test";
import assert from "node:assert/strict";

import {
  computeFannedHandLayout,
  evaluateDragCommit,
  getHandPresentation,
} from "../src/drag-hand.js";

test("getHandPresentation enables a fanned desktop hand only during console battles", () => {
  assert.deepEqual(
    getHandPresentation({ layoutMode: "console", mode: "battle", handCount: 5 }),
    {
      layout: "fanned",
      dragEnabled: true,
      laneVisible: true,
    },
  );

  assert.deepEqual(
    getHandPresentation({ layoutMode: "stacked", mode: "battle", handCount: 5 }),
    {
      layout: "rail",
      dragEnabled: false,
      laneVisible: false,
    },
  );

  assert.deepEqual(
    getHandPresentation({ layoutMode: "console", mode: "reward", handCount: 0 }),
    {
      layout: "rail",
      dragEnabled: false,
      laneVisible: false,
    },
  );

  assert.deepEqual(
    getHandPresentation({ layoutMode: "console", mode: "map", handCount: 0 }),
    {
      layout: "rail",
      dragEnabled: false,
      laneVisible: false,
    },
  );
});

test("computeFannedHandLayout lifts the middle card and keeps it above the side cards", () => {
  const layout = computeFannedHandLayout({ count: 5, railWidth: 900, cardWidth: 176 });

  assert.equal(layout.length, 5);
  assert.ok(layout[2].y < layout[1].y);
  assert.ok(layout[2].y < layout[0].y);
  assert.ok(layout[2].zIndex > layout[1].zIndex);
  assert.ok(layout[2].zIndex > layout[0].zIndex);
  assert.ok(layout[1].x - layout[0].x >= 100);
  assert.equal(layout[0].rotation < 0, true);
  assert.equal(layout.at(-1).rotation > 0, true);
});

test("evaluateDragCommit arms and commits once the card crosses the desktop threshold", () => {
  const drag = evaluateDragCommit({
    layoutMode: "console",
    mode: "battle",
    playable: true,
    originY: 760,
    currentY: 620,
    cardCenterY: 610,
    laneTop: 650,
  });

  assert.equal(drag.enabled, true);
  assert.equal(drag.armed, true);
  assert.equal(drag.commit, true);
  assert.ok(drag.progress >= 1);
});

test("evaluateDragCommit never arms an unplayable card", () => {
  const drag = evaluateDragCommit({
    layoutMode: "console",
    mode: "battle",
    playable: false,
    originY: 760,
    currentY: 560,
    cardCenterY: 550,
    laneTop: 650,
  });

  assert.equal(drag.enabled, false);
  assert.equal(drag.armed, false);
  assert.equal(drag.commit, false);
  assert.equal(drag.invalid, true);
});
