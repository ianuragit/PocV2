# 0001: Simulation rules decided in M1

Status: proposed, needs a play test to confirm. Each is one number or one line in `src/sim/` to change.

The spec left these open. Each was given the simplest arcade-style answer:

| Question                                                              | M1 answer                                                                                               | Where                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------- |
| A ring closes during invulnerability                                  | The shot misses, and the enemy re-aims                                                                  | `game.ts` `updateRings`      |
| Several rings close on the same step                                  | The first one hits; the rest fall inside the new invulnerability and miss                               | `game.ts`                    |
| Which enemy gets a ring when more are waiting than `max_rings` allows | Oldest in the queue. After firing, an enemy goes to the back of the queue                               | `rings.ts`                   |
| Re-aim timing                                                         | First ring is the exact aim time; later rings vary by +-`rings.reaim_jitter` (10%), from the seeded RNG | `rings.ts`                   |
| Can enemies be shot while entering                                    | Yes, and their ring has not started yet                                                                 | `shots.ts` `isHittable`      |
| Does getting hit break the combo                                      | No. Only a miss, a cover hit or a civilian hit does                                                     | `game.ts`                    |
| Does shooting a civilian give invulnerability or pause rings          | No, it only costs a life                                                                                | `game.ts` `loseLife`         |
| Heavy hit by a non-lethal shot                                        | Scores the zone's points each hit, so a heavy is worth 3 hits                                           | `game.ts` `fire`             |
| Gun hand on any enemy, including a heavy                              | Disarms at once, 500 points                                                                             | `game.ts` `fire`             |
| Civilians at wave clear                                               | They leave immediately                                                                                  | `game.ts` `checkWaveCleared` |
| Pause between waves at the same stop                                  | `director.wave_gap` (0.5 s)                                                                             | `tuning.json`                |
| Shots during camera travel                                            | Count as misses                                                                                         | `game.ts`                    |
| Difficulty and aim time                                               | `difficulty.<level>.aim_time_scale`: Easy 1.25, Normal 1.0, Hard 0.85                                   | `tuning.json`                |

## Conventions

- **Time** is integer steps at `tuning.step_hz` (60). Seconds in data are rounded to steps once, at load.
- **Timed phases count the step they start on.** A 2.0 s ring that starts on step 1 closes on step 120.
- **Cover boxes** are axis-aligned in M1; marker rotation is ignored. The box half-extents are the marker scale.
- **Camera path** is straight segments between `Path_` markers in M1. The view can smooth it; the simulation's
  position is what shots are tested from.
- **Facing**: Three.js axes. Yaw 0 faces +Z; the actor's right hand is on -X.
