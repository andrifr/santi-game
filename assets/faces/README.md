# Character art

Transparent-background cutouts of Santi, Daley and Rue. The game slices
the head out of each one and draws it on an animated body, so a single
portrait gives you a fully running character.

## What ships

These are the optimised files the game actually loads. They're generated
— don't hand-edit them.

| File | Who | Used for |
|------|-----|----------|
| `santi.png` | Santi, head-on | the runner, menu cards; also the source for **Dark Santi** (violet grade, applied at runtime) |
| `santi-side.png` | Santi, profile | pickleball side view |
| `santi-chain.png` | Santi + a friend | alternate skin |
| `santi-mj.png` | Santi as Michael Jackson | alternate skin |
| `daley.png` | Daley, head-on | the phone-call task |
| `daley-side.png` | Daley, profile | — |
| `daley-alt.png` | Daley, alternate | — |
| `rue.png` | Rue, sitting | dog-walk task |
| `rue-side.png` | Rue, side view with bow | dog-walk task |
| `rue-face.png` | Rue, close-up | reaction shots |

## Sources

The originals (`*nobg.png`, `ruecart*.png`) are the full-resolution art,
~1.8 MB each. They already have proper alpha channels — note that many
image previewers ignore alpha and show the painted backdrop underneath,
which makes them look like they still have a background. They don't.

They stay in this folder only so the optimiser can be re-run. Nothing
loads them at runtime, and you can delete them without breaking the game
(you'd just need them again to regenerate).

## Regenerating

```bash
node tools/optimize-faces.js
```

Trims each source to its opaque bounding box, downscales the long edge to
512px and re-encodes. Currently 17.8 MB → 1.8 MB, which is the difference
between a snappy first load on a phone and a bad one. No dependencies.

To add a new character, drop the cutout in here, add a line to `JOBS` in
the optimiser, and register it in `js/main.js`.

## Adding a raw photo instead

If you add an actual photograph rather than an illustration, register it
in `js/main.js` with `cartoonify: true`:

```js
{ key: 'someone', src: F + 'someone.png', cartoonify: true }
```

That runs it through a posterise + saturation + ink-outline filter and
masks it to a circle. It's a fallback for real photos — the illustrated
cutouts above already look better untouched, so they skip it.

Note that reading pixels requires same-origin access, so the cartoonify
path needs the game served over `http://` (GitHub Pages or a local
server), not opened as a `file://` path.
