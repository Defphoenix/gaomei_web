/** Append JWT for browser navigations that cannot send Authorization headers. */
export function withAccessToken(url: string): string {
  if (!url) return url;
  const token = localStorage.getItem("access_token") || "";
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}access_token=${encodeURIComponent(token)}`;
}

/** Open an authenticated asset download (streams; safe for BAM). */
export function downloadAuthenticatedAsset(url: string): void {
  const href = withAccessToken(url);
  if (!href) {
    window.alert("下载链接为空");
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}
