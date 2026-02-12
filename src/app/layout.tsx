import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SettingsProvider } from "@/context/SettingsContext";
import { getServerSettings } from "@/lib/preferences-server";

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
  themeColor: "#2d6a4f",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialSettings = await getServerSettings();

  return (
    <html lang="en" translate="no">
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body>
        <SettingsProvider initialSettings={initialSettings}>{children}</SettingsProvider>
      </body>
    </html>
  );
}
