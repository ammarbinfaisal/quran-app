import { QuranClient, Language } from "@quranjs/api";

// Singleton for build-time and server-side use only
let _client: QuranClient | null = null;

export function getQuranClient(): QuranClient {
  if (!_client) {
    _client = new QuranClient({
      clientId: process.env.QURAN_CLIENT_ID!,
      clientSecret: process.env.QURAN_CLIENT_SECRET!,
      authBaseUrl: "https://prelive-oauth2.quran.foundation",
      contentBaseUrl: "https://apis-prelive.quran.foundation",
      defaults: { language: Language.ENGLISH },
    });
  }
  return _client;
}
