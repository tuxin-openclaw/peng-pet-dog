(() => {
  'use strict';

  // =========================================================================
  // Canvas & DOM Setup
  // =========================================================================
  const canvas = document.getElementById('petCanvas');
  const ctx = canvas.getContext('2d');
  const statusHintEl = document.getElementById('statusHint');
  const actionCountEl = document.getElementById('actionCount');
  const soundToggleBtn = document.getElementById('soundToggle');
  const soundIconEl = document.getElementById('soundIcon');
  const soundLabelEl = document.getElementById('soundLabel');
  const themeToggleBtn = document.getElementById('themeToggle');
  const themeIconEl = document.getElementById('themeIcon');
  const themeLabelEl = document.getElementById('themeLabel');
  const charTabs = Array.from(document.querySelectorAll('.char-tab'));

  const STAGE_W = 880;
  const STAGE_H = 560;
  const DOG_BASE_X = 466;

  // 'daisy' (蓝巾笑柴 - uploaded storybook character) | 'shiba' (红巾小柴)
  let currentChar = 'daisy';
  let isDarkTheme = false;

  const viewport = {
    cssW: window.innerWidth,
    cssH: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2.5),
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  function resizeCanvas() {
    viewport.cssW = window.innerWidth;
    viewport.cssH = window.innerHeight;
    viewport.dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    canvas.width = Math.round(viewport.cssW * viewport.dpr);
    canvas.height = Math.round(viewport.cssH * viewport.dpr);

    const padX = 20;
    const padTop = 52;
    const padBottom = 40;
    const availW = Math.max(320, viewport.cssW - padX * 2);
    const availH = Math.max(240, viewport.cssH - padTop - padBottom);

    viewport.scale = Math.min(availW / STAGE_W, availH / STAGE_H);
    viewport.offsetX = (viewport.cssW - STAGE_W * viewport.scale) * 0.5;
    viewport.offsetY = padTop + (availH - STAGE_H * viewport.scale) * 0.5;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // =========================================================================
  // Subtle Colored-Pencil Texture Tile (Generated Once for 'daisy' Character)
  // =========================================================================
  let crayonLightPattern = null;
  let crayonDarkPattern = null;

  function initCrayonPatterns() {
    if (typeof document.createElement !== 'function' || typeof ctx.createPattern !== 'function') {
      return;
    }
    const makeTile = (strokeColor, strokeColor2) => {
      const tile = document.createElement('canvas');
      tile.width = 128;
      tile.height = 128;
      const tctx = tile.getContext && tile.getContext('2d');
      if (!tctx) return null;

      tctx.lineCap = 'round';
      for (let i = 0; i < 64; i++) {
        const x = (i * 37 + (i % 5) * 11) % 128;
        const y = (i * 53 + (i % 7) * 9) % 128;
        const len = 18 + (i % 4) * 7;
        tctx.strokeStyle = i % 2 === 0 ? strokeColor : strokeColor2;
        tctx.lineWidth = 1.4 + (i % 3) * 0.5;
        tctx.beginPath();
        tctx.moveTo(x - len * 0.5, y + len * 0.32);
        tctx.lineTo(x + len * 0.5, y - len * 0.32);
        tctx.stroke();
      }
      return ctx.createPattern(tile, 'repeat');
    };

    crayonLightPattern = makeTile('rgba(130, 184, 240, 0.16)', 'rgba(255, 255, 255, 0.24)');
    crayonDarkPattern = makeTile('rgba(128, 174, 232, 0.06)', 'rgba(255, 255, 255, 0.03)');
  }

  initCrayonPatterns();

  // =========================================================================
  // Character Switcher, Theme & Web Audio Controls
  // =========================================================================
  function syncThemeUI() {
    document.body.classList.toggle('theme-dark', isDarkTheme);
    document.body.classList.toggle('theme-light', !isDarkTheme);
    document.body.classList.toggle('char-daisy', currentChar === 'daisy');
    document.body.classList.toggle('char-shiba', currentChar === 'shiba');
    themeToggleBtn.setAttribute('aria-pressed', String(isDarkTheme));
    themeIconEl.textContent = isDarkTheme ? '🌙' : '☀️';
    themeLabelEl.textContent = isDarkTheme ? '深色' : '浅色';
  }

  function setCharacter(charId) {
    if (charId !== 'shiba' && charId !== 'daisy') return;
    currentChar = charId;

    // Give each character its signature cozy default mood on switch (user can still override anytime)
    isDarkTheme = charId === 'shiba';

    for (const btn of charTabs) {
      const active = btn.dataset.char === charId;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }

    syncThemeUI();
    state.headBounce = 1;
    state.leftEarKick = 0.85;
    state.rightEarKick = 0.85;
    statusHintEl.textContent =
      charId === 'daisy' ? '已切换：蓝巾笑柴 🌼' : '已切换：红巾小柴 🐕';
  }

  for (const btn of charTabs) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setCharacter(btn.dataset.char);
      btn.blur();
    });
  }

  themeToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isDarkTheme = !isDarkTheme;
    syncThemeUI();
    themeToggleBtn.blur();
  });

  syncThemeUI();

  let soundEnabled = false;
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function playKeySound(isBigKey = false) {
    if (!soundEnabled) return;
    ensureAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'triangle';
    const baseFreq = isBigKey ? 160 : 230 + Math.random() * 55;
    osc.frequency.setValueAtTime(baseFreq * 1.45, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.52, now + 0.045);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBigKey ? 920 : 1500, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(isBigKey ? 0.15 : 0.11, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  function playMouseClickSound(isRight = false) {
    if (!soundEnabled) return;
    ensureAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    const freq = isRight ? 620 : 760;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.42, now + 0.032);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.042);
  }

  soundToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    soundEnabled = !soundEnabled;
    soundToggleBtn.setAttribute('aria-pressed', String(soundEnabled));
    soundIconEl.textContent = soundEnabled ? '🔊' : '🔇';
    soundLabelEl.textContent = soundEnabled ? '音效开' : '音效关';
    if (soundEnabled) {
      ensureAudio();
      playKeySound(false);
    }
    soundToggleBtn.blur();
  });

  // =========================================================================
  // Compact 65% Mechanical Keyboard (Snug Right Under Puppy)
  // =========================================================================
  const KB = {
    cx: 540,
    cy: 454,
    w: 406,
    h: 142,
    angle: 0.032,
    padX: 11,
    padY: 11,
    gap: 3.5,
  };

  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

  const KEY_ROWS_SPEC = [
    [
      { code: 'Escape', label: 'Esc', popup: 'Esc', w: 1, accent: true, hand: 'left' },
      { code: 'Digit1', label: '1', shift: '!', popup: '1', w: 1, hand: 'left' },
      { code: 'Digit2', label: '2', shift: '@', popup: '2', w: 1, hand: 'left' },
      { code: 'Digit3', label: '3', shift: '#', popup: '3', w: 1, hand: 'left' },
      { code: 'Digit4', label: '4', shift: '$', popup: '4', w: 1, hand: 'left' },
      { code: 'Digit5', label: '5', shift: '%', popup: '5', w: 1, hand: 'left' },
      { code: 'Digit6', label: '6', shift: '^', popup: '6', w: 1, hand: 'right' },
      { code: 'Digit7', label: '7', shift: '&', popup: '7', w: 1, hand: 'right' },
      { code: 'Digit8', label: '8', shift: '*', popup: '8', w: 1, hand: 'right' },
      { code: 'Digit9', label: '9', shift: '(', popup: '9', w: 1, hand: 'right' },
      { code: 'Digit0', label: '0', shift: ')', popup: '0', w: 1, hand: 'right' },
      { code: 'Minus', label: '-', shift: '_', popup: '-', w: 1, hand: 'right' },
      { code: 'Equal', label: '=', shift: '+', popup: '=', w: 1, hand: 'right' },
      { code: 'Backspace', label: '⌫', popup: '⌫', w: 2, hand: 'right' },
    ],
    [
      { code: 'Tab', label: 'Tab', popup: 'Tab', w: 1.5, hand: 'left' },
      { code: 'KeyQ', label: 'Q', popup: 'Q', w: 1, hand: 'left' },
      { code: 'KeyW', label: 'W', popup: 'W', w: 1, hand: 'left' },
      { code: 'KeyE', label: 'E', popup: 'E', w: 1, hand: 'left' },
      { code: 'KeyR', label: 'R', popup: 'R', w: 1, hand: 'left' },
      { code: 'KeyT', label: 'T', popup: 'T', w: 1, hand: 'left' },
      { code: 'KeyY', label: 'Y', popup: 'Y', w: 1, hand: 'right' },
      { code: 'KeyU', label: 'U', popup: 'U', w: 1, hand: 'right' },
      { code: 'KeyI', label: 'I', popup: 'I', w: 1, hand: 'right' },
      { code: 'KeyO', label: 'O', popup: 'O', w: 1, hand: 'right' },
      { code: 'KeyP', label: 'P', popup: 'P', w: 1, hand: 'right' },
      { code: 'BracketLeft', label: '[', shift: '{', popup: '[', w: 1, hand: 'right' },
      { code: 'BracketRight', label: ']', shift: '}', popup: ']', w: 1, hand: 'right' },
      { code: 'Backslash', label: '\\', shift: '|', popup: '\\', w: 1.5, hand: 'right' },
    ],
    [
      { code: 'CapsLock', label: 'Caps', popup: 'Caps', w: 1.75, hand: 'left' },
      { code: 'KeyA', label: 'A', popup: 'A', w: 1, hand: 'left' },
      { code: 'KeyS', label: 'S', popup: 'S', w: 1, hand: 'left' },
      { code: 'KeyD', label: 'D', popup: 'D', w: 1, hand: 'left' },
      { code: 'KeyF', label: 'F', popup: 'F', w: 1, hand: 'left' },
      { code: 'KeyG', label: 'G', popup: 'G', w: 1, hand: 'left' },
      { code: 'KeyH', label: 'H', popup: 'H', w: 1, hand: 'right' },
      { code: 'KeyJ', label: 'J', popup: 'J', w: 1, hand: 'right' },
      { code: 'KeyK', label: 'K', popup: 'K', w: 1, hand: 'right' },
      { code: 'KeyL', label: 'L', popup: 'L', w: 1, hand: 'right' },
      { code: 'Semicolon', label: ';', shift: ':', popup: ';', w: 1, hand: 'right' },
      { code: 'Quote', label: "'", shift: '"', popup: "'", w: 1, hand: 'right' },
      { code: 'Enter', label: '⏎', popup: 'Enter', w: 2.25, accent: true, hand: 'right' },
    ],
    [
      { code: 'ShiftLeft', label: '⇧', popup: 'Shift', w: 2.25, accent: true, hand: 'left' },
      { code: 'KeyZ', label: 'Z', popup: 'Z', w: 1, hand: 'left' },
      { code: 'KeyX', label: 'X', popup: 'X', w: 1, hand: 'left' },
      { code: 'KeyC', label: 'C', popup: 'C', w: 1, hand: 'left' },
      { code: 'KeyV', label: 'V', popup: 'V', w: 1, hand: 'left' },
      { code: 'KeyB', label: 'B', popup: 'B', w: 1, hand: 'left' },
      { code: 'KeyN', label: 'N', popup: 'N', w: 1, hand: 'right' },
      { code: 'KeyM', label: 'M', popup: 'M', w: 1, hand: 'right' },
      { code: 'Comma', label: ',', shift: '<', popup: ',', w: 1, hand: 'right' },
      { code: 'Period', label: '.', shift: '>', popup: '.', w: 1, hand: 'right' },
      { code: 'Slash', label: '/', shift: '?', popup: '/', w: 1, hand: 'right' },
      { code: 'ShiftRight', label: '⇧', popup: 'Shift', w: 1.75, hand: 'right' },
      { code: 'ArrowUp', label: '↑', popup: '↑', w: 1, hand: 'right' },
    ],
    [
      { code: 'ControlLeft', label: 'Ctrl', popup: 'Ctrl', w: 1.25, hand: 'left' },
      { code: 'MetaLeft', label: isMac ? '⌘' : 'Win', popup: isMac ? '⌘' : 'Win', w: 1.25, hand: 'left' },
      { code: 'AltLeft', label: isMac ? '⌥' : 'Alt', popup: isMac ? 'Opt' : 'Alt', w: 1.25, hand: 'left' },
      { code: 'Space', label: '', popup: 'Space', w: 5.25, hand: 'right' },
      { code: 'AltRight', label: isMac ? '⌥' : 'Alt', popup: isMac ? 'Opt' : 'Alt', w: 1, hand: 'right' },
      { code: 'MetaRight', label: isMac ? '⌘' : 'Win', popup: isMac ? '⌘' : 'Win', w: 1, hand: 'right' },
      { code: 'ControlRight', label: 'Ctrl', popup: 'Ctrl', w: 1, hand: 'right' },
      { code: 'ArrowLeft', label: '←', popup: '←', w: 1, hand: 'right' },
      { code: 'ArrowDown', label: '↓', popup: '↓', w: 1, hand: 'right' },
      { code: 'ArrowRight', label: '→', popup: '→', w: 1, hand: 'right' },
    ],
  ];

  const CODE_ALIAS = {
    Backquote: { target: 'Escape', popup: '`', shift: '~' },
    Delete: { target: 'Backspace', popup: 'Del' },
    Insert: { target: 'Backspace', popup: 'Ins' },
    F1: { target: 'Digit1', popup: 'F1' },
    F2: { target: 'Digit2', popup: 'F2' },
    F3: { target: 'Digit3', popup: 'F3' },
    F4: { target: 'Digit4', popup: 'F4' },
    F5: { target: 'Digit5', popup: 'F5' },
    F6: { target: 'Digit6', popup: 'F6' },
    F7: { target: 'Digit7', popup: 'F7' },
    F8: { target: 'Digit8', popup: 'F8' },
    F9: { target: 'Digit9', popup: 'F9' },
    F10: { target: 'Digit0', popup: 'F10' },
    F11: { target: 'Minus', popup: 'F11' },
    F12: { target: 'Equal', popup: 'F12' },
    Numpad0: { target: 'Digit0', popup: '0' },
    Numpad1: { target: 'Digit1', popup: '1' },
    Numpad2: { target: 'Digit2', popup: '2' },
    Numpad3: { target: 'Digit3', popup: '3' },
    Numpad4: { target: 'Digit4', popup: '4' },
    Numpad5: { target: 'Digit5', popup: '5' },
    Numpad6: { target: 'Digit6', popup: '6' },
    Numpad7: { target: 'Digit7', popup: '7' },
    Numpad8: { target: 'Digit8', popup: '8' },
    Numpad9: { target: 'Digit9', popup: '9' },
    NumpadEnter: { target: 'Enter', popup: 'Enter' },
    NumpadAdd: { target: 'Equal', popup: '+' },
    NumpadSubtract: { target: 'Minus', popup: '-' },
    NumpadMultiply: { target: 'Digit8', popup: '*' },
    NumpadDivide: { target: 'Slash', popup: '/' },
    NumpadDecimal: { target: 'Period', popup: '.' },
    Home: { target: 'ArrowLeft', popup: 'Home' },
    End: { target: 'ArrowRight', popup: 'End' },
    PageUp: { target: 'ArrowUp', popup: 'PgUp' },
    PageDown: { target: 'ArrowDown', popup: 'PgDn' },
    ContextMenu: { target: 'ControlRight', popup: 'Menu' },
    IntlBackslash: { target: 'Backslash', popup: '\\' },
    OSLeft: { target: 'MetaLeft', popup: isMac ? '⌘' : 'Win' },
    OSRight: { target: 'MetaRight', popup: isMac ? '⌘' : 'Win' },
  };

  const keysList = [];
  const keyByCode = new Map();

  function kbLocalToWorld(lx, ly) {
    const cos = Math.cos(KB.angle);
    const sin = Math.sin(KB.angle);
    return {
      wx: KB.cx + lx * cos - ly * sin,
      wy: KB.cy + lx * sin + ly * cos,
    };
  }

  function buildKeyboardGeometry() {
    const innerW = KB.w - KB.padX * 2;
    const innerH = KB.h - KB.padY * 2;
    const numRows = KEY_ROWS_SPEC.length;
    const rowH = (innerH - KB.gap * (numRows - 1)) / numRows;

    let curY = -KB.h * 0.5 + KB.padY;

    for (const row of KEY_ROWS_SPEC) {
      const totalUnits = row.reduce((sum, k) => sum + k.w, 0);
      const unitW = (innerW - KB.gap * (row.length - 1)) / totalUnits;
      let curX = -KB.w * 0.5 + KB.padX;

      for (const spec of row) {
        const kw = spec.w * unitW;
        const lcx = curX + kw * 0.5;
        const lcy = curY + rowH * 0.5;
        const { wx, wy } = kbLocalToWorld(lcx, lcy);

        const keyObj = {
          ...spec,
          lx: curX,
          ly: curY,
          w: kw,
          h: rowH,
          lcx,
          lcy,
          wx,
          wy,
          isDown: false,
          press: 0,
          glow: 0,
        };
        keysList.push(keyObj);
        keyByCode.set(keyObj.code, keyObj);
        curX += kw + KB.gap;
      }
      curY += rowH + KB.gap;
    }
  }

  buildKeyboardGeometry();

  // =========================================================================
  // Mouse Geometry (Snug Right Beside Left Hip & Keyboard!)
  // =========================================================================
  const MOUSE_BOUNDS = {
    minX: 254,
    maxX: 316,
    minY: 404,
    maxY: 462,
  };

  const MOUSE_SIZE = {
    w: 72,
    h: 98,
  };

  const INIT_MOUSE_X = 286;
  const INIT_MOUSE_Y = 432;

  // =========================================================================
  // Interactive State
  // =========================================================================
  const state = {
    time: 0,
    actionCount: 0,
    capsLock: false,
    shiftDown: false,
    metaDown: false,
    activeCodes: new Set(),
    metaPressedCodes: new Set(),

    // Mouse
    mouseNormX: 0.5,
    mouseNormY: 0.5,
    mouseX: INIT_MOUSE_X,
    mouseY: INIT_MOUSE_Y,
    mouseTargetX: INIT_MOUSE_X,
    mouseTargetY: INIT_MOUSE_Y,
    mouseVx: 0,
    mouseTilt: 0.04,
    mouseActivityGlow: 0,
    leftDown: false,
    rightDown: false,
    middleDown: false,
    leftGlow: 0,
    rightGlow: 0,
    middleGlow: 0,
    wheelOffset: 0,
    wheelVel: 0,

    // Dog personality & physics
    dogLeanX: 0,
    dogTargetLeanX: 0,
    lookX: 0,
    lookY: 0,
    targetLookX: 0,
    targetLookY: 0,
    blinkTimer: 2.5,
    blinkProgress: 0,
    tailPhase: 0,
    excitement: 0,
    happyEyesTimer: 0,
    leftEarKick: 0,
    rightEarKick: 0,
    headBounce: 0,

    leftPaw: {
      x: INIT_MOUSE_X + 4,
      y: INIT_MOUSE_Y - 24,
      targetX: INIT_MOUSE_X + 4,
      targetY: INIT_MOUSE_Y - 24,
      mode: 'mouse',
      activeKeyCode: null,
      returnToMouseAt: 0,
      clickShiftX: 0,
      clickShiftY: 0,
      lift: 0,
      press: 0,
    },

    rightPaw: {
      x: 552,
      y: 388,
      targetX: 552,
      targetY: 388,
      restX: 552,
      restY: 388,
      prevX: 552,
      prevY: 388,
      ghostAlpha: 0,
      lift: 0,
      press: 0,
      activeKeyCode: null,
      holdUntil: 0,
    },

    popups: [],
    ripples: [],
    particles: [],
    mouseBadges: [],
  };

  // =========================================================================
  // Helpers
  // =========================================================================
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const x = clamp(t, 0, 1);
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function roundRectPath(c, x, y, w, h, r) {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    c.beginPath();
    c.moveTo(x + radius, y);
    c.arcTo(x + w, y, x + w, y + h, radius);
    c.arcTo(x + w, y + h, x, y + h, radius);
    c.arcTo(x, y + h, x, y, radius);
    c.arcTo(x, y, x + w, y, radius);
    c.closePath();
  }

  function incrementAction(hintText) {
    state.actionCount += 1;
    actionCountEl.textContent = String(state.actionCount);
    if (hintText) statusHintEl.textContent = hintText;
  }

  function spawnRipple(x, y, color, maxRadius = 34) {
    state.ripples.push({ x, y, color, maxRadius, life: 0, maxLife: 0.34 });
  }

  function spawnSparkles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 45 + Math.random() * 75;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 26,
        size: 3 + Math.random() * 3.5,
        color,
        life: 0,
        maxLife: 0.38 + Math.random() * 0.22,
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 8,
      });
    }
  }

  function spawnMouseBadge(x, y, text, color) {
    state.mouseBadges.push({ x, y, text, color, life: 0, maxLife: 0.68 });
  }

  // =========================================================================
  // Enlarged Floating Keycap Popups (Flanking Showcase + Smooth Fade-Out)
  // =========================================================================
  function getKeyDisplayInfo(e, keyObj, alias) {
    if (alias) {
      let main = alias.popup;
      if (e.shiftKey && alias.shift) main = alias.shift;
      return {
        main,
        widthFactor: main.length >= 4 ? 1.52 : main.length >= 3 ? 1.28 : 1.0,
      };
    }
    if (keyObj) {
      let main = keyObj.popup || keyObj.label || 'Key';
      if (e.shiftKey && keyObj.shift) main = keyObj.shift;
      let widthFactor = 1.0;
      if (keyObj.code === 'Space') widthFactor = 2.05;
      else if (main.length >= 5) widthFactor = 1.62;
      else if (main.length >= 3) widthFactor = 1.32;
      return { main, widthFactor };
    }
    const rawKey =
      e.key && e.key !== 'Process' && e.key !== 'Unidentified'
        ? e.key.length === 1
          ? e.key.toUpperCase()
          : e.key.slice(0, 5)
        : (e.code || 'Key').slice(0, 5);
    return {
      main: rawKey,
      widthFactor: rawKey.length >= 3 ? 1.38 : 1.0,
    };
  }

  function spawnOrPulseKeyPopup(code, keyObj, displayInfo, isRepeat) {
    if (isRepeat) {
      const existing = [...state.popups].reverse().find((p) => p.code === code && p.isHeld);
      if (existing) {
        existing.pulse = 1;
        existing.holdElapsed = 0;
        return;
      }
    }

    const startX = keyObj ? keyObj.wx : KB.cx;
    const startY = keyObj ? keyObj.wy - 10 : KB.cy - 20;
    const boxH = 76;
    const boxW = Math.round(76 * displayInfo.widthFactor);

    const isLeftSide = keyObj ? keyObj.hand === 'left' : false;
    let targetX = isLeftSide
      ? clamp(185 + (startX - 380) * 0.2, 85 + boxW * 0.5, 255 - boxW * 0.5)
      : clamp(725 + (startX - 580) * 0.2, 665 + boxW * 0.5, 825 - boxW * 0.5);
    let targetY = 192;

    const fresh = state.popups.filter((p) => p.fadeProgress < 0.45);
    for (let attempt = 0; attempt < 4; attempt++) {
      let overlap = false;
      for (const other of fresh) {
        const minX = (boxW + other.w) * 0.5 + 10;
        const minY = 66;
        if (Math.abs(targetX - other.targetX) < minX && Math.abs(targetY - other.targetY) < minY) {
          targetY -= 64;
          if (targetY < 76) {
            targetY = 208;
            targetX += isLeftSide ? -50 : 50;
            targetX = clamp(targetX, 65 + boxW * 0.5, STAGE_W - 65 - boxW * 0.5);
          }
          overlap = true;
        }
      }
      if (!overlap) break;
    }

    if (state.popups.length >= 5) {
      state.popups[0].fastFade = true;
      state.popups[0].isHeld = false;
    }

    const isAccent = Boolean(keyObj && keyObj.accent);
    state.popups.push({
      code,
      main: displayInfo.main,
      w: boxW,
      h: boxH,
      startX,
      startY,
      x: startX,
      y: startY,
      targetX,
      targetY,
      age: 0,
      holdElapsed: 0,
      fadeElapsed: 0,
      fadeProgress: 0,
      isHeld: true,
      fastFade: false,
      pulse: 1,
      isAccent,
    });
  }

  // =========================================================================
  // Keyboard & Mouse Input Listeners
  // =========================================================================
  function resolveKeyTarget(code) {
    if (keyByCode.has(code)) return { keyObj: keyByCode.get(code), alias: null };
    const alias = CODE_ALIAS[code];
    if (alias && keyByCode.has(alias.target)) return { keyObj: keyByCode.get(alias.target), alias };
    return { keyObj: keyByCode.get('Space'), alias: null, unknown: true };
  }

  function assignPawForKey(keyObj) {
    if (!keyObj) return;

    let useLeft = keyObj.hand === 'left';
    if (useLeft && (state.leftDown || state.rightDown || state.middleDown)) {
      useLeft = false;
    }

    if (useLeft) {
      const lp = state.leftPaw;
      lp.mode = 'keyboard';
      lp.activeKeyCode = keyObj.code;
      lp.targetX = keyObj.wx;
      lp.targetY = keyObj.wy - 4;
      lp.returnToMouseAt = state.time + 0.56;
      state.leftEarKick = 1;
    } else {
      const rp = state.rightPaw;
      rp.prevX = rp.x;
      rp.prevY = rp.y;
      rp.ghostAlpha = 0.4;
      rp.activeKeyCode = keyObj.code;
      rp.targetX = keyObj.code === 'Space' ? keyObj.wx + 24 : keyObj.wx;
      rp.targetY = keyObj.wy - 4;
      rp.holdUntil = state.time + 0.14;
      state.rightEarKick = 1;
    }
  }

  window.addEventListener('keydown', (e) => {
    const isBrowserShortcut =
      ((e.metaKey || e.ctrlKey) &&
        (e.code === 'KeyR' || e.code === 'KeyW' || e.code === 'KeyT' || e.code === 'KeyL')) ||
      e.code === 'F12';

    if (!isBrowserShortcut) {
      if (
        e.code === 'Space' ||
        e.code === 'Tab' ||
        e.code === 'Backspace' ||
        e.code === 'Slash' ||
        e.code === 'Quote' ||
        e.code.startsWith('Arrow') ||
        e.code.startsWith('F')
      ) {
        e.preventDefault();
      }
    }

    state.capsLock = Boolean(e.getModifierState && e.getModifierState('CapsLock'));
    state.shiftDown = e.shiftKey;
    if (e.code === 'MetaLeft' || e.code === 'MetaRight') state.metaDown = true;

    const { keyObj, alias, unknown } = resolveKeyTarget(e.code);
    const displayInfo = getKeyDisplayInfo(e, unknown ? null : keyObj, alias);

    if (keyObj) {
      keyObj.isDown = true;
      keyObj.glow = 1;
    }

    state.activeCodes.add(e.code);
    if (state.metaDown && e.code !== 'MetaLeft' && e.code !== 'MetaRight') {
      state.metaPressedCodes.add(e.code);
    }

    spawnOrPulseKeyPopup(e.code, keyObj, displayInfo, e.repeat);

    if (!e.repeat && keyObj) {
      assignPawForKey(keyObj);

      spawnRipple(keyObj.wx, keyObj.wy, '#FFA234', Math.max(22, keyObj.w * 0.7));
      spawnSparkles(keyObj.wx, keyObj.wy - 4, '#FFB84D', 5);

      state.dogTargetLeanX = clamp((keyObj.wx - KB.cx) * 0.085, -18, 18);
      state.targetLookX = clamp((keyObj.wx - DOG_BASE_X) / 280, -0.75, 0.85);
      state.targetLookY = 0.48;
      state.headBounce = 1;
      state.excitement = Math.min(1, state.excitement + 0.25);
      if (state.excitement > 0.78) state.happyEyesTimer = Math.max(state.happyEyesTimer, 0.36);

      playKeySound(keyObj.w >= 1.75);
      incrementAction(`按下按键：${displayInfo.main}`);
    }
  });

  function releaseKeyCode(code) {
    state.activeCodes.delete(code);
    const { keyObj } = resolveKeyTarget(code);
    if (keyObj) {
      let stillHeld = false;
      for (const active of state.activeCodes) {
        if (resolveKeyTarget(active).keyObj === keyObj) {
          stillHeld = true;
          break;
        }
      }
      if (!stillHeld) keyObj.isDown = false;
    }

    for (const p of state.popups) {
      if (p.code === code && p.isHeld) p.isHeld = false;
    }

    if (keyObj && state.leftPaw.activeKeyCode === keyObj.code) {
      state.leftPaw.activeKeyCode = null;
      state.leftPaw.returnToMouseAt = Math.min(state.leftPaw.returnToMouseAt, state.time + 0.42);
    }
    if (keyObj && state.rightPaw.activeKeyCode === keyObj.code) {
      state.rightPaw.activeKeyCode = null;
    }
  }

  window.addEventListener('keyup', (e) => {
    state.capsLock = Boolean(e.getModifierState && e.getModifierState('CapsLock'));
    state.shiftDown = e.shiftKey;
    releaseKeyCode(e.code);

    if (e.code === 'MetaLeft' || e.code === 'MetaRight') {
      state.metaDown = false;
      for (const stuckCode of [...state.metaPressedCodes]) releaseKeyCode(stuckCode);
      state.metaPressedCodes.clear();
    }
  });

  function updateMouseFromClient(clientX, clientY) {
    const nx = clamp(clientX / Math.max(1, window.innerWidth), 0, 1);
    const ny = clamp(clientY / Math.max(1, window.innerHeight), 0, 1);

    state.mouseNormX = nx;
    state.mouseNormY = ny;
    state.mouseTargetX = lerp(MOUSE_BOUNDS.minX, MOUSE_BOUNDS.maxX, nx);
    state.mouseTargetY = lerp(MOUSE_BOUNDS.minY, MOUSE_BOUNDS.maxY, ny);
    state.mouseActivityGlow = Math.min(1, state.mouseActivityGlow + 0.35);

    state.leftPaw.mode = 'mouse';
    state.leftPaw.activeKeyCode = null;

    state.targetLookX = (nx - 0.5) * 1.4;
    state.targetLookY = (ny - 0.42) * 0.95;
    state.dogTargetLeanX = (nx - 0.5) * 14;
  }

  function syncMouseButtonsBitmask(buttons) {
    if (typeof buttons !== 'number') return;
    state.leftDown = (buttons & 1) !== 0;
    state.rightDown = (buttons & 2) !== 0;
    state.middleDown = (buttons & 4) !== 0;
  }

  window.addEventListener('mousemove', (e) => {
    updateMouseFromClient(e.clientX, e.clientY);
    syncMouseButtonsBitmask(e.buttons);
  });

  window.addEventListener('mousedown', (e) => {
    if (e.target && e.target.closest && e.target.closest('.hud-actions')) return;

    updateMouseFromClient(e.clientX, e.clientY);
    state.leftPaw.mode = 'mouse';
    state.leftEarKick = 0.95;
    state.headBounce = 0.7;
    state.excitement = Math.min(1, state.excitement + 0.24);
    state.mouseActivityGlow = 1;

    if (e.button === 0) {
      state.leftDown = true;
      state.leftGlow = 1;
      spawnRipple(state.mouseX - 18, state.mouseY + 24, '#FF7849', 44);
      spawnSparkles(state.mouseX - 18, state.mouseY + 24, '#FF7849', 5);
      spawnMouseBadge(state.mouseX - 24, state.mouseY + 66, '左键', '#FF6B42');
      playMouseClickSound(false);
      incrementAction('点击鼠标左键');
    } else if (e.button === 2) {
      state.rightDown = true;
      state.rightGlow = 1;
      spawnRipple(state.mouseX + 18, state.mouseY + 24, '#38BDF8', 44);
      spawnSparkles(state.mouseX + 18, state.mouseY + 24, '#38BDF8', 5);
      spawnMouseBadge(state.mouseX + 24, state.mouseY + 66, '右键', '#0EA5E9');
      playMouseClickSound(true);
      incrementAction('点击鼠标右键');
    } else if (e.button === 1) {
      e.preventDefault();
      state.middleDown = true;
      state.middleGlow = 1;
      spawnRipple(state.mouseX, state.mouseY + 20, '#A78BFA', 38);
      spawnMouseBadge(state.mouseX, state.mouseY + 66, '中键', '#8B5CF6');
      playMouseClickSound(true);
      incrementAction('点击鼠标中键');
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.leftDown = false;
    else if (e.button === 2) state.rightDown = false;
    else if (e.button === 1) state.middleDown = false;
    syncMouseButtonsBitmask(e.buttons);
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  window.addEventListener(
    'wheel',
    (e) => {
      state.leftPaw.mode = 'mouse';
      state.wheelVel += clamp(e.deltaY, -120, 120) * 0.28;
      state.middleGlow = Math.max(state.middleGlow, 0.85);
      state.excitement = Math.min(1, state.excitement + 0.08);
    },
    { passive: true }
  );

  window.addEventListener('blur', () => {
    for (const code of [...state.activeCodes]) releaseKeyCode(code);
    state.metaDown = false;
    state.shiftDown = false;
    state.metaPressedCodes.clear();
    state.leftDown = false;
    state.rightDown = false;
    state.middleDown = false;
  });

  // =========================================================================
  // Simulation Update
  // =========================================================================
  function update(dt) {
    state.time += dt;

    const prevMx = state.mouseX;
    const mFollow = 1 - Math.exp(-dt * 24);
    state.mouseX = lerp(state.mouseX, state.mouseTargetX, mFollow);
    state.mouseY = lerp(state.mouseY, state.mouseTargetY, mFollow);
    state.mouseVx = (state.mouseX - prevMx) / Math.max(0.001, dt);
    const targetTilt = clamp(0.04 + state.mouseVx * 0.00042 + (state.mouseNormX - 0.5) * 0.08, -0.15, 0.18);
    state.mouseTilt = lerp(state.mouseTilt, targetTilt, 1 - Math.exp(-dt * 14));
    state.mouseActivityGlow = Math.max(0, state.mouseActivityGlow - dt * 1.9);

    state.wheelOffset += state.wheelVel * dt;
    state.wheelVel *= Math.exp(-dt * 10);

    if (state.leftDown) state.leftGlow = 1;
    else state.leftGlow = Math.max(0, state.leftGlow - dt * 3.0);

    if (state.rightDown) state.rightGlow = 1;
    else state.rightGlow = Math.max(0, state.rightGlow - dt * 3.0);

    if (state.middleDown) state.middleGlow = 1;
    else state.middleGlow = Math.max(0, state.middleGlow - dt * 3.2);

    for (const k of keysList) {
      k.press = lerp(k.press, k.isDown ? 1 : 0, 1 - Math.exp(-dt * 30));
      if (k.isDown) k.glow = 1;
      else k.glow = Math.max(0, k.glow - dt * 3.4);
    }

    state.excitement = Math.max(0, state.excitement - dt * 0.45);
    state.tailPhase += dt * (4.6 + state.excitement * 11.2);
    state.dogLeanX = lerp(state.dogLeanX, state.dogTargetLeanX, 1 - Math.exp(-dt * 9));
    state.dogTargetLeanX *= Math.exp(-dt * 1.6);

    state.lookX = lerp(state.lookX, state.targetLookX, 1 - Math.exp(-dt * 11));
    state.lookY = lerp(state.lookY, state.targetLookY, 1 - Math.exp(-dt * 11));
    state.leftEarKick *= Math.exp(-dt * 14);
    state.rightEarKick *= Math.exp(-dt * 14);
    state.headBounce *= Math.exp(-dt * 16);
    state.happyEyesTimer = Math.max(0, state.happyEyesTimer - dt);

    state.blinkTimer -= dt;
    if (state.blinkTimer <= 0) {
      state.blinkProgress += dt * 7.4;
      if (state.blinkProgress >= Math.PI) {
        state.blinkProgress = 0;
        state.blinkTimer = 2.4 + Math.random() * 3.0;
      }
    }

    const pawFollow = 1 - Math.exp(-dt * 28);

    // Left paw
    const lp = state.leftPaw;
    if (lp.mode === 'keyboard' && lp.activeKeyCode === null && state.time > lp.returnToMouseAt) {
      lp.mode = 'mouse';
    }
    if (lp.mode === 'mouse') {
      let cShiftX = 0;
      let cShiftY = 0;
      if (state.leftDown || state.leftGlow > 0.3) {
        const s = Math.max(state.leftDown ? 1 : 0, state.leftGlow);
        cShiftX = -5 * s;
        cShiftY = 4 * s;
      } else if (state.rightDown || state.rightGlow > 0.3) {
        const s = Math.max(state.rightDown ? 1 : 0, state.rightGlow);
        cShiftX = 5 * s;
        cShiftY = 4 * s;
      }
      lp.clickShiftX = lerp(lp.clickShiftX, cShiftX, 1 - Math.exp(-dt * 26));
      lp.clickShiftY = lerp(lp.clickShiftY, cShiftY, 1 - Math.exp(-dt * 26));
      lp.targetX = state.mouseX + 4 + lp.clickShiftX;
      lp.targetY = state.mouseY - 24 + lp.clickShiftY;
    }

    const lpDist = Math.hypot(lp.targetX - lp.x, lp.targetY - lp.y);
    lp.x = lerp(lp.x, lp.targetX, pawFollow);
    lp.y = lerp(lp.y, lp.targetY, pawFollow);
    const lpClicking =
      lp.mode === 'mouse'
        ? state.leftDown || state.rightDown || state.middleDown
        : lp.activeKeyCode !== null && lpDist < 22;
    lp.lift = lerp(lp.lift, clamp(lpDist / 85, 0, 0.8), 1 - Math.exp(-dt * 22));
    lp.press = lerp(lp.press, lpClicking ? 1 : 0, 1 - Math.exp(-dt * 28));

    // Right paw
    const rp = state.rightPaw;
    const rightActive = rp.activeKeyCode !== null || state.time < rp.holdUntil;
    if (!rightActive) {
      const breathe = Math.sin(state.time * 2.5) * 2.5;
      rp.targetX = rp.restX + state.dogLeanX * 0.45;
      rp.targetY = rp.restY + breathe;
    }
    const rpDist = Math.hypot(rp.targetX - rp.x, rp.targetY - rp.y);
    rp.x = lerp(rp.x, rp.targetX, pawFollow);
    rp.y = lerp(rp.y, rp.targetY, pawFollow);
    rp.ghostAlpha = Math.max(0, rp.ghostAlpha - dt * 3.8);
    rp.lift = lerp(rp.lift, rightActive ? clamp(rpDist / 75, 0, 0.78) : 0.08, 1 - Math.exp(-dt * 24));
    rp.press = lerp(rp.press, rightActive && rpDist < 22 ? 1 : 0, 1 - Math.exp(-dt * 30));

    // Enlarged floating keycaps
    for (let i = state.popups.length - 1; i >= 0; i--) {
      const p = state.popups[i];
      p.age += dt;
      p.pulse *= Math.exp(-dt * 14);

      const moveT = easeOutCubic(Math.min(1, p.age / 0.15));
      p.x = lerp(p.startX, p.targetX, moveT);
      p.y = lerp(p.startY, p.targetY, moveT);

      const minHold = p.fastFade ? 0.14 : 0.48;
      if (!p.isHeld || p.age > 1.35) p.holdElapsed += dt;

      if (p.age >= minHold && (!p.isHeld || p.age > 1.35)) {
        const fadeDur = p.fastFade ? 0.34 : 0.72;
        p.fadeElapsed += dt;
        p.fadeProgress = clamp(p.fadeElapsed / fadeDur, 0, 1);
      }

      if (p.fadeProgress >= 1) state.popups.splice(i, 1);
    }

    for (let i = state.ripples.length - 1; i >= 0; i--) {
      state.ripples[i].life += dt;
      if (state.ripples[i].life >= state.ripples[i].maxLife) state.ripples.splice(i, 1);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 170 * dt;
      pt.vx *= Math.exp(-dt * 2.5);
      pt.rot += pt.vRot * dt;
      if (pt.life >= pt.maxLife) state.particles.splice(i, 1);
    }

    for (let i = state.mouseBadges.length - 1; i >= 0; i--) {
      state.mouseBadges[i].life += dt;
      if (state.mouseBadges[i].life >= state.mouseBadges[i].maxLife) state.mouseBadges.splice(i, 1);
    }
  }

  // =========================================================================
  // Shared Palette Helper (Adapts Cleanly Between 'shiba' and 'daisy')
  // =========================================================================
  function getCharStyle() {
    if (currentChar === 'daisy') {
      return {
        outline: '#765035',
        outlineW: 3.2,
        armStart: '#F9C961',
        armEnd: '#FAD274',
        shoulderBlend: '#F7C257',
        furLight: '#FDE08B',
        furMid: '#F9C962',
        furDark: '#EDAE44',
      };
    }
    return {
      outline: '#59341C',
      outlineW: 2.8,
      armStart: '#F2AA40',
      armEnd: '#F8BE5C',
      shoulderBlend: '#F2AA40',
      furLight: '#FDD37C',
      furMid: '#F4AE44',
      furDark: '#E09128',
    };
  }

  // =========================================================================
  // Backdrop & Ground Mat
  // =========================================================================
  function drawBackdropFullViewport() {
    const w = viewport.cssW;
    const h = viewport.cssH;

    if (currentChar === 'daisy') {
      if (isDarkTheme) {
        const grad = ctx.createRadialGradient(w * 0.5, h * 0.46, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
        grad.addColorStop(0, '#273245');
        grad.addColorStop(0.6, '#1D2534');
        grad.addColorStop(1, '#151B27');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        if (crayonDarkPattern) {
          ctx.fillStyle = crayonDarkPattern;
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        // Dreamy pastel sky-blue colored-pencil storybook backdrop matching uploaded image!
        const grad = ctx.createRadialGradient(w * 0.5, h * 0.42, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
        grad.addColorStop(0, '#EEF7FF');
        grad.addColorStop(0.55, '#D7ECFF');
        grad.addColorStop(1, '#BBE0FE');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        if (crayonLightPattern) {
          ctx.fillStyle = crayonLightPattern;
          ctx.fillRect(0, 0, w, h);
        }
      }
      return;
    }

    if (isDarkTheme) {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.48, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      grad.addColorStop(0, '#23252D');
      grad.addColorStop(0.6, '#1A1B21');
      grad.addColorStop(1, '#141519');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.44, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
      grad.addColorStop(0, '#FFFDF9');
      grad.addColorStop(0.6, '#FAF0E1');
      grad.addColorStop(1, '#F1DFC6');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawGroundShadow() {
    ctx.save();
    if (currentChar === 'daisy') {
      // Soft periwinkle crayon ground cushion matching uploaded image!
      ctx.fillStyle = isDarkTheme ? 'rgba(92, 138, 206, 0.28)' : 'rgba(122, 174, 238, 0.48)';
      ctx.beginPath();
      ctx.ellipse(484, 476, 304, 68, 0.02, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isDarkTheme ? 'rgba(72, 114, 180, 0.22)' : 'rgba(98, 152, 224, 0.28)';
      ctx.beginPath();
      ctx.ellipse(484, 480, 272, 54, 0.02, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = isDarkTheme ? 'rgba(0, 0, 0, 0.36)' : 'rgba(130, 88, 46, 0.14)';
      ctx.beginPath();
      ctx.ellipse(482, 482, 294, 66, 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // =========================================================================
  // Character 2: 🌼 蓝巾笑柴 (Uploaded Happy Daisy-Scarf Storybook Shiba!)
  // =========================================================================
  function drawDoodleHeart(x, y, size, rot, bobPhase) {
    const bobY = Math.sin(state.time * 2.4 + bobPhase) * 5;
    const pop = 1 + state.excitement * 0.12 * Math.sin(state.time * 8 + bobPhase);
    ctx.save();
    ctx.translate(x, y + bobY);
    ctx.rotate(rot);
    ctx.scale(pop, pop);

    const drawHeartShape = () => {
      ctx.beginPath();
      ctx.moveTo(0, size * 0.35);
      ctx.bezierCurveTo(-size * 0.15, -size * 0.45, -size * 1.15, -size * 0.25, -size * 0.9, size * 0.38);
      ctx.bezierCurveTo(-size * 0.72, size * 0.85, -size * 0.12, size * 1.05, 0, size * 1.2);
      ctx.bezierCurveTo(size * 0.12, size * 1.05, size * 0.72, size * 0.85, size * 0.9, size * 0.38);
      ctx.bezierCurveTo(size * 1.15, -size * 0.25, size * 0.15, -size * 0.45, 0, size * 0.35);
      ctx.closePath();
    };

    // White sticker rim
    drawHeartShape();
    ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.85)' : '#FFFFFF';
    ctx.lineWidth = 7.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Soft pastel pink heart fill
    const hGrad = ctx.createLinearGradient(0, -size * 0.3, 0, size * 1.2);
    hGrad.addColorStop(0, '#FFB5CB');
    hGrad.addColorStop(1, '#F688A9');
    ctx.fillStyle = hGrad;
    ctx.fill();

    // Cute soft pink outline
    ctx.strokeStyle = '#E87397';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Glossy highlight dot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.38, size * 0.2, size * 0.16, size * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawDoodleStar(x, y, outerR, rot, bobPhase) {
    const bobY = Math.sin(state.time * 2.1 + bobPhase) * 4.5;
    const wiggle = Math.sin(state.time * 1.8 + bobPhase) * 0.12;
    const pop = 1 + state.excitement * 0.14;
    ctx.save();
    ctx.translate(x, y + bobY);
    ctx.rotate(rot + wiggle);
    ctx.scale(pop, pop);

    const drawStarPath = () => {
      const innerR = outerR * 0.52;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    // White sticker border
    drawStarPath();
    ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.85)' : '#FFFFFF';
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.fillStyle = '#FFE880';
    ctx.fill();

    ctx.strokeStyle = '#F2C044';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.restore();
  }

  function drawMotionRays(x, y, rot, intensity) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const scale = 0.92 + intensity * 0.18;
    ctx.scale(scale, scale);

    const rays = [
      { a: -0.42, r1: 8, r2: 24 },
      { a: 0, r1: 6, r2: 28 },
      { a: 0.42, r1: 8, r2: 23 },
    ];

    // White sticker rim
    ctx.lineCap = 'round';
    for (const r of rays) {
      ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.72)' : '#FFFFFF';
      ctx.lineWidth = 8.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(r.a) * r.r1, Math.sin(r.a) * r.r1);
      ctx.lineTo(Math.cos(r.a) * r.r2, Math.sin(r.a) * r.r2);
      ctx.stroke();

      ctx.strokeStyle = '#FFD058';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(r.a) * r.r1, Math.sin(r.a) * r.r1);
      ctx.lineTo(Math.cos(r.a) * r.r2, Math.sin(r.a) * r.r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDaisyDecorations() {
    // Plump pastel pink hearts & yellow doodle stars matching the uploaded illustration!
    drawDoodleHeart(542, 34, 20, 0.14, 0.3);
    drawDoodleHeart(272, 240, 21, -0.22, 1.7);
    drawDoodleHeart(684, 244, 22, 0.18, 2.8);

    drawDoodleStar(300, 114, 22, -0.2, 0.9);
    drawDoodleStar(682, 148, 17, 0.25, 2.2);

    // Cheek sparkle motion lines bursting outward to the left of face
    drawMotionRays(306, 186, Math.PI + 0.18, state.excitement);

    // Mouse paw golden motion rays (exact cute detail from uploaded image!)
    drawMotionRays(
      state.mouseX - 24,
      state.mouseY - 52,
      -Math.PI * 0.72,
      Math.max(state.mouseActivityGlow, state.leftGlow, state.rightGlow)
    );
  }

  function drawMiniDaisyFlower(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, r * 0.56, r * 0.42, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFD152';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function defineDaisyTailPath() {
    // Super fluffy cream-outer & gold-inner curled Shiba tail matching the uploaded image!
    ctx.beginPath();
    ctx.moveTo(-4, 22);
    ctx.bezierCurveTo(18, 28, 66, 20, 74, -14);
    ctx.bezierCurveTo(80, -40, 62, -62, 42, -56);
    ctx.bezierCurveTo(34, -64, 16, -60, 12, -46);
    ctx.bezierCurveTo(-2, -46, -12, -26, -4, -10);
    ctx.closePath();
  }

  function drawDaisyTail(baseX, baseY) {
    const style = getCharStyle();
    const wagAmp = 0.16 + state.excitement * 0.28;
    const wag = Math.sin(state.tailPhase) * wagAmp;

    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(0.06 + wag);

    // Cream-white fluffy cloud outer tail
    defineDaisyTailPath();
    ctx.fillStyle = '#FFFDF8';
    ctx.fill();

    // Inner golden butter-yellow swirl inside tail clip
    ctx.save();
    defineDaisyTailPath();
    ctx.clip();
    ctx.fillStyle = '#F7C154';
    ctx.beginPath();
    ctx.ellipse(26, -6, 36, 30, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Cute soft golden swirl center shadow
    ctx.strokeStyle = '#DF9E38';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(28, -10, 13, 0.2, Math.PI * 1.45);
    ctx.stroke();
    ctx.restore();

    defineDaisyTailPath();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
  }

  function defineBlueBandanaStrapPath() {
    ctx.beginPath();
    ctx.moveTo(-78, -22);
    ctx.quadraticCurveTo(-8, 12, 74, -14);
    ctx.quadraticCurveTo(82, 4, 62, 18);
    ctx.quadraticCurveTo(-10, 48, -72, 12);
    ctx.quadraticCurveTo(-86, -4, -78, -22);
    ctx.closePath();
  }

  function drawBlueDaisyBandana(cx, cy, leanX) {
    const style = getCharStyle();
    const flutter = Math.sin(state.time * 3.4) * 0.06 + state.excitement * 0.12 * Math.sin(state.time * 12);

    ctx.save();
    ctx.translate(cx, cy);

    // Soft shadow beneath bandana
    ctx.fillStyle = 'rgba(130, 88, 38, 0.15)';
    ctx.beginPath();
    ctx.ellipse(-2, 22, 72, 16, 0.04, 0, Math.PI * 2);
    ctx.fill();

    // 1. Two fluttering side ribbon tails tied on the right side (both clearly visible!)
    ctx.save();
    ctx.translate(68 + leanX * 0.08, 6);
    ctx.rotate(flutter);

    // Upper ribbon tail
    const drawUpperTail = () => {
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.bezierCurveTo(22, -26, 56, -32, 74, -14);
      ctx.bezierCurveTo(68, 4, 34, 14, 2, 6);
      ctx.closePath();
    };
    drawUpperTail();
    ctx.fillStyle = '#7FB0EC';
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawMiniDaisyFlower(44, -11, 8.8);
    ctx.restore();
    drawUpperTail();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Lower ribbon tail curving outward-right so it drapes cleanly beside the shoulder!
    const drawLowerTail = () => {
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(32, 8, 60, 26, 56, 48);
      ctx.bezierCurveTo(36, 52, 16, 36, -4, 14);
      ctx.closePath();
    };
    drawLowerTail();
    ctx.fillStyle = '#6A9CE0';
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawMiniDaisyFlower(32, 30, 8.8);
    ctx.restore();
    drawLowerTail();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();

    // 2. Main blue daisy bandana strap around neck
    ctx.save();
    defineBlueBandanaStrapPath();
    const bGrad = ctx.createLinearGradient(-70, -18, 60, 38);
    bGrad.addColorStop(0, '#86B6F0');
    bGrad.addColorStop(0.55, '#72A3E4');
    bGrad.addColorStop(1, '#5D8FD4');
    ctx.fillStyle = bGrad;
    ctx.fill();
    ctx.clip();

    // Subtle fabric crease line
    ctx.strokeStyle = 'rgba(56, 98, 162, 0.35)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-58, 10);
    ctx.quadraticCurveTo(0, 30, 56, 6);
    ctx.stroke();

    // Cute white daisies across the blue bandana!
    drawMiniDaisyFlower(-48, -2, 8.8);
    drawMiniDaisyFlower(-14, 12, 9.2);
    drawMiniDaisyFlower(26, 12, 9.0);
    drawMiniDaisyFlower(56, -4, 7.2);
    ctx.restore();

    defineBlueBandanaStrapPath();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 3. Cute rounded side knot
    ctx.save();
    ctx.translate(60, 2);
    ctx.rotate(-0.18);
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7AAAE8';
    ctx.fill();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function defineDaisyEarPath(side) {
    ctx.beginPath();
    ctx.moveTo(side * -30, 22);
    ctx.bezierCurveTo(side * -26, -34, side * 0, -72, side * 22, -64);
    ctx.bezierCurveTo(side * 44, -54, side * 46, 4, side * 30, 40);
    ctx.closePath();
  }

  function drawDaisyEarStroke(side, kick) {
    const style = getCharStyle();
    ctx.save();
    ctx.translate(side * 68, -56);
    ctx.rotate(side * (0.24 + kick * 0.14));
    defineDaisyEarPath(side);
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW * 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawDaisyEarFill(side, kick) {
    ctx.save();
    ctx.translate(side * 68, -56);
    ctx.rotate(side * (0.24 + kick * 0.14));

    defineDaisyEarPath(side);
    const eGrad = ctx.createLinearGradient(0, -64, 0, 34);
    eGrad.addColorStop(0, '#FCE08A');
    eGrad.addColorStop(0.55, '#F8C65C');
    eGrad.addColorStop(1, '#EAA93D');
    ctx.fillStyle = eGrad;
    ctx.fill();

    // Milky white inner fur rim
    ctx.beginPath();
    ctx.moveTo(side * -14, 18);
    ctx.bezierCurveTo(side * -8, -22, side * 6, -48, side * 20, -42);
    ctx.bezierCurveTo(side * 32, -36, side * 32, 6, side * 20, 28);
    ctx.closePath();
    ctx.fillStyle = '#FFFDF9';
    ctx.fill();

    // Soft pastel sakura-pink inner ear center
    ctx.beginPath();
    ctx.moveTo(side * -7, 15);
    ctx.bezierCurveTo(side * -3, -12, side * 8, -32, side * 17, -28);
    ctx.bezierCurveTo(side * 26, -22, side * 26, 6, side * 17, 24);
    ctx.closePath();
    ctx.fillStyle = '#F5B5BC';
    ctx.fill();

    // Fuzzy cute ear base tuft lines
    ctx.strokeStyle = 'rgba(118, 80, 53, 0.45)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * -4, 16);
    ctx.lineTo(side * 1, 9);
    ctx.moveTo(side * 6, 18);
    ctx.lineTo(side * 9, 11);
    ctx.stroke();

    ctx.restore();
  }

  function defineDaisyHeadPath() {
    // Super round, 100% G1-continuous circular mochi Shiba head (圆滚滚的连贯圆脸!)
    ctx.beginPath();
    ctx.moveTo(0, -90);
    ctx.bezierCurveTo(64, -90, 111, -48, 111, 4);
    ctx.bezierCurveTo(111, 58, 66, 96, 0, 96);
    ctx.bezierCurveTo(-66, 96, -111, 58, -111, 4);
    ctx.bezierCurveTo(-111, -48, -64, -90, 0, -90);
    ctx.closePath();
  }

  function drawDaisyFaceFeatures() {
    const style = getCharStyle();
    const fx = state.lookX * 4.2;
    const fy = state.lookY * 3.0;
    const happyLift = state.headBounce * 3.2;

    ctx.save();
    ctx.translate(fx, fy);

    // Oval pastel pink cheek blushes + 3 crisp diagonal blush lines (///) matching uploaded image!
    for (const side of [-1, 1]) {
      const bx = side * 68;
      const by = 18;
      ctx.fillStyle = '#F9B9C0';
      ctx.beginPath();
      ctx.ellipse(bx, by, 21, 12.5, side * 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Three adorable diagonal pink hatch lines inside each cheek blush
      ctx.strokeStyle = '#E5808E';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      for (const ox of [-7, 0, 7]) {
        ctx.beginPath();
        ctx.moveTo(bx + ox - 2, by + 4);
        ctx.lineTo(bx + ox + 3, by - 4);
        ctx.stroke();
      }
    }

    // Iconic joyous smiling crescent eyes (◠ ◠)
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 44, -4 - happyLift * 0.5);
      ctx.strokeStyle = '#573620';
      ctx.lineWidth = 5.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 8, 17, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.restore();
    }

    // Joyous big open laugh mouth + bouncing pink puppy tongue!
    const tongueBounce = Math.sin(state.time * 5.2) * 1.5 + state.excitement * 5;
    ctx.save();
    const drawOpenMouth = () => {
      ctx.beginPath();
      ctx.moveTo(-22, 24);
      ctx.quadraticCurveTo(0, 30, 22, 24);
      ctx.bezierCurveTo(22, 54 + tongueBounce, 12, 66 + tongueBounce, 0, 66 + tongueBounce);
      ctx.bezierCurveTo(-12, 66 + tongueBounce, -22, 54 + tongueBounce, -22, 24);
      ctx.closePath();
    };

    drawOpenMouth();
    ctx.fillStyle = '#7D4238';
    ctx.fill();

    // Bouncing cute pink puppy tongue inside mouth
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#F79DA7';
    ctx.beginPath();
    ctx.ellipse(0, 50 + tongueBounce * 0.8, 17, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute subtle tongue center crease line
    ctx.strokeStyle = '#DF7B87';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 34 + tongueBounce * 0.4);
    ctx.lineTo(0, 48 + tongueBounce * 0.6);
    ctx.stroke();
    ctx.restore();

    drawOpenMouth();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = 3.2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // Crisp smiling ω upper lip framing the laugh
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 17);
    ctx.lineTo(0, 23);
    ctx.moveTo(0, 23);
    ctx.bezierCurveTo(-6, 33, -24, 34, -29, 22);
    ctx.moveTo(0, 23);
    ctx.bezierCurveTo(6, 33, 24, 34, 29, 22);
    ctx.stroke();

    // Cute glossy chocolate nose
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(10, 5.5, 13, 12, 7.5, 17);
    ctx.quadraticCurveTo(0, 20.5, -7.5, 17);
    ctx.bezierCurveTo(-13, 12, -10, 5.5, 0, 6);
    ctx.closePath();
    ctx.fillStyle = '#53331F';
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(-3.2, 9.8, 3.2, 1.7, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawDaisyCharacter() {
    const style = getCharStyle();
    const breath = Math.sin(state.time * 2.6) * 3.0;
    const bodyX = DOG_BASE_X + state.dogLeanX;
    const headX = bodyX + state.lookX * 4;
    const headY = 186 + breath + state.headBounce * 4.5;
    // Playful happy slight rightward head tilt matching uploaded illustration!
    const headTilt = clamp(0.055 + state.dogLeanX * 0.002 + state.lookX * 0.035, -0.06, 0.14);

    // 1. Floating pastel hearts, doodle stars & yellow motion rays!
    drawDaisyDecorations();

    // 2. Super fluffy cream-and-gold curled Shiba tail
    drawDaisyTail(bodyX + 86, 342 + breath * 0.35);

    // 3. Cute chubby butter-gold sitting body + snowy-white belly
    ctx.save();
    defineSittingTorsoPath(bodyX, breath);
    const bodyGrad = ctx.createRadialGradient(bodyX - 24, 271, 20, bodyX, 331, 145);
    bodyGrad.addColorStop(0, '#FCE08A');
    bodyGrad.addColorStop(0.55, '#F8C75E');
    bodyGrad.addColorStop(1, '#ECAD42');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.save();
    defineSittingTorsoPath(bodyX, breath);
    ctx.clip();

    const bellyGrad = ctx.createLinearGradient(bodyX, 256, bodyX, 402);
    bellyGrad.addColorStop(0, '#FFFFFF');
    bellyGrad.addColorStop(0.8, '#FFFDF9');
    bellyGrad.addColorStop(1, '#F6EDE2');
    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.ellipse(bodyX, 336 + breath * 0.3, 66, 86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    defineSittingTorsoPath(bodyX, breath);
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // 4. Signature blue daisy bandana cradling the round chin!
    drawBlueDaisyBandana(bodyX, 278 + breath * 0.75, state.dogLeanX);

    // 5. Big round joyful smiling Shiba head with 100% seamless continuous Ear + Head contour!
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(headTilt);

    // Pass 1: Unified outer stroke for ears + G1-smooth round head (zero seam at ear bases!)
    drawDaisyEarStroke(-1, state.leftEarKick);
    drawDaisyEarStroke(1, state.rightEarKick);
    defineDaisyHeadPath();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW * 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Pass 2: Seamless interior fills
    drawDaisyEarFill(-1, state.leftEarKick);
    drawDaisyEarFill(1, state.rightEarKick);

    defineDaisyHeadPath();
    const headGrad = ctx.createRadialGradient(-22, -52, 16, 0, 0, 134);
    headGrad.addColorStop(0, '#FDE290');
    headGrad.addColorStop(0.52, '#F9C962');
    headGrad.addColorStop(1, '#ECB046');
    ctx.fillStyle = headGrad;
    ctx.fill();

    // Wide milky-white Shiba face (白面!) smoothly sweeping across round cheeks
    ctx.save();
    defineDaisyHeadPath();
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.bezierCurveTo(22, -40, 72, -38, 118, 10);
    ctx.lineTo(120, 112);
    ctx.lineTo(-120, 112);
    ctx.lineTo(-118, 10);
    ctx.bezierCurveTo(-72, -38, -22, -40, 0, -18);
    ctx.closePath();

    const faceGrad = ctx.createLinearGradient(0, -34, 0, 96);
    faceGrad.addColorStop(0, '#FFFFFF');
    faceGrad.addColorStop(0.82, '#FFFDF9');
    faceGrad.addColorStop(1, '#F7EFE5');
    ctx.fillStyle = faceGrad;
    ctx.fill();

    // Cute cream oval Shiba eyebrow dots on the round golden forehead
    ctx.fillStyle = '#FFFDF8';
    ctx.beginPath();
    ctx.ellipse(-36, -48, 10, 5.6, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(36, -48, 10, 5.6, 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // end head clip

    drawDaisyFaceFeatures();
    ctx.restore();
  }

  // =========================================================================
  // Character 1: 🐕 红巾小柴 (Glossy-Eyed Red Bandana Shiba)
  // =========================================================================
  function defineTailPath() {
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.bezierCurveTo(38, 22, 88, -2, 90, -46);
    ctx.bezierCurveTo(92, -78, 60, -98, 34, -84);
    ctx.bezierCurveTo(16, -72, 14, -48, 30, -40);
    ctx.bezierCurveTo(42, -34, 46, -48, 36, -52);
    ctx.bezierCurveTo(48, -56, 60, -42, 50, -24);
    ctx.bezierCurveTo(38, -4, 14, -2, -6, -12);
    ctx.closePath();
  }

  function drawShibaTail(baseX, baseY) {
    const style = getCharStyle();
    const wagAmp = 0.18 + state.excitement * 0.28;
    const wag = Math.sin(state.tailPhase) * wagAmp;

    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(0.08 + wag);

    defineTailPath();
    ctx.save();
    const tGrad = ctx.createLinearGradient(0, 14, 78, -82);
    tGrad.addColorStop(0, '#E29028');
    tGrad.addColorStop(0.55, '#F4AE46');
    tGrad.addColorStop(1, '#FBC76E');
    ctx.fillStyle = tGrad;
    ctx.fill();
    ctx.clip();

    ctx.fillStyle = '#FFFDF7';
    ctx.beginPath();
    ctx.arc(48, -72, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    defineTailPath();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
  }

  function defineShibaEarPath(side) {
    ctx.beginPath();
    ctx.moveTo(side * -30, 20);
    ctx.bezierCurveTo(side * -24, -26, side * 2, -60, side * 24, -52);
    ctx.bezierCurveTo(side * 46, -42, side * 46, 6, side * 30, 38);
    ctx.closePath();
  }

  function drawShibaEarStroke(side, kick) {
    const style = getCharStyle();
    ctx.save();
    ctx.translate(side * 68, -52);
    ctx.rotate(side * (0.28 + kick * 0.15));
    defineShibaEarPath(side);
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW * 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawShibaEarFill(side, kick) {
    ctx.save();
    ctx.translate(side * 68, -52);
    ctx.rotate(side * (0.28 + kick * 0.15));

    defineShibaEarPath(side);
    const earGrad = ctx.createLinearGradient(0, -56, 0, 30);
    earGrad.addColorStop(0, '#FBC86C');
    earGrad.addColorStop(0.6, '#F2AA42');
    earGrad.addColorStop(1, '#DE8C26');
    ctx.fillStyle = earGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(side * -12, 16);
    ctx.bezierCurveTo(side * -6, -14, side * 8, -34, side * 19, -29);
    ctx.bezierCurveTo(side * 30, -24, side * 30, 4, side * 19, 24);
    ctx.closePath();
    ctx.fillStyle = '#FFB8B0';
    ctx.fill();

    ctx.fillStyle = '#FFFDF8';
    ctx.beginPath();
    ctx.ellipse(side * 2, 19, 12, 7.5, side * -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(side * 12, 23, 9, 6, side * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function defineSittingTorsoPath(bodyX, breath) {
    const topY = 242 + breath * 0.6;
    const botY = 398;
    ctx.beginPath();
    ctx.moveTo(bodyX, topY);
    ctx.bezierCurveTo(bodyX + 68, topY, bodyX + 106, topY + 46, bodyX + 108, 338 + breath * 0.25);
    ctx.bezierCurveTo(bodyX + 110, 380, bodyX + 86, botY, bodyX + 42, botY + 4);
    ctx.bezierCurveTo(bodyX + 12, botY + 8, bodyX - 12, botY + 8, bodyX - 42, botY + 4);
    ctx.bezierCurveTo(bodyX - 86, botY, bodyX - 110, 380, bodyX - 108, 338 + breath * 0.25);
    ctx.bezierCurveTo(bodyX - 106, topY + 46, bodyX - 68, topY, bodyX, topY);
    ctx.closePath();
  }

  function defineMochiHeadPath() {
    // Super round, 100% G1-continuous circular mochi Shiba head (圆滚滚的连贯圆脸!)
    ctx.beginPath();
    ctx.moveTo(0, -90);
    ctx.bezierCurveTo(64, -90, 111, -48, 111, 4);
    ctx.bezierCurveTo(111, 58, 66, 95, 0, 95);
    ctx.bezierCurveTo(-66, 95, -111, 58, -111, 4);
    ctx.bezierCurveTo(-111, -48, -64, -90, 0, -90);
    ctx.closePath();
  }

  function drawTuckedFoot(x, y, rot) {
    const style = getCharStyle();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 11.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFDF8';
    ctx.fill();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  function defineBandanaPath() {
    ctx.beginPath();
    ctx.moveTo(-66, -10);
    ctx.quadraticCurveTo(0, 14, 66, -10);
    ctx.quadraticCurveTo(70, 4, 58, 12);
    ctx.quadraticCurveTo(32, 22, 20, 24);
    ctx.quadraticCurveTo(8, 44, 0, 46);
    ctx.quadraticCurveTo(-8, 44, -20, 24);
    ctx.quadraticCurveTo(-32, 22, -58, 12);
    ctx.quadraticCurveTo(-70, 4, -66, -10);
    ctx.closePath();
  }

  function drawShibaBandana(cx, cy, leanX) {
    const style = getCharStyle();
    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = 'rgba(130, 74, 24, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 62, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    defineBandanaPath();
    const bandGrad = ctx.createLinearGradient(0, -10, 0, 46);
    bandGrad.addColorStop(0, '#F26B56');
    bandGrad.addColorStop(0.55, '#E4523E');
    bandGrad.addColorStop(1, '#C93D2B');
    ctx.fillStyle = bandGrad;
    ctx.fill();
    ctx.clip();

    ctx.fillStyle = 'rgba(255, 246, 232, 0.34)';
    ctx.beginPath();
    ctx.arc(-32, 11, 3.2, 0, Math.PI * 2);
    ctx.arc(32, 11, 3.2, 0, Math.PI * 2);
    ctx.arc(0, 34, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    defineBandanaPath();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.stroke();

    const bx = leanX * 0.12;
    const by = 18;
    ctx.beginPath();
    ctx.arc(bx, by, 10.5, 0, Math.PI * 2);
    const bellGrad = ctx.createRadialGradient(bx - 3.5, by - 3.5, 1.5, bx, by, 11);
    bellGrad.addColorStop(0, '#FFF5B8');
    bellGrad.addColorStop(0.5, '#FFD358');
    bellGrad.addColorStop(1, '#DD9C22');
    ctx.fillStyle = bellGrad;
    ctx.fill();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx - 7.5, by + 2);
    ctx.quadraticCurveTo(bx, by + 5, bx + 7.5, by + 2);
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = style.outline;
    ctx.beginPath();
    ctx.arc(bx, by + 4.8, 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawShibaCharacter() {
    const style = getCharStyle();
    const breath = Math.sin(state.time * 2.5) * 3.0;
    const bodyX = DOG_BASE_X + state.dogLeanX;
    const headX = bodyX + state.lookX * 4;
    const headY = 186 + breath + state.headBounce * 4.5;
    const headTilt = clamp(-0.015 + state.dogLeanX * 0.0022 + state.lookX * 0.04, -0.1, 0.1);

    drawShibaTail(bodyX + 88, 340 + breath * 0.35);
    drawTuckedFoot(bodyX - 54, 394, -0.12);
    drawTuckedFoot(bodyX + 54, 398, 0.12);

    ctx.save();
    defineSittingTorsoPath(bodyX, breath);
    const bodyGrad = ctx.createRadialGradient(bodyX - 24, 271, 20, bodyX, 331, 145);
    bodyGrad.addColorStop(0, '#FBC96E');
    bodyGrad.addColorStop(0.55, '#F2AA40');
    bodyGrad.addColorStop(1, '#DF8F26');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.save();
    defineSittingTorsoPath(bodyX, breath);
    ctx.clip();

    ctx.fillStyle = 'rgba(182, 98, 16, 0.14)';
    ctx.beginPath();
    ctx.ellipse(bodyX + 94, 338, 34, 72, -0.1, 0, Math.PI * 2);
    ctx.fill();

    const bellyGrad = ctx.createLinearGradient(bodyX, 250, bodyX, 402);
    bellyGrad.addColorStop(0, '#FFFFFF');
    bellyGrad.addColorStop(0.75, '#FFFDF8');
    bellyGrad.addColorStop(1, '#F3E7D6');
    ctx.fillStyle = bellyGrad;
    ctx.beginPath();
    ctx.ellipse(bodyX, 332 + breath * 0.3, 64, 88, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    defineSittingTorsoPath(bodyX, breath);
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    drawShibaBandana(bodyX, 276 + breath * 0.75, state.dogLeanX);

    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(headTilt);

    const defineHairTuftPath = () => {
      ctx.beginPath();
      ctx.moveTo(-6, -89);
      ctx.quadraticCurveTo(-2, -103, 9, -98);
      ctx.quadraticCurveTo(4, -91, 8, -89);
      ctx.closePath();
    };

    // Pass 1: Unified outer stroke for ears + hair tuft + G1-smooth round head (zero seam!)
    drawShibaEarStroke(-1, state.leftEarKick);
    drawShibaEarStroke(1, state.rightEarKick);
    defineHairTuftPath();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW * 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    defineMochiHeadPath();
    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW * 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Pass 2: Seamless interior fills
    drawShibaEarFill(-1, state.leftEarKick);
    drawShibaEarFill(1, state.rightEarKick);
    defineHairTuftPath();
    ctx.fillStyle = '#FBC86B';
    ctx.fill();

    defineMochiHeadPath();
    const headGrad = ctx.createRadialGradient(-24, -52, 16, 0, 0, 134);
    headGrad.addColorStop(0, '#FDD37C');
    headGrad.addColorStop(0.5, '#F4AE44');
    headGrad.addColorStop(1, '#E09128');
    ctx.fillStyle = headGrad;
    ctx.fill();

    ctx.save();
    defineMochiHeadPath();
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.bezierCurveTo(22, -46, 72, -42, 116, 10);
    ctx.lineTo(120, 112);
    ctx.lineTo(-120, 112);
    ctx.lineTo(-116, 10);
    ctx.bezierCurveTo(-72, -42, -22, -46, 0, -24);
    ctx.closePath();

    const faceGrad = ctx.createLinearGradient(0, -40, 0, 96);
    faceGrad.addColorStop(0, '#FFFFFF');
    faceGrad.addColorStop(0.8, '#FFFDF9');
    faceGrad.addColorStop(1, '#F6ECE0');
    ctx.fillStyle = faceGrad;
    ctx.fill();

    ctx.fillStyle = '#FFFDF8';
    ctx.beginPath();
    ctx.ellipse(-34, -52, 10.5, 5.8, -0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(34, -52, 10.5, 5.8, 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 245, 215, 0.52)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -10, 74, -Math.PI * 0.68, -Math.PI * 0.32);
    ctx.stroke();
    ctx.restore();

    drawShibaFaceFeatures();
    ctx.restore();
  }

  function drawShibaFaceFeatures() {
    const style = getCharStyle();
    const fx = state.lookX * 5.5;
    const fy = state.lookY * 4.0;

    ctx.save();
    ctx.translate(fx, fy);

    const blushStrength = 0.48 + state.excitement * 0.22;
    for (const side of [-1, 1]) {
      const bx = side * 68;
      const by = 22;
      const bGrad = ctx.createRadialGradient(bx, by, 2, bx, by, 22);
      bGrad.addColorStop(0, `rgba(255, 134, 150, ${blushStrength.toFixed(3)})`);
      bGrad.addColorStop(1, 'rgba(255, 134, 150, 0)');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.ellipse(bx, by, 23, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx - 5, by - 3);
      ctx.lineTo(bx - 2, by + 3);
      ctx.moveTo(bx + 2, by - 3);
      ctx.lineTo(bx + 5, by + 3);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(235, 214, 188, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-14, 34, 21, 13, 0.08, 0, Math.PI * 2);
    ctx.ellipse(14, 34, 21, 13, -0.08, 0, Math.PI * 2);
    ctx.fill();

    const blinkAmount = state.blinkProgress > 0 ? Math.sin(state.blinkProgress) : 0;
    const isHappy = state.happyEyesTimer > 0;
    drawKawaiiEye(-43, 2, blinkAmount, isHappy);
    drawKawaiiEye(43, 2, blinkAmount, isHappy);

    const mouthOpen = clamp((state.excitement - 0.32) * 1.6, 0, 1);
    if (mouthOpen > 0.14) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-12, 29);
      ctx.quadraticCurveTo(0, 33, 12, 29);
      ctx.bezierCurveTo(11, 44 + mouthOpen * 9, -11, 44 + mouthOpen * 9, -12, 29);
      ctx.closePath();
      ctx.fillStyle = '#923A46';
      ctx.fill();
      ctx.clip();

      ctx.fillStyle = '#FF92A5';
      ctx.beginPath();
      ctx.ellipse(0, 42 + mouthOpen * 4, 8.8, 7 + mouthOpen * 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = style.outline;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, 29);
      ctx.bezierCurveTo(-10, 42 + mouthOpen * 8, 10, 42 + mouthOpen * 8, 12, 29);
      ctx.stroke();
    }

    ctx.strokeStyle = style.outline;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(0, 27);
    ctx.moveTo(0, 27);
    ctx.bezierCurveTo(-4, 34, -13, 35, -17, 28);
    ctx.moveTo(0, 27);
    ctx.bezierCurveTo(4, 34, 13, 35, 17, 28);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.bezierCurveTo(8.5, 12.6, 10.8, 17.8, 6.2, 22);
    ctx.quadraticCurveTo(0, 25.2, -6.2, 22);
    ctx.bezierCurveTo(-10.8, 17.8, -8.5, 12.6, 0, 13);
    ctx.closePath();
    ctx.fillStyle = '#3C2114';
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.beginPath();
    ctx.ellipse(-2.8, 16, 2.8, 1.5, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawKawaiiEye(x, y, blinkAmount, isHappy) {
    ctx.save();
    ctx.translate(x, y);

    if (isHappy) {
      ctx.strokeStyle = '#382012';
      ctx.lineWidth = 3.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 4, 11.5, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (blinkAmount > 0.72) {
      ctx.strokeStyle = '#382012';
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, 2);
      ctx.quadraticCurveTo(0, 8, 12, 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const scaleY = Math.max(0.14, 1 - blinkAmount * 0.92);
    ctx.scale(1, scaleY);

    const gx = state.lookX * 3.0;
    const gy = state.lookY * 2.2;

    ctx.fillStyle = '#2B170D';
    ctx.beginPath();
    ctx.ellipse(gx, gy, 14.8, 16.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const irisGrad = ctx.createRadialGradient(gx, gy + 7, 1, gx, gy + 6, 12);
    irisGrad.addColorStop(0, 'rgba(248, 186, 76, 0.9)');
    irisGrad.addColorStop(0.6, 'rgba(176, 98, 28, 0.5)');
    irisGrad.addColorStop(1, 'rgba(43, 23, 13, 0)');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(gx, gy + 6, 10.8, 7.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1D0F08';
    ctx.beginPath();
    ctx.arc(gx, gy - 0.5, 7.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(gx - 4.6, gy - 5.4, 5.2, 4.5, -0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(gx + 5.0, gy + 4.8, 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // =========================================================================
  // Sleek Compact Keyboard (Cozy Pastel-Slate for 'daisy', Charcoal for 'shiba')
  // =========================================================================
  function drawKeyboard() {
    const isDaisy = currentChar === 'daisy';
    ctx.save();
    ctx.translate(KB.cx, KB.cy);
    ctx.rotate(KB.angle);

    const hw = KB.w * 0.5;
    const hh = KB.h * 0.5;

    ctx.fillStyle = isDarkTheme ? 'rgba(0, 0, 0, 0.42)' : 'rgba(66, 98, 144, 0.22)';
    roundRectPath(ctx, -hw + 2, -hh + 8, KB.w, KB.h, 15);
    ctx.fill();

    roundRectPath(ctx, -hw, -hh + 4, KB.w, KB.h, 14);
    ctx.fillStyle = isDaisy ? '#5A5E6C' : '#15171D';
    ctx.fill();

    roundRectPath(ctx, -hw, -hh, KB.w, KB.h - 2, 14);
    const frameGrad = ctx.createLinearGradient(0, -hh, 0, hh);
    if (isDaisy) {
      frameGrad.addColorStop(0, '#858B9D');
      frameGrad.addColorStop(1, '#6C7182');
    } else {
      frameGrad.addColorStop(0, '#2C2F38');
      frameGrad.addColorStop(1, '#1E2027');
    }
    ctx.fillStyle = frameGrad;
    ctx.fill();

    ctx.strokeStyle = isDaisy ? '#5C483B' : 'rgba(255, 255, 255, 0.11)';
    ctx.lineWidth = isDaisy ? 2.6 : 1.4;
    ctx.stroke();

    roundRectPath(ctx, -hw + 7, -hh + 7, KB.w - 14, KB.h - 16, 9);
    ctx.fillStyle = isDaisy ? '#5D6271' : '#14161B';
    ctx.fill();

    for (const k of keysList) {
      drawKeycap(k, isDaisy);
    }

    ctx.restore();
  }

  function drawKeycap(k, isDaisy) {
    const pressOffset = k.press * 2.6;
    const glow = k.glow;

    ctx.save();

    if (glow > 0.04) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 162, 42, 0.9)';
      ctx.shadowBlur = 13 * glow;
      roundRectPath(ctx, k.lx - 0.5, k.ly + pressOffset - 0.5, k.w + 1, k.h, 5.5);
      ctx.fillStyle = `rgba(255, 174, 58, ${(0.55 * glow).toFixed(3)})`;
      ctx.fill();
      ctx.restore();
    }

    roundRectPath(ctx, k.lx, k.ly + 1.5, k.w, k.h - 0.5, 4.8);
    ctx.fillStyle = glow > 0.12 ? '#D97412' : k.accent ? '#DE8A24' : isDaisy ? '#D5CFC6' : '#CFD5DF';
    ctx.fill();

    const capH = Math.max(8, k.h - 3.6);
    roundRectPath(ctx, k.lx + 0.4, k.ly + pressOffset, k.w - 0.8, capH, 4.4);

    if (glow > 0.06) {
      const g = ctx.createLinearGradient(k.lx, k.ly + pressOffset, k.lx, k.ly + pressOffset + capH);
      g.addColorStop(0, '#FFD470');
      g.addColorStop(1, '#FF9424');
      ctx.fillStyle = g;
    } else if (k.accent) {
      const ag = ctx.createLinearGradient(k.lx, k.ly, k.lx, k.ly + capH);
      ag.addColorStop(0, isDaisy ? '#FFC05C' : '#FFAE38');
      ag.addColorStop(1, isDaisy ? '#F5A032' : '#F2911D');
      ctx.fillStyle = ag;
    } else {
      ctx.fillStyle = isDaisy ? '#FFFDF9' : '#F7F8FA';
    }
    ctx.fill();

    if (isDaisy) {
      ctx.strokeStyle = 'rgba(104, 82, 66, 0.32)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    roundRectPath(ctx, k.lx + 2, k.ly + pressOffset + 1, k.w - 4, 2.2, 1.5);
    ctx.fill();

    if (k.label) {
      const fontSize = k.label.length >= 4 ? 7.8 : k.label.length >= 2 ? 8.6 : 9.6;
      ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = glow > 0.25 ? '#3F1D04' : k.accent ? '#FFFFFF' : isDaisy ? '#5A4639' : '#2E323D';
      ctx.fillText(k.label, k.lcx, k.ly + pressOffset + capH * 0.54);
    }

    ctx.restore();
  }

  // =========================================================================
  // Sleek Pearl-White Mouse Beside Left Hip (L/R Buttons 100% Exposed!)
  // =========================================================================
  function defineMouseShellPath(hw, hh) {
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.bezierCurveTo(hw * 0.88, -hh, hw, -hh * 0.55, hw, 0);
    ctx.bezierCurveTo(hw, hh * 0.62, hw * 0.86, hh, 0, hh);
    ctx.bezierCurveTo(-hw * 0.86, hh, -hw, hh * 0.62, -hw, 0);
    ctx.bezierCurveTo(-hw, -hh * 0.55, -hw * 0.88, -hh, 0, -hh);
    ctx.closePath();
  }

  function drawMouse() {
    const isDaisy = currentChar === 'daisy';
    const hw = MOUSE_SIZE.w * 0.5;
    const hh = MOUSE_SIZE.h * 0.5;
    const splitY = 2;

    ctx.save();
    ctx.translate(state.mouseX, state.mouseY);
    ctx.rotate(state.mouseTilt);

    ctx.fillStyle = isDarkTheme ? 'rgba(0, 0, 0, 0.42)' : 'rgba(66, 98, 144, 0.22)';
    ctx.beginPath();
    ctx.ellipse(2, 7, hw * 1.04, hh * 0.98, 0, 0, Math.PI * 2);
    ctx.fill();

    if (state.leftGlow > 0.04) {
      const lAura = ctx.createRadialGradient(-hw * 0.45, hh * 0.45, 4, -hw * 0.45, hh * 0.45, 62);
      lAura.addColorStop(0, `rgba(255, 120, 73, ${(0.72 * state.leftGlow).toFixed(3)})`);
      lAura.addColorStop(1, 'rgba(255, 120, 73, 0)');
      ctx.fillStyle = lAura;
      ctx.beginPath();
      ctx.arc(-hw * 0.45, hh * 0.45, 62, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.rightGlow > 0.04) {
      const rAura = ctx.createRadialGradient(hw * 0.45, hh * 0.45, 4, hw * 0.45, hh * 0.45, 62);
      rAura.addColorStop(0, `rgba(56, 189, 248, ${(0.72 * state.rightGlow).toFixed(3)})`);
      rAura.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = rAura;
      ctx.beginPath();
      ctx.arc(hw * 0.45, hh * 0.45, 62, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    defineMouseShellPath(hw, hh);
    ctx.clip();

    const bodyGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
    bodyGrad.addColorStop(0, '#FFFFFF');
    bodyGrad.addColorStop(0.6, isDaisy ? '#FFFDF9' : '#F2F4F8');
    bodyGrad.addColorStop(1, isDaisy ? '#E8E3DC' : '#DCE1EA');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(-hw - 4, -hh - 4, hw * 2 + 8, hh * 2 + 8);

    // LEFT BUTTON (Bottom-Left Half)
    ctx.save();
    ctx.beginPath();
    ctx.rect(-hw - 4, splitY, hw + 4, hh - splitY + 4);
    ctx.clip();
    if (state.leftGlow > 0.02) {
      const lg = ctx.createLinearGradient(-hw, splitY, 0, hh);
      lg.addColorStop(0, `rgba(255, 152, 108, ${state.leftGlow.toFixed(3)})`);
      lg.addColorStop(0.55, `rgba(255, 114, 68, ${state.leftGlow.toFixed(3)})`);
      lg.addColorStop(1, `rgba(235, 78, 42, ${state.leftGlow.toFixed(3)})`);
      ctx.fillStyle = lg;
      ctx.fillRect(-hw - 4, splitY, hw + 4, hh - splitY + 4);

      ctx.fillStyle = `rgba(255, 255, 255, ${(0.32 * state.leftGlow).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(-hw * 0.48, hh * 0.46, 11, 17, -0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // RIGHT BUTTON (Bottom-Right Half)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, splitY, hw + 4, hh - splitY + 4);
    ctx.clip();
    if (state.rightGlow > 0.02) {
      const rg = ctx.createLinearGradient(0, splitY, hw, hh);
      rg.addColorStop(0, `rgba(122, 222, 255, ${state.rightGlow.toFixed(3)})`);
      rg.addColorStop(0.55, `rgba(56, 189, 248, ${state.rightGlow.toFixed(3)})`);
      rg.addColorStop(1, `rgba(14, 146, 224, ${state.rightGlow.toFixed(3)})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, splitY, hw + 4, hh - splitY + 4);

      ctx.fillStyle = `rgba(255, 255, 255, ${(0.34 * state.rightGlow).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(hw * 0.48, hh * 0.46, 11, 17, 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = isDaisy ? 'rgba(110, 80, 56, 0.5)' : 'rgba(54, 62, 78, 0.52)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-hw, splitY);
    ctx.quadraticCurveTo(0, splitY - 3, hw, splitY);
    ctx.moveTo(0, splitY - 1);
    ctx.lineTo(0, hh);
    ctx.stroke();

    ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = state.leftGlow > 0.35 ? '#FFFFFF' : 'rgba(72, 65, 62, 0.5)';
    ctx.fillText('L', -hw * 0.54, hh * 0.46);

    ctx.fillStyle = state.rightGlow > 0.35 ? '#FFFFFF' : 'rgba(72, 65, 62, 0.5)';
    ctx.fillText('R', hw * 0.54, hh * 0.46);

    ctx.restore();

    defineMouseShellPath(hw, hh);
    ctx.strokeStyle = isDaisy ? '#6E5341' : '#3B4150';
    ctx.lineWidth = isDaisy ? 3.0 : 2.6;
    ctx.stroke();

    if (state.leftGlow > 0.1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-hw - 6, splitY, hw + 6, hh - splitY + 6);
      ctx.clip();
      defineMouseShellPath(hw, hh);
      ctx.strokeStyle = `rgba(255, 114, 68, ${state.leftGlow.toFixed(3)})`;
      ctx.lineWidth = 3.8;
      ctx.stroke();
      ctx.restore();
    }
    if (state.rightGlow > 0.1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, splitY, hw + 6, hh - splitY + 6);
      ctx.clip();
      defineMouseShellPath(hw, hh);
      ctx.strokeStyle = `rgba(42, 184, 248, ${state.rightGlow.toFixed(3)})`;
      ctx.lineWidth = 3.8;
      ctx.stroke();
      ctx.restore();
    }

    // Center scroll wheel
    const wheelW = 12;
    const wheelH = 24;
    const wheelX = -wheelW * 0.5;
    const wheelY = 12;

    roundRectPath(ctx, wheelX - 2, wheelY - 2, wheelW + 4, wheelH + 4, 6);
    ctx.fillStyle = '#D2D7E0';
    ctx.fill();

    roundRectPath(ctx, wheelX, wheelY, wheelW, wheelH, 5.5);
    ctx.fillStyle = state.middleGlow > 0.15 ? '#A78BFA' : isDaisy ? '#6F7482' : '#3C4250';
    ctx.fill();
    ctx.strokeStyle = isDaisy ? '#5A4538' : '#252933';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.save();
    roundRectPath(ctx, wheelX + 1.5, wheelY + 2, wheelW - 3, wheelH - 4, 3);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.4;
    const step = 5;
    const shift = ((state.wheelOffset % step) + step) % step;
    for (let y = wheelY - step + shift; y < wheelY + wheelH + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(wheelX + 2, y);
      ctx.lineTo(wheelX + wheelW - 2, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  // =========================================================================
  // Plush Seamless Puppy Arms & Round White Sock-Paws
  // =========================================================================
  function drawPlushPaw({ sx, sy, px, py, side, press, lift }) {
    const style = getCharStyle();
    const dx = px - sx;
    const dy = py - sy;
    const len = Math.max(1, Math.hypot(dx, dy));
    const bend = side * Math.min(26, len * 0.22);
    const cx = (sx + px) * 0.5 + bend;
    const cy = (sy + py) * 0.5 + 8;

    const endDx = px - cx;
    const endDy = py - cy;
    const angle = Math.atan2(endDy, endDx);
    const squashX = 1 + press * 0.1 - lift * 0.04;
    const squashY = 1 - press * 0.08 + lift * 0.07;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.beginPath();
    ctx.ellipse(px, py + 7 + lift * 10, 22 * (1 - lift * 0.2), 13 * (1 - lift * 0.2), 0, 0, Math.PI * 2);
    ctx.fill();

    const sAngle = Math.atan2(cy - sy, cx - sx);
    const snx = -Math.sin(sAngle);
    const sny = Math.cos(sAngle);
    const enx = -Math.sin(angle);
    const eny = Math.cos(angle);
    const mnx = (snx + enx) * 0.5;
    const mny = (sny + eny) * 0.5;
    const mLen = Math.hypot(mnx, mny) || 1;
    const mnux = mnx / mLen;
    const mnuy = mny / mLen;

    const rShoulder = 20;
    const rMid = 17.5;
    const rWrist = 16;

    const sLx = sx + snx * rShoulder, sLy = sy + sny * rShoulder;
    const sRx = sx - snx * rShoulder, sRy = sy - sny * rShoulder;
    const mLx = cx + mnux * rMid,     mLy = cy + mnuy * rMid;
    const mRx = cx - mnux * rMid,     mRy = cy - mnuy * rMid;
    const wLx = px + enx * rWrist,    wLy = py + eny * rWrist;
    const wRx = px - enx * rWrist,    wRy = py - eny * rWrist;

    // 1. Unified outer contour pass (paw outer shell + arm outer edges)
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle - Math.PI * 0.5);
    ctx.scale(squashX, squashY);
    ctx.beginPath();
    ctx.ellipse(0, 4, 23, 20.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = style.outline;
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = style.outline;
    ctx.lineWidth = style.outlineW * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sLx, sLy);
    ctx.quadraticCurveTo(mLx, mLy, wLx, wLy);
    ctx.moveTo(sRx, sRy);
    ctx.quadraticCurveTo(mRx, mRy, wRx, wRy);
    ctx.stroke();

    // 2. Plush golden arm body fill
    const armGrad = ctx.createLinearGradient(sx, sy, px, py);
    armGrad.addColorStop(0, style.armStart);
    armGrad.addColorStop(1, style.armEnd);
    ctx.fillStyle = armGrad;
    ctx.beginPath();
    ctx.moveTo(sLx, sLy);
    ctx.quadraticCurveTo(mLx, mLy, wLx, wLy);
    ctx.lineTo(wRx, wRy);
    ctx.quadraticCurveTo(mRx, mRy, sRx, sRy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = style.shoulderBlend;
    ctx.beginPath();
    ctx.ellipse(sx - side * 5, sy - 2, 23, 19, side * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 3. Plump white puppy sock-paw fill inside unified outline
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle - Math.PI * 0.5);
    ctx.scale(squashX, squashY);

    ctx.beginPath();
    ctx.ellipse(0, 4, 20.2, 17.6, 0, 0, Math.PI * 2);
    const pawGrad = ctx.createRadialGradient(-4, -2, 2, 0, 4, 21);
    pawGrad.addColorStop(0, '#FFFFFF');
    pawGrad.addColorStop(0.75, '#FFFDF8');
    pawGrad.addColorStop(1, '#EFE4D6');
    ctx.fillStyle = pawGrad;
    ctx.fill();

    ctx.strokeStyle = style.outline;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6.5, 13);
    ctx.lineTo(-7, 20);
    ctx.moveTo(6.5, 13);
    ctx.lineTo(7, 20);
    ctx.stroke();

    if (lift > 0.28) {
      const ba = clamp((lift - 0.28) * 1.6, 0, 0.85);
      ctx.fillStyle = `rgba(255, 152, 166, ${ba.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(0, 8, 6.2, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-7.5, 15, 2.7, 0, Math.PI * 2);
      ctx.arc(0, 16.5, 2.9, 0, Math.PI * 2);
      ctx.arc(7.5, 15, 2.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }

  function drawPuppyPaws() {
    const bodyX = DOG_BASE_X + state.dogLeanX;
    const breath = Math.sin(state.time * 2.5) * 2.4;

    const lp = state.leftPaw;
    const lpLiftPx = lp.lift * 18;
    drawPlushPaw({
      sx: bodyX - 84,
      sy: 312 + breath * 0.5,
      px: lp.x,
      py: lp.y - lpLiftPx,
      side: -1,
      press: lp.press,
      lift: lp.lift,
    });

    const rp = state.rightPaw;
    const rpLiftPx = rp.lift * 18;

    if (rp.ghostAlpha > 0.03) {
      ctx.save();
      ctx.globalAlpha = rp.ghostAlpha * 0.42;
      ctx.fillStyle = '#FFFDF8';
      ctx.beginPath();
      ctx.ellipse(rp.prevX, rp.prevY - 8, 17, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawPlushPaw({
      sx: bodyX + 84,
      sy: 312 + breath * 0.5,
      px: rp.x,
      py: rp.y - rpLiftPx,
      side: 1,
      press: rp.press,
      lift: rp.lift,
    });
  }

  // =========================================================================
  // Ripples, Sparkles, Mouse Badges & Enlarged Keycap Popups
  // =========================================================================
  function drawEffects() {
    for (const r of state.ripples) {
      const t = r.life / r.maxLife;
      const radius = 8 + easeOutCubic(t) * r.maxRadius;
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - t) * 0.78;
      ctx.lineWidth = 2.8 * (1 - t * 0.55);
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const pt of state.particles) {
      const t = pt.life / pt.maxLife;
      const alpha = 1 - easeOutCubic(t);
      const sz = pt.size * (1 - t * 0.45);
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 === 0 ? sz : sz * 0.42;
        const a = (i * Math.PI) / 4;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const b of state.mouseBadges) {
      const t = b.life / b.maxLife;
      const pop = t < 0.2 ? easeOutBack(t / 0.2) : 1;
      const fade = t > 0.45 ? 1 - easeOutCubic((t - 0.45) / 0.55) : 1;
      const drift = easeOutCubic(t) * 18;

      ctx.save();
      ctx.translate(b.x, b.y + drift);
      ctx.scale(pop, pop);
      ctx.globalAlpha = fade;

      const bw = 52;
      const bh = 24;
      roundRectPath(ctx, -bw * 0.5, -bh * 0.5, bw, bh, 12);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(b.text, 0, 0.5);
      ctx.restore();
    }
  }

  function drawEnlargedKeyPopups() {
    for (const p of state.popups) {
      const enterT = clamp(p.age / 0.16, 0, 1);
      const enterScale = 0.38 + easeOutBack(enterT) * 0.62;
      const fadeT = easeOutCubic(p.fadeProgress);

      const alpha = clamp(enterT * 2.5, 0, 1) * (1 - fadeT);
      if (alpha <= 0.005) continue;

      const floatUp = fadeT * 44;
      const scale = enterScale * (1 + p.pulse * 0.08 + fadeT * 0.07);

      if (p.age < 0.22) {
        const trailAlpha = (1 - p.age / 0.22) * 0.3;
        ctx.save();
        const tg = ctx.createLinearGradient(p.startX, p.startY, p.x, p.y - floatUp);
        tg.addColorStop(0, 'rgba(255, 186, 82, 0)');
        tg.addColorStop(1, 'rgba(255, 186, 82, 0.8)');
        ctx.strokeStyle = tg;
        ctx.globalAlpha = trailAlpha;
        ctx.lineWidth = 6.5 * (1 - p.age / 0.22);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.startX, p.startY);
        ctx.lineTo(p.x, p.y - floatUp);
        ctx.stroke();
        ctx.restore();
      }

      const hw = p.w * 0.5;
      const hh = p.h * 0.5;

      ctx.save();
      ctx.translate(p.x, p.y - floatUp);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;

      const glowR = Math.max(p.w, p.h) * 0.8;
      const halo = ctx.createRadialGradient(0, 0, 8, 0, 0, glowR);
      halo.addColorStop(0, p.isAccent ? 'rgba(255, 166, 54, 0.44)' : 'rgba(255, 226, 168, 0.4)');
      halo.addColorStop(1, 'rgba(255, 196, 98, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isDarkTheme ? 'rgba(0, 0, 0, 0.34)' : 'rgba(72, 102, 146, 0.24)';
      roundRectPath(ctx, -hw + 2, -hh + 10, p.w, p.h, 16);
      ctx.fill();

      roundRectPath(ctx, -hw, -hh + 5, p.w, p.h, 15);
      ctx.fillStyle = p.isAccent ? '#D67D15' : '#CFD6E0';
      ctx.fill();
      ctx.strokeStyle = p.isAccent ? '#995308' : '#7F8A9C';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      const topH = p.h - 9;
      roundRectPath(ctx, -hw + 1.5, -hh, p.w - 3, topH, 13.5);
      const topGrad = ctx.createLinearGradient(0, -hh, 0, -hh + topH);
      if (p.isAccent) {
        topGrad.addColorStop(0, '#FFC566');
        topGrad.addColorStop(1, '#F59622');
      } else {
        topGrad.addColorStop(0, '#FFFFFF');
        topGrad.addColorStop(1, '#F4F6FA');
      }
      ctx.fillStyle = topGrad;
      ctx.fill();

      ctx.strokeStyle = p.isAccent ? 'rgba(255, 236, 198, 0.7)' : 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const fontSize = p.main.length >= 5 ? 21 : p.main.length >= 3 ? 25 : 34;
      ctx.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.isAccent ? '#FFFFFF' : '#2C2623';
      ctx.fillText(p.main, 0, -hh + topH * 0.52);

      ctx.restore();
    }
  }

  // =========================================================================
  // Main Render Loop
  // =========================================================================
  let lastTs = performance.now();

  function renderFrame(ts) {
    const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
    lastTs = ts;

    update(dt);

    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    drawBackdropFullViewport();

    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.scale, viewport.scale);

    drawGroundShadow();
    if (currentChar === 'daisy') {
      drawDaisyCharacter();
    } else {
      drawShibaCharacter();
    }
    drawKeyboard();
    drawMouse();
    drawPuppyPaws();
    drawEffects();
    drawEnlargedKeyPopups();

    ctx.restore();

    requestAnimationFrame(renderFrame);
  }

  requestAnimationFrame(renderFrame);
})();
