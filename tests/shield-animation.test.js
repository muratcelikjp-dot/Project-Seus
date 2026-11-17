const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function loadBrowserScript(relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  const context = vm.createContext({ Math });
  vm.runInContext(source, context, { filename: relativePath });
  return context;
}

test("shield drag pose follows a held pointer with capped travel and gentle tilt", () => {
  const context = loadBrowserScript("js/index-ui.js");
  const resting = context.calculateShieldDragPose(0, 0);
  const pulled = context.calculateShieldDragPose(120, -60);

  assert.deepEqual({ x: resting.x, y: resting.y, rotateX: resting.rotateX, rotateY: resting.rotateY, moved: resting.moved }, {
    x: 0, y: 0, rotateX: 0, rotateY: 0, moved: false
  });
  assert.ok(Math.hypot(pulled.x, pulled.y) <= 24);
  assert.ok(Math.abs(pulled.rotateX) <= 12);
  assert.ok(Math.abs(pulled.rotateY) <= 12);
  assert.equal(pulled.moved, true);
});

test("a drag-generated click is ignored without blocking keyboard shield hits", () => {
  const context = loadBrowserScript("js/index-ui.js");
  vm.runInContext("shieldSuppressClickUntil = 500", context);

  assert.equal(context.shouldIgnoreShieldDragClick({ type: "click" }, 499), true);
  assert.equal(context.shouldIgnoreShieldDragClick({ type: "click" }, 500), false);
  assert.equal(context.shouldIgnoreShieldDragClick({ type: "keydown" }, 499), false);
});

test("shield preview starts a fresh in-memory ritual without changing the saved state", () => {
  const context = loadBrowserScript("js/index-ui.js");
  const savedState = { shieldRitual: { currentHp: 0, maxHp: 100, lastCompletedDate: "2026-11-10" } };
  const previewState = context.createShieldPreviewState(savedState);
  const damagedPreview = context.createShieldPreviewState(savedState, 60);

  assert.deepEqual(JSON.parse(JSON.stringify(previewState.shieldRitual)), { currentHp: 100, maxHp: 100, lastCompletedDate: null });
  assert.equal(damagedPreview.shieldRitual.currentHp, 40);
  assert.deepEqual(savedState.shieldRitual, { currentHp: 0, maxHp: 100, lastCompletedDate: "2026-11-10" });
  assert.notEqual(previewState, savedState);
});

test("shield break shard targets remain inside the viewport at subdued opacity", () => {
  const context = loadBrowserScript("js/index-effects.js");
  const plan = context.createShieldShardPlan(390, 844, 195, 422, 28, () => 0.5);

  assert.equal(plan.length, 28);
  plan.forEach(shard => {
    assert.ok(shard.targetX >= 0 && shard.targetX <= 390);
    assert.ok(shard.targetY >= 0 && shard.targetY <= 844);
    assert.ok(shard.opacity > 0 && shard.opacity <= 0.52);
    assert.ok(shard.size >= 4 && shard.size <= 10);
  });
});

test("shield fracture segments widen and reveal toward the center", () => {
  const context = loadBrowserScript("js/index-effects.js");
  const plan = context.buildFractureSegmentPlan([
    { x: 20, y: 40 },
    { x: 45, y: 48 },
    { x: 72, y: 62 },
    { x: 100, y: 104 }
  ], 80);

  assert.equal(plan.length, 3);
  assert.deepEqual(plan.map(segment => segment.delay), [0, 18, 36]);
  assert.ok(plan[0].width < plan[1].width);
  assert.ok(plan[1].width < plan[2].width);
  assert.ok(plan.every(segment => segment.width >= 1 && segment.width <= 4));
  assert.ok(plan.at(-1).width >= 2.5);
  assert.match(plan.at(-1).d, /L 100\.0 104\.0$/);
});

test("glass fracture paths stay angular without long wavy detours", () => {
  const context = loadBrowserScript("js/index-effects.js");
  const fracture = context.createFracturePath(0, 0, 0, 100, 5);

  assert.equal(fracture.points.length, 6);
  assert.equal(fracture.points.at(-1).x, 100);
  assert.equal(fracture.points.at(-1).y, 0);
  fracture.points.slice(1, -1).forEach(point => {
    assert.ok(Math.abs(point.y) <= 4.5);
  });
});

test("center hits create a radial glass fracture network with sharp spokes", () => {
  const context = loadBrowserScript("js/index-effects.js");
  const center = { x: 100, y: 104 };
  const network = context.createRadialFractureNetwork(center, 76, 7, 12);

  assert.equal(network.length, 7);
  network.forEach(fracture => {
    assert.equal(fracture.points.length, 6);
    assert.equal(fracture.points[0].x, center.x);
    assert.equal(fracture.points[0].y, center.y);
    const endpoint = fracture.points.at(-1);
    assert.ok(Math.abs(Math.hypot(endpoint.x - center.x, endpoint.y - center.y) - 76) < 0.01);
  });
});
