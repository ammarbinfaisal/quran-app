"use client";

import type { CSSProperties } from "react";
import { useSettings } from "@/context/SettingsContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TRANSLATOR_IDS, TRANSLATOR_LABELS } from "@/lib/constants";
import { MUSHAF_VARIANTS } from "@/lib/preferences";

const API_TRANSLATORS = [
  { id: TRANSLATOR_IDS.SAHEEH_INTERNATIONAL, label: TRANSLATOR_LABELS[20] },
  {
    id: TRANSLATOR_IDS.KHAN_AL_HILALI,
    label:
      "Khan & al-Hilali (Dr. Mohsin Khan and Shaykh Taqi ud-Deen al-Hilali)",
  },
];

export function SettingsClient() {
  const { settings, updateSettings } = useSettings();

  function selectionStyle(selected: boolean): CSSProperties {
    return {
      borderColor: selected ? "var(--primary)" : "var(--border)",
      background: selected
        ? "color-mix(in oklab, var(--primary) 8%, transparent)"
        : undefined,
    };
  }

  function toggleTranslator(id: number) {
    const current = settings.apiTranslators;
    const next = current.includes(id)
      ? current.filter((t) => t !== id)
      : [...current, id];

    if (next.length === 0) return;

    updateSettings({
      apiTranslators: next,
      translationCode:
        settings.translationCode === "n"
          ? (`tr${id}` as const)
          : (`tr${next[0]}` as const),
    });
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-8">
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Theme
        </h2>

        <div className="space-y-3">
          <button
            onClick={() => updateSettings({ theme: "warm" })}
            className="w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
            style={selectionStyle(settings.theme === "warm")}
          >
            <div>
              <p className="text-sm font-medium">Warm</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Soft beige background with warm accents
              </p>
            </div>
            <span
              className="w-7 h-7 rounded-full border"
              style={{ background: "#f7f1e4", borderColor: "rgba(20, 20, 20, 0.18)" }}
              aria-hidden="true"
            />
          </button>

          <button
            onClick={() => updateSettings({ theme: "white" })}
            className="w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
            style={selectionStyle(settings.theme === "white")}
          >
            <div>
              <p className="text-sm font-medium">White</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clean white with green accent
              </p>
            </div>
            <span
              className="w-7 h-7 rounded-full border"
              style={{ background: "#ffffff", borderColor: "rgba(45, 106, 79, 0.55)" }}
              aria-hidden="true"
            />
          </button>

          <button
            onClick={() => updateSettings({ theme: "dark" })}
            className="w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
            style={selectionStyle(settings.theme === "dark")}
          >
            <div>
              <p className="text-sm font-medium">Dark</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Black background (#0e0e0e)
              </p>
            </div>
            <span
              className="w-7 h-7 rounded-full border"
              style={{ background: "#0e0e0e", borderColor: "rgba(245, 245, 245, 0.18)" }}
              aria-hidden="true"
            />
          </button>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Reading Mode
        </h2>

        <div className="space-y-3">
          <button
            onClick={() => updateSettings({ translationCode: "n" })}
            className="w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
            style={selectionStyle(settings.translationCode === "n")}
          >
            <div>
              <p className="text-sm font-medium">Arabic Only</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Canonical route code: <code>t:n</code>
              </p>
            </div>
          </button>

          <button
            onClick={() =>
              updateSettings({
                translationCode: `tr${settings.apiTranslators[0]}` as const,
              })
            }
            className="w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
            style={selectionStyle(settings.translationCode !== "n")}
          >
            <div>
              <p className="text-sm font-medium">Arabic + Translation</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Canonical route code: <code>{`t:${settings.translationCode}`}</code>
              </p>
            </div>
          </button>
        </div>
      </section>

      <Separator />

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

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mushaf Script
        </h2>

        <div className="space-y-3">
          {MUSHAF_VARIANTS.map((variant) => (
            <button
              key={variant.code}
              onClick={() => updateSettings({ mushafCode: variant.code })}
              className="w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
              style={selectionStyle(settings.mushafCode === variant.code)}
            >
              <div>
                <p className="text-sm font-medium">{variant.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <code>{`m:${variant.code}`}</code> · mushaf {variant.mushafId}
                  {variant.lines ? ` · ${variant.lines.replace("_", " ")}` : ""}
                </p>
              </div>
              {settings.mushafCode === variant.code && (
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
