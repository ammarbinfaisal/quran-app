export function removeQueryParamFromCurrentUrl(param: string) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has(param)) return;

  url.searchParams.delete(param);

  const search = url.searchParams.toString();
  const next = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

