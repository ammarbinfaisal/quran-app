"use client";

import { usePreferences } from "@/hooks/usePreferences";
import { type TranslationId } from "@/lib/types";
import { renderTranslationName } from "@/lib/translationDisplay";
import { SettingsSelectionIndicator } from "@/components/settings/SettingsSelectionIndicator";

const TRANSLATIONS: TranslationId[] = ["saheeh", "hilali-khan"];

export function TranslationPicker() {
  const { prefs, setPref } = usePreferences();
  const selectedIds = prefs.translationIds || [];

  const toggleTranslation = (id: TranslationId) => {
    const newIds = [...selectedIds];

    if (newIds.includes(id)) {
      // Must keep at least one of saheeh / hilali-khan selected
      const otherMain = id === "saheeh" ? "hilali-khan" : "saheeh";
      if (!newIds.includes(otherMain)) return;
      setPref("translationIds", newIds.filter((x) => x !== id));
    } else {
      setPref("translationIds", [...newIds, id]);
    }
  };

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Translation
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {TRANSLATIONS.map((id) => {
          const active = selectedIds.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleTranslation(id)}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors"
              style={{
                borderColor: active ? "var(--color-accent)" : "rgba(0,0,0,0.08)",
                backgroundColor: active ? "var(--color-surface)" : "var(--color-bg)",
              }}
            >
              <div className="text-sm font-medium text-[var(--color-text)]">
                {renderTranslationName(id)}
              </div>
              <SettingsSelectionIndicator active={active} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
