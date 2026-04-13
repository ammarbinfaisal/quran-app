export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastEventDetail {
  message: string;
  variant: ToastVariant;
}

export const TOAST_EVENT = "app-toast";

export function showToast(message: string, variant: ToastVariant = "info"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(TOAST_EVENT, {
      detail: { message, variant },
    }),
  );
}
