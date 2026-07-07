import { showToast } from "@/lib/toast";

export interface ShareOptions {
  url?: string;
  title?: string;
  text?: string;
}

function resolveShareUrl(url: string): string {
  if (typeof window === "undefined") return url;
  if (/^[a-z][a-z\d+\-.]*:/i.test(url)) return url;
  const origin = window.location.origin;
  return url.startsWith("/") ? `${origin}${url}` : `${origin}/${url}`;
}

export async function shareUrl(url: string, options?: Omit<ShareOptions, "url">): Promise<void> {
  if (typeof window === "undefined") return;

  const shareUrl = resolveShareUrl(url);
  const shareData: ShareData = {
    url: shareUrl,
    title: options?.title,
    text: options?.text,
  };

  if (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    (typeof navigator.canShare === "undefined" || navigator.canShare(shareData))
  ) {
    try {
      await navigator.share(shareData);
      showToast("Shared", "success");
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // User cancelled the native share sheet — not a failure.
        return;
      }
      // Fall through to clipboard fallback on share error.
    }
  }

  if (typeof navigator !== "undefined" && "clipboard" in navigator && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link copied to clipboard", "success");
      return;
    } catch {
      showToast("Could not copy link", "error");
      return;
    }
  }

  showToast("Sharing is not available on this device", "error");
}
