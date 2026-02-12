import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SettingsProvider } from "@/context/SettingsContext";
import { getServerSettings } from "@/lib/preferences-server";
import { ThemeSync } from "@/components/ThemeSync";

export const metadata: Metadata = {
  title: "Quran",
  description: "Quran — mushaf reader",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialSettings = await getServerSettings();
  const themeColor = initialSettings.theme === "dark" ? "#0e0e0e" : "#2d6a4f";

  return (
    <html
      lang="en"
      translate="no"
      data-theme={initialSettings.theme}
      className={initialSettings.theme === "dark" ? "dark" : undefined}
    >
      <head>
        <meta name="google" content="notranslate" />
        <meta name="theme-color" content={themeColor} />
      </head>
      <body>
        <SettingsProvider initialSettings={initialSettings}>
          <ThemeSync />
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
