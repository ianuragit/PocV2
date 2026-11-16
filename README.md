# Real Cop 2

An on-rails police shooter that runs in the browser. TypeScript, Three.js, Vite, deployed to GitHub Pages.

**Play:** https://ianuragit.github.io/PocV2/

## Develop

```bash
npm ci
npm run dev
```

Checks: `npm run lint`, `npm run typecheck`, `npm run validate`, `npm test`, `npm run build`, `npm run budget`, `npm run test:e2e`.

## One-time repo settings

1. Settings → Pages → Source: **GitHub Actions**.
2. Settings → Branches: protect `main`, require the `check` job.
3. For `@claude` on issues: run `/install-github-app` in Claude Code to add the `ANTHROPIC_API_KEY` (or `CLAUDE_CODE_OAUTH_TOKEN`) secret.

`base` in `vite.config.ts` is `/PocV2/`; change it if the repo is renamed.

See `docs/spec.md` for the build spec and milestones.
