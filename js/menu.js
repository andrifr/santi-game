/* =============================================================
   Mode select
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  var MODES = [
    { id: 'pickleball', scene: 'pickleball', n: '1', title: 'PICKLE', title2: 'BALL', tag: 'Santi vs. Dark Santi', color: '#4dd47a', ready: true },
    { id: 'wingrun',    scene: 'wingrun', n: '2', title: 'CHICKEN', title2: 'WING RUN', tag: 'Run. Collect. Devour.', color: '#ffb02e', ready: true },
    { id: 'brawl',      scene: 'brawl', n: '3', title: 'BRAWL', title2: 'SHOWDOWN', tag: 'Draft a Santi. Fight.', color: '#e8202a', ready: true },
    { id: 'smurf',      scene: 'smurf', n: '4', title: 'SMURF',  title2: 'WORLD',    tag: 'Gargamel must fall',    color: '#4aa8ff', ready: true },
    { id: 'sim',        scene: 'sim',  n: '5', title: 'SANTI',  title2: 'SIMULATOR', tag: 'A day in the life',    color: '#b070ff', ready: true },
  ];
  SG.MODES = MODES;

  var CARD_W = 166, CARD_H = 252, GAP = 18;
  var CARD_Y = 196;

  // SG.W changes with the screen's aspect ratio, so lay out at draw time.
  function cardRect(i) {
    var total = MODES.length * CARD_W + (MODES.length - 1) * GAP;
    return { x: (SG.W - total) / 2 + i * (CARD_W + GAP), y: CARD_Y, w: CARD_W, h: CARD_H };
  }

  var t = 0;
  var clouds = [];
  var floaters = [];

  var scene = {
    enter: function () {
      t = 0;
      clouds = [];
      for (var i = 0; i < 7; i++) {
        clouds.push({ x: Math.random() * SG.W, y: SG.rand(30, 170), s: SG.rand(0.5, 1.3), v: SG.rand(4, 14) });
      }
      floaters = [];
      for (var j = 0; j < 9; j++) {
        floaters.push({ x: Math.random() * SG.W, y: Math.random() * SG.H, r: Math.random() * 6.28, vr: SG.rand(-1, 1), v: SG.rand(10, 26), s: SG.rand(0.5, 1.1) });
      }
    },

    update: function (dt) {
      t += dt;
      for (var i = 0; i < clouds.length; i++) {
        var c = clouds[i];
        c.x += c.v * dt;
        if (c.x > SG.W + 90) { c.x = -90; c.y = SG.rand(30, 170); }
      }
      for (var j = 0; j < floaters.length; j++) {
        var f = floaters[j];
        f.y -= f.v * dt;
        f.r += f.vr * dt;
        if (f.y < -30) { f.y = SG.H + 30; f.x = Math.random() * SG.W; }
      }
    },

    draw: function (g) {
      drawBackdrop(g);

      // ---- title ----
      var pop = 1 + Math.sin(t * 2) * 0.012;
      g.save();
      g.translate(SG.W / 2, 78);
      g.scale(pop, pop);
      SG.ui.text(g, 'SANTI', 0, -18, { size: 58, color: '#fff', stroke: '#1a1030', strokeWidth: 10, shadow: false });
      SG.ui.text(g, 'THE GAME', 0, 26, { size: 26, color: SG.COLORS.gold, stroke: '#1a1030', strokeWidth: 7, shadow: false });
      g.restore();

      SG.art.drawWing(g, SG.W / 2 - 172, 62, 1.5, -0.35 + Math.sin(t * 1.6) * 0.12);
      SG.art.drawWing(g, SG.W / 2 + 172, 62, 1.5, 0.35 - Math.sin(t * 1.6) * 0.12);

      SG.ui.text(g, 'CHOOSE YOUR MODE', SG.W / 2, 152, { size: 17, color: 'rgba(255,255,255,0.62)', shadow: false });

      drawPresentTab(g);

      // ---- cards ----
      for (var i = 0; i < MODES.length; i++) {
        var appear = SG.clamp((t - i * 0.07) * 4.5, 0, 1);
        appear = 1 - Math.pow(1 - appear, 3);
        drawCard(g, i, appear);
      }

      // ---- footer ----
      var sndR = { x: SG.W - 118, y: SG.H - 44, w: 100, h: 32 };
      if (SG.ui.button(g, sndR, SG.audio.enabled ? 'SOUND ON' : 'SOUND OFF', {
        color: SG.audio.enabled ? '#2a2f52' : '#20223a', text: 'rgba(255,255,255,0.8)', size: 13, r: 10,
      })) {
        SG.audio.enabled = !SG.audio.enabled;
        SG.save.data.sound = SG.audio.enabled;
        SG.save.write();
        SG.audio.music.refresh();      // the toggle governs music too
      }

      var hint = SG.platform.iOS && !SG.platform.standalone
        ? 'Add to Home Screen for true fullscreen'
        : 'Swipe or use the arrow keys to play';
      SG.ui.text(g, hint, 22, SG.H - 28, { size: 13, color: 'rgba(255,255,255,0.35)', align: 'left', shadow: false });

      var totalWings = SG.save.data.wings || 0;
      if (totalWings > 0) {
        SG.art.drawWing(g, 32, SG.H - 52, 0.75, -0.3);
        SG.ui.text(g, String(totalWings), 50, SG.H - 52, { size: 15, color: SG.COLORS.gold, align: 'left', shadow: false });
      }
    },
  };

  function drawBackdrop(g) {
    var sky = g.createLinearGradient(0, 0, 0, SG.H);
    sky.addColorStop(0, '#1b1040');
    sky.addColorStop(0.45, '#3a1a52');
    sky.addColorStop(1, '#8e2b46');
    g.fillStyle = sky;
    g.fillRect(0, 0, SG.W, SG.H);

    // sun
    var sg = g.createRadialGradient(SG.W / 2, 300, 20, SG.W / 2, 300, 260);
    sg.addColorStop(0, 'rgba(255,176,46,0.35)');
    sg.addColorStop(1, 'rgba(255,176,46,0)');
    g.fillStyle = sg;
    g.fillRect(0, 40, SG.W, SG.H);

    // clouds
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      g.fillStyle = 'rgba(255,255,255,' + (0.05 + c.s * 0.05) + ')';
      puff(g, c.x, c.y, 40 * c.s);
    }

    // drifting wings
    for (var j = 0; j < floaters.length; j++) {
      var f = floaters[j];
      g.globalAlpha = 0.16;
      SG.art.drawWing(g, f.x, f.y, f.s, f.r);
      g.globalAlpha = 1;
    }

    // ground glow
    var gg = g.createLinearGradient(0, SG.H - 120, 0, SG.H);
    gg.addColorStop(0, 'rgba(0,0,0,0)');
    gg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gg;
    g.fillRect(0, SG.H - 120, SG.W, 120);
  }

  function puff(g, x, y, r) {
    g.beginPath();
    g.arc(x - r * 0.6, y + r * 0.1, r * 0.55, 0, Math.PI * 2);
    g.arc(x, y - r * 0.15, r * 0.75, 0, Math.PI * 2);
    g.arc(x + r * 0.65, y + r * 0.05, r * 0.5, 0, Math.PI * 2);
    g.fill();
  }

  function drawCard(g, i, appear) {
    var m = MODES[i];
    var r = cardRect(i);
    var wob = m.ready ? Math.sin(t * 2.4 + i) * 3 : 0;

    g.save();
    g.globalAlpha = appear;
    g.translate(0, (1 - appear) * 40 + wob);

    // shadow
    g.fillStyle = 'rgba(0,0,0,0.35)';
    SG.roundRect(g, r.x + 4, r.y + 8, r.w, r.h, 18);
    g.fill();

    // body
    var grd = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    grd.addColorStop(0, m.ready ? 'rgba(28,24,58,0.98)' : 'rgba(20,20,38,0.9)');
    grd.addColorStop(1, m.ready ? 'rgba(16,14,36,0.98)' : 'rgba(12,12,26,0.9)');
    g.fillStyle = grd;
    SG.roundRect(g, r.x, r.y, r.w, r.h, 18);
    g.fill();

    g.strokeStyle = m.ready ? m.color : 'rgba(255,255,255,0.1)';
    g.lineWidth = m.ready ? 3.5 : 2;
    g.stroke();

    if (m.ready) {
      g.save();
      g.shadowColor = m.color;
      g.shadowBlur = 22 + Math.sin(t * 3) * 8;
      g.strokeStyle = m.color;
      g.lineWidth = 2;
      SG.roundRect(g, r.x, r.y, r.w, r.h, 18);
      g.stroke();
      g.restore();
    }

    // number chip
    g.fillStyle = m.ready ? m.color : 'rgba(255,255,255,0.16)';
    SG.roundRect(g, r.x + 12, r.y + 12, 30, 26, 8);
    g.fill();
    SG.ui.text(g, m.n, r.x + 27, r.y + 26, { size: 16, color: m.ready ? '#17120a' : 'rgba(255,255,255,0.7)', shadow: false });

    // icon
    g.save();
    g.globalAlpha = m.ready ? appear : appear * 0.45;
    drawIcon(g, m.id, r.x + r.w / 2, r.y + 92, m.color);
    g.restore();

    // titles
    var tc = m.ready ? '#fff' : 'rgba(255,255,255,0.5)';
    SG.ui.text(g, m.title, r.x + r.w / 2, r.y + 150, { size: 21, color: tc, shadow: false });
    SG.ui.text(g, m.title2, r.x + r.w / 2, r.y + 173, { size: 21, color: tc, shadow: false });
    SG.ui.text(g, m.tag, r.x + r.w / 2, r.y + 194, { size: 11, color: 'rgba(255,255,255,0.42)', shadow: false });

    // action strip
    var br = { x: r.x + 16, y: r.y + r.h - 46, w: r.w - 32, h: 32 };
    if (m.ready) {
      var best = SG.save.best(m.id);
      var hitPlay = SG.ui.button(g, br, best ? 'PLAY · ' + best : 'PLAY', { color: m.color, size: 15, r: 10 });
      /* The whole card starts the mode, not just the strip - a thumb
         aimed at the art is aimed at the game. Offset by the same amount
         the card is drawn by, since taps are in untransformed space. */
      var hitCard = !hitPlay && SG.input.tappedRect({
        x: r.x, y: r.y + (1 - appear) * 40 + wob, w: r.w, h: r.h,
      });
      if (hitPlay || hitCard) {
        if (hitCard) SG.audio.play('select');
        g.restore();
        SG.go(m.scene, { mode: m });
        return;
      }
    } else {
      g.fillStyle = 'rgba(255,255,255,0.07)';
      SG.roundRect(g, br.x, br.y, br.w, br.h, 10);
      g.fill();
      SG.ui.text(g, 'COMING SOON', br.x + br.w / 2, br.y + br.h / 2 + 1, { size: 12, color: 'rgba(255,255,255,0.45)', shadow: false });
      if (SG.input.tappedRect(r)) {
        SG.audio.play('back');
        g.restore();
        SG.go('stub', { mode: m });
        return;
      }
    }

    g.restore();
  }

  /* The way in to the present ladder. Top left, not top right: the
     fullscreen button is a DOM overlay pinned to the top right corner
     with a higher z-index, so anything drawn under it is both hidden
     and un-tappable. */
  function drawPresentTab(g) {
    var r = { x: 22, y: 20, w: 178, h: 82 };
    var got = SG.presents.count();
    var isNew = SG.presents.unseen() > 0;
    var glow = isNew ? 14 + Math.sin(t * 5) * 8 : 8 + Math.sin(t * 2) * 4;

    g.save();
    g.shadowColor = isNew ? SG.COLORS.red : 'rgba(255,176,46,0.9)';
    g.shadowBlur = glow;
    SG.ui.panel(g, r.x, r.y, r.w, r.h, {
      r: 18,
      fill: 'rgba(12,14,32,0.9)',
      border: isNew ? SG.COLORS.red : 'rgba(255,176,46,0.65)',
      borderWidth: 2.5,
    });
    g.restore();

    // Always the bright version - this is a signpost, not a status light.
    SG.presents.draw(g, r.x + 40, r.y + 62, 0.95, { tier: 'grand', got: true, check: false });

    SG.ui.text(g, 'PRESENTS', r.x + 74, r.y + 22, {
      size: 14, color: SG.COLORS.gold, align: 'left', shadow: false,
    });
    SG.ui.text(g, got + ' / ' + SG.presents.total, r.x + 74, r.y + 44, {
      size: 17, color: '#fff', align: 'left', shadow: false,
    });

    var bx = r.x + 74, bw = r.w - 90, by = r.y + 58, bh = 8;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    SG.roundRect(g, bx, by, bw, bh, 4);
    g.fill();
    var fw = bw * SG.presents.frac();
    if (fw > 2) {
      var grd = g.createLinearGradient(bx, 0, bx + bw, 0);
      grd.addColorStop(0, '#ff6b3d');
      grd.addColorStop(1, '#ffe38a');
      g.fillStyle = grd;
      SG.roundRect(g, bx, by, fw, bh, 4);
      g.fill();
    }

    if (isNew) {
      var dr = 10 + Math.sin(t * 6) * 1.2;
      g.fillStyle = SG.COLORS.red;
      g.beginPath();
      g.arc(r.x + r.w - 8, r.y + 8, dr, 0, Math.PI * 2);
      g.fill();
      SG.ui.text(g, '!', r.x + r.w - 8, r.y + 8, { size: 14, color: '#fff', shadow: false });
    }

    if (SG.input.tappedRect(r)) {
      SG.audio.play('select');
      SG.go('presents');
    }
  }

  function drawIcon(g, id, x, y, color) {
    g.save();
    g.translate(x, y);
    switch (id) {
      case 'pickleball':
        // Santi vs. his evil twin, ball in between
        SG.art.drawHead(g, -26, 2, 21, 'santi', 'normal');
        SG.art.drawHead(g, 26, 2, 21, 'dark', 'dark');
        g.fillStyle = '#e9f562';
        g.strokeStyle = 'rgba(30,30,10,0.5)';
        g.lineWidth = 2;
        g.beginPath(); g.arc(0, -26, 11, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = 'rgba(90,90,20,0.45)';
        for (var i = 0; i < 5; i++) {
          g.beginPath();
          g.arc(Math.cos(i * 1.3) * 5, -26 + Math.sin(i * 1.3) * 5, 1.8, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'wingrun':
        SG.art.drawWing(g, 20, 14, 1.7, -0.4);
        SG.art.drawHead(g, -6, -6, 26, 'santi', 'normal');
        break;
      case 'brawl':
        g.strokeStyle = color;
        g.lineWidth = 5;
        g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(-34, 0); g.lineTo(-14, 0);
        g.moveTo(34, 0); g.lineTo(14, 0);
        g.moveTo(0, -34); g.lineTo(0, -14);
        g.moveTo(0, 34); g.lineTo(0, 14);
        g.stroke();
        g.fillStyle = color;
        g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
        break;
      case 'smurf':
        // mushroom house
        g.fillStyle = '#e14a4a';
        g.beginPath();
        g.ellipse(0, -4, 34, 24, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = '#fff';
        [[-18, -12, 6], [2, -18, 7], [18, -9, 5]].forEach(function (d) {
          g.beginPath(); g.ellipse(d[0], d[1], d[2], d[2] * 0.75, 0, 0, Math.PI * 2); g.fill();
        });
        g.fillStyle = '#f0e2c0';
        SG.roundRect(g, -20, -4, 40, 34, 4);
        g.fill();
        g.fillStyle = '#5b3a1c';
        SG.roundRect(g, -8, 12, 16, 18, 3);
        g.fill();
        break;
      case 'sim':
        // Santi asleep - the day starts and ends here. The old icon put
        // his head above the bed instead of on it, which read as a head
        // floating over a purple slab.
        g.fillStyle = '#2a2140';                       // legs
        SG.roundRect(g, -30, 20, 7, 12, 2); g.fill();
        SG.roundRect(g, 24, 20, 7, 12, 2); g.fill();

        g.fillStyle = '#3a2b5c';                       // headboard
        SG.roundRect(g, -38, -16, 10, 40, 4); g.fill();

        g.fillStyle = '#f0e2c0';                       // mattress
        SG.roundRect(g, -34, 4, 68, 18, 5); g.fill();

        g.fillStyle = color;                           // blanket
        SG.roundRect(g, -2, 1, 36, 21, 5); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.22)';        // turned-down fold
        SG.roundRect(g, -2, 1, 36, 6, 3); g.fill();

        g.fillStyle = '#fff';                          // pillow
        SG.roundRect(g, -30, -1, 24, 11, 4); g.fill();

        SG.art.drawHead(g, -17, -6, 13, 'santi', 'normal');

        ['z', 'z', 'z'].forEach(function (z, zi) {     // out cold
          SG.ui.text(g, z, 7 + zi * 9, -15 - zi * 10, {
            size: 10 + zi * 2.5, color: 'rgba(255,255,255,0.7)', shadow: false,
          });
        });
        break;
    }
    g.restore();
  }

  SG.register('menu', scene);
})();
