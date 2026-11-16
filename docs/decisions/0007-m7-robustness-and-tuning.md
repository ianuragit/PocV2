# 0007: M7 robustness, accessibility and the tuning baseline

Status: robustness and accessibility accepted; tuning numbers **awaiting the owner's targets**.

## Robustness

- **WebGL context loss**: the game pauses and says "GRAPHICS RESET… PLEASE WAIT"; when the context is
  restored three.js re-uploads the scene and the pause screen says "GRAPHICS RESTORED". Tested in the
  browser with `WEBGL_lose_context`: after restore the scene draws the same calls and triangles as before.
- **Clean runs**: stages 1, 2 and 3 are each played start to finish in the browser by a bot with no
  console errors; the simulation plays every stage on every difficulty with ten seeds (90 runs).

- **Every enemy can be shot from the screen**: the simulation bots aim with rays and cannot tell when a
  target is off screen. A browser test now checks that every enemy at every stop of every stage stands
  inside the view and outside the 4% reload border. Its first run found four that were not: stage 2's
  boss guards (one off screen, one in the border), stage 3's bridge thrower (above the top edge) and a
  catwalk gunman (in the border). They were moved, and the bridge lowered from 6 m to 4 m.

## Accessibility and touch

- **Reduced flash** now also stops the blinking of red sights and the white flash on struck actors, on
  top of the softer damage flash and smaller camera shake.
- **Touch**: an on-screen RELOAD button appears during play on touch screens; taps shoot. Tested with
  touch emulation. Not tuned for phones (the spec's non-goal).

## Tuning baseline

`npm run tune-report` plays each stage with bots that behave like people:

| Player  | Reaction | Aim wobble | Extra time between shots |
| ------- | -------- | ---------- | ------------------------ |
| sharp   | 0.45 s   | 6 cm       | 0.12 s                   |
| average | 0.70 s   | 11 cm      | 0.25 s                   |
| casual  | 1.00 s   | 16 cm      | 0.40 s                   |

Results over 5 seeds each, with the current `tuning.json`:

| Stage  | Difficulty | Player  | Cleared without continues | Lives lost (avg) | Continues (avg) | Score (avg) | Hit rate |
| ------ | ---------- | ------- | ------------------------- | ---------------- | --------------- | ----------- | -------- |
| stage1 | easy       | sharp   | 5/5                       | 0.0              | 0.0             | 72720       | 99%      |
| stage1 | easy       | average | 5/5                       | 0.6              | 0.0             | 57220       | 88%      |
| stage1 | easy       | casual  | 5/5                       | 3.8              | 0.0             | 41960       | 80%      |
| stage1 | normal     | sharp   | 5/5                       | 0.0              | 0.0             | 72720       | 99%      |
| stage1 | normal     | average | 5/5                       | 2.8              | 0.0             | 57220       | 88%      |
| stage1 | normal     | casual  | 1/5                       | 5.2              | 0.8             | 20180       | 94%      |
| stage1 | hard       | sharp   | 5/5                       | 0.0              | 0.0             | 72720       | 99%      |
| stage1 | hard       | average | 1/5                       | 3.6              | 0.8             | 23660       | 98%      |
| stage1 | hard       | casual  | 0/5                       | 5.4              | 1.4             | 16000       | 93%      |
| stage2 | easy       | sharp   | 5/5                       | 0.0              | 0.0             | 58760       | 96%      |
| stage2 | easy       | average | 5/5                       | 1.0              | 0.0             | 48040       | 83%      |
| stage2 | easy       | casual  | 4/5                       | 4.4              | 0.2             | 29700       | 78%      |
| stage2 | normal     | sharp   | 5/5                       | 0.0              | 0.0             | 58760       | 96%      |
| stage2 | normal     | average | 5/5                       | 3.0              | 0.0             | 48040       | 83%      |
| stage2 | normal     | casual  | 2/5                       | 5.4              | 0.6             | 24360       | 86%      |
| stage2 | hard       | sharp   | 5/5                       | 0.2              | 0.0             | 58760       | 96%      |
| stage2 | hard       | average | 0/5                       | 3.6              | 1.0             | 13760       | 98%      |
| stage2 | hard       | casual  | 0/5                       | 6.6              | 1.8             | 13040       | 89%      |
| stage3 | easy       | sharp   | 5/5                       | 0.0              | 0.0             | 61820       | 99%      |
| stage3 | easy       | average | 5/5                       | 0.8              | 0.0             | 48980       | 86%      |
| stage3 | easy       | casual  | 5/5                       | 4.2              | 0.0             | 36780       | 73%      |
| stage3 | normal     | sharp   | 5/5                       | 0.0              | 0.0             | 61820       | 99%      |
| stage3 | normal     | average | 5/5                       | 3.2              | 0.0             | 50180       | 86%      |
| stage3 | normal     | casual  | 2/5                       | 5.0              | 0.6             | 22500       | 84%      |
| stage3 | hard       | sharp   | 5/5                       | 0.6              | 0.0             | 61820       | 99%      |
| stage3 | hard       | average | 0/5                       | 3.8              | 1.0             | 14920       | 100%     |
| stage3 | hard       | casual  | 0/5                       | 6.2              | 2.0             | 11920       | 88%      |

What it says:

- **Easy** is right for a casual player: they clear every stage, losing about 4 of 7 lives.
- **Normal** suits an average player (clears, losing about 3 of 5 lives); a casual player usually needs continues.
- **Hard** stops average players, but a sharp player still loses almost nothing. Hard does not yet
  challenge strong players.
- Stage 2 is slightly harder than stages 1 and 3.

No numbers were changed: the targets are the owner's call. `tests/tools/tune.test.ts` guards the
current curve so a later change to it is deliberate.
