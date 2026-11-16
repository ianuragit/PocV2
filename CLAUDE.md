# Real Cop 2 (web)

On-rails 3D shooter in the browser. TypeScript strict, Three.js, Vite.
Design: docs/design.md. Build spec: docs/spec.md.

## Commands

- Dev server: npm run dev
- All checks: npm run lint && npm run typecheck && npm run validate && npm test
- Build: npm run build && npm run budget
- Browser test: npm run test:e2e (screenshots land in test-results/, incl. a tour of every stage 1 stop)
  - If the installed Chromium does not match @playwright/test, set PW_CHROMIUM_PATH to its binary
- Stage greyboxes: npm run greybox (writes every public/assets/stages/stageN.glb, then markers.json)
- Markers only: npm run markers (re-extract markers.json from every stage .glb)
- Jump in: http://localhost:5173/PocV2/?stage=1&stop=4&seed=42&debug=1
  - `stage` = `1`, `2`, `3` or `range`; `stop` is 1-based; `difficulty` = easy|normal|hard; `god=1` never loses a life
  - `debug=1` draws hit zones and ring timers and exposes `window.__game` (see src/debug/hooks.ts); `test=1` exposes it without drawing
  - Browser tests hold the frame loop (`__game.hold(true)`) and drive steps with `__game.stepFrames(n)`

## Rules

- src/sim/ is pure: no three, no DOM, no Date, no Math.random. Every rule there has a unit test.
- src/view/ never mutates game state. It reads state and reacts to events.
- No gameplay numbers in code. Read them from public/data/tuning.json.
- New encounters are JSON in public/data/stages/. Do not hard-code spawns. A new stage also needs an
  entry in public/data/stages/index.json (play order) and a generator or .glb.
- Level layout lives in the stage .glb (named empties: Path_, Look_, Spawn_, Cover_). Never edit
  *.markers.json by hand; it is generated, and validate fails when it is stale.
- Relative imports use explicit .ts extensions, so tools/ can run with plain `node` and reuse src/sim.
- Saves go through src/save/saveStore.ts only; treat stored and imported data as untrusted.
- Do not add dependencies without asking. Do not add or download assets; use primitives and ask.
- Audio is synthesized in src/view/audio.ts (effects) and src/view/music.ts (note data). No audio files.
- After any view or UI change, run the browser test and look at the screenshots before saying it is done.
- Stay inside the size budgets. If a change breaks one, say so instead of raising the budget.
- One issue per PR. If a task needs a judgment about feel, stop and ask for numbers.
- All names, stages, models and sounds are original. Do not reference or copy any existing game's content.
