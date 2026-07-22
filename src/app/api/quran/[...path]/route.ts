import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_AUTH_BASE_URL = "https://oauth2.quran.foundation";
const DEFAULT_CONTENT_BASE_URL = "https://apis.quran.foundation";
const TOKEN_REFRESH_SKEW_MS = 30_000;

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

function getClientConfig() {
  const clientId = process.env.QURANAPI_CLIENT_ID?.trim();
  const clientSecret = process.env.QURANAPI_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    authBaseUrl:
      process.env.QURANAPI_AUTH_BASE_URL?.trim() || DEFAULT_AUTH_BASE_URL,
    contentBaseUrl:
      process.env.QURANAPI_CONTENT_BASE_URL?.trim() || DEFAULT_CONTENT_BASE_URL,
  };
}

function isAllowedPath(parts: string[]) {
  if (parts.length === 1 && parts[0] === "chapters") return true;
  if (parts.length === 3 && parts[0] === "verses" && parts[1] === "by_key") return true;
  if (parts.length === 3 && parts[0] === "verses" && parts[1] === "by_page") return true;
  if (parts.length === 2 && parts[0] === "foot_notes") return true;
  if (parts.length === 3 && parts[0] === "chapter_recitations") return true;
  return false;
}

async function requestAccessToken(
  config: NonNullable<ReturnType<typeof getClientConfig>>,
): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) {
    return tokenCache.accessToken;
  }

  const tokenUrl = new URL("/oauth2/token", config.authBaseUrl);
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  const response = await fetch(tokenUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "content",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Quran token request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("Quran token response did not include access_token");
  }

  const expiresInSeconds =
    typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
      ? payload.expires_in
      : 3600;

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };

  return tokenCache.accessToken;
}

async function proxyContentRequest(
  request: NextRequest,
  parts: string[],
  forceRefreshToken = false,
) {
  const config = getClientConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Quran API credentials are not configured." },
      { status: 503 },
    );
  }

  if (forceRefreshToken) tokenCache = null;
  const accessToken = await requestAccessToken(config);
  const upstreamUrl = new URL(
    `/content/api/v4/${parts.map(encodeURIComponent).join("/")}`,
    config.contentBaseUrl,
  );
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      "x-auth-token": accessToken,
      "x-client-id": config.clientId,
    },
    cache: "no-store",
  });

  return upstream;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!isAllowedPath(path)) {
    return NextResponse.json({ error: "Quran API path is not allowed." }, { status: 404 });
  }

  try {
    let upstream = await proxyContentRequest(request, path);
    if (upstream instanceof NextResponse) return upstream;

    if (upstream.status === 401) {
      upstream = await proxyContentRequest(request, path, true);
      if (upstream instanceof NextResponse) return upstream;
    }

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Quran API service unavailable." },
      { status: 503 },
    );
  }
}
