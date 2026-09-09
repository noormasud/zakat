/**
 * A short, human-readable label for the device an entry was made from —
 * "iPhone · Safari", "Windows · Chrome". Stored for the audit trail in the
 * export; never shown in the app.
 */
export function describeDevice(): string {
  if (typeof navigator === "undefined") return "Unknown";

  const ua = navigator.userAgent;

  const platform =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Macintosh/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown device";

  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Unknown browser";

  return `${platform} · ${browser}`;
}
