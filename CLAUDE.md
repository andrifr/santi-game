# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser game made as a personal gift: five arcade modes starring a real
person (Santi), his girlfriend Daley and his dog Rue. Mobile-first,
landscape, deployed to GitHub Pages at
<https://andrifr.github.io/santi-game/> from `main`.

Four of five modes are playable — Pickleball, Chicken Wing Run, Brawl
Showdown, Santi Simulator. Smurf World is still a stub.

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

### Audio

All effects are synthesized (`SG.audio.play(name)`), so there is no load
cost. Two recorded clips are the exception, loaded via
`SG.audio.loadSample()` and falling back to the synth cue if a file is
missing or won't decode. iOS cannot create an AudioContext before the
first touch, so samples are fetched immediately and decoded on that tap.

### Depth-squashed modes (pickleball, brawl)

`y` is depth and is squashed by `SQUASH` **only when rendering**.
Velocities, collisions and distances are world-space. Applying `SQUASH`
during physics integration bends projectiles away from anything offset in
depth — an easy and near-invisible bug.

## Gotchas that have already cost time

- **Bump `?v=` in `index.html` after editing any JS or CSS.** Otherwise
  the browser serves a stale copy and you debug a file that isn't
  running.
- **A headless/background browser throttles `requestAnimationFrame`, and
  `dt` is clamped to 0.05.** The game then runs in roughly 4x slow
  motion, so wall-clock measurements are badly wrong. For tuning, drive
  `scene.update(1/60)` (and `scene.draw(ctx)`) directly in a loop.
- **Fast projectiles need a swept test** against the segment they
  travelled, not a point check, or they skip past targets between frames.
- **Entities can spawn inside colliders.** Push spawns clear, and let
  anything already inside move out — a collider that reverts every move
  traps it permanently.
- **Nothing decorative goes on a playing surface.** Text or colour on the
  road or the court reads as an instruction and pulls the eye off what
  the player should be tracking. Graffiti belongs on walls and
  billboards. (Established by user feedback; applies to all modes.)
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

Two ways this has produced false results: a synthetic pointer that was
never released (the game correctly believes aim is held forever), and
state carried over from a previous run (`enter()` between cases).

## iOS

Safari has no Fullscreen API, so the game ships as an installable PWA and
prompts for Add to Home Screen; Android and desktop get real fullscreen
plus an orientation lock. Held in portrait on a touch device the loop
pauses and a rotate overlay shows.
