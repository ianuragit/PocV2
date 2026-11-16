# Real Cop 2

An original on-rails police shooter that runs in your browser. Ride the rail through three stages,
read the threat sights, and shoot first.

**Play: https://ianuragit.github.io/PocV2/** (Chrome, Edge or Firefox on a computer; touch works but
is not tuned)

Built by Anurag.

## How to play

| Action     | Mouse and keyboard                                     | Touch             |
| ---------- | ------------------------------------------------------ | ----------------- |
| Shoot      | Left click where you aim                               | Tap               |
| Reload     | Right click, `R`, `Space`, or click the screen edge    | The RELOAD button |
| Pause      | `P` or `Esc` (the game also pauses if you switch tabs) | Leave the tab     |
| Fullscreen | `F`, or the FULLSCREEN button on the title             |                   |

- **Threat sights** close in on an enemy as it takes aim: cyan, then amber, then red and blinking just
  before it fires. Shoot it before the sight closes.
- **Hit zones**: the gun hand disarms (500), head 300, body 200, a thrown object 100. Three hits in a
  row raise the combo, up to x5.
- **Civilians** wear white and blue, raise their hands and have a blue outline. Shooting one costs a life.
- **Shields** block body shots from the front: aim for the head. **Heavies** take three hits.
- **Crates** hold a shotgun, a machine pistol (hold to fire) or a magnum (shoots through cover). Special
  weapons are dropped when empty or when you lose a life.
- Each stage ends with a three-phase **boss**. Clearing a stage unlocks the next.
- **Options**: difficulty, music and sound volume, reduced flash (softer flashes, no blinking), and save
  export and import. Scores and options stay in your browser.

Handy links: [Stage 2](https://ianuragit.github.io/PocV2/?stage=2) ·
[Stage 3](https://ianuragit.github.io/PocV2/?stage=3) ·
[Firing range](https://ianuragit.github.io/PocV2/?stage=range)

## Develop

```bash
npm ci
npm run dev
```

Then open http://localhost:5173/PocV2/. Useful URL parameters: `stage=1|2|3|range`, `stop=N`
(1-based), `seed=N`, `difficulty=easy|normal|hard`, `god=1`, `debug=1` (draws hit zones).

| Command                              | What it does                                             |
| ------------------------------------ | -------------------------------------------------------- |
| `npm run lint` / `npm run typecheck` | ESLint + Prettier, TypeScript strict                     |
| `npm test` / `npm run coverage`      | Unit, simulation-bot and soak tests (Vitest)             |
| `npm run validate`                   | Stage data against markers, catalogue, asset licence log |
| `npm run build` / `npm run budget`   | Production build, then size and triangle budgets         |
| `npm run test:e2e`                   | Browser tests and screenshots (Playwright)               |
| `npm run greybox`                    | Regenerates the stage models and markers                 |
| `npm run tune-report`                | Difficulty report from human-like bots                   |

Every merge to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## How it is built

- `src/sim/`: the rules, pure TypeScript with no rendering, so whole stages are played by bots in tests.
- `src/view/` and `src/ui/`: Three.js rendering, synthesized audio, HUD and menus.
- `public/data/`: tuning numbers and stage encounters as JSON; stage models are `public/assets/stages/*.glb`.
- `tools/`: stage generators, marker extraction, validation, budgets, the tuning report.
- `docs/spec.md` is the build spec; `docs/decisions/` records each design decision.

Everything in the game (code, stages, characters, music and sound) is original. Third-party: three.js
(MIT, licence shipped at `licenses/three.txt`).
