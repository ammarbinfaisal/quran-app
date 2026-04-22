/**
 * Swipe engine spec (behavioural TDD).
 *
 * Every test maps to one rule in the state-machine spec documented at the top
 * of `SwipeReader.tsx`. The tests dispatch synthetic `TouchEvent`s into the
 * swipe container and assert on (a) the track's inline `transform`, (b) which
 * page is rendered in the centre slot, and (c) the URL (debounced), matching
 * the three observable surfaces of the engine.
 *
 * Spec summary:
 *  S1. IDLE → DRAGGING on primary touchstart.
 *  S2. DRAGGING → commit when distance ≥ max(28px, 16% W) OR flick ≥ 0.35 px/ms.
 *  S3. DRAGGING → snap-back otherwise.
 *  S4. SETTLING (commit or snap-back) always returns to IDLE; next gesture works.
 *  S5. Multi-touch handoff preserves running displacement; no track jump.
 *  S6. Vertical scroll cancels the swipe (no commit, no snap-back transition).
 *  S7. Touches during SETTLING interrupt the animation and inherit the current
 *      transform as a new drag (no lost input; modern mobile-app behaviour).
 *  S8. Boundary rubber-band: cannot swipe past page 1 backward or TOTAL_PAGES forward.
 *  S9. Repeated committed swipes: N consecutive commits advance by N pages.
 */

import { test, expect, type Page } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

const SWIPE_TRANSITION_MS = 140;
const SETTLE_MS = SWIPE_TRANSITION_MS + 120; // transition + idempotency buffer

async function readerReady(page: Page) {
  await page.waitForSelector(".swipe-container", { timeout: 20_000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".mushaf-word").length > 0,
    { timeout: 30_000 }
  );
}

/** Read the page number rendered in the CENTER swipe slot. */
async function centerPage(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const slots = document.querySelectorAll<HTMLElement>(".swipe-page");
    const center = slots[1];
    if (!center) return NaN;
    const m = center.innerText.match(/\b(\d{1,3})\b/);
    return m ? Number(m[1]) : NaN;
  });
}

/** Dispatch a single horizontal drag gesture across `steps` touchmoves. */
async function dispatchSwipe(
  page: Page,
  opts: { deltaX: number; durationMs: number; steps?: number; startFromRightEdge?: boolean }
) {
  const { deltaX, durationMs, steps = 6, startFromRightEdge = true } = opts;
  await page.evaluate(
    async ({ deltaX, durationMs, steps, startFromRightEdge }) => {
      const container = document.querySelector<HTMLElement>(".swipe-container");
      if (!container) throw new Error("no container");
      const rect = container.getBoundingClientRect();
      const Y = rect.top + rect.height / 2;
      const startX = startFromRightEdge ? rect.left + rect.width - 40 : rect.left + 40;
      const id = Math.floor(Math.random() * 1e6);
      const mk = (x: number) =>
        new Touch({
          identifier: id,
          target: container,
          clientX: x,
          clientY: Y,
          pageX: x,
          pageY: Y,
          radiusX: 10,
          radiusY: 10,
          rotationAngle: 0,
          force: 1,
        });
      const fire = (type: string, touches: Touch[], changed: Touch[]) =>
        container.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches,
            targetTouches: touches,
            changedTouches: changed,
          })
        );
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const t0 = mk(startX);
      fire("touchstart", [t0], [t0]);
      const stepTime = durationMs / steps;
      for (let i = 1; i <= steps; i++) {
        const x = startX + (deltaX * i) / steps;
        const ti = mk(x);
        fire("touchmove", [ti], [ti]);
        await sleep(stepTime);
      }
      const tEnd = mk(startX + deltaX);
      fire("touchend", [], [tEnd]);
    },
    { deltaX, durationMs, steps, startFromRightEdge }
  );
}

/** Dispatch a vertical drag (should NOT change page). */
async function dispatchVerticalDrag(page: Page, deltaY: number, durationMs: number) {
  await page.evaluate(
    async ({ deltaY, durationMs }) => {
      const container = document.querySelector<HTMLElement>(".swipe-container");
      if (!container) throw new Error("no container");
      const rect = container.getBoundingClientRect();
      const X = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const id = Math.floor(Math.random() * 1e6);
      const mk = (y: number) =>
        new Touch({
          identifier: id,
          target: container,
          clientX: X,
          clientY: y,
          pageX: X,
          pageY: y,
          radiusX: 10,
          radiusY: 10,
          rotationAngle: 0,
          force: 1,
        });
      const fire = (type: string, touches: Touch[], changed: Touch[]) =>
        container.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches,
            targetTouches: touches,
            changedTouches: changed,
          })
        );
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const steps = 6;
      const t0 = mk(startY);
      fire("touchstart", [t0], [t0]);
      for (let i = 1; i <= steps; i++) {
        const y = startY + (deltaY * i) / steps;
        const ti = mk(y);
        fire("touchmove", [ti], [ti]);
        await sleep(durationMs / steps);
      }
      const tEnd = mk(startY + deltaY);
      fire("touchend", [], [tEnd]);
    },
    { deltaY, durationMs }
  );
}

test.describe("SwipeReader — state machine & commit spec", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/p/100");
    await readerReady(page);
    await expect.poll(() => centerPage(page)).toBe(100);
  });

  // S2 + S3: commit threshold semantics
  test("S2a commit on distance: drag 100px left commits to previous page", async ({ page }) => {
    await dispatchSwipe(page, { deltaX: -100, durationMs: 250 });
    await page.waitForTimeout(SETTLE_MS);
    await expect.poll(() => centerPage(page)).toBe(99);
  });

  test("S2b commit on flick: 20px drag at high velocity commits", async ({ page }) => {
    // 20px over 50ms = 0.4 px/ms > 0.35 threshold, and 20 > 12 min flick distance.
    await dispatchSwipe(page, { deltaX: -20, durationMs: 50, steps: 3 });
    await page.waitForTimeout(SETTLE_MS);
    await expect.poll(() => centerPage(page)).toBe(99);
  });

  test("S3 snap-back: drag 20px slowly (not a flick) does NOT change page", async ({ page }) => {
    // 20px over 400ms = 0.05 px/ms (below flick), and 20 < 62.4 distance threshold.
    await dispatchSwipe(page, { deltaX: -20, durationMs: 400, steps: 8 });
    await page.waitForTimeout(SETTLE_MS);
    await expect.poll(() => centerPage(page)).toBe(100);
  });

  // S9: repeated commits — the bug we actually hit
  test("S9 repeated commits: 5 consecutive committed swipes advance 5 pages", async ({ page }) => {
    const start = await centerPage(page);
    for (let i = 0; i < 5; i++) {
      await dispatchSwipe(page, { deltaX: -100, durationMs: 250 });
      await page.waitForTimeout(SETTLE_MS);
    }
    await expect.poll(() => centerPage(page)).toBe(start - 5);
  });

  // S4: SETTLING → IDLE — new gesture after previous commit must work even if
  //     the parent re-render ordering differs.
  test("S4 SETTLING → IDLE: swipe immediately after previous commit completes", async ({ page }) => {
    const start = await centerPage(page);
    await dispatchSwipe(page, { deltaX: -100, durationMs: 250 });
    await page.waitForTimeout(SETTLE_MS); // previous swipe fully settled
    await dispatchSwipe(page, { deltaX: -100, durationMs: 250 });
    await page.waitForTimeout(SETTLE_MS);
    await expect.poll(() => centerPage(page)).toBe(start - 2);
  });

  // S6: vertical scroll cancels the swipe, no page change
  test("S6 vertical scroll does not commit a page change", async ({ page }) => {
    await dispatchVerticalDrag(page, 200, 300);
    await page.waitForTimeout(SETTLE_MS);
    await expect.poll(() => centerPage(page)).toBe(100);
  });

  // S7: mid-SETTLING touch interrupts the animation, inherits current transform,
  //     and the second flick commits on top of the first — advancing 2 pages.
  test("S7 interrupt + inherit: two back-to-back flicks mid-SETTLING commit 2 pages", async ({ page }) => {
    const start = await centerPage(page);
    await page.evaluate(async () => {
      const container = document.querySelector<HTMLElement>(".swipe-container")!;
      const rect = container.getBoundingClientRect();
      const Y = rect.top + rect.height / 2;
      const W = rect.width;
      const mk = (id: number, x: number) =>
        new Touch({
          identifier: id, target: container, clientX: x, clientY: Y, pageX: x, pageY: Y,
          radiusX: 10, radiusY: 10, rotationAngle: 0, force: 1,
        });
      const fire = (type: string, touches: Touch[], changed: Touch[]) =>
        container.dispatchEvent(new TouchEvent(type, {
          bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: changed,
        }));
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const doSwipe = async (id: number) => {
        const startX = rect.left + W - 40;
        let t = mk(id, startX);
        fire("touchstart", [t], [t]);
        for (let i = 1; i <= 4; i++) {
          t = mk(id, startX - (100 * i) / 4);
          fire("touchmove", [t], [t]);
          await sleep(12);
        }
        fire("touchend", [], [t]);
      };
      await doSwipe(1);
      await sleep(40); // mid-transition (transition is 140ms)
      await doSwipe(2);
    });
    await page.waitForTimeout(SETTLE_MS * 2);
    // Interrupt + inherit: both flicks count — TWO pages advanced.
    await expect.poll(() => centerPage(page)).toBe(start - 2);
  });

  // S8: boundary rubber-band — at page 1, dragging LEFT (toward page 0) must snap back.
  test("S8 cannot swipe past page 1", async ({ page }) => {
    await page.goto("/p/1");
    await readerReady(page);
    await expect.poll(() => centerPage(page)).toBe(1);
    // deltaX < 0 == drag finger left == request previous page. There is no page 0.
    await dispatchSwipe(page, { deltaX: -120, durationMs: 250 });
    await page.waitForTimeout(SETTLE_MS);
    await expect.poll(() => centerPage(page)).toBe(1);
  });
});
