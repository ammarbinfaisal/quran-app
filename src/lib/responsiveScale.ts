// ---------------------------------------------------------------------------
// Responsive device/UI scale helpers
//
// Avoids vw-based font sizing by setting coarse CSS scale variables on the
// document element. Rem-based Tailwind components then scale from the html
// font-size. SSR safe — all window access is guarded.
// ---------------------------------------------------------------------------

export type ResponsiveScaleOptions = {
  /** Minimum device scale (e.g. for very small phones) */
  minDeviceScale?: number;
  /** Maximum device scale (e.g. for tablets/large phones) */
  maxDeviceScale?: number;
  /** Largest user UI scale multiplier allowed from a fontScale of 10 */
  maxUserUiScale?: number;
};

const DEFAULT_OPTIONS: Required<ResponsiveScaleOptions> = {
  minDeviceScale: 0.875,
  maxDeviceScale: 1.125,
  maxUserUiScale: 1.25,
};

function getWindow(): (Window & typeof globalThis) | null {
  return typeof window !== "undefined" ? window : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Compute a conservative device UI scale from the viewport and DPR.
 *
 * Uses CSS pixels (window.innerWidth/innerHeight) rather than screen
 * dimensions so orientation changes and resizes are reflected. The result
 * is intentionally coarse: only a few steps so layouts stay predictable.
 */
export function computeDeviceScale(options?: ResponsiveScaleOptions): number {
  const win = getWindow();
  if (!win) return 1;

  const { minDeviceScale, maxDeviceScale } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const width = win.innerWidth || 375;
  const height = win.innerHeight || 667;
  const dpr = clamp(win.devicePixelRatio || 1, 1, 3);
  const minDimension = Math.min(width, height);

  // Base factor derived from logical viewport width, normalized around 375px.
  // DPR is used lightly: high-DPR small screens should not shrink UI.
  const factor = 1 + (minDimension - 375) / 2000 + (dpr - 2) * 0.015;

  return clamp(factor, minDeviceScale, maxDeviceScale);
}

function computeUserUiScale(
  fontScale: number,
  options?: ResponsiveScaleOptions,
): number {
  const { maxUserUiScale } = { ...DEFAULT_OPTIONS, ...options };
  const clamped = clamp(fontScale, 1, 10);
  // Gentle mapping: a fontScale of 10 only adds ~25% UI scale by default.
  return clamp(1 + (clamped - 1) * 0.025, 1, maxUserUiScale);
}

/**
 * Apply all responsive scale CSS variables.
 *
 * - --mushaf-font-scale: the raw user fontScale (default 1)
 * - --user-ui-font-scale: a mild UI scale derived from fontScale
 * - --device-ui-font-scale: the coarse device viewport factor
 */
export function applyResponsiveScales(
  fontScale?: number,
  options?: ResponsiveScaleOptions,
): void {
  const win = getWindow();
  if (!win) return;

  const rawFontScale = fontScale ?? 1;
  const clamped = clamp(rawFontScale, 1, 10);
  const deviceScale = computeDeviceScale(options);
  const userUiScale = computeUserUiScale(clamped, options);

  const root = win.document.documentElement;
  root.style.setProperty("--mushaf-font-scale", String(clamped));
  root.style.setProperty("--user-ui-font-scale", String(userUiScale));
  root.style.setProperty("--device-ui-font-scale", String(deviceScale));
}

/**
 * Install resize/orientation/visualViewport listeners and return cleanup.
 *
 * The handler is throttled with requestAnimationFrame so rapid resize events
 * do not queue excessive work. `getFontScale` is read on each apply so
 * preference changes made elsewhere are picked up automatically.
 */
export function installResponsiveScaleListeners(
  getFontScale: () => number,
  options?: ResponsiveScaleOptions,
): () => void {
  const win = getWindow();
  if (!win) return () => {};

  let rafId: number | null = null;

  const apply = () => {
    if (rafId !== null) return;
    rafId = win.requestAnimationFrame(() => {
      rafId = null;
      applyResponsiveScales(getFontScale(), options);
    });
  };

  const onResize = () => apply();
  const onOrientation = () => apply();

  win.addEventListener("resize", onResize, { passive: true });
  win.addEventListener("orientationchange", onOrientation, { passive: true });

  const vv = win.visualViewport;
  if (vv) {
    vv.addEventListener("resize", onResize, { passive: true });
  }

  // Apply immediately so the first paint sees the computed scale.
  applyResponsiveScales(getFontScale(), options);

  return () => {
    if (rafId !== null) {
      win.cancelAnimationFrame(rafId);
      rafId = null;
    }
    win.removeEventListener("resize", onResize);
    win.removeEventListener("orientationchange", onOrientation);
    if (vv) {
      vv.removeEventListener("resize", onResize);
    }
  };
}
