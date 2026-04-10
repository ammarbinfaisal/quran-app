import type { DataUsageMode } from "@/lib/types";

export type NetworkQuality = {
  saveData: boolean;
  effectiveType: "4g" | "3g" | "2g" | "slow-2g" | "unknown";
};

// Minimal inline interface for the Network Information API (not in lib.dom yet).
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

export function getNetworkQuality(): NetworkQuality {
  if (
    typeof navigator === "undefined" ||
    !("connection" in navigator)
  ) {
    return { saveData: false, effectiveType: "unknown" };
  }

  const connection = (navigator as unknown as { connection: NetworkInformation }).connection;

  const saveData = connection.saveData === true;

  const raw = connection.effectiveType;
  let effectiveType: NetworkQuality["effectiveType"];
  if (raw === "4g" || raw === "3g" || raw === "2g" || raw === "slow-2g") {
    effectiveType = raw;
  } else {
    effectiveType = "unknown";
  }

  return { saveData, effectiveType };
}

export function getEffectiveDataMode(userMode: DataUsageMode): DataUsageMode {
  const { saveData, effectiveType } = getNetworkQuality();

  if (saveData || effectiveType === "2g" || effectiveType === "slow-2g") {
    return "low";
  }

  if (effectiveType === "3g") {
    return userMode === "high" ? "balanced" : userMode;
  }

  return userMode;
}
