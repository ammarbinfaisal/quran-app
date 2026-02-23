"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HIDE_DELAY_MS = 2500;

/**
 * Manages immersive reading mode — auto-hides chrome (bottom nav)
 * after a period of inactivity or on scroll-down, reveals it on
 * scroll-up or tap.
 */
export function useImmersiveMode() {
    const [chromeVisible, setChromeVisible] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastScrollY = useRef(0);

    const showChrome = useCallback(() => {
        setChromeVisible(true);
    }, []);

    const hideChrome = useCallback(() => {
        setChromeVisible(false);
    }, []);

    const toggleChrome = useCallback(() => {
        setChromeVisible((v) => !v);
    }, []);

    /** Reset the auto-hide timer. Call on any user interaction. */
    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            hideChrome();
        }, HIDE_DELAY_MS);
    }, [hideChrome]);

    /** Call on scroll events — hides on scroll-down, shows on scroll-up. */
    const handleScroll = useCallback(
        (scrollY: number) => {
            const delta = scrollY - lastScrollY.current;
            lastScrollY.current = scrollY;

            if (delta > 4) {
                // scrolling down
                hideChrome();
            } else if (delta < -4) {
                // scrolling up
                showChrome();
                resetTimer();
            }
        },
        [hideChrome, showChrome, resetTimer],
    );

    // Start initial auto-hide timer
    useEffect(() => {
        resetTimer();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [resetTimer]);

    return {
        chromeVisible,
        showChrome,
        hideChrome,
        toggleChrome,
        resetTimer,
        handleScroll,
    };
}
