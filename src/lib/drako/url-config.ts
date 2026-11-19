// src/lib/drako/url-config.ts

export function getDrakoBaseUrl(): string {
  // READ THE CONFIGURED APPLICATION BASE URL
  const url =
    (process.env.APP_PUBLIC_BASE_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_UI_ORIGIN || "").trim() ||
    (process.env.NEXT_PUBLIC_BASE_URL || "").trim();

    // ENSURE A BASE URL IS CONFIGURED
    if (!url) {
      throw new Error(
        "DRAKO application base URL is not configured"
      );
    }

    // PARSE AND VALIDATE THE CONFIGURED URL
    const parsedUrl = new URL(url);

    // ALLOW ONLY HTTP AND HTTPS URLS
    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      throw new Error(
        "DRAKO application base URL must use HTTP or HTTPS"
      );
    }

    // RETURN A NORMALIZED APPLICATION ORIGIN
    return parsedUrl.origin;
}