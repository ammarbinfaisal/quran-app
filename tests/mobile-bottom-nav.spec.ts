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
  test("keeps every control on one full-width row without shrinking touch targets", async ({
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

    // The bar spans the full viewport width...
    expect(layout!.nav.width).toBe(360);

    // ...and everything sits on a single row: the center shares its vertical
    // band with the action clusters rather than wrapping onto its own line.
    for (const action of layout!.actions) {
      expect(action.top).toBeLessThan(layout!.center.bottom);
      expect(action.bottom).toBeGreaterThan(layout!.center.top);
      expect(action.height).toBeGreaterThanOrEqual(44);
    }

    // A single row must not overflow horizontally.
    const overflows = await page.evaluate(() => {
      const inner = document.querySelector<HTMLElement>(
        ".reader-bottom-nav-inner",
      );
      if (!inner) return null;
      return inner.scrollWidth > inner.clientWidth + 1;
    });
    expect(overflows).toBe(false);

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
        // Segmented controls keep a compact painted box but extend their
        // pressable area with an ::after overlay, so measure the larger of the
        // two.
        const overlayHeight =
          Number.parseFloat(getComputedStyle(element, "::after").minHeight) || 0;
        return {
          width: rect.width,
          height: Math.max(rect.height, overlayHeight),
        };
      });
    });

    for (const rect of targetRects) {
      expect(rect).not.toBeNull();
      expect((rect as Rect).height).toBeGreaterThanOrEqual(44);
      expect((rect as Rect).width).toBeGreaterThan(0);
    }
  });
});
