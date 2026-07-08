import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
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

const uiFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ui",
});

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
  themeColor: "#f4ecd8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === "production";

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={uiFont.variable}>
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

/** Inline script to set theme and responsive scales before paint to prevent flash */
function ThemeInit() {
  const script = `
    (function() {
      var THEME_ACCENT = {
        "light-warm": "#8a5a14",
        "dark-warm": "#d7a44c",
        "white-green": "#2d6a4f",
        "classic-dark": "#6aad84",
        "blue-slate-dark": "#5cb8b0",
        "blue-slate-light": "#1f6e6b"
      };

      function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

      function computeDeviceScale() {
        var width = window.innerWidth || 375;
        var height = window.innerHeight || 667;
        var dpr = clamp(window.devicePixelRatio || 1, 1, 3);
        var minDimension = Math.min(width, height);
        var factor = 1 + (minDimension - 375) / 2000 + (dpr - 2) * 0.015;
        return clamp(factor, 0.875, 1.125);
      }

      function computeUserUiScale(fontScale) {
        var clamped = clamp(fontScale, 1, 10);
        return clamp(1 + (clamped - 1) * 0.025, 1, 1.25);
      }

      function applyResponsiveScales(fontScale) {
        var clamped = clamp(fontScale || 1, 1, 10);
        var root = document.documentElement;
        root.style.setProperty('--mushaf-font-scale', String(clamped));
        root.style.setProperty('--user-ui-font-scale', String(computeUserUiScale(clamped)));
        root.style.setProperty('--device-ui-font-scale', String(computeDeviceScale()));
      }

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

      var pendingScaleRaf = null;
      function queueApplyResponsiveScales(fontScale) {
        if (pendingScaleRaf) return;
        pendingScaleRaf = requestAnimationFrame(function() {
          pendingScaleRaf = null;
          applyResponsiveScales(fontScale);
        });
      }

      try {
        var p = JSON.parse(localStorage.getItem('quran-preferences') || '{}');
        var theme = p.theme || "light-warm";
        document.documentElement.setAttribute('data-theme', theme);
        applyThemeColor(theme);
        applyResponsiveScales(p.fontScale);
      } catch(e) {}

      window.addEventListener("preferences-changed", function(e) {
        try {
          var next = e && e.detail ? e.detail : null;
          if (!next) return;
          if (next.theme) {
            document.documentElement.setAttribute("data-theme", next.theme);
            applyThemeColor(next.theme);
          }
          if (typeof next.fontScale === "number") {
            applyResponsiveScales(next.fontScale);
          }
        } catch(_) {}
      });

      window.addEventListener("resize", function() {
        try {
          var p2 = JSON.parse(localStorage.getItem('quran-preferences') || '{}');
          queueApplyResponsiveScales(p2.fontScale);
        } catch(_) {}
      }, { passive: true });

      window.addEventListener("orientationchange", function() {
        try {
          var p2 = JSON.parse(localStorage.getItem('quran-preferences') || '{}');
          queueApplyResponsiveScales(p2.fontScale);
        } catch(_) {}
      }, { passive: true });

      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", function() {
          try {
            var p2 = JSON.parse(localStorage.getItem('quran-preferences') || '{}');
            queueApplyResponsiveScales(p2.fontScale);
          } catch(_) {}
        }, { passive: true });
      }
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
