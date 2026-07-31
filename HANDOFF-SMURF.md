# Handoff — Smurf World (mode 4, the last one)

## The project

`C:\websites\games\SantiGame` — a browser game built as a gift for the
user's daughter's boyfriend, Santi. Mobile-first, landscape, five arcade
modes. Deployed to GitHub Pages from `main`:

**Live:** <https://andrifr.github.io/santi-game/>
**Repo:** `github.com/andrifr/santi-game` (public, `gh` CLI is authenticated)

Read `CLAUDE.md` in the repo first — it covers architecture, commands and
the invariants that have already cost debugging time. This document is
only about the one remaining mode.

**Four of five modes are done and live:** Pickleball, Chicken Wing Run,
Brawl Showdown, Santi Simulator. Smurf World is a stub.

---

## What Smurf World is meant to be

The user's original brief, verbatim:

> supermario but with smurfs instead of mario and co. — like the
> traditional mario like, but replace landscape with smurf themes and all
> the enemies with Gargamel and his cat

The plan currently shown in-game on the stub screen (`js/stubs.js`), which
the user has seen and not objected to:

- Side-scrolling platformer through mushroom villages
- Stomp Gargamel's minions, dodge Azrael the cat
- Collect sarsaparilla, hit the flag at the end
- Boss fight: Gargamel himself

Menu card already exists: number 4, title **SMURF / WORLD**, tagline
*"Gargamel must fall"*, colour `#4aa8ff`, and a hand-drawn mushroom-house
icon in `js/menu.js` → `drawIcon()` → `case 'smurf'`.

### One open design question — worth asking the user

Every other mode stars Santi as himself. The brief says to replace Mario
*and co.* with smurfs, which implies the player is a smurf. The obvious
reconciliation is **Santi in a white phrygian cap in a smurf-themed
world** rather than an anonymous smurf — it keeps the game about him and
reuses the existing head art. Recommend confirming before building.

### Intellectual property

Smurfs, Gargamel and Azrael are someone else's IP. For a private gift
this is a non-issue in practice, but **draw original "blue forest gnomes"
and an original "bald wizard and his cat" rather than pulling real Smurf
sprite sheets.** This was flagged at the start of the project and
accepted. It is also simply faster and looks more cohesive with the rest
of the game, which is entirely hand-drawn in canvas code.

### Art situation

No smurf/Gargamel art exists yet. Note how art works in this project:

- **All environment art is procedural** — drawn in canvas code. Rooms,
  streets, arenas, crates, trees, the Atomium, mushroom houses. Nothing
  is a tileset.
- **Only characters come from image files**, in `assets/faces/`.

So Gargamel and Azrael can either be drawn procedurally like every other
environment element, or the user can supply illustrated cutouts. **The
user has been generating character illustrations throughout this project
and supplying them** (Santi, Dark Santi, Daley, Rue, plus isolated head
crops on request). Asking for a Gargamel and an Azrael in the same style
is likely to work well. Build with procedural placeholders in the
meantime — the loader already degrades gracefully when art is missing.

---

## How to build it

### Integration checklist

1. Create `js/smurf.js`, registering a scene named `smurf`.
2. Add `<script src="js/smurf.js?v=NN"></script>` to `index.html`,
   after `js/sim.js` and before `js/stubs.js`.
3. In `js/menu.js`, flip the `smurf` entry in `MODES` to
   `scene: 'smurf', ready: true`.
4. Remove the `smurf` block from `PLANS` in `js/stubs.js`.
5. **Bump every `?v=` in `index.html`** (currently `v=46`) or browsers
   serve stale JS.
6. Update the mode table and the Controls section in `README.md`.
7. Commit, push, then poll `index.html` for the new `?v=` — Pages takes
   20–60 seconds.

### Scene contract

```js
SG.register('smurf', {
  enter(params) {},     // reset state
  update(dt) {},        // input + physics
  draw(ctx) {},         // render
  onBlur() {},          // pause when tab hides
});
```

`SG.go(name)` is deferred to the next frame, so it is safe to call from
inside `draw()` (which is where button hits are detected).

### Closest structural reference

**`js/sim.js`** is the nearest thing to a side-scroller already in the
repo: a side-on world several screens wide, world→screen via a camera
offset, objects sorted and drawn against a fixed floor line, a HUD, an
overlay system and a pause menu. Read it before starting.

`js/wingrun.js` has the obstacle-spawning and difficulty-ramp patterns if
the level is generated rather than authored.

### Input — the part most likely to trip you up

`SG.input` **clears taps and swipes at the end of every frame.** They are
one-shot events.

A platformer needs *held* input — run left, hold jump. Do **not** build on
taps. Use:

- `SG.input.pointers` — live map of pointers currently down, each with
  `{x, y, sx, sy, type}` in virtual coords (`sx/sy` are where it started,
  `type` is `'mouse'` or `'touch'`). This persists while held.
- `SG.input.keys` — live map keyed by `KeyboardEvent.code`
  (`KeyA`, `ArrowLeft`, `Space`, …).

For touch, the established pattern is on-screen zones or a floating
stick: `js/brawl.js` → `readControls()` shows a floating stick anchored
where the finger landed, and how to branch on `type` so a mouse is never
mistaken for a thumb.

Suggested for a platformer: left half of the screen = left/right movement
(or a floating stick), right half = jump while held. WASD/arrows +
Space on desktop.

### Drawing the player

```js
SG.art.drawSanti(ctx, x, yFeet, heightPx, animPhase, {
  face: 'santi',        // art key
  shirt, boxColor, boxInk, pants, skin, shoe,   // all optional
  run: 0..1,            // limb animation amount
});
```

Draws an animated body with a head cutout on top, so one still portrait
gives a full run cycle. `skin`/`shoe` matter if you tint the character —
forearms, hands and shoes are *drawn*, not taken from the portrait.

To put Santi in a smurf hat, draw the cap after `drawSanti` at roughly
`yFeet - heightPx` (the head art tops out around there).

### Art keys already loaded

`santi`, `dark` (Michael-Jackson Santi), `noir` (black & white),
`daley`, `daley-side`, `rue`, `rue-side`, `rue-face`, `santi-side`,
`santi-chain`.

Available as `SG.art.heads[key]` (head only, for bodies),
`SG.art.sprites[key]` (full cutout) and `SG.art.faces[key]` (circular
bust for HUD/menus).

### Audio cues available

`SG.audio.play(name)` where name is one of: `tap select back wing wingbig
jump slide crash power record pop smash bounce point lap sauce`.

**`lap`** plays Santi's real recorded voice saying "Lap!" — Flemish for
"darn", his catchphrase. It is reserved for **losing**, and should fire
when he dies or fails. Do not use it for minor setbacks.

A fart clip is loaded as sample key `fart` (`SG.audio.playSample('fart',
0.85)`), currently used on roughly every 10th jump in Chicken Wing Run.
**A jumping platformer is an obvious home for it** — worth reusing, but
keep it occasional, not every jump.

### Score and currency

```js
SG.save.submit('smurf', score);   // high score, key is per-mode
SG.save.best('smurf');
SG.save.data.wings += n;          // shared currency across ALL modes
SG.save.write();
```

**Chicken wings are the shared currency.** Every mode pays into the same
jar and the menu shows the total. Bank wings as they are earned, not at
the end of a run, so quitting mid-level does not wipe them. Collectibles
in this mode are sarsaparilla per the plan — pay wings on top, or make
sarsaparilla itself worth wings.

---

## Personalisation facts (these are what make it a gift)

| | |
| --- | --- |
| Catchphrase | **"Lap!"** — Flemish for "darn". Says it when he loses. Recorded voice clip exists. |
| YouTube channel | **"Santi Can't"** — appears on billboards and posters |
| Food | Chicken wings, **hot sauce** specifically |
| Clothing | Supreme box logos — coloured box + contrasting wordmark, via `SG.art.boxLogo()` |
| Girlfriend | **Daley** — she is the enemy swarm in Brawl, clogs the toilet in the Simulator |
| Dog | **Rue** — walked in the Simulator, will not poop |
| Games he plays | Fortnite, Brawl Stars |
| Difficulty | Middle. He is a gamer; do not make it trivial. |

---

## Art direction rules (learned from user feedback — do not undo these)

- **No graffiti.** An earlier grungy/sprayed treatment was built across
  two modes and the user asked for it to be removed entirely. Buildings
  and walls are plain now. Signage like the "Santi Can't" billboards is
  fine; tags and spray splats are not.
- **Nothing decorative goes on a playing surface.** Text or colour on the
  road, the court or the ground reads as an instruction and pulls the eye
  off what the player should be tracking. This was requested twice and
  then applied preemptively to a third mode.
- Clean, colourful, readable. Gameplay legibility beats atmosphere —
  background art was dimmed in Pickleball because it competed with the
  ball.

---

## Gotchas that have already cost time on this repo

- **`SG.W` is not constant.** Height is fixed at 540; width is
  recomputed per aspect ratio as `clamp(540 * aspect, 960, 1400)` so
  phones fill edge to edge. Anything derived from `SG.W` at module load
  is wrong — compute layout inside `update`/`draw`.
- **Bump `?v=` after editing any JS/CSS**, or you will debug a file that
  is not running. This has happened more than once.
- **`requestAnimationFrame` is throttled in a headless/background
  browser, and `dt` is clamped to 0.05** — the game then runs at roughly
  quarter speed, so wall-clock measurements are meaningless. For tuning,
  drive `scene.update(1/60)` and `scene.draw(ctx)` directly in a loop.
- **Buttons resolve during `draw()`**, so any headless test that only
  steps `update()` will hang on menu and draft screens.
- **Fast-moving things need a swept test** against the segment travelled,
  not a point check, or they pass through targets between frames. Bit me
  in both Pickleball and Brawl.
- **Entities can spawn inside colliders.** Push spawns clear, and let
  anything already inside move out — a collider that reverts every move
  traps it permanently. Relevant to a platformer with solid tiles.
- **Image previews may ignore alpha.** Several source cutouts look like
  they still have a background when they do not. Check the alpha channel
  before "fixing" one — a background-removal pass on an already-cut image
  destroys it.

---

## How to verify

There is no test runner, no linter, no build. `node --check js/smurf.js`
is the only thing that catches a typo.

**Verify by driving the real game and measuring, not by looking at
screenshots.** Three separate Brawl bugs were completely invisible in a
still image — projectiles curving off-axis, bots stuck inside crates, and
an enemy parked behind cover that could never be hit or killed. All three
were found by simulating play and noticing the numbers were impossible.

The pattern that works:

1. Temporarily add `__debug: function () { return st; }` to the scene's
   registration.
2. Drive `scene.update(1/60)` + `scene.draw(ctx)` in a loop at fixed dt.
3. Push synthetic entries onto `SG.input.taps` / `SG.input.pointers`.
4. Assert on resulting state — level completion, damage, deaths, timings.
5. **Remove the hook before committing.** `grep -rn __debug js/` must be
   empty.

Two ways this produced *false* results, both of which looked like game
bugs: a synthetic pointer that was never released (the game correctly
believed input was held forever), and state carried over between cases
without calling `enter()`.

Target feel: a level should take roughly 45–90 seconds. For reference,
tuned round lengths elsewhere are 15–20s (Brawl), 15–30s (Pickleball),
and about 2 minutes for a full Simulator day.
