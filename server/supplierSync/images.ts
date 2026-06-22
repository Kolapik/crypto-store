import { createHash } from "node:crypto";
import path from "node:path";
import { storagePut } from "../storage";
import type { RawSupplierImage, SupplierConfig } from "./types";
import { assertSupplierScopedUrl, resolveSupplierAssetUrl } from "./url";

export const MAX_SUPPLIER_IMAGE_BYTES = 12_000_000;

export function imageContentAllowed(contentType: string) {
  const normalized = contentType.toLowerCase().split(";")[0].trim();
  return ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(normalized);
}

function imageExtension(contentType: string, fallbackPath: string) {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("avif")) return ".avif";
  if (normalized.includes("gif")) return ".gif";
  const ext = path.extname(new URL(fallbackPath, "https://example.com").pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"].includes(ext) ? ext : ".jpg";
}

async function readLimitedImage(response: Response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SUPPLIER_IMAGE_BYTES) {
    throw new Error("Supplier image exceeds the configured max size.");
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength > MAX_SUPPLIER_IMAGE_BYTES) {
    throw new Error("Supplier image exceeds the configured max size.");
  }
  return data;
}

export function hashImage(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

export function dedupeImageCandidates(images: RawSupplierImage[]) {
  const seen = new Set<string>();
  return images
    .filter((image) => {
      if (!image.url || seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export async function copySupplierImage(input: {
  image: RawSupplierImage;
  pageUrl: URL;
  supplier: SupplierConfig;
  supplierProductId: number;
  position: number;
}) {
  const resolved = resolveSupplierAssetUrl(input.image.url, input.pageUrl, input.supplier);
  if (!resolved) throw new Error("Image URL is outside supplier scope.");
  await assertSupplierScopedUrl(resolved.toString(), input.supplier);

  const response = await fetch(resolved, {
    headers: {
      accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
      "user-agent": "HelveticReserveSupplierSync/1.0 (+https://helvetic-reserve.com)",
    },
  });

  if (!response.ok) throw new Error(`Image returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (!imageContentAllowed(contentType)) {
    throw new Error("Image content type is not allowed.");
  }

  const data = await readLimitedImage(response);
  const hash = hashImage(data);
  const ext = imageExtension(contentType, resolved.pathname);
  const stored = await storagePut(
    `supplier-products/${input.supplier.id}/${input.supplierProductId}/${hash}${ext}`,
    data,
    contentType,
  );

  return {
    sourceUrl: resolved.toString(),
    storedUrl: stored.url,
    storageKey: stored.key,
    imageHash: hash,
    position: input.position,
    width: input.image.width,
    height: input.image.height,
  };
}
