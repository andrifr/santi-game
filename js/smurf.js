/* =============================================================
   MODE 4 - SMURF WORLD
   Side-scrolling platformer. Santi in a smurf cap runs through
   mushroom country, stomps Gargamel's gnaps, dodges Azrael and
   finishes in the lair with the wizard himself.

   Levels are assembled from hand-built chunks. Every chunk starts
   and ends on solid ground at BASE_Y, so any two of them join up
   without ever producing a jump that can't be made.
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  // ---- world ------------------------------------------------------
  var BASE_Y = 452;            // top of the ground
  var DEATH_Y = 700;           // below this he has fallen out of the level

  // ---- player -----------------------------------------------------
  var PH = 92;                 // drawn height, feet to top of head
  var PW = 34;                 // collision width
  var PBH = 84;                // collision height

  /* Rising under a held jump uses GRAV_HOLD, everything else GRAV.
     620^2 / (2*1450) = 132px held, 620^2 / (2*2900) = 66px tapped -
     so a tap clears a gnap and a full hold clears a 96px block. */
  var GRAV = 2900, GRAV_HOLD = 1450, MAX_FALL = 1150;
  var RUN = 300, ACCEL = 2600, AIR_ACCEL = 1800, FRICTION = 3200;
  var JUMP_V = 620, STOMP_V = 700, SPRING_V = 1150;
  var COYOTE = 0.1, BUFFER = 0.13;

  var HEARTS = 3;
  var GEM_WINGS = 4, CLEAR_WINGS = 80, BOSS_WINGS = 260;
  var GEM_PTS = 100, STOMP_PTS = 150, CLEAR_PTS = 500, BOSS_PTS = 2500;

  var st;

  // ---------------------------------------------------------------
  // Themes
  // ---------------------------------------------------------------
  var THEMES = {
    village: {
      sky: ['#2b7fd6', '#63b6ef', '#b8e6ff'],
      far: '#3f7f5c', far2: '#356f50',
      mid: '#47935f', midDark: '#3a7c4f',
      grass: '#63c25e', grassLite: '#86dd80', earth: '#7d5735', earthDark: '#5c3f26',
      deep: '#25341f', prop: 'house', clouds: 7,
    },
    forest: {
      sky: ['#14315e', '#2b6d84', '#7fc59a'],
      far: '#1d4a48', far2: '#17403f',
      mid: '#255c4e', midDark: '#1d4c41',
      grass: '#49a862', grassLite: '#69c77c', earth: '#5d4630', earthDark: '#42311f',
      deep: '#12241f', canopy: '#2f8a63', prop: 'tree', clouds: 3, fireflies: true,
    },
    castle: {
      sky: ['#221540', '#4d2555', '#96455f'],
      far: '#2b1f45', far2: '#241b3c',
      mid: '#3a2b4f', midDark: '#2e2240',
      grass: '#6f6a80', grassLite: '#8a8599', earth: '#413c50', earthDark: '#2e2a3a',
      deep: '#191428', prop: 'deadtree', clouds: 4, bats: true,
    },
    lair: {
      sky: ['#1b1226', '#2a1c33', '#3a2438'],
      far: '#241a2e', far2: '#1d1526',
      mid: '#332338', midDark: '#281b2c',
      grass: '#6b5f52', grassLite: '#877a6a', earth: '#463c33', earthDark: '#302922',
      deep: '#14101c', prop: 'shelf', clouds: 0,
    },
  };

  var LEVELS = [
    { name: 'MUSHROOM VILLAGE', theme: 'village', chunks: 8, d: 0 },
    { name: 'WHISPERWOOD',      theme: 'forest',  chunks: 9, d: 1 },
    { name: "GARGAMEL'S GATE",  theme: 'castle',  chunks: 10, d: 2 },
    { name: 'THE LAIR',         theme: 'lair',    boss: true },
  ];

  // ---------------------------------------------------------------
  // Level building
  // ---------------------------------------------------------------
  function makeFoe(kind, x, y, d) {
    var fast = 1 + d * 0.1;
    if (kind === 'azrael') {
      // His dash stays under RUN. A cat that is simply faster than you
      // leaves nothing to do about him but land a pixel-perfect stomp.
      return { kind: 'azrael', x: x, y: y, w: 76, h: 48, dir: -1,
               speed: 78 * fast, dash: Math.min(268, 250 * fast), vy: 0, stun: 0, dead: 0,
               phase: Math.random() * 6.28, ground: true };
    }
    if (kind === 'bat') {
      return { kind: 'bat', x: x, x0: x, y: y, y0: y, w: 40, h: 30, dir: -1,
               speed: 74 * fast, vy: 0, dead: 0, phase: Math.random() * 6.28, fly: true };
    }
    return { kind: 'gnap', x: x, y: y, w: 38, h: 46, dir: -1,
             speed: 62 * fast, vy: 0, dead: 0, phase: Math.random() * 6.28, ground: true };
  }

  function builder(d) {
    var b = {
      d: d, solids: [], gems: [], foes: [], springs: [], movers: [], props: [],
      ground: function (x, w) { b.solids.push({ x: x, y: BASE_Y, w: w, h: 260, kind: 'ground' }); },
      block: function (x, y, w, h) { b.solids.push({ x: x, y: y, w: w, h: h, kind: 'block' }); },
      plat: function (x, y, w) { b.solids.push({ x: x, y: y, w: w, h: 20, kind: 'plat', oneWay: true }); },
      mover: function (x, y, w, span, sp) {
        var m = { x: x, y: y, w: w, h: 20, kind: 'plat', oneWay: true,
                  x0: x, span: span, sp: sp, dir: 1, dx: 0 };
        b.solids.push(m);
        b.movers.push(m);
      },
      gem: function (x, y) { b.gems.push({ x: x, y: y, got: 0, phase: x * 0.01 }); },
      row: function (x, y, n, step) { for (var i = 0; i < n; i++) b.gem(x + i * (step || 46), y); },
      arc: function (x0, w, y) {
        for (var i = 0; i < 5; i++) {
          var t = i / 4;
          b.gem(x0 + 20 + (w - 40) * t, y - Math.sin(t * Math.PI) * 62);
        }
      },
      foe: function (kind, x, y) { b.foes.push(makeFoe(kind, x, y, b.d)); },
      spring: function (x) { b.springs.push({ x: x, y: BASE_Y, squash: 0 }); },
    };
    return b;
  }

  /* Each chunk fills [x, x + returned width) and leaves solid ground at
     both ends. Gaps and stacks live strictly inside. */
  var CHUNKS = {
    /* Bats live over wide, flat, continuous ground only. A bat sits in
       exactly the band a jump passes through, so one parked over a gap
       or a landing platform is an unavoidable hit. */
    flat: function (b, x, d) {
      b.ground(x, 460);
      b.foe('gnap', x + 260, BASE_Y);
      b.row(x + 130, BASE_Y - 76, 3);
      if (d > 1) b.foe('bat', x + 330, BASE_Y - 206);
      return 460;
    },

    hop: function (b, x, d) {
      var gap = 118 + d * 16;
      b.ground(x, 230);
      b.ground(x + 230 + gap, 250);
      b.arc(x + 230, gap, BASE_Y - 66);
      if (d > 0) b.foe('gnap', x + 360 + gap, BASE_Y);
      return 480 + gap;
    },

    steps: function (b, x, d) {
      b.ground(x, 660);
      for (var i = 0; i < 3; i++) {
        var px = x + 150 + i * 150, py = BASE_Y - 90 - i * 80;
        b.plat(px, py, 128);
        b.gem(px + 64, py - 46);
      }
      b.foe('gnap', x + 540, BASE_Y);
      // Never at the mouth of a chunk - he arrives at full speed and a
      // gnap 120px in is a hit with no time to read it.
      if (d > 1) b.foe('gnap', x + 340, BASE_Y);
      return 660;
    },

    island: function (b, x, d) {
      b.ground(x, 220);
      b.plat(x + 320, BASE_Y - 96, 130);
      b.ground(x + 560, 200);
      b.row(x + 340, BASE_Y - 152, 3, 40);
      return 760;
    },

    plateau: function (b, x, d) {
      b.ground(x, 680);
      b.block(x + 220, BASE_Y - 96, 260, 96);
      b.foe('gnap', x + 300, BASE_Y - 96);
      if (d > 0) b.foe('gnap', x + 440, BASE_Y - 96);
      if (d > 1) b.foe('bat', x + 590, BASE_Y - 206);
      b.row(x + 258, BASE_Y - 152, 4);
      return 680;
    },

    bounce: function (b, x) {
      b.ground(x, 620);
      b.spring(x + 210);
      b.plat(x + 330, BASE_Y - 214, 170);
      b.row(x + 356, BASE_Y - 262, 3);
      b.gem(x + 210, BASE_Y - 140);
      return 620;
    },

    patrol: function (b, x, d) {
      b.ground(x, 700);
      b.plat(x + 180, BASE_Y - 120, 260);
      b.foe('gnap', x + 300, BASE_Y - 120);
      b.foe('gnap', x + 570, BASE_Y);
      b.row(x + 210, BASE_Y - 172, 4);
      if (d > 1) b.foe('bat', x + 612, BASE_Y - 226);
      return 700;
    },

    cat: function (b, x) {
      b.ground(x, 700);
      b.plat(x + 170, BASE_Y - 118, 150);
      b.plat(x + 430, BASE_Y - 118, 150);
      b.foe('azrael', x + 420, BASE_Y);
      b.row(x + 196, BASE_Y - 168, 3);
      b.row(x + 456, BASE_Y - 168, 3);
      return 700;
    },

    ride: function (b, x) {
      b.ground(x, 200);
      b.mover(x + 250, BASE_Y - 84, 140, 240, 92);
      b.ground(x + 620, 180);
      b.row(x + 300, BASE_Y - 192, 3);
      return 800;
    },

    towers: function (b, x, d) {
      b.ground(x, 720);
      b.block(x + 160, BASE_Y - 92, 120, 92);
      b.block(x + 400, BASE_Y - 170, 120, 170);
      b.gem(x + 220, BASE_Y - 142);
      b.row(x + 420, BASE_Y - 220, 3, 40);
      if (d > 1) b.foe('gnap', x + 620, BASE_Y);
      return 720;
    },

    chasm: function (b, x, d) {
      b.ground(x, 180);
      b.block(x + 320, BASE_Y - 40, 120, 300);
      b.block(x + 580, BASE_Y - 40, 120, 300);
      b.ground(x + 760, 140);
      b.gem(x + 380, BASE_Y - 96);
      b.gem(x + 640, BASE_Y - 96);
      b.arc(x + 180, 140, BASE_Y - 80);
      return 900;
    },
  };

  var SETS = [
    ['flat', 'hop', 'steps', 'patrol', 'island', 'bounce'],
    ['hop', 'steps', 'island', 'plateau', 'bounce', 'patrol', 'cat', 'ride', 'towers'],
    ['island', 'plateau', 'cat', 'ride', 'towers', 'chasm', 'patrol', 'hop'],
  ];

  function buildLevel(idx) {
    var L = LEVELS[idx];
    var th = THEMES[L.theme];
    if (L.boss) return buildLair(L, th);

    var b = builder(L.d);
    var x = 0;

    // Opening stretch: nothing here but a couple of leaves, so the
    // first thing he does is never a reaction.
    b.ground(x, 560);
    b.row(x + 260, BASE_Y - 76, 3);
    x += 560;

    var set = SETS[L.d], last = null;
    for (var i = 0; i < L.chunks; i++) {
      var name = SG.pick(set);
      if (name === last) name = SG.pick(set);
      last = name;
      x += CHUNKS[name](b, x, L.d);
    }

    // Run-out to the flag.
    b.ground(x, 620);
    b.row(x + 120, BASE_Y - 76, 4);
    var flagX = x + 400;
    var width = x + 620;

    return finish(L, th, b, width, flagX);
  }

  function buildLair(L, th) {
    var b = builder(2);
    b.ground(0, 1560);
    b.plat(250, BASE_Y - 150, 190);
    b.plat(1080, BASE_Y - 150, 190);
    b.spring(770);
    return finish(L, th, b, 1560, -1);
  }

  function finish(L, th, b, width, flagX) {
    /* Only an exposed side gets the dark lip. Two chunks butt their
       ground rects together, and a lip on both sides of that join draws
       a black seam across flat ground that reads as a crack. */
    for (var i = 0; i < b.solids.length; i++) {
      var s = b.solids[i];
      if (s.oneWay) continue;
      s.capL = s.capR = true;
      for (var j = 0; j < b.solids.length; j++) {
        var o = b.solids[j];
        if (o === s || o.oneWay || o.y !== s.y) continue;
        if (Math.abs(o.x + o.w - s.x) < 2) s.capL = false;
        if (Math.abs(s.x + s.w - o.x) < 2) s.capR = false;
      }
    }

    // Background props, laid out once so they don't jitter frame to frame.
    var props = [];
    if (th.prop !== 'shelf') {
      for (var px = 180; px < width; px += SG.randInt(320, 620)) {
        props.push({ kind: th.prop, x: px, s: SG.rand(0.75, 1.25), flip: Math.random() < 0.5 });
      }
    }
    var clouds = [];
    for (var c = 0; c < th.clouds; c++) {
      clouds.push({ x: Math.random() * (width + 600), y: SG.rand(40, 190), s: SG.rand(0.6, 1.4) });
    }
    var hills = [];
    for (var h = 0; h * 340 < width + 900; h++) {
      hills.push({ x: h * 340, r: SG.rand(150, 260), y: SG.rand(0, 40) });
    }

    return {
      name: L.name, theme: L.theme, th: th, boss: !!L.boss,
      width: width, flagX: flagX,
      solids: b.solids, gems: b.gems, foes: b.foes, springs: b.springs, movers: b.movers,
      props: props, clouds: clouds, hills: hills,
    };
  }

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  function reset(levelIdx, keepScore) {
    var lv = buildLevel(levelIdx);
    st = {
      levelIdx: levelIdx,
      lv: lv,
      phase: 'play',              // play | clear | dead | win
      paused: false,
      t: 0,
      cam: 0,
      score: keepScore || 0,
      gems: 0,
      wings: 0,
      hearts: HEARTS,
      msg: null, msgT: 0,
      shots: [], puddles: [],
      flagT: 0, endT: 0,
      jumpBuf: 0, jumpWas: false, jumpHeld: false, left: false, right: false,
      fartAt: SG.randInt(6, 11), jumps: 0,
      p: {
        x: 120, y: BASE_Y, vx: 0, vy: 0, facing: 1, phase: 0,
        grounded: false, coyote: 0, rise: false, prevY: BASE_Y,
        iFrames: 0, ride: null,
      },
      safe: { x: 120, y: BASE_Y },
      safeT: 0,
      boss: lv.boss ? {
        x: 1180, y: BASE_Y, hp: 3, dir: -1, state: 'wait', t: 0,
        vx: 0, vy: 0, phase: 0, hurt: 0, spawnT: 4, down: 0,
      } : null,
    };
    // The HUD already carries the name; the banner carries the number.
    say(lv.boss ? 'FINAL LEVEL' : 'LEVEL ' + (levelIdx + 1), '#8fd4ff');
  }

  function say(text, color) { st.msg = { text: text, color: color || SG.COLORS.gold }; st.msgT = 0; }

  // ---------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------
  // Left of the shell's fullscreen button, which is fixed to the very
  // corner of the page and would swallow taps meant for this.
  function pauseRect() { return { x: SG.W - 106, y: 12, w: 40, h: 34 }; }
  function padLeft() { return { x: 26, y: SG.H - 104, w: 84, h: 84 }; }
  function padRight() { return { x: 122, y: SG.H - 104, w: 84, h: 84 }; }
  function padJump() { return { x: SG.W - 136, y: SG.H - 116, w: 104, h: 104 }; }

  function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  /* Held input only. Taps and swipes are cleared at the end of every
     frame, so a platformer can't be built on them - it reads the live
     pointer map and the live key map instead. */
  function readControls() {
    var k = SG.input.keys;
    var left = !!(k.KeyA || k.ArrowLeft);
    var right = !!(k.KeyD || k.ArrowRight);
    var jump = !!(k.Space || k.KeyW || k.ArrowUp);

    var pr = pauseRect(), lr = padLeft(), rr = padRight();

    for (var id in SG.input.pointers) {
      var p = SG.input.pointers[id];
      // A finger that landed on pause never steers or jumps.
      if (inRect(p.sx, p.sy, pr)) continue;
      // Tested against the CURRENT position, so a thumb can slide from
      // one arrow to the other without lifting.
      if (inRect(p.x, p.y, lr)) { left = true; continue; }
      if (inRect(p.x, p.y, rr)) { right = true; continue; }
      if (p.x > SG.W * 0.5) { jump = true; continue; }
      // Anywhere else on the left half still steers, relative to where
      // the finger landed.
      var dx = p.x - p.sx;
      if (dx < -16) left = true;
      else if (dx > 16) right = true;
    }

    // A tap so brief that no frame saw the finger down still jumps.
    if (!jump) {
      for (var i = 0; i < SG.input.taps.length; i++) {
        var t = SG.input.taps[i];
        if (t.x > SG.W * 0.5 && !inRect(t.x, t.y, pr)) {
          SG.input.taps.splice(i, 1);
          st.jumpBuf = BUFFER;
          break;
        }
      }
    }

    st.left = left;
    st.right = right;
    if (jump && !st.jumpWas) st.jumpBuf = BUFFER;
    st.jumpWas = jump;
    st.jumpHeld = jump;
  }

  // ---------------------------------------------------------------
  // Collision
  // ---------------------------------------------------------------
  function solids() { return st.lv.solids; }

  function overlapX(x, halfW, s) { return x + halfW > s.x && x - halfW < s.x + s.w; }

  function moveX(p, dx) {
    p.x += dx;
    var list = solids();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.oneWay) continue;
      if (!overlapX(p.x, PW / 2, s)) continue;
      if (p.y <= s.y || p.y - PBH >= s.y + s.h) continue;
      if (dx > 0) p.x = s.x - PW / 2;
      else if (dx < 0) p.x = s.x + s.w + PW / 2;
      p.vx = 0;
    }
    p.x = SG.clamp(p.x, PW / 2, st.lv.width - PW / 2);
  }

  /* Landing is a swept test against where the feet were last frame -
     at 1150px/s and a 0.05 dt clamp he covers 57px per step, which
     would otherwise drop him straight through a 20px toadstool. */
  function moveY(p, dy) {
    var prev = p.prevY;
    p.y += dy;
    p.grounded = false;
    p.ride = null;

    var list = solids();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!overlapX(p.x, PW / 2 - 3, s)) continue;
      var top = s.y, bot = s.y + s.h;

      if (dy >= 0 && p.y >= top && prev <= top + 1) {
        p.y = top;
        p.vy = 0;
        p.grounded = true;
        p.rise = false;
        if (s.span) p.ride = s;
      } else if (!s.oneWay && dy < 0 && p.y - PBH < bot && prev - PBH >= bot - 1) {
        p.y = bot + PBH;
        p.vy = 0;
      }
    }
    if (p.grounded) p.coyote = COYOTE;
  }

  // Nothing may end a frame buried in terrain - a collider that reverts
  // every move would trap him there permanently.
  function unstick(p) {
    var list = solids();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.oneWay) continue;
      if (!overlapX(p.x, PW / 2, s)) continue;
      if (p.y <= s.y || p.y - PBH >= s.y + s.h) continue;
      var up = p.y - s.y;                       // lift to stand on it
      var lf = p.x + PW / 2 - s.x;              // push out left
      var rt = s.x + s.w - (p.x - PW / 2);      // push out right
      if (up <= lf && up <= rt) { p.y = s.y; p.vy = Math.min(p.vy, 0); p.grounded = true; }
      else if (lf < rt) p.x -= lf;
      else p.x += rt;
    }
  }

  function groundBelow(x, y) {
    var list = solids();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (x < s.x || x > s.x + s.w) continue;
      if (s.y >= y - 2 && s.y <= y + 12) return true;
    }
    return false;
  }

  function wallAt(x, y) {
    var list = solids();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.oneWay) continue;
      if (x < s.x || x > s.x + s.w) continue;
      if (s.y < y - 6 && s.y + s.h > y - 6) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------
  function update(dt) {
    st.t += dt;
    if (st.msg) { st.msgT += dt; if (st.msgT > 2.6) st.msg = null; }

    if (st.phase === 'clear' || st.phase === 'win') {
      st.endT += dt;
      st.flagT = Math.min(1, st.flagT + dt * 1.6);
      if (st.boss && st.boss.down) st.boss.down = Math.min(1, st.boss.down + dt * 1.6);
      return;
    }
    if (st.phase === 'dead') { st.endT += dt; return; }
    if (st.paused) return;

    // Claimed before anything else looks at input, or the general
    // handling below would starve it.
    if (SG.input.tappedRect(pauseRect()) || pressedEscape()) {
      st.paused = true;
      SG.audio.play('back');
      return;
    }

    readControls();
    updateMovers(dt);
    updatePlayer(dt);
    updateFoes(dt);
    if (st.boss) updateBoss(dt);
    updateShots(dt);
    updateGems(dt);
    updateSprings(dt);
    updateCam(dt);

    if (st.lv.flagX > 0 && st.p.x >= st.lv.flagX && st.p.y > BASE_Y - 240) clearLevel();
  }

  function pressedEscape() {
    for (var i = 0; i < SG.input.taps.length; i++) {
      if (SG.input.taps[i].key === 'Escape') { SG.input.taps.splice(i, 1); return true; }
    }
    return false;
  }

  function updateMovers(dt) {
    var m = st.lv.movers;
    for (var i = 0; i < m.length; i++) {
      var v = m[i];
      var step = v.dir * v.sp * dt;
      v.dx += step;
      if (v.dx > v.span) { v.dx = v.span; v.dir = -1; }
      if (v.dx < 0) { v.dx = 0; v.dir = 1; }
      v.x = v.x0 + v.dx;
      v.step = step;
    }
  }

  function updatePlayer(dt) {
    var p = st.p;
    p.prevY = p.y;
    if (p.iFrames > 0) p.iFrames -= dt;
    if (p.coyote > 0) p.coyote -= dt;
    if (st.jumpBuf > 0) st.jumpBuf -= dt;

    // Carried by whatever he is standing on.
    if (p.ride && p.ride.step) moveX(p, p.ride.step);

    var want = (st.right ? 1 : 0) - (st.left ? 1 : 0);
    if (want) {
      p.vx += want * (p.grounded ? ACCEL : AIR_ACCEL) * dt;
      p.facing = want;
    } else if (p.grounded) {
      var drop = FRICTION * dt;
      p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - Math.sign(p.vx) * drop;
    }
    p.vx = SG.clamp(p.vx, -RUN, RUN);

    if (st.jumpBuf > 0 && (p.grounded || p.coyote > 0)) jump(p);

    var g = (p.rise && st.jumpHeld && p.vy < 0) ? GRAV_HOLD : GRAV;
    p.vy = Math.min(p.vy + g * dt, MAX_FALL);

    moveX(p, p.vx * dt);
    moveY(p, p.vy * dt);
    unstick(p);

    if (Math.abs(p.vx) > 20 && p.grounded) p.phase += dt * (6 + Math.abs(p.vx) * 0.03);

    // A spot to come back to after a fall. It has to be on the floor,
    // off anything that moves, and with room to run - dropping him back
    // a stride short of the same ledge just feeds him to it again.
    st.safeT += dt;
    if (p.grounded && !p.ride && st.safeT > 0.3 && p.y <= BASE_Y + 1 &&
        groundBelow(p.x + 150, p.y) && groundBelow(p.x - 60, p.y)) {
      st.safeT = 0;
      st.safe.x = p.x;
      st.safe.y = p.y;
    }

    if (p.y > DEATH_Y) fell();
  }

  function jump(p) {
    p.vy = -JUMP_V;
    p.grounded = false;
    p.coyote = 0;
    p.rise = true;
    st.jumpBuf = 0;
    st.jumps++;
    // The fart lands on roughly every tenth jump, never on a schedule
    // tight enough to notice.
    if (st.jumps >= st.fartAt && SG.audio.playSample('fart', 0.8)) {
      st.fartAt = st.jumps + SG.randInt(8, 13);
    } else {
      SG.audio.play('jump');
    }
  }

  function bounce(p, v) {
    p.vy = -v;
    p.grounded = false;
    p.rise = false;              // a bounce is a fixed height, not a held one
    p.coyote = 0;
  }

  function updateSprings(dt) {
    var p = st.p, sp = st.lv.springs;
    for (var i = 0; i < sp.length; i++) {
      var s = sp[i];
      if (s.squash > 0) s.squash -= dt * 3;
      if (p.vy < 0) continue;
      if (Math.abs(p.x - s.x) > 46) continue;
      if (p.y < s.y - 34 || p.prevY > s.y + 4) continue;
      p.y = s.y - 24;
      bounce(p, SPRING_V);
      s.squash = 1;
      SG.audio.play('bounce');
      SG.burst(s.x, s.y - 20, 8, { colors: ['#ff8fbf', '#ffd8e8'], speedMax: 180, lift: 60, gravity: 500 });
    }
  }

  function updateGems(dt) {
    var p = st.p, gems = st.lv.gems;
    for (var i = 0; i < gems.length; i++) {
      var m = gems[i];
      if (m.got) { m.got += dt; continue; }
      if (Math.abs(m.x - p.x) > 40) continue;
      if (m.y < p.y - PBH - 26 || m.y > p.y + 26) continue;
      m.got = 0.001;
      st.gems++;
      st.score += GEM_PTS;
      bankWings(GEM_WINGS);
      SG.audio.play('wing');
      SG.burst(m.x, m.y, 8, { colors: ['#7ee08a', '#e14a4a', '#fff2b0'], speedMax: 190, gravity: 620 });
    }
  }

  function bankWings(n) {
    st.wings += n;
    SG.save.data.wings = (SG.save.data.wings || 0) + n;
    SG.save.write();
  }

  // ---------------------------------------------------------------
  function updateFoes(dt) {
    var p = st.p;
    for (var i = 0; i < st.lv.foes.length; i++) {
      var f = st.lv.foes[i];
      if (f.dead) { f.dead += dt; continue; }

      if (f.fly) {
        f.x += f.dir * f.speed * dt;
        if (f.x < f.x0 - 110) f.dir = 1;
        if (f.x > f.x0 + 110) f.dir = -1;
        f.y = f.y0 + Math.sin(st.t * 2.4 + f.phase) * 46;
      } else {
        if (f.stun > 0) {
          f.stun -= dt;
        } else {
          var speed = f.speed;
          if (f.kind === 'azrael') {
            var dx = p.x - f.x;
            if (Math.abs(dx) < 340 && Math.abs(p.y - f.y) < 74) {
              f.dir = dx > 0 ? 1 : -1;
              speed = f.dash;
            }
          }
          f.x += f.dir * speed * dt;
        }

        // gravity + landing, so a gnap can be placed on a toadstool
        f.vy = Math.min(f.vy + GRAV * dt, MAX_FALL);
        var prev = f.y;
        f.y += f.vy * dt;
        var landed = false;
        var list = solids();
        for (var s = 0; s < list.length; s++) {
          var so = list[s];
          if (f.x + f.w / 2 < so.x || f.x - f.w / 2 > so.x + so.w) continue;
          if (f.vy >= 0 && f.y >= so.y && prev <= so.y + 1) {
            f.y = so.y; f.vy = 0; landed = true;
          }
        }
        // Turn at a wall or a ledge, but only with both feet down -
        // mid-air the probe below finds nothing and would flip him
        // every single frame.
        if (landed) {
          var ahead = f.x + f.dir * (f.w / 2 + 8);
          if (!groundBelow(ahead, f.y + 4) || wallAt(ahead, f.y)) f.dir *= -1;
        }
        if (f.y > DEATH_Y) f.dead = 0.01;
        f.phase += dt * 7;
      }

      touchFoe(f, dt);
    }
  }

  /* Stomps are judged on where the feet WERE. Anything else and a fast
     fall past a gnap's shoulder reads as a side hit. */
  function touchFoe(f, dt) {
    var p = st.p;
    if (Math.abs(p.x - f.x) > PW / 2 + f.w / 2) return;
    if (p.y < f.y - f.h || p.y - PBH > f.y) return;

    var fromAbove = p.vy > 40 && p.prevY <= f.y - f.h + 16;
    if (fromAbove) {
      bounce(p, STOMP_V);
      if (f.kind === 'azrael') {
        // Azrael can't be killed - a stomp only flattens his ears.
        f.stun = 2.2;
        SG.audio.play('smash');
        SG.burst(f.x, f.y - f.h, 10, { colors: ['#ffd48a', '#fff'], speedMax: 200 });
        st.score += 50;
      } else {
        f.dead = 0.01;
        st.score += STOMP_PTS;
        SG.audio.play('pop');
        SG.burst(f.x, f.y - f.h * 0.5, 12, { colors: ['#a8c25a', '#7a4b2a', '#fff'], speedMax: 220 });
      }
      return;
    }
    if (f.kind === 'azrael' && f.stun > 0) return;
    hurt();
  }

  function hurt() {
    var p = st.p;
    if (p.iFrames > 0 || st.phase !== 'play') return;
    st.hearts--;
    p.iFrames = 1.5;
    p.vx = -p.facing * 260;
    bounce(p, 340);
    SG.shake(10);
    if (st.hearts <= 0) { die(); return; }
    SG.audio.play('crash');
  }

  function fell() {
    var p = st.p;
    st.hearts--;
    if (st.hearts <= 0) { die(); return; }
    SG.audio.play('crash');
    p.x = st.safe.x;
    p.y = st.safe.y;
    p.vx = 0;
    p.vy = 0;
    p.iFrames = 1.4;
    say('CAREFUL', '#ff8fa8');
  }

  function die() {
    st.phase = 'dead';
    st.endT = 0;
    SG.audio.play('crash');
    setTimeout(function () { SG.audio.play('lap'); }, 260);
    SG.shake(16);
    SG.save.submit('smurf', st.score);
    SG.save.write();
  }

  function clearLevel() {
    st.phase = 'clear';
    st.endT = 0;
    st.score += CLEAR_PTS;
    bankWings(CLEAR_WINGS);
    SG.audio.play('wingbig');
  }

  // ---------------------------------------------------------------
  // Gargamel
  // ---------------------------------------------------------------
  function updateBoss(dt) {
    var G = st.boss, p = st.p;
    G.t += dt;
    G.phase += dt * 5;
    if (G.hurt > 0) G.hurt -= dt;

    if (G.down > 0) { G.down += dt; return; }

    var rush = 1 + (3 - G.hp) * 0.25;      // he gets nastier as he loses

    switch (G.state) {
      case 'wait':
        if (G.t > 0.8) { G.state = 'walk'; G.t = 0; }
        break;

      case 'walk':
        G.dir = p.x > G.x ? 1 : -1;
        // Closes in but stops short - grinding into the player would
        // chew through three hearts with nothing to react to.
        if (Math.abs(p.x - G.x) > 96) G.x += G.dir * 92 * rush * dt;
        if (G.t > 1.9 / rush) {
          G.t = 0;
          G.state = G.next === 'slam' ? 'slam' : 'throw';
          G.next = G.next === 'slam' ? 'throw' : 'slam';
        }
        break;

      case 'throw':
        G.dir = p.x > G.x ? 1 : -1;
        if (!G.thrown && G.t > 0.45) {
          G.thrown = 1;
          hurl(G, p);
        } else if (G.thrown === 1 && G.t > 0.95) {
          G.thrown = 2;
          hurl(G, p);
        }
        if (G.t > 1.4) { G.t = 0; G.thrown = 0; G.state = 'walk'; }
        break;

      case 'slam':
        // crouch, leap at him, land hard, then a window with his head down
        if (G.t < 0.45) {
          G.dir = p.x > G.x ? 1 : -1;
        } else if (!G.air) {
          G.air = true;
          G.vx = SG.clamp((p.x - G.x) * 1.6, -420, 420);
          G.vy = -760;
          SG.audio.play('jump');
        }
        if (G.air) {
          G.vy += 2200 * dt;
          G.x += G.vx * dt;
          G.y += G.vy * dt;
          if (G.y >= BASE_Y) {
            G.y = BASE_Y;
            G.air = false;
            G.t = 0;
            G.state = 'dizzy';
            SG.shake(14);
            SG.audio.play('crash');
            SG.burst(G.x, BASE_Y, 20, { colors: ['#8a7f6a', '#c9bda6'], speedMax: 300, gravity: 900 });
          }
        }
        break;

      case 'dizzy':
        if (G.t > 2.4) { G.t = 0; G.state = 'walk'; }
        break;
    }

    G.x = SG.clamp(G.x, 90, st.lv.width - 90);

    // A pair of gnaps at a time, so the arena is never empty.
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      G.spawnT = 7;
      var alive = 0;
      for (var i = 0; i < st.lv.foes.length; i++) if (!st.lv.foes[i].dead) alive++;
      if (alive < 2) {
        // Away from the PLAYER, not away from Gargamel - the far corner
        // from him is where the player is standing at the start.
        st.lv.foes.push(makeFoe('gnap', p.x < st.lv.width / 2 ? st.lv.width - 120 : 120, BASE_Y, 2));
        SG.audio.play('record');
      }
    }

    // contact
    var head = BASE_Y - (G.state === 'dizzy' ? 96 : 168);
    var halfW = G.state === 'dizzy' ? 58 : 46;
    if (Math.abs(p.x - G.x) < PW / 2 + halfW && p.y > head && p.y - PBH < BASE_Y) {
      if (G.state === 'dizzy' && p.vy > 40 && p.prevY <= head + 22) {
        G.hp--;
        // Harmless while he reels. Without this the bounce off his head
        // leaves the player inside a walking Gargamel on the very next
        // frame, so every landed stomp cost a heart.
        G.hurt = 1;
        G.state = 'walk';
        G.t = 0;
        bounce(p, STOMP_V + 60);
        st.score += 600;
        SG.audio.play('smash');
        SG.shake(12);
        SG.burst(G.x, head, 18, { colors: ['#b46ad0', '#fff2b0', '#4dd47a'], speedMax: 280 });
        if (G.hp <= 0) winGame();
        else say(G.hp === 2 ? 'TWO MORE' : 'ONE MORE', '#4dd47a');
      } else if (G.state !== 'dizzy' && G.hurt <= 0) {
        hurt();
      }
    }
  }

  function hurl(G, p) {
    var dx = p.x - G.x;
    st.shots.push({
      x: G.x + G.dir * 34, y: BASE_Y - 150,
      vx: SG.clamp(dx * 0.9, -420, 420), vy: -420, rot: 0,
    });
    SG.audio.play('pop');
  }

  function updateShots(dt) {
    var p = st.p;
    for (var i = st.shots.length - 1; i >= 0; i--) {
      var s = st.shots[i];
      s.vy += 1400 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += dt * 9;
      if (s.y >= BASE_Y) {
        st.shots.splice(i, 1);
        st.puddles.push({ x: s.x, t: 0 });
        SG.audio.play('smash');
        SG.burst(s.x, BASE_Y - 8, 14, { colors: ['#7ee08a', '#4dd47a', '#d8ff9a'], speedMax: 220, lift: 40 });
        continue;
      }
      if (Math.abs(s.x - p.x) < PW / 2 + 12 && s.y > p.y - PBH && s.y < p.y) {
        st.shots.splice(i, 1);
        hurt();
      }
    }

    for (var j = st.puddles.length - 1; j >= 0; j--) {
      var q = st.puddles[j];
      q.t += dt;
      if (q.t > 3.6) { st.puddles.splice(j, 1); continue; }
      if (Math.abs(q.x - p.x) < 46 && p.y > BASE_Y - 26 && p.y <= BASE_Y + 4) hurt();
    }
  }

  function winGame() {
    st.phase = 'win';
    st.endT = 0;
    st.score += BOSS_PTS;
    bankWings(BOSS_WINGS);
    st.boss.down = 0.01;
    SG.audio.play('power');
    SG.save.submit('smurf', st.score);
    SG.save.write();
  }

  // ---------------------------------------------------------------
  function updateCam(dt) {
    var target = SG.clamp(st.p.x - SG.W * 0.42, 0, Math.max(0, st.lv.width - SG.W));
    st.cam += (target - st.cam) * Math.min(1, dt * 9);
  }

  // ---------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------
  function draw(g) {
    var cam = st.cam, th = st.lv.th;

    drawSky(g, th);
    if (st.lv.theme === 'lair') { drawLairBack(g, cam, th); drawVoid(g, th); }
    else drawOutdoorBack(g, cam, th);

    drawTerrain(g, cam, th);
    drawSprings(g, cam);
    if (st.lv.flagX > 0) drawFlag(g, cam);
    drawGems(g, cam);
    drawPuddles(g, cam);
    drawFoes(g, cam);
    if (st.boss) drawGargamel(g, cam);
    drawShots(g, cam);
    drawPlayer(g, cam);

    drawHUD(g);
    if (SG.platform.touch && st.phase === 'play' && !st.paused) drawPad(g);
    if (st.msg) drawMsg(g);

    if (st.paused) drawPaused(g);
    else if (st.phase === 'clear') drawClear(g);
    else if (st.phase === 'dead') drawDead(g);
    else if (st.phase === 'win') drawWin(g);
  }

  function drawSky(g, th) {
    var sky = g.createLinearGradient(0, 0, 0, SG.H);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(0.55, th.sky[1]);
    sky.addColorStop(1, th.sky[2]);
    g.fillStyle = sky;
    g.fillRect(0, 0, SG.W, SG.H);
  }

  function drawOutdoorBack(g, cam, th) {
    // far hills / tree line
    var fx = cam * 0.22;
    g.fillStyle = th.far;
    for (var i = 0; i < st.lv.hills.length; i++) {
      var h = st.lv.hills[i];
      var x = h.x - fx;
      if (x < -400 || x > SG.W + 400) continue;
      g.beginPath();
      g.ellipse(x, BASE_Y - 40 + h.y, h.r, h.r * 0.62, 0, Math.PI, 0);
      g.fill();
    }
    g.fillStyle = th.far2;
    g.fillRect(0, BASE_Y - 42, SG.W, 42);

    // clouds
    for (var c = 0; c < st.lv.clouds.length; c++) {
      var cl = st.lv.clouds[c];
      var cx = cl.x - cam * 0.12;
      cx = ((cx % (st.lv.width + 600)) + st.lv.width + 600) % (st.lv.width + 600) - 300;
      if (cx < -160 || cx > SG.W + 160) continue;
      g.fillStyle = 'rgba(255,255,255,0.55)';
      puff(g, cx, cl.y, 38 * cl.s);
    }

    // mid band the props stand on
    var mx = cam * 0.55;
    g.fillStyle = th.mid;
    g.fillRect(0, BASE_Y - 16, SG.W, 16);
    for (var p = 0; p < st.lv.props.length; p++) {
      var pr = st.lv.props[p];
      var px = pr.x - mx;
      if (px < -260 || px > SG.W + 260) continue;
      drawProp(g, pr, px, BASE_Y - 14, th);
    }
    g.fillStyle = th.midDark;
    g.fillRect(0, BASE_Y - 14, SG.W, 14);
    drawVoid(g, th);

    if (th.fireflies) {
      for (var f = 0; f < 22; f++) {
        var a = f * 2.7;
        var gx = ((f * 331 - cam * 0.6) % (SG.W + 200) + SG.W + 200) % (SG.W + 200) - 100;
        var gy = 150 + Math.sin(st.t * 0.8 + a) * 70 + (f % 5) * 44;
        g.fillStyle = 'rgba(220,255,140,' + (0.25 + Math.sin(st.t * 3 + a) * 0.2) + ')';
        g.beginPath();
        g.arc(gx, gy, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function drawLairBack(g, cam, th) {
    // stone wall
    var x0 = -((cam * 0.4) % 96);
    g.fillStyle = '#2c2333';
    g.fillRect(0, 0, SG.W, BASE_Y);
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = 3;
    for (var y = 60; y < BASE_Y; y += 48) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(SG.W, y); g.stroke();
      for (var x = x0 + (y % 96 ? 48 : 0); x < SG.W; x += 96) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 48); g.stroke();
      }
    }
    // torches
    for (var t = 0; t < 6; t++) {
      var tx = t * 300 - cam * 0.4;
      if (tx < -60 || tx > SG.W + 60) continue;
      g.fillStyle = '#4a3a2a';
      g.fillRect(tx - 5, 150, 10, 46);
      var flick = 12 + Math.sin(st.t * 9 + t) * 4;
      var fg = g.createRadialGradient(tx, 144, 2, tx, 144, flick * 3.4);
      fg.addColorStop(0, 'rgba(255,200,90,0.85)');
      fg.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = fg;
      g.beginPath();
      g.arc(tx, 144, flick * 3.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffd06a';
      g.beginPath();
      g.ellipse(tx, 146, 6, flick, 0, 0, Math.PI * 2);
      g.fill();
    }
    // cauldron
    var kx = 1400 - cam;
    if (kx > -160 && kx < SG.W + 160) {
      g.fillStyle = '#1e1a26';
      g.beginPath();
      g.ellipse(kx, BASE_Y - 44, 66, 52, 0, Math.PI, 0);
      g.fill();
      g.fillRect(kx - 66, BASE_Y - 44, 132, 40);
      g.fillStyle = '#4dd47a';
      g.beginPath();
      g.ellipse(kx, BASE_Y - 86, 58, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(77,212,122,0.25)';
      g.beginPath();
      g.arc(kx, BASE_Y - 120 - Math.sin(st.t * 2) * 10, 26, 0, Math.PI * 2);
      g.fill();
    }
  }

  /* Everything below the ground line goes dark before the terrain is
     drawn over it, so a gap in the floor reads as a drop instead of as
     more scenery. */
  function drawVoid(g, th) {
    var v = g.createLinearGradient(0, BASE_Y, 0, SG.H);
    v.addColorStop(0, th.deep);
    v.addColorStop(1, '#070a10');
    g.fillStyle = v;
    g.fillRect(0, BASE_Y, SG.W, SG.H - BASE_Y);
  }

  function puff(g, x, y, r) {
    g.beginPath();
    g.arc(x - r * 0.6, y + r * 0.1, r * 0.55, 0, Math.PI * 2);
    g.arc(x, y - r * 0.15, r * 0.75, 0, Math.PI * 2);
    g.arc(x + r * 0.65, y + r * 0.05, r * 0.5, 0, Math.PI * 2);
    g.fill();
  }

  function drawProp(g, pr, x, base, th) {
    g.save();
    g.translate(x, base);
    g.scale(pr.flip ? -pr.s : pr.s, pr.s);
    if (pr.kind === 'house') mushroomHouse(g);
    else if (pr.kind === 'tree') bigTree(g, th);
    else deadTree(g);
    g.restore();
  }

  // The village: a fat red cap over a cream stalk with a round door.
  function mushroomHouse(g) {
    g.fillStyle = '#f0e0bc';
    SG.roundRect(g, -46, -104, 92, 104, 10);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.14)';
    SG.roundRect(g, 16, -104, 30, 104, 10);
    g.fill();

    g.fillStyle = '#5b3a1c';
    g.beginPath();
    g.moveTo(-17, 0);
    g.lineTo(-17, -40);
    g.quadraticCurveTo(0, -58, 17, -40);
    g.lineTo(17, 0);
    g.closePath();
    g.fill();

    g.fillStyle = '#ffd66a';
    g.beginPath(); g.arc(-30, -70, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(30, -70, 9, 0, Math.PI * 2); g.fill();

    g.fillStyle = '#d64545';
    g.beginPath();
    g.ellipse(0, -100, 74, 52, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#b93737';
    g.fillRect(-74, -102, 148, 6);
    g.fillStyle = '#fff6ec';
    [[-42, -118, 11], [-8, -132, 13], [30, -120, 10], [54, -106, 7]].forEach(function (s) {
      g.beginPath();
      g.ellipse(s[0], s[1], s[2], s[2] * 0.78, 0, 0, Math.PI * 2);
      g.fill();
    });
  }

  function bigTree(g, th) {
    g.fillStyle = '#4a3524';
    g.fillRect(-13, -130, 26, 130);
    // The canopy needs its own colour: painted in the hill colour it
    // vanishes into the hills and the tree reads as a floating post.
    g.fillStyle = th.canopy || th.mid;
    [[0, -178, 68], [-48, -142, 47], [48, -146, 45]].forEach(function (c) {
      g.beginPath();
      g.arc(c[0], c[1], c[2], 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.arc(-20, -196, 32, 0, Math.PI * 2);
    g.fill();
  }

  function deadTree(g) {
    g.strokeStyle = '#241b30';
    g.lineWidth = 13;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(0, -120);
    g.moveTo(0, -78); g.lineTo(-42, -128);
    g.moveTo(0, -96); g.lineTo(40, -142);
    g.moveTo(-24, -104); g.lineTo(-36, -152);
    g.stroke();
  }

  // ---------------------------------------------------------------
  function drawTerrain(g, cam, th) {
    var list = st.lv.solids;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var x = s.x - cam;
      if (x + s.w < -60 || x > SG.W + 60) continue;
      if (s.oneWay) drawToadstool(g, x, s.y, s.w, !!s.span);
      else drawGround(g, x, s.y, s.w, s.h, th, s);
    }
  }

  function drawGround(g, x, y, w, h, th, s) {
    g.fillStyle = th.earth;
    g.fillRect(x, y, w, h);
    g.fillStyle = th.earthDark;
    g.fillRect(x, y + 46, w, h - 46);
    g.fillStyle = th.grass;
    g.fillRect(x, y, w, 15);
    g.fillStyle = th.grassLite;
    g.fillRect(x, y, w, 5);
    // shading down the exposed sides so a ledge reads as an edge
    g.fillStyle = 'rgba(0,0,0,0.22)';
    if (!s || s.capL) g.fillRect(x, y + 15, 5, h - 15);
    if (!s || s.capR) g.fillRect(x + w - 5, y + 15, 5, h - 15);
  }

  function drawToadstool(g, x, y, w, moving) {
    var cap = moving ? '#5aa8e8' : '#d64545';
    var lip = moving ? '#3f86c4' : '#b93737';
    // stalks
    g.fillStyle = '#efe3c8';
    var n = w > 180 ? 3 : 2;
    for (var i = 0; i < n; i++) {
      var sx = x + w * ((i + 0.5) / n);
      SG.roundRect(g, sx - 11, y + 12, 22, 46, 6);
      g.fill();
    }
    g.fillStyle = cap;
    g.beginPath();
    g.moveTo(x, y + 20);
    g.quadraticCurveTo(x, y - 4, x + 22, y);
    g.lineTo(x + w - 22, y);
    g.quadraticCurveTo(x + w, y - 4, x + w, y + 20);
    g.closePath();
    g.fill();
    g.fillStyle = lip;
    g.fillRect(x, y + 14, w, 6);
    // Spots go on the curved front, never on the surface he lands on.
    g.fillStyle = 'rgba(255,246,236,0.92)';
    for (var s = 0; s < Math.max(2, Math.floor(w / 60)); s++) {
      var px = x + 26 + s * 58;
      if (px > x + w - 18) break;
      g.beginPath();
      g.ellipse(px, y + 9, 8, 4.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(x + 4, y, w - 8, 3);
  }

  function drawSprings(g, cam) {
    for (var i = 0; i < st.lv.springs.length; i++) {
      var s = st.lv.springs[i];
      var x = s.x - cam;
      if (x < -80 || x > SG.W + 80) continue;
      var sq = Math.max(0, s.squash);
      var h = 40 - sq * 18;
      g.fillStyle = '#efe3c8';
      SG.roundRect(g, x - 16, s.y - h, 32, h, 8);
      g.fill();
      g.fillStyle = '#ff7fb0';
      g.beginPath();
      g.ellipse(x, s.y - h, 40 + sq * 8, 20 - sq * 6, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = '#e05f96';
      g.fillRect(x - 40 - sq * 8, s.y - h - 3, 80 + sq * 16, 5);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      [[-20, -12], [4, -16], [24, -9]].forEach(function (d) {
        g.beginPath();
        g.ellipse(x + d[0], s.y - h + d[1], 6, 3.6, 0, 0, Math.PI * 2);
        g.fill();
      });
    }
  }

  // Sarsaparilla: a three-lobed leaf with a berry, the smurf staple.
  function drawGems(g, cam) {
    for (var i = 0; i < st.lv.gems.length; i++) {
      var m = st.lv.gems[i];
      var x = m.x - cam;
      if (x < -40 || x > SG.W + 40) continue;
      if (m.got) {
        if (m.got > 0.45) continue;
        g.save();
        g.globalAlpha = 1 - m.got / 0.45;
        g.translate(x, m.y - m.got * 90);
        leaf(g, 1 + m.got);
        g.restore();
        continue;
      }
      g.save();
      g.translate(x, m.y + Math.sin(st.t * 2.6 + m.phase) * 5);
      leaf(g, 1);
      g.restore();
    }
  }

  function leaf(g, s) {
    g.scale(s, s);
    g.fillStyle = '#3f8f43';
    g.fillRect(-1.6, 2, 3.2, 12);
    g.fillStyle = '#5fc35a';
    g.strokeStyle = 'rgba(20,50,20,0.5)';
    g.lineWidth = 1.6;
    [-1, 1].forEach(function (d) {
      g.beginPath();
      g.moveTo(0, 4);
      g.quadraticCurveTo(d * 22, -4, d * 6, -16);
      g.quadraticCurveTo(d * 2, -8, 0, 4);
      g.fill();
      g.stroke();
    });
    g.beginPath();
    g.moveTo(0, 2);
    g.quadraticCurveTo(-9, -14, 0, -22);
    g.quadraticCurveTo(9, -14, 0, 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#e14a4a';
    g.beginPath(); g.arc(-5, 6, 4.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(4, 8, 3.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.arc(-6.4, 4.6, 1.4, 0, Math.PI * 2); g.fill();
  }

  function drawFlag(g, cam) {
    var x = st.lv.flagX - cam;
    if (x < -80 || x > SG.W + 120) return;
    var top = BASE_Y - 210;
    g.fillStyle = '#cfd6e2';
    g.fillRect(x - 4, top, 8, 210);
    g.fillStyle = '#9aa4b6';
    g.fillRect(x - 4, top, 3, 210);
    g.fillStyle = '#efe3c8';
    g.beginPath();
    g.arc(x, top - 2, 9, 0, Math.PI * 2);
    g.fill();

    var drop = st.phase === 'clear' ? st.flagT * 120 : 0;
    g.fillStyle = '#4aa8ff';
    g.beginPath();
    g.moveTo(x + 3, top + 14 + drop);
    g.lineTo(x + 84, top + 40 + drop);
    g.lineTo(x + 3, top + 66 + drop);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x + 30, top + 40 + drop, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#4aa8ff';
    g.beginPath();
    g.arc(x + 30, top + 43 + drop, 5, 0, Math.PI * 2);
    g.fill();
  }

  function drawPuddles(g, cam) {
    for (var i = 0; i < st.puddles.length; i++) {
      var q = st.puddles[i];
      var x = q.x - cam;
      if (x < -80 || x > SG.W + 80) continue;
      var k = q.t > 2.9 ? (Math.floor(q.t * 12) % 2 ? 0.25 : 0.7) : 0.7;
      g.fillStyle = 'rgba(77,212,122,' + k + ')';
      g.beginPath();
      g.ellipse(x, BASE_Y + 2, 46, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(200,255,160,' + (k * 0.5) + ')';
      g.beginPath();
      g.ellipse(x - 8, BASE_Y - 1, 18, 4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawShots(g, cam) {
    for (var i = 0; i < st.shots.length; i++) {
      var s = st.shots[i];
      var x = s.x - cam;
      g.save();
      g.translate(x, s.y);
      g.rotate(s.rot);
      g.fillStyle = '#cfe0ea';
      SG.roundRect(g, -8, -12, 16, 22, 4);
      g.fill();
      g.fillStyle = '#4dd47a';
      SG.roundRect(g, -6, -2, 12, 10, 3);
      g.fill();
      g.fillStyle = '#8a6b4a';
      g.fillRect(-4, -17, 8, 6);
      g.restore();
    }
  }

  // ---------------------------------------------------------------
  function drawFoes(g, cam) {
    for (var i = 0; i < st.lv.foes.length; i++) {
      var f = st.lv.foes[i];
      var x = f.x - cam;
      if (x < -120 || x > SG.W + 120) continue;
      if (f.dead) {
        if (f.dead > 0.5) continue;
        g.save();
        g.globalAlpha = 1 - f.dead / 0.5;
        g.translate(x, f.y);
        g.scale(1 + f.dead, Math.max(0.1, 1 - f.dead * 2.2));
        g.translate(-x, -f.y);
      } else {
        g.save();
      }
      if (!f.dead) shadow(g, x, f.y, f.w * 0.5);
      if (f.kind === 'gnap') drawGnap(g, x, f.y, f);
      else if (f.kind === 'azrael') drawAzrael(g, x, f.y, f);
      else drawBat(g, x, f.y, f);
      g.restore();
    }
  }

  function shadow(g, x, y, r) {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath();
    g.ellipse(x, y - 1, r, r * 0.26, 0, 0, Math.PI * 2);
    g.fill();
  }

  /* A gnap: one of the wizard's little hooded helpers. Original design -
     squat, mustard-green, permanently annoyed. */
  function drawGnap(g, x, y, f) {
    var sw = Math.sin(f.phase) * 6;
    var d = f.dir;
    g.save();
    g.translate(x, y);
    g.scale(d, 1);

    // legs
    g.strokeStyle = '#4a3a20';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-7, -18); g.lineTo(-7 + sw * 0.6, -2);
    g.moveTo(7, -18); g.lineTo(7 - sw * 0.6, -2);
    g.stroke();

    // body
    g.fillStyle = '#a8c25a';
    g.strokeStyle = 'rgba(26,32,16,0.7)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, -26, 16, 17, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // arms
    g.strokeStyle = '#8fae48';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-12, -30); g.lineTo(-19, -20 - sw * 0.5);
    g.moveTo(12, -30); g.lineTo(19, -20 + sw * 0.5);
    g.stroke();

    // hood
    g.fillStyle = '#8a4b2a';
    g.beginPath();
    g.moveTo(-17, -30);
    g.quadraticCurveTo(-19, -50, 0, -50);
    g.quadraticCurveTo(19, -50, 17, -30);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(4, -46);
    g.quadraticCurveTo(-16, -60, -22, -50);
    g.quadraticCurveTo(-10, -46, -2, -40);
    g.closePath();
    g.fill();

    // face in the hood
    g.fillStyle = '#c2d97a';
    g.beginPath();
    g.ellipse(4, -36, 12, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#a8c25a';
    g.beginPath();
    g.ellipse(13, -34, 6, 4.4, -0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1f12';
    g.beginPath(); g.arc(3, -39, 2.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(10, -39, 2.4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1a1f12';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -44); g.lineTo(6, -42);
    g.moveTo(13, -44); g.lineTo(8, -42);
    g.stroke();
    g.restore();
  }

  /* Azrael. Never dies - a stomp only sits him down for a moment. */
  function drawAzrael(g, x, y, f) {
    var sw = Math.sin(f.phase * 0.8) * 5;
    var stunned = f.stun > 0;
    g.save();
    g.translate(x, y);
    g.scale(f.dir, 1);
    if (stunned) g.translate(0, 6);

    // tail
    g.strokeStyle = '#d97f34';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-30, -22);
    g.quadraticCurveTo(-48, -30 + (stunned ? 14 : 0), -44, -46 + (stunned ? 18 : Math.sin(f.phase * 0.6) * 6));
    g.stroke();

    // legs
    g.strokeStyle = '#c26f2c';
    g.lineWidth = 8;
    g.beginPath();
    if (stunned) {
      g.moveTo(-14, -14); g.lineTo(-16, -2);
      g.moveTo(18, -16); g.lineTo(20, -2);
    } else {
      g.moveTo(-16, -16); g.lineTo(-16 + sw, -2);
      g.moveTo(16, -16); g.lineTo(16 - sw, -2);
    }
    g.stroke();

    // body
    g.fillStyle = '#e08a3c';
    g.strokeStyle = 'rgba(60,30,10,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(-2, -26, 30, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#c26f2c';
    [-14, -2, 10].forEach(function (sx2) {
      g.beginPath();
      g.ellipse(sx2, -34, 4, 7, 0, 0, Math.PI * 2);
      g.fill();
    });

    // head
    g.fillStyle = '#e08a3c';
    g.beginPath();
    g.arc(26, -34, 15, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#e08a3c';
    g.beginPath();
    g.moveTo(16, -44); g.lineTo(15, -58); g.lineTo(27, -47);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(30, -46); g.lineTo(38, -57); g.lineTo(38, -42);
    g.closePath(); g.fill();
    g.fillStyle = '#f7dcc0';
    g.beginPath();
    g.ellipse(34, -29, 9, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e05f96';
    g.beginPath();
    g.ellipse(39, -32, 3, 2.2, 0, 0, Math.PI * 2);
    g.fill();

    if (stunned) {
      g.strokeStyle = '#1a1206';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(24, -40); g.lineTo(31, -35);
      g.moveTo(31, -40); g.lineTo(24, -35);
      g.stroke();
      g.fillStyle = '#ffd66a';
      for (var s = 0; s < 3; s++) {
        var a = st.t * 5 + s * 2.1;
        g.beginPath();
        g.arc(26 + Math.cos(a) * 20, -56 + Math.sin(a) * 6, 3, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.fillStyle = '#c8f06a';
      g.beginPath(); g.ellipse(24, -37, 4.4, 5.2, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(33, -38, 4.4, 5.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#101006';
      g.beginPath(); g.ellipse(25, -37, 1.5, 4.4, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(34, -38, 1.5, 4.4, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawBat(g, x, y, f) {
    var flap = Math.sin(st.t * 12 + f.phase) * 0.5;
    g.save();
    g.translate(x, y - 14);
    g.fillStyle = '#5b4a7a';
    g.beginPath();
    g.ellipse(0, 0, 12, 11, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#7a66a0';
    [-1, 1].forEach(function (d) {
      g.beginPath();
      g.moveTo(d * 8, -2);
      g.quadraticCurveTo(d * 26, -12 - flap * 14, d * 32, 2 + flap * 8);
      g.quadraticCurveTo(d * 22, -2, d * 8, 6);
      g.closePath();
      g.fill();
    });
    g.fillStyle = '#5b4a7a';
    g.beginPath();
    g.moveTo(-8, -8); g.lineTo(-10, -18); g.lineTo(-2, -10);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(8, -8); g.lineTo(10, -18); g.lineTo(2, -10);
    g.closePath(); g.fill();
    g.fillStyle = '#ffd66a';
    g.beginPath(); g.arc(-4, -1, 2.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(4, -1, 2.2, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // ---------------------------------------------------------------
  function drawGargamel(g, cam) {
    var G = st.boss;
    var x = G.x - cam;
    var dizzy = G.state === 'dizzy';
    var crouch = G.state === 'slam' && !G.air;
    var h = dizzy ? 96 : 168;

    shadow(g, x, BASE_Y, 44);
    g.save();
    g.translate(x, G.y);
    g.scale(G.dir, 1);
    if (G.hurt > 0 && Math.floor(G.hurt * 20) % 2) g.globalAlpha = 0.5;
    if (G.down) {
      g.rotate(-Math.min(1, G.down) * 1.4);
      g.translate(-30, 0);
    }
    if (crouch) g.scale(1.08, 0.86);

    /* Dark robe on a dark lair needs a rim light and lighter folds, or
       he reads as a hole in the background with a head floating over it. */
    var robeTop = -(h - 30);
    g.fillStyle = '#2c2442';
    g.strokeStyle = 'rgba(186,176,224,0.32)';
    g.lineWidth = 2.5;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-20, robeTop + 6);
    g.quadraticCurveTo(0, robeTop - 4, 20, robeTop + 6);
    g.quadraticCurveTo(46, -46, 56, -4);
    g.quadraticCurveTo(0, 6, -56, -4);
    g.quadraticCurveTo(-46, -46, -20, robeTop + 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.beginPath();
    g.moveTo(-8, robeTop + 10);
    g.quadraticCurveTo(-16, -60, -22, -6);
    g.lineTo(-4, -6);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(0, -4, 56, 9, 0, 0, Math.PI * 2);
    g.fill();

    // rope belt
    g.strokeStyle = '#b08a44';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-26, -52); g.lineTo(26, -52);
    g.stroke();
    g.beginPath();
    g.moveTo(20, -52); g.lineTo(24, -34);
    g.stroke();

    // arm - lighter than the robe so the throw is visible
    var reach = G.state === 'throw' ? -0.9 : dizzy ? 0.5 : Math.sin(G.phase) * 0.25;
    g.strokeStyle = '#413461';
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(20, robeTop + 24);
    g.lineTo(46, robeTop + 44 + reach * 40);
    g.stroke();
    g.fillStyle = '#e8c49a';
    g.beginPath();
    g.arc(49, robeTop + 46 + reach * 40, 8, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(40,26,20,0.5)';
    g.lineWidth = 1.5;
    g.stroke();

    // collar
    g.fillStyle = '#413461';
    g.beginPath();
    g.ellipse(0, robeTop + 8, 22, 8, 0, 0, Math.PI * 2);
    g.fill();

    // head
    var hy = robeTop - 20;
    g.fillStyle = '#e8c49a';
    g.beginPath();
    g.ellipse(1, hy, 25, 28, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(60,40,26,0.45)';
    g.lineWidth = 2;
    g.stroke();
    // the nose is the whole face
    g.fillStyle = '#dcb086';
    g.beginPath();
    g.moveTo(14, hy - 6);
    g.quadraticCurveTo(44, hy + 4, 30, hy + 13);
    g.quadraticCurveTo(22, hy + 12, 15, hy + 8);
    g.closePath();
    g.fill();
    g.stroke();
    // bald on top, grey tufts at the sides
    g.fillStyle = '#8b8794';
    g.beginPath();
    g.ellipse(-19, hy - 2, 10, 14, 0.35, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(15, hy - 12, 9, 8, -0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.ellipse(-4, hy - 20, 13, 7, -0.2, 0, Math.PI * 2);
    g.fill();

    if (dizzy) {
      g.strokeStyle = '#2a2030';
      g.lineWidth = 2.8;
      g.beginPath();
      g.moveTo(-10, hy - 6); g.lineTo(-2, hy + 2);
      g.moveTo(-2, hy - 6); g.lineTo(-10, hy + 2);
      g.moveTo(6, hy - 6); g.lineTo(14, hy + 2);
      g.moveTo(14, hy - 6); g.lineTo(6, hy + 2);
      g.stroke();
      g.fillStyle = '#ffd66a';
      for (var s = 0; s < 4; s++) {
        var a = st.t * 4.5 + s * 1.57;
        g.beginPath();
        g.arc(1 + Math.cos(a) * 28, hy - 38 + Math.sin(a) * 8, 3.6, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(-7, hy - 4, 6, 5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(8, hy - 4, 6, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#141018';
      g.beginPath(); g.arc(-5, hy - 4, 2.6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(10, hy - 4, 2.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#5d5766';
      g.lineWidth = 3.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-14, hy - 15); g.lineTo(-2, hy - 8);
      g.moveTo(16, hy - 15); g.lineTo(4, hy - 8);
      g.stroke();
      g.strokeStyle = '#7a3b3b';
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(-6, hy + 18);
      g.quadraticCurveTo(2, hy + 13, 10, hy + 17);
      g.stroke();
    }
    g.restore();

    if (!st.boss.down) {
      var bw = 260, bx = SG.W / 2 - bw / 2;
      g.fillStyle = 'rgba(10,8,20,0.6)';
      SG.roundRect(g, bx - 3, 75, bw + 6, 18, 9);
      g.fill();
      g.fillStyle = '#b46ad0';
      SG.roundRect(g, bx, 78, bw * (G.hp / 3), 12, 6);
      g.fill();
      SG.ui.text(g, 'GARGAMEL', SG.W / 2, 60, { size: 13, color: 'rgba(255,255,255,0.7)', shadow: false });
    }
  }

  // ---------------------------------------------------------------
  function drawPlayer(g, cam) {
    var p = st.p;
    if (p.iFrames > 0 && Math.floor(p.iFrames * 22) % 2) return;
    var x = p.x - cam;

    shadow(g, x, Math.min(BASE_Y, p.y), 20);

    g.save();
    if (p.facing < 0) { g.translate(x * 2, 0); g.scale(-1, 1); }
    var moving = p.grounded && Math.abs(p.vx) > 20;
    SG.art.drawSanti(g, x, p.y, PH, p.phase, {
      face: 'santi',
      shirt: '#3f8fe0',
      boxColor: '#ffffff', boxInk: '#2f6fb8', boxText: 'SMURF',
      pants: '#eaeef6', shoe: '#ffffff',
      run: moving ? 1 : (p.grounded ? 0.08 : 0.5),
      bob: moving,
    });
    // The cap goes on last, over whatever the head art is.
    smurfCap(g, x, p.y - PH * 0.815, PH * 0.185);
    g.restore();
  }

  /* White phrygian cap, drawn from the head circle the body uses, so it
     lands correctly whether the real head art loaded or the drawn
     placeholder is standing in for it. */
  function smurfCap(g, cx, cy, r) {
    var by = cy - r * 0.34;              // brim line, pulled down over the hair
    g.save();
    g.fillStyle = '#ffffff';
    g.strokeStyle = 'rgba(30,40,70,0.5)';
    g.lineWidth = Math.max(1.2, r * 0.085);
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(cx - r * 1.10, by);
    g.quadraticCurveTo(cx - r * 1.18, by - r * 1.10, cx - r * 0.44, by - r * 1.52);
    g.quadraticCurveTo(cx + r * 0.30, by - r * 1.94, cx + r * 0.74, by - r * 1.34);
    g.quadraticCurveTo(cx + r * 0.50, by - r * 1.00, cx + r * 0.90, by - r * 0.52);
    g.quadraticCurveTo(cx + r * 1.08, by - r * 0.24, cx + r * 1.10, by);
    g.closePath();
    g.fill();
    g.stroke();
    // shading along the back so it isn't a flat white blob
    g.fillStyle = 'rgba(150,170,210,0.25)';
    g.beginPath();
    g.moveTo(cx - r * 1.10, by);
    g.quadraticCurveTo(cx - r * 1.18, by - r * 1.10, cx - r * 0.44, by - r * 1.52);
    g.quadraticCurveTo(cx - r * 0.5, by - r * 0.9, cx - r * 0.52, by);
    g.closePath();
    g.fill();

    g.fillStyle = '#f7f9ff';
    SG.roundRect(g, cx - r * 1.16, by - r * 0.2, r * 2.32, r * 0.44, r * 0.22);
    g.fill();
    g.stroke();
    g.restore();
  }

  // ---------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------
  function drawHUD(g) {
    for (var i = 0; i < HEARTS; i++) heart(g, 34 + i * 32, 34, i < st.hearts);

    g.save();
    g.translate(30, 78);
    g.scale(0.85, 0.85);
    leaf(g, 1);
    g.restore();
    SG.ui.text(g, String(st.gems), 48, 74, {
      size: 20, color: '#bff0a8', align: 'left', stroke: '#16301a', strokeWidth: 5, shadow: false,
    });

    SG.ui.text(g, st.lv.name, SG.W / 2, 26, {
      size: 14, color: 'rgba(255,255,255,0.45)', shadow: false,
    });

    // pause
    var pr = pauseRect();
    g.fillStyle = 'rgba(10,12,28,0.5)';
    SG.roundRect(g, pr.x, pr.y, pr.w, pr.h, 9);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(pr.x + 13, pr.y + 9, 5, 16);
    g.fillRect(pr.x + 22, pr.y + 9, 5, 16);

    SG.art.drawWing(g, SG.W - 100, 72, 0.95, -0.3);
    SG.ui.text(g, String(st.wings), SG.W - 84, 72, {
      size: 18, color: SG.COLORS.gold, align: 'left', stroke: '#1a1030', strokeWidth: 5, shadow: false,
    });
  }

  function heart(g, x, y, full) {
    g.save();
    g.translate(x, y);
    g.scale(1.1, 1.1);
    g.beginPath();
    g.moveTo(0, 8);
    g.bezierCurveTo(-12, -2, -9, -12, 0, -6);
    g.bezierCurveTo(9, -12, 12, -2, 0, 8);
    g.closePath();
    g.fillStyle = full ? '#ff4d6d' : 'rgba(255,255,255,0.16)';
    g.fill();
    g.strokeStyle = 'rgba(20,10,30,0.6)';
    g.lineWidth = 2;
    g.stroke();
    g.restore();
  }

  function drawMsg(g) {
    var a = SG.clamp(2.6 - st.msgT, 0, 1) * SG.clamp(st.msgT * 5, 0, 1);
    g.save();
    g.globalAlpha = a;
    SG.ui.text(g, st.msg.text, SG.W / 2, 128, {
      size: 30, color: st.msg.color, stroke: '#14102a', strokeWidth: 8, shadow: false,
    });
    g.restore();
  }

  function drawPad(g) {
    var l = padLeft(), r = padRight(), j = padJump();
    padBtn(g, l, 'left');
    padBtn(g, r, 'right');
    padBtn(g, j, 'jump');
  }

  function padBtn(g, r, kind) {
    var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    var held = false;
    for (var id in SG.input.pointers) {
      var p = SG.input.pointers[id];
      if (kind === 'jump' ? p.x > SG.W * 0.5 : inRect(p.x, p.y, r)) { held = true; break; }
    }
    g.save();
    g.globalAlpha = held ? 0.5 : 0.24;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = held ? 0.95 : 0.6;
    g.fillStyle = '#0e1430';
    if (kind === 'jump') {
      g.beginPath();
      g.moveTo(cx, cy - 17); g.lineTo(cx + 15, cy + 2); g.lineTo(cx + 6, cy + 2);
      g.lineTo(cx + 6, cy + 16); g.lineTo(cx - 6, cy + 16); g.lineTo(cx - 6, cy + 2);
      g.lineTo(cx - 15, cy + 2);
      g.closePath();
      g.fill();
    } else {
      // apex points the way the button actually moves him
      var d = kind === 'left' ? -1 : 1;
      g.beginPath();
      g.moveTo(cx + d * 12, cy); g.lineTo(cx - d * 10, cy - 14); g.lineTo(cx - d * 10, cy + 14);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  // ---------------------------------------------------------------
  // Overlays
  // ---------------------------------------------------------------
  function drawPaused(g) {
    var CX = SG.W / 2;
    g.fillStyle = 'rgba(5,6,14,0.8)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 170, 130, 340, 280);
    SG.ui.text(g, 'PAUSED', CX, 180, { size: 34, color: '#fff', shadow: false });
    if (SG.ui.button(g, { x: CX - 120, y: 222, w: 240, h: 48 }, 'RESUME', { color: SG.COLORS.gold })) st.paused = false;
    if (SG.ui.button(g, { x: CX - 120, y: 280, w: 240, h: 44 }, 'RESTART LEVEL', { color: '#3a4270', text: '#fff', size: 16 })) reset(st.levelIdx, st.score);
    if (SG.ui.button(g, { x: CX - 120, y: 334, w: 240, h: 44 }, 'MENU', { color: '#2a2f52', text: '#fff' })) SG.go('menu');
  }

  function drawClear(g) {
    if (st.endT < 0.7) return;
    var CX = SG.W / 2;
    g.fillStyle = 'rgba(5,6,14,0.82)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 220, 96, 440, 330);
    SG.ui.text(g, st.lv.name, CX, 142, {
      size: 26, color: '#8fd4ff', stroke: '#14102a', strokeWidth: 7, shadow: false,
    });
    SG.ui.text(g, 'CLEARED', CX, 178, { size: 34, color: '#fff', shadow: false });

    g.save();
    g.translate(CX - 66, 232);
    leaf(g, 1.1);
    g.restore();
    SG.ui.text(g, st.gems + ' sarsaparilla', CX - 44, 228, {
      size: 17, color: '#bff0a8', align: 'left', shadow: false,
    });
    SG.art.drawWing(g, CX - 66, 268, 1.15, -0.3);
    SG.ui.text(g, '+' + st.wings + ' wings', CX - 44, 268, {
      size: 17, color: SG.COLORS.gold, align: 'left', shadow: false,
    });
    SG.ui.text(g, 'SCORE  ' + st.score, CX, 308, { size: 15, color: 'rgba(255,255,255,0.55)', shadow: false });

    var next = LEVELS[st.levelIdx + 1];
    if (SG.ui.button(g, { x: CX - 190, y: 336, w: 180, h: 54 }, next.boss ? 'THE LAIR' : 'NEXT', { color: SG.COLORS.gold, size: 17 })) {
      reset(st.levelIdx + 1, st.score);
    }
    if (SG.ui.button(g, { x: CX + 10, y: 336, w: 180, h: 54 }, 'MENU', { color: '#3a4270', text: '#fff' })) SG.go('menu');
  }

  function drawDead(g) {
    if (st.endT < 0.5) return;
    var CX = SG.W / 2;
    g.fillStyle = 'rgba(5,6,14,0.86)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 220, 108, 440, 300);
    SG.art.tag(g, 'LAP!', CX, 158, 46, '#ff2d6f', -0.05);
    SG.ui.text(g, st.boss ? 'Gargamel wins this one.' : 'The village claims another.', CX, 202, {
      size: 15, color: 'rgba(255,255,255,0.6)', shadow: false,
    });
    SG.ui.text(g, String(st.score), CX, 250, { size: 34, color: '#fff', shadow: false });
    SG.ui.text(g, 'BEST  ' + SG.save.best('smurf'), CX, 282, { size: 13, color: 'rgba(255,255,255,0.4)', shadow: false });
    SG.art.drawWing(g, CX - 58, 310, 1.1, -0.3);
    SG.ui.text(g, '+' + st.wings + ' wings', CX - 38, 310, { size: 16, color: SG.COLORS.gold, align: 'left', shadow: false });

    if (SG.ui.button(g, { x: CX - 190, y: 336, w: 180, h: 54 }, 'AGAIN', { color: SG.COLORS.gold })) reset(st.levelIdx, 0);
    if (SG.ui.button(g, { x: CX + 10, y: 336, w: 180, h: 54 }, 'MENU', { color: '#3a4270', text: '#fff' })) SG.go('menu');
  }

  function drawWin(g) {
    if (st.endT < 1.2) return;
    var CX = SG.W / 2;
    g.fillStyle = 'rgba(5,6,14,0.85)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 230, 92, 460, 340);
    SG.ui.text(g, 'GARGAMEL FALLS', CX, 146, {
      size: 32, color: SG.COLORS.gold, stroke: '#14102a', strokeWidth: 8, shadow: false,
    });
    SG.ui.text(g, 'The village is smurfed. Or unsmurfed. One of the two.', CX, 184, {
      size: 13, color: 'rgba(255,255,255,0.55)', shadow: false,
    });
    SG.ui.text(g, String(st.score), CX, 236, { size: 40, color: '#fff', shadow: false });
    SG.ui.text(g, 'BEST  ' + SG.save.best('smurf'), CX, 272, { size: 13, color: 'rgba(255,255,255,0.4)', shadow: false });
    SG.art.drawWing(g, CX - 62, 306, 1.2, -0.3);
    SG.ui.text(g, '+' + st.wings + ' wings', CX - 40, 306, { size: 18, color: SG.COLORS.gold, align: 'left', shadow: false });

    if (SG.ui.button(g, { x: CX - 190, y: 342, w: 180, h: 54 }, 'PLAY AGAIN', { color: SG.COLORS.gold, size: 16 })) reset(0, 0);
    if (SG.ui.button(g, { x: CX + 10, y: 342, w: 180, h: 54 }, 'MENU', { color: '#3a4270', text: '#fff' })) SG.go('menu');
  }

  // ---------------------------------------------------------------
  SG.register('smurf', {
    enter: function () { reset(0, 0); },
    update: update,
    draw: draw,
    onBlur: function () { if (st && st.phase === 'play') st.paused = true; },
  });
})();
