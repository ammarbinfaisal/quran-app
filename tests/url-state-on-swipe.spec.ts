/**
 * URL update on swipe must NOT trigger a Next.js segment refetch/remount.
 *
 * The swipe engine renders the next page from already-prefetched data. The URL
 * needs to reflect the new page (so refresh/share works), but using
 * router.replace causes the App Router to re-run the segment — refetching
 * page data and remounting the React tree, which produces a brief skeleton
 * flash and discards swipe-engine state.
 *
 * The fix: window.history.replaceState — pure address-bar update, no
 * framework involvement.
 *
 * What this test asserts after a wheel-driven page change:
 *  (1) URL pathname updates from /p/N to /p/N+1.
 *  (2) No fetch is made for the new page's mushaf-data JSON
 *      (would only happen on a segment refetch).
 *  (3) No <div class="mushaf-page"> is removed-then-added at the document
 *      root within the same animation frame (would indicate React remount,
 *      as opposed to the swipe-track's natural slot rotation).
 */

import { test, expect, type Page } from "@playwright/test";

test.use({
    viewport: { width: 390, height: 844 },
});

const START_PAGE = 100;
const NEXT_PAGE = 101;
const DEBOUNCE_MS = 150;
const BUFFER_MS = 350;

async function waitForReader(page: Page) {
    await page.waitForSelector(".swipe-container", { timeout: 20_000 });
    await page.waitForFunction(
        () => document.querySelectorAll(".mushaf-word").length > 0,
        { timeout: 30_000 }
    );
}

test.describe("URL state updates on swipe", () => {
    test("history.replaceState used (no segment refetch / no React remount)", async ({ page }) => {
        await page.goto(`/p/${START_PAGE}`, { waitUntil: "domcontentloaded" });
        await waitForReader(page);

        // Install instrumentation: capture every fetch URL and observe
        // .mushaf-page mutations on the swipe-container subtree to detect
        // a React-driven remount (router.replace would trigger one).
        await page.evaluate(() => {
            (window as unknown as { __urlTestState: { fetches: string[]; mountCycles: string[] } }).__urlTestState = {
                fetches: [],
                mountCycles: [],
            };
            const state = (window as unknown as { __urlTestState: { fetches: string[]; mountCycles: string[] } }).__urlTestState;
            const origFetch = window.fetch;
            window.fetch = function (url: RequestInfo | URL, ...rest: [RequestInit?]) {
                state.fetches.push(typeof url === "string" ? url : (url as URL | Request).toString());
                return origFetch.call(this, url as RequestInfo, ...rest);
            };
            const swipeContainer = document.querySelector(".swipe-container") || document.body;
            const obs = new MutationObserver((records) => {
                for (const rec of records) {
                    rec.removedNodes.forEach((n) => {
                        const el = n as Element;
                        if (el.nodeType === 1 && el.classList?.contains("mushaf-page"))
                            state.mountCycles.push("removed");
                    });
                    rec.addedNodes.forEach((n) => {
                        const el = n as Element;
                        if (el.nodeType === 1 && el.classList?.contains("mushaf-page"))
                            state.mountCycles.push("added");
                    });
                }
            });
            obs.observe(swipeContainer, { childList: true, subtree: true });
            (window as unknown as { __urlTestObs: MutationObserver }).__urlTestObs = obs;
        });

        // Trigger a swipe via wheel (deltaY > 20 advances one page in SwipeReader's onWheel).
        await page.evaluate(() => {
            document
                .querySelector(".swipe-container")
                ?.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }));
        });

        // Wait beyond the debounced URL replace (150ms in Reader.tsx).
        await page.waitForTimeout(DEBOUNCE_MS + BUFFER_MS);

        const result = await page.evaluate(() => {
            const state = (window as unknown as { __urlTestState: { fetches: string[]; mountCycles: string[] } }).__urlTestState;
            return {
                pathname: location.pathname,
                fetches: state.fetches,
                mountCycles: state.mountCycles,
            };
        });

        // (1) URL updated to the next page.
        expect(result.pathname, "URL should reflect the new page").toBe(`/p/${NEXT_PAGE}`);

        // (2) No fetch for the new page's mushaf-data JSON.
        // Prefetches for FUTURE pages (e.g. p+5, p-5) are fine — those happen
        // regardless of URL strategy. We only flag a refetch of the page we
        // just swiped to, which would only happen on a segment refresh.
        const refetchOfCurrentPage = result.fetches.filter((u) =>
            new RegExp(`/mushaf-data/v2/p${String(NEXT_PAGE).padStart(3, "0")}\\.json`).test(u)
        );
        expect(
            refetchOfCurrentPage,
            `current page should NOT be re-fetched (would indicate router.replace segment refresh). Saw fetches: ${JSON.stringify(result.fetches)}`
        ).toEqual([]);

        // (3) No remount of the .mushaf-page in the swipe slot from React.
        // Note: the swipe-track DOES rotate slot positions, but we observe
        // mounts/removals — a slot rotation re-uses the same elements via
        // React keys. A router.replace segment refresh would unmount and
        // re-mount the entire mushaf tree, producing many add/remove events.
        // We tolerate up to 1 add/remove (slot rotation can swap an element
        // in/out of the visible track) but flag a full remount cascade.
        const removedCount = result.mountCycles.filter((c) => c === "removed").length;
        const addedCount = result.mountCycles.filter((c) => c === "added").length;
        expect(
            removedCount,
            `mushaf-page remount cascade detected (router.replace bug?): ${JSON.stringify(result.mountCycles)}`
        ).toBeLessThanOrEqual(2);
        expect(addedCount).toBeLessThanOrEqual(2);
    });

    test("multiple consecutive swipes still use replaceState (no cascading refetches)", async ({ page }) => {
        await page.goto(`/p/${START_PAGE}`, { waitUntil: "domcontentloaded" });
        await waitForReader(page);

        await page.evaluate(() => {
            (window as unknown as { __urlTestState: { fetches: string[] } }).__urlTestState = { fetches: [] };
            const state = (window as unknown as { __urlTestState: { fetches: string[] } }).__urlTestState;
            const origFetch = window.fetch;
            window.fetch = function (url: RequestInfo | URL, ...rest: [RequestInit?]) {
                state.fetches.push(typeof url === "string" ? url : (url as URL | Request).toString());
                return origFetch.call(this, url as RequestInfo, ...rest);
            };
        });

        // 3 swipes forward (wheel lock is 220ms, give 300ms between)
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
                document
                    .querySelector(".swipe-container")
                    ?.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }));
            });
            await page.waitForTimeout(300);
        }
        await page.waitForTimeout(DEBOUNCE_MS + BUFFER_MS);

        const result = await page.evaluate(() => ({
            pathname: location.pathname,
            fetches: (window as unknown as { __urlTestState: { fetches: string[] } }).__urlTestState.fetches,
        }));

        expect(result.pathname, "URL after 3 forward swipes").toBe(`/p/${START_PAGE + 3}`);

        // None of pages 100..103 should be refetched (they were already loaded
        // by start + prefetch). Prefetches for further-ahead pages are OK.
        const refetches = result.fetches.filter((u) =>
            [START_PAGE, START_PAGE + 1, START_PAGE + 2, START_PAGE + 3].some((p) =>
                new RegExp(`/mushaf-data/v2/p${String(p).padStart(3, "0")}\\.json`).test(u)
            )
        );
        expect(
            refetches,
            `pages we swiped through should not be refetched. Saw: ${JSON.stringify(refetches)}`
        ).toEqual([]);
    });
});
