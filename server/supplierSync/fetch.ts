import { createHash } from "node:crypto";
import type { FetchResult, SupplierConfig } from "./types";
import { assertSupplierScopedUrl } from "./url";

const MAX_HTML_BYTES = 8_000_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

function hashContent(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function retryAfterMs(response: Response) {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

async function readLimitedText(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Supplier page exceeds the configured max size.");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new Error("Supplier page exceeds the configured max size.");
  }
  return buffer.toString("utf8");
}

export async function fetchSupplierPage(input: {
  url: string | URL;
  supplier: SupplierConfig;
  timeoutMs?: number;
  maxBytes?: number;
  redirectCount?: number;
}): Promise<FetchResult> {
  const checkedUrl = await assertSupplierScopedUrl(String(input.url), input.supplier);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(checkedUrl, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.5",
        "user-agent": "HelveticReserveSupplierSync/1.0 (+https://helvetic-reserve.com)",
      },
    });

    const location = response.headers.get("location");
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      const redirectCount = input.redirectCount ?? 0;
      if (redirectCount >= MAX_REDIRECTS) throw new Error("Supplier page redirected too many times.");
      const nextUrl = await assertSupplierScopedUrl(location, input.supplier, checkedUrl);
      return fetchSupplierPage({
        ...input,
        url: nextUrl,
        redirectCount: redirectCount + 1,
      });
    }

    if (!response.ok) {
      const error = new Error(`Supplier page returned HTTP ${response.status}.`);
      (error as Error & { statusCode?: number; retryAfterMs?: number }).statusCode = response.status;
      (error as Error & { statusCode?: number; retryAfterMs?: number }).retryAfterMs = retryAfterMs(response);
      throw error;
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const body = await readLimitedText(response, input.maxBytes ?? MAX_HTML_BYTES);

    return {
      finalUrl: checkedUrl,
      statusCode: response.status,
      contentType,
      body,
      contentHash: hashContent(body),
      retryAfterMs: retryAfterMs(response),
    };
  } finally {
    clearTimeout(timeout);
  }
}
