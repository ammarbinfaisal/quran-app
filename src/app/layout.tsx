import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  ),
  title: "quran",
  description: "quran app",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "quran",
  },
  openGraph: {
    title: "quran",
    description: "quran app",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "quran",
    description: "quran app",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#8b6914",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === "production";

  return (
    <html lang="ar" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://api.quran.com" />
        <link rel="preconnect" href="https://api.quran.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ThemeInit />
        {children}
        {isProd ? <ServiceWorkerRegistration /> : <ServiceWorkerDevCleanup />}
      </body>
    </html>
  );
}

/** Inline script to set theme before paint to prevent flash */
function ThemeInit() {
  const script = `
    (function() {
      try {
        var p = JSON.parse(localStorage.getItem('quran-preferences') || '{}');
        if (p.theme) document.documentElement.setAttribute('data-theme', p.theme);
        if (p.fontScale) document.documentElement.style.setProperty('--mushaf-font-scale', p.fontScale);
      } catch(e) {}
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
