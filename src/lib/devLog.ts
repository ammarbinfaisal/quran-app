/**
 * Development-only logging utility.
 * All calls are no-ops in production builds — zero perf cost.
 */
const isDev = process.env.NODE_ENV !== "production";

export function devLog(scope: string, ...args: unknown[]): void {
  if (isDev) {
    console.log(`[${scope}]`, ...args);
  }
}

export function devWarn(scope: string, ...args: unknown[]): void {
  if (isDev) {
    console.warn(`[${scope}]`, ...args);
  }
}
