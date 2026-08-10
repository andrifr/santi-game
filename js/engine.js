/* =============================================================
   SANTI: THE GAME - shared engine
   Plain script (no modules) so it runs from file:// and GitHub
   Pages alike. Everything hangs off the global SG namespace.
   ============================================================= */
(function () {
  'use strict';

  var SG = (window.SG = {});

  // Virtual resolution. Height is fixed; width stretches with the
  // screen's aspect ratio so an iPhone (~2.16:1) fills edge to edge
  // instead of pillarboxing. 960 wide is guaranteed visible and
  // centred, so anything laid out relative to SG.W/2 is always safe.
  SG.H = 540;
  SG.W = 960;
  var W_MIN = 960, W_MAX = 1400;

  SG.FONT = '"Arial Black", "Arial Bold", "Avenir Next", "Helvetica Neue", system-ui, sans-serif';

  SG.COLORS = {
    ink: '#12142a',
    gold: '#ffb02e',
    red: '#e8202a',
    cream: '#fff4e0',
    green: '#4dd47a',
    purple: '#7c4dff',
    sauce: '#d9501f',
  };

  // ---------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------
  SG.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  SG.lerp = function (a, b, t) { return a + (b - a) * t; };
  SG.rand = function (a, b) { return a + Math.random() * (b - a); };
  SG.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  SG.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  SG.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // ---------------------------------------------------------------
  // Viewport
  // ---------------------------------------------------------------
  var app = document.getElementById('app');
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha: false });

  var view = (SG.view = { scale: 1, ox: 0, oy: 0, cssScale: 1, cssOx: 0, cssOy: 0, dpr: 1 });

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = app.clientWidth || window.innerWidth;
    var ch = app.clientHeight || window.innerHeight;

    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';

    SG.W = Math.round(SG.clamp(SG.H * (cw / ch), W_MIN, W_MAX));

    var s = Math.min(cw / SG.W, ch / SG.H);
    view.dpr = dpr;
    view.cssScale = s;
    view.cssOx = (cw - SG.W * s) / 2;
    view.cssOy = (ch - SG.H * s) / 2;
    view.scale = s * dpr;
    view.ox = view.cssOx * dpr;
    view.oy = view.cssOy * dpr;
  }
  SG.resize = resize;

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });

  // ---------------------------------------------------------------
  // Screen shake
  // ---------------------------------------------------------------
  var shake = { amt: 0 };
  SG.shake = function (a) { shake.amt = Math.max(shake.amt, a); };

  // ---------------------------------------------------------------
  // Input: pointers -> taps, swipes, holds. Plus keyboard for desktop.
  // ---------------------------------------------------------------
  var input = (SG.input = {
    keys: {},
    taps: [],      // {x, y} consumed by scenes
    swipes: [],    // 'left'|'right'|'up'|'down'
    pointers: {},  // active pointers by id
    anyDown: false,
    justPressed: false,
  });

  function toVirtual(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - view.cssOx) / view.cssScale,
      y: (clientY - r.top - view.cssOy) / view.cssScale,
    };
  }
  SG.toVirtual = toVirtual;

  var SWIPE_MIN = 26;      // px in virtual space
  var TAP_MAX_MOVE = 22;
  var TAP_MAX_TIME = 400;

  function onDown(id, cx, cy, kind) {
    var p = toVirtual(cx, cy);
    input.pointers[id] = {
      x: p.x, y: p.y, sx: p.x, sy: p.y,
      t0: performance.now(), fired: false,
      type: kind || 'touch',      // modes branch on mouse vs finger
    };
    input.anyDown = true;
    input.justPressed = true;
    SG.audio.unlock();
  }

  function onMove(id, cx, cy) {
    var pt = input.pointers[id];
    if (!pt) return;
    var p = toVirtual(cx, cy);
    pt.x = p.x;
    pt.y = p.y;
    if (pt.fired) return;
    var dx = p.x - pt.sx, dy = p.y - pt.sy;
    if (Math.abs(dx) > SWIPE_MIN || Math.abs(dy) > SWIPE_MIN) {
      // Fire the swipe as soon as the threshold is crossed - waiting for
      // touchend makes lane changes feel laggy.
      input.swipes.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      pt.fired = true;
    }
  }

  function onUp(id) {
    var pt = input.pointers[id];
    if (!pt) return;
    var dt = performance.now() - pt.t0;
    var moved = Math.hypot(pt.x - pt.sx, pt.y - pt.sy);
    if (!pt.fired && moved < TAP_MAX_MOVE && dt < TAP_MAX_TIME) input.taps.push({ x: pt.x, y: pt.y });
    delete input.pointers[id];
    input.anyDown = Object.keys(input.pointers).length > 0;
  }

  /* Drop every live touch. A pointer that goes down and never reports
     going up sticks in the map forever, and anything reading held input
     then behaves as if a finger were welded to the screen. Scene
     changes and backgrounding call this so there is always a way out
     without relaunching. */
  input.releaseAll = function () {
    for (var id in input.pointers) delete input.pointers[id];
    input.anyDown = false;
  };

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      // Capture, so move and up for this finger come back here even if it
      // wanders off the canvas or onto the fullscreen button. Without it
      // iOS delivers the release somewhere else and the touch never ends.
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      onDown(e.pointerId, e.clientX, e.clientY, e.pointerType);
    });
    canvas.addEventListener('pointermove', function (e) { onMove(e.pointerId, e.clientX, e.clientY); });
    canvas.addEventListener('pointerup', function (e) { onUp(e.pointerId); });
    canvas.addEventListener('pointercancel', function (e) { onUp(e.pointerId); });
    // Backstops: capture can be lost, and iOS can retarget a release.
    canvas.addEventListener('lostpointercapture', function (e) { onUp(e.pointerId); });
    window.addEventListener('pointerup', function (e) { onUp(e.pointerId); });
    window.addEventListener('pointercancel', function (e) { onUp(e.pointerId); });
  } else {
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; onDown(t.identifier, t.clientX, t.clientY); }
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; onMove(t.identifier, t.clientX, t.clientY); }
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) onUp(e.changedTouches[i].identifier);
    });
    canvas.addEventListener('touchcancel', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) onUp(e.changedTouches[i].identifier);
    });
    window.addEventListener('touchend', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) onUp(e.changedTouches[i].identifier);
    });
  }
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', Space: 'up',
    ArrowDown: 'down', KeyS: 'down',
  };
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    if (input.keys[e.code]) return; // ignore auto-repeat
    input.keys[e.code] = true;
    SG.audio.unlock();
    if (KEYMAP[e.code]) input.swipes.push(KEYMAP[e.code]);
    if (e.code === 'Enter' || e.code === 'Escape') input.taps.push({ x: -1, y: -1, key: e.code });
  });
  window.addEventListener('keyup', function (e) { input.keys[e.code] = false; });

  // Consume helpers -------------------------------------------------
  input.takeSwipe = function (dir) {
    var i = input.swipes.indexOf(dir);
    if (i < 0) return false;
    input.swipes.splice(i, 1);
    return true;
  };
  input.takeAnySwipe = function () { return input.swipes.shift() || null; };
  input.tappedRect = function (r) {
    for (var i = 0; i < input.taps.length; i++) {
      var t = input.taps[i];
      if (t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h) {
        input.taps.splice(i, 1);
        return true;
      }
    }
    return false;
  };
  input.takeTap = function () { return input.taps.shift() || null; };
  input.clear = function () { input.taps.length = 0; input.swipes.length = 0; };

  // ---------------------------------------------------------------
  // Audio - fully synthesized, zero asset weight.
  // ---------------------------------------------------------------
  var audio = (SG.audio = { ctx: null, enabled: true, ready: false });

  audio.unlock = function () {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.ready = true;
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      for (var k in audio.samples) decodeSample(k);   // anything preloaded
    } catch (e) { /* no audio, no problem */ }
  };

  /* ---- recorded samples (voice lines) ----
     Downloaded eagerly, decoded once the AudioContext exists - which on
     iOS can't happen until the first touch. Everything degrades to the
     synthesized cue if the file is missing or won't decode. */
  audio.samples = {};

  function decodeSample(key) {
    var s = audio.samples[key];
    if (!s || s.buffer || s.failed || !s.raw || !audio.ctx) return;
    // decodeAudioData detaches the ArrayBuffer, so hand it a copy and
    // keep the original for a possible retry.
    audio.ctx.decodeAudioData(
      s.raw.slice(0),
      function (buf) { s.buffer = buf; },
      function () { s.failed = true; }
    );
  }

  audio.loadSample = function (key, url) {
    if (!window.fetch) return;
    fetch(url)
      .then(function (r) { return r.ok ? r.arrayBuffer() : Promise.reject(); })
      .then(function (ab) { audio.samples[key] = { raw: ab }; decodeSample(key); })
      .catch(function () { /* fall back to the synth cue */ });
  };

  // Returns false if the sample isn't playable, so callers can fall back.
  audio.playSample = function (key, vol) {
    if (!audio.ready || !audio.enabled) return false;
    var s = audio.samples[key];
    if (!s || s.failed) return false;
    if (!s.buffer) { decodeSample(key); return false; }
    try {
      var src = audio.ctx.createBufferSource();
      src.buffer = s.buffer;
      var g = audio.ctx.createGain();
      g.gain.value = vol === undefined ? 0.9 : vol;
      src.connect(g);
      g.connect(audio.master);
      src.start(0);
      return true;
    } catch (e) { return false; }
  };

  function tone(freq, dur, opts) {
    if (!audio.ready || !audio.enabled) return;
    opts = opts || {};
    var t = audio.ctx.currentTime;
    var osc = audio.ctx.createOscillator();
    var g = audio.ctx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.25, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, opts) {
    if (!audio.ready || !audio.enabled) return;
    opts = opts || {};
    var t = audio.ctx.currentTime;
    var n = Math.floor(audio.ctx.sampleRate * dur);
    var buf = audio.ctx.createBuffer(1, n, audio.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = audio.ctx.createBufferSource();
    src.buffer = buf;
    var f = audio.ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.value = opts.freq || 1200;
    var g = audio.ctx.createGain();
    g.gain.value = opts.vol || 0.3;
    src.connect(f); f.connect(g); g.connect(audio.master);
    src.start(t);
  }

  audio.play = function (name) {
    if (!audio.ready || !audio.enabled) return;
    switch (name) {
      case 'tap':     tone(660, 0.07, { type: 'square', vol: 0.16 }); break;
      case 'select':  tone(520, 0.07, { type: 'square', vol: 0.2 }); setTimeout(function () { tone(780, 0.1, { type: 'square', vol: 0.2 }); }, 60); break;
      case 'back':    tone(400, 0.09, { type: 'square', to: 240, vol: 0.16 }); break;
      case 'wing':    tone(880, 0.09, { type: 'triangle', to: 1320, vol: 0.22 }); break;
      case 'wingbig': tone(660, 0.06, { type: 'triangle', vol: 0.2 }); setTimeout(function () { tone(990, 0.06, { type: 'triangle', vol: 0.2 }); }, 55); setTimeout(function () { tone(1320, 0.12, { type: 'triangle', vol: 0.2 }); }, 110); break;
      case 'jump':    tone(320, 0.14, { type: 'square', to: 720, vol: 0.18 }); break;
      case 'slide':   noise(0.22, { freq: 900, vol: 0.22 }); break;
      case 'crash':   noise(0.5, { freq: 500, vol: 0.5 }); tone(180, 0.4, { type: 'sawtooth', to: 55, vol: 0.3 }); break;
      case 'power':   tone(520, 0.08, { type: 'sawtooth', vol: 0.2 }); setTimeout(function () { tone(700, 0.08, { type: 'sawtooth', vol: 0.2 }); }, 70); setTimeout(function () { tone(1040, 0.18, { type: 'sawtooth', vol: 0.22 }); }, 140); break;
      case 'record':  tone(1200, 0.05, { type: 'sine', vol: 0.15 }); break;
      case 'pop':     tone(760, 0.055, { type: 'square', to: 520, vol: 0.2 }); break;
      case 'smash':   tone(980, 0.09, { type: 'square', to: 380, vol: 0.28 }); noise(0.1, { freq: 2600, vol: 0.18 }); break;
      case 'bounce':  tone(420, 0.045, { type: 'sine', to: 300, vol: 0.13 }); break;
      case 'point':   tone(620, 0.08, { type: 'triangle', vol: 0.22 });
                      setTimeout(function () { tone(930, 0.14, { type: 'triangle', vol: 0.22 }); }, 80); break;
      // "Lap!" - Flemish for "darn". Santi's own voice if it loaded,
      // otherwise a two-tone falling grumble.
      case 'lap':     if (audio.playSample('lap', 1.0)) break;
                      tone(430, 0.1, { type: 'square', to: 300, vol: 0.22 });
                      setTimeout(function () { tone(250, 0.2, { type: 'sawtooth', to: 150, vol: 0.2 }); }, 95); break;
      case 'sauce':   tone(300, 0.09, { type: 'sawtooth', vol: 0.2 });
                      setTimeout(function () { tone(450, 0.09, { type: 'sawtooth', vol: 0.2 }); }, 70);
                      setTimeout(function () { tone(680, 0.22, { type: 'sawtooth', to: 1100, vol: 0.24 }); }, 140); break;
    }
  };

  // ---------------------------------------------------------------
  // Save data
  // ---------------------------------------------------------------
  var KEY = 'santigame.v1';
  var save = (SG.save = { data: { best: {}, wings: 0, sound: true, seenA2HS: false } });

  save.load = function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        for (var k in d) save.data[k] = d[k];
      }
    } catch (e) { /* private mode / disabled storage */ }

    /* Economy v2: every mode was rebalanced to a common ~130 wings a
       minute and the present goals doubled to match. Double what is
       already banked at the same time, once - otherwise the rebalance
       would quietly take back presents that had already been collected,
       and those are real objects someone is holding. */
    if (!save.data.econ2) {
      save.data.wings = (save.data.wings || 0) * 2;
      save.data.econ2 = true;
      save.write();
    }

    audio.enabled = save.data.sound !== false;
  };
  save.write = function () {
    try { localStorage.setItem(KEY, JSON.stringify(save.data)); } catch (e) {}
  };
  save.best = function (mode) { return save.data.best[mode] || 0; };
  save.submit = function (mode, score) {
    if (score > (save.data.best[mode] || 0)) { save.data.best[mode] = score; save.write(); return true; }
    return false;
  };

  // ---------------------------------------------------------------
  // Art: photo -> cartoon pipeline, plus drawn placeholders
  // ---------------------------------------------------------------
  var art = (SG.art = { faces: {}, loaded: {} });

  // Turns a plain photo into a flat, saturated, ink-outlined cartoon.
  // Posterize + saturation boost + sobel edge overlay.
  art.cartoonify = function (img, opts) {
    opts = opts || {};
    var size = opts.size || 256;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');

    // Cover-fit into a square, zoomed in a little so the face fills the
    // circle instead of leaving a ring of background around it.
    var zoom = opts.zoom || 1.22;
    var sw = img.width, sh = img.height;
    var side = Math.min(sw, sh) / zoom;
    g.drawImage(img, (sw - side) / 2, (sh - side) / 2 - side * (opts.yShift === undefined ? 0.04 : opts.yShift),
                side, side, 0, 0, size, size);

    var id, px;
    try {
      id = g.getImageData(0, 0, size, size);
      px = id.data;
    } catch (e) {
      return c; // tainted canvas (shouldn't happen for same-origin assets)
    }

    var levels = opts.levels || 7;
    var sat = opts.sat === undefined ? 1.22 : opts.sat;
    var step = 255 / (levels - 1);

    // luminance map first (needed for edges before we posterize)
    var lum = new Float32Array(size * size);
    for (var i = 0, p = 0; i < px.length; i += 4, p++) {
      lum[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    }

    // posterize + saturate + slight lift
    for (var j = 0; j < px.length; j += 4) {
      var r = px[j], gg = px[j + 1], b = px[j + 2];
      var l = 0.299 * r + 0.587 * gg + 0.114 * b;
      r = l + (r - l) * sat;
      gg = l + (gg - l) * sat;
      b = l + (b - l) * sat;
      px[j]     = SG.clamp(Math.round(Math.round(r / step) * step * 1.04), 0, 255);
      px[j + 1] = SG.clamp(Math.round(Math.round(gg / step) * step * 1.04), 0, 255);
      px[j + 2] = SG.clamp(Math.round(Math.round(b / step) * step * 1.04), 0, 255);
    }

    // sobel edges -> ink lines
    var thr = opts.edge === undefined ? 42 : opts.edge;
    for (var y = 1; y < size - 1; y++) {
      for (var x = 1; x < size - 1; x++) {
        var o = y * size + x;
        var gx = -lum[o - size - 1] - 2 * lum[o - 1] - lum[o + size - 1] +
                  lum[o - size + 1] + 2 * lum[o + 1] + lum[o + size + 1];
        var gy = -lum[o - size - 1] - 2 * lum[o - size] - lum[o - size + 1] +
                  lum[o + size - 1] + 2 * lum[o + size] + lum[o + size + 1];
        var mag = Math.hypot(gx, gy) / 4;
        if (mag > thr) {
          var k = SG.clamp((mag - thr) / 60, 0, 1) * 0.85;
          var q = o * 4;
          px[q]     = Math.round(px[q]     * (1 - k) + 24 * k);
          px[q + 1] = Math.round(px[q + 1] * (1 - k) + 18 * k);
          px[q + 2] = Math.round(px[q + 2] * (1 - k) + 30 * k);
        }
      }
    }

    // optional colour grade (Dark Santi)
    if (opts.grade) opts.grade(px);

    g.putImageData(id, 0, 0);

    var out = document.createElement('canvas');
    out.width = out.height = size;
    var og = out.getContext('2d');
    og.save();
    og.beginPath();
    og.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    og.clip();
    og.drawImage(c, 0, 0);

    // Rim shading. Posterising a smooth background produces visible
    // colour rings at the edge of the crop - darkening the rim buries
    // them and reads as lighting on the face.
    var vg = og.createRadialGradient(size / 2, size * 0.44, size * 0.18, size / 2, size / 2, size / 2);
    vg.addColorStop(0, 'rgba(20,14,32,0)');
    vg.addColorStop(0.62, 'rgba(20,14,32,0.06)');
    vg.addColorStop(1, 'rgba(16,11,26,0.72)');
    og.fillStyle = vg;
    og.fillRect(0, 0, size, size);
    og.restore();
    return out;
  };

  // Grades used for alternate versions of the same face
  art.grades = {
    // Evil twin: crush to luminance, push contrast hard so the features
    // survive, then tint violet. Flat tinting alone turns the face to mush.
    // Santi Noir: black and white, contrast pushed so he still reads
    // against a colourful arena.
    noir: function (px) {
      for (var i = 0; i < px.length; i += 4) {
        var l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        l = SG.clamp((l - 128) * 1.3 + 126, 0, 255);
        px[i] = px[i + 1] = px[i + 2] = l;
      }
    },

    dark: function (px) {
      for (var i = 0; i < px.length; i += 4) {
        var l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        l = SG.clamp((l - 128) * 1.55 + 116, 0, 255);
        px[i]     = SG.clamp(Math.round(l * 0.72 + 26), 0, 255);
        px[i + 1] = SG.clamp(Math.round(l * 0.40), 0, 255);
        px[i + 2] = SG.clamp(Math.round(l * 0.86 + 22), 0, 255);
      }
    },
  };

  // Character cutouts (transparent PNGs). These are already illustrated
  // in a cartoon style, so by default they're used as-is - `cartoonify`
  // above is only applied to entries that ask for it (raw photos).
  art.sprites = {};    // full cutout (head + torso)
  art.heads = {};      // head art, alpha preserved, for the animated body
  art.headWhole = {};  // true when art.heads[key] is an exact head bbox

  // Applies a colour grade in place, leaving transparent pixels alone.
  function gradeSprite(img, grade) {
    var c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    try {
      var id = g.getImageData(0, 0, c.width, c.height);
      var px = id.data;
      var sub = new Uint8ClampedArray(4);
      for (var i = 0; i < px.length; i += 4) {
        if (px[i + 3] === 0) continue;
        sub[0] = px[i]; sub[1] = px[i + 1]; sub[2] = px[i + 2]; sub[3] = px[i + 3];
        grade(sub, 0);
        px[i] = sub[0]; px[i + 1] = sub[1]; px[i + 2] = sub[2];
      }
      g.putImageData(id, 0, 0);
    } catch (e) { /* tainted canvas - use the ungraded sprite */ }
    return c;
  }

  // Where the head sits horizontally in a cutout. Weighted by alpha over
  // the top rows, so it lands right for profiles and group shots too.
  function headCenterX(img) {
    var probe = document.createElement('canvas');
    probe.width = img.width;
    probe.height = img.height;
    probe.getContext('2d').drawImage(img, 0, 0);
    var band = Math.max(1, Math.round(img.height * 0.42));
    try {
      var px = probe.getContext('2d').getImageData(0, 0, img.width, band).data;
      var sum = 0, wsum = 0;
      for (var y = 0; y < band; y++) {
        for (var x = 0; x < img.width; x++) {
          var a = px[(y * img.width + x) * 4 + 3];
          if (a > 40) { sum += x * a; wsum += a; }
        }
      }
      if (wsum > 0) return sum / wsum;
    } catch (e) {}
    return img.width / 2;
  }

  /* Where the neck is, as a fraction of image height.

     Found from the silhouette: the head is the widest thing near the
     top, the shoulders flare out below, and the narrowest row between
     the two is the neck. Cropping to a guessed fraction instead either
     lops off the chin or drags half the chest up with it, and the right
     number differs for every portrait. */
  function neckFraction(img) {
    var limit = Math.floor(img.height * 0.9);
    var c = document.createElement('canvas');
    c.width = img.width;
    c.height = limit;
    c.getContext('2d').drawImage(img, 0, 0);
    try {
      var w = img.width;
      var px = c.getContext('2d').getImageData(0, 0, w, limit).data;
      var widths = new Int32Array(limit);
      for (var y = 0; y < limit; y++) {
        var n = 0;
        for (var x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 60) n++;
        widths[y] = n;
      }
      var headRow = 0, maxW = 0, upper = Math.floor(limit * 0.6);
      for (var y2 = 0; y2 < upper; y2++) if (widths[y2] > maxW) { maxW = widths[y2]; headRow = y2; }

      var neck = headRow, minW = widths[headRow];
      for (var y3 = headRow; y3 < limit; y3++) {
        if (widths[y3] <= minW) { minW = widths[y3]; neck = y3; }
        else if (widths[y3] > minW * 1.35) break;    // shoulders
      }
      // Only trust it if the silhouette genuinely pinched in. The margin
      // below the pinch is generous because a high collar (Dark Santi's
      // jacket) puts the narrowest row up at the jaw rather than under it.
      if (minW < maxW * 0.85) {
        return SG.clamp((neck + img.height * 0.07) / img.height, 0.45, 0.9);
      }
    } catch (e) {}
    return 0.76;
  }

  /* Head only, alpha preserved - hair silhouette and all. Drawn on top
     of the animated body so the character can actually run. The crop is
     deliberately not square: width frames the head, height runs from the
     top of the hair down to the neck. */
  art.headFromSprite = function (img, opts) {
    opts = opts || {};
    var size = opts.size || 256;
    var cw = Math.min(img.width, img.height * (opts.wide || 0.62));
    var ch = Math.min(img.height, img.height * (opts.crop || neckFraction(img)));
    var sx = SG.clamp(headCenterX(img) - cw / 2, 0, Math.max(0, img.width - cw));

    var out = document.createElement('canvas');
    out.width = size;
    out.height = Math.round(size * (ch / cw));
    out.getContext('2d').drawImage(img, sx, 0, cw, ch, 0, 0, out.width, out.height);
    return out;
  };

  // Square, circle-cropped bust for menus and HUD.
  art.faceFromSprite = function (img, opts) {
    opts = opts || {};
    var size = opts.size || 256;
    var side = Math.min(img.width, img.height * (opts.crop || 0.62));
    var sx = SG.clamp(headCenterX(img) - side / 2, 0, Math.max(0, img.width - side));

    var out = document.createElement('canvas');
    out.width = out.height = size;
    var og = out.getContext('2d');
    og.save();
    og.beginPath();
    og.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    og.clip();
    og.fillStyle = opts.bg || 'rgba(24,18,44,0.9)';
    og.fillRect(0, 0, size, size);
    og.drawImage(img, sx, 0, side, side, 0, 0, size, size);
    og.restore();
    return out;
  };

  /* Loads character art.
     item: { key, src, head?, grade?, cartoonify?, faceOpts? }
     `head` is an already-isolated head image; when given it is used
     as-is and no head is cropped out of the bust.
     A missing file is not an error - the drawn placeholder is used. */
  art.load = function (list, done) {
    var pending = list.length;
    if (!pending) return done && done();

    list.forEach(function (item) {
      if (!item.head) return;
      var hi = new Image();
      hi.onload = function () {
        art.heads[item.key] = item.grade ? gradeSprite(hi, item.grade) : hi;
        art.headWhole[item.key] = true;
      };
      hi.src = item.head;                 // failure just leaves the crop path
    });

    list.forEach(function (item) {
      var img = new Image();
      img.onload = function () {
        try {
          if (item.cartoonify) {
            art.faces[item.key] = art.cartoonify(img, item.opts || {});
          } else {
            var sprite = item.grade ? gradeSprite(img, item.grade) : img;
            art.sprites[item.key] = sprite;
            art.faces[item.key] = art.faceFromSprite(sprite, item.faceOpts);
            // A dedicated head image wins over cropping one out of the bust.
            if (!art.headWhole[item.key]) {
              art.heads[item.key] = art.headFromSprite(sprite, item.faceOpts);
            }
          }
          art.loaded[item.key] = true;
        } catch (e) { /* keep the placeholder */ }
        if (--pending === 0 && done) done();
      };
      img.onerror = function () { if (--pending === 0 && done) done(); };
      img.src = item.src;
    });
  };

  // --- drawn placeholder faces -------------------------------------
  // Simple, readable chibi head. `variant` switches Santi/Dark Santi.
  art.drawFace = function (g, cx, cy, r, variant) {
    var dark = variant === 'dark';
    var skin = dark ? '#7d6f86' : '#e8b48c';
    var hair = dark ? '#120d1c' : '#241a12';

    // head
    g.fillStyle = skin;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();

    // ears
    g.beginPath();
    g.arc(cx - r * 0.98, cy + r * 0.05, r * 0.2, 0, Math.PI * 2);
    g.arc(cx + r * 0.98, cy + r * 0.05, r * 0.2, 0, Math.PI * 2);
    g.fill();

    // hair: swept-up front (the hairspray is canon)
    g.fillStyle = hair;
    g.beginPath();
    g.arc(cx, cy - r * 0.12, r * 1.01, Math.PI * 1.04, Math.PI * 1.96);
    g.lineTo(cx + r * 0.9, cy - r * 0.2);
    g.quadraticCurveTo(cx + r * 0.2, cy - r * 0.62, cx - r * 0.1, cy - r * 0.3);
    g.quadraticCurveTo(cx - r * 0.5, cy - r * 0.1, cx - r * 0.92, cy - r * 0.2);
    g.closePath();
    g.fill();
    // quiff
    g.beginPath();
    g.moveTo(cx - r * 0.15, cy - r * 0.78);
    g.quadraticCurveTo(cx + r * 0.35, cy - r * 1.5, cx + r * 0.78, cy - r * 0.82);
    g.quadraticCurveTo(cx + r * 0.3, cy - r * 0.95, cx - r * 0.15, cy - r * 0.78);
    g.fill();

    // eyes
    var ey = cy + r * 0.06, ex = r * 0.36;
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(cx - ex, ey, r * 0.21, r * 0.24, 0, 0, Math.PI * 2);
    g.ellipse(cx + ex, ey, r * 0.21, r * 0.24, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = dark ? '#ff2b3c' : '#1d1428';
    g.beginPath();
    g.arc(cx - ex + r * 0.03, ey + r * 0.02, r * 0.11, 0, Math.PI * 2);
    g.arc(cx + ex + r * 0.03, ey + r * 0.02, r * 0.11, 0, Math.PI * 2);
    g.fill();

    // brows
    g.strokeStyle = hair;
    g.lineWidth = Math.max(1.5, r * 0.1);
    g.lineCap = 'round';
    g.beginPath();
    if (dark) {
      g.moveTo(cx - ex - r * 0.24, ey - r * 0.42);
      g.lineTo(cx - ex + r * 0.2, ey - r * 0.24);
      g.moveTo(cx + ex + r * 0.24, ey - r * 0.42);
      g.lineTo(cx + ex - r * 0.2, ey - r * 0.24);
    } else {
      g.moveTo(cx - ex - r * 0.24, ey - r * 0.34);
      g.lineTo(cx - ex + r * 0.2, ey - r * 0.4);
      g.moveTo(cx + ex + r * 0.24, ey - r * 0.34);
      g.lineTo(cx + ex - r * 0.2, ey - r * 0.4);
    }
    g.stroke();

    // mouth
    g.strokeStyle = '#8a3b3b';
    g.lineWidth = Math.max(1.5, r * 0.09);
    g.beginPath();
    if (dark) {
      g.moveTo(cx - r * 0.26, cy + r * 0.58);
      g.quadraticCurveTo(cx, cy + r * 0.38, cx + r * 0.26, cy + r * 0.58);
    } else {
      g.moveTo(cx - r * 0.26, cy + r * 0.44);
      g.quadraticCurveTo(cx, cy + r * 0.68, cx + r * 0.26, cy + r * 0.44);
    }
    g.stroke();
  };

  /* Head for a character body. Prefers the real cutout (hair silhouette
     intact), then a circular bust, then the drawn placeholder.
     `r` is the radius the drawn placeholder would use; the cutout is
     scaled around it so swapping art in doesn't shift the body. */
  art.drawHead = function (g, cx, cy, r, key, variant) {
    var head = art.heads[key];
    if (head) {
      var hw, hh;
      if (art.headWhole[key]) {
        // An exact head bounding box. Anchor by the CHIN rather than the
        // top, so every portrait's jaw lands on the same spot on the
        // body no matter how tall its hair or hat is.
        hw = r * 1.95;
        hh = hw * (head.height / head.width);
        g.drawImage(head, cx - hw / 2, cy + r * 1.42 - hh, hw, hh);
      } else {
        // A crop off the top of a bust: fixed width and top, height from
        // the aspect, with jaw and collar hanging over the torso.
        hw = r * 2.18;
        hh = hw * (head.height / head.width);
        g.drawImage(head, cx - hw / 2, cy - r * 1.08, hw, hh);
      }
      return;
    }
    var face = art.faces[key];
    if (face) {
      g.drawImage(face, cx - r, cy - r, r * 2, r * 2);
      g.strokeStyle = 'rgba(20,16,30,0.55)';
      g.lineWidth = Math.max(1.5, r * 0.09);
      g.beginPath();
      g.arc(cx, cy, r - r * 0.04, 0, Math.PI * 2);
      g.stroke();
    } else {
      art.drawFace(g, cx, cy, r, variant);
    }
  };

  /* Runner/fighter body used across modes. h = pixel height, phase
     drives the run cycle.

     If a character cutout has been loaded for `o.face`, it is used as
     the head-and-torso and animated legs are drawn beneath it. Without
     one, everything falls back to the drawn chibi. */
  art.drawSanti = function (g, x, yFeet, h, phase, o) {
    o = o || {};
    var shirt = o.shirt || SG.COLORS.purple;
    var pants = o.pants || '#2b3350';
    var skin = o.skin || '#e8b48c';
    var shoe = o.shoe || '#f7f7f7';
    var faceKey = o.face || 'santi';
    var variant = o.variant || 'normal';
    var run = o.run === undefined ? 1 : o.run;

    var headR = h * 0.185;
    var headY = yFeet - h * 0.815;
    var hipY = yFeet - h * 0.30;
    var shoulderY = yFeet - h * 0.55;
    var bodyW = h * 0.30;

    var bob = o.bob === false ? 0 : Math.abs(Math.sin(phase)) * h * 0.022;
    headY -= bob;
    shoulderY -= bob;
    hipY -= bob;

    g.lineCap = 'round';
    g.lineJoin = 'round';


    // A leg seen from behind: the forward foot lifts (moves UP the screen)
    // and swings outward, the trailing one plants. `side` is -1 or +1.
    function leg(side, back) {
      var sw = Math.sin(phase + (side > 0 ? 0 : Math.PI)) * run;
      var lift = Math.max(0, sw);
      // Seen from behind, a stride reads as the foot LIFTING, not
      // swinging out sideways - keep the horizontal travel small.
      var hipX = x + side * bodyW * 0.22;
      var footX = hipX + sw * h * 0.035;
      var footY = yFeet - lift * h * 0.26;
      var kneeX = hipX + sw * h * 0.02;
      var kneeY = (hipY + footY) / 2 - lift * h * 0.05;

      // dark casing first so the leg keeps an outline against the road
      g.strokeStyle = 'rgba(18,14,28,0.85)';
      g.lineWidth = h * (back ? 0.108 : 0.122);
      g.beginPath();
      g.moveTo(hipX, hipY);
      g.lineTo(kneeX, kneeY);
      g.lineTo(footX, footY - h * 0.03);
      g.stroke();

      g.strokeStyle = back ? SG.shade(pants, -0.3) : pants;
      g.lineWidth = h * (back ? 0.082 : 0.096);
      g.beginPath();
      g.moveTo(hipX, hipY);
      g.lineTo(kneeX, kneeY);
      g.lineTo(footX, footY - h * 0.03);
      g.stroke();

      g.fillStyle = back ? SG.shade(shoe, -0.22) : shoe;
      g.beginPath();
      g.ellipse(footX, footY - h * 0.014, h * 0.066, h * 0.034, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(18,14,28,0.8)';
      g.lineWidth = Math.max(1, h * 0.009);
      g.stroke();
    }

    // Arms swing opposite the legs; the hand rises and falls.
    function arm(side, back) {
      var sw = Math.sin(phase + (side > 0 ? Math.PI : 0)) * run;
      var shX = x + side * bodyW * 0.44;
      var elbowX = shX + side * h * 0.035;
      var elbowY = shoulderY + h * 0.135 - sw * h * 0.03;
      var handX = elbowX + side * h * 0.012;
      var handY = shoulderY + h * 0.245 - sw * h * 0.12;

      // dark casing so the arm reads against the torso
      g.strokeStyle = 'rgba(18,14,28,0.8)';
      g.lineWidth = h * 0.098;
      g.beginPath();
      g.moveTo(shX, shoulderY + h * 0.01);
      g.lineTo(elbowX, elbowY);
      g.lineTo(handX, handY);
      g.stroke();

      // sleeve
      g.strokeStyle = back ? SG.shade(shirt, -0.3) : SG.shade(shirt, -0.12);
      g.lineWidth = h * 0.078;
      g.beginPath();
      g.moveTo(shX, shoulderY + h * 0.01);
      g.lineTo(elbowX, elbowY);
      g.stroke();

      // forearm
      g.strokeStyle = back ? SG.shade(skin, -0.25) : skin;
      g.lineWidth = h * 0.058;
      g.beginPath();
      g.moveTo(elbowX, elbowY);
      g.lineTo(handX, handY);
      g.stroke();

      g.fillStyle = back ? SG.shade(skin, -0.25) : skin;
      g.beginPath();
      g.arc(handX, handY, h * 0.04, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(18,14,28,0.7)';
      g.lineWidth = Math.max(1, h * 0.008);
      g.stroke();
    }

    // Painter's order: trailing limbs, torso, leading limbs.
    leg(-1, true);
    arm(-1, true);

    // torso
    g.fillStyle = shirt;
    SG.roundRect(g, x - bodyW / 2, shoulderY - h * 0.055, bodyW, hipY - shoulderY + h * 0.1, h * 0.06);
    g.fill();
    g.strokeStyle = 'rgba(18,14,28,0.7)';
    g.lineWidth = Math.max(1, h * 0.012);
    g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.13)';
    SG.roundRect(g, x - bodyW / 2, hipY - h * 0.02, bodyW, h * 0.12, h * 0.06);
    g.fill();

    // box logo across the chest
    if (o.box !== false) {
      // Sat low on the chest so a head cutout with a collar in it can
      // hang over the shoulders without burying the logo.
      art.boxLogo(g, x, shoulderY + h * 0.098, bodyW * 0.72,
                  o.boxText || 'SANTI', o.boxColor || SG.COLORS.red, o.boxInk);
    }

    leg(1, false);
    arm(1, false);

    // neck (only visible behind the drawn placeholder face)
    g.fillStyle = SG.shade(skin, -0.12);
    g.fillRect(x - h * 0.045, headY + headR * 0.6, h * 0.09, h * 0.07);

    // Head last - nothing on the body may overlap it.
    art.drawHead(g, x, headY, headR, faceKey, variant);
  };

  /* Chicken wing - the currency of this universe. A party-wing "flat":
     curved meaty piece, two bones out one end, drenched in hot sauce
     (Santi takes his wings hot). */
  art.drawWing = function (g, x, y, s, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(s, s);

    // the two bones poking out the narrow end
    g.fillStyle = '#f6ead2';
    g.strokeStyle = '#3a2412';
    g.lineWidth = 1.4;
    g.lineJoin = 'round';
    [-2.6, 2.6].forEach(function (dy) {
      g.beginPath();
      g.moveTo(-9, dy * 0.6);
      g.lineTo(-16, dy);
      g.arc(-17, dy, 1.9, 0, Math.PI * 2);
      g.lineTo(-9, dy * 0.6 + 1.8);
      g.closePath();
      g.fill();
      g.stroke();
    });

    // meat, curved like a wing flat
    g.fillStyle = '#d9501f';
    g.strokeStyle = '#3a2412';
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(-10, -1.5);
    g.bezierCurveTo(-6, -9.5, 5, -10.5, 11, -3.5);
    g.bezierCurveTo(14.5, 0.5, 12.5, 7, 7, 8.5);
    g.bezierCurveTo(-1, 10.5, -7, 7, -10, 3);
    g.closePath();
    g.fill();
    g.stroke();

    // hot-sauce glaze
    g.fillStyle = 'rgba(255,140,60,0.55)';
    g.beginPath();
    g.ellipse(1, -4.6, 6.2, 2.4, -0.22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,232,190,0.7)';
    g.beginPath();
    g.ellipse(3.5, -5.6, 2.6, 1.05, -0.25, 0, Math.PI * 2);
    g.fill();

    // crispy speckle
    g.fillStyle = 'rgba(90,30,10,0.5)';
    [[-3, 2.5], [4, 3.5], [8, -0.5], [-6, -2]].forEach(function (p) {
      g.beginPath();
      g.arc(p[0], p[1], 0.85, 0, Math.PI * 2);
      g.fill();
    });

    g.restore();
  };

  /* ---- graffiti / streetwear kit, shared across modes ---- */

  /* Box logo: coloured rectangle, oblique wordmark.
     `ink` is the text colour - pass it whenever the box isn't dark, or
     the default white wordmark disappears into the box. */
  art.boxLogo = function (g, cx, cy, w, text, color, ink) {
    var h = w * 0.36;
    g.save();
    g.fillStyle = color || SG.COLORS.red;
    SG.roundRect(g, cx - w / 2, cy - h / 2, w, h, w * 0.03);
    g.fill();
    if (h > 6) {
      g.beginPath();
      g.rect(cx - w / 2, cy - h / 2, w, h);
      g.clip();
      g.font = '900 ' + (h * 0.72).toFixed(1) + 'px ' + SG.FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = ink || '#fff';
      g.translate(cx, cy);
      g.transform(1, 0, -0.2, 1, 0, 0);      // fake oblique
      g.fillText(text || 'SANTI', 0, h * 0.06);
    }
    g.restore();
  };

  // Slanted wordmark with a fat outline, for headlines like "LAP!".
  art.tag = function (g, text, x, y, size, color, angle) {
    g.save();
    g.translate(x, y);
    g.rotate(angle || 0);
    g.transform(1, 0, -0.26, 1, 0, 0);
    g.font = '900 ' + size + 'px ' + SG.FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = size * 0.3;
    g.strokeStyle = 'rgba(10,8,18,0.85)';
    g.strokeText(text, 0, 0);
    g.fillStyle = color;
    g.fillText(text, 0, 0);
    g.restore();
  };

  // ---------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------
  var particles = [];
  SG.burst = function (x, y, n, o) {
    o = o || {};
    for (var i = 0; i < n; i++) {
      var a = o.angle === undefined ? Math.random() * Math.PI * 2 : o.angle + SG.rand(-0.7, 0.7);
      var sp = SG.rand(o.speedMin || 60, o.speedMax || 260);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.lift || 0),
        life: SG.rand(0.3, o.life || 0.8), t: 0,
        r: SG.rand(o.rMin || 2, o.rMax || 6),
        c: o.colors ? SG.pick(o.colors) : '#ffb02e',
        g: o.gravity === undefined ? 700 : o.gravity,
      });
    }
  };
  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  function drawParticles(g) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var k = 1 - p.t / p.life;
      g.globalAlpha = k;
      g.fillStyle = p.c;
      g.beginPath();
      g.arc(p.x, p.y, p.r * k, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  SG.clearParticles = function () { particles.length = 0; };

  // ---------------------------------------------------------------
  // Canvas UI helpers
  // ---------------------------------------------------------------
  var ui = (SG.ui = {});

  ui.text = function (g, str, x, y, o) {
    o = o || {};
    var size = o.size || 24;
    g.font = (o.weight || '900') + ' ' + size + 'px ' + (o.font || SG.FONT);
    g.textAlign = o.align || 'center';
    g.textBaseline = o.baseline || 'middle';
    if (o.shadow !== false) {
      g.fillStyle = o.shadowColor || 'rgba(0,0,0,0.45)';
      g.fillText(str, x + (o.shadowOff || size * 0.06), y + (o.shadowOff || size * 0.06));
    }
    if (o.stroke) {
      g.lineWidth = o.strokeWidth || size * 0.18;
      g.strokeStyle = o.stroke;
      g.lineJoin = 'round';
      g.strokeText(str, x, y);
    }
    g.fillStyle = o.color || '#fff';
    g.fillText(str, x, y);
  };

  ui.panel = function (g, x, y, w, h, o) {
    o = o || {};
    g.fillStyle = o.fill || 'rgba(12,14,32,0.88)';
    SG.roundRect(g, x, y, w, h, o.r === undefined ? 18 : o.r);
    g.fill();
    if (o.border !== false) {
      g.strokeStyle = o.border || 'rgba(255,176,46,0.5)';
      g.lineWidth = o.borderWidth || 3;
      g.stroke();
    }
  };

  // Draws a button and reports whether it was tapped this frame.
  ui.button = function (g, r, label, o) {
    o = o || {};
    var hot = input.tappedRect(r);
    g.save();
    var grd = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    var base = o.color || SG.COLORS.gold;
    grd.addColorStop(0, o.color2 || base);
    grd.addColorStop(1, o.colorDark || shade(base, -0.28));
    g.fillStyle = grd;
    SG.roundRect(g, r.x, r.y, r.w, r.h, o.r === undefined ? 14 : o.r);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 3;
    g.stroke();
    ui.text(g, label, r.x + r.w / 2, r.y + r.h / 2 + 1, {
      size: o.size || Math.min(r.h * 0.44, 26),
      color: o.text || '#1a1206',
      shadow: false,
    });
    g.restore();
    if (hot) SG.audio.play(o.sound || 'select');
    return hot;
  };

  function shade(hex, amt) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g2 = (n >> 8) & 255, b = n & 255;
    var f = function (v) { return SG.clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255); };
    return 'rgb(' + f(r) + ',' + f(g2) + ',' + f(b) + ')';
  }
  SG.shade = shade;

  // ---------------------------------------------------------------
  // Scenes + main loop
  // ---------------------------------------------------------------
  var scenes = {};
  var current = null;
  SG.scene = function () { return current; };

  SG.register = function (name, scene) { scenes[name] = scene; scene.name = name; };

  // Scene changes are queued and applied at the top of the next frame.
  // Buttons are evaluated during draw(), so swapping scenes immediately
  // would mutate `current` halfway through its own render.
  var pendingGo = null;

  SG.go = function (name, params) {
    if (!scenes[name]) { console.warn('no scene', name); return; }
    pendingGo = { name: name, params: params || {} };
  };

  function applyGo() {
    if (!pendingGo) return;
    var next = pendingGo;
    pendingGo = null;
    if (current && current.exit) current.exit();
    input.clear();
    input.releaseAll();          // a stuck touch must not outlive the scene
    SG.clearParticles();
    current = scenes[next.name];
    if (current.enter) current.enter(next.params);
  }

  var last = 0;
  var running = false;

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (dt > 0.05) dt = 0.05;       // tab-switch / hitch guard
    applyGo();
    if (!running) { input.clear(); input.releaseAll(); return; }

    if (current && current.update) current.update(dt);
    updateParticles(dt);

    // shake decay
    if (shake.amt > 0) shake.amt = Math.max(0, shake.amt - dt * 40);

    // ---- render ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var sx = 0, sy = 0;
    if (shake.amt > 0) {
      sx = SG.rand(-shake.amt, shake.amt);
      sy = SG.rand(-shake.amt, shake.amt);
    }
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox + sx * view.scale, view.oy + sy * view.scale);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SG.W, SG.H);
    ctx.clip();

    if (current && current.draw) current.draw(ctx);
    drawParticles(ctx);

    ctx.restore();

    // consume leftover input so stale taps don't fire next frame
    input.taps.length = 0;
    input.swipes.length = 0;
    input.justPressed = false;
  }

  SG.start = function (firstScene) {
    save.load();
    resize();
    SG.go(firstScene);
    applyGo();
    running = true;
    requestAnimationFrame(frame);
  };

  SG.pauseLoop = function (v) { running = !v; last = 0; };

  /* Anything that takes the screen away - a notification, the app
     switcher, a call - can swallow the release for a finger that was
     down. Treat losing focus as every finger lifting. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      input.releaseAll();
      if (current && current.onBlur) current.onBlur();
    }
    last = 0;
  });
  window.addEventListener('blur', function () { input.releaseAll(); });
  window.addEventListener('pagehide', function () { input.releaseAll(); });

  // ---------------------------------------------------------------
  // Fullscreen / orientation / iOS add-to-home-screen
  // ---------------------------------------------------------------
  var platform = (SG.platform = {
    iOS: /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    standalone: window.navigator.standalone === true ||
                window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: fullscreen)').matches,
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  });
  platform.fullscreenSupported = !!(document.documentElement.requestFullscreen ||
                                    document.documentElement.webkitRequestFullscreen);

  var fsBtn = document.getElementById('fsBtn');
  var rotateEl = document.getElementById('rotate');
  var a2hsEl = document.getElementById('a2hs');

  SG.toggleFullscreen = function () {
    var el = document.documentElement;
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        var p = req.call(el);
        if (p && p.then) {
          p.then(function () {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(function () {});
            }
          }).catch(function () {});
        }
      }
    } else {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
    setTimeout(resize, 300);
  };

  if (!platform.fullscreenSupported || platform.standalone) fsBtn.classList.add('hidden');
  fsBtn.addEventListener('click', function (e) { e.preventDefault(); SG.toggleFullscreen(); });

  function checkOrientation() {
    var portrait = window.innerHeight > window.innerWidth;
    // Only nag on actual touch devices - a narrow desktop window is fine.
    rotateEl.classList.toggle('hidden', !(portrait && platform.touch));
    SG.pauseLoop(portrait && platform.touch);
    resize();
  }
  SG.checkOrientation = checkOrientation;
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', function () { setTimeout(checkOrientation, 260); });

  SG.initShell = function () {
    // iOS Safari can't do real fullscreen; nudge toward home-screen install.
    if (platform.iOS && !platform.standalone && !save.data.seenA2HS) {
      a2hsEl.classList.remove('hidden');
    }
    document.getElementById('a2hsClose').addEventListener('click', function () {
      a2hsEl.classList.add('hidden');
      save.data.seenA2HS = true;
      save.write();
    });
    checkOrientation();
  };
})();
