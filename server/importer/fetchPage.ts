const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 10_000;

export class ImportFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFetchError";
  }
}

async function readLimited(response: Response, maxBytes: number) {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new ImportFetchError("Supplier page is larger than the importer limit.");
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ImportFetchError("Supplier page is larger than the importer limit.");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

export async function fetchSupplierPage(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.2",
        "user-agent": "HelveticReserveImporter/1.0 (+https://helvetic-reserve.com)",
      },
    });

    if (!response.ok) {
      throw new ImportFetchError(`Supplier page returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new ImportFetchError("Supplier page did not return HTML.");
    }

    const buffer = await readLimited(response, MAX_HTML_BYTES);
    return {
      html: buffer.toString("utf8"),
      finalUrl: response.url ? new URL(response.url) : url,
    };
  } catch (error) {
    if (error instanceof ImportFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ImportFetchError("Supplier page fetch timed out.");
    }
    throw new ImportFetchError("Supplier page could not be fetched.");
  } finally {
    clearTimeout(timeout);
  }
}
