import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 360, height: 780 },
});

type Rect = {
  top: number;
  bottom: number;
  width: number;
  height: number;
};

test.describe("Reader bottom nav on small screens", () => {
  test("puts center controls above action buttons without shrinking touch targets", async ({
    page,
  }) => {
    await page.goto("/p/1", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".reader-bottom-nav", { timeout: 20_000 });
    await page.evaluate(() => {
      (window as unknown as { __showChrome?: () => void }).__showChrome?.();
    });

    const layout = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(".reader-bottom-nav");
      const center = nav?.querySelector<HTMLElement>('[data-nav-row="center"]');
      const actions = Array.from(
        nav?.querySelectorAll<HTMLElement>('[data-nav-row="actions"]') ?? [],
      );
      if (!nav || !center || actions.length === 0) return null;

      const toRect = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };

      return {
        nav: toRect(nav),
        center: toRect(center),
        actions: actions.map(toRect),
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.center.width).toBeGreaterThan(layout!.nav.width * 0.9);

    const actionTop = Math.min(...layout!.actions.map((rect) => rect.top));
    expect(layout!.center.bottom).toBeLessThanOrEqual(actionTop + 1);
    for (const action of layout!.actions) {
      expect(action.height).toBeGreaterThanOrEqual(44);
    }

    const targetRects = await page.evaluate(() => {
      const selectors = [
        'a[aria-label="Home"]',
        'button[aria-label="Open navigation"]',
        'button[aria-label="Share"]',
        'button[aria-label="Settings"]',
        'button[aria-label="Reading mode: Page"]',
      ];
      return selectors.map((selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
    });

    for (const rect of targetRects) {
      expect(rect).not.toBeNull();
      expect((rect as Rect).height).toBeGreaterThanOrEqual(44);
      expect((rect as Rect).width).toBeGreaterThan(0);
    }
  });
});
