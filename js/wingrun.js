/* =============================================================
   MODE 2 - CHICKEN WING RUN
   Pseudo-3D three-lane endless runner.
   Swipe left/right to switch lanes, up to jump, down to slide.
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  // ---- projection ------------------------------------------------
  var FOCAL = 520;
  var HORIZON = 170;
  var CAM_Y = 2.6;          // camera height in world units (1 unit ~ 1m)
  var CX = SG.W / 2;        // refreshed each frame - SG.W is aspect-dependent
  var PLAYER_Z = 5.2;
  var NEAR_Z = 3.4;
  var FAR_Z = 130;
  var LANE_X = [-1.75, 0, 1.75];
  var ROAD_HALF = 2.95;

  function pauseRect() { return { x: SG.W - 56, y: SG.H - 48, w: 40, h: 34 }; }

  function proj(wx, wy, z) {
    var s = FOCAL / z;
    return { x: CX + wx * s, y: HORIZON + (CAM_Y - wy) * s, s: s };
  }

  // ---- tuning ----------------------------------------------------
  var SPEED_START = 17;
  var SPEED_MAX = 46;
  var GRAVITY = 22;
  var JUMP_V = 8.2;
  var SLIDE_TIME = 0.55;
  var LANE_SNAP = 11;       // how fast the player slides between lanes
  var HURDLE_H = 0.78;      // must be above this to clear
  var LOWBAR_BOTTOM = 1.02; // must be sliding to pass under

  // ---- state -----------------------------------------------------
  var st;

  function reset() {
    st = {
      phase: 'ready',       // ready | run | dead | paused
      t: 0,
      countdown: 3.0,
      travel: 0,
      speed: SPEED_START,
      score: 0,
      wings: 0,
      lane: 1,
      laneX: LANE_X[1],
      y: 0,
      vy: 0,
      grounded: true,
      slide: 0,
      runPhase: 0,
      magnet: 0,
      sauce: 0,
      invuln: 0,
      ents: [],
      props: [],
      distToSpawn: 6,
      popups: [],
      dust: 0,
      newBest: false,
      deadT: 0,
      streak: 0,
      jumps: 0,
      nextFart: SG.randInt(5, 9),
    };
    for (var i = 0; i < 26; i++) {
      spawnProp(NEAR_Z + Math.random() * (FAR_Z - NEAR_Z));
    }
  }

  // ---- side scenery ---------------------------------------------
  var PROP_COLORS = ['#3b3157', '#4a3a5e', '#2e3560', '#573a54', '#3d4a5e', '#5c4438'];
  var SIGN_COLORS = ['#ffb02e', '#ff5a3d', '#4dd47a', '#4aa8ff'];

  function spawnProp(z) {
    var side = Math.random() < 0.5 ? -1 : 1;
    var kind = Math.random();
    var type = kind < 0.62 ? 'building' : kind < 0.82 ? 'tree' : 'billboard';

    // Rue and Daley turn up in windows now and then.
    var peek = null;
    if (type === 'building' && Math.random() < 0.22) {
      peek = Math.random() < 0.5 ? 'rue' : 'daley';
    }

    st.props.push({
      side: side,
      z: z,
      type: type,
      h: type === 'building' ? SG.rand(4.5, 10) : SG.rand(3.5, 6),
      w: SG.rand(1.8, 3.4),
      off: SG.rand(4.4, 7.5),
      c: SG.pick(PROP_COLORS),
      lit: Math.random() < 0.7,
      seed: SG.randInt(1, 100000),
      accent: SG.pick(SIGN_COLORS),
      peek: peek,
    });
  }

  // ---- spawn patterns -------------------------------------------
  function wingArc(lane, z, n, arc) {
    for (var i = 0; i < n; i++) {
      var f = n === 1 ? 0 : i / (n - 1);
      st.ents.push({
        type: 'wing',
        lane: lane,
        z: z + i * 1.7,
        wy: 0.95 + (arc ? Math.sin(f * Math.PI) * 1.15 : 0),
        rot: Math.random() * 6.28,
        gone: false,
        pz: 0,
      });
    }
  }

  function otherLanes(lane) {
    var o = [0, 1, 2].filter(function (l) { return l !== lane; });
    return o;
  }

  var PATTERNS = [
    // --- easy ---
    function (z) { wingArc(SG.randInt(0, 2), z, 5, false); },
    function (z) {
      var l = SG.randInt(0, 2);
      st.ents.push({ type: 'barrier', lane: l, z: z, gone: false, pz: 0 });
      wingArc(SG.pick(otherLanes(l)), z - 1, 4, false);
    },
    function (z) {
      var l = SG.randInt(0, 2);
      st.ents.push({ type: 'hurdle', lane: l, z: z, gone: false, pz: 0 });
      wingArc(l, z - 1.2, 5, true);
    },
    // --- medium ---
    function (z) {
      var open = SG.randInt(0, 2);
      otherLanes(open).forEach(function (l) {
        st.ents.push({ type: 'barrier', lane: l, z: z, gone: false, pz: 0 });
      });
      wingArc(open, z - 1, 4, false);
    },
    function (z) {
      st.ents.push({ type: 'lowbar', lane: null, z: z, gone: false, pz: 0 });
      wingArc(SG.randInt(0, 2), z + 4, 4, false);
    },
    function (z) {
      st.ents.push({ type: 'hurdle', lane: null, z: z, gone: false, pz: 0 });
      wingArc(SG.randInt(0, 2), z - 1.4, 5, true);
    },
    // --- spicy ---
    function (z) {
      var l = SG.randInt(0, 2);
      st.ents.push({ type: 'barrier', lane: l, z: z, gone: false, pz: 0 });
      var l2 = SG.pick(otherLanes(l));
      st.ents.push({ type: 'hurdle', lane: l2, z: z + 5, gone: false, pz: 0 });
      wingArc(l2, z + 3.8, 4, true);
    },
    function (z) {
      st.ents.push({ type: 'lowbar', lane: null, z: z, gone: false, pz: 0 });
      st.ents.push({ type: 'barrier', lane: SG.randInt(0, 2), z: z + 7, gone: false, pz: 0 });
      wingArc(SG.randInt(0, 2), z + 2, 3, false);
    },
  ];

  function spawnPattern() {
    var z = FAR_Z;
    // Ease the player in: only gentle patterns for the first stretch.
    var pool;
    if (st.travel < 220) pool = PATTERNS.slice(0, 3);
    else if (st.travel < 700) pool = PATTERNS.slice(0, 6);
    else pool = PATTERNS;
    SG.pick(pool)(z);

    if (Math.random() < 0.08) {
      st.ents.push({ type: 'magnet', lane: SG.randInt(0, 2), z: z + SG.rand(10, 20), wy: 1.1, gone: false, pz: 0, rot: 0 });
    }
    if (st.travel > 260 && Math.random() < 0.07) {
      st.ents.push({ type: 'sauce', lane: SG.randInt(0, 2), z: z + SG.rand(8, 22), wy: 1.1, gone: false, pz: 0, rot: 0 });
    }
  }

  // ---- helpers ---------------------------------------------------
  function playerHeadroom() {
    // Effective top of the player, in world units.
    return st.y + (st.slide > 0 ? 0.85 : 1.72);
  }

  function popup(text, color) {
    st.popups.push({ text: text, color: color || SG.COLORS.gold, t: 0 });
  }

  function die() {
    if (st.phase !== 'run') return;
    st.phase = 'dead';
    st.deadT = 0;
    SG.audio.play('crash');
    setTimeout(function () { SG.audio.play('lap'); }, 260);   // "Lap!"
    SG.shake(16);
    var p = proj(st.laneX, st.y + 0.8, PLAYER_Z);
    SG.burst(p.x, p.y, 26, { colors: ['#ff6b3d', '#ffb02e', '#fff4e0'], speedMax: 420, lift: 120 });

    st.score = Math.floor(st.travel * 2) + st.wings * 15;
    st.newBest = SG.save.submit('wingrun', st.score);
    SG.save.data.wings = (SG.save.data.wings || 0) + st.wings;
    SG.save.write();
  }

  // ---- update ----------------------------------------------------
  function update(dt) {
    CX = SG.W / 2;
    st.t += dt;

    for (var i = st.popups.length - 1; i >= 0; i--) {
      st.popups[i].t += dt;
      if (st.popups[i].t > 1.1) st.popups.splice(i, 1);
    }

    if (st.phase === 'paused') return;

    if (st.phase === 'dead') {
      st.deadT += dt;
      return;
    }

    // Pause is claimed before anything else consumes the tap.
    if (SG.input.tappedRect(pauseRect())) {
      st.phase = 'paused';
      SG.input.releaseAll();     // a way out of a touch that never ended
      SG.audio.play('back');
      return;
    }

    if (st.phase === 'ready') {
      st.countdown -= dt;
      // A swipe or tap skips the countdown.
      if (SG.input.swipes.length || SG.input.taps.length) st.countdown = Math.min(st.countdown, 0.35);
      if (st.countdown <= 0) { st.phase = 'run'; SG.audio.play('power'); }
      st.runPhase += dt * 6;
      return;
    }

    // ---- input ----
    handleControls();

    // ---- speed / distance ----
    st.speed = Math.min(SPEED_MAX, SPEED_START + st.travel * 0.012) * (st.sauce > 0 ? 1.3 : 1);
    st.travel += st.speed * dt;
    st.score = Math.floor(st.travel * 2) + st.wings * 15;

    // ---- player physics ----
    st.laneX += (LANE_X[st.lane] - st.laneX) * Math.min(1, LANE_SNAP * dt);

    if (!st.grounded) {
      st.vy -= GRAVITY * dt;
      st.y += st.vy * dt;
      if (st.y <= 0) {
        st.y = 0;
        st.vy = 0;
        st.grounded = true;
        var lp = proj(st.laneX, 0, PLAYER_Z);
        SG.burst(lp.x, lp.y, 6, { colors: ['#8b7f6b'], speedMax: 120, gravity: 500, rMax: 4 });
      }
    }

    if (st.slide > 0) {
      st.slide -= dt;
      st.dust += dt;
      if (st.dust > 0.05) {
        st.dust = 0;
        var sp = proj(st.laneX, 0.1, PLAYER_Z);
        SG.burst(sp.x, sp.y, 3, { colors: ['#9c8f7a', '#c4b49a'], angle: Math.PI, speedMin: 80, speedMax: 200, gravity: 260, rMax: 5, life: 0.5 });
      }
    }

    st.runPhase += dt * (7 + st.speed * 0.32);
    if (st.magnet > 0) st.magnet -= dt;
    if (st.invuln > 0) st.invuln -= dt;
    if (st.sauce > 0) {
      var was = st.sauce;
      st.sauce -= dt;

      // Warn before it drops, so you don't run into a crate still
      // believing you're invincible.
      if (was > 2 && st.sauce <= 2) {
        popup('SAUCE RUNNING OUT!', SG.COLORS.sauce);
        SG.audio.play('back');
      }
      if (st.sauce <= 0) {
        popup('SAUCE GONE', '#ff6b5c');
        SG.audio.play('back');       // not a loss - keep "Lap!" for those
        SG.shake(4);
      }

      // Flame trail thins out and cools as it expires.
      var fade = SG.clamp(st.sauce / 2, 0, 1);
      var fp = proj(st.laneX, 0.5, PLAYER_Z);
      SG.burst(fp.x, fp.y, st.sauce > 2 ? 2 : 1, {
        colors: st.sauce > 2 ? ['#ff2d0a', '#ff8a1a', '#ffd400'] : ['#8a6a5a', '#c08a5a'],
        angle: Math.PI / 2, speedMin: 30, speedMax: 60 + 70 * fade,
        gravity: -260, rMax: 3 + 4 * fade, life: 0.45,
      });
    }

    // ---- spawning ----
    st.distToSpawn -= st.speed * dt;
    if (st.distToSpawn <= 0) {
      spawnPattern();
      st.distToSpawn = 11 + st.speed * 0.36;
    }

    // ---- entities ----
    var dz = st.speed * dt;
    for (var e = st.ents.length - 1; e >= 0; e--) {
      var en = st.ents[e];
      en.pz = en.z;
      en.z -= dz;
      if (en.rot !== undefined) en.rot += dt * 2.5;

      if (en.z < NEAR_Z - 1) { st.ents.splice(e, 1); continue; }
      if (en.gone) continue;

      // Did it cross the player's plane this frame?
      if (en.pz > PLAYER_Z && en.z <= PLAYER_Z) resolveHit(en);
    }

    // ---- scenery ----
    for (var p = st.props.length - 1; p >= 0; p--) {
      st.props[p].z -= dz;
      if (st.props[p].z < NEAR_Z - 2) {
        st.props.splice(p, 1);
        spawnProp(FAR_Z + SG.rand(0, 12));
      }
    }
  }

  function handleControls() {
    var sw;
    while ((sw = SG.input.takeAnySwipe())) {
      if (sw === 'left' && st.lane > 0) { st.lane--; SG.audio.play('tap'); }
      else if (sw === 'right' && st.lane < 2) { st.lane++; SG.audio.play('tap'); }
      else if (sw === 'up') jump();
      else if (sw === 'down') startSlide();
    }

    // Tap zones as a fallback for people who don't swipe.
    var tap;
    while ((tap = SG.input.takeTap())) {
      if (tap.y < 116) continue;             // HUD strip
      if (tap.x < SG.W * 0.3) { if (st.lane > 0) { st.lane--; SG.audio.play('tap'); } }
      else if (tap.x > SG.W * 0.7) { if (st.lane < 2) { st.lane++; SG.audio.play('tap'); } }
      else jump();
    }
  }

  function jump() {
    if (!st.grounded) return;
    st.grounded = false;
    st.slide = 0;
    st.vy = JUMP_V;

    // Roughly every tenth jump, something else happens. Randomised a
    // little so it isn't metronomic. If the clip isn't decoded yet the
    // call fails and we just play the normal hop, then try again next time.
    st.jumps++;
    if (st.jumps >= st.nextFart && SG.audio.playSample('fart', 0.85)) {
      st.nextFart = st.jumps + SG.randInt(8, 13);
    } else {
      SG.audio.play('jump');
    }
  }

  function startSlide() {
    if (!st.grounded) {
      // Slam down out of a jump, then slide.
      st.vy = -18;
      st.slide = SLIDE_TIME;
      return;
    }
    if (st.slide > 0) return;
    st.slide = SLIDE_TIME;
    SG.audio.play('slide');
  }

  function resolveHit(en) {
    var sameLane = en.lane === null || en.lane === st.lane;

    if (en.type === 'wing') {
      var grab = sameLane || st.magnet > 0 || st.sauce > 0;
      if (grab) {
        // must be roughly at the wing's height
        var dy = Math.abs((st.y + 0.85) - en.wy);
        if (st.magnet > 0 || st.sauce > 0 || dy < 1.25) {
          en.gone = true;
          st.wings++;
          st.streak++;
          var pp = proj(LANE_X[st.lane], en.wy, PLAYER_Z);
          SG.burst(pp.x, pp.y, 7, { colors: ['#ffb02e', '#fff4e0', '#ff8a3d'], speedMax: 170, gravity: 300, rMax: 4, life: 0.5 });
          if (st.streak > 0 && st.streak % 15 === 0) {
            SG.audio.play('wingbig');
            popup(st.streak + ' WING STREAK!', SG.COLORS.gold);
          } else {
            SG.audio.play('wing');
          }
        }
      }
      return;
    }

    if (en.type === 'magnet') {
      if (sameLane || Math.abs(LANE_X[st.lane] - LANE_X[en.lane]) < 2) {
        en.gone = true;
        st.magnet = 8;
        SG.audio.play('power');
        popup('WING MAGNET!', '#4dd47a');
        var mp = proj(LANE_X[en.lane], en.wy, PLAYER_Z);
        SG.burst(mp.x, mp.y, 18, { colors: ['#4dd47a', '#fff4e0'], speedMax: 260, gravity: 200 });
      }
      return;
    }

    if (en.type === 'sauce') {
      if (sameLane || Math.abs(LANE_X[st.lane] - LANE_X[en.lane]) < 2) {
        en.gone = true;
        st.sauce = 6;
        st.invuln = 6;
        SG.audio.play('sauce');
        popup('HOT SAUCE!', SG.COLORS.sauce);
        SG.shake(7);
        var hp = proj(LANE_X[en.lane], en.wy, PLAYER_Z);
        SG.burst(hp.x, hp.y, 24, { colors: ['#ff2d0a', '#ff8a1a', '#ffd400'], speedMax: 300, gravity: 120 });
      }
      return;
    }

    if (!sameLane || st.invuln > 0) return;

    if (en.type === 'hurdle') {
      if (st.y > HURDLE_H) return;          // cleared it
      die();
    } else if (en.type === 'lowbar') {
      if (st.slide > 0 && st.y < 0.05) return;
      if (playerHeadroom() < LOWBAR_BOTTOM) return;
      die();
    } else if (en.type === 'barrier') {
      if (st.y > 1.5) return;               // a really good jump clears a crate
      die();
    }
  }

  // ---- drawing ---------------------------------------------------
  /* ---- Brussels at dusk, sprayed over ---- */

  function drawSky(g) {
    var sky = g.createLinearGradient(0, 0, 0, HORIZON + 60);
    sky.addColorStop(0, '#180b3a');
    sky.addColorStop(0.4, '#5b1a63');
    sky.addColorStop(0.72, '#c22a5a');
    sky.addColorStop(1, '#ff8a2b');
    g.fillStyle = sky;
    g.fillRect(0, 0, SG.W, HORIZON + 60);

    // sun, sprayed rather than drawn
    var sunX = CX + 150, sunY = HORIZON - 52;
    var sg = g.createRadialGradient(sunX, sunY, 8, sunX, sunY, 140);
    sg.addColorStop(0, 'rgba(255,225,120,0.95)');
    sg.addColorStop(0.35, 'rgba(255,120,40,0.5)');
    sg.addColorStop(1, 'rgba(255,90,40,0)');
    g.fillStyle = sg;
    g.fillRect(sunX - 150, sunY - 150, 300, 300);
    g.fillStyle = '#ffd85c';
    g.beginPath();
    g.arc(sunX, sunY, 38, 0, Math.PI * 2);
    g.fill();

    // clouds
    var drift = st.travel * 0.35;
    for (var c = 0; c < 5; c++) {
      var cx = ((c * 317 - drift) % (SG.W + 300)) - 150;
      if (cx < -160) cx += SG.W + 300;
      g.fillStyle = 'rgba(255,255,255,' + (0.05 + (c % 3) * 0.02) + ')';
      puff(g, cx, 40 + (c % 3) * 34, 44);
    }

    // the Atomium, parked on the horizon
    drawAtomium(g, CX - 268 - (st.travel * 0.5) % 40, HORIZON - 96, 15);

    // parallax skyline of stepped-gable guildhouses
    var off = (st.travel * 1.4) % 260;
    for (var i = -1; i < 7; i++) guildRow(g, i * 260 - off);
  }

  function puff(g, x, y, r) {
    g.beginPath();
    g.arc(x - r * 0.6, y + r * 0.1, r * 0.55, 0, Math.PI * 2);
    g.arc(x, y - r * 0.15, r * 0.75, 0, Math.PI * 2);
    g.arc(x + r * 0.65, y + r * 0.05, r * 0.5, 0, Math.PI * 2);
    g.fill();
  }

  // Nine spheres on a cube standing on its vertex.
  var ATOM_NODES = [[0, -2.25], [-1.55, -0.85], [1.55, -0.85], [0, 0], [-1.55, 0.85], [1.55, 0.85], [0, 2.25]];
  var ATOM_EDGES = [[0, 1], [0, 2], [0, 3], [3, 1], [3, 2], [3, 4], [3, 5], [6, 4], [6, 5], [6, 3], [1, 4], [2, 5]];

  function drawAtomium(g, x, y, r) {
    g.save();
    g.strokeStyle = 'rgba(22,12,44,0.9)';
    g.lineWidth = r * 0.42;
    g.lineCap = 'round';
    for (var e = 0; e < ATOM_EDGES.length; e++) {
      var a = ATOM_NODES[ATOM_EDGES[e][0]], b = ATOM_NODES[ATOM_EDGES[e][1]];
      g.beginPath();
      g.moveTo(x + a[0] * r * 1.6, y + a[1] * r * 1.6);
      g.lineTo(x + b[0] * r * 1.6, y + b[1] * r * 1.6);
      g.stroke();
    }
    for (var n = 0; n < ATOM_NODES.length; n++) {
      var p = ATOM_NODES[n];
      var px = x + p[0] * r * 1.6, py = y + p[1] * r * 1.6;
      g.fillStyle = 'rgba(22,12,44,0.95)';
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,190,90,0.5)';   // sun catching the spheres
      g.beginPath();
      g.arc(px + r * 0.28, py - r * 0.28, r * 0.34, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // A row of Grand-Place style stepped gables.
  var GABLES = [[0, 58, 34], [36, 82, 30], [68, 46, 38], [108, 96, 32], [142, 64, 36], [180, 78, 30], [212, 52, 34]];

  function guildRow(g, bx) {
    for (var i = 0; i < GABLES.length; i++) {
      var gx = bx + GABLES[i][0], gh = GABLES[i][1], gw = GABLES[i][2];
      stepGable(g, gx, HORIZON - gh, gw, gh + 6, 4 + (i % 3));
      // a couple of lit windows
      g.fillStyle = 'rgba(255,206,120,0.35)';
      for (var wy = 0; wy < 2; wy++) {
        for (var wx = 0; wx < 2; wx++) {
          if ((i + wx + wy) % 3 === 0) continue;
          g.fillRect(gx + 6 + wx * (gw * 0.45), HORIZON - gh * 0.55 + wy * 14, gw * 0.22, 8);
        }
      }
    }
  }

  function stepGable(g, x, y, w, h, steps) {
    g.fillStyle = 'rgba(16,8,34,0.88)';
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y + h * 0.4);
    // stair-step up to the peak and back down
    var sw = w / (steps * 2), sh = (h * 0.4) / steps;
    for (var s = 0; s < steps; s++) {
      g.lineTo(x + s * sw, y + h * 0.4 - s * sh);
      g.lineTo(x + (s + 1) * sw, y + h * 0.4 - s * sh);
      g.lineTo(x + (s + 1) * sw, y + h * 0.4 - (s + 1) * sh);
    }
    g.lineTo(x + w / 2, y);
    for (var s2 = steps - 1; s2 >= 0; s2--) {
      g.lineTo(x + w - (s2 + 1) * sw, y + h * 0.4 - (s2 + 1) * sh);
      g.lineTo(x + w - (s2 + 1) * sw, y + h * 0.4 - s2 * sh);
      g.lineTo(x + w - s2 * sw, y + h * 0.4 - s2 * sh);
    }
    g.lineTo(x + w, y + h * 0.4);
    g.lineTo(x + w, y + h);
    g.closePath();
    g.fill();
  }

  function drawRoad(g) {
    var nl = proj(-ROAD_HALF, 0, NEAR_Z);
    var nr = proj(ROAD_HALF, 0, NEAR_Z);
    var fl = proj(-ROAD_HALF, 0, FAR_Z);
    var fr = proj(ROAD_HALF, 0, FAR_Z);

    // ground either side
    var gnd = g.createLinearGradient(0, HORIZON, 0, SG.H);
    gnd.addColorStop(0, '#241a3c');
    gnd.addColorStop(1, '#120c22');
    g.fillStyle = gnd;
    g.fillRect(0, HORIZON, SG.W, SG.H - HORIZON);

    // road surface
    var rd = g.createLinearGradient(0, fl.y, 0, nl.y);
    rd.addColorStop(0, '#4a4260');
    rd.addColorStop(1, '#2e2a3f');
    g.fillStyle = rd;
    g.beginPath();
    g.moveTo(nl.x, nl.y);
    g.lineTo(nr.x, nr.y);
    g.lineTo(fr.x, fr.y);
    g.lineTo(fl.x, fl.y);
    g.closePath();
    g.fill();

    // kerbs
    g.fillStyle = 'rgba(255,255,255,0.10)';
    quad(g, -ROAD_HALF - 0.16, -ROAD_HALF, NEAR_Z, FAR_Z);
    quad(g, ROAD_HALF, ROAD_HALF + 0.16, NEAR_Z, FAR_Z);

    // Nothing decorative goes on the road surface - anything down here
    // competes with the obstacles for your attention. Keep the graffiti
    // on the walls where it belongs.

    // dashed lane dividers
    g.fillStyle = 'rgba(255,244,224,0.55)';
    var period = 5.0;
    var phase = st.travel % period;
    for (var d = 0; d < 34; d++) {
      var z0 = NEAR_Z + d * period - phase;
      var z1 = z0 + 2.4;
      if (z1 <= NEAR_Z) continue;
      if (z0 >= FAR_Z) break;
      z0 = Math.max(z0, NEAR_Z);
      quad(g, -0.875 - 0.05, -0.875 + 0.05, z0, z1);
      quad(g, 0.875 - 0.05, 0.875 + 0.05, z0, z1);
    }
  }

  function quad(g, wx0, wx1, z0, z1) {
    var a = proj(wx0, 0, z0), b = proj(wx1, 0, z0);
    var c = proj(wx1, 0, z1), d = proj(wx0, 0, z1);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.closePath();
    g.fill();
  }

  function drawProps(g) {
    var sorted = st.props.slice().sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < sorted.length; i++) {
      var p = sorted[i];
      if (p.z <= NEAR_Z) continue;
      var wx = p.side * p.off;
      var base = proj(wx, 0, p.z);
      var top = proj(wx, p.h, p.z);
      var halfW = (p.w / 2) * base.s;
      if (halfW < 0.4) continue;

      if (p.type === 'tree') {
        g.fillStyle = '#3a2a1e';
        g.fillRect(base.x - halfW * 0.18, top.y + (base.y - top.y) * 0.55, halfW * 0.36, (base.y - top.y) * 0.45);
        g.fillStyle = '#2d5c3c';
        g.beginPath();
        g.ellipse(base.x, top.y + (base.y - top.y) * 0.35, halfW * 1.1, (base.y - top.y) * 0.42, 0, 0, Math.PI * 2);
        g.fill();
      } else if (p.type === 'billboard') {
        // "Santi Can't" - the channel, up in lights
        g.fillStyle = '#2a2a3e';
        g.fillRect(base.x - halfW * 0.09, top.y, halfW * 0.18, base.y - top.y);
        var bw = halfW * 2.3, bh = bw * 0.42;
        g.fillStyle = '#14102a';
        SG.roundRect(g, base.x - bw / 2, top.y - bh * 0.5, bw, bh, bw * 0.05);
        g.fill();
        g.strokeStyle = p.accent;
        g.lineWidth = Math.max(1, bw * 0.03);
        g.stroke();
        if (bw > 26) {
          SG.ui.text(g, 'SANTI', base.x, top.y - bh * 0.16, { size: bw * 0.2, color: '#fff', shadow: false });
          SG.ui.text(g, "CAN'T", base.x, top.y + bh * 0.16, { size: bw * 0.2, color: p.accent, shadow: false });
        }
      } else {
        var bh2 = base.y - top.y;
        g.fillStyle = p.c;
        g.fillRect(base.x - halfW, top.y, halfW * 2, bh2);
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(base.x - halfW, top.y, halfW * 0.3, bh2);

        // windows
        if (halfW > 3) {
          var rows = Math.floor(bh2 / (halfW * 0.75));
          for (var r = 0; r < rows; r++) {
            for (var c = 0; c < 3; c++) {
              if ((r * 3 + c + p.seed) % 3 === 0) continue;
              g.fillStyle = p.lit ? 'rgba(255,214,120,0.5)' : 'rgba(140,170,220,0.16)';
              g.fillRect(base.x - halfW * 0.7 + c * halfW * 0.55, top.y + halfW * 0.35 + r * halfW * 0.75, halfW * 0.3, halfW * 0.34);
            }
          }
        }

        // roofline trim, just enough to break up the flat façade
        if (halfW > 5) {
          g.fillStyle = 'rgba(255,255,255,0.07)';
          g.fillRect(base.x - halfW, top.y, halfW * 2, Math.max(1, halfW * 0.12));
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(base.x - halfW, base.y - Math.max(1, halfW * 0.16), halfW * 2, Math.max(1, halfW * 0.16));
        }

        // easter egg: Rue or Daley at a window
        if (p.peek && halfW > 9) {
          // The head cutout, not the circular bust - it has a transparent
          // background, so it reads as someone leaning into the window.
          var head = SG.art.heads[p.peek];
          var fw = halfW * 0.66;
          var fx = base.x + halfW * 0.26;
          var fy = top.y + bh2 * 0.34;
          var wx0 = fx - fw * 0.8, wy0 = fy - fw * 0.95, ww = fw * 1.6, wh = fw * 1.9;

          g.save();
          g.fillStyle = 'rgba(255,214,132,0.92)';         // lit room behind them
          g.fillRect(wx0, wy0, ww, wh);
          g.beginPath();
          g.rect(wx0, wy0, ww, wh);
          g.clip();
          if (head) {
            var hh = wh * 1.12;
            var hwid = hh * (head.width / head.height);
            g.drawImage(head, fx - hwid / 2, wy0 + wh * 0.1, hwid, hh);
          }
          g.restore();

          g.strokeStyle = 'rgba(20,14,34,0.9)';
          g.lineWidth = Math.max(1, halfW * 0.07);
          g.strokeRect(wx0, wy0, ww, wh);
          g.beginPath();                                  // window frame
          g.moveTo(wx0 + ww / 2, wy0);
          g.lineTo(wx0 + ww / 2, wy0 + wh);
          g.moveTo(wx0, wy0 + wh * 0.45);
          g.lineTo(wx0 + ww, wy0 + wh * 0.45);
          g.stroke();
        }
      }
    }
  }

  // Solid box with a visible top face, for obstacles.
  function box(g, wxC, halfW, wyBot, wyTop, z, depth, front, top, side) {
    var zn = z - depth / 2, zf = z + depth / 2;
    if (zn <= NEAR_Z * 0.6) return;
    var fnl = proj(wxC - halfW, wyTop, zn), fnr = proj(wxC + halfW, wyTop, zn);
    var bnl = proj(wxC - halfW, wyBot, zn), bnr = proj(wxC + halfW, wyBot, zn);
    var ffl = proj(wxC - halfW, wyTop, zf), ffr = proj(wxC + halfW, wyTop, zf);

    // top face
    g.fillStyle = top;
    g.beginPath();
    g.moveTo(fnl.x, fnl.y); g.lineTo(fnr.x, fnr.y);
    g.lineTo(ffr.x, ffr.y); g.lineTo(ffl.x, ffl.y);
    g.closePath();
    g.fill();

    // side hint
    g.fillStyle = side;
    g.beginPath();
    g.moveTo(fnl.x, fnl.y); g.lineTo(ffl.x, ffl.y);
    g.lineTo(ffl.x, ffl.y + (bnl.y - fnl.y) * 0.8); g.lineTo(bnl.x, bnl.y);
    g.closePath();
    g.fill();

    // front face
    g.fillStyle = front;
    g.beginPath();
    g.moveTo(fnl.x, fnl.y); g.lineTo(fnr.x, fnr.y);
    g.lineTo(bnr.x, bnr.y); g.lineTo(bnl.x, bnl.y);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = Math.max(1, fnl.s * 0.02);
    g.stroke();
  }

  function drawEntity(g, en) {
    if (en.gone || en.z <= NEAR_Z) return;
    var wx = en.lane === null ? 0 : LANE_X[en.lane];

    if (en.type === 'wing') {
      var p = proj(wx, en.wy, en.z);
      var scale = p.s * 0.021;
      if (scale < 0.07) return;
      g.save();
      g.globalAlpha = SG.clamp((FAR_Z - en.z) / 30, 0, 1);
      // glow so they stay readable against the road at distance
      var gr = 22 * scale;
      var rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
      rg.addColorStop(0, 'rgba(255,196,90,0.55)');
      rg.addColorStop(0.5, 'rgba(255,150,50,0.22)');
      rg.addColorStop(1, 'rgba(255,150,50,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(p.x, p.y, gr, 0, Math.PI * 2);
      g.fill();
      SG.art.drawWing(g, p.x, p.y, scale, en.rot);
      g.restore();
      return;
    }

    if (en.type === 'sauce') {
      var hp = proj(wx, en.wy, en.z);
      var hs = hp.s * 0.021;
      if (hs < 0.09) return;
      g.save();
      g.translate(hp.x, hp.y);
      g.rotate(Math.sin(en.rot) * 0.2);
      g.scale(hs, hs);
      g.fillStyle = 'rgba(255,60,20,0.22)';
      g.beginPath(); g.arc(0, 0, 32, 0, Math.PI * 2); g.fill();
      // bottle
      g.fillStyle = '#c8181c';
      g.strokeStyle = '#2c0d0d';
      g.lineWidth = 2;
      SG.roundRect(g, -9, -8, 18, 26, 4);
      g.fill(); g.stroke();
      g.fillStyle = '#ffd400';                 // cap
      SG.roundRect(g, -6, -20, 12, 12, 3);
      g.fill(); g.stroke();
      g.fillStyle = '#fff4e0';                 // label
      SG.roundRect(g, -7, -1, 14, 12, 2);
      g.fill();
      g.fillStyle = '#c8181c';
      g.beginPath();                            // little flame on the label
      g.moveTo(0, 1); g.quadraticCurveTo(4, 5, 0, 9); g.quadraticCurveTo(-4, 5, 0, 1);
      g.fill();
      g.restore();
      return;
    }

    if (en.type === 'magnet') {
      var mp = proj(wx, en.wy, en.z);
      var ms = mp.s * 0.02;
      if (ms < 0.1) return;
      g.save();
      g.translate(mp.x, mp.y);
      g.rotate(Math.sin(en.rot) * 0.25);
      g.scale(ms, ms);
      g.fillStyle = 'rgba(77,212,122,0.2)';
      g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#4dd47a';
      g.lineWidth = 9;
      g.lineCap = 'butt';
      g.beginPath();
      g.arc(0, 2, 15, Math.PI, 0);
      g.stroke();
      g.fillStyle = '#e8202a';
      g.fillRect(-19.5, 2, 9, 12);
      g.fillRect(10.5, 2, 9, 12);
      g.restore();
      return;
    }

    if (en.type === 'barrier') {
      box(g, wx, 0.7, 0, 1.35, en.z, 0.8, '#c33a2e', '#e05a44', '#8e2a20');
      // hazard stripes on the front
      var fl = proj(wx - 0.7, 1.35, en.z - 0.4);
      var fr2 = proj(wx + 0.7, 0, en.z - 0.4);
      var w = fr2.x - fl.x, h = fr2.y - fl.y;
      if (w > 6) {
        g.save();
        g.beginPath();
        g.rect(fl.x, fl.y, w, h);
        g.clip();
        g.fillStyle = 'rgba(255,244,224,0.9)';
        for (var i = -2; i < 8; i++) {
          g.beginPath();
          g.moveTo(fl.x + i * w * 0.26, fl.y);
          g.lineTo(fl.x + i * w * 0.26 + w * 0.13, fl.y);
          g.lineTo(fl.x + i * w * 0.26 + w * 0.13 + h * 0.5, fl.y + h);
          g.lineTo(fl.x + i * w * 0.26 + h * 0.5, fl.y + h);
          g.closePath();
          g.fill();
        }
        g.restore();
      }
      return;
    }

    if (en.type === 'hurdle') {
      var half = en.lane === null ? ROAD_HALF - 0.1 : 0.75;
      box(g, wx, half, 0, HURDLE_H, en.z, 0.5, '#d8a12e', '#ffcb5c', '#9c6f14');
      return;
    }

    if (en.type === 'lowbar') {
      var hw = en.lane === null ? ROAD_HALF - 0.1 : 0.75;
      // bar
      box(g, wx, hw, LOWBAR_BOTTOM, 2.1, en.z, 0.45, '#3d4b8e', '#5b6cc0', '#27306a');
      // legs
      box(g, wx - hw + 0.18, 0.18, 0, LOWBAR_BOTTOM, en.z, 0.4, '#2b3468', '#3d4b8e', '#1d2450');
      box(g, wx + hw - 0.18, 0.18, 0, LOWBAR_BOTTOM, en.z, 0.4, '#2b3468', '#3d4b8e', '#1d2450');
      // "SLIDE" callout
      var lp = proj(wx, 1.55, en.z);
      if (lp.s > 26) {
        SG.ui.text(g, 'SLIDE', lp.x, lp.y, { size: lp.s * 0.16, color: '#fff4e0', shadow: false });
      }
      return;
    }
  }

  function drawPlayer(g) {
    var feet = proj(st.laneX, st.y, PLAYER_Z);
    var ground = proj(st.laneX, 0, PLAYER_Z);
    var h = 1.72 * feet.s;

    // shadow
    var airT = SG.clamp(st.y / 1.6, 0, 1);
    g.fillStyle = 'rgba(0,0,0,' + (0.4 - airT * 0.26) + ')';
    g.beginPath();
    g.ellipse(ground.x, ground.y, h * 0.24 * (1 - airT * 0.35), h * 0.075 * (1 - airT * 0.35), 0, 0, Math.PI * 2);
    g.fill();

    // Hot-sauce aura. Under 2s it flashes hard and dims - the same
    // "about to expire" language as the HUD bar.
    if (st.sauce > 0) {
      var ending = st.sauce <= 2;
      var blink = ending ? (0.16 + Math.abs(Math.sin(st.t * 16)) * 0.34) : (0.3 + Math.sin(st.t * 18) * 0.1);
      var ag = g.createRadialGradient(ground.x, ground.y - h * 0.42, h * 0.08, ground.x, ground.y - h * 0.42, h * 0.62);
      ag.addColorStop(0, 'rgba(255,120,20,' + blink + ')');
      ag.addColorStop(1, 'rgba(255,60,10,0)');
      g.fillStyle = ag;
      g.fillRect(ground.x - h * 0.7, ground.y - h * 1.1, h * 1.4, h * 1.4);
    }

    // magnet aura
    if (st.magnet > 0) {
      g.save();
      g.globalAlpha = 0.35 + Math.sin(st.t * 12) * 0.12;
      g.strokeStyle = '#4dd47a';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(ground.x, ground.y - h * 0.4, h * 0.42, h * 0.55, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    g.save();
    if (st.invuln > 0 && Math.floor(st.t * 20) % 2 === 0) g.globalAlpha = 0.4;

    var sliding = st.slide > 0;
    if (sliding) {
      g.translate(feet.x, feet.y);
      g.rotate(-0.95);
      g.translate(-feet.x, -feet.y + h * 0.06);
    }

    SG.art.drawSanti(g, feet.x, feet.y, sliding ? h * 0.92 : h, st.runPhase, {
      shirt: SG.COLORS.purple,
      boxColor: SG.COLORS.red,
      pants: '#232a46',
      run: st.grounded && !sliding ? 1 : 0.25,
      face: 'santi',
    });
    g.restore();

    // speed lines
    if (st.speed > 26) {
      g.strokeStyle = 'rgba(255,255,255,' + SG.clamp((st.speed - 26) / 40, 0, 0.22) + ')';
      g.lineWidth = 2;
      for (var i = 0; i < 6; i++) {
        var ly = 210 + ((st.t * 900 + i * 90) % 320);
        var lx = (i % 2 ? 1 : -1) * (300 + (i * 37) % 140) + CX;
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(lx, ly + 46);
        g.stroke();
      }
    }
  }

  function drawHUD(g) {
    // score
    SG.ui.text(g, String(st.score), 24, 38, { size: 34, color: '#fff', align: 'left', stroke: '#1a1030', strokeWidth: 7, shadow: false });
    SG.ui.text(g, 'BEST ' + SG.save.best('wingrun'), 26, 66, { size: 13, color: 'rgba(255,255,255,0.5)', align: 'left', shadow: false });

    // wings
    SG.art.drawWing(g, SG.W - 104, 36, 1.15, -0.3);
    SG.ui.text(g, String(st.wings), SG.W - 84, 36, { size: 26, color: SG.COLORS.gold, align: 'left', stroke: '#1a1030', strokeWidth: 6, shadow: false });

    // power-up timers
    var bar = 0;
    if (st.sauce > 0) { powerBar(g, bar++, st.sauce / 6, SG.COLORS.sauce, 'HOT SAUCE', st.sauce); }
    if (st.magnet > 0) { powerBar(g, bar++, st.magnet / 8, '#4dd47a', 'MAGNET', st.magnet); }

    // popups
    for (var i = 0; i < st.popups.length; i++) {
      var p = st.popups[i];
      var k = p.t / 1.1;
      g.save();
      g.globalAlpha = 1 - k * k;
      SG.ui.text(g, p.text, CX, 130 - k * 34, { size: 26, color: p.color, stroke: '#1a1030', strokeWidth: 7, shadow: false });
      g.restore();
    }

    // pause (input handled up in update so nothing else steals the tap)
    if (st.phase === 'run' || st.phase === 'ready') {
      var pr = pauseRect();
      g.fillStyle = 'rgba(10,12,26,0.5)';
      SG.roundRect(g, pr.x, pr.y, pr.w, pr.h, 8);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(pr.x + 13, pr.y + 10, 5, 15);
      g.fillRect(pr.x + 23, pr.y + 10, 5, 15);
    }
  }

  function powerBar(g, slot, frac, color, label, secsLeft) {
    var y = 22 + slot * 30;
    var ending = secsLeft !== undefined && secsLeft <= 2;
    // Flash the whole bar once it's nearly out - a slowly shrinking bar
    // is far too easy to miss while you're watching the road.
    var flash = ending && Math.floor(st.t * 8) % 2 === 0;

    g.fillStyle = 'rgba(0,0,0,0.45)';
    SG.roundRect(g, CX - 75, y, 150, 12, 6);
    g.fill();
    g.fillStyle = flash ? '#fff4e0' : color;
    SG.roundRect(g, CX - 75, y, 150 * SG.clamp(frac, 0, 1), 12, 6);
    g.fill();

    if (ending) {
      g.strokeStyle = flash ? '#fff4e0' : color;
      g.lineWidth = 2;
      SG.roundRect(g, CX - 77, y - 2, 154, 16, 8);
      g.stroke();
    }

    SG.ui.text(g, ending ? label + '  ' + secsLeft.toFixed(1) + 's' : label, CX, y + 20, {
      size: 11, color: flash ? '#fff4e0' : color, shadow: false,
    });
  }

  function drawReady(g) {
    var n = Math.ceil(st.countdown);
    var frac = st.countdown - Math.floor(st.countdown);
    g.save();
    g.globalAlpha = SG.clamp(frac * 2.2, 0, 1);
    var label = n <= 0 ? 'GO!' : String(n);
    var sc = 1 + (1 - frac) * 0.5;
    g.translate(CX, 250);
    g.scale(sc, sc);
    SG.ui.text(g, label, 0, 0, { size: 78, color: SG.COLORS.gold, stroke: '#1a1030', strokeWidth: 12, shadow: false });
    g.restore();

    SG.ui.text(g, 'SWIPE  ←  →  to switch lanes', CX, 400, { size: 18, color: 'rgba(255,255,255,0.8)', stroke: '#1a1030', strokeWidth: 5, shadow: false });
    SG.ui.text(g, 'SWIPE  ↑  jump      SWIPE  ↓  slide', CX, 428, { size: 16, color: 'rgba(255,255,255,0.6)', stroke: '#1a1030', strokeWidth: 4, shadow: false });
  }

  function drawPaused(g) {
    g.fillStyle = 'rgba(5,6,14,0.78)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 170, 130, 340, 280);
    SG.ui.text(g, 'PAUSED', CX, 180, { size: 34, color: '#fff', shadow: false });

    if (SG.ui.button(g, { x: CX - 120, y: 222, w: 240, h: 48 }, 'RESUME', { color: SG.COLORS.gold })) st.phase = 'run';
    if (SG.ui.button(g, { x: CX - 120, y: 280, w: 240, h: 44 }, 'RESTART', { color: '#3a4270', text: '#fff' })) { reset(); }
    if (SG.ui.button(g, { x: CX - 120, y: 334, w: 240, h: 44 }, 'MENU', { color: '#2a2f52', text: '#fff' })) SG.go('menu');
  }

  function drawDead(g) {
    var k = SG.clamp(st.deadT / 0.45, 0, 1);
    g.fillStyle = 'rgba(5,6,14,' + 0.8 * k + ')';
    g.fillRect(0, 0, SG.W, SG.H);
    if (st.deadT < 0.35) return;

    var a = SG.clamp((st.deadT - 0.35) / 0.3, 0, 1);
    g.save();
    g.globalAlpha = a;
    g.translate(0, (1 - a) * 22);

    SG.ui.panel(g, CX - 220, 96, 440, 350);

    if (st.newBest) {
      SG.ui.text(g, 'NEW BEST!', CX, 138, { size: 36, color: SG.COLORS.gold, stroke: '#1a1030', strokeWidth: 8, shadow: false });
    } else {
      // Flemish for "darn", and the only acceptable reaction to a crash.
      SG.art.tag(g, 'LAP!', CX, 140, 46, '#ff2d6f', -0.05);
    }

    SG.ui.text(g, String(st.score), CX, 202, { size: 62, color: '#fff', stroke: '#1a1030', strokeWidth: 9, shadow: false });
    SG.ui.text(g, 'SCORE', CX, 240, { size: 13, color: 'rgba(255,255,255,0.45)', shadow: false });

    SG.art.drawWing(g, CX - 92, 282, 1.2, -0.3);
    SG.ui.text(g, String(st.wings) + ' wings', CX - 70, 282, { size: 17, color: SG.COLORS.gold, align: 'left', shadow: false });
    SG.ui.text(g, Math.floor(st.travel) + ' m', CX + 92, 282, { size: 17, color: 'rgba(255,255,255,0.7)', align: 'right', shadow: false });

    if (!st.newBest) {
      SG.ui.text(g, 'BEST  ' + SG.save.best('wingrun'), CX, 312, { size: 14, color: 'rgba(255,255,255,0.4)', shadow: false });
    }

    if (SG.ui.button(g, { x: CX - 190, y: 340, w: 180, h: 52 }, 'RETRY', { color: SG.COLORS.gold })) reset();
    if (SG.ui.button(g, { x: CX + 10, y: 340, w: 180, h: 52 }, 'MENU', { color: '#3a4270', text: '#fff' })) SG.go('menu');

    g.restore();
  }

  function draw(g) {
    CX = SG.W / 2;
    drawSky(g);
    drawRoad(g);
    drawProps(g);

    // entities far -> near so nearer ones overlap correctly
    var sorted = st.ents.slice().sort(function (a, b) { return b.z - a.z; });
    var i;
    for (i = 0; i < sorted.length; i++) {
      if (sorted[i].z > PLAYER_Z) drawEntity(g, sorted[i]);
    }
    drawPlayer(g);
    for (i = 0; i < sorted.length; i++) {
      if (sorted[i].z <= PLAYER_Z) drawEntity(g, sorted[i]);
    }

    // vignette
    var vg = g.createRadialGradient(CX, SG.H * 0.5, SG.H * 0.35, CX, SG.H * 0.5, SG.H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vg;
    g.fillRect(0, 0, SG.W, SG.H);

    drawHUD(g);
    if (st.phase === 'ready') drawReady(g);
    if (st.phase === 'paused') drawPaused(g);
    if (st.phase === 'dead') drawDead(g);
  }

  SG.register('wingrun', {
    enter: function () { reset(); },
    update: update,
    draw: draw,
    onBlur: function () { if (st && st.phase === 'run') st.phase = 'paused'; },
  });
})();
