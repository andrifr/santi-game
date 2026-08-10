# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser game made as a personal gift: five arcade modes starring a real
person (Santi), his girlfriend Daley and his dog Rue. Mobile-first,
landscape, deployed to GitHub Pages at
<https://andrifr.github.io/santi-game/> from `main`.

All five modes are playable — Pickleball, Chicken Wing Run, Brawl
Showdown, Smurf World, Santi Simulator. `js/stubs.js` still registers the
"in development" screen but nothing routes to it any more.

## Commands

There is no build, no bundler, no test runner and no linter. Editing a
file and reloading is the whole loop.

```bash
python -m http.server 8000     # or: npx serve .
```

Serve over HTTP rather than opening `index.html` directly — `getImageData`
is blocked on `file://`, which the art pipeline depends on.

```bash
node tools/optimize-faces.js   # regenerate character art from sources
node tools/make-icons.js       # regenerate PWA icons
```

Both are dependency-free (hand-rolled PNG codec on node's zlib). Run
`optimize-faces.js` after adding art to `assets/faces/`; it trims to the
alpha bounding box and downscales the long edge to 512px (currently
22MB → 2.2MB). Add new art to its `JOBS` list.

`make-icons.js` builds every launcher icon from
`assets/icons/source-icon.png` — a photo of Santi. Replace that one file
and re-run it. It also emits `icon-512-maskable.png` inset on the app
background, because Android crops a maskable icon to the launcher's own
shape and only the middle 80% is guaranteed to survive; full bleed cuts
the top of his hair off. Node has no JPEG decoder, which is why the
`.jpeg` original had to be converted through a browser canvas once.

Syntax check before committing — nothing else will catch a typo:

```bash
node --check js/engine.js      # and each other js/*.js
```

Deploying is `git push origin main`. Pages takes 20–60s; poll
`index.html` for the new `?v=` rather than assuming.

## Architecture

Plain scripts on a global `SG` namespace, loaded in order by
`index.html`. No modules — that keeps it working from `file://` and
avoids a build step. `js/engine.js` must load first; `js/main.js` last.

**`js/engine.js`** is everything shared: canvas/viewport, input, audio,
save, art, particles, canvas UI widgets, scene manager and main loop.
Each mode is one file registering one scene.

### Virtual canvas — the most bug-prone invariant

`SG.H` is fixed at 540. **`SG.W` is not constant.** It is recomputed on
every resize as `clamp(540 * aspect, 960, 1400)` so a phone fills edge to
edge instead of pillarboxing. The middle 960 is always visible.

Anything derived from `SG.W` at module load is wrong. Compute layout
inside `draw()`/`update()`, or from `SG.W / 2`. Several modes cache
`CX = SG.W / 2` and refresh it at the top of both `update` and `draw`.

### Scenes

```js
SG.register('name', {
  enter(params) {}, update(dt) {}, draw(ctx) {}, onBlur() {},
});
```

`SG.go(name, params)` is **deferred** — queued and applied at the top of
the next frame. Buttons are resolved during `draw()`, so switching scenes
immediately would mutate `current` halfway through its own render.

### Input

`SG.input` collects taps, swipes and live pointers, and **clears taps and
swipes at the end of every frame**. Consume them in `update()`, or via
`SG.ui.button()` / `SG.input.tappedRect()` during `draw()`.

Two consequences worth knowing:

- A scene that consumes all taps in `update()` will starve its own
  buttons. Claim fixed UI (like the pause button) *before* the general
  input handling.
- `SG.ui.button()` resolves during `draw()`. Any headless test that only
  steps `update()` will hang on button-driven screens.

`pointers[id].type` is `'mouse'` or `'touch'`. Brawl branches on it so a
mouse is always the aim and is never mistaken for the left-hand movement
stick.

**A pointer only leaves `pointers` when its release arrives.** If it
never does, anything reading held input behaves as though a finger were
welded to the screen — and because the map lives in the engine, it
survives `reset()`, scene changes and the menu. Only a reload cleared
it, which is exactly how it was reported: *"restarting the level didn't
work, closing the app did."* iPhone only, because the bottom edge is
the home-indicator gesture area and the release gets delivered
elsewhere. Defences, all in `engine.js`:

- `setPointerCapture` on pointerdown, so move/up come back to the canvas
  even if the finger wanders off it.
- `pointerup`/`pointercancel` listeners on `window` as well as the
  canvas, plus `lostpointercapture`.
- `SG.input.releaseAll()` — called on scene change, on
  `visibilitychange`, on window blur/pagehide, and while the loop is
  paused. Call it from a mode's pause handler too, so pausing is a way
  out.

Do **not** add a stale-pointer timeout: holding a direction for a whole
level is legitimate input, and a timeout that expires mid-level is a
worse bug than the one it fixes.

Every mode that reads held input (Brawl's sticks, Pickleball's drag,
Smurf World's pad) calls `releaseAll()` from its pause handler, so
"press pause" is the universal way out. Wing Run and the Simulator read
only taps and swipes and cannot latch.

### Art

Source art lives in `assets/faces/` alongside its generated outputs. The
generated files are what ship; sources are kept only so the optimiser can
be re-run.

`SG.art.load([...])` accepts per-entry:

- `src` — full portrait cutout. Becomes `art.sprites[key]` and the
  circular bust `art.faces[key]` used on menus and scoreboards.
- `head` — an already-isolated head. Becomes `art.heads[key]` and sets
  `art.headWhole[key]`. Preferred: exact head box, nothing to infer.
- `grade` — an alpha-preserving recolour from `SG.art.grades`
  (`dark` for Dark Santi, `noir` for Santi Noir).

Without a `head`, the engine crops one from the bust by finding the neck
in the alpha silhouette (widest row near the top, then the narrowest row
before the shoulders flare). This works for Daley and Rue; it fails on
portraits with a hat brim or a high collar, which is why Dark Santi ships
a dedicated head image.

`SG.art.drawSanti()` draws an animated body with the head on top, so one
still portrait yields a full run cycle. `skin`/`shoe` options exist
because forearms, hands and shoes are *drawn*, not taken from the
portrait — a graded head alone leaves them the wrong colour.

Missing art is never fatal: everything falls back to drawn placeholder
faces.

### Save and currency

One `localStorage` key (`santigame.v1`). **Chicken wings are the shared
currency** — every mode pays into `save.data.wings`. Bank them as they're
earned, not at the end of a run.

**Every mode pays at the same rate: ~130 wings per minute** for a
competent player. Wing Run is the anchor — one collected wing is one
banked wing, which is the whole fiction of the mode — and the others are
scaled to meet it (`WINGS_PER_TASK`, `WINGS_PER_POINT`/
`WINGS_MATCH_BONUS`/`EGG_WINGS`, `WAFFLE_WINGS`/`CLEAR_WINGS`/
`BOSS_WINGS`, `roundWings()`). They were 2–2.5x apart before, and the
mode that pays best is the only one anyone plays. **If you retune one,
retune them all against the target** — and remember the present ladder
is denominated in minutes, so changing a payout silently moves how long
the grand prize takes.

Changing the economy retroactively devalues what's already banked. The
`econ2` flag in `save.load` is the one-time migration that doubled
existing balances when the goals doubled; anything similar needs the
same treatment, because those presents are real objects someone is
already holding.

**Daley's raid** (`js/presents.js`) fires once, at 19,000 wings, on the
presents screen — never mid-run, where a cutscene would take the
controls away during a fight. She eats the whole jar and the ladder
re-bases: `raidWon` records how many presents were collected at that
moment (capped at `RAID_KEEP_MAX`, so the grand prize is never among
them), those goals become 0 so they stay collected, and the rest are
spread across `RAID_TOTAL`. It triggers on *opening the screen*, so
banking past the grand prize first does not dodge it. Two invariants:

- **A collected present can never become uncollected.** It's a real
  object someone was handed. `raidWon` is counted while the pre-raid
  ladder is still live, precisely so a player who arrives holding more
  than the usual six doesn't lose one.
- **Re-basing is not optional.** Leaving the goals untouched after the
  wipe would mean 86 minutes of climbing with no present at all, which
  is worse than not having the cutscene at all.

`js/presents.js` spends that currency on ten **real, physical
presents** — a milestone bar reached from the PRESENTS tab on the menu,
with #5 the bigger present and #10 the grand prize. The thresholds are
the `GOALS` array at the top of the file and nothing else hardcodes
them; the bar, the labels, the cards and the menu tab all read that one
list, and `SG.presents` exposes `count/frac/next/unseen/draw` for the
tab. A second save key, `presentsSeen`, records how many have been
celebrated, so the reveal animation and the tab's badge fire once each.
The tab sits **top left**: `#fsBtn` is a DOM overlay pinned to the top
right at a higher z-index, so anything drawn under it is invisible and
un-tappable.

Smurf World collects **waffles** and trades them for wings at 5:1. That
exchange still counts as banking-as-you-earn because it runs whenever a
level ends — cleared, died, restarted *or* quit to the menu — so putting
the phone down never costs anything. If you add another end-of-level
route out of a mode, it has to call `cashIn()` too.

### Audio

All effects are synthesized (`SG.audio.play(name)`), so there is no load
cost. Two recorded clips are the exception, loaded via
`SG.audio.loadSample()` and falling back to the synth cue if a file is
missing or won't decode. iOS cannot create an AudioContext before the
first touch, so samples are fetched immediately and decoded on that tap.

**Music is a separate channel.** Every mode loops its own track from
`assets/music/`: `SG.audio.music.loop(url)` in `enter()`, `stop()` in
`exit()`, and `follow(paused)` every frame from `update()`, which is
idempotent so a mode need not track what it last asked for.
`SG.audio.music.playThenLoop(a, b)`
streams through an `<audio>` element, *not* the sample path — a
multi-megabyte `decodeAudioData` costs a visible hitch and keeps the
whole PCM resident. Whoever starts it must stop it: the scene's `exit()`
is the only reliable place, since every way out of a mode goes through a
scene change, and `stop()` also drops the source so the rest of the file
stops downloading. Autoplay will sometimes refuse, because a deferred
scene change puts `play()` in a rAF callback rather than the tap that
caused it; the request is held and retried from `audio.unlock()`, which
every pointerdown calls.

**No third-party audio ships here.** The repo is public and Pages serves
it, so anything committed is published rather than private — the only
recorded clips are the family's own. A commercial K3 track was offered
and declined for this reason; `assets/k3songs/` is gitignored so it
can't be swept in by a `git add -A`. Transcribing a copyrighted tune
into note data is the same problem in a different file format, so that
is out too. Original tunes or the family's own recordings are fine.

### Depth-squashed modes (pickleball, brawl)

`y` is depth and is squashed by `SQUASH` **only when rendering**.
Velocities, collisions and distances are world-space. Applying `SQUASH`
during physics integration bends projectiles away from anything offset in
depth — an easy and near-invisible bug.

## Gotchas that have already cost time

- **Bump `?v=` in `index.html` after editing any JS or CSS, and `CACHE`
  in `sw.js` with it.** Otherwise the browser serves a stale copy and
  you debug a file that isn't running. The service worker does not make
  this worse - every script is asked for by a versioned URL, so a bump
  requests something that was never cached - but the old entries only
  get evicted when the cache name changes.
- **A headless/background browser throttles `requestAnimationFrame`, and
  `dt` is clamped to 0.05.** The game then runs in roughly 4x slow
  motion, so wall-clock measurements are badly wrong. For tuning, drive
  `scene.update(1/60)` (and `scene.draw(ctx)`) directly in a loop.
- **Fast projectiles need a swept test** against the segment they
  travelled, not a point check, or they skip past targets between frames.
- **Entities can spawn inside colliders.** Push spawns clear, and let
  anything already inside move out — a collider that reverts every move
  traps it permanently.
- **A flying enemy sits in the band a jump passes through.** In Smurf
  World the player's head crosses y ≈ 240–370 mid-jump, so a hovering
  enemy over a *mandatory* jump or landing platform is an unavoidable
  hit. Fliers only patrol wide, continuous ground.
- **An enemy faster than the player has no counterplay.** Azrael's dash
  is capped below the run speed so he can always be outrun.
- **After a boss takes a stomp, make him harmless for a beat.** Reverting
  him to his walk state leaves the player inside him on the bounce, so
  every landed hit costs a heart.
- **An overlapping tap target must resolve to the nearest centre, not
  the first match.** The Simulator picks objects by scanning a list; a
  small prop standing in front of a big one was unreachable because the
  big one's band was hit first and the loop broke.
- **Nothing decorative goes on a playing surface.** Text or colour on the
  road or the court reads as an instruction and pulls the eye off what
  the player should be tracking. Graffiti belongs on walls and
  billboards. (Established by user feedback; applies to all modes.)
- **Touch controls belong clear of the bottom edge of the screen.** On
  an iPhone that strip is the home-indicator gesture area; a thumb
  parked there has its touch taken by the system mid-press.
- **The top right corner belongs to `#fsBtn`.** It is a fixed DOM
  overlay at a higher z-index covering roughly the first 66 virtual
  pixels of that corner on the smallest phone, so anything drawn under
  it is invisible and un-tappable. `SG.ui.pauseRect()` / `drawPause()` /
  `drawWings()` are the shared in-game HUD corner, held left of it; use
  them rather than placing a button there by hand.
- **Drawn touch buttons are a hint, not the hit box.** Smurf World's
  pads read a whole screen half, not the rectangle they draw: a thumb
  that drifts a few pixels off a small button falls into a dead zone and
  stops the player dead, which is what "gets stuck" and "not sensitive
  enough" meant. Two padded rects side by side are the same trap, since
  they overlap and the boundary silently favours whichever is tested
  first - use one zone with a split instead.
- **Image previews may ignore alpha.** Several source cutouts look like
  they still have a background when they do not. Check the alpha channel
  before "fixing" it — a background-removal pass on an already-cut image
  destroys it.

## Verifying changes

There are no tests. Changes are verified by driving the real game in a
browser and measuring, not by looking at screenshots — three separate
brawl bugs were invisible in a still.

The pattern that works: temporarily add `__debug: function () { return
st; }` to the scene's registration, drive `update`+`draw` at a fixed
`dt`, push synthetic entries onto `SG.input.taps` / `SG.input.pointers`,
and assert on the resulting state. **Remove the hook before committing**
— `grep -rn __debug js/` should come back empty.

Four ways this has produced false results, all of which looked like game
bugs and were not:

- A synthetic pointer that was never released — the game correctly
  believes aim is held forever.
- State carried over from a previous case. Call `enter()` between them.
- **Keys left set between phases.** A helper that only writes the keys
  you pass leaves the others as they were, so a leftover `KeyA` silently
  cancels the `KeyD` you just set and the player never moves. Clear all
  keys between cases.
- **Teleporting the player without moving the camera.** Screen
  coordinates are computed from `st.cam`, which lerps; set `cam` too, or
  the tap you synthesize lands off-screen and is correctly discarded.

## Installing, and offline

`sw.js` caches the shell and everything with a `?v=` on it, so the game
plays with no signal. Music is deliberately excluded - the five tracks
are ~21MB. Navigations are network-first so a deploy is picked up as
soon as the phone is online; the cache is only the offline fallback.

The service worker is also what makes the **Android install prompt**
exist at all: Chrome only fires `beforeinstallprompt` for a site that
answers a navigation offline. The engine keeps that event and puts a
real Install button in the `#a2hs` banner. **iOS has no install API** -
Safari only has Share > Add to Home Screen - so there the same banner
can do no more than say where the button is.

## iOS

Safari has no Fullscreen API, so the game ships as an installable PWA and
prompts for Add to Home Screen; Android and desktop get real fullscreen
plus an orientation lock. Held in portrait on a touch device the loop
pauses and a rotate overlay shows.
