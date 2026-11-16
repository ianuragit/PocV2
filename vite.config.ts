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
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**/*.ts'],
      exclude: ['src/sim/index.ts', 'src/sim/types.ts'],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
    environment: 'node',
  },
});
