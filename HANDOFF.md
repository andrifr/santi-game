# Handoff — Santi: The Game

## What this is

`C:\websites\games\SantiGame` — a browser game built as a gift for the
user's daughter's boyfriend, Santi. Mobile-first, landscape, five arcade
modes. Deployed to GitHub Pages from `main`.

**Live:** <https://andrifr.github.io/santi-game/>
**Repo:** `github.com/andrifr/santi-game` (public, `gh` CLI authenticated)

**Read `CLAUDE.md` first.** It has the architecture, the commands, and
every invariant that has already cost debugging time. This document
covers only what a fresh session needs on top of that: where the project
stands, how the user works, and what is still open.

**All five modes are finished and live.** Pickleball, Chicken Wing Run,
Brawl Showdown, Smurf World, Santi Simulator. There is no unbuilt work.
Everything from here is polish, driven by playtest feedback.

---

## How this project actually goes

The user's daughter plays it and reports back in plain language. Her
notes are short, non-technical, and **have been right every single
time**. Treat them as bug reports, not opinions.

Her feedback so far, and what each turned out to be:

| She said | It was |
| --- | --- |
| "enemies glitch" | Every gnap flipping direction 60×/sec, never patrolling at all |
| "final boss can't be killed" | Literally true — his head was above a tapped jump's reach |
| "dies if he gets anywhere near the enemy" | Hurt box wider than the drawn sprite |
| "gets stuck moving right" | A 170px tower against a 127px jump |
| "better side to side movement" | A dead zone between the two arrow buttons |
| "joystick gets stuck… closing the app fixed it" | A touch whose release never arrived, surviving every scene change |
| "the super is really hard to use" | Arm-then-aim was one step too many |

**The lesson: measure, don't assume.** Every one of those was found by
driving the real game and reading numbers, and several were invisible in
a screenshot. When she reports something, reproduce it numerically
before touching anything.

### The workflow that works

1. Reproduce the complaint as a measurement.
2. Fix the cause, not the symptom.
3. Re-measure, plus a regression sweep of the mode.
4. Screenshot for **art** questions only.
5. Strip `__debug` hooks, bump `?v=`, commit, push, poll Pages.

The user is happy for you to push to `main` — but the site is public, so
confirm before anything outward-facing that isn't a normal deploy.

### Deploy checklist

- Bump **every** `?v=` in `index.html` (currently **66**). Forgetting
  this means testing a file that isn't running — it has bitten twice,
  including once mid-session when the browser served a cached `engine.js`
  without a function I'd just added.
- `node --check js/*.js` — the only thing that catches a typo.
- `grep -rn "__debug\|__reset\|__kits" js/` must be empty.
- Push, then poll `index.html` for the new `?v=` (Pages takes 20–60s).
- Verify against the **live** URL, not just localhost — Pages is
  case-sensitive where Windows is not.

---

## Personalisation facts (these are what make it a gift)

| | |
| --- | --- |
| Catchphrase | **"Lap!"** — Flemish for "darn". Recorded in his own voice; reserved for losing |
| From | **Antwerp** — the Simulator poster says ANTWERP / 'T STAD |
| YouTube | **"Santi Can't"** — on billboards, posters, and the Simulator's video job |
| Food | Chicken wings, hot sauce specifically |
| Breakfast | **Cash topit** — what he calls bread with melted cheese |
| Guitar | He plays **Azizam** (Ed Sheeran). Only that |
| Girlfriend | **Daley** — the enemy swarm in Brawl, clogs the toilet in the Simulator |
| Dog | **Rue** — walked in the Simulator, will not poop |
| Music | **K3**. He claims Daley looks like **Kabouter Plop** — used as a night visitor |
| Games | Fortnite, Brawl Stars |
| Difficulty | Middle. He is a gamer; do not make it trivial |

---

## Art direction rulings (do not undo these)

- **No graffiti.** A grungy sprayed treatment was built across two modes
  and the user asked for it removed. Buildings and walls are plain now.
  Signage is fine; tags are not.
- **Nothing decorative on a playing surface.** Requested twice, then
  applied pre-emptively to a third mode.
- **Gameplay legibility beats atmosphere.**
- All environment art is procedural canvas code. Only characters come
  from image files. **The user supplies illustrated character cutouts on
  request** — that has worked well every time (Santi, Dark Santi, Daley,
  Rue, plus isolated head crops). If a mode needs a new character, ask.

---

## Copyright — settled, and it will come up again

The site is **public**, so anything committed is published, not private.

The user offered a K3 track (`assets/k3songs/`, a 9.66 MB 320kbps rip of
a commercial release, tags and album art intact) for the Simulator's
speaker. It was declined and the folder gitignored, because a routine
`git add -A` would have published it.

Two follow-ons worth knowing:

- **Transcribing a copyrighted tune into note data is the same problem**
  in a different file format. Don't offer it as a workaround.
- **The open offer is a family recording.** If they send a few seconds of
  themselves singing, it drops straight into `SG.audio.loadSample()` like
  the "Lap!" clip, and for a gift it would land harder than the real
  track. This is the single best outstanding idea in the project.

---

## Where each mode stands

**Pickleball, Chicken Wing Run** — stable, untouched recently.

**Brawl Showdown** — three kits, each with a Super charged by damage
dealt (~2.5 Daleys' worth). **One press on a big button fires it**,
auto-aimed at the nearest, no arming step. Wing Storm (ring of 12
wings), The Lean (dash through with afterimages), Noir Shot (pierces the
arena, heals per hit). The Super is printed on the draft card.

The arena is 2000×1300 with 18 pieces of cover in four shapes (crate,
concrete wall, barrel, boulder) and 11 **bushes**. A bush blocks
nothing and stops no bullets — it only breaks line of sight. Standing
in one hides you until you shoot (`BUSH_REVEAL`, 1s) or a Daley gets
within `BUSH_SEE_R` (175). Measured: hiding cuts incoming fire from
121 shots per 40s to 45, with 4.3s of total safety before the first
one blunders in.

Daleys come in three sizes via `BOT_KINDS` — runt (0.66×, 40% health,
faster), normal, and the boss. **Everything size-dependent goes
through `scale`**: hitbox, sprite, shadow, health bar and the padding
she keeps off cover.

Every fifth round is a **boss round**. Once half the Daleys are down,
a 3-second BOSS INCOMING warning fires and Daley Prime arrives at the
far end — ~992 HP at round 5, with her exact HP on a bar at the top of
the screen. She is slower than every kit (71 vs 174–240) so she can
always be outrun, and the round cannot be won while a boss is still
owed, even if you wipe the field during the warning.

The thumb sticks are Brawl Stars style: **always on screen** at a
resting spot (blue bottom-left for movement, red with a target
bottom-right for shooting), they **jump to wherever the thumb lands**
with no easing, and drift home over ~0.3s when it lifts. Translucent at
rest (alpha 0.52), opaque in use (0.95). Hidden entirely unless
`SG.platform.touch`, and hidden once a mouse has been pressed —
`sawMouse` lives at module scope, not in `st`, because `st` is rebuilt
between rounds and a mouse is a fact about the device.

**Smurf World** — Santi in a smurf cap, four levels built from
hand-made chunks. Waffles are the collectible, traded for chicken wings
at 5:1 whenever a level ends. Bricks you headbutt, `?` boxes with three
power-ups (hot sauce / golden wing / big mushroom, which grows his
hitbox and stuns enemies for 7s). The end flag flies Gargamel's colours
until Santi reaches it, then swaps to the smurf flag. Gargamel can be
stunned by dropping on his head from the bouncy toadstool, not only by
waiting for his slam.

**Santi Simulator** — **he speaks in the first person throughout.** A
handful of flavour lines had slipped into third person ("He knows every
word") against a voice that was otherwise "I"; they were corrected. The
only remaining third-person mentions of him are other characters
addressing him and his own video intro. Keep new lines in "I".

The day is seeded off `save.data.simDays`, so it's
consistent within a day and different tomorrow. 10–14 jobs shuffled from
a pool, order-dependent ones moving as blocks. Different video, poster,
and night visitor each day (Daley ×3, Rue ×2, Krampus, K3, Plop — never
the same two nights running). Rue is pokeable outside with 14 lines of
Santi complaining about her. The speaker is flavour-only, not a job.

---

## Brawl joysticks — built, and the constraints that shaped them

Done. `stickHome()` / `updateSticks()` / `stepStick()` / `drawStick()`
in `js/brawl.js`. `readControls()` was left alone apart from the
`sawMouse` flag — the origin was already taken from `p.sx, p.sy`, so
"jumps to your finger" only ever needed a resting state to return to.

The layout numbers are load-bearing, and all of them were measured
rather than eyeballed:

- Homes are `(150, SG.H - 126)` and `(SG.W - 300, SG.H - 126)`,
  **anchored to their edges** like the super button (`SG.W - 168`) and
  the HUD panel (`x: 16`), not to the centre. A thumb reaches for a
  corner, so an edge anchor is right even though it puts the left stick
  outside the middle-960 safe band at `SG.W = 1400`.
- With a base radius of 70 that leaves **62px between the aim stick and
  the super button** and **56px above the bottom edge** — clear of the
  iPhone home-indicator strip. Both hold at every width, because
  `stickHome()` reads `SG.W` fresh every frame.
- **The origin must not be eased while held.** Smoothing it makes the
  aim lag the finger. Only the *release* animates.

Still true and still deliberate:

- A pointer starting inside `superRect()` is excluded from aiming.
- The aim stick ignores `a.mouse` — a mouse is an aim, never a thumb
  stick.

---

## Open threads

1. **The family K3 recording** (above). Highest-value idea outstanding.
2. **Difficulty is unvalidated by the actual recipient.** Everything is
   tuned against a bot and his daughter's feedback. Santi himself is a
   gamer and may find it easy. If he plays and says so, Smurf World
   levels 2–3 and Brawl's round scaling are the knobs.
3. **Gargamel and Azrael are drawn procedurally.** They read fine, but
   the user could supply illustrated cutouts in the style of the others
   if they wanted them sharper.
4. **No sound on the Simulator's speaker.** It says something instead.
   That was a deliberate revert, not an oversight — don't "fix" it.

---

## Traps that have wasted time in a test harness

All four of these produced results that looked like game bugs and were
not. They're in `CLAUDE.md` too, but they're worth repeating because
each one cost a full debugging detour:

- A synthetic pointer never released — the game correctly believes the
  finger is still down.
- State carried between cases without calling `enter()`.
- **Keys left set between phases** — a leftover `KeyA` silently cancels
  the `KeyD` you just set, and the player mysteriously won't move.
- **Teleporting the player without moving `st.cam`** — the tap you
  synthesize lands off-screen and is correctly discarded.

And the one that isn't a harness problem: **`requestAnimationFrame` is
throttled in a headless browser and `dt` is clamped to 0.05**, so
wall-clock timing is meaningless. Drive `update(1/60)` directly.
