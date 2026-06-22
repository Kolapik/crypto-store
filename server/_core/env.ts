import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  devDatabaseUrl: process.env.DEV_DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  r2Endpoint: process.env.R2_ENDPOINT ?? "",
  r2Bucket: process.env.R2_BUCKET ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-5.5",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
  redisUrl: process.env.REDIS_URL ?? "",
  syncWorkerEnabled: process.env.SYNC_WORKER_ENABLED === "1",
  syncCronSecret: process.env.SYNC_CRON_SECRET ?? "",
  catalogSyncEnabled: process.env.CATALOG_SYNC_ENABLED === "1",
  rawSnapshotRetentionDays: numberEnv("RAW_SNAPSHOT_RETENTION_DAYS", 30),
  aiNormalizationEnabled: process.env.AI_NORMALIZATION_ENABLED === "1",
  aiNormalizationModel: process.env.AI_NORMALIZATION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5",
  priceChangeReviewThresholdPercent: numberEnv("PRICE_CHANGE_REVIEW_THRESHOLD_PERCENT", 25),
  missingProductDisableThreshold: numberEnv("MISSING_PRODUCT_DISABLE_THRESHOLD", 3),
  contactEmail: process.env.PUBLIC_CONTACT_EMAIL ?? "contact@helvetic-reserve.com",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  cloudflareEmailApiToken: process.env.CLOUDFLARE_EMAIL_API_TOKEN ?? "",
  cloudflareEmailFrom: process.env.CLOUDFLARE_EMAIL_FROM ?? "contact@helvetic-reserve.com",
  cloudflareEmailTo: process.env.CLOUDFLARE_EMAIL_TO ?? "contact@helvetic-reserve.com",
  cloudflareEmailSendCustomerConfirmation:
    process.env.CLOUDFLARE_EMAIL_SEND_CUSTOMER_CONFIRMATION === "1",
  publicSiteUrl: process.env.PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
  btcpayEnabled: process.env.BTCPAY_ENABLED === "1",
  btcpayServerUrl: process.env.BTCPAY_SERVER_URL ?? "",
  btcpayStoreId: process.env.BTCPAY_STORE_ID ?? "",
  btcpayApiKey: process.env.BTCPAY_API_KEY ?? "",
  btcpayWebhookSecret: process.env.BTCPAY_WEBHOOK_SECRET ?? "",
  btcpayDefaultCurrency: process.env.BTCPAY_DEFAULT_CURRENCY ?? "CHF",
};
