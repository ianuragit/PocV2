import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

function commitHash(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // GitHub Pages serves the site at https://<user>.github.io/<repo>/
  base: '/PocV2/',
  // three.js is one ~500 KB chunk; the gzip budget in tools/check-size-budget.mjs is the real limit.
  build: { chunkSizeWarningLimit: 800 },
  define: {
    __COMMIT__: JSON.stringify(commitHash()),
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/sim/**/*.test.ts'],
    environment: 'node',
  },
});
