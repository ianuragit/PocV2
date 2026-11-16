# 0004: M4 rules (weapons, enemy types, boss, continues, saves)

Status: proposed; every number is in `public/data/tuning.json` and needs a play test.

## Weapons

| Weapon         | Rounds | Rate | Behaviour                                                                                                                             |
| -------------- | ------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Revolver       | 6      | 8/s  | Reload: right click, R, Space or the screen edge, 0.35 s                                                                              |
| Shotgun        | 6      | 2/s  | 7 pellets: one on the aim, six on a 3° cone. Fixed pattern, not random, so runs stay deterministic. Each target is hit once per shot. |
| Machine pistol | 30     | 12/s | Fires while the button is held                                                                                                        |
| Magnum         | 6      | 3/s  | Passes through cover, shields and every enemy on the line                                                                             |

- Specials come from **crates**: shootable boxes on `Crate_` markers with a `weapon` in the stage
  JSON. A crate gives no points and neither builds nor breaks the combo; it counts toward hit rate.
- Specials are **never reloaded**. They are dropped when empty or when the player loses a life (from any
  cause), and the revolver comes back exactly as it was.
- **Hit rate** is shots that hit at least one target ÷ shots fired, so a shotgun never shows more than 100%.

## Enemy types

| Type           | Aim   | Hits | Rule                                                                                                                                                                                                                   |
| -------------- | ----- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thrower        | 2.0 s | 1    | When its ring closes it throws instead of shooting: the object flies for 2.5 s with its own closing ring, can be shot for 100 points, and costs a life if it lands. A wave does not clear while a throw is in the air. |
| Shield         | 2.2 s | 1    | Body shots from the front hit the shield: no damage, combo broken, "BLOCKED". Head and gun hand are open; from behind it is a normal enemy; the magnum goes through.                                                   |
| Vehicle gunner | 1.8 s | 1    | Data only: a quick shooter, placed on the maintenance cart in stage 1.                                                                                                                                                 |

## Boss

- Three phases of 8 hits each, aim 2.2 s, 1.8 s, 1.6 s. Between phases it moves to its next
  `phase_markers` mark for 1.0 s and cannot be hit. Defeat pays a 10,000 bonus.
- It cannot be disarmed: a gun-hand hit counts as a body hit.
- The first tuning had a 10-hit, 1.4 s final phase. At the revolver's maximum rate 10 hits plus a
  reload take about 1.65 s, so even perfect play was hit every cycle. That breaks "every life lost
  felt like my mistake", so the final phase is 8 hits at 1.6 s.

## Continues

- Losing the last life offers a continue with a 10 s countdown; 3 continues per game.
- **Accepting a continue resets the score to zero** (lives refill, the stage carries on). This keeps
  continues from buying points. The alternative, keeping the score and showing the continues used, is a
  one-line change in `acceptContinue`.

## Results, rank, saves

- Rank is S/A/B/C against the stage's thresholds, worked out in the simulation at stage clear.
  Stage 1: S 85,000, A 65,000, B 40,000. A perfect body-shot run is 74,000 (A); S needs head shots,
  disarms and long combos. Placeholders until the tuning pass.
- High scores: top 10 per stage and difficulty, three initials, in one versioned `localStorage` key
  (`realcop2.save`, version 1) with options and cleared stages. Export and import in Options. Imported
  or stored data is checked field by field; anything invalid is dropped, never trusted.
