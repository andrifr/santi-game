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

  // Loops for as long as he is in here; the scene's exit() stops it.
  var TRACK = 'assets/music/brawl.mp3';

  // Arena is world space; y is depth and gets squashed on screen, which
  // is what gives the three-quarter look. Aiming converts between them.
  var ARENA_W = 2000, ARENA_H = 1300;
  var SQUASH = 0.62;
  var BODY_H = 108;
  var HIT_R = 40;                 // a normal Daley; scaled per bot by b.scale

  // Bush rules, lifted from Brawl Stars: cover hides you until you take
  // a shot, or until she is close enough to trip over you.
  var BUSH_REVEAL = 1.0;
  var BUSH_SEE_R = 175;

  var BOSS_EVERY = 5;             // rounds 5, 10, 15 ... get one

  /* Wings are paid at the shared rate every mode targets - roughly 130
     a minute for a competent player. A round runs about 24 + 6r
     seconds (4 + r enemies, each tougher than the last), so the payout
     tracks the round number rather than being flat. Was 60 + 40r, which
     came out at 250+/min and made Brawl twice the earner Wing Run was. */
  var BOSS_WINGS = 90;
  function roundWings(r) { return 30 + r * 18; }

  var STICK_R = 62, DEAD = 14;
  var sawMouse = false;           // set by readControls; see the thumb sticks
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

  /* ---------------------------------------------------------------
     Supers. One per kit, charged by dealing damage, and each doing a
     different job so the draft decides how you fight and not just how
     hard you hit.
     --------------------------------------------------------------- */
  var CHARGE_DMG = 320;        // damage needed to fill the bar
  var CHARGE_KILL = 0.07;      // a little extra for finishing one

  var SUPERS = {
    santi: {
      name: 'WING STORM', short: 'WINGS', color: '#ffb02e',
      desc: 'A ring of wings, every direction at once',
    },
    dark: {
      name: 'THE LEAN', short: 'DASH', color: '#b46ad0',
      desc: 'Lean in, dash through, send them flying',
    },
    noir: {
      name: 'NOIR SHOT', short: 'PIERCE', color: '#e9e9ef',
      desc: 'Pierces the whole arena. Heals you per hit.',
    },
  };

  var POWERS = [
    { id: 'speed',   name: 'SPEED',   desc: '+22% movement',   color: '#4dd47a' },
    { id: 'defence', name: 'DEFENCE', desc: '+28% max health', color: '#4aa8ff' },
    { id: 'attack',  name: 'ATTACK',  desc: '+26% damage',     color: '#e8202a' },
  ];

  /* ---------------------------------------------------------------
     Daleys come in three sizes. The runt is the interesting one: she
     is quick and cheap to kill, so a crowd of them reads as pressure
     rather than as a wall of health. Everything that touches a bot's
     size goes through `scale` - hitbox, sprite, shadow, health bar and
     the padding she keeps off cover - or a big one ends up with a
     hitbox that doesn't match her drawing, which is the bug that took
     three tries to find in Smurf World.
     --------------------------------------------------------------- */
  var BOT_KINDS = {
    runt: { scale: 0.66, hp: 0.40, speed: 1.34, dmg: 0.55, rate: 0.80, shirts: ['#e0498f', '#d8555f'] },
    normal: { scale: 1.00, hp: 1.00, speed: 1.00, dmg: 1.00, rate: 1.00, shirts: ['#1e63c8', '#c8306a', '#2f8f7d'] },
    // She fires three at once, so per-heart damage stays modest - all
    // three landing at contact range is meant to hurt, not to be fatal.
    boss: { scale: 1.95, hp: 3.60, speed: 0.54, dmg: 1.35, rate: 1.55, shirts: ['#7d0f33'] },
  };

  /* Cover. Mixed shapes because they do different jobs: a long wall
     breaks a sight line, a barrel is something to circle, a boulder is
     a hard corner. Bushes are separate - they block nothing, they only
     hide. Kept as one hand-placed layout rather than something random,
     so no round can deal you a spawn with nothing to stand behind. */
  function buildCover() {
    var C = [];
    var box = function (x, y, w, h) { C.push({ kind: 'box', x: x, y: y, w: w, h: h }); };
    var wall = function (x, y, w, h) { C.push({ kind: 'wall', x: x, y: y, w: w, h: h }); };
    var barrel = function (x, y) { C.push({ kind: 'barrel', x: x, y: y, r: 40 }); };
    var rock = function (x, y, r) { C.push({ kind: 'rock', x: x, y: y, r: r }); };

    box(330, 250, 108, 92);   box(1670, 250, 108, 92);
    box(330, 1050, 108, 92);  box(1670, 1050, 108, 92);
    box(1000, 235, 116, 96);  box(1000, 1075, 116, 96);

    wall(640, 650, 300, 54);  wall(1360, 650, 300, 54);
    wall(215, 640, 54, 250);  wall(1785, 640, 54, 250);

    barrel(720, 380);  barrel(1280, 380);
    barrel(720, 920);  barrel(1280, 920);

    rock(470, 470, 60);   rock(1530, 470, 60);
    rock(470, 830, 52);   rock(1530, 830, 52);
    return C;
  }

  // Placed on the flanking routes and one deep in each back corner, so
  // sneaking round the outside is a real option rather than decoration.
  function buildBushes() {
    // Nothing on the arena centre: that is where the player spawns, and
    // starting every round already hidden gives the mechanic away and
    // reads as a bug.
    var pts = [
      [880, 470], [1120, 470], [880, 830], [1120, 830],
      [1000, 810], [180, 300], [1820, 300], [180, 1000], [1820, 1000],
      [640, 1180], [1360, 120],
    ];
    return pts.map(function (p) { return { x: p[0], y: p[1], r: 78 }; });
  }

  // ---------------------------------------------------------------
  function reset(fullRestart) {
    var keep = (!fullRestart && st) ? st : null;
    st = {
      phase: 'draftKit',
      round: keep ? keep.round : 1,
      powers: keep ? keep.powers : { speed: 0, defence: 0, attack: 0 },
      kit: keep ? keep.kit : KITS[0],
      me: null, bots: [], shots: [], beams: [], cover: [], bushes: [],
      boss: null, bossQueued: false, bossWarn: 0, botsTotal: 0,
      hidden: false, bushTaught: keep ? keep.bushTaught : false,
      cam: { x: ARENA_W / 2, y: ARENA_H / 2 },
      t: 0, msg: null, msgT: 0,
      moveStick: null, aim: null,
      sticks: null,
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
      charge: 0, dash: null, superFx: 0,
    };
    st.bots = [];
    st.shots = [];
    st.beams = [];
    st.cover = buildCover();
    st.bushes = buildBushes();
    st.boss = null;
    st.bossWarn = 0;
    st.bossQueued = st.round % BOSS_EVERY === 0;

    // Roughly two in five are runts, on a fixed pattern rather than at
    // random so a round can't roll all-runt and feel like a pushover.
    var count = 4 + st.round;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2 + 0.4;
      st.bots.push(makeBot(
        ARENA_W / 2 + Math.cos(a) * 760, ARENA_H / 2 + Math.sin(a) * 500,
        i, (i % 5 === 1 || i % 5 === 3) ? 'runt' : 'normal'));
    }
    st.botsTotal = count;
    st.phase = 'fight';
    say(st.bossQueued ? 'ROUND ' + st.round + ' · BOSS ROUND' : 'ROUND ' + st.round);
    SG.audio.play('power');
  }

  function makeBot(x, y, i, kind) {
    var K = BOT_KINDS[kind] || BOT_KINDS.normal;
    var tough = 1 + (st.round - 1) * 0.28;
    var hp = 130 * K.hp * tough;
    var spot = freeSpot(x, y, HIT_R * K.scale);
    return {
      kind: kind, scale: K.scale, r: HIT_R * K.scale,
      x: spot.x, y: spot.y,
      hp: hp, maxHp: hp,
      speed: (96 + st.round * 7 + (i % 3) * 9) * K.speed,
      cool: SG.rand(0.6, 2.0),
      rate: Math.max(0.72, 1.7 - st.round * 0.1) * K.rate,
      dmg: (9 + st.round) * K.dmg,
      phase: Math.random() * 6.28,
      strafe: Math.random() < 0.5 ? 1 : -1,
      stuckT: 0, detour: 0,
      hurt: 0, dead: 0,
      // Seeded to the player, never to her own feet: a bot whose last
      // known position is where she already stands has nowhere to walk,
      // and a player who hides at the start freezes the whole round.
      seenX: st.me ? st.me.x : ARENA_W / 2,
      seenY: st.me ? st.me.y : ARENA_H / 2,
      ringT: 5,
      shirt: K.shirts[i % K.shirts.length],
    };
  }

  /* She turns up at the far end of the arena, so there is a moment to
     reposition rather than having her land on top of you. */
  function spawnBoss() {
    var me = st.me;
    var b = makeBot(
      me.x < ARENA_W / 2 ? ARENA_W - 240 : 240,
      me.y < ARENA_H / 2 ? ARENA_H - 240 : 240,
      0, 'boss');
    st.bots.push(b);
    st.boss = b;
    say('DALEY PRIME', '#ff2d6f');
    SG.audio.play('wingbig');
    SG.shake(16);
  }

  // Wings are banked the moment they are earned, never at the end of a
  // run - putting the phone down must never cost anything.
  function bankWings(n) {
    st.wings += n;
    SG.save.data.wings = (SG.save.data.wings || 0) + n;
    SG.save.write();
  }

  function say(text, color) { st.msg = { text: text, color: color || SG.COLORS.gold }; st.msgT = 0; }

  // ---------------------------------------------------------------
  function update(dt) {
    SG.audio.music.follow(!!st.paused);
    st.t += dt;
    if (st.msg) { st.msgT += dt; if (st.msgT > 2) st.msg = null; }
    if (st.shake > 0) st.shake -= dt * 40;

    if (st.paused || st.phase !== 'fight') return;

    // Claimed before readControls, or the same tap also aims and fires.
    if (SG.input.tappedRect(superRect())) { pressSuper(); return; }
    if (SG.input.keys.KeyE && !st.superKeyWas) pressSuper();
    st.superKeyWas = !!SG.input.keys.KeyE;

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

    if (me.superFx > 0) me.superFx -= dt;
    if (me.dash) updateDash(dt);       // dashing overrides steering
    readControls(dt);
    updateSticks(dt);

    // Worked out once a frame: every bot asks about it, and it decides
    // how the player is drawn too.
    st.hidden = !!inBush(me.x, me.y) && me.shotT > BUSH_REVEAL && !me.dash;
    if (st.hidden && !st.bushTaught) {
      st.bushTaught = true;
      say('HIDDEN · SHOOTING GIVES YOU AWAY', '#5fd67f');
    }

    updateBoss(dt);
    updateBots(dt);
    updateShots(dt);
    for (var bi = st.beams.length - 1; bi >= 0; bi--) {
      st.beams[bi].t += dt;
      if (st.beams[bi].t > 0.4) st.beams.splice(bi, 1);
    }

    var halfW = SG.W / 2, halfH = SG.H / (2 * SQUASH);
    var tx = SG.clamp(me.x, halfW, Math.max(halfW, ARENA_W - halfW));
    var ty = SG.clamp(me.y, halfH * 0.75, Math.max(halfH * 0.75, ARENA_H - halfH * 0.55));
    st.cam.x += (tx - st.cam.x) * Math.min(1, dt * 7);
    st.cam.y += (ty - st.cam.y) * Math.min(1, dt * 7);

    // A boss round is not clear until she has been and gone, even if
    // the player wipes out every Daley during the warning.
    if (aliveBots() === 0 && !st.bossQueued && st.bossWarn <= 0) {
      bankWings(roundWings(st.round));
      SG.save.submit('brawl', st.round);
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

    var sr = superRect();
    for (var id in SG.input.pointers) {
      var p = SG.input.pointers[id];
      // A thumb that landed on the super button is not an aim.
      if (inRect(p.sx, p.sy, sr)) continue;
      // A touchscreen laptop is still a mouse player. Remembering which
      // one last touched the screen keeps the thumb sticks off it. It
      // lives outside st because a mouse is a fact about the device, and
      // st is rebuilt between rounds.
      if (p.type === 'mouse') { sawMouse = true; if (!aimP) aimP = p; continue; }
      sawMouse = false;
      if (p.sx < SG.W / 2) { if (!mvP) mvP = p; }
      else if (!aimP) aimP = p;
    }

    // ---- move ----
    st.moveStick = mvP ? stickVec(mvP) : null;
    if (me.dash) { st.moveStick = null; return; }   // the dash steers itself
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

  function aliveBots() {
    var n = 0;
    for (var i = 0; i < st.bots.length; i++) if (st.bots[i].hp > 0) n++;
    return n;
  }

  /* The boss arrives once half the round is down, not at the start:
     the warning has to interrupt something for it to land, and it
     gives the player a reason to keep some health in reserve. */
  function updateBoss(dt) {
    if (st.bossQueued && (st.botsTotal - aliveBots()) >= Math.ceil(st.botsTotal / 2)) {
      st.bossQueued = false;
      st.bossWarn = 3;              // the countdown reads 3, 2, 1 honestly
      SG.audio.play('smash');
      SG.shake(10);
    }
    if (st.bossWarn > 0) {
      st.bossWarn -= dt;
      if (st.bossWarn <= 0) spawnBoss();
    }
  }

  // Big, because it is a one-press button and it is pressed in a panic.
  function superRect() { return { x: SG.W - 168, y: SG.H - 168, w: 148, h: 148 }; }
  function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  function addCharge(amount) {
    var me = st.me;
    if (!me) return;
    var was = me.charge;
    me.charge = Math.min(1, me.charge + amount);
    if (was < 1 && me.charge >= 1) {
      SG.audio.play('power');
      say('SUPER READY', SUPERS[st.kit.id].color);
    }
  }

  /* One press, and it goes. Aiming it was a step too many - by the time
     you have armed it and lined it up, the thing you wanted it for has
     already hit you. If you happen to be holding an aim it uses that,
     otherwise it points itself at whoever is nearest. */
  function pressSuper() {
    var me = st.me;
    if (!me || me.charge < 1) { SG.audio.play('back'); return; }
    var ang;
    if (st.aim && st.aim.mag > DEAD) {
      ang = st.aim.ang;
    } else {
      var near = nearestBot();
      ang = near ? Math.atan2(near.y - me.y, near.x - me.x) : 0;
    }
    fireSuper(ang);
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

  /* Three very different jobs: a panic button for being surrounded, a
     way in for the short-ranged bruiser, and a reach-plus-lifesteal
     answer for the one who dies if anything touches him. */
  function fireSuper(ang) {
    var me = st.me;
    var id = st.kit.id;
    var mult = powerMult('attack');
    me.charge = 0;
    me.superFx = 0.55;
    me.shotT = 0;

    if (id === 'santi') {
      for (var i = 0; i < 12; i++) {
        var a = ang + (i / 12) * Math.PI * 2;
        st.shots.push({
          x: me.x, y: me.y, mine: true, big: true,
          vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
          life: 560 / 430, dmg: 32 * mult, rot: i,
        });
      }
      SG.audio.play('wingbig');
      SG.shake(11);
      SG.burst(sx(me.x), sy(me.y) - 40, 22, {
        colors: ['#ffb02e', '#fff4e0', '#d9501f'], speedMax: 300, gravity: 120,
      });

    } else if (id === 'dark') {
      me.dash = { t: 0, dur: 0.34, ang: ang, hit: [], trail: [] };
      SG.audio.play('smash');
      SG.shake(13);

    } else {
      var len = 1250;
      var ex = me.x + Math.cos(ang) * len, ey = me.y + Math.sin(ang) * len;
      st.beams.push({ x0: me.x, y0: me.y, x1: ex, y1: ey, t: 0 });
      var healed = 0;
      for (var b = 0; b < st.bots.length; b++) {
        var bot = st.bots[b];
        if (bot.hp <= 0) continue;
        if (segDist(me.x, me.y, ex, ey, bot.x, bot.y) < bot.r + 8) {
          bot.hp -= 72 * mult;
          bot.hurt = 0.22;
          healed++;
          SG.burst(sx(bot.x), sy(bot.y) - 46, 12, { colors: ['#fff', '#c9ccd8'], speedMax: 240 });
          if (bot.hp <= 0) killedBot(bot);
        }
      }
      // fragile, so the reward for landing it is staying alive
      if (healed) {
        me.hp = Math.min(me.maxHp, me.hp + 10 * healed);
        SG.burst(sx(me.x), sy(me.y) - 50, 10, { colors: ['#4dd47a', '#fff'], speedMax: 160, lift: 80 });
      }
      SG.audio.play('power');
      SG.shake(9);
    }
  }

  function updateDash(dt) {
    var me = st.me, d = me.dash;
    d.t += dt;
    d.trail.push({ x: me.x, y: me.y, t: 0 });
    if (d.trail.length > 7) d.trail.shift();
    for (var i = 0; i < d.trail.length; i++) d.trail[i].t += dt;

    var step = 1180 * dt;
    moveEntity(me, Math.cos(d.ang) * step, Math.sin(d.ang) * step);
    me.phase += dt * 18;

    for (var b = 0; b < st.bots.length; b++) {
      var bot = st.bots[b];
      if (bot.hp <= 0 || d.hit.indexOf(bot) >= 0) continue;
      if (Math.hypot(bot.x - me.x, bot.y - me.y) < bot.r + 30) {
        d.hit.push(bot);
        bot.hp -= 62 * powerMult('attack');
        bot.hurt = 0.24;
        // sent flying along the dash - the boss is too heavy to shift
        var shove = bot.kind === 'boss' ? 18 : 74;
        moveEntity(bot, Math.cos(d.ang) * shove, Math.sin(d.ang) * shove);
        SG.shake(9);
        SG.burst(sx(bot.x), sy(bot.y) - 46, 16, { colors: ['#b46ad0', '#fff', '#ffd400'], speedMax: 280 });
        if (bot.hp <= 0) killedBot(bot); else SG.audio.play('smash');
      }
    }
    if (d.t >= d.dur) me.dash = null;
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
  /* Anything already inside a collider is allowed to move out - a
     collider that reverts every move traps whatever spawned in it. */
  function moveEntity(e, dx, dy) {
    var s = e.scale || 1;
    var px = 22 * s, py = 14 * s;
    var stuck = hitsCover(e.x, e.y, px, py);
    e.x = SG.clamp(e.x + dx, 40, ARENA_W - 40);
    if (!stuck && hitsCover(e.x, e.y, px, py)) e.x -= dx;
    e.y = SG.clamp(e.y + dy, 60, ARENA_H - 40);
    if (!stuck && hitsCover(e.x, e.y, px, py)) e.y -= dy;
  }

  // Round cover uses a radius, boxes an inflated rectangle. Both tests
  // are world space - applying SQUASH here would bend everything that
  // is offset in depth.
  function hitsCover(x, y, px, py) {
    px = px || 0; py = py === undefined ? px : py;
    for (var i = 0; i < st.cover.length; i++) {
      var c = st.cover[i];
      if (c.r) {
        if (Math.hypot(x - c.x, y - c.y) < c.r + px) return true;
      } else if (Math.abs(x - c.x) < c.w / 2 + px && Math.abs(y - c.y) < c.h / 2 + py) return true;
    }
    return false;
  }

  function inBush(x, y) {
    for (var i = 0; i < st.bushes.length; i++) {
      var b = st.bushes[i];
      if (Math.hypot(x - b.x, y - b.y) < b.r) return b;
    }
    return null;
  }

  // Several passes, because shoving a spawn clear of one thing can push
  // it straight into the next.
  function freeSpot(x, y, pad) {
    pad = pad || 0;
    for (var pass = 0; pass < 4; pass++) {
      for (var i = 0; i < st.cover.length; i++) {
        var c = st.cover[i];
        if (c.r) {
          var dd = Math.hypot(x - c.x, y - c.y), need = c.r + 26 + pad;
          if (dd < need) {
            var a = dd > 0.01 ? Math.atan2(y - c.y, x - c.x) : 0;
            x = c.x + Math.cos(a) * need;
            y = c.y + Math.sin(a) * need;
          }
        } else {
          var mx = c.w / 2 + 24 + pad, my = c.h / 2 + 16 + pad;
          var dx = Math.abs(x - c.x), dy = Math.abs(y - c.y);
          if (dx < mx && dy < my) {
            if (mx - dx < my - dy) x += (x < c.x ? -(mx - dx) : (mx - dx));
            else y += (y < c.y ? -(my - dy) : (my - dy));
          }
        }
      }
    }
    return { x: SG.clamp(x, 70, ARENA_W - 70), y: SG.clamp(y, 80, ARENA_H - 70) };
  }

  function updateBots(dt) {
    for (var i = 0; i < st.bots.length; i++) {
      var b = st.bots[i];
      if (b.hp <= 0) { if (b.dead < 1) b.dead += dt * 2; continue; }
      if (b.hurt > 0) b.hurt -= dt;

      // True distance decides whether she can see through a bush; the
      // steering target is the last place she actually saw him.
      var pd = Math.hypot(st.me.x - b.x, st.me.y - b.y) || 1;
      var sees = !st.hidden || pd < BUSH_SEE_R;
      if (sees) { b.seenX = st.me.x; b.seenY = st.me.y; }
      /* Arrived at the last place she saw him, and he is not there.
         She casts about nearby instead of walking to his real position -
         she is not supposed to know it, and a bush that only delays an
         otherwise perfect tracker is not a hiding place. Wandering also
         means she is never simply stopped, so a hidden player can't
         freeze the round; she will blunder into him eventually. */
      else if (Math.hypot(b.seenX - b.x, b.seenY - b.y) < 90) {
        var wa = Math.random() * Math.PI * 2, wr = SG.rand(170, 340);
        b.seenX = SG.clamp(b.seenX + Math.cos(wa) * wr, 80, ARENA_W - 80);
        b.seenY = SG.clamp(b.seenY + Math.sin(wa) * wr, 90, ARENA_H - 80);
      }

      var dx = b.seenX - b.x, dy = b.seenY - b.y;
      var d = Math.hypot(dx, dy) || 1;
      var vx, vy;

      // Walk around cover rather than into it - otherwise she can park
      // behind a crate on the player's line and the round never ends.
      // Chasing, she holds at shooting distance. Searching, she walks
      // right up to the spot - otherwise she orbits a point she cannot
      // see at exactly the range that never reveals him.
      var standoff = sees ? 190 : 40;
      if (b.detour > 0) {
        b.detour -= dt;
        vx = -dy / d * b.strafe; vy = dx / d * b.strafe;
      } else if (d > standoff) {
        vx = dx / d; vy = dy / d;
      } else {
        vx = -dy / d * b.strafe * 0.9 - dx / d * 0.25;
        vy = dx / d * b.strafe * 0.9 - dy / d * 0.25;
      }
      // Hunting is slower than chasing, so cover is worth using.
      var sp = b.speed * (sees ? 1 : 0.6);

      b.phase += dt * 9;
      var bx = b.x, by = b.y;
      moveEntity(b, vx * sp * dt, vy * sp * dt);
      if (b.detour <= 0) {
        if (Math.hypot(b.x - bx, b.y - by) < sp * dt * 0.4) {
          b.stuckT += dt;
          if (b.stuckT > 0.3) {
            /* Long enough to actually clear the thing she is stuck on.
               A wide body needs to travel further sideways than a runt
               does, and a detour that expires halfway leaves her back
               where she started. */
            b.detour = 1.2 * (0.8 + b.scale * 0.5);
            b.stuckT = 0;
            /* And she only reverses every other time. Flipping on every
               snag makes her oscillate in front of a crate for the rest
               of the round instead of committing to one way round it -
               which for the boss means an unkillable round. */
            b.snags = (b.snags || 0) + 1;
            if (b.snags % 2 === 0) b.strafe *= -1;
          }
        } else b.stuckT = 0;
      }

      b.cool -= dt;
      if (b.cool <= 0 && sees && pd < (b.kind === 'boss' ? 620 : 520)) {
        b.cool = b.rate * SG.rand(0.85, 1.25);
        var aim = Math.atan2(st.me.y - b.y, st.me.x - b.x);
        if (b.kind === 'boss') {
          for (var s = -1; s <= 1; s++) botShot(b, aim + s * 0.20, 260);
          SG.audio.play('smash');
        } else {
          botShot(b, aim + SG.rand(-0.16, 0.16), 250);
          SG.audio.play('tap');
        }
      }

      // The boss also throws a full ring now and then, so hugging her
      // is not a free strategy.
      if (b.kind === 'boss') {
        b.ringT -= dt;
        if (b.ringT <= 0) {
          b.ringT = 7;
          for (var k = 0; k < 12; k++) botShot(b, (k / 12) * Math.PI * 2, 210);
          SG.audio.play('power');
          SG.shake(7);
        }
      }
    }
  }

  function botShot(b, ang, speed) {
    st.shots.push({
      x: b.x, y: b.y, mine: false, boss: b.kind === 'boss',
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      life: 2.8, dmg: b.dmg, rot: 0,
    });
  }

  /* One place for every way a Daley can die, so the boss payout can't
     be missed by whichever route killed her. Her bounty is banked on
     the spot rather than added to the round-clear bonus - dying on the
     next Daley should not undo the hardest thing in the round. */
  function killedBot(bot) {
    if (bot.kind === 'boss') {
      bankWings(BOSS_WINGS);
      say('DALEY PRIME DOWN  +' + BOSS_WINGS, SG.COLORS.gold);
      SG.audio.play('wingbig');
      SG.shake(18);
      SG.burst(sx(bot.x), sy(bot.y) - 70, 46, {
        colors: ['#ff6b8a', '#ff2d6f', '#ffd400', '#fff'], speedMax: 380, gravity: 150,
      });
      return;
    }
    SG.audio.play('wing');
    SG.burst(sx(bot.x), sy(bot.y) - 50 * bot.scale, 20, {
      colors: ['#ff6b8a', '#ff2d6f', '#fff'], speedMax: 260, gravity: 180,
    });
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

      // Bullets stop on cover but sail straight through a bush - it is
      // concealment, not protection.
      if (s.life <= 0 || s.x < 20 || s.x > ARENA_W - 20 || s.y < 30 || s.y > ARENA_H - 20 ||
          hitsCover(s.x, s.y, 6)) { st.shots.splice(i, 1); continue; }

      if (s.mine) {
        for (var b = 0; b < st.bots.length; b++) {
          var bot = st.bots[b];
          if (bot.hp <= 0) continue;
          if (segDist(px, py, s.x, s.y, bot.x, bot.y) < bot.r) {
            bot.hp -= s.dmg;
            bot.hurt = 0.16;
            // The super charges off damage dealt, so aggression pays.
            if (!s.big) addCharge(s.dmg / CHARGE_DMG);
            if (bot.hp <= 0 && !s.big) addCharge(CHARGE_KILL);
            SG.burst(sx(s.x), sy(s.y) - 46, 6, { colors: ['#ffb02e', '#fff4e0'], speedMax: 180, gravity: 260, rMax: 4, life: 0.4 });
            if (bot.hp <= 0) killedBot(bot);
            else SG.audio.play('bounce');
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
    for (var i = 0; i < st.cover.length; i++) things.push({ y: st.cover[i].y, k: 'cover', o: st.cover[i] });
    // +10 so a bush sorts just behind whoever is standing in it and
    // draws over them - that overlap is what sells being hidden.
    for (var u = 0; u < st.bushes.length; u++) things.push({ y: st.bushes[u].y + 10, k: 'bush', o: st.bushes[u] });
    for (var b = 0; b < st.bots.length; b++) things.push({ y: st.bots[b].y, k: 'bot', o: st.bots[b] });
    things.push({ y: st.me.y, k: 'me', o: st.me });
    things.sort(function (a, c) { return a.y - c.y; });
    for (var t = 0; t < things.length; t++) {
      if (things[t].k === 'cover') drawCover(g, things[t].o);
      else if (things[t].k === 'bush') drawBush(g, things[t].o);
      else if (things[t].k === 'bot') drawBot(g, things[t].o);
      else drawMe(g);
    }

    drawShots(g);
    drawBeams(g);
    g.restore();

    drawHUD(g);
    if (st.phase === 'fight') drawBossBar(g);
    if (st.phase === 'fight' && st.bossWarn > 0) drawBossWarning(g);
    if (SG.platform.touch && !sawMouse && st.phase === 'fight' && !st.paused) drawSticks(g);
    if (st.phase === 'fight') drawSuperButton(g);

    if (st.paused) drawPaused(g);
    if (st.phase === 'won') drawWon(g);
    if (st.phase === 'dead') drawDead(g);
  }

  function drawArena(g) {
    g.fillStyle = '#2a6b3f';
    g.fillRect(0, 0, SG.W, SG.H);
    g.fillStyle = 'rgba(255,255,255,0.03)';
    for (var i = 0; i < 32; i++) {          // enough to cover ARENA_H
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

  function drawCover(g, c) {
    if (c.kind === 'wall') return drawWall(g, c);
    if (c.kind === 'barrel') return drawBarrel(g, c);
    if (c.kind === 'rock') return drawRock(g, c);
    drawCrate(g, c);
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

  // Low and long: it breaks a sight line without hiding what is behind
  // it, which is the point of having something other than crates.
  function drawWall(g, c) {
    var x = sx(c.x), y = sy(c.y);
    var w = c.w, dep = c.h * SQUASH, h = 40;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y + 4, w * 0.52, dep * 0.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5b6470';
    SG.roundRect(g, x - w / 2, y - h, w, h + dep * 0.5, 5); g.fill();
    g.fillStyle = '#7c8794';
    SG.roundRect(g, x - w / 2, y - h - dep * 0.5, w, dep, 5); g.fill();
    g.strokeStyle = 'rgba(18,24,30,0.55)';
    g.lineWidth = 2.5;
    SG.roundRect(g, x - w / 2, y - h, w, h + dep * 0.5, 5); g.stroke();
    // a couple of seams so it does not read as a flat slab
    g.strokeStyle = 'rgba(18,24,30,0.3)';
    g.lineWidth = 2;
    for (var i = 1; i < 3; i++) {
      var seam = x - w / 2 + (w / 3) * i;
      g.beginPath(); g.moveTo(seam, y - h); g.lineTo(seam, y + dep * 0.5); g.stroke();
    }
  }

  function drawBarrel(g, c) {
    var x = sx(c.x), y = sy(c.y), r = c.r, h = 74;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y + 4, r, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    var grad = g.createLinearGradient(x - r, 0, x + r, 0);
    grad.addColorStop(0, '#8a3a22');
    grad.addColorStop(0.4, '#c25e33');
    grad.addColorStop(1, '#7a3520');
    g.fillStyle = grad;
    g.fillRect(x - r, y - h, r * 2, h);
    g.beginPath(); g.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d97b45';
    g.beginPath(); g.ellipse(x, y - h, r, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,18,8,0.5)';
    g.lineWidth = 3;
    g.beginPath(); g.ellipse(x, y - h, r, r * 0.4, 0, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x - r, y - h * 0.68); g.lineTo(x + r, y - h * 0.68);
    g.moveTo(x - r, y - h * 0.28); g.lineTo(x + r, y - h * 0.28);
    g.stroke();
  }

  function drawRock(g, c) {
    var x = sx(c.x), y = sy(c.y), r = c.r;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y + 4, r, r * 0.4, 0, 0, Math.PI * 2); g.fill();
    g.save();
    g.translate(x, y);
    g.fillStyle = '#6f7580';
    g.beginPath();
    g.moveTo(-r, 0);
    g.lineTo(-r * 0.78, -r * 0.72);
    g.lineTo(-r * 0.18, -r * 1.02);
    g.lineTo(r * 0.52, -r * 0.86);
    g.lineTo(r, -r * 0.2);
    g.lineTo(r * 0.72, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#8b929d';
    g.beginPath();
    g.moveTo(-r * 0.78, -r * 0.72);
    g.lineTo(-r * 0.18, -r * 1.02);
    g.lineTo(r * 0.1, -r * 0.62);
    g.lineTo(-r * 0.42, -r * 0.44);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(30,34,40,0.5)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-r, 0);
    g.lineTo(-r * 0.78, -r * 0.72);
    g.lineTo(-r * 0.18, -r * 1.02);
    g.lineTo(r * 0.52, -r * 0.86);
    g.lineTo(r, -r * 0.2);
    g.stroke();
    g.restore();
  }

  /* A bush is a clump of leaves you can walk into. It blocks nothing
     and stops no bullets - it only breaks her line of sight, so it
     rewards moving rather than parking. */
  function drawBush(g, b) {
    var x = sx(b.x), y = sy(b.y), r = b.r;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath(); g.ellipse(x, y + 6, r * 0.95, r * 0.34, 0, 0, Math.PI * 2); g.fill();

    var blobs = [
      [-0.62, -0.10, 0.46], [0.60, -0.12, 0.44], [-0.24, -0.44, 0.52],
      [0.28, -0.46, 0.50], [0.02, -0.12, 0.60], [-0.72, -0.42, 0.32],
      [0.74, -0.40, 0.32],
    ];
    var i, bl;
    g.fillStyle = '#1f5c30';
    for (i = 0; i < blobs.length; i++) {
      bl = blobs[i];
      g.beginPath();
      g.ellipse(x + bl[0] * r, y + bl[1] * r * 0.9, bl[2] * r, bl[2] * r * 0.78, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#2f8043';
    for (i = 0; i < blobs.length; i++) {
      bl = blobs[i];
      g.beginPath();
      g.ellipse(x + bl[0] * r, y + bl[1] * r * 0.9 - 7, bl[2] * r * 0.84, bl[2] * r * 0.62, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(120,205,120,0.35)';
    for (i = 0; i < blobs.length; i += 2) {
      bl = blobs[i];
      g.beginPath();
      g.ellipse(x + bl[0] * r - 5, y + bl[1] * r * 0.9 - 14, bl[2] * r * 0.42, bl[2] * r * 0.26, -0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawMe(g) {
    var me = st.me;
    var x = sx(me.x), y = sy(me.y);

    // afterimages, so a dash reads as a dash and not a teleport
    if (me.dash) {
      for (var t = 0; t < me.dash.trail.length; t++) {
        var tr = me.dash.trail[t];
        g.save();
        g.globalAlpha = 0.1 + (t / me.dash.trail.length) * 0.28;
        SG.art.drawSanti(g, sx(tr.x), sy(tr.y), BODY_H, me.phase - (me.dash.trail.length - t) * 0.4, {
          face: st.kit.face, shirt: SUPERS.dark.color, boxColor: st.kit.box,
          boxInk: st.kit.ink, pants: st.kit.pants, skin: st.kit.skin, shoe: st.kit.shoe, run: 1,
        });
        g.restore();
      }
    }

    shadow(g, x, y, 40);
    g.save();
    if (me.hurtT < 0.25 && Math.floor(st.t * 24) % 2 === 0) g.globalAlpha = 0.45;
    // He fades but never vanishes - you have to be able to see yourself.
    if (st.hidden) g.globalAlpha *= 0.5;
    if (me.superFx > 0 || me.dash) {
      g.shadowColor = SUPERS[st.kit.id].color;
      g.shadowBlur = 26;
    }
    SG.art.drawSanti(g, x, y, BODY_H, me.phase, {
      face: st.kit.face, shirt: st.kit.shirt, boxColor: st.kit.box,
      boxInk: st.kit.ink, pants: st.kit.pants,
      skin: st.kit.skin, shoe: st.kit.shoe,
      run: me.moving ? 1 : 0.08,
    });
    g.restore();
    healthBar(g, x, y - BODY_H - 30, me.hp / me.maxHp, '#4dd47a', 66);
    ammoPips(g, x, y + 12);
    if (st.hidden) {
      SG.ui.text(g, 'HIDDEN', x, y - BODY_H - 46, {
        size: 12, color: '#7fe39a', stroke: '#0e2415', strokeWidth: 4, shadow: false,
      });
    }
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
    var s = b.scale;
    if (b.hp <= 0) {
      if (b.dead >= 1) return;
      g.save();
      g.globalAlpha = 1 - b.dead;
      g.translate(x, y);
      g.scale(1, 1 - b.dead * 0.4);
      drawHeart(g, 0, -60 * s, (1.6 + b.dead * 2) * s, 0);
      g.restore();
      return;
    }
    shadow(g, x, y, 36 * s);
    g.save();
    if (b.hurt > 0) g.globalAlpha = 0.55;
    if (b.kind === 'boss') {
      g.shadowColor = '#ff2d6f';
      g.shadowBlur = 22 + Math.sin(st.t * 5) * 8;
    }
    SG.art.drawSanti(g, x, y, BODY_H * 0.94 * s, b.phase, {
      face: 'daley', shirt: b.shirt, boxColor: '#ffd400', boxInk: '#17120a', pants: '#20263f', run: 1,
    });
    g.restore();

    // The boss carries her health at the top of the screen instead.
    if (b.kind !== 'boss') {
      healthBar(g, x, y - BODY_H * s - 22, b.hp / b.maxHp, '#ff6b8a', 50 * s);
    }

    if (Math.floor(st.t * 2 + b.phase) % 4 === 0) {
      g.save();
      g.globalAlpha = 0.5;
      drawHeart(g, x + Math.sin(st.t * 3 + b.phase) * 16, y - BODY_H * s - 36 - (st.t * 20 % 22), 0.5 * s, 0);
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
      if (s.big) {
        // storm wings: bigger, spinning, and lit
        g.save();
        g.shadowColor = SUPERS.santi.color;
        g.shadowBlur = 16;
        SG.art.drawWing(g, x, y - 46, 1.7, s.rot + st.t * 9);
        g.restore();
      } else if (s.mine) SG.art.drawWing(g, x, y - 46, 1.05, s.rot);
      else drawHeart(g, x, y - 44, s.boss ? 1.35 : 0.85, Math.sin(s.rot) * 0.3);
    }
  }

  function drawBeams(g) {
    for (var i = 0; i < st.beams.length; i++) {
      var b = st.beams[i];
      var k = 1 - b.t / 0.4;
      var x0 = sx(b.x0), y0 = sy(b.y0) - 46, x1 = sx(b.x1), y1 = sy(b.y1) - 46;
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(20,20,26,' + (k * 0.55) + ')';
      g.lineWidth = 34 * k;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,' + k + ')';
      g.lineWidth = 13 * k;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,' + (k * 0.8) + ')';
      g.lineWidth = 4 * k;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.restore();
    }
  }

  /* Charge meter and the button that spends it. Sits clear of the aim
     thumb's landing zone, and anything starting inside it is excluded
     from aiming. */
  function drawSuperButton(g) {
    var me = st.me;
    var sp = SUPERS[st.kit.id];
    var r = superRect();
    var cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = r.w / 2;
    var full = me.charge >= 1;
    var pulse = full ? 1 + Math.sin(st.t * 6) * 0.05 : 1;

    g.save();
    g.globalAlpha = full ? 1 : 0.62;

    g.fillStyle = 'rgba(10,8,24,0.6)';
    g.beginPath(); g.arc(cx, cy, rad * pulse, 0, Math.PI * 2); g.fill();

    // the ring fills as he does damage
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 7;
    g.beginPath(); g.arc(cx, cy, rad - 5, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = sp.color;
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, rad - 5, -Math.PI / 2, -Math.PI / 2 + me.charge * Math.PI * 2);
    g.stroke();

    if (full) {
      g.shadowColor = sp.color;
      g.shadowBlur = 20 + Math.sin(st.t * 6) * 6;
      g.fillStyle = sp.color;
      g.beginPath(); g.arc(cx, cy, rad - 15, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
    }

    SG.ui.text(g, full ? sp.short : Math.floor(me.charge * 100) + '%', cx, cy,
      { size: full ? 19 : 17, color: full ? '#17120a' : '#fff', shadow: false });
    if (full) {
      SG.ui.text(g, 'TAP TO FIRE', cx, cy + 24, { size: 11, color: 'rgba(20,14,6,0.75)', shadow: false });
    }
    g.restore();

    if (full) {
      SG.ui.text(g, sp.name, cx, r.y - 12, {
        size: 15, color: sp.color, stroke: '#14102a', strokeWidth: 5, shadow: false,
      });
    }
  }

  /* The boss gets the top of the screen and exact numbers. A fraction
     of a bar tells you nothing when the fight is a minute long - the
     count is what says whether you are winning. Centred, so it clears
     the round panel on the left and the wing count on the right. */
  function drawBossBar(g) {
    var b = st.boss;
    if (!b || b.hp <= 0) return;
    var w = Math.min(560, SG.W - 400), x = SG.W / 2 - w / 2, y = 74, h = 24;
    var frac = SG.clamp(b.hp / b.maxHp, 0, 1);

    SG.ui.text(g, 'DALEY PRIME', SG.W / 2, y - 12, {
      size: 15, color: '#ff8fa8', stroke: '#2a0713', strokeWidth: 5, shadow: false,
    });

    g.fillStyle = 'rgba(8,6,16,0.82)';
    SG.roundRect(g, x - 3, y - 3, w + 6, h + 6, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.10)';
    SG.roundRect(g, x, y, w, h, 6); g.fill();

    var grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#ff2d6f');
    grad.addColorStop(1, '#ff8fa8');
    g.fillStyle = grad;
    SG.roundRect(g, x, y, Math.max(6, w * frac), h, 6); g.fill();

    g.strokeStyle = 'rgba(255,180,200,0.55)';
    g.lineWidth = 2;
    SG.roundRect(g, x, y, w, h, 6); g.stroke();

    SG.ui.text(g, Math.ceil(b.hp) + ' / ' + Math.round(b.maxHp), SG.W / 2, y + h / 2, {
      size: 14, color: '#fff', stroke: '#2a0713', strokeWidth: 4, shadow: false,
    });
  }

  // Two and a half seconds of being told, loudly, to find some cover.
  function drawBossWarning(g) {
    var k = st.bossWarn;
    var pulse = 0.5 + Math.sin(st.t * 14) * 0.5;
    g.save();
    g.globalAlpha = 0.16 + pulse * 0.16;
    g.fillStyle = '#c1002f';
    g.fillRect(0, 0, SG.W, SG.H);
    g.restore();

    g.save();
    g.globalAlpha = 0.5 + pulse * 0.5;
    SG.art.tag(g, 'BOSS INCOMING', SG.W / 2, SG.H / 2 - 30, 52, '#ff2d6f', -0.03);
    g.restore();
    SG.ui.text(g, 'A very big Daley is on her way', SG.W / 2, SG.H / 2 + 16, {
      size: 15, color: 'rgba(255,255,255,0.8)', stroke: '#2a0713', strokeWidth: 5, shadow: false,
    });
    SG.ui.text(g, Math.max(1, Math.ceil(k)) + '...', SG.W / 2, SG.H / 2 + 48, {
      size: 22, color: '#ffd400', stroke: '#2a0713', strokeWidth: 5, shadow: false,
    });
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

  /* Thumb sticks, the way Brawl Stars does them.

     They are on screen from the first frame: drawing them only while a
     finger was down meant a new player saw no controls at all. They jump
     to wherever the thumb lands rather than making you find them, and
     drift back to their resting spot when it lifts. Blue moves, red
     shoots. Translucent idle, opaque in use. */
  var STICK_SKIN = {
    move: { rim: 'rgba(74,168,255,0.95)', hi: '#7cc2ff', lo: '#1f6fd8' },
    aim: { rim: 'rgba(240,62,72,0.95)', hi: '#ff6b74', lo: '#b8141f' },
  };

  // Read fresh every frame - SG.W moves with the viewport, and the aim
  // stick has to stay clear of the super button in the corner.
  function stickHome(which) {
    return which === 'move'
      ? { x: 150, y: SG.H - 126 }
      : { x: SG.W - 300, y: SG.H - 126 };
  }

  function updateSticks(dt) {
    if (!st.sticks) st.sticks = { move: null, aim: null };
    st.sticks.move = stepStick(st.sticks.move, stickHome('move'), st.moveStick, dt);
    st.sticks.aim = stepStick(st.sticks.aim, stickHome('aim'),
      st.aim && !st.aim.mouse ? st.aim : null, dt);
  }

  /* Held: the stick is exactly where the thumb is, with no easing at
     all - smoothing the origin would make the aim lag the finger.
     Released: the knob falls back to the middle and the whole stick
     drifts home. */
  function stepStick(s, home, live, dt) {
    if (!s) s = { ox: home.x, oy: home.y, dx: 0, dy: 0, live: 0 };
    if (live) {
      var k = live.mag > STICK_R ? STICK_R / live.mag : 1;
      s.ox = live.ox; s.oy = live.oy;
      s.dx = live.dx * k; s.dy = live.dy * k;
      s.live += (1 - s.live) * Math.min(1, dt * 20);
    } else {
      var e = Math.min(1, dt * 13);
      s.ox += (home.x - s.ox) * e;
      s.oy += (home.y - s.oy) * e;
      s.dx -= s.dx * e;
      s.dy -= s.dy * e;
      s.live -= s.live * Math.min(1, dt * 8);
    }
    return s;
  }

  function drawSticks(g) {
    if (!st.sticks) return;
    drawStick(g, st.sticks.move, STICK_SKIN.move, false);
    drawStick(g, st.sticks.aim, STICK_SKIN.aim, true);
  }

  function drawStick(g, s, skin, target) {
    if (!s) return;
    var kx = s.ox + s.dx, ky = s.oy + s.dy;
    var base = STICK_R + 8;

    g.save();
    // Idle is low enough to stay out of the way but not so low that a
    // new player misses them against the green.
    g.globalAlpha = 0.52 + s.live * 0.43;

    g.fillStyle = 'rgba(8,10,24,0.62)';
    g.beginPath(); g.arc(s.ox, s.oy, base, 0, Math.PI * 2); g.fill();
    g.strokeStyle = skin.rim;
    g.lineWidth = 4;
    g.beginPath(); g.arc(s.ox, s.oy, base - 2, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(s.ox, s.oy, base - 13, 0, Math.PI * 2); g.stroke();

    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.arc(kx, ky + 4, 28, 0, Math.PI * 2); g.fill();

    var grad = g.createLinearGradient(kx, ky - 28, kx, ky + 28);
    grad.addColorStop(0, skin.hi);
    grad.addColorStop(1, skin.lo);
    g.fillStyle = grad;
    g.beginPath(); g.arc(kx, ky, 28, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(kx, ky, 28, 0, Math.PI * 2); g.stroke();

    if (target) {
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = 2.6;
      g.beginPath(); g.arc(kx, ky, 9, 0, Math.PI * 2); g.stroke();
      g.beginPath();
      g.moveTo(kx - 19, ky); g.lineTo(kx - 13, ky);
      g.moveTo(kx + 13, ky); g.lineTo(kx + 19, ky);
      g.moveTo(kx, ky - 19); g.lineTo(kx, ky - 13);
      g.moveTo(kx, ky + 13); g.lineTo(kx, ky + 19);
      g.stroke();
    } else {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(kx, ky, 6, 0, Math.PI * 2); g.fill();
    }
    g.restore();
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

    // The armed-super prompt owns the bottom line while it is up.
    if (st.round === 1 && st.t < 13 && st.phase === 'fight') {
      SG.ui.text(g, st.t < 7
        ? (SG.platform.touch
          ? 'LEFT THUMB MOVES  ·  HOLD RIGHT TO AIM, RELEASE TO SHOOT'
          : 'WASD TO MOVE  ·  HOLD LEFT MOUSE TO AIM, RELEASE TO SHOOT')
        : 'STAND IN A BUSH TO DISAPPEAR  ·  SHOOTING GIVES YOU AWAY',
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
      var r = { x: x0 + i * (cw + gap), y: 82, w: cw, h: 396 };
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

      // The super is half of what makes each one different, so it is
      // on the card rather than a surprise.
      var sp = SUPERS[k.id];
      var sy0 = r.y + 350;
      g.fillStyle = 'rgba(0,0,0,0.32)';
      SG.roundRect(g, r.x + 12, sy0 - 14, r.w - 24, 40, 9); g.fill();
      g.strokeStyle = sp.color;
      g.lineWidth = 1.5;
      SG.roundRect(g, r.x + 12, sy0 - 14, r.w - 24, 40, 9); g.stroke();
      SG.ui.text(g, 'SUPER · ' + sp.name, r.x + r.w / 2, sy0 - 1, {
        size: 11, color: sp.color, shadow: false,
      });
      SG.ui.text(g, sp.desc, r.x + r.w / 2, sy0 + 16, {
        size: 9.5, color: 'rgba(255,255,255,0.55)', weight: '600',
        font: '"Avenir Next", system-ui, sans-serif', shadow: false,
      });

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
    SG.ui.text(g, '+' + roundWings(st.round) + ' wings', CX - 40, 234, {
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
    enter: function () { reset(true); SG.audio.music.loop(TRACK); },
    exit: function () { SG.audio.music.stop(); },
    update: update,
    draw: draw,
    onBlur: function () { if (st && st.phase === 'fight') st.paused = true; },
  });
})();
