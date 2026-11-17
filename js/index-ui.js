const HOME_GATE_NODE_SELECTOR = ".gated-node";
const HOME_NODE_SELECTOR = ".constellation-node";
let homeGateTimers = [];
let homeNodeReleaseBound = false;
let homeTouchPointerId = null;
let homeTouchStartX = 0;
let homeTouchStartY = 0;
let homeTouchMoved = false;
let homeSuppressClickUntil = 0;
let energyCorePointerId = null;
let energyCoreDragMoved = false;
let energyCoreSuppressClickUntil = 0;
let energyCoreReturnTimer = null;
let homeNetworkFrameId = 0;
let shieldPointerId = null;
let shieldPointerMoved = false;
let shieldSuppressClickUntil = 0;
let shieldReturnTimer = null;

const ENERGY_CORE_DRAG_MAX = 34;
const ENERGY_CORE_RECOIL_DISTANCE = 88;
const SHIELD_DRAG_MAX = 24;
const SHIELD_DRAG_TILT_MAX = 12;

function calculateShieldDragPose(deltaX, deltaY) {
  const distance = Math.hypot(deltaX, deltaY);
  const resistedDistance = SHIELD_DRAG_MAX * (1 - Math.exp(-distance / 36));
  const ratio = distance ? resistedDistance / distance : 0;
  const clampTilt = value => Math.max(-SHIELD_DRAG_TILT_MAX, Math.min(SHIELD_DRAG_TILT_MAX, value));
  return {
    x: deltaX * ratio,
    y: deltaY * ratio,
    rotateX: deltaY ? clampTilt(-deltaY * 0.11) : 0,
    rotateY: clampTilt(deltaX * 0.11),
    moved: distance > 7
  };
}

function shouldIgnoreShieldDragClick(event, now = Date.now()) {
  return Boolean(event && event.type === "click" && now < shieldSuppressClickUntil);
}

function createShieldPreviewState(state, damagePercent = 0) {
  const previewState = JSON.parse(JSON.stringify(state));
  if (previewState && previewState.shieldRitual) {
    const damage = Math.max(0, Math.min(100, Number(damagePercent) || 0));
    previewState.shieldRitual.currentHp = previewState.shieldRitual.maxHp * (1 - damage / 100);
    previewState.shieldRitual.lastCompletedDate = null;
  }
  return previewState;
}

function setShieldDragVisual(shield, pose) {
  shield.style.setProperty("--shield-drag-x", pose.x.toFixed(2) + "px");
  shield.style.setProperty("--shield-drag-y", pose.y.toFixed(2) + "px");
  shield.style.setProperty("--shield-drag-rx", pose.rotateX.toFixed(2) + "deg");
  shield.style.setProperty("--shield-drag-ry", pose.rotateY.toFixed(2) + "deg");
}

function returnShieldToRest(shield, animated) {
  if (!shield) return;
  clearTimeout(shieldReturnTimer);
  shield.classList.remove("is-shield-held");
  shield.classList.toggle("is-shield-returning", Boolean(animated));
  setShieldDragVisual(shield, { x: 0, y: 0, rotateX: 0, rotateY: 0 });
  if (animated) shieldReturnTimer = setTimeout(() => shield.classList.remove("is-shield-returning"), 620);
}

function finishShieldDrag(event) {
  if (shieldPointerId === null || (event && event.pointerId !== shieldPointerId)) return;
  const shield = document.getElementById("shield-wrap");
  const pointerId = shieldPointerId;
  const dragged = shieldPointerMoved;
  shieldPointerId = null;
  shieldPointerMoved = false;
  shieldSuppressClickUntil = dragged ? Date.now() + 520 : 0;
  returnShieldToRest(shield, dragged);
  if (shield && shield.hasPointerCapture && shield.hasPointerCapture(pointerId)) shield.releasePointerCapture(pointerId);
}

function bindShieldDragInteraction(shield) {
  if (!shield || shield.dataset.dragBound) return;
  shield.dataset.dragBound = "true";

  shield.addEventListener("pointerdown", event => {
    if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (shield.getAttribute("aria-disabled") === "true") return;
    event.stopPropagation();
    shieldPointerId = event.pointerId;
    shieldPointerMoved = false;
    shield.dataset.dragStartX = String(event.clientX);
    shield.dataset.dragStartY = String(event.clientY);
    clearTimeout(shieldReturnTimer);
    shield.classList.remove("is-shield-returning");
    shield.classList.add("is-shield-held");
    setShieldDragVisual(shield, { x: 0, y: 0, rotateX: 0, rotateY: 0 });
    if (shield.setPointerCapture) shield.setPointerCapture(event.pointerId);
  });

  shield.addEventListener("pointermove", event => {
    if (event.pointerId !== shieldPointerId) return;
    const deltaX = event.clientX - Number(shield.dataset.dragStartX || 0);
    const deltaY = event.clientY - Number(shield.dataset.dragStartY || 0);
    const pose = calculateShieldDragPose(deltaX, deltaY);
    shieldPointerMoved = shieldPointerMoved || pose.moved;
    setShieldDragVisual(shield, pose);
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName => {
    shield.addEventListener(eventName, finishShieldDrag);
  });
  window.addEventListener("blur", () => finishShieldDrag());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finishShieldDrag();
  });
}

function shiftSignalPath(pathData, deltaX, deltaY, coreAtStart) {
  let numberIndex = 0;
  return pathData.replace(/-?\d+(?:\.\d+)?/g, value => {
    const index = numberIndex++;
    const shouldShift = coreAtStart ? index < 4 : index >= 4;
    if (!shouldShift) return value;
    const offset = index % 2 === 0 ? deltaX : deltaY;
    return (Number(value) + offset).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  });
}

function updateHomeNetworkAnchors() {
  const core = document.getElementById("energy-core");
  const svg = document.querySelector(".constellation-network");
  if (!core || !svg) return false;
  const translation = getComputedStyle(core).translate.match(/-?\d+(?:\.\d+)?/g) || ["0", "0"];
  const bounds = svg.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return false;
  const deltaX = Number(translation[0] || 0) * 390 / bounds.width;
  const deltaY = Number(translation[1] || 0) * 560 / bounds.height;
  const active = core.classList.contains("is-core-returning") || core.classList.contains("is-core-recoiling");

  document.querySelectorAll(".network-base path,.network-flow path,.network-impulses path").forEach(path => {
    if (!path.dataset.restingD) path.dataset.restingD = path.getAttribute("d") || "";
    const nextD = shiftSignalPath(path.dataset.restingD, deltaX, deltaY, true);
    if (path.getAttribute("d") !== nextD) path.setAttribute("d", nextD);
  });

  const motion = document.getElementById("home-energy-motion");
  if (motion && motion.dataset.restingPath) {
    const nextPath = shiftSignalPath(motion.dataset.restingPath, deltaX, deltaY, false);
    if (motion.getAttribute("path") !== nextPath) motion.setAttribute("path", nextPath);
  }
  return active;
}

function queueHomeNetworkAnchorUpdate() {
  if (homeNetworkFrameId) return;
  homeNetworkFrameId = requestAnimationFrame(function updateFrame() {
    homeNetworkFrameId = 0;
    if (updateHomeNetworkAnchors()) homeNetworkFrameId = requestAnimationFrame(updateFrame);
  });
}

function setEnergyCoreDragVisual(core, deltaX, deltaY, pull) {
  core.style.setProperty("--core-drag-x", deltaX.toFixed(1) + "px");
  core.style.setProperty("--core-drag-y", deltaY.toFixed(1) + "px");
  core.style.setProperty("--core-brightness", (1 + pull * 0.22).toFixed(2));
  core.style.setProperty("--core-glow", (pull * 12).toFixed(1) + "px");
  core.style.setProperty("--core-halo-opacity", (0.46 + pull * 0.45).toFixed(2));
  core.style.setProperty("--core-halo-scale", (0.86 + pull * 0.34).toFixed(2));
  core.style.setProperty("--core-halo-glow", (24 + pull * 18).toFixed(1) + "px");
  core.style.setProperty("--core-corona-opacity", (0.54 + pull * 0.34).toFixed(2));
  core.style.setProperty("--core-corona-scale", (1 + pull * 0.3).toFixed(2));
  queueHomeNetworkAnchorUpdate();
}

function getHomeGate() {
  return document.getElementById("screen-wrap");
}

function setGateStatus(message) {
  const status = document.getElementById("gate-status");
  if (status) status.textContent = message;
}

function clearHomeGateTimers() {
  homeGateTimers.forEach(timer => clearTimeout(timer));
  homeGateTimers = [];
}

function clearHomeNodeOpeningStates() {
  document.querySelectorAll(HOME_NODE_SELECTOR).forEach(node => {
    node.classList.remove("is-icon-opening");
  });
}

function setHomeNodeIconsComplete(complete) {
  document.querySelectorAll(HOME_NODE_SELECTOR + "[data-icon-animation]").forEach(node => {
    node.classList.toggle("is-icon-complete", complete);
  });
}

function playHomeNodeOpening(node) {
  if (!node || !node.dataset.iconAnimation) return 0;

  const duration = Math.max(0, Number(node.dataset.iconDuration) || 0);
  node.classList.remove("is-icon-opening", "is-icon-complete");
  void node.offsetWidth;
  node.classList.add("is-icon-opening");

  const timer = setTimeout(() => {
    node.classList.remove("is-icon-opening");
    node.classList.add("is-icon-complete");
  }, duration);
  homeGateTimers.push(timer);
  return duration;
}

function setShieldInteractive(interactive) {
  const shield = document.getElementById("shield-wrap");
  if (!shield) return;

  shield.setAttribute("aria-disabled", interactive ? "false" : "true");
  shield.tabIndex = interactive ? 0 : -1;
}

function setEnergyCoreInteractive(interactive) {
  const core = document.getElementById("energy-core");
  if (!core) return;

  core.setAttribute("aria-disabled", interactive ? "false" : "true");
  core.setAttribute("aria-hidden", interactive ? "false" : "true");
  core.tabIndex = interactive ? 0 : -1;
  if (!interactive) core.classList.remove("is-core-reacting");
}

function setNodeInteractive(node, interactive) {
  node.setAttribute("aria-disabled", interactive ? "false" : "true");
  node.tabIndex = interactive ? 0 : -1;
}

function renderQuestAlert(state) {
  const alert = document.getElementById("quest-alert");
  if (!alert) return;

  const activeQuests = state && state.quests && Array.isArray(state.quests.active)
    ? state.quests.active
    : [];
  const hasIncompleteQuest = activeQuests.some(quest => !quest.done);
  alert.classList.toggle("is-visible", hasIncompleteQuest);
}

function updateEnergyCoreProgress(state) {
  const gate = getHomeGate();
  if (!gate || !state) return;

  const completedQuests = Math.max(0, Number(state.quests && state.quests.totalCompletedEver) || 0);
  const unlockedSkills = state.skills && Array.isArray(state.skills.unlocked)
    ? state.skills.unlocked.length
    : 0;
  const questProgress = Math.min(1, Math.log10(completedQuests + 1) / 3);
  const skillProgress = Math.min(1, unlockedSkills / 20);
  const growthProgress = Math.min(1, (questProgress * 0.75) + (skillProgress * 0.25));

  gate.style.setProperty("--core-surface-size", (29 + (growthProgress * 6)).toFixed(2) + "%");
  gate.style.setProperty("--core-corona-size", (40 + (growthProgress * 5)).toFixed(2) + "%");
  gate.style.setProperty("--core-halo-outer-inset", (18 - (growthProgress * 2)).toFixed(2) + "%");
  gate.style.setProperty("--core-halo-inner-inset", (26 - (growthProgress * 1.5)).toFixed(2) + "%");
}

function isHomeNodeTactile(node) {
  if (node.classList.contains("gated-node")) {
    return node.classList.contains("is-node-awake");
  }

  const gate = getHomeGate();
  return node.classList.contains("node-skill") && Boolean(gate) && (
    gate.classList.contains("is-core-awake") ||
    gate.classList.contains("is-settled")
  );
}

function releaseHomeNodes() {
  document.querySelectorAll(HOME_NODE_SELECTOR).forEach(node => {
    node.classList.remove("is-node-pressed");
  });
}

function updateTouchedHomeNode(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const touchedNode = element && element.closest(HOME_NODE_SELECTOR);

  document.querySelectorAll(HOME_NODE_SELECTOR).forEach(node => {
    node.classList.toggle("is-node-pressed", node === touchedNode && isHomeNodeTactile(node));
  });
}

function returnEnergyCoreToCenter(core, animated) {
  if (!core) return;
  clearTimeout(energyCoreReturnTimer);
  core.classList.remove("is-core-held");
  core.classList.toggle("is-core-returning", Boolean(animated));
  setEnergyCoreDragVisual(core, 0, 0, 0);
  if (animated) {
    energyCoreReturnTimer = setTimeout(() => core.classList.remove("is-core-returning"), 620);
  }
}

function finishEnergyCoreDrag(event) {
  if (energyCorePointerId === null || (event && event.pointerId !== energyCorePointerId)) return;
  const core = document.getElementById("energy-core");
  const pointerId = energyCorePointerId;
  const dragged = energyCoreDragMoved;
  energyCorePointerId = null;
  energyCoreDragMoved = false;
  if (dragged) energyCoreSuppressClickUntil = Date.now() + 450;
  returnEnergyCoreToCenter(core, dragged);
  if (core && core.hasPointerCapture && core.hasPointerCapture(pointerId)) {
    core.releasePointerCapture(pointerId);
  }
}

function recoilEnergyCore(core) {
  const pointerId = energyCorePointerId;
  energyCorePointerId = null;
  energyCoreDragMoved = false;
  energyCoreSuppressClickUntil = Date.now() + 700;
  clearTimeout(energyCoreReturnTimer);
  core.classList.remove("is-core-held", "is-core-returning");
  core.classList.add("is-core-recoiling");
  setEnergyCoreDragVisual(core, 0, 0, 0);
  energyCoreReturnTimer = setTimeout(() => core.classList.remove("is-core-recoiling"), 560);
  if (core.hasPointerCapture && core.hasPointerCapture(pointerId)) {
    core.releasePointerCapture(pointerId);
  }
}

function bindEnergyCoreInteraction(core) {
  if (!core || core.dataset.dragBound) return;
  core.dataset.dragBound = "true";

  core.addEventListener("pointerdown", event => {
    if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (core.getAttribute("aria-disabled") === "true") return;
    event.stopPropagation();
    energyCorePointerId = event.pointerId;
    energyCoreDragMoved = false;
    core.dataset.dragStartX = String(event.clientX);
    core.dataset.dragStartY = String(event.clientY);
    clearTimeout(energyCoreReturnTimer);
    core.classList.remove("is-core-returning", "is-core-recoiling");
    core.classList.add("is-core-held");
    setEnergyCoreDragVisual(core, 0, 0, 0);
    if (core.setPointerCapture) core.setPointerCapture(event.pointerId);
  });

  core.addEventListener("pointermove", event => {
    if (event.pointerId !== energyCorePointerId) return;
    const deltaX = event.clientX - Number(core.dataset.dragStartX || 0);
    const deltaY = event.clientY - Number(core.dataset.dragStartY || 0);
    const distance = Math.hypot(deltaX, deltaY);
    if (distance > 4) energyCoreDragMoved = true;
    if (distance >= ENERGY_CORE_RECOIL_DISTANCE) {
      recoilEnergyCore(core);
      return;
    }

    const resistedDistance = ENERGY_CORE_DRAG_MAX * (1 - Math.exp(-distance / 27));
    const ratio = distance ? resistedDistance / distance : 0;
    setEnergyCoreDragVisual(
      core,
      deltaX * ratio,
      deltaY * ratio,
      Math.min(1, distance / ENERGY_CORE_RECOIL_DISTANCE)
    );
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName => {
    core.addEventListener(eventName, finishEnergyCoreDrag);
  });
}

function finishHomeTouchExploration(event) {
  if (homeTouchPointerId === null || (event && event.pointerId !== homeTouchPointerId)) return;
  if (homeTouchMoved) homeSuppressClickUntil = Date.now() + 350;
  homeTouchPointerId = null;
  homeTouchMoved = false;
  releaseHomeNodes();
}

function bindHomeGateInteractions() {
  const gate = getHomeGate();
  const shield = document.getElementById("shield-wrap");
  bindShieldDragInteraction(shield);
  if (shield && !shield.dataset.keyboardBound) {
    shield.dataset.keyboardBound = "true";
    shield.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      hitShield(event);
    });
  }

  document.querySelectorAll(HOME_GATE_NODE_SELECTOR).forEach(node => {
    if (node.dataset.gateBound) return;
    node.dataset.gateBound = "true";
    node.addEventListener("click", event => {
      if (!node.classList.contains("is-node-awake")) event.preventDefault();
    });
  });

  document.querySelectorAll(HOME_NODE_SELECTOR).forEach(node => {
    if (node.dataset.tactileBound) return;
    node.dataset.tactileBound = "true";

    node.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!isHomeNodeTactile(node)) return;
      node.classList.add("is-node-pressed");
    });
    ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach(eventName => {
      node.addEventListener(eventName, () => node.classList.remove("is-node-pressed"));
    });
  });

  if (!homeNodeReleaseBound) {
    homeNodeReleaseBound = true;
    if (gate) {
      gate.addEventListener("pointerdown", event => {
        if ((event.pointerType !== "touch" && event.pointerType !== "pen") || event.isPrimary === false) return;
        homeTouchPointerId = event.pointerId;
        homeTouchStartX = event.clientX;
        homeTouchStartY = event.clientY;
        homeTouchMoved = false;
        updateTouchedHomeNode(event.clientX, event.clientY);
      }, { passive: true });
      gate.addEventListener("click", event => {
        if (Date.now() >= homeSuppressClickUntil) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);
    }
    document.addEventListener("pointermove", event => {
      if (event.pointerId !== homeTouchPointerId) return;
      if (Math.hypot(event.clientX - homeTouchStartX, event.clientY - homeTouchStartY) > 8) homeTouchMoved = true;
      updateTouchedHomeNode(event.clientX, event.clientY);
    }, { passive: true });
    document.addEventListener("pointerup", finishHomeTouchExploration, { passive: true });
    document.addEventListener("pointercancel", finishHomeTouchExploration, { passive: true });
    window.addEventListener("blur", () => {
      finishHomeTouchExploration();
      releaseHomeNodes();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        finishHomeTouchExploration();
        releaseHomeNodes();
      }
    });
  }

  const core = document.getElementById("energy-core");
  bindEnergyCoreInteraction(core);
  if (core && !core.dataset.reactionBound) {
    core.dataset.reactionBound = "true";
    core.addEventListener("click", event => {
      event.stopPropagation();
      if (Date.now() < energyCoreSuppressClickUntil) {
        event.preventDefault();
        return;
      }
      if (core.getAttribute("aria-disabled") === "true") return;
      pulseEnergyCore();
    });
    window.addEventListener("blur", () => finishEnergyCoreDrag());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) finishEnergyCoreDrag();
    });
  }
}

function showUnbrokenGate(state) {
  clearHomeGateTimers();
  clearHomeNodeOpeningStates();
  setHomeNodeIconsComplete(false);
  const gate = getHomeGate();
  if (!gate) return;

  gate.classList.remove("is-breaking", "is-core-awake", "is-core-waking", "is-activating", "is-awake", "is-settled", "wave-fired");
  gate.classList.add("is-locked");
  document.querySelectorAll(HOME_GATE_NODE_SELECTOR).forEach(node => {
    node.classList.remove("is-node-awake");
    setNodeInteractive(node, false);
  });
  releaseHomeNodes();
  setShieldInteractive(true);
  setEnergyCoreInteractive(false);
  renderQuestAlert(state);
  setGateStatus("Daily shield ready");
}

function showAlreadyDoneScreen(state) {
  clearHomeGateTimers();
  clearHomeNodeOpeningStates();
  setHomeNodeIconsComplete(true);
  const gate = getHomeGate();
  if (!gate) return;

  gate.classList.remove("is-locked", "is-breaking", "is-activating", "wave-fired");
  gate.classList.add("is-core-awake", "is-awake", "is-settled");
  document.querySelectorAll(HOME_GATE_NODE_SELECTOR).forEach(node => {
    node.classList.add("is-node-awake");
    setNodeInteractive(node, true);
  });
  setShieldInteractive(false);
  setEnergyCoreInteractive(true);
  wakeEnergyCore();
  schedulePendingHomeFeed();
  renderQuestAlert(state);
  setGateStatus("Navigation active");
}

function schedulePendingHomeFeed(delay) {
  if (!window.HomeFeed) return;
  const pending = HomeFeed.consumePending();
  if (!pending) return;

  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timer = setTimeout(() => {
    let duration = 0;
    if (typeof playHomeFeedEvent === "function") duration = playHomeFeedEvent(pending, reducedMotion);
    else if (pending.source === "quest" && typeof playQuestFeedWaves === "function") duration = playQuestFeedWaves(pending.waves) || 3600;
    else pulseEnergyCore();

    const nextTimer = setTimeout(() => schedulePendingHomeFeed(0), (duration || 900) + 220);
    homeGateTimers.push(nextTimer);
  }, delay == null ? (reducedMotion ? 420 : 980) : delay);
  homeGateTimers.push(timer);
}

function scheduleHomeNodeOpeningPreview() {
  const isLocalPreview = window.location.protocol === "file:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (!isLocalPreview) return;

  const preview = new URLSearchParams(window.location.search).get("preview");
  if (preview !== "node-opening" && preview !== "quest-opening") return;

  const nodes = preview === "quest-opening"
    ? Array.from(document.querySelectorAll(".node-quests[data-icon-animation]"))
    : Array.from(document.querySelectorAll(HOME_NODE_SELECTOR + "[data-icon-animation]"));

  const previewTimer = setTimeout(() => {
    nodes.forEach(node => {
      const delay = preview === "quest-opening" ? 0 : Math.max(0, Number(node.dataset.wakeDelay || node.dataset.iconWakeDelay) || 0);
      const nodeTimer = setTimeout(() => playHomeNodeOpening(node), delay);
      homeGateTimers.push(nodeTimer);
    });
  }, 520);
  homeGateTimers.push(previewTimer);
}

function initializeHomeGate(state) {
  bindHomeGateInteractions();
  updateHpBar(state);
  updateEnergyCoreProgress(state);

  if (Shield.isTodayAlreadyDone(state)) {
    showAlreadyDoneScreen(state);
  } else {
    showUnbrokenGate(state);
  }

  scheduleHomeNodeOpeningPreview();
}

function updateHpBar(state) {
  if (!state) return;
  const gate = getHomeGate();
  const shield = document.getElementById("shield-wrap");
  const hpPercent = Shield.getHpPercent(state);

  if (gate) gate.style.setProperty("--shield-integrity", hpPercent / 100);
  if (gate) gate.style.setProperty("--shield-brightness", 0.72 + (hpPercent / 100) * 0.28);
  if (shield && shield.getAttribute("aria-disabled") !== "true") {
    shield.setAttribute("aria-label", "Daily shield, " + hpPercent + " percent integrity");
  }
}

function showBrokenScreenShell() {
  const gate = getHomeGate();
  if (!gate) return;

  gate.classList.remove("is-locked");
  gate.classList.add("is-breaking");
  setShieldInteractive(false);
  setEnergyCoreInteractive(false);
  setGateStatus("Shield breaking");
}

function showBrokenResultScreen() {
  const gate = getHomeGate();
  if (!gate) return;

  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    showAlreadyDoneScreen(gs);
    return;
  }

  gate.classList.add("is-core-awake", "is-activating");
  setEnergyCoreInteractive(true);
  wakeEnergyCore();
  fireConstellationRipple();

  let lastNodeReveal = 0;
  document.querySelectorAll(HOME_GATE_NODE_SELECTOR).forEach(node => {
    const delay = Number(node.dataset.wakeDelay) || 0;
    // Let navigation become available after the last node appears; each node's
    // icon drawing continues independently without blocking the rest of the app.
    lastNodeReveal = Math.max(lastNodeReveal, delay);
    const timer = setTimeout(() => {
      node.classList.add("is-node-awake");
      setNodeInteractive(node, true);
      playHomeNodeOpening(node);
    }, delay);
    homeGateTimers.push(timer);
  });

  const skillNode = document.querySelector(".node-skill[data-icon-animation]");
  if (skillNode) {
    const skillDelay = Math.max(0, Number(skillNode.dataset.iconWakeDelay) || 0);
    const skillDuration = Math.max(0, Number(skillNode.dataset.iconDuration) || 0);
    const skillTimer = setTimeout(() => playHomeNodeOpening(skillNode), skillDelay);
    homeGateTimers.push(skillTimer);
  }

  const settleTimer = setTimeout(() => {
    gate.classList.remove("is-breaking", "is-activating", "wave-fired");
    gate.classList.add("is-awake", "is-settled");
    setGateStatus("Navigation active");
  }, lastNodeReveal + 120);
  homeGateTimers.push(settleTimer);
}

function enterQuestBoard() {
  window.location.href = "quests.html";
}

if (typeof window !== "undefined") {
  window.showAlreadyDoneScreen = showAlreadyDoneScreen;
  window.enterQuestBoard = enterQuestBoard;
}
