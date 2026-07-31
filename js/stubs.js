/* =============================================================
   Placeholder screen for modes still in the oven.
   Doubles as the design brief for each one.
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  var PLANS = {
    pickleball: {
      color: '#4dd47a',
      lines: [
        'A pickleball court, top-down-ish perspective.',
        'Santi on one side. Dark Santi on the other.',
        'Swipe to swing, timing decides the spin.',
        'Dark Santi trash-talks and gets faster each set.',
      ],
    },
    brawl: {
      color: '#e8202a',
      lines: [
        'Top-down arena. Bots close in from every side.',
        'Left thumb moves, right thumb aims and fires.',
        'Every round: draft 1 of 3 Santis.',
        'Then pick a power-up - speed, defence or attack.',
      ],
    },
    smurf: {
      color: '#4aa8ff',
      lines: [
        'Side-scrolling platformer through mushroom villages.',
        'Stomp Gargamel\'s minions, dodge Azrael the cat.',
        'Collect sarsaparilla, hit the flag at the end.',
        'Boss fight: Gargamel himself.',
      ],
    },
    sim: {
      color: '#b070ff',
      lines: [
        'Wake up. Microwave the bread and cheese.',
        'Hairspray. Pick a Supreme shirt. Walk Rue.',
        'Film a YouTube video. Destroy some wings.',
        'Call Daley. Go to sleep. Repeat forever.',
      ],
    },
  };

  var t = 0;
  var mode = null;

  SG.register('stub', {
    enter: function (p) {
      t = 0;
      mode = p.mode || SG.MODES[0];
    },
    update: function (dt) {
      t += dt;
      // Escape / Enter goes back too.
      for (var i = 0; i < SG.input.taps.length; i++) {
        if (SG.input.taps[i].key === 'Escape') { SG.go('menu'); return; }
      }
    },
    draw: function (g) {
      var plan = PLANS[mode.id] || { color: mode.color, lines: [] };

      var bg = g.createLinearGradient(0, 0, 0, SG.H);
      bg.addColorStop(0, '#15102e');
      bg.addColorStop(1, '#0a0818');
      g.fillStyle = bg;
      g.fillRect(0, 0, SG.W, SG.H);

      // drifting glow
      var gx = SG.W / 2 + Math.sin(t * 0.5) * 60;
      var rg = g.createRadialGradient(gx, 200, 20, gx, 200, 340);
      rg.addColorStop(0, hexA(plan.color, 0.18));
      rg.addColorStop(1, hexA(plan.color, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, SG.W, SG.H);

      SG.ui.text(g, mode.title + ' ' + mode.title2, SG.W / 2, 92, {
        size: 40, color: '#fff', stroke: '#1a1030', strokeWidth: 9, shadow: false,
      });

      g.fillStyle = plan.color;
      SG.roundRect(g, SG.W / 2 - 88, 122, 176, 28, 14);
      g.fill();
      SG.ui.text(g, 'IN DEVELOPMENT', SG.W / 2, 136, { size: 13, color: '#17120a', shadow: false });

      SG.ui.panel(g, SG.W / 2 - 260, 178, 520, 190, { border: hexA(plan.color, 0.45) });
      SG.ui.text(g, 'THE PLAN', SG.W / 2, 208, { size: 15, color: hexA(plan.color, 0.9), shadow: false });

      for (var i = 0; i < plan.lines.length; i++) {
        var a = SG.clamp((t - 0.15 - i * 0.09) * 4, 0, 1);
        g.save();
        g.globalAlpha = a;
        g.fillStyle = plan.color;
        g.beginPath();
        g.arc(SG.W / 2 - 226, 244 + i * 30, 3.5, 0, Math.PI * 2);
        g.fill();
        SG.ui.text(g, plan.lines[i], SG.W / 2 - 212, 244 + i * 30, {
          size: 16, color: 'rgba(255,255,255,0.82)', align: 'left', weight: '600',
          font: '"Avenir Next", system-ui, sans-serif', shadow: false,
        });
        g.restore();
      }

      SG.ui.text(g, 'Chicken Wing Run is playable right now →', SG.W / 2, 396, {
        size: 14, color: 'rgba(255,255,255,0.4)', shadow: false,
      });

      if (SG.ui.button(g, { x: SG.W / 2 - 200, y: 424, w: 190, h: 50 }, 'BACK', { color: '#3a4270', text: '#fff' })) SG.go('menu');
      if (SG.ui.button(g, { x: SG.W / 2 + 10, y: 424, w: 190, h: 50 }, 'PLAY WING RUN', { color: SG.COLORS.gold, size: 17 })) SG.go('wingrun');
    },
  });

  function hexA(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
})();
