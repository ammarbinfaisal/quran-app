import { test, expect, type Page } from "@playwright/test";

test.use({ hasTouch: true });

async function waitForMushaf(page: Page) {
  await page.waitForSelector(".mushaf-word", { timeout: 15_000 });
}

async function dispatchSwipe(
  page: Page,
  startX: number,
  endX: number,
  durationMs: number = 400,
  identifier: number = 1,
) {
  await page.evaluate(
    ({ startX, endX, durationMs, identifier }) => {
      const container = document.querySelector(".swipe-container") as HTMLElement;
      if (!container) throw new Error("Swipe container not found");

      const touchObj = new Touch({
        identifier,
        target: container,
        clientX: startX,
        clientY: 300,
        pageX: startX,
        pageY: 300,
        screenX: startX,
        screenY: 300,
      });

      container.dispatchEvent(
        new TouchEvent("touchstart", {
          cancelable: true,
          bubbles: true,
          touches: [touchObj],
          targetTouches: [touchObj],
          changedTouches: [touchObj],
        }),
      );

      const steps = 10;
      const stepDuration = durationMs / steps;
      let currentStep = 0;

      return new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          currentStep++;
          const progress = currentStep / steps;
          const currentX = startX + (endX - startX) * progress;

          const moveTouch = new Touch({
            identifier,
            target: container,
            clientX: currentX,
            clientY: 300,
            pageX: currentX,
            pageY: 300,
            screenX: currentX,
            screenY: 300,
          });

          container.dispatchEvent(
            new TouchEvent("touchmove", {
              cancelable: true,
              bubbles: true,
              touches: [moveTouch],
              targetTouches: [moveTouch],
              changedTouches: [moveTouch],
            }),
          );

          if (currentStep >= steps) {
            clearInterval(interval);
            container.dispatchEvent(
              new TouchEvent("touchend", {
                cancelable: true,
                bubbles: true,
                touches: [],
                targetTouches: [],
                changedTouches: [moveTouch],
              }),
            );
            resolve();
          }
        }, stepDuration);
      });
    },
    { startX, endX, durationMs, identifier },
  );
}

test.describe("Mushaf scroll/swipe clears ?verse and does not reset scroll", () => {
  test("Scroll mode: user scroll clears ?verse and does not jump back to highlight", async ({
    page,
  }) => {
    await page.goto("/s/s/2?verse=2:1");
    await waitForMushaf(page);
    await page.waitForTimeout(1_000);

    const scroller = page.locator("[data-scroll-reader]");
    await expect(scroller).toBeVisible();

    await expect
      .poll(
        async () =>
          scroller.evaluate((el) => {
            const node = el as HTMLElement;
            return node.scrollHeight - node.clientHeight;
          }),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(600);

    const afterScrollTop = await scroller.evaluate((el) => {
      const node = el as HTMLElement;
      node.scrollTo({ top: 2000, behavior: "instant" as ScrollBehavior });
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
      return node.scrollTop;
    });

    await page.waitForTimeout(600);

    const url = page.url();
    expect(url).toContain("/s/s/2");
    expect(url).not.toContain("?verse=");

    expect(afterScrollTop).toBeGreaterThan(500);
    const laterScrollTop = await scroller.evaluate(
      (el) => (el as HTMLElement).scrollTop,
    );
    expect(laterScrollTop).toBeGreaterThan(afterScrollTop - 150);
  });

  test("Swipe mode: any swipe clears ?verse even if it snaps back", async ({
    page,
  }) => {
    await page.goto("/p/2?verse=2:1");
    await waitForMushaf(page);
    await page.waitForSelector(".swipe-container");

    expect(page.url()).toContain("?verse=2:1");

    const box = await page.locator(".swipe-container").boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const startX = box.x + box.width / 2;
    const endX = startX - box.width * 0.12; // below commit ratio, slow -> snap back
    await dispatchSwipe(page, startX, endX, 900);

    await page.waitForTimeout(600);

    await expect(page).toHaveURL(/\/p\/2(?:\?|$)/);
    expect(page.url()).not.toContain("?verse=");
  });
});
