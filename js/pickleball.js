/* =============================================================
   MODE 1 - PICKLEBALL: SANTI vs. DARK SANTI
   Perspective court, camera behind Santi. Drag to move; the swing
   is automatic, and WHERE the ball meets you decides the return -
   hit it dead centre for a flat, fast winner.
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  // Loops for as long as he is in here; the scene's exit() stops it.
  var TRACK = 'assets/music/pickleball.mp3';

  // ---- projection ------------------------------------------------
  // Camera sits well back with a long focal length, so Dark Santi at
  // the far baseline stays readable instead of shrinking to a speck.
  var FOCAL = 760;
  var HORIZON = 80;
  var CAM_Y = 3.4;
  var CAM_Z = 6;
  var CX = SG.W / 2;

  var COURT_HALF = 3.05;
  var COURT_LEN = 11;
  var NET_Z = COURT_LEN / 2;
  var NET_H = 0.9;
  var KITCHEN = 2.1;

  var NEAR_Z = 0.9;          // where Santi stands
  var FAR_Z = COURT_LEN - 0.9;
  var REACH = 1.15;
  var WINGS_PER_POINT = 45;      // shared target: ~130 wings a minute
  var WINGS_MATCH_BONUS = 220;   // a won match is ~4 min: 7*45 + 220
  var BALL_R = 0.11;
  // Floaty on purpose. Realistic gravity makes every shot skim the tape
  // and the rally dies on the first exchange.
  var GRAVITY = 13;
  var WIN_SCORE = 7;

  function proj(x, y, z) {
    var s = FOCAL / (z + CAM_Z);
    return { x: CX + x * s, y: HORIZON + (CAM_Y - y) * s, s: s };
  }

  // ---- state -----------------------------------------------------
  var st;

  function reset() {
    st = {
      phase: 'serve',        // serve | rally | point | over | paused
      t: 0,
      timer: 1.1,
      score: [0, 0],         // [santi, dark]
      server: 0,
      rally: 0,
      me: { x: 0, tx: 0, swing: 0, lunge: 0 },
      ai: { x: 0, tx: 0, swing: 0, err: 0, react: 0 },
      ball: { x: 0, y: 1, z: NEAR_Z, vx: 0, vy: 0, vz: 0, live: false },
      trail: [],
      last: 0,               // who hit it last
      msg: null,
      msgT: 0,
      wings: 0,              // chicken wings banked this match
      eggs: [],
      toys: [],
      daley: null,
      eggT: 2.5,
      winner: -1,
    };
  }

  /* ---- Kinder surprise eggs ----
     They float over the court as an optional target. The ball passes
     straight through rather than deflecting - they're a bonus, never a
     hazard that costs you the rally. */
  /* The egg hangs in a vertical beam of light, and the whole beam is the
     target. The player steers the return left/right and has no control
     whatsoever over its height - and because the ball bounces in the far
     court, its height at any given z varies hugely. Judging a shot in
     two axes when you can only aim in one is luck, so the hitbox ignores
     height and asks only "did you send it through this column?".
     The beam is drawn full height so the rule is visible. */
  var EGG_RH = 0.52;       // column radius
  var EGG_TOP = 2.9;       // beam reaches this high
  var EGG_BOT = 0.1;
  var EGG_WINGS = 45;
  var TOY_KINDS = ['car', 'top', 'duck', 'ring', 'robot'];

  // Measured flight: a return crosses the far court at ~2.3m by the net,
  // falling to ~1.0m at the baseline. Eggs sit on that line so they're
  // in the ball's way by construction.
  function ballHeightAt(z) {
    return SG.clamp(2.3 - 0.28 * (z - NET_Z), 0.8, 2.5);
  }

  var EGG_LIFE = 7;

  function spawnEgg() {
    var z = SG.rand(NET_Z + 0.5, COURT_LEN - 1.2);
    st.eggs.push({
      x: SG.rand(-2.3, 2.3),
      z: z,
      y: ballHeightAt(z) + SG.rand(-0.2, 0.2),
      bob: Math.random() * 6.28,
      spin: SG.rand(-0.5, 0.5),
      // Eggs time out. Left on court indefinitely a wandering ball
      // eventually clips one on its own, which makes the bonus free
      // rather than something you go for.
      life: EGG_LIFE,
    });
  }

  // Closest approach of this frame's ball segment to a point. Without
  // this a fast ball tunnels straight through an egg between frames.
  function segDist(ax, ay, az, bx, by, bz, px, py, pz) {
    var dx = bx - ax, dy = by - ay, dz = bz - az;
    var len2 = dx * dx + dy * dy + dz * dz;
    var t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / len2 : 0;
    t = SG.clamp(t, 0, 1);
    var cx = ax + dx * t - px, cy = ay + dy * t - py, cz = az + dz * t - pz;
    return Math.sqrt(cx * cx + cy * cy + cz * cz);
  }

  function crackEgg(e, i) {
    st.eggs.splice(i, 1);
    bankWings(EGG_WINGS);
    say('KINDER! +' + EGG_WINGS, '#ff8a1a');
    SG.audio.play('smash');
    SG.audio.play('wingbig');

    var p = proj(e.x, e.y, e.z);
    SG.burst(p.x, p.y, 16, { colors: ['#fff4e0', '#ff8a1a', '#ffd400'], speedMax: 220, gravity: 320 });

    // shell halves tumbling apart
    st.toys.push({
      kind: 'shell', x: e.x, y: e.y, z: e.z,
      vx: -1.6, vy: 2.2, vz: 0, spin: -6, rot: 0, life: 1.4,
    });
    st.toys.push({
      kind: 'shell2', x: e.x, y: e.y, z: e.z,
      vx: 1.6, vy: 1.8, vz: 0, spin: 6, rot: 0, life: 1.4,
    });

    // the prize
    st.toys.push({
      kind: SG.pick(TOY_KINDS), x: e.x, y: e.y, z: e.z,
      vx: SG.rand(-0.5, 0.5), vy: 2.6, vz: 0, spin: SG.rand(-4, 4), rot: 0,
      life: 999, prize: true, taken: false,
    });
  }

  function updateEggs(dt, prev) {
    if (st.phase === 'rally') {
      st.eggT -= dt;
      if (st.eggT <= 0 && st.eggs.length < 2) {
        spawnEgg();
        st.eggT = SG.rand(3, 5.5);
      }
    }

    var b = st.ball;
    for (var i = st.eggs.length - 1; i >= 0; i--) {
      var e = st.eggs[i];
      e.bob += dt;
      e.life -= dt;
      if (e.life <= 0) { st.eggs.splice(i, 1); continue; }
      e.y += Math.sin(e.bob * 1.6) * dt * 0.22;

      // Flatten to the ground plane: did the ball's path this frame pass
      // through the column, at any playable height?
      if (b.live &&
          segDist(prev.x, 0, prev.z, b.x, 0, b.z, e.x, 0, e.z) < EGG_RH + BALL_R &&
          Math.min(prev.y, b.y) < EGG_TOP && Math.max(prev.y, b.y) > EGG_BOT) {
        crackEgg(e, i);
      }
    }

    // toys and shell fragments
    for (var j = st.toys.length - 1; j >= 0; j--) {
      var t = st.toys[j];
      t.life -= dt;
      if (t.life <= 0) { st.toys.splice(j, 1); continue; }
      t.rot += t.spin * dt;
      if (t.taken) continue;                    // Daley is carrying it

      t.vy -= GRAVITY * 0.55 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.z += t.vz * dt;
      if (t.y <= 0.12) {
        t.y = 0.12;
        t.vy = -t.vy * 0.35;
        t.vx *= 0.6;
        if (Math.abs(t.vy) < 0.4) { t.vy = 0; t.spin = 0; }
        // once the prize settles, Daley is on her way
        if (t.prize && !st.daley) sendDaley(t);
      }
    }

    updateDaley(dt);
  }

  /* ---- Daley, opportunist ---- */
  function sendDaley(toy) {
    var from = toy.x < 0 ? -1 : 1;              // nearest sideline
    st.daley = {
      x: from * 5.6, z: toy.z, dir: -from, toy: toy,
      state: 'in', t: 0, phase: 0, exit: -from * 5.6,
    };
  }

  function updateDaley(dt) {
    var d = st.daley;
    if (!d) return;
    var speed = 4.2;
    d.phase += dt * 11;

    if (d.state === 'in') {
      var dx = d.toy.x - d.x;
      d.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
      if (Math.abs(dx) < 0.18) { d.state = 'grab'; d.t = 0.32; }
    } else if (d.state === 'grab') {
      d.t -= dt;
      if (d.t <= 0) {
        d.state = 'out';
        d.toy.taken = true;
        SG.audio.play('wing');
        say('DALEY TOOK IT', '#ff6b8a');
      }
    } else {
      d.x += Math.sign(d.exit - d.x) * speed * dt;
      d.toy.x = d.x;                             // carried
      d.toy.y = 0.95;
      if (Math.abs(d.x) > 5.4) {
        var idx = st.toys.indexOf(d.toy);
        if (idx >= 0) st.toys.splice(idx, 1);
        st.daley = null;
      }
    }
  }

  function say(text, color) {
    st.msg = { text: text, color: color || SG.COLORS.gold };
    st.msgT = 0;
  }

  // ---- serving / scoring ----------------------------------------
  function beginServe() {
    st.phase = 'serve';
    st.timer = 1.0;
    st.rally = 0;
    st.ball.live = false;
    st.trail.length = 0;
    // Held out to the side, not dead centre, or the server's own body
    // hides the ball while you're waiting for it.
    var srv = st.server;
    st.ball.x = (srv === 0 ? st.me.x : st.ai.x) + (srv === 0 ? 0.62 : -0.62);
    st.ball.z = srv === 0 ? NEAR_Z - 0.15 : FAR_Z + 0.15;
    st.ball.y = 1.35;
    st.ball.vx = st.ball.vy = st.ball.vz = 0;
  }

  function launchServe() {
    var srv = st.server;
    st.last = srv;
    st.ball.live = true;
    st.ball.x = srv === 0 ? st.me.x : st.ai.x;
    st.ball.z = srv === 0 ? NEAR_Z : FAR_Z;
    st.ball.vy = 6.3;
    st.ball.vz = srv === 0 ? 6.9 : -6.9;
    st.ball.vx = SG.rand(-1.0, 1.0);
    st.phase = 'rally';
    SG.audio.play('pop');
    newAiRead();
  }

  function point(who, reason) {
    if (st.phase === 'point' || st.phase === 'over') return;
    st.score[who]++;
    st.phase = 'point';
    st.timer = 1.5;
    st.ball.live = false;
    st.server = who;

    if (who === 0) {
      // Wings are the currency across the whole game, so a pickleball
      // point pays into the same jar as a run.
      bankWings(WINGS_PER_POINT);
      say('+' + WINGS_PER_POINT + ' WINGS', SG.COLORS.gold);
      SG.audio.play('point');
      SG.audio.play('wing');
    } else {
      // Santi blew it. There is only one thing to say.
      say('LAP!', '#ff2d6f');
      SG.audio.play('lap');
      SG.shake(9);
    }

    if (st.score[who] >= WIN_SCORE) {
      st.phase = 'over';
      st.winner = who;
      st.timer = 0;
      if (who === 0) {
        bankWings(WINGS_MATCH_BONUS);
        SG.save.submit('pickleball', st.score[0] * 100 - st.score[1] * 10);
        SG.save.data.pbWins = (SG.save.data.pbWins || 0) + 1;
        SG.save.write();
      }
    }
  }

  // Banked as they're earned, not at the final whistle - quitting a
  // match mid-way shouldn't wipe what you already won.
  function bankWings(n) {
    st.wings += n;
    SG.save.data.wings = (SG.save.data.wings || 0) + n;
    SG.save.write();
  }

  // ---- AI --------------------------------------------------------
  // Re-rolled each time the ball turns toward Dark Santi, so he misses
  // in a believable way rather than jittering every frame.
  function newAiRead() {
    var lead = st.score[1] - st.score[0];
    var skill = SG.clamp(0.42 + st.score[1] * 0.055 - lead * 0.02, 0.35, 0.86);
    st.ai.err = SG.rand(-1, 1) * (1.55 * (1 - skill));
    st.ai.react = SG.rand(0.05, 0.2) * (1 - skill * 0.6);
  }

  function updateAi(dt) {
    var a = st.ai;
    var speed = 3.4 + st.score[1] * 0.16;

    if (st.ball.live && st.ball.vz > 0) {
      if (a.react > 0) { a.react -= dt; }
      else {
        // aim at where the ball will cross the far baseline
        var tof = (FAR_Z - st.ball.z) / Math.max(0.5, st.ball.vz);
        a.tx = SG.clamp(st.ball.x + st.ball.vx * tof + a.err, -COURT_HALF - 0.4, COURT_HALF + 0.4);
      }
    } else if (!st.ball.live || st.ball.vz < 0) {
      a.tx += (0 - a.tx) * dt * 1.1;          // drift back to centre
    }

    var d = a.tx - a.x;
    var step = speed * dt;
    a.x += Math.abs(d) < step ? d : Math.sign(d) * step;
    if (a.swing > 0) a.swing -= dt;
  }

  // ---- hitting ---------------------------------------------------
  function tryHit(who) {
    var b = st.ball;
    var p = who === 0 ? st.me : st.ai;
    var dx = b.x - p.x;
    if (Math.abs(dx) > REACH || b.y > 2.4) return false;

    var offset = dx / REACH;                   // -1..1 across the paddle
    var quality = 1 - Math.abs(offset) * 0.62; // centre contact is best
    var perfect = Math.abs(offset) < 0.3;

    var dir = who === 0 ? 1 : -1;
    b.vz = dir * (7.0 + quality * 3.2 + st.rally * 0.05);
    b.vx = offset * 4.0 + (who === 1 ? st.ai.err * 0.5 : 0);
    // Arc has to clear a 0.9m net 4.6m away - keep it generous, and
    // scoop hard when the ball is caught low.
    b.vy = 5.9 - quality * 0.7 + (0.9 - Math.min(b.y, 0.9)) * 1.9;
    b.z = who === 0 ? NEAR_Z + 0.05 : FAR_Z - 0.05;

    p.swing = 0.22;
    st.last = who;
    st.rally++;

    if (who === 0) {
      var sp = proj(b.x, b.y, b.z);
      if (perfect) {
        SG.audio.play('smash');
        SG.burst(sp.x, sp.y, 12, { colors: ['#ffd400', '#fff4e0', '#ff7a1a'], speedMax: 260, gravity: 200 });
        if (st.rally > 1) say('PERFECT!', SG.COLORS.gold);
      } else {
        SG.audio.play('pop');
      }
      newAiRead();
    } else {
      SG.audio.play('pop');
    }
    return true;
  }

  // ---- update ----------------------------------------------------
  function update(dt) {
    CX = SG.W / 2;
    SG.audio.music.follow(st.phase === 'paused');
    st.t += dt;
    if (st.msg) { st.msgT += dt; if (st.msgT > 1.4) st.msg = null; }

    if (st.phase === 'paused') return;

    if (SG.input.tappedRect(pauseRect()) && st.phase !== 'over') {
      st.phase = 'paused';
      SG.input.releaseAll();     // a way out of a touch that never ended
      SG.audio.play('back');
      return;
    }

    if (st.phase === 'over') return;

    movePlayer(dt);
    updateAi(dt);
    if (st.me.swing > 0) st.me.swing -= dt;

    // Eggs, toys and Daley keep running through serves and between
    // points - the whole gag is that play never stops for her.
    var still = { x: st.ball.x, y: st.ball.y, z: st.ball.z };

    if (st.phase === 'serve') {
      st.timer -= dt;
      // ball stays in the server's hand until it goes
      st.ball.x = (st.server === 0 ? st.me.x + 0.62 : st.ai.x - 0.62);
      updateEggs(dt, still);
      if (st.timer <= 0) launchServe();
      return;
    }

    if (st.phase === 'point') {
      st.timer -= dt;
      updateEggs(dt, still);
      if (st.timer <= 0) beginServe();
      return;
    }

    // ---- ball ----
    var b = st.ball;
    if (!b.live) { updateEggs(dt, still); return; }
    var prevZ = b.z;
    var prev = { x: b.x, y: b.y, z: b.z };

    b.vy -= GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;

    st.trail.push({ x: b.x, y: b.y, z: b.z });
    if (st.trail.length > 12) st.trail.shift();

    // Before the collision checks below, several of which return early.
    updateEggs(dt, prev);

    // bounce
    if (b.y <= BALL_R && b.vy < 0) {
      b.y = BALL_R;
      b.vy = -b.vy * 0.6;
      b.vx *= 0.92;
      b.vz *= 0.94;
      SG.audio.play('bounce');
      var bp = proj(b.x, 0, b.z);
      SG.burst(bp.x, bp.y, 3, { colors: ['#ffffff'], speedMax: 70, gravity: 300, rMax: 2.5, life: 0.3 });
    }

    // net
    if ((prevZ - NET_Z) * (b.z - NET_Z) <= 0 && prevZ !== b.z) {
      if (b.y < NET_H + BALL_R) {
        b.vz *= -0.22;
        b.vx *= 0.4;
        b.z = NET_Z + (b.vz > 0 ? 0.06 : -0.06);
        SG.audio.play('back');
        point(st.last === 0 ? 1 : 0, 'NET');
        return;
      }
    }

    // returns
    if (b.vz < 0 && b.z <= NEAR_Z && b.z > NEAR_Z - 1.6) {
      if (tryHit(0)) return;
    }
    if (b.vz > 0 && b.z >= FAR_Z && b.z < FAR_Z + 1.6) {
      if (tryHit(1)) return;
    }

    // out of bounds
    if (Math.abs(b.x) > COURT_HALF + 0.55) { point(st.last === 0 ? 1 : 0, 'OUT'); return; }
    if (b.z < -1.4) { point(1); return; }
    if (b.z > COURT_LEN + 1.4) { point(0, 'WINNER!'); return; }
  }

  function movePlayer(dt) {
    var m = st.me;
    var s = FOCAL / (NEAR_Z + CAM_Z);

    // finger position maps straight onto court x - 1:1 and immediate
    var p = null;
    for (var id in SG.input.pointers) { p = SG.input.pointers[id]; break; }
    if (p) m.tx = SG.clamp((p.x - CX) / s, -COURT_HALF - 0.5, COURT_HALF + 0.5);

    if (SG.input.keys.ArrowLeft || SG.input.keys.KeyA) m.tx = SG.clamp(m.tx - 6 * dt, -COURT_HALF - 0.5, COURT_HALF + 0.5);
    if (SG.input.keys.ArrowRight || SG.input.keys.KeyD) m.tx = SG.clamp(m.tx + 6 * dt, -COURT_HALF - 0.5, COURT_HALF + 0.5);

    m.x += (m.tx - m.x) * Math.min(1, 14 * dt);
  }

  function pauseRect() { return SG.ui.pauseRect(); }

  // ---- drawing ---------------------------------------------------
  function quad(g, x0, x1, z0, z1) {
    var a = proj(x0, 0, z0), b = proj(x1, 0, z0), c = proj(x1, 0, z1), d = proj(x0, 0, z1);
    g.beginPath();
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y);
    g.closePath();
    g.fill();
  }

  function drawBackdrop(g) {
    var sky = g.createLinearGradient(0, 0, 0, SG.H);
    sky.addColorStop(0, '#160a33');
    sky.addColorStop(0.4, '#3d1550');
    sky.addColorStop(1, '#0e0820');
    g.fillStyle = sky;
    g.fillRect(0, 0, SG.W, SG.H);

    // Plain back wall. Deliberately quiet - anything busy up here sits
    // directly behind the ball for most of a rally.
    var wallTop = 8, wallBot = proj(0, 0, COURT_LEN + 2.2).y;
    var wg = g.createLinearGradient(0, wallTop, 0, wallBot);
    wg.addColorStop(0, '#241d44');
    wg.addColorStop(1, '#2f2755');
    g.fillStyle = wg;
    g.fillRect(0, wallTop, SG.W, wallBot - wallTop);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, wallTop, SG.W, 16);

    // chain-link fence over the wall
    g.save();
    g.globalAlpha = 0.16;
    g.strokeStyle = '#cfd8ff';
    g.lineWidth = 1;
    for (var fx = -40; fx < SG.W + 40; fx += 22) {
      g.beginPath(); g.moveTo(fx, wallTop); g.lineTo(fx + 40, wallBot); g.stroke();
      g.beginPath(); g.moveTo(fx + 40, wallTop); g.lineTo(fx, wallBot); g.stroke();
    }
    g.restore();
    g.fillStyle = 'rgba(10,6,22,0.85)';
    g.fillRect(0, wallBot - 5, SG.W, 7);
  }

  function drawCourt(g) {
    // surround
    g.fillStyle = '#2a2340';
    g.fillRect(0, proj(0, 0, COURT_LEN + 2).y, SG.W, SG.H);

    // playing surface
    g.fillStyle = '#2f6f8f';
    quad(g, -COURT_HALF - 0.6, COURT_HALF + 0.6, -0.6, COURT_LEN + 0.6);
    g.fillStyle = '#3d8fae';
    quad(g, -COURT_HALF, COURT_HALF, 0, COURT_LEN);

    // kitchens, a shade darker
    g.fillStyle = 'rgba(20,60,90,0.35)';
    quad(g, -COURT_HALF, COURT_HALF, NET_Z - KITCHEN, NET_Z);
    quad(g, -COURT_HALF, COURT_HALF, NET_Z, NET_Z + KITCHEN);

    // No graffiti on the playing surface - it competes with the ball.

    // lines
    g.fillStyle = 'rgba(255,255,255,0.85)';
    var lw = 0.07;
    quad(g, -COURT_HALF, -COURT_HALF + lw, 0, COURT_LEN);        // sidelines
    quad(g, COURT_HALF - lw, COURT_HALF, 0, COURT_LEN);
    quad(g, -COURT_HALF, COURT_HALF, 0, lw);                      // baselines
    quad(g, -COURT_HALF, COURT_HALF, COURT_LEN - lw, COURT_LEN);
    quad(g, -COURT_HALF, COURT_HALF, NET_Z - KITCHEN - lw, NET_Z - KITCHEN);
    quad(g, -COURT_HALF, COURT_HALF, NET_Z + KITCHEN, NET_Z + KITCHEN + lw);
    quad(g, -lw / 2, lw / 2, 0, NET_Z - KITCHEN);                 // centre lines
    quad(g, -lw / 2, lw / 2, NET_Z + KITCHEN, COURT_LEN);
  }

  function drawNet(g) {
    var halfW = COURT_HALF + 0.35;
    var tl = proj(-halfW, NET_H, NET_Z), tr = proj(halfW, NET_H, NET_Z);
    var bl = proj(-halfW, 0, NET_Z), br = proj(halfW, 0, NET_Z);

    // mesh
    g.save();
    g.beginPath();
    g.moveTo(tl.x, tl.y); g.lineTo(tr.x, tr.y); g.lineTo(br.x, br.y); g.lineTo(bl.x, bl.y);
    g.closePath();
    g.fillStyle = 'rgba(12,10,26,0.34)';
    g.fill();
    g.clip();
    g.strokeStyle = 'rgba(220,230,255,0.3)';
    g.lineWidth = 1;
    for (var i = 0; i <= 34; i++) {
      var x = tl.x + (tr.x - tl.x) * (i / 34);
      g.beginPath(); g.moveTo(x, tl.y - 4); g.lineTo(x, br.y + 2); g.stroke();
    }
    for (var j = 0; j <= 6; j++) {
      var y = tl.y + (bl.y - tl.y) * (j / 6);
      g.beginPath(); g.moveTo(tl.x, y); g.lineTo(tr.x, y); g.stroke();
    }
    g.restore();

    // tape + posts
    g.strokeStyle = '#f4f1ff';
    g.lineWidth = Math.max(2, tl.s * 0.05);
    g.beginPath(); g.moveTo(tl.x, tl.y); g.lineTo(tr.x, tr.y); g.stroke();
    g.strokeStyle = '#1b1636';
    g.lineWidth = Math.max(3, tl.s * 0.07);
    g.beginPath(); g.moveTo(tl.x, tl.y); g.lineTo(bl.x, bl.y); g.stroke();
    g.beginPath(); g.moveTo(tr.x, tr.y); g.lineTo(br.x, br.y); g.stroke();
  }

  function drawPaddle(g, px, pz, swing, side, color) {
    var hand = proj(px + side * 0.55, 1.05, pz);
    var sw = swing > 0 ? (1 - swing / 0.22) : 1;
    var ang = side * (0.5 - sw * 1.5);
    g.save();
    g.translate(hand.x, hand.y);
    g.rotate(ang);
    var r = hand.s * 0.019;
    g.scale(r, r);
    g.strokeStyle = '#2a1a10';
    g.lineWidth = 2.4;
    g.fillStyle = '#6b4a2a';                     // handle
    SG.roundRect(g, -3.5, 4, 7, 13, 2.5);
    g.fill(); g.stroke();
    g.fillStyle = color;                          // face
    g.beginPath();
    g.ellipse(0, -5, 10, 12, 0, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath();
    g.ellipse(-3, -8, 3.6, 4.4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawBall(g) {
    var b = st.ball;

    // shadow first - without it you can't read the height at all
    var sp = proj(b.x, 0, b.z);
    var lift = SG.clamp(b.y / 3, 0, 1);
    g.fillStyle = 'rgba(0,0,0,' + (0.34 - lift * 0.2) + ')';
    g.beginPath();
    g.ellipse(sp.x, sp.y, sp.s * BALL_R * (1.7 - lift * 0.6), sp.s * BALL_R * (0.8 - lift * 0.3), 0, 0, Math.PI * 2);
    g.fill();

    // trail
    for (var i = 0; i < st.trail.length; i++) {
      var tp = proj(st.trail[i].x, st.trail[i].y, st.trail[i].z);
      g.globalAlpha = (i / st.trail.length) * 0.3;
      g.fillStyle = '#e9f562';
      g.beginPath();
      g.arc(tp.x, tp.y, tp.s * BALL_R * 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    var p = proj(b.x, b.y, b.z);
    var r = p.s * BALL_R;
    g.fillStyle = '#e9f562';
    g.strokeStyle = 'rgba(40,44,10,0.7)';
    g.lineWidth = Math.max(1, r * 0.14);
    g.beginPath();
    g.arc(p.x, p.y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // the holes that make it a pickleball
    g.fillStyle = 'rgba(70,74,20,0.55)';
    for (var h = 0; h < 5; h++) {
      g.beginPath();
      g.arc(p.x + Math.cos(h * 1.3 + st.t * 3) * r * 0.45, p.y + Math.sin(h * 1.3 + st.t * 3) * r * 0.45, r * 0.16, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.arc(p.x - r * 0.3, p.y - r * 0.34, r * 0.3, 0, Math.PI * 2);
    g.fill();
  }

  /* ---- eggs, toys, Daley ---- */

  function drawEgg(g, e) {
    var p = proj(e.x, e.y, e.z);
    var r = p.s * EGG_RH;
    if (r < 2) return;

    // Blink out over the last 1.5s so it's clear the chance is going.
    g.save();
    if (e.life < 1.5) {
      g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(e.life * 12));
    }

    // Shadow on the court directly below - this is the aiming cue. You
    // steer left/right, so you need to see the egg's lane on the floor.
    var gp = proj(e.x, 0, e.z);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath();
    g.ellipse(gp.x, gp.y, gp.s * EGG_RH * 0.9, gp.s * EGG_RH * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,180,60,0.4)';
    g.lineWidth = 1.5;
    g.stroke();

    // The beam, drawn at the true hitbox width and full height so the
    // rule reads at a glance: put the ball through the light.
    var half = (EGG_RH + BALL_R);
    var bt = proj(e.x, EGG_TOP, e.z), bb = proj(e.x, EGG_BOT, e.z);
    var bw = bt.s * half;
    var beam = g.createLinearGradient(bt.x - bw, 0, bt.x + bw, 0);
    beam.addColorStop(0, 'rgba(255,170,50,0)');
    beam.addColorStop(0.5, 'rgba(255,190,80,0.2)');
    beam.addColorStop(1, 'rgba(255,170,50,0)');
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(bt.x - bw, bt.y);
    g.lineTo(bt.x + bw, bt.y);
    g.lineTo(bb.x + bb.s * half, bb.y);
    g.lineTo(bb.x - bb.s * half, bb.y);
    g.closePath();
    g.fill();

    g.save();
    g.translate(p.x, p.y);
    g.rotate(Math.sin(e.bob) * 0.14);
    g.scale(r / 30, r / 30);

    g.strokeStyle = '#3a2412';
    g.lineWidth = 2.4;
    // bottom half - cream
    g.fillStyle = '#fdf3e0';
    g.beginPath();
    g.ellipse(0, 0, 22, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // top half - the orange wrapper
    g.save();
    g.beginPath();
    g.rect(-24, -32, 48, 26);
    g.clip();
    g.fillStyle = '#e8582a';
    g.beginPath();
    g.ellipse(0, 0, 22, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.beginPath();
    g.ellipse(0, 0, 22, 30, 0, 0, Math.PI * 2);
    g.stroke();
    // white swoosh across the middle
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(0, -5, 20, 5.5, -0.12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.ellipse(-7, -16, 5, 8, -0.4, 0, Math.PI * 2);
    g.fill();
    g.restore();

    g.restore();      // closes the blink-alpha save at the top
  }

  function drawToy(g, t) {
    var p = proj(t.x, t.y, t.z);
    var r = p.s * 0.13;
    if (r < 1.5) return;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(t.rot);
    g.scale(r / 10, r / 10);
    g.strokeStyle = '#3a2412';
    g.lineWidth = 1.6;

    if (t.kind === 'shell' || t.kind === 'shell2') {
      g.fillStyle = t.kind === 'shell' ? '#e8582a' : '#fdf3e0';
      g.beginPath();
      g.arc(0, 0, 8, 0, Math.PI);
      g.closePath();
      g.fill(); g.stroke();
    } else if (t.kind === 'car') {
      g.fillStyle = '#ff2d6f';
      SG.roundRect(g, -9, -3, 18, 7, 2); g.fill(); g.stroke();
      g.fillStyle = '#ffd400';
      SG.roundRect(g, -4, -8, 9, 6, 2); g.fill(); g.stroke();
      g.fillStyle = '#2a2340';
      g.beginPath(); g.arc(-5, 5, 3, 0, Math.PI * 2); g.arc(5, 5, 3, 0, Math.PI * 2); g.fill();
    } else if (t.kind === 'top') {
      g.fillStyle = '#4dd47a';
      g.beginPath(); g.moveTo(-9, -3); g.lineTo(9, -3); g.lineTo(0, 9); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = '#ffd400';
      SG.roundRect(g, -2, -9, 4, 6, 1.5); g.fill(); g.stroke();
    } else if (t.kind === 'duck') {
      g.fillStyle = '#ffd400';
      g.beginPath(); g.ellipse(0, 2, 9, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.arc(6, -5, 5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ff7a1a';
      g.beginPath(); g.moveTo(10, -5); g.lineTo(15, -3); g.lineTo(10, -1); g.closePath(); g.fill();
    } else if (t.kind === 'ring') {
      g.strokeStyle = '#00e5ff';
      g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#ff2d6f';
      g.beginPath(); g.arc(0, -8, 3.4, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = '#7c4dff';                 // robot
      SG.roundRect(g, -6, -4, 12, 12, 2); g.fill(); g.stroke();
      SG.roundRect(g, -5, -11, 10, 8, 2); g.fill(); g.stroke();
      g.fillStyle = '#e9f562';
      g.fillRect(-3, -9, 2.4, 2.4);
      g.fillRect(1, -9, 2.4, 2.4);
    }
    g.restore();
  }

  function drawDaley(g) {
    var d = st.daley;
    if (!d) return;
    var p = proj(d.x, 0, d.z);
    var h = 1.75 * p.s * 1.1;
    shadow(g, p, h);
    SG.art.drawSanti(g, p.x, p.y, h, d.phase, {
      face: 'daley', shirt: '#1e63c8', boxColor: '#ffd400', pants: '#20263f',
      run: d.state === 'grab' ? 0.15 : 1,
    });
    if (d.state === 'grab') {
      SG.ui.text(g, 'MINE', p.x, p.y - h * 1.05, {
        size: Math.max(9, h * 0.13), color: '#ffd400', stroke: '#1a1030', strokeWidth: 3, shadow: false,
      });
    }
  }

  // Everything that lives out on the court, split by side so it sorts
  // correctly against the net.
  function drawExtras(g, farSide) {
    var i;
    for (i = 0; i < st.eggs.length; i++) {
      if ((st.eggs[i].z > NET_Z) === farSide) drawEgg(g, st.eggs[i]);
    }
    for (i = 0; i < st.toys.length; i++) {
      if ((st.toys[i].z > NET_Z) === farSide) drawToy(g, st.toys[i]);
    }
    if (st.daley && (st.daley.z > NET_Z) === farSide) drawDaley(g);
  }

  function shadow(g, p, h) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.ellipse(p.x, p.y, h * 0.2, h * 0.06, 0, 0, Math.PI * 2);
    g.fill();
  }

  function drawHUD(g) {
    // scoreboard
    var bw = 210, bx = CX - bw / 2;
    SG.ui.panel(g, bx, 8, bw, 46, { fill: 'rgba(10,8,24,0.8)', r: 12, border: 'rgba(255,255,255,0.14)' });

    var f1 = SG.art.faces.santi, f2 = SG.art.faces.dark;
    if (f1) g.drawImage(f1, bx + 8, 13, 36, 36);
    if (f2) g.drawImage(f2, bx + bw - 44, 13, 36, 36);

    SG.ui.text(g, String(st.score[0]), bx + 74, 31, { size: 28, color: '#fff', shadow: false });
    SG.ui.text(g, '-', CX, 31, { size: 20, color: 'rgba(255,255,255,0.4)', shadow: false });
    SG.ui.text(g, String(st.score[1]), bx + bw - 74, 31, { size: 28, color: '#ff6b8a', shadow: false });
    SG.ui.text(g, 'FIRST TO ' + WIN_SCORE, CX, 64, { size: 10, color: 'rgba(255,255,255,0.35)', shadow: false });

    // wings banked this match
    SG.ui.drawWings(g, st.wings);

    if (st.rally > 2 && st.phase === 'rally') {
      SG.ui.text(g, 'RALLY ' + st.rally, 24, 58, { size: 15, color: 'rgba(255,255,255,0.6)', align: 'left', shadow: false });
    }

    if (st.msg) {
      var k = st.msgT / 1.4;
      g.save();
      g.globalAlpha = 1 - k * k;
      SG.art.tag(g, st.msg.text, CX, 150 - k * 26, 40, st.msg.color, -0.05);
      g.restore();
    }

    if (st.phase === 'serve') {
      SG.ui.text(g, st.server === 0 ? 'YOUR SERVE' : 'DARK SANTI SERVES', CX, SG.H - 62, {
        size: 15, color: 'rgba(255,255,255,0.75)', stroke: '#1a1030', strokeWidth: 4, shadow: false,
      });
      if (st.score[0] + st.score[1] === 0) {
        SG.ui.text(g, 'Drag to move · centre contact = winner', CX, SG.H - 38, {
          size: 13, color: 'rgba(255,255,255,0.45)', shadow: false,
        });
      }
    }

    if (st.phase !== 'over') {
      SG.ui.drawPause(g);
    }
  }

  function drawPaused(g) {
    g.fillStyle = 'rgba(5,6,14,0.78)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 170, 130, 340, 280);
    SG.ui.text(g, 'PAUSED', CX, 180, { size: 34, color: '#fff', shadow: false });
    if (SG.ui.button(g, { x: CX - 120, y: 222, w: 240, h: 48 }, 'RESUME', { color: SG.COLORS.gold })) st.phase = st.ball.live ? 'rally' : 'serve';
    if (SG.ui.button(g, { x: CX - 120, y: 280, w: 240, h: 44 }, 'RESTART', { color: '#3a4270', text: '#fff' })) reset();
    if (SG.ui.button(g, { x: CX - 120, y: 334, w: 240, h: 44 }, 'MENU', { color: '#2a2f52', text: '#fff' })) SG.go('menu');
  }

  function drawOver(g) {
    g.fillStyle = 'rgba(5,6,14,0.82)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 220, 106, 440, 330);

    var won = st.winner === 0;
    if (won) {
      SG.ui.text(g, 'SANTI WINS', CX, 154, { size: 38, color: SG.COLORS.gold, stroke: '#1a1030', strokeWidth: 8, shadow: false });
    } else {
      SG.art.tag(g, 'LAP!', CX, 154, 48, '#ff2d6f', -0.05);
    }

    var face = SG.art.faces[won ? 'santi' : 'dark'];
    if (face) g.drawImage(face, CX - 42, 184, 84, 84);

    SG.ui.text(g, st.score[0] + ' - ' + st.score[1], CX, 286, { size: 32, color: '#fff', shadow: false });

    SG.art.drawWing(g, CX - 56, 314, 1.15, -0.3);
    SG.ui.text(g, '+' + st.wings + ' wings', CX - 36, 314, {
      size: 17, color: SG.COLORS.gold, align: 'left', shadow: false,
    });

    SG.ui.text(g, won ? 'Dark Santi retreats into the shadows' : 'Dark Santi is insufferable about it',
      CX, 336, { size: 13, color: 'rgba(255,255,255,0.45)', shadow: false });

    if (SG.ui.button(g, { x: CX - 190, y: 350, w: 180, h: 52 }, 'REMATCH', { color: SG.COLORS.gold })) reset();
    if (SG.ui.button(g, { x: CX + 10, y: 350, w: 180, h: 52 }, 'MENU', { color: '#3a4270', text: '#fff' })) SG.go('menu');
  }

  function draw(g) {
    CX = SG.W / 2;
    drawBackdrop(g);
    drawCourt(g);

    // painter's order around the net
    var ballBehindNet = st.ball.z > NET_Z;
    if (ballBehindNet) drawBall(g);
    drawPlayersFar(g);
    drawExtras(g, true);
    drawNet(g);
    drawExtras(g, false);
    if (!ballBehindNet) drawBall(g);
    drawPlayersNear(g);

    drawHUD(g);
    if (st.phase === 'paused') drawPaused(g);
    if (st.phase === 'over') drawOver(g);
  }

  function drawPlayersFar(g) {
    var fp = proj(st.ai.x, 0, FAR_Z);
    var fh = 1.75 * fp.s * 1.15;
    shadow(g, fp, fh);
    // Dressed to match the art: black fit, gold box logo picking up the
    // aviator rims, white shoes.
    SG.art.drawSanti(g, fp.x, fp.y, fh, st.t * 5, {
      face: 'dark', shirt: '#17131f', boxColor: '#ffd400', pants: '#12101a',
      shoe: '#f0f0f4', run: Math.abs(st.ai.tx - st.ai.x) > 0.05 ? 1 : 0.12,
    });
    drawPaddle(g, st.ai.x, FAR_Z, st.ai.swing, -1, '#c9ccd8');
  }

  function drawPlayersNear(g) {
    var np = proj(st.me.x, 0, NEAR_Z);
    // Held back from true scale - at full size he blots out the middle
    // of the court and you can't read the incoming ball.
    var nh = 1.75 * np.s * 0.84;
    shadow(g, np, nh);
    SG.art.drawSanti(g, np.x, np.y, nh, st.t * 5, {
      face: 'santi', shirt: SG.COLORS.purple, boxColor: SG.COLORS.red, pants: '#232a46',
      run: Math.abs(st.me.tx - st.me.x) > 0.05 ? 1 : 0.12,
    });
    drawPaddle(g, st.me.x, NEAR_Z, st.me.swing, 1, SG.COLORS.gold);
  }

  SG.register('pickleball', {
    enter: function () { reset(); beginServe(); SG.audio.music.loop(TRACK); },
    exit: function () { SG.audio.music.stop(); },
    update: update,
    draw: draw,
    onBlur: function () { if (st && st.phase !== 'over') st.phase = 'paused'; },
  });
})();
