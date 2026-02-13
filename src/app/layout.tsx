import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SettingsProvider } from "@/context/SettingsContext";
import { getServerSettings } from "@/lib/preferences-server";
import { ThemeSync } from "@/components/ThemeSync";
import { PreferenceRedirector } from "@/components/PreferenceRedirector";

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
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <SettingsProvider initialSettings={initialSettings}>
          <ThemeSync />
          <PreferenceRedirector />
          {children}
        </SettingsProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
