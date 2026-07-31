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
      invuln: 0,
      ents: [],
      props: [],
      distToSpawn: 6,
      popups: [],
      dust: 0,
      newBest: false,
      deadT: 0,
      streak: 0,
    };
    for (var i = 0; i < 26; i++) {
      spawnProp(NEAR_Z + Math.random() * (FAR_Z - NEAR_Z));
    }
  }

  // ---- side scenery ---------------------------------------------
  var PROP_COLORS = ['#2f2b52', '#3a2f5e', '#26315c', '#43305c'];

  function spawnProp(z) {
    var side = Math.random() < 0.5 ? -1 : 1;
    var kind = Math.random();
    st.props.push({
      side: side,
      z: z,
      type: kind < 0.55 ? 'building' : kind < 0.8 ? 'tree' : 'sign',
      h: SG.rand(3.5, 9),
      w: SG.rand(1.6, 3.2),
      off: SG.rand(4.4, 7.5),
      c: SG.pick(PROP_COLORS),
      lit: Math.random() < 0.6,
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

    if (Math.random() < 0.09) {
      st.ents.push({ type: 'magnet', lane: SG.randInt(0, 2), z: z + SG.rand(10, 20), wy: 1.1, gone: false, pz: 0, rot: 0 });
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
    st.speed = Math.min(SPEED_MAX, SPEED_START + st.travel * 0.012);
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
    SG.audio.play('jump');
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
      var grab = sameLane || st.magnet > 0;
      if (grab) {
        // must be roughly at the wing's height
        var dy = Math.abs((st.y + 0.85) - en.wy);
        if (st.magnet > 0 || dy < 1.25) {
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
  function drawSky(g) {
    var sky = g.createLinearGradient(0, 0, 0, HORIZON + 60);
    sky.addColorStop(0, '#20134a');
    sky.addColorStop(0.55, '#5a2360');
    sky.addColorStop(1, '#ff7a4d');
    g.fillStyle = sky;
    g.fillRect(0, 0, SG.W, HORIZON + 60);

    // sun
    var sunX = CX + 150;
    var sunY = HORIZON - 46;
    var sg = g.createRadialGradient(sunX, sunY, 8, sunX, sunY, 130);
    sg.addColorStop(0, 'rgba(255,220,120,0.95)');
    sg.addColorStop(0.35, 'rgba(255,150,60,0.55)');
    sg.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(sunX, sunY, 130, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd36b';
    g.beginPath();
    g.arc(sunX, sunY, 40, 0, Math.PI * 2);
    g.fill();

    // parallax skyline
    var off = (st.travel * 1.4) % 240;
    g.fillStyle = 'rgba(18,10,38,0.85)';
    for (var i = -1; i < 6; i++) {
      var bx = i * 240 - off;
      silhouette(g, bx);
    }
  }

  function silhouette(g, bx) {
    var bars = [[0, 46], [34, 74], [66, 34], [92, 96], [130, 58], [158, 80], [192, 40], [214, 66]];
    for (var i = 0; i < bars.length; i++) {
      var h = bars[i][1];
      g.fillRect(bx + bars[i][0], HORIZON - h, 30, h + 6);
    }
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
        g.fillStyle = '#274d33';
        g.beginPath();
        g.ellipse(base.x, top.y + (base.y - top.y) * 0.35, halfW * 1.1, (base.y - top.y) * 0.42, 0, 0, Math.PI * 2);
        g.fill();
      } else if (p.type === 'sign') {
        g.fillStyle = '#2a2a3e';
        g.fillRect(base.x - halfW * 0.08, top.y, halfW * 0.16, base.y - top.y);
        g.fillStyle = '#ffb02e';
        SG.roundRect(g, base.x - halfW, top.y - halfW * 0.5, halfW * 2, halfW * 1.1, halfW * 0.15);
        g.fill();
        if (halfW > 12) {
          SG.ui.text(g, 'WINGS', base.x, top.y, { size: Math.max(6, halfW * 0.42), color: '#17120a', shadow: false });
        }
      } else {
        g.fillStyle = p.c;
        g.fillRect(base.x - halfW, top.y, halfW * 2, base.y - top.y);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(base.x - halfW, top.y, halfW * 0.3, base.y - top.y);
        if (p.lit && halfW > 3) {
          g.fillStyle = 'rgba(255,214,120,0.55)';
          var rows = Math.floor((base.y - top.y) / (halfW * 0.75));
          for (var r = 0; r < rows; r++) {
            for (var c = 0; c < 3; c++) {
              if ((r * 3 + c + p.h * 7 | 0) % 3 === 0) continue;
              g.fillRect(base.x - halfW * 0.7 + c * halfW * 0.55, top.y + halfW * 0.35 + r * halfW * 0.75, halfW * 0.3, halfW * 0.34);
            }
          }
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
      shirt: SG.COLORS.red,
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

    // magnet timer
    if (st.magnet > 0) {
      var w = 150 * (st.magnet / 8);
      g.fillStyle = 'rgba(0,0,0,0.4)';
      SG.roundRect(g, CX - 75, 22, 150, 12, 6);
      g.fill();
      g.fillStyle = '#4dd47a';
      SG.roundRect(g, CX - 75, 22, w, 12, 6);
      g.fill();
      SG.ui.text(g, 'MAGNET', CX, 48, { size: 12, color: '#4dd47a', shadow: false });
    }

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

    SG.ui.text(g, st.newBest ? 'NEW BEST!' : 'WIPEOUT', CX, 138, {
      size: 36, color: st.newBest ? SG.COLORS.gold : '#ff6b5c', stroke: '#1a1030', strokeWidth: 8, shadow: false,
    });

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
