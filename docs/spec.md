# Rail Shooter Homage for the Browser: Build Spec

Nov 16, 2026 · @Anurag

## Overview

This variant builds the same on-rails police shooter as a web page: you open a URL and play, with nothing to download or install. It uses TypeScript and Three.js, and GitHub Actions publishes it to GitHub Pages on every push to `main`. Game name: **Real Cop 2**.

It is a sibling of the [Windows build spec](https://claude.ai/artifact/347reEDGWRbQd2CZLjWa7P). The game design, stage data format and originality boundary are the same: the mechanics are recreated, and every name, stage, model and sound is new.

**What changes from the Windows spec**

|  | Windows variant | Browser variant |
| --- | --- | --- |
| Engine | Godot 4, GDScript | Three.js, TypeScript, Vite |
| You play by | Downloading a zip, running an `.exe` | Opening a URL in Chrome, Edge or Firefox |
| Delivery | Workflow artifact and GitHub Release | GitHub Pages site, updated on every merge |
| Level editing | Godot editor | Blender, exported as `.glb` with named empties |
| Development machine | Needs Godot installed | Needs only Node, or nothing at all if you work through `@claude` and a cloud dev environment |
| What Claude Code can check | Rules, through headless tests | Rules, plus real screenshots of the running game through Playwright |
| Saves | File in `%APPDATA%` | Browser `localStorage`, per browser and device |

**Goals**

- One complete stage playable at a public URL, then two more on the same data format.
- 60 fps at 1080p on integrated graphics in current Chrome, Edge and Firefox.
- First playable frame within 5 seconds on a 20 Mbps connection.
- Every merge to `main` is live within about 3 minutes, with no manual step.

**Non-goals**

- Multiplayer, accounts, or server-side leaderboards. There is no backend at all.
- Phone and tablet play in v1 (taps will mostly work, but nothing is tuned for them).
- Safari as a tested target in v1.
- Free camera movement.

## Decisions

Three.js with TypeScript, built by Vite and hosted on GitHub Pages, is the recommended stack: it is the most widely used 3D library on the web, the whole project is text Claude Code can edit, and hosting stays inside GitHub.

| Area | Choice | Why |
| --- | --- | --- |
| Rendering | Three.js on WebGL 2 | Runs in every current desktop browser. WebGPU adds nothing a flat-shaded low-poly game needs. |
| Language | TypeScript, `strict` mode | The compiler catches whole classes of mistakes before a test runs, which suits AI-written code. |
| Build tool | Vite | Instant dev server, one-command static build into `dist/`, lazy-loaded chunks per stage. |
| Game rules | A simulation core in plain TypeScript with no Three.js or DOM imports | The same code runs in the browser and in Node, so the whole game can be simulated in tests in milliseconds. |
| HUD and menus | HTML and CSS over the canvas | Text, buttons and layout are far easier in the DOM than in WebGL, and easy for Claude Code to restyle. |
| Audio | Howler.js | Handles browser unlock-on-first-click, sprite pooling and looping in one small library. |
| Models and levels | `.glb` loaded with `GLTFLoader`, Meshopt compression | One format from Blender. Spawn markers and camera path points ride along as named empties. |
| Unit tests | Vitest | Same config as Vite, fast, runs the simulation core in Node. |
| Browser tests | Playwright with headless Chromium | Boots the real build, clicks through a stage, and saves screenshots Claude Code can look at. |
| Lint and format | ESLint and Prettier | Standard, and both fail CI on drift. |
| Hosting | GitHub Pages, deployed by Actions | Free for public repos, no extra account. Limits are 1 GB per site and a soft 100 GB of traffic a month ([GitHub docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). |
| Repo visibility | Public | On the GitHub Free plan, Pages only works from public repos. See the note below. |
| Saves | `localStorage` | No backend. Scores and options stay in the browser. |

**Visibility and "personal use".** A Pages site can be opened by anyone who has the URL, even when the repo behind it is private (private repos need GitHub Pro for Pages). If you want the game behind a login, deploy the same `dist/` folder to Cloudflare Pages and put Cloudflare Access in front of it. The spec assumes a public repo, which is fine because every asset is original or CC0.

**Alternative considered: Godot's Web export.** It would reuse the Windows project unchanged. It was not chosen as the primary path here because the download is tens of megabytes before any game content, and Claude Code has less ability to inspect the result. If you build the Windows variant first, try its Web export before starting this one.

## Game design

The rules are identical to the Windows spec; only input, screen handling and saving change for the browser. Copy the Game design section of the Windows spec into `docs/design.md` and treat it as the reference. The essentials are repeated here so this document can be read alone.

### Rules in brief

| Element | Rule |
| --- | --- |
| Core loop | Camera travels to a stop, a wave spawns, clear it, camera moves on. 3 scenes and a boss per stage, about 5 minutes. |
| Threat ring | Shrinks from 3x to 1x the enemy's height over its aim time, green to amber to red. When it closes, the enemy's shot always hits. |
| After a hit | 1 life lost, 1.0 s of invulnerability, other rings pause 0.5 s. |
| Max rings | 2, 3 or 4 counting down at once on Easy, Normal, Hard. |
| Revolver | 6 rounds, max 8 shots/s, 0.35 s reload, unlimited reserve. |
| Special weapons | Shotgun (6, cone), machine pistol (30, auto), magnum (6, pierces). From crates. Lost when empty or when hit. |
| Scoring | Gun hand 500 (disarm), head 300, body 200, thrown object 100. Combo +1 per 3 straight hits, cap x5. |
| Civilians | Blue outline, no ring. Shooting one costs a life. |
| Enemies | Grunt 2.0 s, Runner 1.5 s, Thrower 2.5 s flight, Shield 2.2 s, Heavy 2.8 s and 3 hits, Vehicle gunner 1.8 s, Boss in 3 phases. |
| Lives | 5 on Normal (7 Easy, 3 Hard), 3 continues, bonus life at 50,000 and 150,000. |
| Stages | Metro station, film studio backlot, hillside dam. |

All numbers live in `public/data/tuning.json`.

### What the browser changes

- **Click to start.** Browsers block sound until the player interacts, so the title screen is a single "Click to start" that unlocks audio and requests fullscreen.
- **Aiming.** The system cursor is hidden over the canvas and a crosshair is drawn at the pointer position. No pointer lock: aim is absolute, like a light gun.
- **Reload.** Right click, `R`, `Space`, or a click in the 4% border zone. The page suppresses the right-click context menu over the canvas.
- **Screen.** The canvas is letterboxed to 16:9 and scales to the window. Render resolution is capped at a device pixel ratio of 2. An `F` key and a button toggle fullscreen.
- **Losing focus.** When the tab is hidden or the window loses focus, the game pauses and shows the pause menu. Time never jumps on return.
- **Saving.** Options, unlocked stages and top-10 scores per stage and difficulty are stored in `localStorage` under one versioned key. Clearing browser data clears them; an export and import button in Options covers that.
- **Loading.** A progress bar shows before the title and before each stage. Stages 2 and 3 download only when chosen.
- **Touch.** Pointer events mean a tap fires a shot, and an on-screen reload button appears on touch devices. It is untuned in v1.

## Architecture

The game is split into a simulation core that knows the rules and a view layer that draws and plays sound, with a one-way flow: input goes into the simulation, state and events come out. The core imports nothing from Three.js or the DOM, so an entire stage can be played by a test in Node.

### Two layers

| Layer | Folder | Contains | May import |
| --- | --- | --- | --- |
| Simulation | `src/sim/` | Game state, encounter director, enemy state machines, ring timers, weapons, scoring, shot resolution, seeded RNG | Only its own files and a small vector maths module |
| View | `src/view/` | Three.js scene, camera, models, animation, effects, HUD, menus, audio, input capture | `src/sim/` types, Three.js, Howler, the DOM |

The simulation's public surface is small:

```ts
const game = createGame({ stage, markers, tuning, difficulty, seed });

// called at a fixed 60 Hz
const events = game.step(inputs);   // inputs: Fire { origin, direction } | Reload | Pause

game.state;   // camera pose, enemies, rings, ammo, score, lives, phase
events;       // EnemySpawned, RingClosed, EnemyHit { zone }, PlayerHit, WaveCleared, StageCleared ...
```

- The view turns a pointer position into a ray with the Three.js camera and passes the ray in. The simulation tests it against simple shapes (spheres, capsules, boxes) for each enemy's hit zones, so no rendering is needed to decide a hit.
- The view never changes game state. It reads `game.state` to place things and reacts to `events` for sound and effects.

### Game loop

- `requestAnimationFrame` drives rendering. An accumulator runs `game.step` at exactly 60 Hz, at most 5 steps per frame, and the view interpolates between the last two states.
- A hidden tab or lost focus stops the accumulator and sends `Pause`.
- One seeded random generator inside the simulation. `Math.random()` is banned in `src/sim/` by a lint rule.

### View systems

| System | Responsibility |
| --- | --- |
| `Renderer` | Canvas sizing, 16:9 letterbox, pixel-ratio cap, WebGL context loss and restore |
| `StageView` | Loads the stage `.glb`, builds the scene, hides marker empties |
| `ActorView` | One per enemy or civilian: model, animation clip chosen from simulation state |
| `RingView` | Projects each ring to screen space and draws it on a 2D overlay canvas |
| `Effects` | Muzzle flash, hit sparks, screen flash (with a reduced-flash option), camera shake |
| `Hud` and `Menus` | HTML and CSS: score, combo, lives, ammo cylinder, all screens |
| `AudioDirector` | Music per scene, pooled effects, announcer queue |
| `Input` | Pointer and keyboard to `Fire`, `Reload`, `Pause`; border-zone detection |
| `Loader` | Asset manifest, progress reporting, per-stage lazy loading |
| `SaveStore` | Versioned `localStorage` read, write, export, import |

### Stage data

The stage JSON is the same format as the Windows spec, with `environment` pointing at a `.glb`. Level layout comes from Blender through naming conventions on empties:

| Empty name | Meaning |
| --- | --- |
| `Path_000`, `Path_001`, ... | Camera path points, joined as a smooth curve in order |
| `Look_<name>` | A point the camera turns toward at a stop |
| `Spawn_<name>` | Where an enemy or civilian appears; its rotation is the facing |
| `Cover_<name>` | A box that blocks shots (the magnum ignores it) |
| `Crate_<name>` | A weapon crate position |

```json
{
  "id": "stage1",
  "name": "Metro Station",
  "environment": "stages/stage1.glb",
  "music": "audio/music/stage1.ogg",
  "rank_thresholds": { "S": 90000, "A": 70000, "B": 45000 },
  "scenes": [
    {
      "id": "concourse",
      "stops": [
        {
          "path_offset": 12.5,
          "travel_speed": 4.0,
          "look_at": "Look_A",
          "waves": [
            {
              "spawns": [
                { "type": "grunt", "marker": "Spawn_PillarLeft", "entry": "lean_out", "delay": 0.0 },
                { "type": "grunt", "marker": "Spawn_Stairs", "entry": "run_in", "delay": 0.6, "aim_time": 1.8 },
                { "type": "civilian", "marker": "Spawn_Kiosk", "entry": "stand_up", "delay": 1.0 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

A build step, `tools/extract-markers.ts`, reads each stage `.glb` and writes `stage1.markers.json` with every marker's position and rotation. The simulation loads that small file instead of the model, which is what lets tests run without a GPU. The same step fails the build if a stage JSON names a marker that does not exist.

### Debug hooks

- URL parameters: `?stage=1&stop=4&seed=42&god=1&debug=1`. `debug=1` draws hit zones, cover boxes and ring timers.
- In development and test builds only, `window.__game` exposes `state()`, `fireAt(x, y)`, `skipToStop(n)` and `stepFrames(n)`. Playwright and Claude Code drive the game through these.

## Assets and loading

Download size is the browser variant's main constraint, so every asset type has a byte budget and CI fails when the built site exceeds it. As in the Windows spec, build everything with boxes and capsules first and add art only after Stage 1 is fun.

| Asset | Format | Budget | Notes |
| --- | --- | --- | --- |
| App code | JS and CSS from Vite | 400 KB gzipped, Three.js included | Import only the Three.js modules used, so unused ones are dropped. |
| Characters | `.glb`, Meshopt, one shared rig | 1,500 triangles and 150 KB each | CC0 low-poly packs (Kenney, Quaternius), recoloured per type. |
| Stage environment | One `.glb` per stage | 60,000 triangles, 3 MB | Vertex colours instead of textures wherever possible. |
| Textures | WebP or KTX2 | 512 px max, 1 MB per stage | Most surfaces need none. |
| Sound effects | `.ogg` with `.mp3` fallback, mono | 600 KB total, packed as one audio sprite | jsfxr for arcade sounds, Freesound for gunshots (check each licence). |
| Music | `.ogg` with `.mp3` fallback, 96 kbps | 1.5 MB per track | Streamed, so it never blocks loading. |
| Announcer | In the audio sprite | 300 KB | Record yourself. |
| Font and icons | `.woff2`, inline SVG | 60 KB | One open-licence font. |

**Load budgets**

- Title screen interactive: 1.5 MB or less transferred.
- Stage 1 ready to play: 5 MB or less more.
- Whole site in `dist/`: under 40 MB, far inside the 1 GB Pages limit.

**Loading rules**

- An asset manifest per stage lists every file and its size, so the progress bar is accurate.
- Vite adds a content hash to every file name. A new deploy only makes players re-download the files that changed.
- Stage 2 and 3 code and assets are separate chunks, fetched on selection.
- Rendering targets: under 150 draw calls per frame, instanced meshes for repeated props, no real-time shadows (a blob shadow under each character instead).

**Licence log.** Every file under `public/assets/` gets a row in `ASSETS.md` with source, author and licence. CI fails on a missing row. Because the repo and site are public, use only CC0, CC-BY (with credit on a Credits screen) or your own work.

## Repository layout

One public repo holding a standard Vite project, with rules and view code in separate folders so the import boundary can be enforced by lint.

```text
lockdown-unit-web/
  index.html
  package.json
  package-lock.json
  vite.config.ts              # base: "/lockdown-unit-web/" for Pages
  tsconfig.json               # strict: true
  eslint.config.js            # bans DOM/three imports and Math.random in src/sim
  playwright.config.ts
  CLAUDE.md
  ASSETS.md
  README.md
  .github/
    workflows/
      ci.yml                  # lint, typecheck, unit, build, size budget, browser smoke
      deploy.yml              # build and publish to GitHub Pages
      claude.yml              # @claude on issues and PRs
    dependabot.yml            # npm and github-actions
    ISSUE_TEMPLATE/task.md
  src/
    main.ts                   # boot, loader, screen flow
    sim/                      # pure rules: game.ts, director.ts, enemy.ts, rings.ts,
                              # weapons.ts, score.ts, shots.ts, rng.ts, vec.ts, types.ts
    view/                     # renderer.ts, stageView.ts, actorView.ts, ringView.ts,
                              # effects.ts, audio.ts, input.ts, loader.ts
    ui/                       # hud.ts, menus.ts, styles.css
    save/                     # saveStore.ts
    debug/                    # hooks.ts (window.__game), overlay.ts
  public/
    data/
      tuning.json
      stages/stage1.json
      stages/stage1.markers.json   # generated
      schema/stage.schema.json
    assets/                   # models/, stages/, audio/, fonts/
  tests/
    unit/                     # score.test.ts, weapons.test.ts, rings.test.ts ...
    sim/                      # bot-clear.test.ts, bot-idle.test.ts
    e2e/                      # smoke.spec.ts, screenshots.spec.ts
  tools/
    extract-markers.ts
    validate-stages.ts
    check-size-budget.ts
    check-asset-log.ts
  art/                        # .blend sources (optional; keep small or keep elsewhere)
  docs/
    spec.md                   # this document
    design.md                 # game design reference
    decisions/
```

**Conventions**

- `main` is always deployable, because every merge goes live. All work lands through pull requests so CI runs first.
- Branch names `feat/<issue>-short-name` and `fix/<issue>-short-name`. One issue per PR. Conventional Commits.
- `npm run` scripts are the only entry points: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, `validate`, `budget`.
- Commit `package-lock.json`, and use `npm ci` everywhere except when deliberately adding a dependency.
- No Git LFS. Pages serves LFS pointer files as-is unless the checkout fetches them, and the asset budgets keep the repo small enough without it.

## GitHub Actions

Three workflows: `ci.yml` gates every pull request, `deploy.yml` publishes `main` to GitHub Pages, and `claude.yml` lets Claude Code work from issues. The YAML is a starting point for Claude Code to commit and then verify by running it.

### One-time repo settings

1. Settings, Pages, Source: **GitHub Actions**.
2. Settings, Branches: protect `main`, require the `check` job to pass.
3. Set `base` in `vite.config.ts` to `/<repo-name>/`. The site will be at `https://<user>.github.io/<repo-name>/`.

### ci.yml

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run validate        # stage JSON, markers, asset log
      - run: npm test                # Vitest: unit + simulation bots
      - run: npm run build
      - run: npm run budget          # fails if dist/ breaks the size budgets
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e        # boots the built site, plays, screenshots
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-results
          path: test-results/
          retention-days: 7
```

### deploy.yml

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Notes for whoever implements these

- **Action versions.** The major versions above are from general knowledge. Bump them to current when first committing, and let Dependabot keep them current.
- **Headless WebGL.** Chromium on a runner has no GPU and falls back to software rendering. If the canvas comes up blank, the Playwright config needs a launch flag to allow software WebGL. Frame rate in CI is meaningless; assert on game state, not timing.
- **Trying a PR before it is live.** Pages serves one site, from `main`. To play a branch, run `npm run dev` on it locally or in a cloud dev environment with a forwarded port. If you want a URL per pull request, Cloudflare Pages does that from the same build.
- **Version stamp.** The build injects the short commit hash, shown in a corner of the title screen, so you can tell which deploy you are playing.
- **Rollback.** Revert the merge commit on `main`; the deploy workflow republishes the previous version.

## Claude Code workflow

In this variant Claude Code can close more of the loop by itself: it runs the whole game in a simulated test, boots the real page in headless Chromium, and looks at the screenshots. You still judge feel, but far fewer bugs need your eyes.

### Setup, once

1. Create the public repo and commit this spec as `docs/spec.md` and the design reference as `docs/design.md`.
2. In Claude Code, run `/install-github-app` for the repo. It installs the Claude GitHub app and stores the credential as a repo secret (`ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` for a Claude subscription).
3. Ask Claude Code to do milestone M0: scaffold the Vite project, `CLAUDE.md`, the three workflows and the Pages settings checklist.

### Working with nothing installed

The whole cycle can run from a browser tab, including on a phone:

1. Open an issue with acceptance criteria and mention `@claude`.
2. The action implements it, runs the checks and opens a pull request.
3. CI runs. You read the diff and the uploaded screenshots.
4. You merge. About 3 minutes later the change is live at the game URL, and you play it.

For longer interactive sessions, use Claude Code on your own machine with Node installed, or in a cloud dev environment such as a GitHub codespace, where `npm run dev` gives a forwarded preview URL.

### CLAUDE.md

```text
# Lockdown Unit (web)

On-rails 3D shooter in the browser. TypeScript strict, Three.js, Vite.
Design: docs/design.md. Build spec: docs/spec.md.

## Commands
- Dev server:   npm run dev
- All checks:   npm run lint && npm run typecheck && npm run validate && npm test
- Build:        npm run build && npm run budget
- Browser test: npm run test:e2e     (screenshots land in test-results/)
- Jump in:      http://localhost:5173/?stage=1&stop=4&seed=42&debug=1

## Rules
- src/sim/ is pure: no three, no DOM, no Date, no Math.random. Every rule there has a unit test.
- src/view/ never mutates game state. It reads state and reacts to events.
- No gameplay numbers in code. Read them from tuning.json.
- New encounters are JSON in public/data/stages/. Do not hard-code spawns.
- Do not add dependencies without asking. Do not add or download assets; use primitives and ask.
- After any view or UI change, run the browser test and look at the screenshots before saying it is done.
- Stay inside the size budgets. If a change breaks one, say so instead of raising the budget.
- One issue per PR. If a task needs a judgment about feel, stop and ask for numbers.
```

### claude.yml

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]

permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write
  actions: read

jobs:
  claude:
    if: contains(github.event.comment.body, '@claude') || contains(github.event.issue.body, '@claude')
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          claude_args: |
            --max-turns 30
```

**Because the repo is public:** before relying on this workflow, confirm in a test that a comment from an account without write access does not start a run, and set a monthly spend limit on the API key. Never print secrets in workflow logs; they are public too.

### Which mode for which work

| Work | Mode | Why |
| --- | --- | --- |
| Simulation rules, tests, refactors | `@claude` on an issue | Fully checkable in Node. |
| Stage data and tuning | `@claude` on an issue | Schema and marker validation catch mistakes. |
| HUD, menus, effects | `@claude` or interactive | Screenshots show the result; you confirm it looks right. |
| First build of the renderer, camera and animation | Interactive, with the dev server open | Motion needs watching, and screenshots are still frames. |
| Blender work, marker placement, feel | You | Needs eyes and hands. |

### Prompts that work

- "Read docs/design.md and the Architecture section of docs/spec.md. Plan M1 as a list of PRs under 300 changed lines each, with tests. Do not write code yet."
- "Implement `score.ts` in src/sim per the scoring rules. Write the Vitest tests first: combo reset on miss, the x5 cap, bonus lives at 50,000 and 150,000."
- "Run the browser test for stage 1 stop 2 with debug=1, look at the screenshot, and check that each ring is centred on its enemy. Fix RingView if not, and add an assertion on the projected position."

## Milestones

Eight milestones, each ending in a tag and a live deploy; the URL works from M0 and the game is replayable by M4. The simulation comes before the renderer on purpose, because it can be finished and proven without drawing anything.

| # | Tag | Scope | Accepted when |
| --- | --- | --- | --- |
| M0 | `v0.0.1` | Vite project, `CLAUDE.md`, three workflows, Pages enabled, one Vitest test, one Playwright test, a spinning cube and the commit hash on screen | The public URL shows the cube. CI is green. A merge is live in about 3 minutes. |
| M1 | `v0.1.0` | Simulation core: rings, enemy states, weapons, scoring, lives, civilians, director, stage loader, seeded RNG. No graphics. | A bot test clears a hand-written 5-stop stage with the expected score. An idle-bot test reaches game over at the expected step. Unit coverage of `src/sim/` is 90% or more. |
| M2 | `v0.2.0` | Minimal view: static camera, capsule enemies, crosshair, pointer-to-ray, ring overlay, basic HUD, click-to-start, border-zone reload | In the browser, one wave of 5 can beat you if you are slow, points are right per hit zone, and a screenshot test shows rings centred on enemies. |
| M3 | `v0.3.0` | Rail camera from `Path_` empties, marker extraction tool, greybox Stage 1 `.glb` at full length, fixed-step loop with pause on blur, debug URL parameters | Stage 1 plays start to finish in grey boxes from JSON and one `.glb`. A stage file naming a missing marker fails CI. |
| M4 | `v0.4.0` | All enemy types, special weapons, boss, difficulty, continues, results and rank, initials entry, `localStorage` saves with export and import, options, fullscreen | A full arcade loop from title to results and back. Scores survive a reload. All three difficulties are finishable. |
| M5 | `v0.5.0` | Art, animation, effects, music and announcer for Stage 1; loader with progress; size-budget check on; credits screen | No placeholder left in Stage 1. 60 fps at 1080p on your weakest machine in Chrome and Firefox. Budgets pass. |
| M6 | `v0.8.0` | Stages 2 and 3 as lazy-loaded chunks, with data, bosses and rank thresholds | All three stages finishable on Normal without continues. Opening the title screen does not download Stage 2 or 3 assets. |
| M7 | `v1.0.0` | Tuning pass, WebGL context-loss recovery, reduced-flash option verified, touch reload button, README with controls and the URL | Ten clean runs with no error in the browser console. A cold load on a second device reaches the title within the load budget. |

**Order inside a milestone:** simulation rule and test, then the view that shows it, then data, then HUD and sound. Each is its own PR.

## Testing

Most of the game is proven in Node without a browser, a thin browser layer proves the page really boots and draws, and you judge feel on the live URL.

| Layer | Tool | What it checks | Runs |
| --- | --- | --- | --- |
| Types and lint | `tsc`, ESLint | Strict types; the `src/sim/` import boundary; no `Math.random` in rules | Every PR |
| Unit | Vitest | Scoring, weapons, ring timing, difficulty scaling, stage loading, save versioning | Every PR |
| Clearing bot | Vitest | Each stage, fixed seed, a bot that shoots every enemy 0.5 s after spawn. Must finish with the exact expected score. | Every PR |
| Idle bot | Vitest | Same, but the bot never fires. Must reach game over at a known step and never hang. | Every PR |
| Determinism | Vitest | Two runs with the same seed and inputs produce identical event logs. | Every PR |
| Data validation | Node script | Stage JSON against the schema; markers exist in the `.glb`; rank thresholds ascend; asset log complete | Every PR |
| Size budget | Node script | `dist/` against the byte budgets in Assets and loading | Every PR |
| Browser smoke | Playwright, Chromium | The built site loads with no console errors, click-to-start works, a scripted run through `window.__game` clears stop 1 | Every PR |
| Screenshots | Playwright | Title, mid-wave with `debug=1`, results. Saved as artifacts for review, not pixel-compared. | Every PR |
| Cross-browser | You | Chrome, Edge, Firefox on your own hardware at 1080p | Each milestone |
| Play test | You | Feel, readability, difficulty curve | Each milestone |

**Tuning method.** Change one number in `tuning.json`, merge, and replay the same stop on the live URL with `?stage=&stop=&seed=`. Record the outcome in `docs/decisions/`. Tune ring time first, then max rings, wave delays, and scoring last.

**Feel checklist for each play test**

- [ ] I always know which enemy will fire next.
- [ ] Every life lost felt like my mistake.
- [ ] The crosshair feels attached to my hand, with no lag.
- [ ] Reloading has a rhythm and never feels like a penalty.
- [ ] Civilians are readable in under a quarter of a second.
- [ ] Nothing stutters when a new wave or sound first appears.
- [ ] I want one more run.

## Risks and open questions

Art scope is still the biggest risk, and the browser adds two of its own: download size and the fact that the site is public.

| Risk | Mitigation |
| --- | --- |
| Art and animation stall the project | Grey boxes until M4. CC0 packs, one shared rig. Stage 1 alone is a complete game. |
| The site and repo are public | Original and CC0 content only, a credits screen, no secrets in logs. Move to Cloudflare Pages with Access if you want a login. |
| Downloads grow until the first load is slow | Byte budgets enforced in CI from M5. Lazy-loaded stages. Vertex colours over textures. |
| Without an engine editor, level layout is slower | Blender naming conventions and the marker extraction tool. Greybox with primitives first. |
| Animation blending and skinned models take longer in Three.js than in an engine | One rig, about 12 clips, hard cuts between most states. Built interactively in M5, not through `@claude`. |
| Headless Chromium renders differently or not at all in CI | Browser tests assert on game state and console errors. Screenshots are for review only. |
| Browser quirks: audio unlock, fullscreen, context loss, high-refresh displays | Click-to-start, fixed 60 Hz simulation step, context-restore handler in M7, three browsers checked per milestone. |
| Saves lost when browser data is cleared | Export and import of the save as a small file. |
| API spend or misuse of `@claude` on a public repo | Write-access check verified, `--max-turns` cap, job timeout, monthly limit on the key. |

**Open questions**

- [ ] Is a public repo and public URL acceptable, or should the site sit behind a login?
- [ ] Final name for the game and the repo? The repo name becomes part of the URL.
- [ ] Build this instead of the Windows variant, or after it? If after, try Godot's Web export first.
- [ ] Should phones and tablets be a real target later? It changes HUD size and reload input.
- [ ] API key or Claude subscription token for the GitHub action?
- [ ] Will you make the music and announcer lines yourself, or source them?

## Sources

- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) for plan availability, the 1 GB site limit and the 100 GB monthly soft limit, checked 16 November 2026.
- [claude-code-action example workflow](https://github.com/anthropics/claude-code-action/blob/main/examples/claude.yml) for the `@claude` workflow shape and inputs.

Gameplay numbers, byte budgets, the deploy time and action versions in this spec are starting points from general knowledge, not measured values.
