import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SETTINGS_COOKIE_KEY = "quran-settings-v2";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pattern for surah pages: /<number> or /<number>/<number>
  // We only redirect "bare" routes (not starting with /r/)
  const surahMatch = pathname.match(/^\/(\d+)(?:\/(\d+))?$/);

  if (surahMatch) {
    const surah = surahMatch[1];
    const ayah = surahMatch[2];
    
    const cookie = request.cookies.get(SETTINGS_COOKIE_KEY);
    if (cookie?.value) {
      try {
        const settings = JSON.parse(decodeURIComponent(cookie.value));
        const { mushafCode, translationCode } = settings;

        if (mushafCode && translationCode) {
          // Construct canonical path
          const base = ayah ? `/${surah}/${ayah}` : `/${surah}`;
          const target = `${base}/r/m:${mushafCode}/t:${translationCode}`;
          
          // Only redirect if we're not already heading there (though match ensures we are on bare)
          return NextResponse.redirect(new URL(target, request.url));
        }
      } catch {
        // Ignore parsing errors, let the page handle it
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - mushaf-data, mushaf-fonts (assets)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|mushaf-data|mushaf-fonts|.*\.svg).*)",
  ],
};
