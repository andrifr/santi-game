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

- Bump **every** `?v=` in `index.html` (currently **64**). Forgetting
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

**Smurf World** — Santi in a smurf cap, four levels built from
hand-made chunks. Waffles are the collectible, traded for chicken wings
at 5:1 whenever a level ends. Bricks you headbutt, `?` boxes with three
power-ups (hot sauce / golden wing / big mushroom, which grows his
hitbox and stuns enemies for 7s). The end flag flies Gargamel's colours
until Santi reaches it, then swaps to the smurf flag. Gargamel can be
stunned by dropping on his head from the bouncy toadstool, not only by
waiting for his slam.

**Santi Simulator** — the day is seeded off `save.data.simDays`, so it's
consistent within a day and different tomorrow. 10–14 jobs shuffled from
a pool, order-dependent ones moving as blocks. Different video, poster,
and night visitor each day (Daley ×3, Rue ×2, Krampus, K3, Plop — never
the same two nights running). Rue is pokeable outside with 14 lines of
Santi complaining about her. The speaker is flavour-only, not a job.

---

## Next up — Brawl joysticks, requested and not yet built

Make the two sticks work and look like Brawl Stars'. All of it lives in
`drawSticks()` (`js/brawl.js`, ~line 941) and `readControls()`.

**Wanted:**

- **Always visible**, not only while a finger is down. They currently
  render only when `st.moveStick` / `st.aim` exist, which is to say only
  mid-press, so a new player sees no controls at all.
- **The stick jumps to the finger.** Press anywhere in that half and the
  stick re-homes there rather than making you find it. When nothing is
  pressed it sits back at its resting spot.
- **Left stick blue** (movement), **right stick red with a target in the
  middle** (shooting).
- **Translucent when idle, opaque the moment it is being used.**

**What is already true**, so don't redo it: the origin is taken from
`p.sx, p.sy` — where the finger landed — so the "jumps to your finger"
half is effectively there already for a press. What is missing is the
resting state when *no* finger is down, the re-home animation, the
colours and the two opacity levels.

**Traps waiting for whoever picks this up:**

- The super button is bottom-right at `superRect()` — 148×148 in the
  corner. The aim stick's resting home must not sit underneath it or the
  two overlap. The pause button is top-right.
- A pointer starting inside `superRect()` is deliberately excluded from
  aiming. Keep that when you move things around.
- Gate the whole thing on `SG.platform.touch` — desktop aims with the
  mouse and moves with WASD, and drawing thumb sticks there is noise.
  Smurf World's pad uses exactly this pattern.
- The aim stick is drawn only when `!a.mouse`, which is correct: a mouse
  is an aim but never a thumb stick.

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
