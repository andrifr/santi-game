/* =============================================================
   MODE 5 - SANTI SIMULATOR
   A day in the life, side-on. Tap anywhere to walk; tap an object to
   walk to it and use it. A guide arrow tracks the current task, with
   an edge marker when it's off screen. Everything in the flat is
   tappable, not just the thing the task wants.
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  var FLOOR_Y = 436;          // where his feet sit
  var CEIL_Y = 54;
  var INSIDE_W = 3870;        // end of the hall; beyond this is the street
  var DOOR_STOP = 3852;       // as far as he gets with the door shut
  var WORLD_W = 4750;
  var WALK_SPEED = 330;
  var SANTI_H = 150;
  var REACH = 70;

  var st;

  // ---------------------------------------------------------------
  // The flat
  // ---------------------------------------------------------------
  var ROOMS = [
    { x0: 0,    x1: 780,  name: 'BEDROOM',     wall: '#3b3566', floor: '#4a3f52' },
    { x0: 780,  x1: 1400, name: 'BATHROOM',    wall: '#2c5570', floor: '#3f5d68' },
    { x0: 1400, x1: 2000, name: 'CLOSET',      wall: '#5a3a5e', floor: '#4a3f52' },
    { x0: 2000, x1: 2820, name: 'LIVING ROOM', wall: '#46356b', floor: '#54443f' },
    { x0: 2820, x1: 3600, name: 'KITCHEN',     wall: '#3d5a4a', floor: '#4f4a44' },
    { x0: 3600, x1: 3870, name: 'HALL',        wall: '#4a3f66', floor: '#4a3f52' },
  ];

  function buildObjects() {
    return [
      // --- bedroom ---
      { id: 'bed',       x: 190,  w: 260, kind: 'bed',       label: 'BED' },
      { id: 'clock',     x: 400,  w: 60,  kind: 'clock',     label: 'ALARM',
        flavor: ["It's 11:40. Bit late." , 'Snoozed six times.'] },
      { id: 'poster',    x: 600,  w: 110, kind: 'poster',    label: 'POSTER', onWall: true,
        flavor: ['1.2M subscribers. One day.', 'SANTI CAN\'T - the poster.'] },

      // --- bathroom ---
      { id: 'sink',      x: 940,  w: 150, kind: 'sink',      label: 'SINK',
        flavor: ['Rinsed. Good enough.', 'Water. Cold. Awake now.'] },
      { id: 'hairspray', x: 1120, w: 70,  kind: 'hairspray', label: 'HAIRSPRAY' },
      { id: 'toilet',    x: 1290, w: 110, kind: 'toilet',    label: 'TOILET',
        flavor: ['Not now.', 'Later. Definitely later.'] },

      // --- closet ---
      { id: 'rack',      x: 1650, w: 300, kind: 'rack',      label: 'SUPREME TEES' },
      { id: 'shoes',     x: 1900, w: 120, kind: 'shoes',     label: 'SHOES',
        flavor: ['Fresh. Obviously.', 'These ones. Always these ones.'] },

      // --- living room ---
      { id: 'couch',     x: 2130, w: 280, kind: 'couch',     label: 'COUCH',
        flavor: ['No sitting. Busy day.', 'The couch is calling. Ignore it.'] },
      { id: 'tv',        x: 2400, w: 180, kind: 'tv',        label: 'TV',
        flavor: ['Nothing on.', 'Fortnite later. Promise.'] },
      { id: 'camera',    x: 2620, w: 130, kind: 'camera',    label: 'CAMERA' },
      { id: 'phone',     x: 2780, w: 70,  kind: 'phone',     label: 'PHONE' },

      // --- kitchen ---
      { id: 'fridge',    x: 2930, w: 150, kind: 'fridge',    label: 'FRIDGE',
        flavor: ['Hot sauce. Three bottles.', 'Mostly hot sauce in here.'] },
      { id: 'counter',   x: 3160, w: 240, kind: 'counter',   label: 'BREAD + CHEESE' },
      { id: 'microwave', x: 3380, w: 140, kind: 'microwave', label: 'MICROWAVE' },
      { id: 'wings',     x: 3520, w: 120, kind: 'wings',     label: 'CHICKEN WINGS' },

      // --- hall / outside ---
      { id: 'leash',     x: 3660, w: 60,  kind: 'leash',     label: 'LEASH', onWall: true },
      { id: 'door',      x: 3790, w: 130, kind: 'door',      label: 'FRONT DOOR' },
      { id: 'bin',       x: 4060, w: 80,  kind: 'bin',       label: 'BIN',
        flavor: ['Someone else\'s problem.', 'Bin day was Tuesday.'] },
      { id: 'lamp',      x: 4220, w: 50,  kind: 'lamp',      label: 'LAMPPOST',
        flavor: ['Rue knows this one well.', 'A landmark, apparently.'] },
      { id: 'tree',      x: 4450, w: 180, kind: 'tree',      label: 'THE TREE' },
      { id: 'bench',     x: 4650, w: 150, kind: 'bench',     label: 'BENCH',
        flavor: ['Sit later. Wings first.', 'Prime wing-eating bench.'] },
    ];
  }

  // ---------------------------------------------------------------
  // The day
  // ---------------------------------------------------------------
  var TASKS = [
    { id: 'wake',   title: 'WAKE UP',           hint: 'Get out of bed',            target: 'bed' },
    { id: 'grab',   title: 'BREAD WITH CHEESE', hint: 'Grab the bread and cheese', target: 'counter' },
    { id: 'nuke',   title: 'BREAD WITH CHEESE', hint: 'Microwave it',              target: 'microwave' },
    { id: 'hair',   title: 'THE HAIR',          hint: 'Hairspray. Obviously.',     target: 'hairspray' },
    { id: 'shirt',  title: 'PICK A FIT',        hint: 'Choose a Supreme tee',      target: 'rack' },
    { id: 'leash',  title: 'WALK RUE',          hint: 'Grab the leash',            target: 'leash' },
    { id: 'out',    title: 'WALK RUE',          hint: 'Out the front door',        target: 'door' },
    { id: 'tree',   title: 'WALK RUE',          hint: 'Rue has business at the tree', target: 'tree' },
    { id: 'home',   title: 'WALK RUE',          hint: 'Head back inside',          target: 'door' },
    { id: 'video',  title: "SANTI CAN'T",       hint: 'Film a video',              target: 'camera' },
    { id: 'wings',  title: 'CHICKEN WINGS',     hint: 'Destroy them',              target: 'wings' },
    { id: 'call',   title: 'CALL DALEY',        hint: 'Give her a ring',           target: 'phone' },
    { id: 'sleep',  title: 'GO TO SLEEP',       hint: 'Back to bed',               target: 'bed' },
  ];

  var WINGS_PER_TASK = 40;

  var SHIRTS = [
    { name: 'CLASSIC RED', shirt: '#e8202a', box: '#ffffff', boxText: '#e8202a' },
    { name: 'PURPLE',      shirt: '#7c4dff', box: '#e8202a', boxText: '#ffffff' },
    { name: 'FOREST',      shirt: '#2f7d4f', box: '#ffd400', boxText: '#17120a' },
  ];

  // ---------------------------------------------------------------
  function reset() {
    st = {
      x: 250, vx: 0, facing: 1, walkPhase: 0,
      targetX: null, pending: null,          // object to use on arrival
      cam: 0,
      objects: buildObjects(),
      taskIndex: 0,
      done: false,
      t: 0,
      wings: 0,
      shirt: SHIRTS[0],
      hairLevel: 0,
      inBed: true,
      doorOpen: false,
      hasLeash: false,
      hasFood: false,
      ruePooped: false,
      videoMade: false,
      wingsLeft: 5,
      bubble: null, bubbleT: 0,
      overlay: null,                          // 'shirt' | 'call' | 'video' | 'nuke' | 'spray' | 'wings'
      ov: {},                                 // overlay working state
      paused: false,
      flash: 0,
      rue: { x: 3660, y: 0, follow: false, phase: 0 },
    };
  }

  function task() { return st.done ? null : TASKS[st.taskIndex]; }
  function obj(id) {
    for (var i = 0; i < st.objects.length; i++) if (st.objects[i].id === id) return st.objects[i];
    return null;
  }

  function say(lines) {
    st.bubble = Array.isArray(lines) ? SG.pick(lines) : lines;
    st.bubbleT = 0;
  }

  function completeTask() {
    st.wings += WINGS_PER_TASK;
    SG.save.data.wings = (SG.save.data.wings || 0) + WINGS_PER_TASK;
    SG.save.write();
    SG.audio.play('wing');
    st.flash = 0.5;
    st.taskIndex++;
    if (st.taskIndex >= TASKS.length) {
      st.done = true;
      SG.save.data.simDays = (SG.save.data.simDays || 0) + 1;
      SG.save.submit('sim', Math.max(1, 999 - Math.floor(st.t)));
      SG.save.write();
      SG.audio.play('power');
    } else {
      SG.audio.play('select');
    }
  }

  // ---------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------
  function useObject(o) {
    var tk = task();
    var isTarget = tk && tk.target === o.id;

    if (!isTarget) {
      // Everything is pokeable, it just doesn't move the day along.
      if (o.flavor) { say(o.flavor); SG.audio.play('tap'); }
      else { say('Not right now.'); SG.audio.play('tap'); }
      return;
    }

    switch (tk.id) {
      case 'wake':
        st.inBed = false;
        say('Lap. Morning already.');
        completeTask();
        break;

      case 'grab':
        st.hasFood = true;
        say('Bread. Cheese. A plan.');
        completeTask();
        break;

      case 'nuke':
        openOverlay('nuke', { t: 0, dur: 3.2, done: false });
        break;

      case 'hair':
        openOverlay('spray', { sprays: 0 });
        break;

      case 'shirt':
        openOverlay('shirt', { pick: -1 });
        break;

      case 'leash':
        st.hasLeash = true;
        st.rue.follow = true;
        say('Rue! Walk!');
        completeTask();
        break;

      case 'out':
        st.doorOpen = true;
        say('Out we go.');
        completeTask();
        break;

      case 'tree':
        st.ruePooped = true;
        say('Good girl. Every single time.');
        completeTask();
        break;

      case 'home':
        st.doorOpen = false;
        st.rue.follow = false;
        say('Back inside.');
        completeTask();
        break;

      case 'video':
        openOverlay('video', { t: 0, stage: 0, views: 0 });
        break;

      case 'wings':
        openOverlay('wings', { eaten: 0 });
        break;

      case 'call':
        openOverlay('call', { line: 0, t: 0 });
        break;

      case 'sleep':
        st.inBed = true;
        openOverlay('sleep', { t: 0 });
        break;
    }
  }

  function openOverlay(name, data) {
    st.overlay = name;
    st.ov = data || {};
    SG.audio.play('select');
  }

  function closeOverlay(complete) {
    st.overlay = null;
    st.ov = {};
    if (complete) completeTask();
  }

  // ---------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------
  function update(dt) {
    st.t += dt;
    if (st.bubble) { st.bubbleT += dt; if (st.bubbleT > 3) st.bubble = null; }
    if (st.flash > 0) st.flash -= dt;

    if (st.paused) { handlePauseTaps(); return; }

    if (SG.input.tappedRect(pauseRect()) && !st.done) {
      st.paused = true;
      SG.audio.play('back');
      return;
    }

    if (st.done) { handleDoneTaps(); return; }
    if (st.overlay) { updateOverlay(dt); return; }

    handleWorldTaps();

    // keyboard for desktop
    var k = SG.input.keys;
    if (k.ArrowLeft || k.KeyA) { st.targetX = null; st.pending = null; st.vx = -WALK_SPEED; }
    else if (k.ArrowRight || k.KeyD) { st.targetX = null; st.pending = null; st.vx = WALK_SPEED; }
    else if (st.targetX === null) st.vx = 0;

    // walk toward a tapped point
    if (st.targetX !== null) {
      var d = st.targetX - st.x;
      if (Math.abs(d) < 6) {
        st.x = st.targetX;
        st.targetX = null;
        st.vx = 0;
        if (st.pending) { var p = st.pending; st.pending = null; useObject(p); }
      } else {
        st.vx = Math.sign(d) * WALK_SPEED;
      }
    }

    if (st.vx !== 0) {
      st.inBed = false;
      st.facing = st.vx > 0 ? 1 : -1;
      st.walkPhase += dt * 9;
    }
    // The front door is a wall until it's opened.
    var maxX = st.doorOpen ? WORLD_W - 60 : DOOR_STOP;
    st.x = SG.clamp(st.x + st.vx * dt, 40, maxX);
    if (st.targetX !== null && st.targetX > maxX && Math.abs(st.x - maxX) < 1) {
      st.targetX = null;                 // stop shoving against a shut door
      st.vx = 0;
      if (st.pending) { var pd = st.pending; st.pending = null; useObject(pd); }
    }

    // Rue trails a little behind
    if (st.rue.follow) {
      var want = st.x - st.facing * 74;
      st.rue.x += (want - st.rue.x) * Math.min(1, dt * 5);
      st.rue.phase += dt * 10;
    }

    // camera
    var camTarget = SG.clamp(st.x - SG.W / 2, 0, Math.max(0, WORLD_W - SG.W));
    st.cam += (camTarget - st.cam) * Math.min(1, dt * 6);
  }

  function handleWorldTaps() {
    var tap;
    while ((tap = SG.input.takeTap())) {
      if (tap.x < 0) continue;
      var wx = tap.x + st.cam;

      // object hit? generous vertical band so it's easy on a phone
      var hit = null;
      for (var i = 0; i < st.objects.length; i++) {
        var o = st.objects[i];
        var oy = o.onWall ? FLOOR_Y - 210 : FLOOR_Y - 90;
        if (wx >= o.x - o.w / 2 - 12 && wx <= o.x + o.w / 2 + 12 &&
            tap.y > oy - 80 && tap.y < FLOOR_Y + 40) { hit = o; break; }
      }

      if (hit) {
        if (Math.abs(hit.x - st.x) <= REACH + hit.w / 2) { useObject(hit); }
        else { st.targetX = SG.clamp(hit.x - Math.sign(hit.x - st.x) * 40, 40, WORLD_W - 60); st.pending = hit; }
      } else {
        st.targetX = SG.clamp(wx, 40, WORLD_W - 60);
        st.pending = null;
      }
    }
  }

  function handlePauseTaps() {
    // buttons are drawn in drawPaused; nothing to do here
  }

  function handleDoneTaps() { /* buttons handled in draw */ }

  function pauseRect() { return { x: SG.W - 56, y: SG.H - 48, w: 40, h: 34 }; }

  // ---------------------------------------------------------------
  // Overlays - the little interactions
  // ---------------------------------------------------------------
  function updateOverlay(dt) {
    var o = st.ov;
    switch (st.overlay) {
      case 'nuke':
        o.t += dt;
        if (o.t >= o.dur && !o.done) { o.done = true; SG.audio.play('wingbig'); }
        if (o.done && SG.input.takeTap()) { say('Warm. Melty. Correct.'); closeOverlay(true); }
        break;

      case 'spray':
        if (SG.input.takeTap()) {
          o.sprays++;
          st.hairLevel = o.sprays;
          SG.audio.play('slide');
          if (o.sprays >= 3) { say('Untouchable.'); closeOverlay(true); }
        }
        break;

      case 'video':
        o.t += dt;
        if (o.stage === 0 && o.t > 0.8) { o.stage = 1; o.t = 0; SG.audio.play('record'); }
        else if (o.stage === 1 && o.t > 2.4) { o.stage = 2; o.t = 0; SG.audio.play('power'); }
        else if (o.stage === 2) {
          o.views = Math.min(12400, Math.floor(o.t * 9000));
          if (o.t > 1.8 && SG.input.takeTap()) { st.videoMade = true; say('Uploaded. Lap if it flops.'); closeOverlay(true); }
        }
        break;

      case 'wings':
        if (SG.input.takeTap()) {
          o.eaten++;
          st.wingsLeft = Math.max(0, 5 - o.eaten);
          SG.audio.play('wing');
          if (o.eaten >= 5) { say('Hot sauce. Every time.'); closeOverlay(true); }
        }
        break;

      case 'call':
        o.t += dt;
        if (SG.input.takeTap()) {
          o.line++;
          SG.audio.play('tap');
          if (o.line >= CALL_LINES.length) { say('She hung up first. Respect.'); closeOverlay(true); }
        }
        break;

      case 'sleep':
        o.t += dt;
        if (o.t > 1.6) closeOverlay(true);
        break;
    }
  }

  var CALL_LINES = [
    { who: 'santi', text: 'Daley! Guess what I ate.' },
    { who: 'daley', text: 'Chicken wings.' },
    { who: 'santi', text: '...how did you know that.' },
    { who: 'daley', text: 'Santi. It is always chicken wings.' },
    { who: 'santi', text: 'Lap.' },
  ];

  // ---------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------
  function draw(g) {
    var cam = st.cam;

    drawBackdrop(g, cam);

    // objects behind Santi (wall-mounted and large furniture)
    for (var i = 0; i < st.objects.length; i++) drawObject(g, st.objects[i], cam);

    drawRue(g, cam);
    drawSanti(g, cam);

    drawGuide(g, cam);
    drawHUD(g);

    if (st.bubble) drawBubble(g, cam);
    if (st.overlay) drawOverlay(g);
    if (st.paused) drawPaused(g);
    if (st.done) drawDone(g);
  }

  function drawBackdrop(g, cam) {
    // sky / outside first
    var sky = g.createLinearGradient(0, 0, 0, SG.H);
    sky.addColorStop(0, '#2a4a86');
    sky.addColorStop(0.6, '#6a7fb8');
    sky.addColorStop(1, '#c9a06a');
    g.fillStyle = sky;
    g.fillRect(0, 0, SG.W, SG.H);

    // street ground
    g.fillStyle = '#5d5a52';
    g.fillRect(0, FLOOR_Y, SG.W, SG.H - FLOOR_Y);
    g.fillStyle = '#6d6a60';
    g.fillRect(0, FLOOR_Y, SG.W, 10);

    // distant houses for the street section
    for (var h = 0; h < 8; h++) {
      var hx = 3920 + h * 150 - cam;
      if (hx < -160 || hx > SG.W + 60) continue;
      g.fillStyle = h % 2 ? '#8c7fa8' : '#7a6f96';
      g.fillRect(hx, 150, 120, FLOOR_Y - 150);
      g.fillStyle = '#5a5178';
      g.beginPath();
      g.moveTo(hx - 10, 150); g.lineTo(hx + 60, 106); g.lineTo(hx + 130, 150);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,214,140,0.5)';
      g.fillRect(hx + 22, 190, 30, 34);
      g.fillRect(hx + 70, 190, 30, 34);
    }

    // the flat
    for (var r = 0; r < ROOMS.length; r++) {
      var rm = ROOMS[r];
      var x0 = rm.x0 - cam, x1 = rm.x1 - cam;
      if (x1 < -20 || x0 > SG.W + 20) continue;

      g.fillStyle = rm.wall;
      g.fillRect(x0, CEIL_Y, x1 - x0, FLOOR_Y - CEIL_Y);

      // skirting + floor
      g.fillStyle = rm.floor;
      g.fillRect(x0, FLOOR_Y, x1 - x0, SG.H - FLOOR_Y);
      g.fillStyle = 'rgba(255,255,255,0.09)';
      g.fillRect(x0, FLOOR_Y - 12, x1 - x0, 12);

      // floorboards
      g.strokeStyle = 'rgba(0,0,0,0.13)';
      g.lineWidth = 2;
      for (var b = 0; b < 9; b++) {
        var bx = x0 + b * ((x1 - x0) / 9);
        g.beginPath(); g.moveTo(bx, FLOOR_Y); g.lineTo(bx - 24, SG.H); g.stroke();
      }

      // room label
      SG.ui.text(g, rm.name, (x0 + x1) / 2, CEIL_Y + 26, {
        size: 15, color: 'rgba(255,255,255,0.22)', shadow: false,
      });

      // dividing wall
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x1 - 5, CEIL_Y, 10, FLOOR_Y - CEIL_Y);
    }

    // ceiling strip
    if (INSIDE_W - cam > 0) {
      g.fillStyle = '#241d3a';
      g.fillRect(0, CEIL_Y - 16, Math.min(SG.W, INSIDE_W - cam), 16);
    }
  }

  function drawObject(g, o, cam) {
    var x = o.x - cam;
    if (x < -260 || x > SG.W + 260) return;
    var base = FLOOR_Y;
    g.save();

    switch (o.kind) {
      case 'bed':
        g.fillStyle = '#6b4a8a';
        SG.roundRect(g, x - 130, base - 74, 260, 74, 8); g.fill();
        g.fillStyle = '#8a63ad';
        SG.roundRect(g, x - 130, base - 96, 46, 96, 8); g.fill();   // headboard
        g.fillStyle = '#f2e7d5';
        SG.roundRect(g, x - 76, base - 88, 62, 26, 8); g.fill();    // pillow
        g.fillStyle = st.inBed ? '#c9536b' : '#a8425c';
        SG.roundRect(g, x - 20, base - 80, 148, 34, 8); g.fill();   // duvet
        break;

      case 'clock':
        g.fillStyle = '#2b2740';
        SG.roundRect(g, x - 30, base - 60, 60, 60, 6); g.fill();
        g.fillStyle = '#1a1730';
        SG.roundRect(g, x - 22, base - 52, 44, 24, 4); g.fill();
        SG.ui.text(g, '11:40', x, base - 40, { size: 13, color: '#ff5a4a', shadow: false });
        break;

      case 'poster':
        g.fillStyle = '#14102a';
        SG.roundRect(g, x - 55, base - 300, 110, 140, 5); g.fill();
        g.strokeStyle = '#ffb02e'; g.lineWidth = 3;
        SG.roundRect(g, x - 55, base - 300, 110, 140, 5); g.stroke();
        SG.ui.text(g, 'SANTI', x, base - 258, { size: 19, color: '#fff', shadow: false });
        SG.ui.text(g, "CAN'T", x, base - 234, { size: 19, color: '#ffb02e', shadow: false });
        SG.art.drawWing(g, x, base - 195, 1.5, -0.3);
        break;

      case 'sink':
        g.fillStyle = '#cfd8e8';
        SG.roundRect(g, x - 60, base - 96, 120, 30, 6); g.fill();
        g.fillStyle = '#9aa6bd';
        g.fillRect(x - 14, base - 66, 28, 66);
        g.fillStyle = '#e6edf7';                     // mirror
        SG.roundRect(g, x - 46, base - 220, 92, 106, 6); g.fill();
        g.strokeStyle = '#8fa0bd'; g.lineWidth = 3;
        SG.roundRect(g, x - 46, base - 220, 92, 106, 6); g.stroke();
        break;

      case 'hairspray':
        g.fillStyle = '#ffd400';
        SG.roundRect(g, x - 16, base - 108, 32, 62, 6); g.fill();
        g.strokeStyle = '#3a2412'; g.lineWidth = 2.5;
        SG.roundRect(g, x - 16, base - 108, 32, 62, 6); g.stroke();
        g.fillStyle = '#e8202a';
        SG.roundRect(g, x - 10, base - 126, 20, 20, 4); g.fill(); g.stroke();
        g.fillStyle = '#fff';
        SG.roundRect(g, x - 13, base - 92, 26, 16, 3); g.fill();
        g.fillStyle = '#2b2740';
        SG.roundRect(g, x - 26, base - 46, 52, 46, 5); g.fill();   // shelf
        break;

      case 'toilet':
        g.fillStyle = '#e8eef7';
        SG.roundRect(g, x - 34, base - 52, 68, 52, 10); g.fill();
        SG.roundRect(g, x - 26, base - 108, 52, 60, 6); g.fill();
        break;

      case 'rack':
        g.fillStyle = '#6b5a3a';
        g.fillRect(x - 150, base - 190, 300, 8);
        g.fillRect(x - 146, base - 190, 6, 190);
        g.fillRect(x + 140, base - 190, 6, 190);
        for (var s = 0; s < SHIRTS.length; s++) {
          drawTee(g, x - 92 + s * 92, base - 182, 74, SHIRTS[s]);
        }
        break;

      case 'shoes':
        for (var sh = 0; sh < 2; sh++) {
          g.fillStyle = '#f4f4f8';
          SG.roundRect(g, x - 50 + sh * 52, base - 24, 46, 24, 8); g.fill();
          g.strokeStyle = '#2b2740'; g.lineWidth = 2; g.stroke();
          g.fillStyle = '#e8202a';
          g.fillRect(x - 46 + sh * 52, base - 20, 38, 5);
        }
        break;

      case 'couch':
        g.fillStyle = '#3f6f8c';
        SG.roundRect(g, x - 140, base - 76, 280, 76, 12); g.fill();
        g.fillStyle = '#4e83a3';
        SG.roundRect(g, x - 140, base - 118, 280, 50, 12); g.fill();
        g.fillStyle = '#356078';
        SG.roundRect(g, x - 150, base - 108, 30, 108, 10); g.fill();
        SG.roundRect(g, x + 120, base - 108, 30, 108, 10); g.fill();
        break;

      case 'tv':
        g.fillStyle = '#2b2740';
        g.fillRect(x - 12, base - 40, 24, 40);
        g.fillStyle = '#14102a';
        SG.roundRect(g, x - 90, base - 154, 180, 116, 7); g.fill();
        g.fillStyle = '#2f5f8f';
        SG.roundRect(g, x - 82, base - 146, 164, 100, 4); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.13)';
        g.beginPath(); g.moveTo(x - 82, base - 46); g.lineTo(x + 20, base - 146); g.lineTo(x + 60, base - 146); g.lineTo(x - 42, base - 46); g.closePath(); g.fill();
        break;

      case 'camera':
        g.strokeStyle = '#3a3550'; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, base - 106); g.lineTo(x - 30, base);
        g.moveTo(x, base - 106); g.lineTo(x + 30, base);
        g.moveTo(x, base - 106); g.lineTo(x + 4, base);
        g.stroke();
        g.fillStyle = '#22203a';
        SG.roundRect(g, x - 34, base - 152, 68, 46, 6); g.fill();
        g.fillStyle = '#4a4870';
        g.beginPath(); g.arc(x + 4, base - 129, 15, 0, Math.PI * 2); g.fill();
        g.fillStyle = st.videoMade ? '#4dd47a' : '#e8202a';
        g.beginPath(); g.arc(x - 22, base - 143, 4.5, 0, Math.PI * 2); g.fill();
        // ring light
        g.strokeStyle = '#ffe9a8'; g.lineWidth = 8;
        g.beginPath(); g.arc(x + 92, base - 150, 34, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#3a3550'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(x + 92, base - 116); g.lineTo(x + 92, base); g.stroke();
        break;

      case 'phone':
        g.fillStyle = '#6b5a3a';
        SG.roundRect(g, x - 42, base - 44, 84, 44, 5); g.fill();    // side table
        g.fillStyle = '#1a1730';
        SG.roundRect(g, x - 13, base - 74, 26, 44, 5); g.fill();
        g.fillStyle = '#4a7fd4';
        SG.roundRect(g, x - 10, base - 71, 20, 34, 3); g.fill();
        break;

      case 'fridge':
        g.fillStyle = '#d3dbe6';
        SG.roundRect(g, x - 70, base - 210, 140, 210, 9); g.fill();
        g.strokeStyle = '#9aa6bd'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x - 70, base - 132); g.lineTo(x + 70, base - 132); g.stroke();
        g.fillStyle = '#8f9bb0';
        SG.roundRect(g, x + 48, base - 122, 10, 40, 4); g.fill();
        SG.roundRect(g, x + 48, base - 196, 10, 46, 4); g.fill();
        SG.art.drawWing(g, x - 30, base - 172, 0.9, -0.3);          // fridge magnet
        break;

      case 'counter':
        g.fillStyle = '#7a6a52';
        SG.roundRect(g, x - 120, base - 92, 240, 92, 5); g.fill();
        g.fillStyle = '#a89377';
        g.fillRect(x - 120, base - 100, 240, 12);
        if (!st.hasFood) {
          g.fillStyle = '#e8c17a';                                  // bread
          SG.roundRect(g, x - 66, base - 126, 56, 28, 8); g.fill();
          g.strokeStyle = '#a8763a'; g.lineWidth = 2; g.stroke();
          g.fillStyle = '#ffd400';                                  // cheese
          g.beginPath();
          g.moveTo(x + 8, base - 100); g.lineTo(x + 62, base - 100); g.lineTo(x + 46, base - 128); g.closePath();
          g.fill();
          g.strokeStyle = '#c9a41a'; g.stroke();
        }
        break;

      case 'microwave':
        g.fillStyle = '#7a6a52';
        SG.roundRect(g, x - 70, base - 76, 140, 76, 5); g.fill();
        g.fillStyle = '#3a3550';
        SG.roundRect(g, x - 66, base - 152, 132, 78, 6); g.fill();
        g.fillStyle = '#1c1a30';
        SG.roundRect(g, x - 58, base - 144, 88, 62, 4); g.fill();
        var lit = st.overlay === 'nuke' && !st.ov.done;
        if (lit) {
          g.fillStyle = 'rgba(255,214,120,0.55)';
          SG.roundRect(g, x - 58, base - 144, 88, 62, 4); g.fill();
        }
        g.fillStyle = '#8f8ab0';
        SG.roundRect(g, x + 36, base - 140, 22, 54, 3); g.fill();
        break;

      case 'wings':
        g.fillStyle = '#e8eef7';
        g.beginPath(); g.ellipse(x, base - 84, 56, 15, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#b9c3d4'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#7a6a52';
        SG.roundRect(g, x - 60, base - 76, 120, 76, 5); g.fill();
        for (var w = 0; w < st.wingsLeft; w++) {
          SG.art.drawWing(g, x - 34 + (w % 3) * 34, base - 92 - Math.floor(w / 3) * 14, 1.0, -0.3 + w * 0.4);
        }
        break;

      case 'leash':
        g.strokeStyle = '#8a5a2a'; g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x - 14, base - 250);
        g.quadraticCurveTo(x, base - 208, x + 14, base - 250);
        g.stroke();
        g.fillStyle = '#5a4a6a';
        g.fillRect(x - 22, base - 258, 44, 8);
        if (st.hasLeash) { g.globalAlpha = 0.25; }
        break;

      case 'door':
        g.fillStyle = '#3a2f4e';
        g.fillRect(x - 70, base - 250, 140, 250);
        g.fillStyle = st.doorOpen ? '#88c8f0' : '#8a5a3a';
        if (st.doorOpen) {
          g.fillRect(x - 58, base - 236, 116, 236);
          g.fillStyle = '#5a4a3a';
          g.fillRect(x - 58, base - 236, 22, 236);
        } else {
          SG.roundRect(g, x - 58, base - 236, 116, 236, 4); g.fill();
          g.strokeStyle = '#5a3a24'; g.lineWidth = 3;
          SG.roundRect(g, x - 44, base - 220, 88, 96, 3); g.stroke();
          SG.roundRect(g, x - 44, base - 112, 88, 84, 3); g.stroke();
          g.fillStyle = '#ffd400';
          g.beginPath(); g.arc(x + 40, base - 124, 7, 0, Math.PI * 2); g.fill();
        }
        break;

      case 'bin':
        g.fillStyle = '#4a6a4a';
        SG.roundRect(g, x - 34, base - 78, 68, 78, 6); g.fill();
        g.fillStyle = '#5f8a5f';
        SG.roundRect(g, x - 40, base - 90, 80, 16, 5); g.fill();
        break;

      case 'lamp':
        g.fillStyle = '#3f3a52';
        g.fillRect(x - 6, base - 250, 12, 250);
        g.fillStyle = '#ffe9a8';
        SG.roundRect(g, x - 22, base - 274, 44, 26, 6); g.fill();
        break;

      case 'tree':
        g.fillStyle = '#5a3f28';
        g.fillRect(x - 16, base - 130, 32, 130);
        g.fillStyle = '#2f7d4f';
        g.beginPath(); g.arc(x - 42, base - 168, 54, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x + 40, base - 176, 60, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x, base - 216, 66, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3f9a62';
        g.beginPath(); g.arc(x - 18, base - 196, 40, 0, Math.PI * 2); g.fill();
        break;

      case 'bench':
        g.fillStyle = '#8a6a3a';
        SG.roundRect(g, x - 74, base - 54, 148, 12, 4); g.fill();
        SG.roundRect(g, x - 74, base - 90, 148, 12, 4); g.fill();
        g.fillStyle = '#4a4058';
        g.fillRect(x - 62, base - 54, 10, 54);
        g.fillRect(x + 52, base - 54, 10, 54);
        break;
    }
    g.restore();
  }

  function drawTee(g, x, y, h, kit) {
    var w = h * 0.86;
    g.fillStyle = kit.shirt;
    g.beginPath();
    g.moveTo(x - w / 2, y + h * 0.16);
    g.lineTo(x - w / 2 - w * 0.16, y + h * 0.34);
    g.lineTo(x - w / 2 + w * 0.06, y + h * 0.5);
    g.lineTo(x - w / 2 + w * 0.06, y + h);
    g.lineTo(x + w / 2 - w * 0.06, y + h);
    g.lineTo(x + w / 2 - w * 0.06, y + h * 0.5);
    g.lineTo(x + w / 2 + w * 0.16, y + h * 0.34);
    g.lineTo(x + w / 2, y + h * 0.16);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(20,16,30,0.5)';
    g.lineWidth = 2;
    g.stroke();
    SG.art.boxLogo(g, x, y + h * 0.56, w * 0.66, 'SANTI', kit.box);
  }

  function drawSanti(g, cam) {
    var x = st.x - cam;
    var y = FLOOR_Y;
    if (st.inBed) {
      // tucked up in bed - drawn lying down
      var b = obj('bed');
      var bx = b.x - cam;
      SG.art.drawHead(g, bx + 44, FLOOR_Y - 96, 26, 'santi', 'normal');
      return;
    }
    var moving = Math.abs(st.vx) > 1;
    g.save();
    if (st.facing < 0) { g.translate(x * 2, 0); g.scale(-1, 1); }
    SG.art.drawSanti(g, x, y, SANTI_H, st.walkPhase, {
      shirt: st.shirt.shirt,
      boxColor: st.shirt.box,
      pants: '#232a46',
      run: moving ? 1 : 0.08,
      bob: moving,
    });
    g.restore();
    // The hairspray gag lives in its own overlay - stacked on top of the
    // head sprite out here it just sits behind his actual hair and reads
    // as nothing at all.
  }

  function drawRue(g, cam) {
    if (!st.rue.follow) return;
    var sprite = SG.art.sprites['rue-side'] || SG.art.sprites.rue;
    var x = st.rue.x - cam;
    var h = 74;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(x, FLOOR_Y - 3, 30, 8, 0, 0, Math.PI * 2);
    g.fill();
    if (sprite) {
      var w = h * (sprite.width / sprite.height);
      var bob = Math.abs(Math.sin(st.rue.phase)) * 3;
      g.drawImage(sprite, x - w / 2, FLOOR_Y - h - bob, w, h);
    }
    g.restore();
  }

  // Arrow over the current target, plus an edge marker when off screen.
  function drawGuide(g, cam) {
    var tk = task();
    if (!tk || st.overlay) return;
    var o = obj(tk.target);
    if (!o) return;

    var x = o.x - cam;
    var topY = FLOOR_Y - (o.onWall ? 262 : 150);
    var bounce = Math.sin(st.t * 4) * 7;

    if (x > 30 && x < SG.W - 30) {
      // highlight ring on the floor under it
      g.save();
      g.strokeStyle = 'rgba(255,214,80,' + (0.5 + Math.sin(st.t * 5) * 0.2) + ')';
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(x, FLOOR_Y + 6, o.w * 0.6, 14, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();

      // arrow
      g.save();
      g.translate(x, topY + bounce);
      g.fillStyle = '#ffd400';
      g.strokeStyle = '#1a1030';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 26); g.lineTo(-17, 0); g.lineTo(-7, 0); g.lineTo(-7, -22);
      g.lineTo(7, -22); g.lineTo(7, 0); g.lineTo(17, 0);
      g.closePath();
      g.fill(); g.stroke();
      g.restore();

      SG.ui.text(g, o.label, x, topY - 34 + bounce, {
        size: 13, color: '#ffd400', stroke: '#1a1030', strokeWidth: 4, shadow: false,
      });
    } else {
      // off-screen: point the way
      var edge = x <= 30 ? 40 : SG.W - 40;
      var dir = x <= 30 ? -1 : 1;
      g.save();
      g.translate(edge, SG.H / 2);
      g.scale(dir, 1);
      g.fillStyle = '#ffd400';
      g.strokeStyle = '#1a1030';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(22, 0); g.lineTo(-6, -22); g.lineTo(-6, -9); g.lineTo(-24, -9);
      g.lineTo(-24, 9); g.lineTo(-6, 9); g.lineTo(-6, 22);
      g.closePath();
      g.fill(); g.stroke();
      g.restore();
      SG.ui.text(g, o.label, edge, SG.H / 2 + 40, {
        size: 12, color: '#ffd400', stroke: '#1a1030', strokeWidth: 4, shadow: false,
      });
    }
  }

  function drawBubble(g, cam) {
    var x = SG.clamp(st.x - cam, 120, SG.W - 120);
    var y = FLOOR_Y - SANTI_H - 44;
    g.save();
    g.globalAlpha = SG.clamp(3 - st.bubbleT, 0, 1);
    g.font = '700 15px "Avenir Next", system-ui, sans-serif';
    var w = Math.max(120, g.measureText(st.bubble).width + 34);
    SG.ui.panel(g, x - w / 2, y - 24, w, 40, { fill: 'rgba(250,246,238,0.97)', r: 12, border: 'rgba(30,24,50,0.5)', borderWidth: 2 });
    g.fillStyle = 'rgba(250,246,238,0.97)';
    g.beginPath();
    g.moveTo(x - 9, y + 15); g.lineTo(x, y + 30); g.lineTo(x + 9, y + 15);
    g.closePath(); g.fill();
    SG.ui.text(g, st.bubble, x, y - 3, {
      size: 15, color: '#1e1832', weight: '700',
      font: '"Avenir Next", system-ui, sans-serif', shadow: false,
    });
    g.restore();
  }

  function drawHUD(g) {
    var tk = task();
    // task banner
    SG.ui.panel(g, 16, 14, 320, 58, { fill: 'rgba(12,10,28,0.82)', r: 12, border: 'rgba(255,214,80,0.45)' });
    if (tk) {
      SG.ui.text(g, 'TASK ' + (st.taskIndex + 1) + '/' + TASKS.length, 30, 32, {
        size: 11, color: 'rgba(255,255,255,0.45)', align: 'left', shadow: false,
      });
      SG.ui.text(g, tk.title, 30, 50, { size: 18, color: '#ffd400', align: 'left', shadow: false });
      SG.ui.text(g, tk.hint, 30, 66, {
        size: 12, color: 'rgba(255,255,255,0.6)', align: 'left', weight: '600',
        font: '"Avenir Next", system-ui, sans-serif', shadow: false,
      });
    }

    // wings
    SG.art.drawWing(g, SG.W - 96, 34, 1.1, -0.3);
    SG.ui.text(g, String(st.wings), SG.W - 78, 34, {
      size: 22, color: SG.COLORS.gold, align: 'left', stroke: '#1a1030', strokeWidth: 5, shadow: false,
    });

    if (st.flash > 0) {
      g.save();
      g.globalAlpha = st.flash;
      SG.ui.text(g, '+' + WINGS_PER_TASK, SG.W - 78, 58, { size: 15, color: '#4dd47a', align: 'left', shadow: false });
      g.restore();
    }

    if (!st.done) {
      var pr = pauseRect();
      g.fillStyle = 'rgba(10,12,26,0.5)';
      SG.roundRect(g, pr.x, pr.y, pr.w, pr.h, 8);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(pr.x + 13, pr.y + 10, 5, 15);
      g.fillRect(pr.x + 23, pr.y + 10, 5, 15);
    }
  }

  // ---------------------------------------------------------------
  function drawOverlay(g) {
    var o = st.ov;
    g.fillStyle = 'rgba(5,6,14,0.72)';
    g.fillRect(0, 0, SG.W, SG.H);
    var CX = SG.W / 2;

    switch (st.overlay) {
      case 'nuke': {
        SG.ui.panel(g, CX - 200, 120, 400, 260);
        SG.ui.text(g, 'MICROWAVE', CX, 162, { size: 26, color: '#ffd400', shadow: false });
        var frac = SG.clamp(o.t / o.dur, 0, 1);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        SG.roundRect(g, CX - 140, 210, 280, 22, 11); g.fill();
        g.fillStyle = o.done ? '#4dd47a' : '#ffb02e';
        SG.roundRect(g, CX - 140, 210, 280 * frac, 22, 11); g.fill();
        // bread with cheese, melting
        g.fillStyle = '#e8c17a';
        SG.roundRect(g, CX - 52, 262, 104, 46, 10); g.fill();
        g.strokeStyle = '#a8763a'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#ffd400';
        g.beginPath();
        g.moveTo(CX - 44, 272);
        for (var i = 0; i <= 8; i++) {
          g.lineTo(CX - 44 + i * 11, 272 + Math.sin(i * 1.4 + o.t * 4) * 5 * frac + frac * 8);
        }
        g.lineTo(CX + 44, 300); g.lineTo(CX - 44, 300);
        g.closePath(); g.fill();
        SG.ui.text(g, o.done ? 'TAP TO TAKE IT OUT' : 'HEATING...', CX, 344, {
          size: 14, color: o.done ? '#4dd47a' : 'rgba(255,255,255,0.6)', shadow: false,
        });
        break;
      }

      case 'spray': {
        SG.ui.panel(g, CX - 190, 110, 380, 300);
        SG.ui.text(g, 'THE HAIR', CX, 152, { size: 26, color: '#ffd400', shadow: false });
        SG.art.drawHead(g, CX, 258, 62, 'santi', 'normal');
        for (var s = 0; s < o.sprays; s++) {
          g.fillStyle = 'rgba(74,48,32,0.95)';
          g.beginPath();
          g.ellipse(CX, 190 - s * 15, 58 - s * 10, 16, 0, 0, Math.PI * 2);
          g.fill();
        }
        SG.ui.text(g, 'TAP TO SPRAY   ' + o.sprays + ' / 3', CX, 372, {
          size: 16, color: '#fff', shadow: false,
        });
        break;
      }

      case 'shirt': {
        SG.ui.panel(g, CX - 300, 96, 600, 330);
        SG.ui.text(g, 'PICK A FIT', CX, 138, { size: 26, color: '#ffd400', shadow: false });
        for (var t = 0; t < SHIRTS.length; t++) {
          var bx = CX - 190 + t * 190;
          var r = { x: bx - 78, y: 170, w: 156, h: 210 };
          var hot = SG.input.tappedRect(r);
          g.fillStyle = 'rgba(255,255,255,0.05)';
          SG.roundRect(g, r.x, r.y, r.w, r.h, 12); g.fill();
          g.strokeStyle = 'rgba(255,214,80,0.5)'; g.lineWidth = 2;
          SG.roundRect(g, r.x, r.y, r.w, r.h, 12); g.stroke();
          drawTee(g, bx, 190, 130, SHIRTS[t]);
          SG.ui.text(g, SHIRTS[t].name, bx, 358, { size: 13, color: '#fff', shadow: false });
          if (hot) {
            st.shirt = SHIRTS[t];
            say('This one. Always this one.');
            closeOverlay(true);
            return;
          }
        }
        break;
      }

      case 'video': {
        SG.ui.panel(g, CX - 250, 100, 500, 320);
        if (o.stage === 0) {
          SG.ui.text(g, 'SETTING UP...', CX, 250, { size: 24, color: '#fff', shadow: false });
        } else if (o.stage === 1) {
          g.fillStyle = '#e8202a';
          g.beginPath(); g.arc(CX - 90, 168, 11, 0, Math.PI * 2); g.fill();
          SG.ui.text(g, 'REC', CX - 58, 168, { size: 20, color: '#e8202a', align: 'left', shadow: false });
          SG.art.drawHead(g, CX, 262, 66, 'santi', 'normal');
          SG.ui.text(g, '"Yo what is up, Santi here"', CX, 358, {
            size: 16, color: 'rgba(255,255,255,0.85)', weight: '700',
            font: '"Avenir Next", system-ui, sans-serif', shadow: false,
          });
        } else {
          SG.ui.text(g, "SANTI CAN'T", CX, 150, { size: 26, color: '#ffd400', shadow: false });
          SG.ui.text(g, 'MICROWAVE BREAD (GONE WRONG)', CX, 182, {
            size: 14, color: 'rgba(255,255,255,0.7)', shadow: false,
          });
          SG.ui.text(g, o.views.toLocaleString(), CX, 250, { size: 46, color: '#fff', shadow: false });
          SG.ui.text(g, 'VIEWS', CX, 286, { size: 13, color: 'rgba(255,255,255,0.45)', shadow: false });
          if (o.t > 1.8) {
            SG.ui.text(g, 'TAP TO UPLOAD', CX, 356, { size: 16, color: '#4dd47a', shadow: false });
          }
        }
        break;
      }

      case 'wings': {
        SG.ui.panel(g, CX - 220, 120, 440, 270);
        SG.ui.text(g, 'CHICKEN WINGS', CX, 162, { size: 24, color: '#ffd400', shadow: false });
        var left = 5 - o.eaten;
        for (var w2 = 0; w2 < left; w2++) {
          SG.art.drawWing(g, CX - 96 + w2 * 48, 250, 1.8, -0.3 + w2 * 0.5);
        }
        if (left === 0) SG.ui.text(g, 'GONE.', CX, 250, { size: 30, color: '#4dd47a', shadow: false });
        SG.ui.text(g, 'TAP TO EAT   ' + o.eaten + ' / 5', CX, 344, { size: 16, color: '#fff', shadow: false });
        break;
      }

      case 'call': {
        SG.ui.panel(g, CX - 250, 96, 500, 330);
        var dFace = SG.art.faces.daley;
        var sFace = SG.art.faces.santi;
        if (dFace) g.drawImage(dFace, CX + 96, 128, 96, 96);
        if (sFace) g.drawImage(sFace, CX - 192, 128, 96, 96);
        SG.ui.text(g, 'DALEY', CX + 144, 240, { size: 15, color: '#ff6b8a', shadow: false });
        SG.ui.text(g, 'SANTI', CX - 144, 240, { size: 15, color: '#ffd400', shadow: false });

        var line = CALL_LINES[Math.min(o.line, CALL_LINES.length - 1)];
        var isS = line.who === 'santi';
        SG.ui.panel(g, CX - 210, 276, 420, 66, {
          fill: isS ? 'rgba(255,214,80,0.14)' : 'rgba(255,107,138,0.14)', r: 12,
          border: isS ? 'rgba(255,214,80,0.5)' : 'rgba(255,107,138,0.5)',
        });
        SG.ui.text(g, line.text, CX, 309, {
          size: 17, color: '#fff', weight: '700',
          font: '"Avenir Next", system-ui, sans-serif', shadow: false,
        });
        SG.ui.text(g, 'TAP TO CONTINUE', CX, 372, { size: 12, color: 'rgba(255,255,255,0.4)', shadow: false });
        break;
      }

      case 'sleep': {
        g.fillStyle = 'rgba(0,0,0,' + SG.clamp(o.t / 1.6, 0, 1) + ')';
        g.fillRect(0, 0, SG.W, SG.H);
        SG.ui.text(g, 'ZzZ', CX, SG.H / 2, {
          size: 40, color: 'rgba(255,255,255,' + SG.clamp(o.t, 0, 1) * 0.8 + ')', shadow: false,
        });
        break;
      }
    }
  }

  function drawPaused(g) {
    g.fillStyle = 'rgba(5,6,14,0.78)';
    g.fillRect(0, 0, SG.W, SG.H);
    var CX = SG.W / 2;
    SG.ui.panel(g, CX - 170, 130, 340, 280);
    SG.ui.text(g, 'PAUSED', CX, 180, { size: 34, color: '#fff', shadow: false });
    if (SG.ui.button(g, { x: CX - 120, y: 222, w: 240, h: 48 }, 'RESUME', { color: SG.COLORS.gold })) st.paused = false;
    if (SG.ui.button(g, { x: CX - 120, y: 280, w: 240, h: 44 }, 'RESTART DAY', { color: '#3a4270', text: '#fff' })) reset();
    if (SG.ui.button(g, { x: CX - 120, y: 334, w: 240, h: 44 }, 'MENU', { color: '#2a2f52', text: '#fff' })) SG.go('menu');
  }

  function drawDone(g) {
    var CX = SG.W / 2;
    g.fillStyle = 'rgba(5,6,14,0.86)';
    g.fillRect(0, 0, SG.W, SG.H);
    SG.ui.panel(g, CX - 230, 88, 460, 364);
    SG.ui.text(g, 'DAY COMPLETE', CX, 138, { size: 34, color: SG.COLORS.gold, stroke: '#1a1030', strokeWidth: 8, shadow: false });

    var f = SG.art.faces.santi;
    if (f) g.drawImage(f, CX - 44, 166, 88, 88);

    SG.ui.text(g, TASKS.length + ' tasks done', CX, 282, { size: 18, color: '#fff', shadow: false });
    SG.art.drawWing(g, CX - 62, 314, 1.2, -0.3);
    SG.ui.text(g, '+' + st.wings + ' wings', CX - 42, 314, { size: 17, color: SG.COLORS.gold, align: 'left', shadow: false });
    SG.ui.text(g, Math.floor(st.t) + 's · day ' + (SG.save.data.simDays || 1), CX, 344, {
      size: 13, color: 'rgba(255,255,255,0.45)', shadow: false,
    });

    if (SG.ui.button(g, { x: CX - 200, y: 372, w: 190, h: 52 }, 'ANOTHER DAY', { color: SG.COLORS.gold, size: 16 })) reset();
    if (SG.ui.button(g, { x: CX + 10, y: 372, w: 190, h: 52 }, 'MENU', { color: '#3a4270', text: '#fff' })) SG.go('menu');
  }

  SG.register('sim', {
    enter: function () { reset(); },
    update: update,
    draw: draw,
    onBlur: function () { if (st && !st.done) st.paused = true; },
  });
})();
