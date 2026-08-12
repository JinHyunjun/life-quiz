import { defineConfig } from "@playwright/test";

const runHex = Date.now().toString(16).slice(-8).padStart(8, "0");
const testIpPrefix = `2001:db8:${runHex.slice(0, 4)}:${runHex.slice(4)}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
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
    {
      name: "desktop",
      use: {
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: { "cf-connecting-ip": `${testIpPrefix}::1` },
      },
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        extraHTTPHeaders: { "cf-connecting-ip": `${testIpPrefix}::2` },
      },
    },
  ],
  webServer: {
    command: "npm run build && npx wrangler dev --port 8787",
    url: "http://127.0.0.1:8787",
    env: {
      ...process.env,
      INGEST_ADMIN_TOKEN: "playwright-admin-token",
      BETTER_AUTH_SECRET: "playwright-better-auth-secret-with-32-characters",
    },
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
