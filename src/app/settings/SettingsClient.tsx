"use client";

import { useSettings } from "@/context/SettingsContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TRANSLATOR_IDS, TRANSLATOR_LABELS } from "@/lib/constants";
import type { Settings } from "@/lib/types";

const MUSHAF_LAYOUTS: { value: Settings["mushafLayout"]; label: string; desc: string }[] = [
  { value: "hafs-v2", label: "Hafs (Standard)", desc: "Default Uthmani script" },
  { value: "hafs-v4", label: "Hafs v4", desc: "With tajweed color markings" },
  { value: "hafs-unicode", label: "Unicode", desc: "Digital Khatt Unicode" },
];

const API_TRANSLATORS = [
  { id: TRANSLATOR_IDS.SAHEEH_INTERNATIONAL, label: TRANSLATOR_LABELS[20] },
  { id: TRANSLATOR_IDS.KHAN_AL_HILALI, label: "Khan & al-Hilali (Dr. Mohsin Khan and Shaykh Taqi ud-Deen al-Hilali)" },
];

export function SettingsClient() {
  const { settings, updateSettings } = useSettings();

  function toggleTranslator(id: number) {
    const current = settings.apiTranslators;
    const next = current.includes(id)
      ? current.filter((t) => t !== id)
      : [...current, id];
    // Must have at least one translator selected
    if (next.length === 0) return;
    updateSettings({ apiTranslators: next });
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-8">
      {/* Translations section */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Translations
        </h2>

        <div className="space-y-4">
          {API_TRANSLATORS.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-4">
              <Label htmlFor={`t-${t.id}`} className="text-sm leading-5 cursor-pointer flex-1">
                {t.label}
              </Label>
              <Switch
                id={`t-${t.id}`}
                checked={settings.apiTranslators.includes(t.id)}
                onCheckedChange={() => toggleTranslator(t.id)}
              />
            </div>
          ))}
        </div>

        <Separator />

        {/* Abu Iyaad */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <Label htmlFor="show-abu-iyaad" className="text-sm leading-5 cursor-pointer flex-1">
              <span className="block font-medium">Abu Iyaad</span>
              <span className="block text-muted-foreground text-xs mt-0.5">
                Show Abu Iyaad&apos;s translation when available
              </span>
            </Label>
            <Switch
              id="show-abu-iyaad"
              checked={settings.showAbuIyaad}
              onCheckedChange={(v) => updateSettings({ showAbuIyaad: v })}
            />
          </div>

          {settings.showAbuIyaad && (
            <div className="flex items-start justify-between gap-4 pl-0">
              <Label htmlFor="prefer-abu-iyaad" className="text-sm leading-5 cursor-pointer flex-1 text-muted-foreground">
                Prefer Abu Iyaad (show first when available)
              </Label>
              <Switch
                id="prefer-abu-iyaad"
                checked={settings.preferAbuIyaad}
                onCheckedChange={(v) => updateSettings({ preferAbuIyaad: v })}
              />
            </div>
          )}
        </div>
      </section>

      <Separator />

      {/* Mushaf layout */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mushaf Script
        </h2>

        <div className="space-y-3">
          {MUSHAF_LAYOUTS.map((layout) => (
            <button
              key={layout.value}
              onClick={() => updateSettings({ mushafLayout: layout.value })}
              className="w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
              style={{
                borderColor:
                  settings.mushafLayout === layout.value
                    ? "hsl(var(--primary))"
                    : "hsl(var(--border))",
                background:
                  settings.mushafLayout === layout.value
                    ? "hsl(var(--primary) / 0.05)"
                    : undefined,
              }}
            >
              <div>
                <p className="text-sm font-medium">{layout.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{layout.desc}</p>
              </div>
              {settings.mushafLayout === layout.value && (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
