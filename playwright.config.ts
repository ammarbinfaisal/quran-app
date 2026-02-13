import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const serverScript = resolve(projectRoot, "scripts", "start-next-dev-server.ts");
const webServerCommand = `bun ${JSON.stringify(serverScript)} 3100`;
const useWebServer = process.env.PLAYWRIGHT_WEB_SERVER === "1";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: useWebServer ? "http://127.0.0.1:3100" : undefined,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: useWebServer
    ? {
        command: webServerCommand,
        url: "http://127.0.0.1:3100",
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
