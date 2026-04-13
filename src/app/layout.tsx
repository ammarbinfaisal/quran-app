import type { Metadata, Viewport } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  createWebSiteJsonLd,
  getSiteUrl,
} from "@/lib/seo";
import { RecitationProvider } from "@/components/recitation/useRecitationPlayer";
import { RecitationContextProvider } from "@/components/recitation/RecitationContext";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#111827",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === "production";

  return (
    <html lang="ar" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://api.quran.com" />
        <link rel="preconnect" href="https://api.quran.com" crossOrigin="anonymous" />
        <JsonLd id="website-jsonld" data={createWebSiteJsonLd()} />
      </head>
      <body>
        <ThemeInit />
        <RecitationProvider>
          <RecitationContextProvider>
            {children}
          </RecitationContextProvider>
        </RecitationProvider>
        <Toaster />
        {isProd ? <ServiceWorkerRegistration /> : <ServiceWorkerDevCleanup />}
      </body>
    </html>
  );
}

/** Inline script to set theme before paint to prevent flash */
function ThemeInit() {
  const script = `
    (function() {
      var THEME_ACCENT = {
        "light-warm": "#8b6914",
        "dark-warm": "#c4a35a",
        "white-green": "#2d6a4f",
        "classic-dark": "#5fa87f",
        "blue-slate-dark": "#7aa2f7",
        "blue-slate-light": "#345caa"
      };

      function applyThemeColor(theme) {
        var color = THEME_ACCENT[theme] || THEME_ACCENT["light-warm"];
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "theme-color");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", color);
      }

      try {
        var p = JSON.parse(localStorage.getItem('quran-preferences') || '{}');
        var theme = p.theme || "light-warm";
        document.documentElement.setAttribute('data-theme', theme);
        applyThemeColor(theme);
        if (p.fontScale) document.documentElement.style.setProperty('--mushaf-font-scale', p.fontScale);
      } catch(e) {}

      window.addEventListener("preferences-changed", function(e) {
        try {
          var next = e && e.detail ? e.detail : null;
          if (!next || !next.theme) return;
          document.documentElement.setAttribute("data-theme", next.theme);
          applyThemeColor(next.theme);
        } catch(_) {}
      });
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

function ServiceWorkerRegistration() {
  const script = `
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js');
      });
    }
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

function ServiceWorkerDevCleanup() {
  const script = `
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(reg) { reg.unregister(); });
      });
    }
    if ('caches' in window) {
      caches.keys().then(function(keys) {
        keys.forEach(function(key) { caches.delete(key); });
      });
    }
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
