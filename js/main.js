/* =============================================================
   Boot
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  var F = 'assets/faces/';

  // Needed before anything is drawn in-game. Kept small so the first
  // frame on mobile isn't waiting on a megabyte of art.
  // `head` points at an already-isolated head, which beats cropping one
  // out of the bust - no chin gets clipped and no crop needs guessing.
  // `src` is still the full portrait, used for the circular face bubbles
  // on menus and scoreboards.
  var CORE = [
    { key: 'santi', src: F + 'santi.png',    head: F + 'santi-head.png' },
    // Dark Santi wears the hat and the shades. Ungraded - the art is
    // already dark and the gold rims are the best part of it.
    { key: 'dark',  src: F + 'santi-mj.png', head: F + 'santi-mj-head.png' },
  ];

  // Everything else: alternate skins, Daley, Rue. Only used on menus and
  // in the modes still being built, so it loads after the game is up.
  // (No 'santi-mj' entry - that art loads above as 'dark'.)
  var EXTRA = [
    // Santi Noir - the same head run through a black-and-white grade.
    { key: 'noir',        src: F + 'santi.png', head: F + 'santi-head.png', grade: SG.art.grades.noir },
    { key: 'santi-side',  src: F + 'santi-side.png' },
    { key: 'santi-chain', src: F + 'santi-chain.png' },
    { key: 'daley',       src: F + 'daley.png' },
    { key: 'daley-side',  src: F + 'daley-side.png' },
    { key: 'rue',         src: F + 'rue.png' },
    { key: 'rue-side',    src: F + 'rue-side.png' },
    { key: 'rue-face',    src: F + 'rue-face.png' },
  ];

  // Santi saying "Lap!" - plays when he loses. Decoded once the audio
  // context wakes up on first touch; the synth cue covers it until then.
  SG.audio.loadSample('lap', 'assets/voice/lap.mp3');
  // Occasional accompaniment to a jump in Wing Run.
  SG.audio.loadSample('fart', 'assets/sound-effects/shortfart.mp3');

  SG.start('menu');
  SG.initShell();

  // Non-blocking: art pops in as soon as it's decoded, and the drawn
  // placeholder is used until then.
  SG.art.load(CORE, function () { SG.art.load(EXTRA); });
})();
