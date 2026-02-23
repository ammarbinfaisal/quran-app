"use client";

import { useState, useEffect, useCallback } from "react";
import type { OfflineStatus } from "@/lib/types";
import { getOfflineStatus } from "@/lib/offline/status";

export function useOfflineStatus(): {
  status: OfflineStatus | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<OfflineStatus | null>(null);

  const refresh = useCallback(() => {
    getOfflineStatus().then(setStatus).catch(() => {
      // If IndexedDB is unavailable, fall back to a basic status
      setStatus({
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
        downloadedMushafs: [],
        downloadedTranslations: [],
      });
    });
  }, []);

  useEffect(() => {
    refresh();

    const handleOnline = () => {
      setStatus((prev) =>
        prev ? { ...prev, online: true } : prev,
      );
    };

    const handleOffline = () => {
      setStatus((prev) =>
        prev ? { ...prev, online: false } : prev,
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refresh]);

  return { status, refresh };
}
