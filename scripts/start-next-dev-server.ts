import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const port = process.argv[2] ?? process.env.PORT ?? "3100";

const child = spawn("bunx", ["--bun", "next", "dev", "-p", port], {
  cwd: projectRoot,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Failed to start Next dev server:", error);
  process.exit(1);
});

const terminate = (signal: NodeJS.Signals) => {
  child.kill(signal);
};

process.on("SIGINT", () => terminate("SIGINT"));
process.on("SIGTERM", () => terminate("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
