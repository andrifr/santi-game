/* =============================================================
   Boot
   ============================================================= */
(function () {
  'use strict';
  var SG = window.SG;

  var F = 'assets/faces/';

  // Needed before anything is drawn in-game. Kept small so the first
  // frame on mobile isn't waiting on a megabyte of art.
  var CORE = [
    { key: 'santi', src: F + 'santi.png' },
    // Dark Santi is the same cutout run through a violet grade.
    { key: 'dark',  src: F + 'santi.png', grade: SG.art.grades.dark },
  ];

  // Everything else: alternate skins, Daley, Rue. Only used on menus and
  // in the modes still being built, so it loads after the game is up.
  var EXTRA = [
    { key: 'santi-mj',    src: F + 'santi-mj.png' },
    { key: 'santi-side',  src: F + 'santi-side.png' },
    { key: 'santi-chain', src: F + 'santi-chain.png' },
    { key: 'daley',       src: F + 'daley.png' },
    { key: 'daley-side',  src: F + 'daley-side.png' },
    { key: 'rue',         src: F + 'rue.png' },
    { key: 'rue-side',    src: F + 'rue-side.png' },
    { key: 'rue-face',    src: F + 'rue-face.png' },
  ];

  SG.start('menu');
  SG.initShell();

  // Non-blocking: art pops in as soon as it's decoded, and the drawn
  // placeholder is used until then.
  SG.art.load(CORE, function () { SG.art.load(EXTRA); });
})();
