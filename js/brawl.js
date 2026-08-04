/* =============================================================
   MODE 3 - BRAWL SHOWDOWN
   Daleys close in and smother Santi with hearts. Draft which Santi
   you are, draft a power-up, survive.

   Phone : left thumb moves, right thumb aims - hold to aim, release
           to shoot. A quick tap shoots at the nearest target.
   Desktop: WASD moves, hold left mouse to aim, release to shoot.
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  // Arena is world space; y is depth and gets squashed on screen, which
  // is what gives the three-quarter look. Aiming converts between them.
  var ARENA_W = 1500, ARENA_H = 1020;
  var SQUASH = 0.62;
  var BODY_H = 108;
  var HIT_R = 40;

  var STICK_R = 62, DEAD = 14;
  var MAX_AMMO = 3;
  var RELOAD = 0.95;              // per shell
  var REGEN_DELAY = 3.0;          // quiet seconds before healing starts
  var REGEN_RATE = 8;             // hp per second

  var st;

  // ---------------------------------------------------------------
  // Three kits. Power + range + speed always totals 10 dashes, so the
  // trade-off is explicit and no build is strictly better.
  // ---------------------------------------------------------------
  var KITS = [
    {
      id: 'santi', name: 'SANTI', sub: 'Quick all rounder', face: 'santi',
      shirt: '#7c4dff', box: '#e8202a', ink: '#fff', pants: '#232a46',
      bars: { power: 3, range: 3, speed: 4 },
      hp: 110, dmg: 33, shots: 1, spread: 0, rate: 0.45, bullet: 500,
    },
    {
      id: 'dark', name: 'DARK SANTI', sub: 'Heavy, up close', face: 'dark',
      shirt: '#17131f', box: '#ffd400', ink: '#17120a', pants: '#12101a',
      bars: { power: 5, range: 2, speed: 3 },
      hp: 150, dmg: 18, shots: 3, spread: 0.30, rate: 0.65, bullet: 430,
    },
    {
      id: 'noir', name: 'SANTI NOIR', sub: 'Sniper, fragile', face: 'noir',
      shirt: '#e9e9ef', box: '#141414', ink: '#fff', pants: '#2a2a2f',
      // black and white all the way down, arms and hands included
      skin: '#c6c6cc', shoe: '#f4f4f6',
      bars: { power: 4, range: 5, speed: 1 },
      hp: 80, dmg: 46, shots: 1, spread: 0, rate: 0.85, bullet: 700,
    },
  ];

  function kitSpeed(k) { return 152 + k.bars.speed * 22; }
  function kitRange(k) { return 180 + k.bars.range * 72; }

  var POWERS = [
    { id: 'speed',   name: 'SPEED',   desc: '+22% movement',   color: '#4dd47a' },
    { id: 'defence', name: 'DEFENCE', desc: '+28% max health', color: '#4aa8ff' },
    { id: 'attack',  name: 'ATTACK',  desc: '+26% damage',     color: '#e8202a' },
  ];

  // ---------------------------------------------------------------
  function reset(fullRestart) {
    var keep = (!fullRestart && st) ? st : null;
    st = {
      phase: 'draftKit',
      round: keep ? keep.round : 1,
      powers: keep ? keep.powers : { speed: 0, defence: 0, attack: 0 },
      kit: keep ? keep.kit : KITS[0],
      me: null, bots: [], shots: [], crates: [],
      cam: { x: ARENA_W / 2, y: ARENA_H / 2 },
      t: 0, msg: null, msgT: 0,
      moveStick: null, aim: null,
      shake: 0,
      wings: keep ? keep.wings : 0,
      paused: false,
    };
  }

  function powerMult(id) {
    var per = id === 'speed' ? 0.22 : id === 'defence' ? 0.28 : 0.26;
    return Math.pow(1 + per, st.powers[id]);
  }

  function startRound() {
    var maxHp = Math.round(st.kit.hp * powerMult('defence'));
    st.me = {
      x: ARENA_W / 2, y: ARENA_H / 2,
      hp: maxHp, maxHp: maxHp,
      ammo: MAX_AMMO, reload: 0,
      phase: 0, moving: false,
      hurtT: 99, shotT: 99, flash: 0,
    };
    st.bots = [];
    st.shots = [];
    st.crates = [];

    var spots = [[300, 300], [1200, 300], [300, 720], [1200, 720], [750, 200], [750, 830]];
    for (var c = 0; c < spots.length; c++) {
      st.crates.push({ x: spots[c][0], y: spots[c][1], w: 108, h: 92 });
    }

    var count = 4 + st.round;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2 + 0.4;
      st.bots.push(makeBot(ARENA_W / 2 + Math.cos(a) * 560, ARENA_H / 2 + Math.sin(a) * 400, i));
    }
    st.phase = 'fight';
    say('ROUND ' + st.round);
    SG.audio.play('power');
  }

  function makeBot(x, y, i) {
    var tough = 1 + (st.round - 1) * 0.28;
    var spot = freeSpot(x, y);
    return {
      x: spot.x, y: spot.y,
      hp: 130 * tough, maxHp: 130 * tough,
      speed: 96 + st.round * 7 + (i % 3) * 9,
      cool: SG.rand(0.6, 2.0),
      rate: Math.max(0.72, 1.7 - st.round * 0.1),
      phase: Math.random() * 6.28,
      strafe: Math.random() < 0.5 ? 1 : -1,
      stuckT: 0, detour: 0,
      hurt: 0, dead: 0,
      shirt: ['#1e63c8', '#c8306a', '#2f8f7d'][i % 3],
    };
  }

  function say(text, color) { st.msg = { text: text, color: color || SG.COLORS.gold }; st.msgT = 0; }

  // ---------------------------------------------------------------
  function update(dt) {
    st.t += dt;
    if (st.msg) { st.msgT += dt; if (st.msgT > 2) st.msg = null; }
    if (st.shake > 0) st.shake -= dt * 40;

    if (st.paused || st.phase !== 'fight') return;

    if (SG.input.tappedRect(pauseRect())) {
      st.paused = true;
      // Pausing lets go of every touch, so pause-and-resume clears a
      // stick that the browser never told us had been released.
      SG.input.releaseAll();
      st.moveStick = null;
      st.aim = null;
      SG.audio.play('back');
      return;
    }

    var me = st.me;
    me.hurtT += dt;
    me.shotT += dt;
    if (me.flash > 0) me.flash -= dt;

    // reload one shell at a time
    if (me.ammo < MAX_AMMO) {
      me.reload += dt;
      if (me.reload >= RELOAD) { me.reload = 0; me.ammo++; SG.audio.play('record'); }
    } else me.reload = 0;

    // Regenerate only while genuinely out of the fight.
    if (me.hurtT > REGEN_DELAY && me.shotT > 2 && me.hp < me.maxHp) {
      me.hp = Math.min(me.maxHp, me.hp + REGEN_RATE * dt);
    }

    readControls(dt);
    updateBots(dt);
    updateShots(dt);

    var halfW = SG.W / 2, halfH = SG.H / (2 * SQUASH);
    var tx = SG.clamp(me.x, halfW, Math.max(halfW, ARENA_W - halfW));
    var ty = SG.clamp(me.y, halfH * 0.75, Math.max(halfH * 0.75, ARENA_H - halfH * 0.55));
    st.cam.x += (tx - st.cam.x) * Math.min(1, dt * 7);
    st.cam.y += (ty - st.cam.y) * Math.min(1, dt * 7);

    if (st.bots.filter(function (b) { return b.hp > 0; }).length === 0) {
      var earned = 60 + st.round * 40;
      st.wings += earned;
      SG.save.data.wings = (SG.save.data.wings || 0) + earned;
      SG.save.submit('brawl', st.round);
      SG.save.write();
      st.phase = 'won';
      SG.audio.play('wingbig');
    }
    if (me.hp <= 0) {
      st.phase = 'dead';
      SG.audio.play('crash');
      setTimeout(function () { SG.audio.play('lap'); }, 250);
      SG.shake(14);
    }
  }

  /* Movement and aiming.
     A finger starting on the left half is the move stick. A finger on
     the right half - or the mouse anywhere - is the aim. Aim is held
     and released rather than fired on press, so you can see where the
     shot is going before you commit it. */
  function readControls(dt) {
    var me = st.me;
    var mvP = null, aimP = null;

    for (var id in SG.input.pointers) {
      var p = SG.input.pointers[id];
      if (p.type === 'mouse') { if (!aimP) aimP = p; }
      else if (p.sx < SG.W / 2) { if (!mvP) mvP = p; }
      else if (!aimP) aimP = p;
    }

    // ---- move ----
    st.moveStick = mvP ? stickVec(mvP) : null;
    var vx = 0, vy = 0;
    if (st.moveStick && st.moveStick.mag > DEAD) {
      vx = st.moveStick.dx / STICK_R;
      vy = st.moveStick.dy / STICK_R;
    }
    var k = SG.input.keys;
    if (k.KeyA || k.ArrowLeft) vx = -1;
    if (k.KeyD || k.ArrowRight) vx = 1;
    if (k.KeyW || k.ArrowUp) vy = -1;
    if (k.KeyS || k.ArrowDown) vy = 1;

    var m = Math.hypot(vx, vy);
    me.moving = m > 0.05;
    if (me.moving) {
      if (m > 1) { vx /= m; vy /= m; }
      me.phase += dt * 11;
      var sp = kitSpeed(st.kit) * powerMult('speed');
      moveEntity(me, vx * sp * dt, vy * sp * dt);
    }

    // ---- aim ----
    if (aimP) {
      var dx, dy;
      if (aimP.type === 'mouse') {
        // aim straight at the cursor
        dx = aimP.x - sx(me.x);
        dy = aimP.y - sy(me.y) + BODY_H * 0.5;
      } else {
        dx = aimP.x - aimP.sx;
        dy = aimP.y - aimP.sy;
      }
      var mag = Math.hypot(dx, dy);
      st.aim = {
        ox: aimP.type === 'mouse' ? sx(me.x) : aimP.sx,
        oy: aimP.type === 'mouse' ? sy(me.y) - BODY_H * 0.5 : aimP.sy,
        dx: dx, dy: dy, mag: mag,
        mouse: aimP.type === 'mouse',
        ang: Math.atan2(dy / SQUASH, dx),
      };
    } else if (st.aim) {
      // released - this is the shot
      var a = st.aim;
      st.aim = null;
      fire(a.mag > DEAD ? a.ang : null);
      // The same gesture also lands in the tap queue; drop it or the
      // shot goes out twice.
      for (var d = SG.input.taps.length - 1; d >= 0; d--) {
        if (SG.input.taps[d].x >= 0) SG.input.taps.splice(d, 1);
      }
    } else {
      // A tap so brief no frame saw the finger down still fires, at
      // whoever is closest.
      for (var i = 0; i < SG.input.taps.length; i++) {
        if (SG.input.taps[i].x > SG.W / 2) {
          SG.input.taps.splice(i, 1);
          fire(null);
          break;
        }
      }
    }
  }

  // `ang` null means auto-aim at whoever is closest.
  function fire(ang) {
    var me = st.me;
    if (me.ammo < 1) { SG.audio.play('back'); return; }
    if (ang === null) {
      var near = nearestBot();
      if (!near) return;
      ang = Math.atan2(near.y - me.y, near.x - me.x);
    }

    var kit = st.kit;
    var dmg = kit.dmg * powerMult('attack');
    var range = kitRange(kit);
    for (var n = 0; n < kit.shots; n++) {
      var off = kit.shots === 1 ? 0 : (n - (kit.shots - 1) / 2) * kit.spread;
      st.shots.push({
        x: me.x, y: me.y, mine: true,
        vx: Math.cos(ang + off) * kit.bullet,
        vy: Math.sin(ang + off) * kit.bullet,
        life: range / kit.bullet,
        dmg: dmg, rot: 0,
      });
    }
    me.ammo--;
    me.shotT = 0;
    me.flash = 0.12;
    SG.audio.play('pop');
  }

  function stickVec(p) {
    var dx = p.x - p.sx, dy = p.y - p.sy;
    var d = Math.hypot(dx, dy);
    var k = d > STICK_R ? STICK_R / d : 1;
    return { ox: p.sx, oy: p.sy, dx: dx * k, dy: dy * k, mag: Math.min(d, STICK_R) };
  }

  function nearestBot() {
    var best = null, bd = 1e9;
    for (var i = 0; i < st.bots.length; i++) {
      var b = st.bots[i];
      if (b.hp <= 0) continue;
      var d = Math.hypot(b.x - st.me.x, b.y - st.me.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // ---------------------------------------------------------------
  function moveEntity(e, dx, dy) {
    var stuck = hitsCrate(e.x, e.y);
    e.x = SG.clamp(e.x + dx, 40, ARENA_W - 40);
    if (!stuck && hitsCrate(e.x, e.y)) e.x -= dx;
    e.y = SG.clamp(e.y + dy, 60, ARENA_H - 40);
    if (!stuck && hitsCrate(e.x, e.y)) e.y -= dy;
  }

  function hitsCrate(x, y) {
    for (var i = 0; i < st.crates.length; i++) {
      var c = st.crates[i];
      if (Math.abs(x - c.x) < c.w / 2 + 22 && Math.abs(y - c.y) < c.h / 2 + 14) return true;
    }
    return false;
  }

  function freeSpot(x, y) {
    for (var i = 0; i < st.crates.length; i++) {
      var c = st.crates[i];
      var mx = c.w / 2 + 24, my = c.h / 2 + 16;
      var dx = Math.abs(x - c.x), dy = Math.abs(y - c.y);
      if (dx < mx && dy < my) {
        if (mx - dx < my - dy) x += (x < c.x ? -(mx - dx) : (mx - dx));
        else y += (y < c.y ? -(my - dy) : (my - dy));
      }
    }
    return { x: SG.clamp(x, 70, ARENA_W - 70), y: SG.clamp(y, 80, ARENA_H - 70) };
  }

  function updateBots(dt) {
    for (var i = 0; i < st.bots.length; i++) {
      var b = st.bots[i];
      if (b.hp <= 0) { if (b.dead < 1) b.dead += dt * 2; continue; }
      if (b.hurt > 0) b.hurt -= dt;

      var dx = st.me.x - b.x, dy = st.me.y - b.y;
      var d = Math.hypot(dx, dy) || 1;
      var vx, vy;

      // Walk around cover rather than into it - otherwise she can park
      // behind a crate on the player's line and the round never ends.
      if (b.detour > 0) {
        b.detour -= dt;
        vx = -dy / d * b.strafe; vy = dx / d * b.strafe;
      } else if (d > 190) {
        vx = dx / d; vy = dy / d;
      } else {
        vx = -dy / d * b.strafe * 0.9 - dx / d * 0.25;
        vy = dx / d * b.strafe * 0.9 - dy / d * 0.25;
      }

      b.phase += dt * 9;
      var bx = b.x, by = b.y;
      moveEntity(b, vx * b.speed * dt, vy * b.speed * dt);
      if (b.detour <= 0) {
        if (Math.hypot(b.x - bx, b.y - by) < b.speed * dt * 0.4) {
          b.stuckT += dt;
          if (b.stuckT > 0.3) { b.detour = 1.2; b.strafe *= -1; b.stuckT = 0; }
        } else b.stuckT = 0;
      }

      b.cool -= dt;
      if (b.cool <= 0 && d < 520) {
        b.cool = b.rate * SG.rand(0.85, 1.25);
        var a = Math.atan2(dy, dx) + SG.rand(-0.16, 0.16);
        st.shots.push({
          x: b.x, y: b.y, mine: false,
          vx: Math.cos(a) * 250, vy: Math.sin(a) * 250,
          life: 2.4, dmg: 9 + st.round, rot: 0,
        });
        SG.audio.play('tap');
      }
    }
  }

  // Closest approach of a moving point to a target, so a fast bullet
  // can't skip past a Daley between frames.
  function segDist(ax, ay, bx, by, px, py) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = SG.clamp(t, 0, 1);
    return Math.hypot(ax + dx * t - px, ay + dy * t - py);
  }

  function updateShots(dt) {
    for (var i = st.shots.length - 1; i >= 0; i--) {
      var s = st.shots[i];
      var px = s.x, py = s.y;
      s.life -= dt;
      // velocity is world space; the firing angle already undid the squash
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += dt * 6;

      if (s.life <= 0 || s.x < 20 || s.x > ARENA_W - 20 || s.y < 30 || s.y > ARENA_H - 20 ||
          hitsCrate(s.x, s.y)) { st.shots.splice(i, 1); continue; }

      if (s.mine) {
        for (var b = 0; b < st.bots.length; b++) {
          var bot = st.bots[b];
          if (bot.hp <= 0) continue;
          if (segDist(px, py, s.x, s.y, bot.x, bot.y) < HIT_R) {
            bot.hp -= s.dmg;
            bot.hurt = 0.16;
            SG.burst(sx(s.x), sy(s.y) - 46, 6, { colors: ['#ffb02e', '#fff4e0'], speedMax: 180, gravity: 260, rMax: 4, life: 0.4 });
            if (bot.hp <= 0) {
              SG.audio.play('wing');
              SG.burst(sx(bot.x), sy(bot.y) - 50, 20, { colors: ['#ff6b8a', '#ff2d6f', '#fff'], speedMax: 260, gravity: 180 });
            } else SG.audio.play('bounce');
            st.shots.splice(i, 1);
            break;
          }
        }
      } else if (segDist(px, py, s.x, s.y, st.me.x, st.me.y) < HIT_R * 0.8) {
        st.me.hp -= s.dmg;
        st.me.hurtT = 0;
        st.shake = 7;
        SG.audio.play('back');
        SG.burst(sx(st.me.x), sy(st.me.y) - 50, 10, { colors: ['#ff6b8a', '#ff2d6f'], speedMax: 200, gravity: 200 });
        st.shots.splice(i, 1);
      }
    }
  }

  function pauseRect() { return { x: SG.W - 56, y: 14, w: 40, h: 34 }; }

  // ---------------------------------------------------------------
  function sx(wx) { return wx - st.cam.x + SG.W / 2; }
  function sy(wy) { return (wy - st.cam.y) * SQUASH + SG.H / 2; }

  function draw(g) {
    if (st.phase === 'draftKit') { drawDraftKit(g); return; }
    if (st.phase === 'draftPower') { drawDraftPower(g); return; }

    g.save();
    if (st.shake > 0) g.translate(SG.rand(-st.shake, st.shake), SG.rand(-st.shake, st.shake));

    drawArena(g);
    drawAim(g);                       // under the characters

    var things = [];
    for (var i = 0; i < st.crates.length; i++) things.push({ y: st.crates[i].y, k: 'crate', o: st.crates[i] });
    for (var b = 0; b < st.bots.length; b++) things.push({ y: st.bots[b].y, k: 'bot', o: st.bots[b] });
    things.push({ y: st.me.y, k: 'me', o: st.me });
    things.sort(function (a, c) { return a.y - c.y; });
    for (var t = 0; t < things.length; t++) {
      if (things[t].k === 'crate') drawCrate(g, things[t].o);
      else if (things[t].k === 'bot') drawBot(g, things[t].o);
      else drawMe(g);
    }

    drawShots(g);
    g.restore();

    drawHUD(g);
    drawSticks(g);

    if (st.paused) drawPaused(g);
    if (st.phase === 'won') drawWon(g);
    if (st.phase === 'dead') drawDead(g);
  }

  function drawArena(g) {
    g.fillStyle = '#2a6b3f';
    g.fillRect(0, 0, SG.W, SG.H);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (var i = 0; i < 26; i++) {
      var yy = sy(i * 44);
      if (yy > -20 && yy < SG.H + 20) g.fillRect(0, yy, SG.W, 22);
    }
    g.strokeStyle = 'rgba(12,30,18,0.85)';
    g.lineWidth = 14;
    g.strokeRect(sx(20), sy(20), ARENA_W - 40, (ARENA_H - 40) * SQUASH);
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.lineWidth = 3;
    g.strokeRect(sx(20), sy(20), ARENA_W - 40, (ARENA_H - 40) * SQUASH);
  }

  /* Aim readout: the reach ellipse, the line the shot will take, and
     for the spread kits the actual cone. Drawn on the ground plane so
     the distances mean something. */
  function drawAim(g) {
    var me = st.me, range = kitRange(st.kit);
    var ox = sx(me.x), oy = sy(me.y);

    // faint reach ring, always on
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.10)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(ox, oy, range, range * SQUASH, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    if (!st.aim || st.aim.mag <= DEAD) return;
    var a = st.aim.ang;
    var canFire = me.ammo >= 1;
    var col = canFire ? 'rgba(255,214,80,' : 'rgba(255,90,90,';

    g.save();
    // cone for spread weapons, single line otherwise
    var half = st.kit.shots > 1 ? st.kit.spread * (st.kit.shots - 1) / 2 : 0;
    if (half > 0) {
      g.fillStyle = col + '0.13)';
      g.beginPath();
      g.moveTo(ox, oy);
      for (var i = -1; i <= 1; i += 0.1) {
        var aa = a + half * i;
        g.lineTo(ox + Math.cos(aa) * range, oy + Math.sin(aa) * range * SQUASH);
      }
      g.closePath();
      g.fill();
    }
    g.strokeStyle = col + '0.85)';
    g.lineWidth = 4;
    g.setLineDash([14, 10]);
    g.beginPath();
    g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(a) * range, oy + Math.sin(a) * range * SQUASH);
    g.stroke();
    g.setLineDash([]);

    // reticle at maximum reach
    var rx = ox + Math.cos(a) * range, ry = oy + Math.sin(a) * range * SQUASH;
    g.strokeStyle = col + '0.95)';
    g.lineWidth = 3;
    g.beginPath(); g.ellipse(rx, ry, 22, 22 * SQUASH, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    g.moveTo(rx - 30, ry); g.lineTo(rx - 12, ry);
    g.moveTo(rx + 12, ry); g.lineTo(rx + 30, ry);
    g.stroke();
    g.restore();
  }

  function drawCrate(g, c) {
    var x = sx(c.x), y = sy(c.y);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y + 6, c.w * 0.5, c.h * 0.22, 0, 0, Math.PI * 2); g.fill();
    var h = 62;
    g.fillStyle = '#7a5a34';
    SG.roundRect(g, x - c.w / 2, y - h, c.w, h, 6); g.fill();
    g.fillStyle = '#956f42';
    SG.roundRect(g, x - c.w / 2, y - h - 12, c.w, 20, 6); g.fill();
    g.strokeStyle = 'rgba(30,18,8,0.6)';
    g.lineWidth = 3;
    SG.roundRect(g, x - c.w / 2, y - h, c.w, h, 6); g.stroke();
    SG.art.boxLogo(g, x, y - h * 0.45, c.w * 0.62, 'SANTI', '#e8202a');
  }

  function drawMe(g) {
    var me = st.me;
    var x = sx(me.x), y = sy(me.y);
    shadow(g, x, y, 40);
    g.save();
    if (me.hurtT < 0.25 && Math.floor(st.t * 24) % 2 === 0) g.globalAlpha = 0.45;
    SG.art.drawSanti(g, x, y, BODY_H, me.phase, {
      face: st.kit.face, shirt: st.kit.shirt, boxColor: st.kit.box,
      boxInk: st.kit.ink, pants: st.kit.pants,
      skin: st.kit.skin, shoe: st.kit.shoe,
      run: me.moving ? 1 : 0.08,
    });
    g.restore();
    healthBar(g, x, y - BODY_H - 30, me.hp / me.maxHp, '#4dd47a', 66);
    ammoPips(g, x, y + 12);
  }

  function ammoPips(g, x, y) {
    var me = st.me, w = 17, gap = 5;
    var total = MAX_AMMO * w + (MAX_AMMO - 1) * gap;
    for (var i = 0; i < MAX_AMMO; i++) {
      var px = x - total / 2 + i * (w + gap);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      SG.roundRect(g, px, y, w, 8, 4); g.fill();
      if (i < me.ammo) {
        g.fillStyle = '#ffd400';
        SG.roundRect(g, px, y, w, 8, 4); g.fill();
      } else if (i === me.ammo && me.ammo < MAX_AMMO) {
        g.fillStyle = 'rgba(255,212,0,0.5)';       // the one being reloaded
        SG.roundRect(g, px, y, w * (me.reload / RELOAD), 8, 4); g.fill();
      }
    }
  }

  function drawBot(g, b) {
    var x = sx(b.x), y = sy(b.y);
    if (b.hp <= 0) {
      if (b.dead >= 1) return;
      g.save();
      g.globalAlpha = 1 - b.dead;
      g.translate(x, y);
      g.scale(1, 1 - b.dead * 0.4);
      drawHeart(g, 0, -60, 1.6 + b.dead * 2, 0);
      g.restore();
      return;
    }
    shadow(g, x, y, 36);
    g.save();
    if (b.hurt > 0) g.globalAlpha = 0.55;
    SG.art.drawSanti(g, x, y, BODY_H * 0.94, b.phase, {
      face: 'daley', shirt: b.shirt, boxColor: '#ffd400', boxInk: '#17120a', pants: '#20263f', run: 1,
    });
    g.restore();
    healthBar(g, x, y - BODY_H - 22, b.hp / b.maxHp, '#ff6b8a', 50);

    if (Math.floor(st.t * 2 + b.phase) % 4 === 0) {
      g.save();
      g.globalAlpha = 0.5;
      drawHeart(g, x + Math.sin(st.t * 3 + b.phase) * 16, y - BODY_H - 36 - (st.t * 20 % 22), 0.5, 0);
      g.restore();
    }
  }

  function shadow(g, x, y, r) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(x, y, r, r * 0.34, 0, 0, Math.PI * 2); g.fill();
  }

  function healthBar(g, x, y, frac, color, w) {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    SG.roundRect(g, x - w / 2, y, w, 9, 4.5); g.fill();
    g.fillStyle = color;
    SG.roundRect(g, x - w / 2, y, w * SG.clamp(frac, 0, 1), 9, 4.5); g.fill();
  }

  function drawShots(g) {
    for (var i = 0; i < st.shots.length; i++) {
      var s = st.shots[i];
      var x = sx(s.x), y = sy(s.y);
      if (s.mine) SG.art.drawWing(g, x, y - 46, 1.05, s.rot);
      else drawHeart(g, x, y - 44, 0.85, Math.sin(s.rot) * 0.3);
    }
  }

  function drawHeart(g, x, y, s, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(s, s);
    g.fillStyle = '#ff2d6f';
    g.strokeStyle = '#7a0f30';
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(0, 12);
    g.bezierCurveTo(-16, 0, -13, -13, -6, -13);
    g.bezierCurveTo(-2, -13, 0, -9, 0, -7);
    g.bezierCurveTo(0, -9, 2, -13, 6, -13);
    g.bezierCurveTo(13, -13, 16, 0, 0, 12);
    g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.ellipse(-5, -6, 3, 2, -0.5, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawSticks(g) {
    var s = st.moveStick;
    if (s) {
      g.save();
      g.globalAlpha = 0.4;
      g.strokeStyle = '#fff';
      g.lineWidth = 4;
      g.beginPath(); g.arc(s.ox, s.oy, STICK_R, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.arc(s.ox + s.dx, s.oy + s.dy, 26, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    var a = st.aim;
    if (a && !a.mouse) {
      g.save();
      g.globalAlpha = 0.4;
      g.strokeStyle = SG.COLORS.gold;
      g.lineWidth = 4;
      g.beginPath(); g.arc(a.ox, a.oy, STICK_R, 0, Math.PI * 2); g.stroke();
      var k = a.mag > STICK_R ? STICK_R / a.mag : 1;
      g.fillStyle = 'rgba(255,176,46,0.6)';
      g.beginPath(); g.arc(a.ox + a.dx * k, a.oy + a.dy * k, 26, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }

  function drawHUD(g) {
    SG.ui.panel(g, 16, 14, 250, 56, { fill: 'rgba(10,8,24,0.8)', r: 12, border: 'rgba(255,214,80,0.4)' });
    SG.ui.text(g, 'ROUND ' + st.round, 30, 34, { size: 16, color: '#ffd400', align: 'left', shadow: false });
    var alive = st.bots.filter(function (b) { return b.hp > 0; }).length;
    SG.ui.text(g, alive + ' DALEY' + (alive === 1 ? '' : 'S') + ' LEFT', 30, 56, {
      size: 13, color: 'rgba(255,255,255,0.65)', align: 'left', shadow: false,
    });

    var px = 280;
    POWERS.forEach(function (p) {
      var n = st.powers[p.id];
      if (!n) return;
      g.fillStyle = p.color;
      SG.roundRect(g, px, 24, 34, 34, 8); g.fill();
      SG.ui.text(g, String(n), px + 17, 41, { size: 15, color: '#0d0a18', shadow: false });
      px += 42;
    });

    SG.art.drawWing(g, SG.W - 130, 34, 1.0, -0.3);
    SG.ui.text(g, String(st.wings), SG.W - 114, 34, {
      size: 18, color: SG.COLORS.gold, align: 'left', stroke: '#1a1030', strokeWidth: 4, shadow: false,
    });

    if (st.msg) {
      g.save();
      g.globalAlpha = 1 - Math.pow(st.msgT / 2, 2);
      SG.art.tag(g, st.msg.text, SG.W / 2, 120, 36, st.msg.color, -0.04);
      g.restore();
    }

    if (st.phase === 'fight' && !st.paused) {
      var pr = pauseRect();
      g.fillStyle = 'rgba(10,12,26,0.5)';
      SG.roundRect(g, pr.x, pr.y, pr.w, pr.h, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(pr.x + 13, pr.y + 10, 5, 15);
      g.fillRect(pr.x + 23, pr.y + 10, 5, 15);
    }

    if (st.round === 1 && st.t < 8 && st.phase === 'fight') {
      SG.ui.text(g, SG.platform.touch
        ? 'LEFT THUMB MOVES  ·  HOLD RIGHT TO AIM, RELEASE TO SHOOT'
        : 'WASD TO MOVE  ·  HOLD LEFT MOUSE TO AIM, RELEASE TO SHOOT',
        SG.W / 2, SG.H - 26, {
          size: 14, color: 'rgba(255,255,255,0.65)', stroke: '#0d2a18', strokeWidth: 4, shadow: false,
        });
    }
  }

  // ---------------------------------------------------------------
  function draftBackdrop(g, title, sub) {
    var bg = g.createLinearGradient(0, 0, 0, SG.H);
    bg.addColorStop(0, '#1a1038');
    bg.addColorStop(1, '#0c0820');
    g.fillStyle = bg;
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.text(g, title, SG.W / 2, 52, { size: 30, color: '#fff', stroke: '#1a1030', strokeWidth: 7, shadow: false });
    SG.ui.text(g, sub, SG.W / 2, 80, { size: 13, color: 'rgba(255,255,255,0.5)', shadow: false });
  }

  function drawDraftKit(g) {
    draftBackdrop(g, 'CHOOSE YOUR SANTI', 'Round ' + st.round + '   ·   every kit totals 10');
    var cw = 250, gap = 26;
    var x0 = (SG.W - (cw * 3 + gap * 2)) / 2;

    for (var i = 0; i < KITS.length; i++) {
      var k = KITS[i];
      var r = { x: x0 + i * (cw + gap), y: 104, w: cw, h: 352 };
      var hot = SG.input.tappedRect(r);

      g.fillStyle = 'rgba(28,22,58,0.95)';
      SG.roundRect(g, r.x, r.y, r.w, r.h, 16); g.fill();
      g.strokeStyle = k.id === 'noir' ? '#e9e9ef' : k.shirt;
      g.lineWidth = 3;
      SG.roundRect(g, r.x, r.y, r.w, r.h, 16); g.stroke();

      SG.art.drawSanti(g, r.x + r.w / 2, r.y + 190, 158, -Math.PI / 2, {
        face: k.face, shirt: k.shirt, boxColor: k.box, boxInk: k.ink, pants: k.pants,
        skin: k.skin, shoe: k.shoe, run: 0.1,
      });

      SG.ui.text(g, k.name, r.x + r.w / 2, r.y + 218, { size: 19, color: '#fff', shadow: false });
      SG.ui.text(g, k.sub, r.x + r.w / 2, r.y + 240, { size: 12, color: 'rgba(255,255,255,0.5)', shadow: false });
      SG.ui.text(g, k.hp + ' HP', r.x + r.w / 2, r.y + 260, { size: 12, color: '#4dd47a', shadow: false });

      var rows = [['POWER', k.bars.power], ['RANGE', k.bars.range], ['SPEED', k.bars.speed]];
      for (var b = 0; b < rows.length; b++) {
        var by = r.y + 284 + b * 22;
        SG.ui.text(g, rows[b][0], r.x + 22, by, { size: 10, color: 'rgba(255,255,255,0.45)', align: 'left', shadow: false });
        for (var p = 0; p < 5; p++) {
          g.fillStyle = p < rows[b][1] ? SG.COLORS.gold : 'rgba(255,255,255,0.13)';
          SG.roundRect(g, r.x + 88 + p * 26, by - 6, 20, 11, 3); g.fill();
        }
      }

      if (hot) { st.kit = k; st.phase = 'draftPower'; SG.audio.play('select'); return; }
    }
  }

  function drawDraftPower(g) {
    draftBackdrop(g, 'PICK A POWER-UP', 'They stack every round');
    var cw = 230, gap = 30;
    var x0 = (SG.W - (cw * 3 + gap * 2)) / 2;

    for (var i = 0; i < POWERS.length; i++) {
      var p = POWERS[i];
      var r = { x: x0 + i * (cw + gap), y: 140, w: cw, h: 250 };
      var hot = SG.input.tappedRect(r);

      g.fillStyle = 'rgba(28,22,58,0.95)';
      SG.roundRect(g, r.x, r.y, r.w, r.h, 16); g.fill();
      g.strokeStyle = p.color;
      g.lineWidth = 3;
      SG.roundRect(g, r.x, r.y, r.w, r.h, 16); g.stroke();

      g.fillStyle = p.color;
      g.beginPath(); g.arc(r.x + r.w / 2, r.y + 86, 42, 0, Math.PI * 2); g.fill();
      drawPowerIcon(g, p.id, r.x + r.w / 2, r.y + 86);

      SG.ui.text(g, p.name, r.x + r.w / 2, r.y + 158, { size: 22, color: '#fff', shadow: false });
      SG.ui.text(g, p.desc, r.x + r.w / 2, r.y + 184, { size: 13, color: 'rgba(255,255,255,0.6)', shadow: false });
      var have = st.powers[p.id];
      SG.ui.text(g, have ? 'OWNED ×' + have : '—', r.x + r.w / 2, r.y + 214, {
        size: 12, color: have ? p.color : 'rgba(255,255,255,0.25)', shadow: false,
      });

      if (hot) { st.powers[p.id]++; SG.audio.play('power'); startRound(); return; }
    }
  }

  function drawPowerIcon(g, id, x, y) {
    g.save();
    g.translate(x, y);
    g.fillStyle = '#0d0a18';
    if (id === 'speed') {
      g.beginPath();
      g.moveTo(6, -20); g.lineTo(-10, 2); g.lineTo(0, 2); g.lineTo(-6, 20); g.lineTo(10, -3); g.lineTo(0, -3);
      g.closePath(); g.fill();
    } else if (id === 'defence') {
      g.beginPath();
      g.moveTo(0, -20); g.lineTo(16, -12); g.lineTo(16, 4); g.quadraticCurveTo(16, 16, 0, 21);
      g.quadraticCurveTo(-16, 16, -16, 4); g.lineTo(-16, -12);
      g.closePath(); g.fill();
    } else {
      SG.art.drawWing(g, 0, 0, 1.7, -0.3);
    }
    g.restore();
  }

  function drawPaused(g) {
    g.fillStyle = 'rgba(5,6,14,0.8)';
    g.fillRect(0, 0, SG.W, SG.H);
    var CX = SG.W / 2;
    SG.ui.panel(g, CX - 170, 130, 340, 280);
    SG.ui.text(g, 'PAUSED', CX, 180, { size: 34, color: '#fff', shadow: false });
    if (SG.ui.button(g, { x: CX - 120, y: 222, w: 240, h: 48 }, 'RESUME', { color: SG.COLORS.gold })) st.paused = false;
    if (SG.ui.button(g, { x: CX - 120, y: 280, w: 240, h: 44 }, 'RESTART', { color: '#3a4270', text: '#fff' })) reset(true);
    if (SG.ui.button(g, { x: CX - 120, y: 334, w: 240, h: 44 }, 'MENU', { color: '#2a2f52', text: '#fff' })) SG.go('menu');
  }

  function drawWon(g) {
    var CX = SG.W / 2;
    g.fillStyle = 'rgba(5,6,14,0.82)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 220, 100, 440, 320);
    SG.ui.text(g, 'ROUND ' + st.round + ' CLEAR', CX, 150, {
      size: 32, color: SG.COLORS.gold, stroke: '#1a1030', strokeWidth: 7, shadow: false,
    });
    SG.ui.text(g, 'Every Daley accounted for.', CX, 186, { size: 14, color: 'rgba(255,255,255,0.55)', shadow: false });
    SG.art.drawWing(g, CX - 62, 234, 1.3, -0.3);
    SG.ui.text(g, '+' + (60 + st.round * 40) + ' wings', CX - 40, 234, {
      size: 18, color: SG.COLORS.gold, align: 'left', shadow: false,
    });
    SG.ui.text(g, 'Health restores between rounds', CX, 274, { size: 12, color: 'rgba(255,255,255,0.4)', shadow: false });

    if (SG.ui.button(g, { x: CX - 190, y: 312, w: 180, h: 54 }, 'NEXT ROUND', { color: SG.COLORS.gold, size: 16 })) {
      st.round++;
      st.phase = 'draftKit';
    }
    if (SG.ui.button(g, { x: CX + 10, y: 312, w: 180, h: 54 }, 'MENU', { color: '#3a4270', text: '#fff' })) SG.go('menu');
  }

  function drawDead(g) {
    var CX = SG.W / 2;
    g.fillStyle = 'rgba(5,6,14,0.86)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 220, 100, 440, 320);
    SG.art.tag(g, 'LAP!', CX, 152, 46, '#ff2d6f', -0.05);
    SG.ui.text(g, 'Smothered.', CX, 196, { size: 16, color: 'rgba(255,255,255,0.6)', shadow: false });
    SG.ui.text(g, 'ROUND ' + st.round, CX, 244, { size: 34, color: '#fff', shadow: false });
    SG.ui.text(g, 'BEST  ' + SG.save.best('brawl'), CX, 276, { size: 13, color: 'rgba(255,255,255,0.4)', shadow: false });
    SG.art.drawWing(g, CX - 58, 302, 1.15, -0.3);
    SG.ui.text(g, '+' + st.wings + ' wings', CX - 38, 302, { size: 16, color: SG.COLORS.gold, align: 'left', shadow: false });

    if (SG.ui.button(g, { x: CX - 190, y: 332, w: 180, h: 54 }, 'AGAIN', { color: SG.COLORS.gold })) reset(true);
    if (SG.ui.button(g, { x: CX + 10, y: 332, w: 180, h: 54 }, 'MENU', { color: '#3a4270', text: '#fff' })) SG.go('menu');
  }

  SG.register('brawl', {
    enter: function () { reset(true); },
    update: update,
    draw: draw,
    onBlur: function () { if (st && st.phase === 'fight') st.paused = true; },
  });
})();
