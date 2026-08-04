# SANTI: THE GAME

Five games, one Santi. Browser-based, mobile-first, landscape.

Live at **<https://andrifr.github.io/santi-game/>**

| # | Mode | Status |
| - | ---- | ------ |
| 1 | **Pickleball** — Santi vs. Dark Santi | **playable** |
| 2 | **Chicken Wing Run** — endless runner | **playable** |
| 3 | **Brawl Showdown** — draft a Santi, fight Daleys | **playable** |
| 4 | **Smurf World** — platformer vs. Gargamel | **playable** |
| 5 | **Santi Simulator** — a day in the life | **playable** |

## Art direction

Grungy, sprayed streetwear — box logos, graffiti tags, spray-can
colours — carried across every mode. Wing Run runs through Brussels at
dusk with the Atomium on the horizon and Grand-Place stepped gables in
the skyline; Rue and Daley appear in lit windows as easter eggs.

One rule holds everywhere: **nothing decorative goes on the playing
surface.** Text and colour on the road or the court read as instructions
and pull your eye off the thing you're supposed to be tracking. Graffiti
lives on walls and billboards.

## Run it locally

```bash
npx serve .          # or:
python -m http.server 8000
```

Then open <http://localhost:8000>. Double-clicking `index.html` works too.

## Publish to GitHub Pages

```bash
git init
git add -A
git commit -m "Santi: the game"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then **Settings → Pages → Source: Deploy from a branch → `main` / `/root`**.
Live a minute later at `https://<you>.github.io/<repo>/`.

After pushing an update, bump the `?v=` numbers on the script tags in
`index.html` — otherwise phones keep serving the cached copy.

## Playing fullscreen on iPhone

iOS Safari doesn't support the Fullscreen API, so browser chrome can't be
hidden from a normal tab. The workaround, which the game prompts for:

1. Open the Pages URL in Safari
2. **Share** → **Add to Home Screen**
3. Launch from the home-screen icon — no browser chrome
4. Turn the phone sideways

On Android and desktop the ⛶ button does real fullscreen plus an
orientation lock. Held in portrait on a phone, the game pauses and shows
a rotate prompt.

## Controls

**Chicken Wing Run**

| Action | Touch | Keyboard |
| ------ | ----- | -------- |
| Change lane | swipe ←/→, or tap the left/right third | ← → / A D |
| Jump | swipe ↑, or tap the middle | ↑ / W / Space |
| Slide | swipe ↓ | ↓ / S |

Obstacles tell you what they want: red striped crates must be dodged into
another lane, yellow hurdles jumped, blue scaffold bars slid under.
Wings are points; the green magnet pulls them in for 8 seconds; the hot
sauce gives 6 seconds of speed, invincibility and auto-collect.

**Pickleball**

Drag anywhere to move — your finger maps 1:1 onto the court. The swing is
automatic; what matters is *where* the ball meets you. Centre contact
returns it flat and fast, edge contact sends it wide and slow. First to
7. Dark Santi gets sharper as his score climbs.

Every point won pays **100 chicken wings** into the same jar Wing Run
fills, plus a 500 bonus for taking the match.

**Kinder eggs.** One or two hang over the far court in a beam of light.
Put the ball through the beam and the egg cracks in mid-air for a
**100-wing bonus** — shell halves tumble out and a random toy drops.
Then Daley sprints on, grabs the toy and runs off with it, while play
carries on around her.

The beam *is* the hitbox, at its drawn width and full height. You steer
the return left/right but have no control over its height, and the ball
bounces on the far court, so judging a shot in two axes would be luck —
the beam only asks whether you sent it through that column. The shadow
on the court shows the lane to aim at. Eggs time out after 7 seconds
and blink before they go; left up indefinitely a wandering ball clips
them on its own, which makes the bonus free instead of something you go
for. Measured: about half land for a player who never aims, essentially
all of them for a player who does. The ball passes through rather than
deflecting, so going for one can never cost you the rally.

**Brawl Showdown**

Five Daleys close in and smother Santi with hearts. Each round you draft
which Santi you are, then one of three power-ups; the power-ups stack for
the rest of the run, and every round adds another Daley and makes them
tougher.

| Action | Phone | Desktop |
| ------ | ----- | ------- |
| Move | left thumb | W A S D |
| Aim | hold right thumb | hold left mouse |
| Shoot | release | release |
| Quick shot | tap the right half — auto-aims at the nearest | click |

**Hold to aim, release to shoot.** While you're holding, the exact shot
line, its reach and (for Dark Santi) the spread cone are drawn on the
ground, so you can see where it goes before you commit it.

**Three shots, then a reload.** Shells come back one at a time, about a
second each, shown as pips under Santi's feet. You can't just hold the
trigger down.

**He heals** slowly once he's been out of the fight for a few seconds —
neither shooting nor being hit.

| | Health | Power | Range | Speed |
| --- | --- | --- | --- | --- |
| **Santi** | 110 | ●●●○○ | ●●●○○ | ●●●●○ |
| **Dark Santi** | 150 | ●●●●● | ●●○○○ | ●●●○○ |
| **Santi Noir** | 80 | ●●●●○ | ●●●●● | ●○○○○ |

Every kit totals exactly 10 dashes, so no build is strictly better.
Standing still kills you in about six seconds. Keep moving and a round
runs 15–20.

**Smurf World**

Santi in a white smurf cap, running through mushroom country after
Gargamel. Four levels: the village, the wood, the gate, and the lair.

| Action | Phone | Desktop |
| ------ | ----- | ------- |
| Run | anywhere in the bottom-left corner | ← → / A D |
| Jump | anywhere on the right half | ↑ / W / Space |
| Jump higher | hold it | hold it |

**Hold to jump higher.** A tap clears 66px, a full hold 132px — a tap
gets you over a gnap, a hold gets you onto a ledge. Nothing in the game
*requires* the hold, including Gargamel.

The whole bottom-left corner steers, split down the middle, not just the
two drawn arrows. Both thumbs work at once and a thumb can slide from
one side to the other without lifting — a dead zone between the arrows
stops a player dead and reads as the game being broken. The pads sit
clear of the very bottom edge, which on an iPhone belongs to the
home-indicator gesture.

If a direction ever does jam on, **pausing releases every touch** — as
does leaving to the menu, or switching away from the app and back.

**Stomp what you can, dodge what you can't.** Gnaps — Gargamel's hooded
little helpers — die under your feet and pay out. **Azrael never dies**:
land on him and he sits down stunned for two seconds, walk into him and
it costs a heart. He charges when he sees you, but never faster than you
can run.

Four hearts per level, refilled at the start of each one. Fall down a
hole and you lose one and get put back on solid ground with room to run,
rather than at the top of the level. The box that hurts you is always
narrower than the enemy you can see — losing a heart to a gap you could
see daylight through is the worst feeling a platformer has.

The villages are inhabited. Smurfs hammer, dig, fish, wave and dance
outside their houses in the background, and Gargamel has one of them in
a cage in his lair — beat him and the door comes off its hinges.

Levels are built from hand-made chunks laid end to end, so no two runs
are the same shape, but every chunk starts and ends on solid ground —
there is no join that can't be jumped.

**Waffles are the currency**, because a Belgian recipient deserves
Belgian money. They lie around the levels and they fall out of bricks
you headbutt from underneath — some bricks hold three. Every brick and
box hangs low enough that a *tapped* jump reaches its underside.

At the end of each level the waffles are **traded for chicken wings** at
5:1, and you watch the count tick over. It happens on a clear, on a
death, on a restart and on quitting to the menu, so stopping never costs
you the ones you found. A cleared level pays 80 wings on top, and
Gargamel is worth **100** — stated on the victory panel, because a
bounty paid silently is a bounty nobody believes they got.

**Question boxes** hold one of three:

| | |
| --- | --- |
| **Hot sauce** | 35% faster for 8s, with a trail |
| **Golden wing** | untouchable for 8s — nothing hurts you and anything you walk into is destroyed |
| **Red mushroom** | **BIG SANTI** for 7s: he grows for real, hitbox and all, and barges enemies over instead of taking damage |

Big Santi flashes for the last two seconds so the shrink is never a
surprise. Take a hit while big and it costs the power-up rather than a
heart.

The flag at the end of each level flies **Gargamel's** colours until
Santi reaches the pole. Then his banner drops and the smurf flag climbs
the pole in its place.

**The lair.** He throws potions that leave acid where they land, and
summons gnaps. He can't be touched on his feet — but every so often he
leaps at you, lands hard and collapses onto his knees with his head
down, and the acid on the floor fizzles out with him. That is the
window, and the game says so out loud. Three stomps and he's finished.

You don't have to wait for one, though. **The bouncy toadstool in the
middle of the arena throws you 228px up — his head is at 168 — so you
can drop on him and put him down yourself**, then stomp him while he's
there. Waiting works and takes about twenty seconds; making your own
openings takes ten.

His dazed head sits under a **tapped** jump, not a held one. Held, he
was unkillable for anyone who doesn't know to hold the button — which
is not difficulty, it's a wall.

**Santi Simulator**

A side-on flat you walk through: bedroom, bathroom, closet, living room,
kitchen, hall, and the street outside. Tap anywhere to walk there; tap an
object to walk to it and use it. A guide arrow tracks the current task,
with an edge marker pointing the way when the target is off screen.

Thirteen steps make up one day: get up, microwave the bread and cheese,
hairspray, pick a Supreme tee (your choice changes what he wears for the
rest of the day), leash Rue, walk her to the tree and back, film a
*Santi Can't* video, destroy five wings, ring Daley, go to bed. Each one
pays 40 wings into the same jar as the other modes.

Everything else in the flat is tappable too — the TV, the couch, the
fridge, the alarm clock, the bin outside — and answers with a line
rather than a shrug. The day is the spine, not the whole of it.

The bathroom mirror is worth a look. Most of the time it agrees with
him. About a third of the time it doesn't show him at all.

## Sound

All effects are synthesized in the browser — no audio files, no load
cost. Two recorded clips are the exception:

| File | When |
| ---- | ---- |
| `assets/voice/lap.mp3` | Santi's own "Lap!" — when Dark Santi takes a point, when a Wing Run ends, when a Brawl round is lost, and when Gargamel finishes him |
| `assets/sound-effects/shortfart.mp3` | roughly every 10th jump in Wing Run and Smurf World (randomised 8–13 so it isn't metronomic) |

Both degrade gracefully: if a file is missing or won't decode, the
synthesized cue plays instead and the game retries next time. iOS can't
create an audio context until the first touch, so clips are fetched
immediately and decoded on that first tap.

## Characters

`assets/faces/` holds transparent cutouts of Santi, Daley and Rue. The
game crops the head out of a portrait and draws it on an animated body,
so one image yields a full run cycle. **Dark Santi** is the Michael
Jackson portrait — fedora, gold aviators, black fit.

See `assets/faces/README.md` for how to add or regenerate art.

## Layout

```
index.html              shell + PWA meta
css/style.css           page chrome, rotate overlay, iOS install hint
js/engine.js            canvas/viewport, input, audio, save, art, scenes
js/menu.js              mode select
js/wingrun.js           mode 2 - chicken wing run
js/pickleball.js        mode 1 - santi vs. dark santi
js/sim.js               mode 5 - santi simulator
js/brawl.js             mode 3 - brawl showdown
js/smurf.js             mode 4 - smurf world
js/stubs.js             "in development" screen (nothing uses it now)
js/main.js              boot + art manifest
tools/optimize-faces.js trims/downscales character art (node, no deps)
tools/make-icons.js     regenerates the PWA icons (node, no deps)
```

Everything is authored against a virtual 960×540 canvas. The virtual
width stretches with the screen's aspect ratio (up to 1400) so a phone
fills edge to edge instead of pillarboxing, while the middle 960 stays
visible everywhere — lay UI out relative to `SG.W / 2`.

Plain scripts, no modules, no build step, no dependencies.

## Adding a mode

Each mode is a scene object with `enter`/`update(dt)`/`draw(ctx)`:

```js
SG.register('mymode', {
  enter: function (params) { /* set up */ },
  update: function (dt)    { /* input + physics */ },
  draw:   function (g)     { /* render */ },
});
```

Register it in `index.html`, then point the matching entry in
`js/menu.js`'s `MODES` at it and set `ready: true`.

Scene changes are queued and applied at the top of the next frame, so
it's safe to call `SG.go()` from inside a draw handler (which is where
button hits are detected).
