import { cookies } from "next/headers";
import {
  parseSettingsCookie,
  SETTINGS_COOKIE_KEY,
  type Settings,
  DEFAULT_SETTINGS,
} from "@/lib/preferences";

export async function getServerSettings(): Promise<Settings> {
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(SETTINGS_COOKIE_KEY)?.value;
    return parseSettingsCookie(cookieValue);
  } catch {
    // Fallback for static generation where cookies() is not available or would trigger a bail-out
    return DEFAULT_SETTINGS;
  }
}
