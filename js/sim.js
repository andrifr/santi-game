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
  /* Jump: 720^2 / 2*2400 = 108px up, 0.6s in the air. Enough to be
     worth pressing and to clear Rue, not enough to reach the ceiling. */
  var JUMP_V = 720, JUMP_G = 2400;
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
        flavor: ["It's 11:40. Bit late.", 'Snoozed six times.',
                 'The alarm did its best.', 'Set for 7. Purely decorative.',
                 'It went off. I remember it going off.'] },
      { id: 'poster',    x: 600,  w: 110, kind: 'poster',    label: 'POSTER', onWall: true,
        flavor: ['1.2M subscribers. One day.', 'SANTI CAN\'T - the poster.',
                 'Straight. Finally straight.', 'Daley says it is crooked. It is not.'] },

      // --- bathroom ---
      { id: 'sink',      x: 940,  w: 150, kind: 'sink',      label: 'MIRROR' },
      { id: 'hairspray', x: 1120, w: 70,  kind: 'hairspray', label: 'HAIRSPRAY' },
      { id: 'toilet',    x: 1290, w: 110, kind: 'toilet',    label: 'TOILET',
        flavor: [
          'Morning poop: done. Magnificent.',
          'Ten minutes well spent in there.',
          'Still flushing fine. Daley has not clogged it yet.',
          'No clogs today. A good day.',
          'That was a personal best, honestly.',
        ] },

      // --- closet ---
      { id: 'rack',      x: 1650, w: 300, kind: 'rack',      label: 'SUPREME TEES' },
      { id: 'shoes',     x: 1900, w: 120, kind: 'shoes',     label: 'SHOES',
        flavor: ['Fresh. Obviously.', 'These ones. Always these ones.',
                 'Not for outside. These are inside shoes now.',
                 'Cleaned with a toothbrush. My toothbrush.'] },

      { id: 'guitar',    x: 500,  w: 70,  kind: 'guitar',    label: 'GUITAR',
        flavor: ['Three chords. Two of them good.', 'It has been in tune once.',
                 'I only ever play Azizam on it.', 'Daley has heard Azizam enough now.'] },

      // --- living room ---
      { id: 'couch',     x: 2130, w: 280, kind: 'couch',     label: 'COUCH',
        flavor: ['No sitting. Busy day.', 'The couch is calling. Ignore it.'] },
      { id: 'console',   x: 710, w: 90,  kind: 'console',   label: 'CONSOLE',
        flavor: ['One game. One.', 'Fortnite. Obviously.', 'Brawl Stars until the battery dies.'] },
      { id: 'stereo',    x: 1450, w: 90,  kind: 'stereo',    label: 'SPEAKER',
        flavor: ['K3 is already queued.', 'The neighbours know every word by now.',
                 'Full volume. Correct volume.',
                 'I know every word. Every single word.',
                 'The neighbours have stopped complaining. They gave up.',
                 'Daley says I sing it wrong. I do not.',
                 'Dance moves included, free of charge.'] },
      { id: 'tv',        x: 2400, w: 180, kind: 'tv',        label: 'TV',
        flavor: ['Nothing on.', 'Fortnite later. Promise.',
                 'Paused three weeks ago. Still paused.',
                 'K3 on the music channel. Leave it.'] },
      { id: 'camera',    x: 2620, w: 130, kind: 'camera',    label: 'CAMERA' },
      { id: 'phone',     x: 2780, w: 70,  kind: 'phone',     label: 'PHONE' },

      // --- kitchen ---
      { id: 'fridge',    x: 2930, w: 150, kind: 'fridge',    label: 'FRIDGE',
        flavor: ['Hot sauce. Three bottles.', 'Mostly hot sauce in here.',
                 'One yoghurt. Expired. Load-bearing.',
                 'Daley labelled her cheese. Bold.'] },
      { id: 'counter',   x: 3160, w: 240, kind: 'counter',   label: 'CASH TOPIT',
        flavor: ['Cash topit. The only breakfast.', 'Bread. Cheese. Microwave. Done.'] },
      { id: 'microwave', x: 3380, w: 140, kind: 'microwave', label: 'MICROWAVE' },
      { id: 'wings',     x: 3520, w: 120, kind: 'wings',     label: 'CHICKEN WINGS' },
      { id: 'plant',     x: 3640, w: 70,  kind: 'plant',     label: 'THE PLANT',
        flavor: ['Still alive. Somehow.', 'It has seen things.', 'Daley named it. I forgot the name.'] },

      // --- hall / outside ---
      { id: 'leash',     x: 3660, w: 60,  kind: 'leash',     label: 'LEASH', onWall: true },
      { id: 'door',      x: 3790, w: 130, kind: 'door',      label: 'FRONT DOOR' },
      { id: 'bin',       x: 4060, w: 80,  kind: 'bin',       label: 'BIN',
        flavor: ['Someone else\'s problem.', 'Bin day was Tuesday.'] },
      { id: 'lamp',      x: 4220, w: 50,  kind: 'lamp',      label: 'LAMPPOST',
        flavor: ['Rue knows this one well.', 'A landmark, apparently.',
                 'Every single time. Without fail.',
                 'She has strong feelings about this lamppost.'] },
      { id: 'tree',      x: 4450, w: 180, kind: 'tree',      label: 'THE TREE' },
      { id: 'bench',     x: 4650, w: 150, kind: 'bench',     label: 'BENCH',
        flavor: ['Sit later. Wings first.', 'Prime wing-eating bench.',
                 'Someone carved a K3 lyric into it.',
                 'Still damp. It is always damp.'] },
      { id: 'bike',      x: 4300, w: 110, kind: 'bike',      label: 'BIKE',
        flavor: ['Someone locked it to itself.', 'Flat since March.', 'Not mine. Definitely not mine.'] },
    ];
  }

  // ---------------------------------------------------------------
  // The day
  // ---------------------------------------------------------------
  /* ---------------------------------------------------------------
     The day is seeded off how many days have been played, so a given
     day is the same all the way through but no two days run the same:
     different order, different jobs, different video, different thing
     banging on the door at midnight.
     --------------------------------------------------------------- */
  function dayIndex() { return SG.save.data.simDays || 0; }

  /* xorshift, seeded through a proper avalanche hash and salted per
     stream. A plain LCG seeded with the day number correlates hard
     between neighbouring days - days 6 to 10 all drew the same night
     visitor - because the Nth value from seed N and seed N+1 barely
     differ. */
  function hash32(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) | 0;
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return n >>> 0;
  }

  function rngFor(seed, salt) {
    var s = hash32((seed | 0) * 0x9e3779b1 ^ ((salt || 0) * 0x85ebca6b)) || 1;
    return function () {
      s ^= (s << 13); s >>>= 0;
      s ^= (s >>> 17);
      s ^= (s << 5); s >>>= 0;
      return s / 4294967296;
    };
  }

  // Never the same two days running.
  function pickFresh(day, salt, arr) {
    var now = rpick(rngFor(day, salt), arr);
    if (day <= 0) return now;
    var prev = rpick(rngFor(day - 1, salt), arr);
    if (now !== prev) return now;
    var i = arr.indexOf(now);
    var step = 1 + Math.floor(rngFor(day, salt + 977)() * (arr.length - 1));
    return arr[(i + step) % arr.length];
  }
  function rpick(R, arr) { return arr[Math.floor(R() * arr.length) % arr.length]; }
  function rshuffle(R, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(R() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var ALL_TASKS = [
    { id: 'wake',   title: 'WAKE UP',           hint: 'Get out of bed',            target: 'bed' },
    { id: 'grab',   title: 'CASH TOPIT',        hint: 'Bread and cheese, get it out', target: 'counter' },
    { id: 'nuke',   title: 'CASH TOPIT',        hint: 'Melt it. Properly.',        target: 'microwave' },
    { id: 'hair',   title: 'THE HAIR',          hint: 'Hairspray. Obviously.',     target: 'hairspray' },
    { id: 'shirt',  title: 'PICK A FIT',        hint: 'Choose a Supreme tee',      target: 'rack' },
    { id: 'leash',  title: 'WALK RUE',          hint: 'Grab the leash',            target: 'leash' },
    { id: 'out',    title: 'WALK RUE',          hint: 'Out the front door',        target: 'door' },
    { id: 'tree',   title: 'WALK RUE',          hint: 'Rue has business at the tree', target: 'tree' },
    { id: 'home',   title: 'WALK RUE',          hint: 'Head back inside',          target: 'door' },
    { id: 'video',  title: "SANTI CAN'T",       hint: 'Film a video',              target: 'camera' },
    { id: 'wings',  title: 'CHICKEN WINGS',     hint: 'Destroy them',              target: 'wings' },
    { id: 'call',   title: 'CALL DALEY',        hint: 'Give her a ring',           target: 'phone' },
    { id: 'game',   title: 'ONE QUICK GAME',    hint: 'It is never one game',      target: 'console' },
    { id: 'plant',  title: 'THE PLANT',         hint: 'Water it before it dies',   target: 'plant' },
    { id: 'guitar', title: 'AZIZAM',            hint: 'The one song I know',       target: 'guitar' },
    { id: 'sleep',  title: 'GO TO SLEEP',       hint: 'Back to bed',               target: 'bed' },
  ];

  /* Jobs that must stay in order stick together in one block; the
     blocks themselves get shuffled. Waking up is always first and going
     to bed always last, and everything in between moves around. */
  var CHAINS = [
    ['grab', 'nuke'],
    ['leash', 'out', 'tree', 'home'],
    ['hair'], ['shirt'], ['video'], ['wings'], ['call'],
    ['game'], ['plant'], ['guitar'],
  ];
  var ALWAYS = ['hair', 'wings'];      // the two he would never skip
  var JOBS_PER_DAY = 8;                // blocks between waking and sleeping

  function taskById(id) {
    for (var i = 0; i < ALL_TASKS.length; i++) if (ALL_TASKS[i].id === id) return ALL_TASKS[i];
    return null;
  }

  function buildDay(R) {
    var must = [], rest = [];
    for (var i = 0; i < CHAINS.length; i++) {
      (CHAINS[i].length === 1 && ALWAYS.indexOf(CHAINS[i][0]) >= 0 ? must : rest).push(CHAINS[i]);
    }
    var chosen = must.concat(rshuffle(R, rest).slice(0, Math.max(0, JOBS_PER_DAY - must.length)));
    chosen = rshuffle(R, chosen);

    var plan = [taskById('wake')];
    for (var c = 0; c < chosen.length; c++) {
      for (var j = 0; j < chosen[c].length; j++) plan.push(taskById(chosen[c][j]));
    }
    plan.push(taskById('sleep'));
    return plan;
  }

  // ---- a different video every day -------------------------------
  var VIDEOS = [
    { t: 'MAKING CASH TOPIT (GONE WRONG)', l: '"Yo what is up, Santi here"', v: 12400 },
    { t: 'I ATE 100 CHICKEN WINGS',      l: '"This might end me"',        v: 84300 },
    { t: 'HOTTEST SAUCE IN BELGIUM',     l: '"I am not crying, you are"',  v: 41200 },
    { t: 'RATING MY GIRLFRIEND\'S FITS', l: '"She will not see this"',     v: 63800 },
    { t: 'MY DOG WILL NOT POOP',         l: '"Day nine. Nothing."',        v: 7100 },
    { t: 'K3 SONGS RANKED (BRAVE)',      l: '"I stand by every word"',     v: 155000 },
    { t: '24H IN A MUSHROOM HOUSE',      l: '"Do not ask why"',            v: 22600 },
    { t: 'TEACHING RUE TO SKATEBOARD',   l: '"She is a natural"',          v: 9400 },
    { t: 'I TRIED DALEY\'S COOKING',     l: '"For legal reasons, no"',     v: 38900 },
    { t: 'BUILDING A PC OUT OF WAFFLES', l: '"It boots. Somehow."',        v: 71500 },
  ];

  /* Something bangs on the door every night, and it is not always
     Daley. */
  var NIGHTS = [
    { who: 'daley', lines: [
      { w: 'daley', t: 'SANTI. SANTI WAKE UP.' },
      { w: 'daley', t: 'I clogged the toilet.' },
      { w: 'santi', t: 'Lap.' },
    ] },
    { who: 'daley', lines: [
      { w: 'daley', t: 'SANTI. Are you asleep?' },
      { w: 'santi', t: 'Yes.' },
      { w: 'daley', t: 'Good. I ate your last wing.' },
      { w: 'santi', t: 'LAP.' },
    ] },
    { who: 'rue', lines: [
      { w: 'rue',   t: '*scratching at the door*' },
      { w: 'santi', t: 'Rue. It is half two.' },
      { w: 'rue',   t: '*now she wants to poop*' },
      { w: 'santi', t: 'Lap.' },
    ] },
    { who: 'rue', lines: [
      { w: 'rue',   t: '*jumps on the bed*' },
      { w: 'rue',   t: '*takes the entire duvet*' },
      { w: 'santi', t: 'That is my duvet, Rue.' },
      { w: 'rue',   t: '*it is her duvet now*' },
    ] },
    { who: 'krampus', lines: [
      { w: 'krampus', t: 'HO. HO. NO.' },
      { w: 'santi',   t: 'It is not even December.' },
      { w: 'krampus', t: 'I WORK YEAR ROUND NOW.' },
      { w: 'krampus', t: 'THE LIST SAYS: CASH TOPIT. AGAIN.' },
      { w: 'santi',   t: 'Lap.' },
    ] },
    { who: 'plop', lines: [
      { w: 'plop',  t: 'Hallo Santi!' },
      { w: 'santi', t: 'Daley? Why are you wearing a red hat?' },
      { w: 'plop',  t: 'I am not Daley. I am Plop.' },
      { w: 'santi', t: 'You look EXACTLY like Daley.' },
      { w: 'plop',  t: 'Everyone says that. I hate it here.' },
    ] },
    { who: 'k3', lines: [
      { w: 'k3',    t: '*three-part harmony, outside the window*' },
      { w: 'santi', t: 'It is 3am.' },
      { w: 'k3',    t: '*key change*' },
      { w: 'santi', t: 'Okay that one is actually good.' },
    ] },
    { who: 'daley', lines: [
      { w: 'daley', t: 'Santi. Wake up. Emergency.' },
      { w: 'santi', t: 'What. WHAT.' },
      { w: 'daley', t: 'I forgot what I was going to say.' },
      { w: 'santi', t: 'Lap.' },
    ] },
  ];

  // ---- the poster above the bed changes -------------------------
  var POSTERS = [
    { label: "SANTI CAN'T", sub: '1.2M', bg: '#2a2352', ink: '#ffd400' },
    { label: 'K3',          sub: 'TOUR', bg: '#7a2a6a', ink: '#ffd6f2' },
    { label: 'WINGS',       sub: 'HOT',  bg: '#5a2018', ink: '#ff9a4a' },
    { label: 'ANTWERP',     sub: "'T STAD", bg: '#1d3b5c', ink: '#9ad4ff' },
    { label: 'RUE',         sub: 'GOOD DOG', bg: '#3a2e22', ink: '#f0d8a8' },
  ];

  /* Santi on the subject of his dog, rather than a description of what
     the dog is doing. */
  var RUE_LINES = [
    'She has one job. She does not know what it is.',
    'Rue. We have talked about this.',
    'Nine kilos of pure opinion.',
    'She has never come when called. Not once. Not ever.',
    'I would take a bullet for her. She would not.',
    'That face has cost me a serious amount of money.',
    'She thinks she is a big dog. She is not a big dog.',
    'People say she looks like me. Rude to both of us.',
    'She barks at the wind. Only the wind. Never at burglars.',
    'Whole personality, and none of it is obedience.',
    'Daley says she is MY dog when she does this.',
    'If she could talk she would only complain.',
    'She has eaten things I am not allowed to talk about.',
    'Lap. She is doing the thing again.',
  ];

  var WINGS_PER_TASK = 30;     // ~12 tasks a day at the shared ~130/min

  // `ink` is the wordmark colour and must contrast with `box`.
  var SHIRTS = [
    { name: 'CLASSIC RED', shirt: '#e8202a', box: '#ffffff', ink: '#e8202a' },
    { name: 'PURPLE',      shirt: '#7c4dff', box: '#e8202a', ink: '#ffffff' },
    { name: 'FOREST',      shirt: '#2f7d4f', box: '#ffd400', ink: '#17120a' },
  ];

  // ---------------------------------------------------------------
  function reset() {
    // Each choice draws from its own stream, so the order of the day
    // does not decide which video he films.
    var day = dayIndex();
    st = {
      day: day + 1,
      plan: buildDay(rngFor(day, 101)),
      video: pickFresh(day, 211, VIDEOS),
      night: pickFresh(day, 337, NIGHTS),
      poster: pickFresh(day, 449, POSTERS),
      rueLines: rshuffle(rngFor(day, 563), RUE_LINES),
      rueSaid: 0,
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
      mirrorScare: 0,
      overlay: null,                          // 'shirt' | 'call' | 'video' | 'nuke' | 'spray' | 'wings'
      ov: {},                                 // overlay working state
      paused: false,
      musicPaused: false,      // what the music channel was last told
      y: 0,                    // height above the floor
      vy: 0,
      grounded: true,
      jumpHeld: false,         // so holding the pad doesn't auto-hop
      eHeld: false,            // same, for the interact key
      sawTouch: false,         // a finger has been on the glass
      flash: 0,
      rue: { x: 3660, y: 0, follow: false, phase: 0 },
    };
  }

  function task() { return st.done ? null : st.plan[st.taskIndex]; }
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
    if (st.taskIndex >= st.plan.length) {
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

    if (o.id === 'sink') { lookInMirror(); return; }

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
        say(SG.pick(['Cash topit. Let us go.', 'Bread. Cheese. A plan.', 'The good stuff.']));
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
        say(SG.pick([
          "Dumb dog won't poop.",
          "Come on Rue. One poop. That's all.",
          "Twenty minutes. Nothing. Dumb dog won't poop.",
        ]));
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

      case 'game':
        openOverlay('game', { t: 0, stage: 0 });
        break;

      case 'plant':
        st.plantWatered = true;
        say(SG.pick([
          'It lives another day.',
          'Water. The one thing it asks for.',
          'Daley would have let it die.',
        ]));
        completeTask();
        break;

      case 'guitar':
        openOverlay('guitar', { strums: 0 });
        break;

      case 'sleep':
        st.inBed = true;
        openOverlay('sleep', { t: 0, stage: 0, line: 0 });
        break;
    }
  }

  /* Rue is pokeable whenever she is out with him, and says something
     different each time until she runs out of opinions. */
  function pokeRue() {
    var line = st.rueLines[st.rueSaid % st.rueLines.length];
    st.rueSaid++;
    say(line);
    SG.audio.play('tap');
  }

  var MIRROR_NICE = [
    'Devastatingly handsome. As usual.',
    'The hair is doing something today.',
    'Genuinely, who is that guy.',
    'Not one bad angle. Not one.',
    'Certified. Absolutely certified.',
  ];

  /* Most of the time the mirror agrees with him. Occasionally it does
     not show him at all. */
  function lookInMirror() {
    if (Math.random() < 0.35) {
      st.mirrorScare = 1.7;
      SG.shake(11);
      SG.audio.play('crash');
      say(SG.pick(['...', 'Nope. Nope nope nope.', 'Lap. LAP.', 'That was not me.']));
    } else {
      st.mirrorScare = 0;
      SG.audio.play('tap');
      say(MIRROR_NICE);
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
    if (st.mirrorScare > 0) st.mirrorScare -= dt;

    // Follow the pause with the music, however it was set - the tap
    // below, the pause menu, or onBlur when the app is backgrounded.
    if (st.paused !== st.musicPaused) {
      st.musicPaused = st.paused;
      SG.audio.music.setPaused(st.paused);
    }

    if (st.paused) { handlePauseTaps(); return; }

    if (SG.input.tappedRect(pauseRect()) && !st.done) {
      st.paused = true;
      SG.input.releaseAll();     // a way out of a touch that never ended
      SG.audio.play('back');
      return;
    }

    if (st.done) { handleDoneTaps(); return; }
    if (st.overlay) { updateOverlay(dt); return; }

    handleWorldTaps();

    // Jump: the engine turns Space / ArrowUp / W into an 'up' swipe on
    // keydown and swallows auto-repeat, so this is edge-triggered.
    if (SG.input.takeSwipe('up')) doJump();

    /* E interacts with whatever is in reach - the same useObject() a
       click goes through, so clicking still works exactly as it did.
       `keys` stays true for as long as the key is down, so compare
       against last frame or one press runs every frame. */
    var eDown = !!SG.input.keys.KeyE;
    if (eDown && !st.eHeld) {
      var near = reachObject();
      if (near) useObject(near);
    }
    st.eHeld = eDown;

    // The E prompt is meaningless on a phone, where you tap the thing.
    if (!st.sawTouch) {
      for (var pid in SG.input.pointers) {
        if (SG.input.pointers[pid].type === 'touch') { st.sawTouch = true; break; }
      }
    }

    var rc = controlRects();
    var padJump = heldIn(rc.jump);
    if (padJump && !st.jumpHeld) doJump();
    st.jumpHeld = padJump;

    var padLeft = heldIn(rc.left), padRight = heldIn(rc.right);

    // keyboard for desktop
    var k = SG.input.keys;
    if (padLeft || padRight) { st.targetX = null; st.pending = null; st.vx = (padRight ? 1 : -1) * WALK_SPEED; }
    else if (k.ArrowLeft || k.KeyA) { st.targetX = null; st.pending = null; st.vx = -WALK_SPEED; }
    else if (k.ArrowRight || k.KeyD) { st.targetX = null; st.pending = null; st.vx = WALK_SPEED; }
    else if (st.targetX === null) st.vx = 0;

    if (!st.grounded) {
      st.vy -= JUMP_G * dt;
      st.y += st.vy * dt;
      if (st.y <= 0) { st.y = 0; st.vy = 0; st.grounded = true; }
    }

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

  /* Thumb pads. Jump bottom left, walk bottom right, as asked. Lifted
     well clear of the bottom edge: on an iPhone that strip is the
     home-indicator gesture area and a thumb parked there has its press
     taken by the system. They also clear the pause button, which sits
     lower on the right. */
  function controlRects() {
    return {
      jump:  { x: 30, y: SG.H - 132, w: 86, h: 78 },
      left:  { x: SG.W - 216, y: SG.H - 132, w: 78, h: 78 },
      right: { x: SG.W - 128, y: SG.H - 132, w: 78, h: 78 },
    };
  }

  function heldIn(r) {
    var ps = SG.input.pointers;
    for (var id in ps) {
      var p = ps[id];
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return true;
    }
    return false;
  }

  function onControls(x, y) {
    var rc = controlRects();
    for (var k in rc) {
      var r = rc[k];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    }
    return false;
  }

  function inReach(o) { return Math.abs(o.x - st.x) <= REACH + o.w / 2; }

  /* What E would act on: the task's own target if he is standing at it,
     otherwise the nearest thing in reach. Preferring the target means E
     always moves the day along when it can, rather than poking the lamp
     that happens to be a few pixels nearer. */
  function reachObject() {
    var tk = task();
    if (tk) {
      var t = obj(tk.target);
      if (t && inReach(t)) return t;
    }
    var best = null, bestD = 1e9;
    for (var i = 0; i < st.objects.length; i++) {
      var o = st.objects[i];
      if (!inReach(o)) continue;
      var d = Math.abs(o.x - st.x);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  function doJump() {
    if (!st.grounded || st.done || st.paused || st.overlay) return;
    st.grounded = false;
    st.inBed = false;
    st.vy = JUMP_V;
    SG.audio.play('jump');
  }

  function handleWorldTaps() {
    var tap;
    while ((tap = SG.input.takeTap())) {
      if (tap.x < 0) continue;
      // A press on a pad also lands as a tap when the finger lifts;
      // without this he walks to wherever the pad happens to be.
      if (onControls(tap.x, tap.y)) continue;
      var wx = tap.x + st.cam;

      // Rue first - she is standing in front of the furniture, and
      // she is the thing you most want to poke.
      if (st.rue.follow && Math.abs(wx - st.rue.x) < 46 && tap.y > FLOOR_Y - 90) {
        if (Math.abs(st.rue.x - st.x) <= REACH + 40) pokeRue();
        else { st.targetX = SG.clamp(st.rue.x - 50, 40, WORLD_W - 60); st.pending = null; }
        continue;
      }

      /* Object hit, with a generous band so it is easy on a phone.
         Takes the NEAREST centre rather than the first in the list: a
         small thing standing in front of a big one (the plant by the
         counter, the speaker by the couch) is otherwise unreachable,
         because the big one's band swallows it. */
      var hit = null, bestD = 1e9;
      for (var i = 0; i < st.objects.length; i++) {
        var o = st.objects[i];
        var oy = o.onWall ? FLOOR_Y - 210 : FLOOR_Y - 90;
        if (wx >= o.x - o.w / 2 - 12 && wx <= o.x + o.w / 2 + 12 &&
            tap.y > oy - 80 && tap.y < FLOOR_Y + 40) {
          var od = Math.abs(wx - o.x);
          if (od < bestD) { bestD = od; hit = o; }
        }
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
        if (o.done && SG.input.takeTap()) {
          say(SG.pick(['Warm. Melty. Correct.', 'Cash topit. Every single day.', 'That is the one.']));
          closeOverlay(true);
        }
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
          o.views = Math.min(st.video.v, Math.floor(o.t * st.video.v * 0.72));
          if (o.t > 1.8 && SG.input.takeTap()) {
            st.videoMade = true;
            say(SG.pick(['Uploaded. Lap if it flops.', 'That is going off.', 'Thumbnail took longer than the video.']));
            closeOverlay(true);
          }
        }
        break;


      case 'game':
        o.t += dt;
        if (o.stage === 0 && o.t > 1.6) { o.stage = 1; o.t = 0; SG.audio.play('crash'); }
        else if (o.stage === 1 && o.t > 0.6 && SG.input.takeTap()) {
          say(SG.pick(['One more. Definitely the last one.', 'Lap. Third place.', 'That was lag. Genuinely.']));
          closeOverlay(true);
        }
        break;

      case 'guitar':
        if (SG.input.takeTap()) {
          o.strums++;
          SG.audio.play(['point', 'wing', 'pop'][o.strums % 3]);
          if (o.strums >= 3) {
            say(SG.pick([
              'Azizam. Again.',
              'It is always Azizam.',
              'I do the Ed Sheeran loop bit and everything.',
              'Word perfect. Chords approximate.',
            ]));
            closeOverlay(true);
          }
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

      // Lights out, and then the door goes.
      case 'sleep':
        o.t += dt;
        if (o.stage === 0) {
          if (o.t > 1.5) { o.stage = 1; o.t = 0; o.line = 0; SG.audio.play('back'); SG.shake(6); }
        } else if (o.stage === 1) {
          if (SG.input.takeTap()) {
            o.line++;
            if (o.line === st.night.lines.length - 1) SG.audio.play('lap');
            else SG.audio.play('tap');
            if (o.line >= st.night.lines.length) { o.stage = 2; o.t = 0; }
          }
        } else {
          if (o.t > 1.2) closeOverlay(true);
        }
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
    if (!st.done && !st.paused && !st.overlay) {
      drawControls(g);
      drawInteractPrompt(g, cam);
    }

    if (st.bubble) drawBubble(g, cam);
    if (st.overlay) drawOverlay(g);
    if (st.paused) drawPaused(g);
    if (st.done) drawDone(g);
  }

  /* Fixed to the screen rather than floating over him. When he is in
     reach of a thing he is standing *at* it, which is exactly where the
     task guide already puts its arrow and its label - a prompt over his
     head landed on top of both. Down here it never collides, and it is
     in the same place every time. */
  function drawInteractPrompt(g, cam) {
    if (st.sawTouch) return;
    var o = reachObject();
    if (!o) return;

    var label = 'INTERACT';
    g.font = '900 14px ' + SG.FONT;
    var tw = g.measureText(label).width;
    g.font = '900 11px ' + SG.FONT;
    var sw = g.measureText(o.label).width + 10;

    var r = 15;
    var w = 12 + r * 2 + 9 + tw + 8 + sw + 14;
    var h = 40;
    var x = SG.W / 2 - w / 2;
    var y = SG.H - 112;

    SG.ui.panel(g, x, y, w, h, {
      r: 20, fill: 'rgba(10,12,26,0.86)', border: '#ffd400', borderWidth: 2.5,
    });

    var kx = x + 12 + r, ky = y + h / 2;
    g.fillStyle = '#ffd400';
    g.beginPath();
    g.arc(kx, ky, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1a1030';
    g.lineWidth = 2;
    g.stroke();
    SG.ui.text(g, 'E', kx, ky + 1, { size: 16, color: '#1a1030', shadow: false });

    SG.ui.text(g, label, kx + r + 9, ky + 1, {
      size: 14, color: '#fff', align: 'left', shadow: false,
    });
    // Name it: "interact" alone is ambiguous in a room full of things.
    SG.ui.text(g, '· ' + o.label, kx + r + 9 + tw + 8, ky + 1, {
      size: 11, color: 'rgba(255,214,80,0.8)', align: 'left', shadow: false,
    });
  }

  function drawControls(g) {
    var rc = controlRects();
    pad(g, rc.jump, 'up', heldIn(rc.jump));
    pad(g, rc.left, 'left', heldIn(rc.left));
    pad(g, rc.right, 'right', heldIn(rc.right));
  }

  function pad(g, r, dir, on) {
    var cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    g.save();
    g.fillStyle = on ? 'rgba(176,112,255,0.55)' : 'rgba(10,12,26,0.42)';
    SG.roundRect(g, r.x, r.y, r.w, r.h, 16);
    g.fill();
    g.strokeStyle = on ? '#d9b6ff' : 'rgba(255,255,255,0.3)';
    g.lineWidth = 2.5;
    g.stroke();

    g.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.78)';
    var a = 15;
    g.beginPath();
    if (dir === 'up') {
      g.moveTo(cx, cy - a); g.lineTo(cx + a, cy + a * 0.68); g.lineTo(cx - a, cy + a * 0.68);
    } else if (dir === 'left') {
      g.moveTo(cx - a, cy); g.lineTo(cx + a * 0.68, cy - a); g.lineTo(cx + a * 0.68, cy + a);
    } else {
      g.moveTo(cx + a, cy); g.lineTo(cx - a * 0.68, cy - a); g.lineTo(cx - a * 0.68, cy + a);
    }
    g.closePath();
    g.fill();
    g.restore();
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

      // Different poster on the wall every day.
      case 'poster': {
        var po = st.poster;
        g.fillStyle = po.bg;
        SG.roundRect(g, x - 55, base - 300, 110, 140, 5); g.fill();
        g.strokeStyle = po.ink; g.lineWidth = 3;
        SG.roundRect(g, x - 55, base - 300, 110, 140, 5); g.stroke();
        var words = po.label.split(' ');
        if (words.length > 1) {
          SG.ui.text(g, words[0], x, base - 262, { size: 17, color: '#fff', shadow: false });
          SG.ui.text(g, words.slice(1).join(' '), x, base - 240, { size: 17, color: po.ink, shadow: false });
        } else {
          SG.ui.text(g, po.label, x, base - 250, { size: 20, color: '#fff', shadow: false });
        }
        SG.ui.text(g, po.sub, x, base - 214, { size: 12, color: po.ink, shadow: false });
        SG.art.drawWing(g, x, base - 188, 1.3, -0.3);
        break;
      }

      case 'guitar':
        g.strokeStyle = '#4a3218'; g.lineWidth = 7;
        g.beginPath(); g.moveTo(x, base - 42); g.lineTo(x + 6, base - 128); g.stroke();
        g.fillStyle = '#b5762e';
        g.beginPath(); g.ellipse(x - 4, base - 26, 24, 30, 0.12, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(40,22,8,0.6)'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#2a1a0c';
        g.beginPath(); g.arc(x - 2, base - 30, 8, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
        for (var gs = 0; gs < 4; gs++) {
          g.beginPath(); g.moveTo(x - 6 + gs * 4, base - 4); g.lineTo(x + 2 + gs * 3, base - 126); g.stroke();
        }
        break;

      case 'console':
        g.fillStyle = '#22283a';
        SG.roundRect(g, x - 34, base - 34, 68, 34, 6); g.fill();
        g.fillStyle = '#4dd47a';
        g.fillRect(x - 26, base - 26, 30, 4);
        g.fillStyle = '#3a4260';                       // controller
        SG.roundRect(g, x - 20, base - 62, 40, 22, 9); g.fill();
        g.fillStyle = '#1d2233';
        g.beginPath(); g.arc(x - 9, base - 51, 5, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(x + 9, base - 51, 5, 0, Math.PI * 2); g.fill();
        break;

      case 'stereo':
        g.fillStyle = '#2a2233';
        SG.roundRect(g, x - 26, base - 96, 52, 96, 7); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2;
        SG.roundRect(g, x - 26, base - 96, 52, 96, 7); g.stroke();
        var thump = 1 + Math.sin(st.t * 9) * 0.07;
        g.fillStyle = '#141018';
        g.beginPath(); g.arc(x, base - 66, 17 * thump, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#4a4258';
        g.beginPath(); g.arc(x, base - 66, 7 * thump, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#141018';
        g.beginPath(); g.arc(x, base - 26, 11 * thump, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ff8ad8';
        SG.ui.text(g, 'K3', x, base - 106, { size: 13, color: '#ff8ad8', shadow: false });
        break;

      case 'plant':
        g.fillStyle = '#a3572e';
        g.beginPath();
        g.moveTo(x - 20, base - 34); g.lineTo(x + 20, base - 34);
        g.lineTo(x + 14, base); g.lineTo(x - 14, base);
        g.closePath(); g.fill();
        g.fillStyle = '#3f8f43';
        for (var lf = 0; lf < 5; lf++) {
          var a2 = -Math.PI / 2 + (lf - 2) * 0.42;
          g.save();
          g.translate(x, base - 34);
          g.rotate(a2 + Math.sin(st.t * 1.2 + lf) * 0.05);
          g.beginPath();
          g.ellipse(0, -26, 9, 26, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        }
        break;

      case 'bike':
        g.strokeStyle = '#2c3244'; g.lineWidth = 4;
        g.beginPath(); g.arc(x - 26, base - 22, 21, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(x + 26, base - 22, 21, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#4dd47a'; g.lineWidth = 5;
        g.beginPath();
        g.moveTo(x - 26, base - 22); g.lineTo(x - 2, base - 22);
        g.lineTo(x + 10, base - 54); g.lineTo(x + 26, base - 22);
        g.moveTo(x - 2, base - 22); g.lineTo(x + 10, base - 54);
        g.stroke();
        g.strokeStyle = '#2c3244'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(x + 10, base - 54); g.lineTo(x + 22, base - 62); g.stroke();
        g.fillStyle = '#2c3244';
        SG.roundRect(g, x - 12, base - 60, 20, 7, 3); g.fill();
        break;

      case 'sink':
        g.fillStyle = '#cfd8e8';
        SG.roundRect(g, x - 60, base - 96, 120, 30, 6); g.fill();
        g.fillStyle = '#9aa6bd';
        g.fillRect(x - 14, base - 66, 28, 66);

        var mx = x - 46, my = base - 220, mw = 92, mh = 106;
        var scared = st.mirrorScare > 0;
        g.fillStyle = scared ? '#0d0812' : '#e6edf7';
        SG.roundRect(g, mx, my, mw, mh, 6); g.fill();

        if (scared) {
          // Something that is not Santi, looking back out.
          g.save();
          g.beginPath();
          SG.roundRect(g, mx, my, mw, mh, 6);
          g.clip();
          var jitter = Math.sin(st.t * 60) * 2.5;
          SG.art.drawHead(g, x + jitter, my + mh * 0.56, 40, 'dark', 'dark');
          g.fillStyle = 'rgba(150,10,10,0.3)';
          g.fillRect(mx, my, mw, mh);
          g.fillStyle = '#ff2020';                   // eyes
          g.beginPath();
          g.arc(x - 13 + jitter, my + mh * 0.5, 5, 0, Math.PI * 2);
          g.arc(x + 13 + jitter, my + mh * 0.5, 5, 0, Math.PI * 2);
          g.fill();
          g.restore();
          // cracks
          g.strokeStyle = 'rgba(255,255,255,0.6)';
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(mx + 20, my); g.lineTo(mx + 44, my + 46); g.lineTo(mx + 26, my + mh);
          g.moveTo(mx + 44, my + 46); g.lineTo(mx + mw, my + 30);
          g.moveTo(mx + 44, my + 46); g.lineTo(mx + 70, my + mh);
          g.stroke();
        } else {
          g.fillStyle = 'rgba(255,255,255,0.55)';    // ordinary glare
          g.beginPath();
          g.moveTo(mx + 12, my + mh); g.lineTo(mx + 46, my); g.lineTo(mx + 66, my); g.lineTo(mx + 32, my + mh);
          g.closePath(); g.fill();
        }
        g.strokeStyle = scared ? '#8a2030' : '#8fa0bd';
        g.lineWidth = 3;
        SG.roundRect(g, mx, my, mw, mh, 6); g.stroke();
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
    SG.art.boxLogo(g, x, y + h * 0.56, w * 0.66, 'SANTI', kit.box, kit.ink);
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

    // A shadow left on the floor, or the jump reads as the whole room
    // sliding down rather than him going up.
    if (st.y > 1) {
      var f = SG.clamp(st.y / 110, 0, 1);
      g.fillStyle = 'rgba(0,0,0,' + (0.3 - f * 0.2) + ')';
      g.beginPath();
      g.ellipse(x, FLOOR_Y + 2, 34 * (1 - f * 0.35), 9 * (1 - f * 0.35), 0, 0, Math.PI * 2);
      g.fill();
    }

    g.save();
    if (st.facing < 0) { g.translate(x * 2, 0); g.scale(-1, 1); }
    SG.art.drawSanti(g, x, y - st.y, SANTI_H, st.walkPhase, {
      shirt: st.shirt.shirt,
      boxColor: st.shirt.box,
      boxInk: st.shirt.ink,
      pants: '#232a46',
      run: st.grounded ? (moving ? 1 : 0.08) : 0.3,
      bob: moving && st.grounded,
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
      SG.ui.text(g, 'DAY ' + st.day + '  ·  TASK ' + (st.taskIndex + 1) + '/' + st.plan.length, 30, 32, {
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
        SG.ui.text(g, 'CASH TOPIT', CX, 156, { size: 26, color: '#ffd400', shadow: false });
        SG.ui.text(g, 'IN THE MICROWAVE', CX, 180, {
          size: 12, color: 'rgba(255,255,255,0.5)', shadow: false,
        });
        var frac = SG.clamp(o.t / o.dur, 0, 1);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        SG.roundRect(g, CX - 140, 210, 280, 22, 11); g.fill();
        g.fillStyle = o.done ? '#4dd47a' : '#ffb02e';
        SG.roundRect(g, CX - 140, 210, 280 * frac, 22, 11); g.fill();
        // cash topit, melting
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
          SG.ui.text(g, st.video.l, CX, 358, {
            size: 16, color: 'rgba(255,255,255,0.85)', weight: '700',
            font: '"Avenir Next", system-ui, sans-serif', shadow: false,
          });
        } else {
          SG.ui.text(g, "SANTI CAN'T", CX, 150, { size: 26, color: '#ffd400', shadow: false });
          SG.ui.text(g, st.video.t, CX, 182, {
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


      case 'game': {
        SG.ui.panel(g, CX - 240, 110, 480, 300);
        SG.ui.text(g, 'ONE QUICK GAME', CX, 156, { size: 22, color: '#4dd47a', shadow: false });
        g.fillStyle = '#0d1220';
        SG.roundRect(g, CX - 170, 180, 340, 150, 8); g.fill();
        if (o.stage === 0) {
          for (var pl = 0; pl < 5; pl++) {
            var px2 = CX - 140 + ((st.t * 70 + pl * 74) % 300);
            g.fillStyle = ['#4dd47a', '#e8202a', '#ffd400', '#4aa8ff', '#b070ff'][pl];
            SG.roundRect(g, px2, 214 + (pl % 3) * 34, 14, 22, 3); g.fill();
          }
          SG.ui.text(g, String(Math.max(1, 12 - Math.floor(o.t * 7))) + ' LEFT', CX, 352, {
            size: 15, color: 'rgba(255,255,255,0.6)', shadow: false,
          });
        } else {
          SG.ui.text(g, '3rd', CX, 236, { size: 46, color: '#ff5a4a', shadow: false });
          SG.ui.text(g, 'THAT WAS LAG', CX, 284, { size: 15, color: 'rgba(255,255,255,0.6)', shadow: false });
          SG.ui.text(g, 'TAP TO STOP AT ONE', CX, 352, { size: 14, color: '#4dd47a', shadow: false });
        }
        break;
      }

      case 'guitar': {
        SG.ui.panel(g, CX - 210, 130, 420, 250);
        SG.ui.text(g, 'AZIZAM', CX, 172, { size: 24, color: '#b5762e', shadow: false });
        SG.ui.text(g, 'ED SHEERAN', CX, 194, { size: 12, color: 'rgba(255,255,255,0.45)', shadow: false });
        // Sized to clear the title above and the prompt below.
        var strum = Math.sin(st.t * 14) * (o.strums ? 5 : 1);
        g.save();
        g.translate(CX, 308);
        g.rotate(0.1 + strum * 0.01);
        g.strokeStyle = '#4a3218'; g.lineWidth = 9;
        g.beginPath(); g.moveTo(2, -30); g.lineTo(10, -84); g.stroke();
        g.fillStyle = '#3a2612';
        SG.roundRect(g, 5, -94, 12, 14, 3); g.fill();
        g.fillStyle = '#b5762e';
        g.beginPath(); g.ellipse(0, 0, 30, 36, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(40,22,8,0.6)'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#2a1a0c';
        g.beginPath(); g.arc(0, -3, 11, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.3;
        for (var st2 = 0; st2 < 4; st2++) {
          g.beginPath();
          g.moveTo(-7 + st2 * 4.5 + strum, 28); g.lineTo(4 + st2 * 3.5 + strum, -84);
          g.stroke();
        }
        g.restore();
        SG.ui.text(g, 'TAP TO STRUM   ' + o.strums + ' / 3', CX, 356, { size: 16, color: '#fff', shadow: false });
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
        if (o.stage === 0) {
          g.fillStyle = 'rgba(0,0,0,' + SG.clamp(o.t / 1.5, 0, 1) * 0.9 + ')';
          g.fillRect(0, 0, SG.W, SG.H);
          SG.ui.text(g, 'ZzZ', CX, SG.H / 2, {
            size: 40, color: 'rgba(255,255,255,' + SG.clamp(o.t, 0, 1) * 0.8 + ')', shadow: false,
          });
        } else if (o.stage === 1) {
          g.fillStyle = 'rgba(0,0,0,0.9)';
          g.fillRect(0, 0, SG.W, SG.H);
          var ln = st.night.lines[Math.min(o.line, st.night.lines.length - 1)];
          var isS = ln.w === 'santi';
          var sp = SPEAKERS[ln.w] || SPEAKERS.daley;
          // whoever it is, they burst in, so they get a shove of movement
          var shove = isS ? 0 : Math.sin(st.t * 22) * 3;
          nightFace(g, ln.w, CX + shove, 182, 104);
          SG.ui.text(g, sp.name, CX, 254, { size: 15, color: sp.color, shadow: false });
          SG.ui.panel(g, CX - 230, 282, 460, 68, {
            fill: sp.fill, r: 12, border: sp.border,
          });
          SG.ui.text(g, ln.t, CX, 316, {
            size: 18, color: '#fff', weight: '700',
            font: '"Avenir Next", system-ui, sans-serif', shadow: false,
          });
          SG.ui.text(g, 'TAP TO CONTINUE', CX, 378, { size: 12, color: 'rgba(255,255,255,0.4)', shadow: false });
        } else {
          g.fillStyle = '#000';
          g.fillRect(0, 0, SG.W, SG.H);
          SG.ui.text(g, 'ZzZ', CX, SG.H / 2, { size: 40, color: 'rgba(255,255,255,0.6)', shadow: false });
        }
        break;
      }
    }
  }

  var SPEAKERS = {
    santi:   { name: 'SANTI',   color: '#ffd400', fill: 'rgba(255,214,80,0.14)',  border: 'rgba(255,214,80,0.5)' },
    daley:   { name: 'DALEY',   color: '#ff6b8a', fill: 'rgba(255,107,138,0.16)', border: 'rgba(255,107,138,0.6)' },
    rue:     { name: 'RUE',     color: '#f0c088', fill: 'rgba(240,192,136,0.14)', border: 'rgba(240,192,136,0.55)' },
    krampus: { name: 'KRAMPUS', color: '#ff5a3c', fill: 'rgba(255,90,60,0.16)',   border: 'rgba(255,90,60,0.6)' },
    plop:    { name: 'PLOP',    color: '#ff8a4a', fill: 'rgba(255,138,74,0.15)',  border: 'rgba(255,138,74,0.6)' },
    k3:      { name: 'K3',      color: '#ff8ad8', fill: 'rgba(255,138,216,0.15)', border: 'rgba(255,138,216,0.6)' },
  };

  /* Whoever turned up tonight. Santi, Daley and Rue have real art; the
     rest are drawn, since a bald wizard is not the only thing in this
     project that has to be invented from shapes. */
  function nightFace(g, who, cx, cy, size) {
    var key = who === 'santi' ? 'santi' : who === 'daley' ? 'daley'
            : who === 'rue' ? 'rue-face' : null;
    if (key && SG.art.faces[key]) {
      g.drawImage(SG.art.faces[key], cx - size / 2, cy - size / 2, size, size);
      return;
    }
    var r = size * 0.42;
    g.save();
    g.translate(cx, cy);
    if (who === 'krampus') {
      g.fillStyle = '#4a2318';
      g.beginPath(); g.arc(0, 4, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2e1610';                          // horns
      [-1, 1].forEach(function (d) {
        g.beginPath();
        g.moveTo(d * r * 0.55, -r * 0.7);
        g.quadraticCurveTo(d * r * 1.25, -r * 1.5, d * r * 0.8, -r * 1.75);
        g.quadraticCurveTo(d * r * 0.85, -r * 1.1, d * r * 0.3, -r * 0.55);
        g.closePath(); g.fill();
      });
      g.fillStyle = '#ffd24a';
      g.beginPath(); g.ellipse(-r * 0.34, 0, r * 0.17, r * 0.13, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(r * 0.34, 0, r * 0.17, r * 0.13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a0c08';
      g.beginPath(); g.arc(-r * 0.34, 0, r * 0.07, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(r * 0.34, 0, r * 0.07, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8555a';                          // tongue
      g.beginPath(); g.ellipse(0, r * 0.62, r * 0.16, r * 0.32, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      for (var t2 = -2; t2 <= 2; t2++) {
        g.beginPath();
        g.moveTo(t2 * r * 0.2 - r * 0.07, r * 0.3);
        g.lineTo(t2 * r * 0.2 + r * 0.07, r * 0.3);
        g.lineTo(t2 * r * 0.2, r * 0.52);
        g.closePath(); g.fill();
      }
    } else if (who === 'plop') {
      g.fillStyle = '#e8b48c';                          // face
      g.beginPath(); g.arc(0, r * 0.1, r * 0.72, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fdfdfd';                          // beard
      g.beginPath();
      g.arc(0, r * 0.42, r * 0.72, 0.1, Math.PI - 0.1);
      g.fill();
      g.fillStyle = '#d63a2e';                          // the red hat
      g.beginPath();
      g.moveTo(-r * 0.95, -r * 0.28);
      g.quadraticCurveTo(0, -r * 1.85, r * 0.95, -r * 0.28);
      g.closePath(); g.fill();
      g.fillStyle = '#1a1020';
      g.beginPath(); g.arc(-r * 0.26, 0, r * 0.09, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(r * 0.26, 0, r * 0.09, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8907a';
      g.beginPath(); g.arc(0, r * 0.24, r * 0.15, 0, Math.PI * 2); g.fill();
    } else {
      // K3: three of them, in a row
      var cols = ['#ffd24a', '#8a4a2a', '#3a2a1a'];
      for (var i = 0; i < 3; i++) {
        var ox = (i - 1) * r * 0.72;
        g.fillStyle = cols[i];
        g.beginPath(); g.arc(ox, -r * 0.18, r * 0.44, Math.PI, 0); g.fill();
        g.fillStyle = '#e8b48c';
        g.beginPath(); g.arc(ox, 0, r * 0.34, 0, Math.PI * 2); g.fill();
        g.fillStyle = cols[i];
        g.beginPath(); g.arc(ox, -r * 0.2, r * 0.36, Math.PI, 0); g.fill();
        g.fillStyle = '#1a1020';
        g.beginPath(); g.arc(ox - r * 0.12, r * 0.02, r * 0.05, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(ox + r * 0.12, r * 0.02, r * 0.05, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#a0343a';
        g.lineWidth = Math.max(1.4, r * 0.05);
        g.beginPath(); g.arc(ox, r * 0.1, r * 0.12, 0.2, Math.PI - 0.2); g.stroke();
      }
    }
    g.restore();
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

    SG.ui.text(g, st.plan.length + ' tasks done', CX, 282, { size: 18, color: '#fff', shadow: false });
    SG.art.drawWing(g, CX - 62, 314, 1.2, -0.3);
    SG.ui.text(g, '+' + st.wings + ' wings', CX - 42, 314, { size: 17, color: SG.COLORS.gold, align: 'left', shadow: false });
    SG.ui.text(g, Math.floor(st.t) + 's · day ' + st.day + ' · tomorrow is different', CX, 344, {
      size: 13, color: 'rgba(255,255,255,0.45)', shadow: false,
    });

    if (SG.ui.button(g, { x: CX - 200, y: 372, w: 190, h: 52 }, 'ANOTHER DAY', { color: SG.COLORS.gold, size: 16 })) reset();
    if (SG.ui.button(g, { x: CX + 10, y: 372, w: 190, h: 52 }, 'MENU', { color: '#3a4270', text: '#fff' })) SG.go('menu');
  }

  /* Santi's song plays over the day, then the instrumental loops under
     it until he leaves. exit() is the only reliable stop: every way out
     of the mode - MENU, the pause menu, Escape - goes through a scene
     change, and a 4MB track left playing over the menu would be its own
     bug. */
  var MUSIC = 'assets/music/santi-song.mp3';
  var MUSIC_LOOP = 'assets/music/santi-song-instrumental.mp3';

  SG.register('sim', {
    enter: function () {
      reset();
      SG.audio.music.playThenLoop(MUSIC, MUSIC_LOOP);
    },
    exit: function () { SG.audio.music.stop(); },
    update: update,
    draw: draw,
    onBlur: function () { if (st && !st.done) st.paused = true; },
  });
})();
