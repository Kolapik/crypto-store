import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

function hasR2Config() {
  return Boolean(
    ENV.r2Endpoint &&
      ENV.r2Bucket &&
      ENV.r2AccessKeyId &&
      ENV.r2SecretAccessKey,
  );
}

function getR2Client() {
  if (!hasR2Config()) return null;

  return new S3Client({
    region: "auto",
    endpoint: ENV.r2Endpoint,
    credentials: {
      accessKeyId: ENV.r2AccessKeyId,
      secretAccessKey: ENV.r2SecretAccessKey,
    },
  });
}

function normalizeKey(relKey: string): string {
  return relKey
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

function appendHashSuffix(relKey: string): string {
  const safeKey = normalizeKey(relKey);
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = safeKey.lastIndexOf(".");
  if (lastDot === -1) return `${safeKey}_${hash}`;
  return `${safeKey.slice(0, lastDot)}_${hash}${safeKey.slice(lastDot)}`;
}

function publicR2Url(key: string) {
  if (!ENV.r2PublicBaseUrl) return null;
  return `${ENV.r2PublicBaseUrl.replace(/\/+$/, "")}/${key}`;
}

function localPublicUrl(key: string) {
  return `/uploads/${key}`;
}

async function localPut(
  key: string,
  data: Buffer | Uint8Array | string,
): Promise<{ key: string; url: string }> {
  const uploadRoot = path.resolve(process.cwd(), "client", "public", "uploads");
  const targetPath = path.resolve(uploadRoot, key);

  if (!targetPath.startsWith(uploadRoot)) {
    throw new Error("Invalid upload path");
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, data);
  return { key, url: localPublicUrl(key) };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(relKey);
  const client = getR2Client();

  if (!client) {
    return localPut(key, data);
  }

  await client.send(
    new PutObjectCommand({
      Bucket: ENV.r2Bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );

  return { key, url: publicR2Url(key) ?? (await storageGetSignedUrl(key)) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  if (!hasR2Config()) return { key, url: localPublicUrl(key) };
  return { key, url: publicR2Url(key) ?? (await storageGetSignedUrl(key)) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const client = getR2Client();

  if (!client) return localPublicUrl(key);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: ENV.r2Bucket,
      Key: key,
    }),
    { expiresIn: 60 * 10 },
  );
}
