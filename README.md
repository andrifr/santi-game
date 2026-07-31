# SANTI: THE GAME

Five games, one Santi. Browser-based, mobile-first, landscape.

Live at **<https://andrifr.github.io/santi-game/>**

| # | Mode | Status |
| - | ---- | ------ |
| 1 | **Pickleball** — Santi vs. Dark Santi | **playable** |
| 2 | **Chicken Wing Run** — endless runner | **playable** |
| 3 | Brawl Showdown — draft a Santi, fight bots | planned |
| 4 | Smurf World — platformer vs. Gargamel | planned |
| 5 | Santi Simulator — a day in the life | planned |

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

**Kinder eggs.** One or two float over the far court at a time. Hit one
with the ball and it cracks in mid-air for a **100-wing bonus** — shell
halves tumble out and a random toy drops to the court. Then Daley
sprints on, grabs the toy and runs off with it. Play never stops for
her. The ball passes straight through an egg rather than deflecting, so
going for one can never cost you the rally.

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
js/stubs.js             "in development" screens for modes 3, 4, 5
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
