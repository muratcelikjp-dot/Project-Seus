const QuestRadial = (() => {
  const stage = document.getElementById('quest-radial-nodes');
  const toolbar = document.getElementById('filters');
  const toggle = document.getElementById('quest-radial-toggle');
  const all = document.getElementById('quest-radial-all');
  const examples = document.getElementById('quest-radial-examples');
  const map = document.getElementById('quest-map');
  const mapGrid = document.getElementById('quest-map-grid');
  const mapStatus = document.getElementById('quest-map-status');
  const mapBelow = document.getElementById('quest-map-below');
  const detailDialog = document.getElementById('quest-slot-dialog');
  const questList = document.getElementById('qlist');
  const mapPanels = new Map();
  const mapOrder = ['str', 'intel', 'cha', 'wil'];
  const slotCount = 6;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const nodeTracks = { intel: 5959, str: 5965, wil: 5977, cha: 5984 };
  const traitOrder = ['intel', 'str', 'wil', 'cha'];
  // The Pin width track during selection, expressed as a scale around each trait's center.
  const selectionSpring = [
    { offset: 0.000000, scale: '1.000000' },
    { offset: 0.034186, scale: '1.162500' },
    { offset: 0.068372, scale: '1.115263' },
    { offset: 0.103551, scale: '1.061613' },
    { offset: 0.137737, scale: '1.015119' },
    { offset: 0.171856, scale: '0.982812' },
    { offset: 0.207036, scale: '0.966137' },
    { offset: 0.241222, scale: '0.962744' },
    { offset: 0.275407, scale: '0.968381' },
    { offset: 0.310587, scale: '0.978506' },
    { offset: 0.344773, scale: '0.989338' },
    { offset: 0.378892, scale: '0.998350' },
    { offset: 0.414072, scale: '1.004350' },
    { offset: 0.448258, scale: '1.007206' },
    { offset: 0.482443, scale: '1.007494' },
    { offset: 0.517623, scale: '1.006112' },
    { offset: 0.551809, scale: '1.003969' },
    { offset: 0.585928, scale: '1.001800' },
    { offset: 0.621108, scale: '1.000062' },
    { offset: 0.655293, scale: '0.998962' },
    { offset: 0.689479, scale: '0.998488' },
    { offset: 0.724659, scale: '0.998506' },
    { offset: 0.758845, scale: '0.998825' },
    { offset: 0.792964, scale: '0.999275' },
    { offset: 0.828144, scale: '0.999706' },
    { offset: 0.862329, scale: '1.000037' },
    { offset: 0.896515, scale: '1.000238' },
    { offset: 0.931695, scale: '1.000313' },
    { offset: 0.965880, scale: '1.000294' },
    { offset: 1.000000, scale: '1.000225' },
  ];
  const buttons = new Map();
  const presetMenus = new Map();
  const primaryMenu = document.createElement('div');
  primaryMenu.className = 'quest-radial-nodes';
  const center = document.createElement('span');
  center.className = 'quest-preset-center';
  center.setAttribute('aria-hidden', 'true');
  toggle.append(center);
  const effects = document.createElement('div');
  effects.className = 'quest-radial-effects';
  effects.hidden = true;
  let openingFrame;
  let selectionFrame;
  let selectionPulse;
  let questFormTimer;
  let pressedNode;
  let presetDrag;
  const draggedPresets = new WeakSet();
  let scale;

  function layer(id, file, left, top, width, height, tinted = false) {
    const element = document.createElement('div');
    element.dataset.nodeId = '199:' + id;
    Object.assign(element.style, {
      left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px'
    });
    const art = document.createElement('img');
    art.alt = '';
    art.src = 'assets/quest-radial/' + file + '.svg';
    element.append(art);
    if (tinted) {
      element.classList.add('quest-radial-tinted-art');
      element.style.setProperty('--radial-art', 'url("' + art.src + '")');
    }
    return element;
  }

  const guide = document.createElement('div');
  Object.assign(guide.style, {
    position: 'absolute', top: '700px', left: '0', width: '1080px', height: '680px', overflow: 'hidden'
  });
  guide.append(layer(5956, 'guide-ring', 160, 300, 760, 760));
  stage.append(
    layer(5953, 'scrim-glow', -160, 680, 1400, 1400, true),
    guide,
    layer(5957, 'ripple0', 460, 1300, 160, 160, true),
    layer(5958, 'ripple1', 460, 1300, 160, 160, true)
  );

  effects.setAttribute('aria-hidden', 'true');
  effects.append(layer(5954, 'gold-glow', -260, -260, 520, 520, true));
  effects.append(layer(5989, 'select-ring', -72, -72, 144, 144, true));
  for (let index = 0; index < 12; index++) {
    effects.append(layer(5990 + index, 'particle' + index, -12, -12, 24, 24, true));
  }

  // Seek the exported 6.4s Figma animation without replaying the unrelated demo beats.
  function playSegment(animations, start, end, complete, schedule) {
    const started = performance.now();
    animations.forEach(animation => { animation.currentTime = start; });
    function step(now) {
      const time = Math.min(end, start + now - started);
      animations.forEach(animation => { animation.currentTime = time; });
      if (time < end) schedule(requestAnimationFrame(step));
      else complete();
    }
    schedule(requestAnimationFrame(step));
  }

  function resize() {
    scale = Math.min(document.documentElement.clientWidth, 390) / 1080;
    toolbar.style.setProperty('--radial-scale', scale);
    toolbar.style.setProperty('--radial-fab-size', 160 * scale + 'px');
  }

  function figmaTracks(element) {
    return element.getAnimations({ subtree: true }).filter(animation => animation.animationName?.startsWith('kf_'));
  }

  function setPresetMenu(traitId, animate = true) {
    cancelPresetDrag();
    clearTimeout(questFormTimer);
    const previousTrait = toolbar.dataset.presetTrait;
    const active = presetMenus.get(traitId);
    presetMenus.forEach(({ group }, id) => { group.hidden = id !== traitId; });
    primaryMenu.hidden = Boolean(active);
    if (active) {
      toolbar.dataset.presetTrait = traitId;
      toolbar.style.setProperty('--preset-color', active.color);
      center.innerHTML = active.icon + '<span>' + active.label + '</span>';
    } else {
      delete toolbar.dataset.presetTrait;
    }
    toggle.setAttribute('aria-label', active ? active.label + ' · Back to trait filters' : 'Trait filters');
    if (!animate) return;
    cancelAnimationFrame(openingFrame);
    cancelAnimationFrame(selectionFrame);
    selectionPulse?.cancel();
    effects.hidden = true;
    const tracks = figmaTracks(active?.group || primaryMenu);
    const backgroundTracks = figmaTracks(stage);
    backgroundTracks.forEach(animation => { animation.currentTime = 1580; });
    figmaTracks(toggle).forEach(animation => { animation.currentTime = 1580; });
    if (!reducedMotion.matches) playSegment(tracks, 500, 1580, () => {}, frame => { openingFrame = frame; });
    if (active) toggle.focus({ preventScroll: true });
    else buttons.get(previousTrait)?.focus({ preventScroll: true });
  }

  function setOpen(open, restoreFocus = false) {
    if ((toggle.getAttribute('aria-expanded') === 'true') === open) return;
    cancelPresetDrag();
    clearTimeout(questFormTimer);
    cancelAnimationFrame(openingFrame);
    cancelAnimationFrame(selectionFrame);
    selectionPulse?.cancel();
    effects.hidden = true;
    stage.toggleAttribute('inert', !open);
    toggle.setAttribute('aria-expanded', String(open));
    const fabTracks = figmaTracks(toggle);
    if (open) {
      setPresetMenu(null, false);
      stage.hidden = false;
      setTraitExamplesOpen(false);
      resize();
      const animations = figmaTracks(stage).concat(fabTracks);
      if (reducedMotion.matches) animations.forEach(animation => { animation.currentTime = 1580; });
      else playSegment(animations, 433, 1580, () => {}, frame => { openingFrame = frame; });
    } else {
      if (reducedMotion.matches) {
        stage.hidden = true;
        fabTracks.forEach(animation => { animation.currentTime = 0; });
      } else {
        const closingTracks = figmaTracks(stage).concat(fabTracks);
        playSegment(closingTracks, 4033, 5333, () => { stage.hidden = true; }, frame => { openingFrame = frame; });
      }
      if (restoreFocus) toggle.focus();
    }
  }

  function select(button, trait) {
    const rectangle = button.getBoundingClientRect();
    setF(trait);
    setPresetMenu(trait);
    playSelection(button, rectangle, false);
  }

  function playSelection(button, rectangle = button.getBoundingClientRect(), pulse = true) {
    if (reducedMotion.matches) return;
    cancelAnimationFrame(selectionFrame);
    const origin = stage.getBoundingClientRect();
    effects.style.setProperty('--selection-color', getComputedStyle(button).getPropertyValue('--trait-color'));
    effects.style.left = (rectangle.left + rectangle.width / 2 - origin.left) / scale + 'px';
    effects.style.top = (rectangle.top + rectangle.height / 2 - origin.top) / scale + 'px';
    effects.hidden = false;
    const effectTracks = figmaTracks(effects);
    selectionPulse?.cancel();
    if (pulse) selectionPulse = button.querySelector('.quest-radial-face').animate(selectionSpring, (64.578 - 49.484) * 64);
    playSegment(effectTracks, 3167, 4200, () => { effects.hidden = true; }, frame => { selectionFrame = frame; });
  }

  function openQuestFromNode(button, preset) {
    clearTimeout(questFormTimer);
    playSelection(button);
    const openForm = () => {
      setOpen(false);
      openModal(preset);
    };
    if (reducedMotion.matches) openForm();
    else questFormTimer = setTimeout(openForm, 190);
  }

  function mapSlots(tasks, trait) {
    const slots = Array(slotCount).fill(null);
    const unassigned = [];
    tasks.forEach(task => {
      if (task.done || task.attribute !== ATTR_ID_MAP[trait]) return;
      if (Number.isInteger(task.mapSlot) && task.mapSlot >= 0 && task.mapSlot < slotCount && !slots[task.mapSlot]) {
        slots[task.mapSlot] = task;
      } else {
        unassigned.push(task);
      }
    });
    return slots.map(task => task || unassigned.shift() || null);
  }

  function slotAvailable(tasks, trait, index) {
    return Number.isInteger(index) && index >= 0 && index < slotCount && !mapSlots(tasks, trait)[index];
  }

  function createMapPanel(trait, iconMarkup) {
    const panel = document.createElement('section');
    panel.className = 'quest-map-trait';
    panel.dataset.trait = trait.id;
    panel.style.setProperty('--map-trait-color', trait.col);
    panel.setAttribute('aria-label', trait.label + ' quest slots');
    const hex = document.createElement('h2');
    hex.className = 'quest-map-hex';
    hex.innerHTML = '<span>' + iconMarkup(trait) + '<strong>' + trait.label + '</strong></span>';
    panel.append(hex);
    const buttons = Array.from({ length: slotCount }, (_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quest-map-slot';
      button.dataset.slot = index;
      button.addEventListener('click', () => {
        if (!button.dataset.questId) return;
        setOpen(false);
        if (document.body.hasAttribute('data-quest-focus')) {
          detailDialog.dataset.questId = button.dataset.questId;
          detailDialog.append(questList);
          setF(trait.id);
          detailDialog.showModal();
          return;
        }
        setF(trait.id);
        const card = Array.from(document.querySelectorAll('#qlist .qc')).find(item => item.dataset.questId === button.dataset.questId);
        card?.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
      });
      panel.append(button);
      return button;
    });
    mapPanels.set(trait.id, { trait, buttons, panel });
    mapGrid.append(panel);
  }

  function renderMap(tasks) {
    if (detailDialog.open && !tasks.some(task => task.id === detailDialog.dataset.questId && !task.done)) {
      detailDialog.close();
    }
    mapPanels.forEach(({ trait, buttons }, id) => {
      const slots = mapSlots(tasks, id);
      const presets = getTraitQuestExamples(id);
      buttons.forEach((button, index) => {
        const quest = slots[index];
        button.dataset.questId = quest?.id || '';
        button.tabIndex = quest ? 0 : -1;
        button.setAttribute('aria-disabled', String(!quest));
        button.setAttribute('aria-label', quest ? quest.title : trait.label + ' slot ' + (index + 1) + ', empty');
        button.title = quest?.title || '';
        const icon = presets.find(preset => preset.title === quest?.title)?.icon || 'ti-flag';
        button.innerHTML = quest ? '<i class="ti ' + icon + '" aria-hidden="true"></i>' : '';
      });
    });
  }

  detailDialog.addEventListener('close', () => {
    delete detailDialog.dataset.questId;
    mapBelow.insertBefore(questList, document.getElementById('all-done'));
    renderQuests();
  });

  function dropTargetAt(event, traitId) {
    const { clientX: x, clientY: y } = event;
    const hit = document.elementFromPoint(x, y)?.closest('.quest-map-slot');
    if (hit && (hit.closest('.quest-map-trait').dataset.trait !== traitId || hit.dataset.questId)) return null;
    let closest = null;
    for (const slot of mapPanels.get(traitId).buttons) {
      if (slot.dataset.questId) continue;
      const rect = slot.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(x - centerX, y - centerY);
      const reach = slot.offsetWidth * .9 + 4;
      if (distance <= reach && (!closest || distance < closest.distance)) {
        closest = { slot, x: centerX, y: centerY, distance, reach };
      }
    }
    return closest;
  }

  function settleIntoSlot(preview, target, start) {
    if (!start) return;
    const bounds = target.getBoundingClientRect();
    preview.classList.add('quest-drag-settle');
    preview.style.left = start.left + start.width / 2 + 'px';
    preview.style.top = start.top + start.height / 2 + 'px';
    document.body.append(preview);
    const x = bounds.left + bounds.width / 2 - start.left - start.width / 2;
    const y = bounds.top + bounds.height / 2 - start.top - start.height / 2;
    const animation = preview.animate([
      { transform: 'scale(1.1)', opacity: 1 },
      { transform: 'translate(' + x + 'px,' + y + 'px) scale(.35)', opacity: 0 }
    ], { duration: 200, easing: 'cubic-bezier(.3,.08,.28,1)' });
    animation.finished.then(() => preview.remove(), () => preview.remove());
  }

  function cancelPresetDrag() {
    if (!presetDrag) return;
    const { node, id, preview, target } = presetDrag;
    presetDrag = null;
    if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
    preview?.remove();
    node.classList.remove('is-dragged');
    target?.classList.remove('is-drop-target');
    mapPanels.get(map.dataset.dropTrait)?.panel.classList.remove('is-drop-trait');
    delete map.dataset.dropTrait;
  }

  function bindPresetDrag(node, preset, color) {
    node.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      draggedPresets.delete(node);
      presetDrag = { node, preset, color, id: event.pointerId, x: event.clientX, y: event.clientY };
      node.setPointerCapture(event.pointerId);
    });
    node.addEventListener('dragstart', event => event.preventDefault());
    node.addEventListener('click', event => {
      if (event.detail !== 0 && draggedPresets.delete(node)) return;
      openQuestFromNode(node, preset);
    });
  }

  window.addEventListener('pointermove', event => {
    if (presetDrag?.id !== event.pointerId) return;
    if (event.buttons === 0) {
      cancelPresetDrag();
      return;
    }
    const { node, color, x: startX, y: startY } = presetDrag;
    if (!presetDrag.preview) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < 9) return;
      draggedPresets.add(node);
      clearTimeout(questFormTimer);
      const preview = document.createElement('div');
      const bounds = node.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      presetDrag.offsetX = centerX - startX;
      presetDrag.offsetY = centerY - startY;
      preview.className = 'quest-drag-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.style.setProperty('--trait-color', color);
      preview.style.setProperty('--drag-size', bounds.width + 'px');
      preview.style.setProperty('--lift-from-x', startX - event.clientX + 'px');
      preview.style.setProperty('--lift-from-y', startY - event.clientY + 'px');
      preview.append(...Array.from(node.children, child => child.cloneNode(true)));
      document.body.append(preview);
      presetDrag.preview = preview;
      node.classList.add('is-dragged');
      map.dataset.dropTrait = presetDrag.preset.traitId;
      mapPanels.get(map.dataset.dropTrait)?.panel.classList.add('is-drop-trait');
    }
    const nearby = dropTargetAt(event, presetDrag.preset.traitId);
    const target = nearby?.slot;
    let x = event.clientX + presetDrag.offsetX;
    let y = event.clientY + presetDrag.offsetY;
    if (nearby && !reducedMotion.matches) {
      const pull = .55 * (1 - nearby.distance / nearby.reach);
      x += (nearby.x - x) * pull;
      y += (nearby.y - y) * pull;
    }
    presetDrag.preview.style.left = x + 'px';
    presetDrag.preview.style.top = y + 'px';
    if (target !== presetDrag.target) {
      presetDrag.target?.classList.remove('is-drop-target');
      target?.classList.add('is-drop-target');
      presetDrag.target = target;
    }
  });

  window.addEventListener('pointerup', event => {
    if (presetDrag?.id !== event.pointerId) return;
    const { preset, preview } = presetDrag;
    const target = preview && dropTargetAt(event, preset.traitId)?.slot;
    const start = target && !reducedMotion.matches ? preview.getBoundingClientRect() : null;
    cancelPresetDrag();
    if (!target) return;
    const quest = saveQuest({ ...preset, mapSlot: Number(target.dataset.slot) });
    if (!quest) return;
    settleIntoSlot(preview, target, start);
    mapStatus.textContent = quest.title + ' added to the quest map.';
    target.classList.remove('quest-drop-added');
    requestAnimationFrame(() => target.classList.add('quest-drop-added'));
  });

  window.addEventListener('pointercancel', event => {
    if (presetDrag?.id === event.pointerId) cancelPresetDrag();
  });

  function createPresetMenu(trait, iconMarkup) {
    const group = document.createElement('div');
    group.className = 'quest-radial-nodes';
    group.hidden = true;
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', trait.label + ' quest presets');
    const presetTracks = [5959, 5965, 5972, 5977, 5984];
    getTraitQuestExamples(trait.id).forEach((preset, index) => {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'quest-radial-item quest-radial-preset';
      node.dataset.nodeId = '199:' + presetTracks[index];
      node.style.setProperty('--trait-color', trait.col);
      node.setAttribute('aria-label', preset.title);
      const icon = document.createElement('i');
      icon.className = 'ti ' + preset.icon;
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'quest-radial-label';
      label.textContent = preset.label;
      const face = document.createElement('span');
      face.className = 'quest-radial-face';
      face.append(icon);
      node.append(face, label);
      bindPresetDrag(node, preset, trait.col);
      group.append(node);
    });
    presetMenus.set(trait.id, { group, color: trait.col, label: trait.label, icon: iconMarkup(trait) });
    stage.append(group);
  }

  function render(traits, selected, iconMarkup) {
    if (!buttons.size) {
      traitOrder.forEach(id => {
        const trait = traits.find(item => item.id === id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'quest-radial-item';
        button.dataset.nodeId = '199:' + nodeTracks[id];
        button.style.setProperty('--trait-color', trait.col);
        button.innerHTML = '<span class="quest-radial-face">' + iconMarkup(trait) + '</span>';
        const label = document.createElement('span');
        label.className = 'quest-radial-label';
        label.textContent = trait.label;
        button.append(label);
        button.addEventListener('click', () => select(button, id));
        primaryMenu.append(button);
        buttons.set(id, button);
      });
      const custom = document.createElement('button');
      custom.type = 'button';
      custom.className = 'quest-radial-item quest-radial-custom';
      custom.dataset.nodeId = '199:5972';
      custom.innerHTML = '<span class="quest-radial-face"><i class="ti ti-pencil-plus" aria-hidden="true"></i></span><span class="quest-radial-label">Custom Quest</span>';
      custom.addEventListener('click', () => openQuestFromNode(custom));
      primaryMenu.append(custom);
      stage.append(primaryMenu);
      traits.forEach(trait => createPresetMenu(trait, iconMarkup));
      mapOrder.forEach(id => createMapPanel(traits.find(trait => trait.id === id), iconMarkup));
      stage.append(effects);
    }
    all.setAttribute('aria-pressed', String(selected === 'all'));
    buttons.forEach((button, id) => button.setAttribute('aria-pressed', String(selected === id)));
  }

  toggle.addEventListener('click', () => {
    if (toolbar.dataset.presetTrait && toggle.getAttribute('aria-expanded') === 'true') {
      setPresetMenu(null);
    } else {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    }
  });
  all.addEventListener('click', () => setF('all'));
  examples.addEventListener('click', () => {
    setOpen(false);
    setTraitExamplesOpen(examples.getAttribute('aria-expanded') === 'false');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !stage.hidden) {
      event.preventDefault();
      if (presetDrag?.preview) {
        cancelPresetDrag();
        return;
      }
      if (toolbar.dataset.presetTrait && toggle.getAttribute('aria-expanded') === 'true') setPresetMenu(null);
      else setOpen(false, true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!stage.hidden && !toolbar.contains(event.target)) setOpen(false);
  });
  toolbar.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pressedNode?.classList.remove('is-pressed');
    pressedNode = event.target.closest('.quest-radial-item, .quest-radial-toggle');
    pressedNode?.classList.add('is-pressed');
  });
  function releaseNode() {
    pressedNode?.classList.remove('is-pressed');
    pressedNode = null;
  }
  window.addEventListener('pointerup', event => { if (event.isPrimary) releaseNode(); });
  window.addEventListener('pointercancel', event => { if (event.isPrimary) releaseNode(); });
  window.addEventListener('blur', () => {
    cancelPresetDrag();
    releaseNode();
  });
  window.addEventListener('resize', resize);
  const preview = new URLSearchParams(location.search);
  if (preview.get('sections') === 'full') document.body.removeAttribute('data-quest-focus');
  if (preview.get('preview') === '390') {
    document.body.classList.add('quest-radial-preview-390');
    if (preview.has('menu')) {
      document.addEventListener('DOMContentLoaded', () => {
        const traitId = ATTR_ID_REVERSE[preview.get('menu')];
        if (!presetMenus.has(traitId)) return;
        setOpen(true);
        setF(traitId);
        setPresetMenu(traitId);
      }, { once: true });
    }
  }
  resize();
  return { render, renderMap, slotAvailable };
})();
