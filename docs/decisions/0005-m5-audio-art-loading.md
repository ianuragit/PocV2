# 0005: M5 audio, art, effects and loading

Status: accepted (choices made by the owner when M5 started).

## Audio: synthesized, no files

- All sound effects and music are synthesized at play time on the Web Audio API
  (`src/view/audio.ts`). There are no audio files, no audio library (Howler.js was not added) and no
  licence rows to keep.
- Music is three original loops written as note data (`src/view/music.ts`): title, stage and boss.
  The boss theme plays while a boss is on stage; music ducks while paused or offered a continue and
  stops under the stage-clear and game-over jingles.
- Effects follow simulation events: one sound per weapon, reload, dry fire, hit zones, shield block,
  civilian hit, player hit, enemy fire, crate, pickup, throw, boss, bonus life, and a short beep the
  moment a sight turns red.
- Browsers allow sound only after a user gesture; the first click or key unlocks it. Music and effect
  volumes are in Options and saved.

## Announcer: banners only

READY when play starts, GO! at the first stop, CLEAR, EXTRA LIFE, weapon names on pickup, WARNING: BOSS,
boss phases, and the results screens. No voice. Recorded lines can be added later as one more event map.

## Effects and animation

- Enemy muzzle flash when an enemy fires; a white flash on anything you hit; camera shake when you are hit
  (much smaller with Reduced flash on); legs swing while an enemy steps in.
- Banners and the results delay count simulation time, so they last the same in every browser.

## Stage art

The generated stage got a detail pass instead of a Blender model: ceiling lights (drawn unlit so they
glow), hanging station signs, posters, a clock, a tactile guide line, bins, street lamps, train seats,
poles and lighting, tunnel cables, signals and handrail, depot shelving and floor markings. None of it is
cover; all of it sits off the firing lines. Stage 1 is 8,666 triangles and 721 KB.

## Loading and budgets

- The loading screen shows a bar driven by the bytes of the stage model received (the JSON files count
  for the first 10%). The spec's per-stage manifest of file sizes was not needed: the model is the only
  large file and its size comes with the download.
- `npm run budget` now checks app code, title-screen load, each stage model's size and triangle count,
  and the whole site. A browser test checks draw calls stay under 150 at every stop (currently at most
  83).
- Not measured here: frame rate at 1080p. The CI runner renders in software. Check on real hardware.

## Credits

A Credits screen names the game's own work and three.js (MIT); the licence text ships at
`licenses/three.txt`, as the MIT licence requires.
