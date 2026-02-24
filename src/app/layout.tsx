import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quran",
  description: "Read the Quran",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Quran",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2d6a4f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === "production";

  return (
    <html lang="ar" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
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
