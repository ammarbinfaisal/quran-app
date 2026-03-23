"use client";

import { AlignLeft, BookOpen, ScrollText } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { setPreference } from "@/lib/preferences";
import { IconSegmentedToggle, type IconSegmentedOption } from "@/components/navigation/IconSegmentedToggle";
import type { ViewMode } from "@/lib/types";

type MainMode = "p" | "v" | "s";

const MODE_OPTIONS: ReadonlyArray<IconSegmentedOption<MainMode>> = [
  { value: "p", label: "Page", Icon: BookOpen },
  { value: "v", label: "Verse", Icon: AlignLeft },
  { value: "s", label: "Scroll", Icon: ScrollText },
];

const VIEW_MODE_TO_MAIN: Record<ViewMode, MainMode> = {
  mushaf: "p",
  vbv: "v",
  scroll: "s",
};

const MAIN_TO_VIEW_MODE: Record<MainMode, ViewMode> = {
  p: "mushaf",
  v: "vbv",
  s: "scroll",
};

export function ModeSettingToggle() {
  const { prefs } = usePreferences();
  const mode = VIEW_MODE_TO_MAIN[prefs.viewMode] ?? "p";

  function handleSelect(nextMode: MainMode) {
    if (nextMode === mode) return;
    setPreference("viewMode", MAIN_TO_VIEW_MODE[nextMode]);
  }

  return (
    <IconSegmentedToggle
      options={MODE_OPTIONS}
      value={mode}
      pendingValue={null}
      ariaLabel="Default reading mode"
      onSelect={handleSelect}
      itemWidthPx={24}
      iconClassName="h-3.5 w-3.5"
      className="w-[76px]"
    />
  );
}
