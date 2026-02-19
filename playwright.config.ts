import { defineConfig, devices } from "@playwright/test";
import os from "node:os";

const resolvedPort = Number.parseInt(
  process.env.PLAYWRIGHT_PORT || process.env.PORT || "3100",
  10
);
const port = Number.isFinite(resolvedPort) ? resolvedPort : 3100;
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const resolvedWorkers = Number.parseInt(process.env.PLAYWRIGHT_WORKERS || "", 10);
const cpuCount = Math.max(1, os.cpus().length);
const defaultWorkers = Math.max(1, Math.min(2, Math.floor(cpuCount / 2) || 1));
const workers =
  Number.isFinite(resolvedWorkers) && resolvedWorkers > 0
    ? resolvedWorkers
    : defaultWorkers;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers,
  retries: 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: `bunx --bun next start -p ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
