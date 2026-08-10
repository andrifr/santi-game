/* =============================================================
   Present milestones

   Ten real, physical presents, unlocked with the shared chicken-wing
   currency. #5 is the bigger one, #10 is the grand prize. Everything
   here reads SG.save.data.wings live, so the bar is already correct
   the moment a mode banks a wing.
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  /* Wings needed for each present. Retune here and nothing else needs
     touching - the bar, the labels, the cards and the menu tab all read
     this one list.

     Every mode is balanced to the same ~130 wings a minute (Wing Run is
     the anchor: one collected wing is one banked wing, and the others
     were scaled to match it). So this ladder is also a clock:

         #1   400 -> ~3 minutes
         #5  6000 -> ~45 minutes
         #10 20000 -> ~2 1/2 hours of play

     Move the grand prize and the rest scales with it. If the target
     time changes, change these numbers - do not make the modes stingier
     one at a time, or they drift out of parity again. */
  var GOALS = [400, 1200, 2400, 4000, 6000, 8400, 11200, 14000, 16800, 20000];

  /* Daley's raid. Once, and only once, at 19,000 wings she walks in and
     eats the entire jar - see the cutscene at the bottom of this file.

     19,000 sits between #9 (16,800) and #10 (20,000), so he arrives
     holding nine and the grand prize is the one thing she costs him.
     The nine are real objects in his hands: their goals become 0 and
     they stay ticked. Only the grand prize is re-priced, onto a fresh
     10,000 from the empty jar.

     It fires on opening this screen, not on crossing the line, so
     banking past 20,000 first does not dodge it - and it caps what he
     keeps at nine even then. Reaching the number is not the same as
     having been handed the box, and she gets there first.

         raid at 19,000    -> 146 min, 9 presents
         then 10,000 more  -> 77 min, the grand prize
         total             -> ~29,000 wings, about 3 3/4 hours */
  var RAID_AT = 19000;
  var RAID_TOTAL = 10000;        // the climb back to the grand prize
  var RAID_KEEP_MAX = 9;         // she is always in time for the last one

  /* The post-raid ladder, given how many presents he kept. Everything
     he holds goes to 0 and stays collected; whatever is left is spread
     across the climb back - which is the grand prize alone unless a
     save from an older build arrives with fewer. */
  function raidGoals(won) {
    var left = PRESENTS.length - won;
    var out = [];
    for (var i = 0; i < PRESENTS.length; i++) {
      out.push(i < won ? 0 : Math.round(RAID_TOTAL * (i - won + 1) / left / 100) * 100);
    }
    return out;
  }

  var PRESENTS = [];
  for (var gi = 0; gi < GOALS.length; gi++) {
    PRESENTS.push({
      n: gi + 1,
      wings: GOALS[gi],
      tier: gi === GOALS.length - 1 ? 'grand' : gi === 4 ? 'medium' : 'small',
    });
  }

  function goals() {
    return SG.save.data.raid ? raidGoals(SG.save.data.raidWon || RAID_KEEP_MAX) : GOALS;
  }

  // PRESENTS[i].wings is what everything else reads, so re-point it at
  // whichever ladder is live before anyone looks.
  function sync() {
    var g = goals();
    for (var i = 0; i < PRESENTS.length; i++) PRESENTS[i].wings = g[i];
  }
  sync();

  // ---- layout (SG.W moves with the aspect ratio, so x is always
  // derived from SG.W/2 at draw time; only y is fixed) ----
  var BAR_W = 780, BAR_Y = 264, TRACK_H = 14;
  var STEP = BAR_W / PRESENTS.length;
  var ICON_Y = BAR_Y - 13;          // presents stand on top of the track
  var CARD_Y = 340, CARD_H = 108, CARD_W = 214, CARD_GAP = 16;

  var TIER_COLOR = { small: '#e8202a', medium: '#a077ff', grand: '#ffb02e' };
  var TIER_NAME = { medium: 'BIGGER', grand: 'GRAND' };

  function wingsNow() { return SG.save.data.wings || 0; }

  function unlockedCount(wings) {
    var n = 0;
    for (var i = 0; i < PRESENTS.length; i++) if (wings >= PRESENTS[i].wings) n++;
    return n;
  }

  /* Nodes are spaced evenly rather than by wing cost. A proportional bar
     would bunch the first five into the left third, and the whole point
     of the screen is reading the ladder at a glance. */
  function barFrac(wings) {
    for (var i = 0; i < PRESENTS.length; i++) {
      if (wings < PRESENTS[i].wings) {
        var lo = i === 0 ? 0 : PRESENTS[i - 1].wings;
        return (i + (wings - lo) / (PRESENTS[i].wings - lo)) / PRESENTS.length;
      }
    }
    return 1;
  }

  function fmt(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function tierScale(tier) { return tier === 'grand' ? 1.5 : tier === 'medium' ? 1.3 : 1; }

  // ---------------------------------------------------------------
  // The present itself. (cx, baseY) is the centre of its bottom edge so
  // a row of different-sized presents all stand on the same line.
  // ---------------------------------------------------------------
  function drawPresent(g, cx, baseY, s, o) {
    o = o || {};
    var tier = o.tier || 'small';
    var got = !!o.got;
    var pop = o.pop || 0;

    var w = 30 * s, h = 25 * s;
    var lidH = 7 * s, lidW = w + 7 * s;
    var boxY = baseY - h, lidY = boxY - lidH;

    var body, ribbon, edge;
    if (got) {
      body = TIER_COLOR[tier];
      ribbon = tier === 'grand' ? '#fff4e0' : '#ffd166';
      edge = 'rgba(34,16,8,0.6)';
    } else {
      // Not collected yet: a flat silhouette with no glow and no bow
      // colour. Reads as "still wrapped up somewhere else".
      body = 'rgba(255,255,255,0.055)';
      ribbon = 'rgba(255,255,255,0.15)';
      edge = 'rgba(255,255,255,0.28)';
    }

    g.save();
    if (pop) {
      g.translate(cx, baseY);
      g.scale(1 + pop * 0.35, 1 + pop * 0.35);
      g.translate(-cx, -baseY);
    }
    g.lineJoin = 'round';
    g.lineWidth = Math.max(1.3, 1.7 * s);

    // box
    if (got) { g.shadowColor = body; g.shadowBlur = 16 * s; }
    g.fillStyle = body;
    SG.roundRect(g, cx - w / 2, boxY, w, h, 3 * s);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = edge;
    g.stroke();

    g.fillStyle = ribbon;
    g.fillRect(cx - 3 * s, boxY, 6 * s, h);

    // lid
    g.fillStyle = body;
    SG.roundRect(g, cx - lidW / 2, lidY, lidW, lidH, 2.5 * s);
    g.fill();
    g.strokeStyle = edge;
    g.stroke();
    g.fillStyle = ribbon;
    g.fillRect(cx - 3 * s, lidY, 6 * s, lidH);

    // bow
    g.fillStyle = ribbon;
    g.strokeStyle = edge;
    for (var d = -1; d <= 1; d += 2) {
      g.beginPath();
      g.ellipse(cx + d * 6.5 * s, lidY - 4.5 * s, 6 * s, 4.4 * s, d * 0.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.arc(cx, lidY - 3 * s, 2.8 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    if (tier === 'grand' && got) star(g, cx, lidY - 20 * s, 7 * s, '#fff4e0');

    // collected tick, so the difference survives at thumbnail size
    if (got && o.check !== false) {
      var bx = cx + w / 2 + 2 * s, by = baseY - 3 * s, br = 6.5 * s;
      g.fillStyle = '#4dd47a';
      g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(8,28,14,0.65)';
      g.lineWidth = 1.4 * s;
      g.stroke();
      g.strokeStyle = '#0d2415';
      g.lineWidth = 2 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx - 3 * s, by);
      g.lineTo(bx - 0.7 * s, by + 2.6 * s);
      g.lineTo(bx + 3.3 * s, by - 2.7 * s);
      g.stroke();
      g.lineCap = 'butt';
    }

    g.restore();
  }

  function star(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 ? r * 0.45 : r;
      var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
    g.fill();
  }

  // ---------------------------------------------------------------
  // Shared with the menu tab
  // ---------------------------------------------------------------
  SG.presents = {
    list: PRESENTS,
    total: PRESENTS.length,
    draw: drawPresent,
    count: function () { sync(); return unlockedCount(wingsNow()); },
    frac: function () { sync(); return barFrac(wingsNow()); },
    next: function () {
      sync();
      var w = wingsNow();
      for (var i = 0; i < PRESENTS.length; i++) if (w < PRESENTS[i].wings) return PRESENTS[i];
      return null;
    },
    // Unlocked but not yet celebrated on this screen. The menu badges
    // the tab while this is above zero.
    unseen: function () {
      sync();
      return Math.max(0, unlockedCount(wingsNow()) - (SG.save.data.presentsSeen || 0));
    },
    // The menu pulses the tab harder when she is waiting in there.
    raidDue: function () { return !SG.save.data.raid && wingsNow() >= RAID_AT; },
    raidAt: RAID_AT,
    keepMax: RAID_KEEP_MAX,
  };

  // ---------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------
  var t = 0;
  var fill = 0, target = 0;      // animated bar fraction
  var fresh = [];                // indices unlocked since the last visit
  var popped = {};               // index -> time its reveal fired
  var banner = 0, bannerN = 0;
  var floaters = [];
  var raid = null;               // the cutscene, or null on a normal visit

  /* Daley's raid, in beats. She walks on, eats the jar, apologises and
     leaves. The wings are only actually taken at EAT_END, so quitting
     halfway just means she does it again next time - better than
     charging him for a scene he never saw the end of. */
  var WALK_IN = 1.2, EAT_END = 4.4, BURP_END = 5.6, WALK_OUT = 6.8;

  function startRaid(wings) {
    raid = { t: 0, from: wings, shown: wings, took: false, flyers: [], nextFly: 0 };
  }

  function updateRaid(dt) {
    raid.t += dt;
    var t = raid.t;

    if (t > WALK_IN && t < EAT_END) {
      // counter drains over the eating beat
      var f = (t - WALK_IN) / (EAT_END - WALK_IN);
      raid.shown = Math.max(0, Math.round(raid.from * (1 - f * f)));

      raid.nextFly -= dt;
      if (raid.nextFly <= 0) {
        raid.nextFly = 0.055;
        raid.flyers.push({
          x: SG.W / 2 - BAR_W / 2 + Math.random() * BAR_W * barFrac(raid.shown),
          y: BAR_Y + SG.rand(-16, 10),
          t: 0, dur: SG.rand(0.35, 0.6),
          r: Math.random() * 6.28, s: SG.rand(0.6, 1),
        });
        SG.audio.play('wing');
      }
    }

    if (!raid.took && t >= EAT_END) {
      raid.took = true;
      raid.shown = 0;
      /* Count what he holds while the pre-raid ladder is still live -
         those presents are real objects and stay collected, so on the
         post-raid ladder their goal becomes 0.

         Capped: arriving with 20,000 already banked means the count says
         ten, but the grand prize is the whole point of the raid and he
         has not been handed that box yet. She is always in time for the
         last one. */
      var won = Math.min(RAID_KEEP_MAX, unlockedCount(raid.from));
      raid.won = won;
      SG.save.data.wings = 0;
      SG.save.data.raidWon = won;
      SG.save.data.raid = true;
      sync();
      SG.save.data.presentsSeen = won;
      SG.save.write();
      SG.audio.play('crash');
      SG.shake(9);
    }

    for (var i = raid.flyers.length - 1; i >= 0; i--) {
      var fl = raid.flyers[i];
      fl.t += dt;
      fl.r += dt * 6;
      if (fl.t >= fl.dur) raid.flyers.splice(i, 1);
    }

    // Tap to leave once she is gone.
    if (t > WALK_OUT && (SG.input.taps.length || SG.input.anyDown)) {
      SG.input.taps.length = 0;
      raid = null;
      SG.scene().enter({});
    }
  }

  function daleyX(t) {
    var CX = SG.W / 2;
    if (t < WALK_IN) return SG.lerp(SG.W + 90, CX + 120, SG.clamp(t / WALK_IN, 0, 1));
    if (t < WALK_OUT) return CX + 120;
    return SG.lerp(CX + 120, -110, SG.clamp((t - WALK_OUT) / 1.4, 0, 1));
  }

  function drawRaid(g) {
    var CX = SG.W / 2;
    var t = raid.t;
    var dx = daleyX(t);
    var feetY = 496;
    var H = 168;
    var moving = t < WALK_IN || t > WALK_OUT;
    var phase = moving ? t * 11 : 0;

    // wings still in flight, arcing off the bar into her
    var mouthX = dx - 16, mouthY = feetY - H * 0.80;
    for (var i = 0; i < raid.flyers.length; i++) {
      var fl = raid.flyers[i];
      var f = fl.t / fl.dur;
      var x = SG.lerp(fl.x, mouthX, f);
      var y = SG.lerp(fl.y, mouthY, f) - Math.sin(f * Math.PI) * 60;
      g.globalAlpha = 1 - f * f;
      SG.art.drawWing(g, x, y, fl.s * (1 - f * 0.4), fl.r);
      g.globalAlpha = 1;
    }

    SG.art.drawSanti(g, dx, feetY, H, phase, {
      face: 'daley', variant: 'normal',
      shirt: '#ff5fa2', pants: '#3a2b5c', run: moving ? 1 : 0,
    });

    var line = null;
    if (t > 0.75 && t < WALK_IN + 0.4) line = 'Ooh, wings.';
    else if (t >= WALK_IN + 0.4 && t < EAT_END) line = 'Nom.';
    else if (t >= EAT_END && t < BURP_END) line = 'Burp. Sorry babe.';
    else if (t >= BURP_END && t < WALK_OUT) line = 'You can get more.';
    if (line) bubble(g, dx, feetY - H - 16, line);

    if (t >= EAT_END) {
      var a = SG.clamp((t - EAT_END) * 2, 0, 1);
      g.save();
      g.globalAlpha = a;
      SG.ui.text(g, 'DALEY ATE ALL ' + fmt(raid.from) + ' OF THEM', CX, 172, {
        size: 21, color: SG.COLORS.red, stroke: '#1a1030', strokeWidth: 6, shadow: false,
      });
      g.restore();
    }

    if (t > WALK_OUT) {
      var b = SG.clamp((t - WALK_OUT) * 2, 0, 1);
      g.save();
      g.globalAlpha = b;
      SG.ui.panel(g, CX - 290, 372, 580, 92, {
        r: 18, fill: 'rgba(10,12,30,0.92)', border: SG.COLORS.green, borderWidth: 2.5,
      });
      var left = PRESENTS.length - (raid.won || 0);
      SG.ui.text(g, 'Your ' + (raid.won || 0) + ' presents are safe. The jar is not.', CX, 400, {
        size: 16, color: '#fff', shadow: false,
      });
      /* Honest about the damage rather than selling it as a favour: the
         price came down, the effort went up. */
      SG.ui.text(g, left === 1
        ? 'The grand prize is ' + fmt(RAID_TOTAL) + ' from here. Get going.'
        : 'The last ' + left + ' are cheaper now. Fill it again.', CX, 424, {
        size: 13, color: SG.COLORS.green, shadow: false,
      });
      SG.ui.text(g, 'TAP TO CONTINUE', CX, 448, {
        size: 12, color: 'rgba(255,255,255,0.45)', shadow: false,
      });
      g.restore();
    }
  }

  function bubble(g, x, y, text) {
    g.font = '900 15px ' + SG.FONT;
    var w = g.measureText(text).width + 28;
    SG.ui.panel(g, x - w / 2, y - 30, w, 32, {
      r: 14, fill: 'rgba(255,255,255,0.94)', border: false,
    });
    g.fillStyle = 'rgba(255,255,255,0.94)';
    g.beginPath();
    g.moveTo(x - 7, y + 1);
    g.lineTo(x + 7, y + 1);
    g.lineTo(x, y + 12);
    g.closePath();
    g.fill();
    SG.ui.text(g, text, x, y - 13, { size: 15, color: '#1a1030', shadow: false });
  }

  SG.register('presents', {
    enter: function () {
      t = 0;
      fill = 0;
      banner = 0;
      popped = {};
      raid = null;
      sync();

      floaters = [];
      for (var j = 0; j < 8; j++) {
        floaters.push({
          x: Math.random() * SG.W, y: Math.random() * SG.H,
          r: Math.random() * 6.28, vr: SG.rand(-0.9, 0.9),
          v: SG.rand(8, 22), s: SG.rand(0.5, 1.1),
        });
      }

      var wings = wingsNow();
      target = barFrac(wings);

      // She only ever does this once, and only here - a cutscene that
      // fired mid-run would take the controls away during a fight.
      if (!SG.save.data.raid && wings >= RAID_AT) {
        startRaid(wings);
        fresh = [];
        return;
      }

      var got = unlockedCount(wings);
      var seen = SG.save.data.presentsSeen || 0;
      fresh = [];
      for (var i = seen; i < got; i++) fresh.push(i);
      if (got !== seen) {
        SG.save.data.presentsSeen = got;
        SG.save.write();
      }
    },

    update: function (dt) {
      t += dt;
      sync();

      if (raid) {
        updateRaid(dt);
        // the bar follows the jar as she empties it. updateRaid can end
        // the scene on a tap, which clears `raid` and re-enters.
        if (raid) fill = barFrac(raid.shown);
        return;
      }

      // Re-read every frame rather than only on enter, so the bar tracks
      // the wing count instead of a snapshot of it.
      target = barFrac(wingsNow());

      // The sweep out to the real total is the moment this screen is for.
      fill += (target - fill) * Math.min(1, dt * 3.2);
      if (Math.abs(target - fill) < 0.002) fill = target;

      if (banner > 0) banner -= dt;

      for (var i = 0; i < fresh.length; i++) {
        var idx = fresh[i];
        if (popped[idx] !== undefined) continue;
        if (fill >= (idx + 1) / PRESENTS.length - 0.004) {
          popped[idx] = t;
          banner = 3.4;
          bannerN = idx + 1;
          SG.audio.play('wingbig');
          SG.burst(SG.W / 2 - BAR_W / 2 + (idx + 1) * STEP, ICON_Y - 24, 30, {
            colors: ['#ffb02e', '#fff4e0', '#e8202a', '#a077ff', '#4dd47a'],
            speedMax: 320, lift: 130, gravity: 540,
          });
        }
      }

      for (var k = 0; k < SG.input.taps.length; k++) {
        if (SG.input.taps[k].key === 'Escape') { SG.go('menu'); return; }
      }

      for (var f = 0; f < floaters.length; f++) {
        var fl = floaters[f];
        fl.y -= fl.v * dt;
        fl.r += fl.vr * dt;
        if (fl.y < -30) { fl.y = SG.H + 30; fl.x = Math.random() * SG.W; }
      }
    },

    draw: function (g) {
      var CX = SG.W / 2;
      var wings = wingsNow();
      var got = unlockedCount(wings);
      var x0 = CX - BAR_W / 2;

      backdrop(g, CX);

      SG.ui.text(g, 'PRESENTS', CX, 48, {
        size: 40, color: '#fff', stroke: '#1a1030', strokeWidth: 9, shadow: false,
      });
      SG.ui.text(g, 'Ten real presents, unlocked with chicken wings', CX, 80, {
        size: 14, color: 'rgba(255,255,255,0.55)', shadow: false,
      });

      // ---- wing total / collected count ----
      SG.ui.panel(g, CX - 270, 98, 540, 44, {
        r: 22, fill: 'rgba(10,12,28,0.82)', border: 'rgba(255,176,46,0.38)', borderWidth: 2,
      });
      SG.art.drawWing(g, CX - 238, 120, 1, -0.3);
      SG.ui.text(g, fmt(raid ? raid.shown : wings) + ' WINGS', CX - 216, 120, {
        size: 20, color: raid && raid.took ? SG.COLORS.red : SG.COLORS.gold, align: 'left', shadow: false,
      });
      SG.ui.text(g, got + ' / ' + PRESENTS.length + ' COLLECTED', CX + 244, 120, {
        size: 15, color: got ? '#fff4e0' : 'rgba(255,255,255,0.55)', align: 'right', shadow: false,
      });

      // ---- the one line that matters, or the unlock banner ----
      if (raid) {
        // her scene owns this strip
      } else if (banner > 0) {
        var a = Math.min(1, banner * 2.5);
        g.save();
        g.globalAlpha = a;
        var bw = 300, pulse = 1 + Math.sin(t * 9) * 0.02;
        g.translate(CX, 166);
        g.scale(pulse, pulse);
        g.fillStyle = SG.COLORS.gold;
        SG.roundRect(g, -bw / 2, -17, bw, 34, 17);
        g.fill();
        SG.ui.text(g, 'PRESENT ' + bannerN + ' UNLOCKED!', 0, 1, {
          size: 17, color: '#241505', shadow: false,
        });
        g.restore();
      } else {
        var nxt = SG.presents.next();
        SG.ui.text(g, nxt
          ? fmt(nxt.wings - wings) + ' more wings until present ' + nxt.n
          : 'Every present unwrapped - go collect the real ones', CX, 166, {
          size: 15, color: nxt ? 'rgba(255,255,255,0.72)' : SG.COLORS.green, shadow: false,
        });
      }

      // ---- track ----
      g.fillStyle = 'rgba(255,255,255,0.08)';
      SG.roundRect(g, x0, BAR_Y - TRACK_H / 2, BAR_W, TRACK_H, TRACK_H / 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.16)';
      g.lineWidth = 2;
      g.stroke();

      var fw = BAR_W * fill;
      if (fw > 3) {
        g.save();
        SG.roundRect(g, x0, BAR_Y - TRACK_H / 2, BAR_W, TRACK_H, TRACK_H / 2);
        g.clip();

        var grd = g.createLinearGradient(x0, 0, x0 + BAR_W, 0);
        grd.addColorStop(0, '#ff6b3d');
        grd.addColorStop(0.55, '#ffb02e');
        grd.addColorStop(1, '#ffe38a');
        g.fillStyle = grd;
        g.fillRect(x0, BAR_Y - TRACK_H / 2, fw, TRACK_H);

        // travelling sheen
        var sx = x0 + ((t * 170) % (fw + 280)) - 140;
        var sheen = g.createLinearGradient(sx - 42, 0, sx + 42, 0);
        sheen.addColorStop(0, 'rgba(255,255,255,0)');
        sheen.addColorStop(0.5, 'rgba(255,255,255,0.3)');
        sheen.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sheen;
        g.fillRect(x0, BAR_Y - TRACK_H / 2, fw, TRACK_H);
        g.restore();

        if (fill < 1) {
          g.fillStyle = 'rgba(255,244,224,0.95)';
          g.beginPath();
          g.arc(x0 + fw, BAR_Y, TRACK_H * 0.55, 0, Math.PI * 2);
          g.fill();
        }
      }

      // ---- the ten presents ----
      for (var i = 0; i < PRESENTS.length; i++) {
        var p = PRESENTS[i];
        var nx = x0 + (i + 1) * STEP;
        var open = wings >= p.wings;

        // node on the track
        g.fillStyle = open ? '#fff4e0' : 'rgba(255,255,255,0.14)';
        g.beginPath();
        g.arc(nx, BAR_Y, 6, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = open ? 'rgba(120,66,10,0.65)' : 'rgba(255,255,255,0.24)';
        g.lineWidth = 2;
        g.stroke();

        var pop = 0;
        if (popped[i] !== undefined) {
          var age = t - popped[i];
          if (age < 0.55) pop = Math.sin(age / 0.55 * Math.PI) * 0.5;
        }
        var bob = open ? Math.sin(t * 2 + i * 0.7) * 2 : 0;

        drawPresent(g, nx, ICON_Y + bob, tierScale(p.tier), { tier: p.tier, got: open, pop: pop });

        if (raid) continue;          // her scene wants a clear stage

        SG.ui.text(g, '#' + p.n, nx, 288, {
          size: 11, color: open ? 'rgba(255,244,224,0.8)' : 'rgba(255,255,255,0.34)', shadow: false,
        });
        // After the raid the six he already has cost nothing to keep,
        // so a bare "0" would read as broken.
        SG.ui.text(g, p.wings === 0 ? 'GOT IT' : fmt(p.wings), nx, 306, {
          size: p.wings === 0 ? 11 : 13,
          color: p.wings === 0 ? SG.COLORS.green : open ? SG.COLORS.gold : 'rgba(255,255,255,0.45)',
          shadow: false,
        });

        if (TIER_NAME[p.tier]) {
          var tw = 62;
          g.fillStyle = open ? TIER_COLOR[p.tier] : 'rgba(255,255,255,0.12)';
          SG.roundRect(g, nx - tw / 2, 317, tw, 15, 7.5);
          g.fill();
          SG.ui.text(g, TIER_NAME[p.tier], nx, 325, {
            size: 9.5, color: open ? '#1a1206' : 'rgba(255,255,255,0.55)', shadow: false,
          });
        }
      }

      if (raid) { drawRaid(g); return; }

      // ---- the three that matter ----
      var totalW = CARD_W * 3 + CARD_GAP * 2;
      var cx0 = CX - totalW / 2;
      /* Once the grand prize is the only thing left - which is where
         the raid leaves him - "next up" and "the grand prize" are the
         same card twice over, and two identical panels read as a bug.
         The slot shows how far along he is instead. */
      var upNext = SG.presents.next();
      if (!upNext) doneCard(g, cx0, wings);
      else if (upNext.n === PRESENTS.length) progressCard(g, cx0, upNext, wings);
      else card(g, cx0, 'NEXT UP', upNext, wings, '#ffd166');
      card(g, cx0 + CARD_W + CARD_GAP, 'THE BIGGER ONE', PRESENTS[4], wings, TIER_COLOR.medium);
      card(g, cx0 + (CARD_W + CARD_GAP) * 2, 'THE GRAND PRIZE', PRESENTS[9], wings, TIER_COLOR.grand);

      if (SG.ui.button(g, { x: 28, y: 462, w: 168, h: 48 }, 'BACK', {
        color: '#3a4270', text: '#fff', size: 17, sound: 'back',
      })) SG.go('menu');
    },
  });

  function card(g, x, label, p, wings, accent) {
    SG.ui.panel(g, x, CARD_Y, CARD_W, CARD_H, {
      r: 16, fill: 'rgba(10,12,30,0.84)', border: accent, borderWidth: 2.5,
    });
    SG.ui.text(g, label, x + CARD_W / 2, CARD_Y + 17, { size: 11, color: accent, shadow: false });

    var open = wings >= p.wings;
    var s = p.tier === 'grand' ? 1.15 : p.tier === 'medium' ? 1.05 : 0.95;
    drawPresent(g, x + 46, CARD_Y + CARD_H - 14, s, { tier: p.tier, got: open });

    SG.ui.text(g, 'PRESENT ' + p.n, x + 86, CARD_Y + 42, {
      size: 15, color: '#fff', align: 'left', shadow: false,
    });
    SG.ui.text(g, p.wings === 0 ? 'already yours' : fmt(p.wings) + ' wings', x + 86, CARD_Y + 64, {
      size: 13, color: SG.COLORS.gold, align: 'left', shadow: false,
    });
    SG.ui.text(g, open ? 'UNWRAPPED' : fmt(p.wings - wings) + ' to go', x + 86, CARD_Y + 86, {
      size: 12, color: open ? SG.COLORS.green : 'rgba(255,255,255,0.5)', align: 'left', shadow: false,
    });
  }

  // Stands in for NEXT UP once there is nothing left to unlock -
  // otherwise that slot just repeats the grand prize card.
  function doneCard(g, x, wings) {
    SG.ui.panel(g, x, CARD_Y, CARD_W, CARD_H, {
      r: 16, fill: 'rgba(10,12,30,0.84)', border: SG.COLORS.green, borderWidth: 2.5,
    });
    SG.ui.text(g, 'ALL COLLECTED', x + CARD_W / 2, CARD_Y + 17, {
      size: 11, color: SG.COLORS.green, shadow: false,
    });

    var bx = x + 46, by = CARD_Y + CARD_H - 44;
    g.save();
    g.shadowColor = SG.COLORS.green;
    g.shadowBlur = 16;
    g.fillStyle = SG.COLORS.green;
    g.beginPath();
    g.arc(bx, by, 21, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = '#0d2415';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(bx - 9, by);
    g.lineTo(bx - 2, by + 8);
    g.lineTo(bx + 10, by - 8);
    g.stroke();
    g.lineCap = 'butt';

    SG.ui.text(g, 'TEN OF TEN', x + 86, CARD_Y + 42, {
      size: 15, color: '#fff', align: 'left', shadow: false,
    });
    SG.ui.text(g, fmt(wings) + ' wings', x + 86, CARD_Y + 64, {
      size: 13, color: SG.COLORS.gold, align: 'left', shadow: false,
    });
    SG.ui.text(g, 'Go get your prizes', x + 86, CARD_Y + 86, {
      size: 12, color: SG.COLORS.green, align: 'left', shadow: false,
    });
  }

  // How far up the last climb he is, when there is only one left.
  function progressCard(g, x, p, wings) {
    var accent = '#ffd166';
    SG.ui.panel(g, x, CARD_Y, CARD_W, CARD_H, {
      r: 16, fill: 'rgba(10,12,30,0.84)', border: accent, borderWidth: 2.5,
    });
    SG.ui.text(g, 'HOW FAR', x + CARD_W / 2, CARD_Y + 17, {
      size: 11, color: accent, shadow: false,
    });

    var frac = p.wings ? SG.clamp(wings / p.wings, 0, 1) : 1;
    SG.ui.text(g, Math.round(frac * 100) + '%', x + CARD_W / 2, CARD_Y + 48, {
      size: 30, color: '#fff', shadow: false,
    });
    SG.ui.text(g, fmt(wings) + ' of ' + fmt(p.wings), x + CARD_W / 2, CARD_Y + 74, {
      size: 13, color: SG.COLORS.gold, shadow: false,
    });

    var bx = x + 20, bw = CARD_W - 40, by = CARD_Y + 90, bh = 10;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    SG.roundRect(g, bx, by, bw, bh, 5);
    g.fill();
    if (frac > 0.01) {
      var grd = g.createLinearGradient(bx, 0, bx + bw, 0);
      grd.addColorStop(0, '#ff6b3d');
      grd.addColorStop(1, '#ffe38a');
      g.fillStyle = grd;
      SG.roundRect(g, bx, by, Math.max(bh, bw * frac), bh, 5);
      g.fill();
    }
  }

  function backdrop(g, CX) {
    var sky = g.createLinearGradient(0, 0, 0, SG.H);
    sky.addColorStop(0, '#161038');
    sky.addColorStop(0.5, '#2d1440');
    sky.addColorStop(1, '#5c1c34');
    g.fillStyle = sky;
    g.fillRect(0, 0, SG.W, SG.H);

    var rg = g.createRadialGradient(CX, BAR_Y, 30, CX, BAR_Y, 430);
    rg.addColorStop(0, 'rgba(255,176,46,0.16)');
    rg.addColorStop(1, 'rgba(255,176,46,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, SG.W, SG.H);

    g.globalAlpha = 0.13;
    for (var i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      SG.art.drawWing(g, f.x, f.y, f.s, f.r);
    }
    g.globalAlpha = 1;
  }
})();
