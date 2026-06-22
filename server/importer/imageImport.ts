import path from "node:path";
import { storagePut } from "../storage";
import type { ImportedImageInput } from "./types";
import { resolveSupplierAssetUrl, validateSupplierUrl } from "./urlSecurity";

const MAX_IMAGE_BYTES = 8_000_000;
const MAX_MANUAL_IMAGE_BYTES = 5_000_000;
const IMAGE_TIMEOUT_MS = 10_000;
const MAX_IMAGES_PER_IMPORT = 6;

function imageExtension(contentType: string, fallbackPath: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  const ext = path.extname(new URL(fallbackPath, "https://example.com").pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
}

function safeFilename(value: string, fallback: string) {
  return (
    path
      .basename(value)
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || fallback
  );
}

async function readLimited(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Image is larger than the importer limit.");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) throw new Error("Image is larger than the importer limit.");
  return buffer;
}

async function fetchImage(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        "user-agent": "HelveticReserveImporter/1.0 (+https://helvetic-reserve.com)",
      },
    });
    if (!response.ok) throw new Error(`Image returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error("URL did not return an image.");
    }
    return {
      data: await readLimited(response, MAX_IMAGE_BYTES),
      contentType,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function copySupplierImages(input: {
  imageUrls: string[];
  pageUrl: URL;
  supplierDomain: string;
}) {
  const urls: string[] = [];
  const warnings: string[] = [];
  const candidates = Array.from(new Set(input.imageUrls.filter(Boolean))).slice(0, MAX_IMAGES_PER_IMPORT);

  for (const candidate of candidates) {
    try {
      const imageUrl = resolveSupplierAssetUrl(candidate, input.pageUrl);
      if (!imageUrl) {
        warnings.push("Skipped an image because it was outside the supplier allowlist.");
        continue;
      }
      await validateSupplierUrl(imageUrl.toString());
      const fetched = await fetchImage(imageUrl);
      const ext = imageExtension(fetched.contentType, imageUrl.pathname);
      const filename = safeFilename(imageUrl.pathname, `product${ext}`);
      const stored = await storagePut(
        `imports/${input.supplierDomain}/${Date.now()}-${filename.replace(/\.[^.]+$/, "")}${ext}`,
        fetched.data,
        fetched.contentType,
      );
      urls.push(stored.url);
      if (stored.url.includes("X-Amz-Signature")) {
        warnings.push("Image was copied to private R2, but no R2_PUBLIC_BASE_URL is configured for permanent public image URLs.");
      }
    } catch (error) {
      warnings.push(error instanceof Error ? `Image import skipped: ${error.message}` : "Image import skipped.");
    }
  }

  return { urls, warnings };
}

export async function copyManualImages(images: ImportedImageInput[] | undefined, supplierDomain: string) {
  const urls: string[] = [];
  const warnings: string[] = [];
  const candidates = (images ?? []).slice(0, MAX_IMAGES_PER_IMPORT);

  for (const image of candidates) {
    try {
      if (!image.contentType.toLowerCase().startsWith("image/")) {
        warnings.push(`Skipped ${image.filename || "manual image"} because it is not an image.`);
        continue;
      }
      const base64 = image.dataBase64.includes(",") ? image.dataBase64.split(",").pop() : image.dataBase64;
      const data = Buffer.from(base64 ?? "", "base64");
      if (data.byteLength === 0) {
        warnings.push(`Skipped ${image.filename || "manual image"} because it was empty.`);
        continue;
      }
      if (data.byteLength > MAX_MANUAL_IMAGE_BYTES) {
        warnings.push(`Skipped ${image.filename || "manual image"} because it is larger than 5 MB.`);
        continue;
      }
      const ext = imageExtension(image.contentType, image.filename);
      const filename = safeFilename(image.filename, `manual${ext}`);
      const stored = await storagePut(
        `imports/${supplierDomain}/manual-${Date.now()}-${filename.replace(/\.[^.]+$/, "")}${ext}`,
        data,
        image.contentType,
      );
      urls.push(stored.url);
      if (stored.url.includes("X-Amz-Signature")) {
        warnings.push("Manual image was copied to private R2, but no R2_PUBLIC_BASE_URL is configured for permanent public image URLs.");
      }
    } catch (error) {
      warnings.push(error instanceof Error ? `Manual image skipped: ${error.message}` : "Manual image skipped.");
    }
  }

  return { urls, warnings };
}
