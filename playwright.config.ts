import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8787",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "npx wrangler dev --port 8787",
    url: "http://127.0.0.1:8787",
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
