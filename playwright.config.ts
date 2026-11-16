import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173/PocV2/',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      // Local runs can point at a preinstalled Chromium when its version differs from @playwright/test's.
      ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
      // Runners have no GPU; allow software WebGL so the canvas renders.
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/PocV2/',
    reuseExistingServer: !process.env.CI,
  },
});
