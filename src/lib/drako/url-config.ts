// src/lib/drako/url-config.ts

export function getDrakoBaseUrl(): string {
  const url =
    (process.env.APP_PUBLIC_BASE_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_UI_ORIGIN || "").trim() ||
    (process.env.NEXT_PUBLIC_BASE_URL || "").trim();

  if (!url) {
    throw new Error(
      "DRAKO application base URL is not configured"
    );
  }

  new URL(url);

  return url;
}