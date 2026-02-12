import { cookies } from "next/headers";
import { parseSettingsCookie, SETTINGS_COOKIE_KEY, type Settings } from "@/lib/preferences";

export async function getServerSettings(): Promise<Settings> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SETTINGS_COOKIE_KEY)?.value;
  return parseSettingsCookie(cookieValue);
}
