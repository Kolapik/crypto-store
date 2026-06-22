import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import {
  imageEnhancements,
  watches,
  type ImageEnhancement,
  type Watch,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { storagePut } from "./storage";

const MAX_INPUT_IMAGE_BYTES = 12_000_000;
const ENHANCEMENT_OUTPUT_FORMAT = "jpeg";
const ENHANCEMENT_OUTPUT_CONTENT_TYPE = "image/jpeg";

type OpenAIImageEditResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: { message?: string };
};

type ImageBytes = {
  data: Buffer;
  contentType: string;
  extension: string;
  sha256: string;
};

function requireDb() {
  return getDb().then((db) => {
    if (!db) throw new Error("PostgreSQL is required for image enhancements.");
    return db;
  });
}

function imageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function buildImageEnhancementPrompt(watch: Pick<Watch, "brand" | "model" | "reference">) {
  return [
    "Enhance this real product photograph for a luxury watch ecommerce catalogue.",
    "Only improve technical image quality: upscale if useful, denoise, sharpen gently, correct exposure, improve white balance, and clean compression artifacts.",
    "Preserve the exact watch, case shape, dial layout, dial text, logo, hands, bezel, bracelet, scratches, patina, serial/reference cues, and condition.",
    "Do not add missing parts, do not remove visible wear, do not invent text, do not change colors, do not change the model, and do not create a marketing render.",
    `Product context: ${watch.brand} ${watch.model}${watch.reference ? ` ${watch.reference}` : ""}.`,
  ].join(" ");
}

export function isEnhanceableImageContentType(contentType: string) {
  const normalized = contentType.toLowerCase().split(";")[0].trim();
  return ["image/jpeg", "image/png", "image/webp"].includes(normalized);
}

function extensionForContentType(contentType: string) {
  const normalized = contentType.toLowerCase().split(";")[0].trim();
  if (normalized === "image/png") return ".png";
  if (normalized === "image/webp") return ".webp";
  return ".jpg";
}

function dataUrlForImage(image: ImageBytes) {
  return `data:${image.contentType};base64,${image.data.toString("base64")}`;
}

function assertImageBelongsToWatch(watch: Watch, imageUrl: string) {
  const images = imageList(watch.publicImages);
  if (!images.includes(imageUrl)) {
    throw new Error("Image is not attached to this watch.");
  }
}

function ipv4ToNumber(ip: string) {
  return ip.split(".").reduce((total, part) => (total << 8) + Number(part), 0) >>> 0;
}

function inIpv4Range(ip: string, cidrBase: string, bits: number) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToNumber(ip) & mask) === (ipv4ToNumber(cidrBase) & mask);
}

function isPrivateIpv4(ip: string) {
  return (
    inIpv4Range(ip, "0.0.0.0", 8) ||
    inIpv4Range(ip, "10.0.0.0", 8) ||
    inIpv4Range(ip, "100.64.0.0", 10) ||
    inIpv4Range(ip, "127.0.0.0", 8) ||
    inIpv4Range(ip, "169.254.0.0", 16) ||
    inIpv4Range(ip, "172.16.0.0", 12) ||
    inIpv4Range(ip, "192.168.0.0", 16) ||
    inIpv4Range(ip, "224.0.0.0", 4)
  );
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function assertPublicAddress(address: string) {
  const family = net.isIP(address);
  if (family === 4 && isPrivateIpv4(address)) throw new Error("Image URL resolved to a private network.");
  if (family === 6 && isPrivateIpv6(address)) throw new Error("Image URL resolved to a private network.");
}

async function assertSafeRemoteImageUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP/HTTPS image URLs are allowed.");
  if (url.username || url.password) throw new Error("Image URLs with credentials are not allowed.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Image URLs with custom ports are not allowed.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const ipFamily = net.isIP(hostname);
  if (ipFamily) {
    assertPublicAddress(hostname);
    throw new Error("Raw IP image URLs are not allowed.");
  }
  const records = await lookup(hostname, { all: true, verbatim: false });
  for (const record of records) assertPublicAddress(record.address);
}

async function readLimitedResponse(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Image is larger than the enhancement limit.");
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength > maxBytes) throw new Error("Image is larger than the enhancement limit.");
  return data;
}

function imageBytes(data: Buffer, contentType: string): ImageBytes {
  if (!isEnhanceableImageContentType(contentType)) {
    throw new Error("Only JPEG, PNG, and WebP images can be enhanced. SVG and other formats are rejected.");
  }
  return {
    data,
    contentType: contentType.toLowerCase().split(";")[0].trim(),
    extension: extensionForContentType(contentType),
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}

async function loadLocalPublicImage(imageUrl: string) {
  const publicRoot = path.resolve(process.cwd(), "client", "public");
  const pathname = new URL(imageUrl, "https://local.invalid").pathname;
  const targetPath = path.resolve(publicRoot, `.${decodeURIComponent(pathname)}`);
  if (!targetPath.startsWith(publicRoot + path.sep)) {
    throw new Error("Invalid local image path.");
  }
  const data = await readFile(targetPath);
  if (data.byteLength > MAX_INPUT_IMAGE_BYTES) throw new Error("Image is larger than the enhancement limit.");
  const ext = path.extname(targetPath).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" :
        ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
          "application/octet-stream";
  return imageBytes(data, contentType);
}

async function fetchRemoteImage(imageUrl: string) {
  const url = new URL(imageUrl);
  await assertSafeRemoteImageUrl(url);
  const response = await fetch(url, {
    headers: {
      accept: "image/jpeg,image/png,image/webp",
      "user-agent": "HelveticReserveImageEnhancer/1.0 (+https://helvetic-reserve.com)",
    },
  });
  if (!response.ok) throw new Error(`Image returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const data = await readLimitedResponse(response, MAX_INPUT_IMAGE_BYTES);
  return imageBytes(data, contentType);
}

async function loadImageForEnhancement(imageUrl: string) {
  if (imageUrl.startsWith("/")) return loadLocalPublicImage(imageUrl);
  return fetchRemoteImage(imageUrl);
}

async function openAIEditImage(input: { image: ImageBytes; prompt: string; model: string }) {
  if (!ENV.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.openaiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      images: [{ image_url: dataUrlForImage(input.image) }],
      prompt: input.prompt,
      n: 1,
      size: "auto",
      quality: "high",
      output_format: ENHANCEMENT_OUTPUT_FORMAT,
      output_compression: 92,
    }),
  });

  const body = (await response.json().catch(() => null)) as OpenAIImageEditResponse | null;
  if (!response.ok || body?.error) {
    throw new Error(body?.error?.message || `OpenAI image edit returned HTTP ${response.status}.`);
  }
  const first = body?.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first?.url) {
    const imageResponse = await fetch(first.url);
    if (!imageResponse.ok) throw new Error("OpenAI image output URL could not be downloaded.");
    return readLimitedResponse(imageResponse, MAX_INPUT_IMAGE_BYTES);
  }
  throw new Error("OpenAI image edit response did not include image data.");
}

export async function listWatchImageEnhancements(watchId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(imageEnhancements)
    .where(eq(imageEnhancements.watchId, watchId))
    .orderBy(desc(imageEnhancements.createdAt));
}

export async function enhanceWatchImage(input: { watchId: number; imageUrl: string }) {
  const db = await requireDb();
  const [watch] = await db.select().from(watches).where(eq(watches.id, input.watchId)).limit(1);
  if (!watch) throw new Error("Watch not found.");
  assertImageBelongsToWatch(watch, input.imageUrl);

  const model = ENV.openaiImageModel || "gpt-image-2";
  const prompt = buildImageEnhancementPrompt(watch);
  const [enhancement] = await db
    .insert(imageEnhancements)
    .values({
      watchId: watch.id,
      originalImageUrl: input.imageUrl,
      model,
      prompt,
      status: "processing",
      reviewStatus: "pending",
    })
    .returning();

  try {
    const source = await loadImageForEnhancement(input.imageUrl);
    const output = await openAIEditImage({ image: source, prompt, model });
    const outputHash = createHash("sha256").update(output).digest("hex");
    const stored = await storagePut(
      `ai-enhancements/watches/${watch.id}/${outputHash}.jpg`,
      output,
      ENHANCEMENT_OUTPUT_CONTENT_TYPE,
    );
    const [completed] = await db
      .update(imageEnhancements)
      .set({
        enhancedImageUrl: stored.url,
        storageKey: stored.key,
        status: "completed",
        metadata: {
          originalSha256: source.sha256,
          outputSha256: outputHash,
          originalContentType: source.contentType,
          originalBytes: source.data.byteLength,
          outputBytes: output.byteLength,
          guardrail: "admin-review-required",
        },
        updatedAt: new Date(),
      })
      .where(eq(imageEnhancements.id, enhancement.id))
      .returning();
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const [failed] = await db
      .update(imageEnhancements)
      .set({
        status: "failed",
        errorMessage: message.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(imageEnhancements.id, enhancement.id))
      .returning();
    return failed;
  }
}

function replaceOrPrependImage(images: string[], original: string, enhanced: string) {
  const next = [...images];
  const index = next.indexOf(original);
  if (index >= 0) next[index] = enhanced;
  else next.unshift(enhanced);
  return Array.from(new Set(next.filter(Boolean)));
}

export async function useEnhancedWatchImage(input: { watchId: number; enhancementId: number }) {
  const db = await requireDb();
  const [watch] = await db.select().from(watches).where(eq(watches.id, input.watchId)).limit(1);
  if (!watch) throw new Error("Watch not found.");
  const [enhancement] = await db
    .select()
    .from(imageEnhancements)
    .where(eq(imageEnhancements.id, input.enhancementId))
    .limit(1);
  if (!enhancement || enhancement.watchId !== watch.id) throw new Error("Image enhancement not found.");
  if (enhancement.status !== "completed" || !enhancement.enhancedImageUrl) {
    throw new Error("Only completed image enhancements can be used.");
  }

  const publicImages = replaceOrPrependImage(
    imageList(watch.publicImages),
    enhancement.originalImageUrl,
    enhancement.enhancedImageUrl,
  );

  const [updatedWatch] = await db
    .update(watches)
    .set({ publicImages, updatedAt: new Date() })
    .where(eq(watches.id, watch.id))
    .returning();
  const [updatedEnhancement] = await db
    .update(imageEnhancements)
    .set({ reviewStatus: "approved", usedAt: new Date(), updatedAt: new Date() })
    .where(eq(imageEnhancements.id, enhancement.id))
    .returning();

  return { watch: updatedWatch, enhancement: updatedEnhancement as ImageEnhancement };
}
