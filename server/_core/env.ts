import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

type NetlifyGlobal = typeof globalThis & {
  Netlify?: {
    env?: {
      get?: (name: string) => string | undefined | null;
    };
  };
};

function netlifyEnv(name: string) {
  try {
    const value = (globalThis as NetlifyGlobal).Netlify?.env?.get?.(name);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function env(name: string, fallback = "") {
  return process.env[name] ?? netlifyEnv(name) ?? fallback;
}

function numberEnv(name: string, fallback: number) {
  const value = Number(env(name));
  return Number.isFinite(value) ? value : fallback;
}

export const ENV = {
  appId: env("VITE_APP_ID"),
  cookieSecret: env("JWT_SECRET"),
  adminEmail: env("ADMIN_EMAIL"),
  adminPasswordHash: env("ADMIN_PASSWORD_HASH"),
  databaseUrl: env("DATABASE_URL"),
  devDatabaseUrl: env("DEV_DATABASE_URL"),
  oAuthServerUrl: env("OAUTH_SERVER_URL"),
  ownerOpenId: env("OWNER_OPEN_ID"),
  isProduction: env("NODE_ENV") === "production",
  forgeApiUrl: env("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: env("BUILT_IN_FORGE_API_KEY"),
  r2Endpoint: env("R2_ENDPOINT"),
  r2Bucket: env("R2_BUCKET"),
  r2AccessKeyId: env("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: env("R2_SECRET_ACCESS_KEY"),
  r2PublicBaseUrl: env("R2_PUBLIC_BASE_URL"),
  openaiApiKey: env("OPENAI_API_KEY"),
  openaiModel: env("OPENAI_MODEL", "gpt-5.5"),
  openaiImageModel: env("OPENAI_IMAGE_MODEL", "gpt-image-2"),
  redisUrl: env("REDIS_URL"),
  syncWorkerEnabled: env("SYNC_WORKER_ENABLED") === "1",
  syncCronSecret: env("SYNC_CRON_SECRET"),
  catalogSyncEnabled: env("CATALOG_SYNC_ENABLED") === "1",
  rawSnapshotRetentionDays: numberEnv("RAW_SNAPSHOT_RETENTION_DAYS", 30),
  aiNormalizationEnabled: env("AI_NORMALIZATION_ENABLED") === "1",
  aiNormalizationModel: env("AI_NORMALIZATION_MODEL", env("OPENAI_MODEL", "gpt-5.5")),
  priceChangeReviewThresholdPercent: numberEnv("PRICE_CHANGE_REVIEW_THRESHOLD_PERCENT", 25),
  missingProductDisableThreshold: numberEnv("MISSING_PRODUCT_DISABLE_THRESHOLD", 3),
  contactEmail: env("PUBLIC_CONTACT_EMAIL", "contact@helvetic-reserve.com"),
  cloudflareAccountId: env("CLOUDFLARE_ACCOUNT_ID"),
  cloudflareEmailApiToken: env("CLOUDFLARE_EMAIL_API_TOKEN"),
  cloudflareEmailFrom: env("CLOUDFLARE_EMAIL_FROM", "contact@helvetic-reserve.com"),
  cloudflareEmailTo: env("CLOUDFLARE_EMAIL_TO", "contact@helvetic-reserve.com"),
  cloudflareEmailSendCustomerConfirmation:
    env("CLOUDFLARE_EMAIL_SEND_CUSTOMER_CONFIRMATION") === "1",
  publicSiteUrl: env("PUBLIC_SITE_URL", "http://127.0.0.1:3000"),
  btcpayEnabled: env("BTCPAY_ENABLED") === "1",
  btcpayServerUrl: env("BTCPAY_SERVER_URL"),
  btcpayStoreId: env("BTCPAY_STORE_ID"),
  btcpayApiKey: env("BTCPAY_API_KEY"),
  btcpayWebhookSecret: env("BTCPAY_WEBHOOK_SECRET"),
  btcpayDefaultCurrency: env("BTCPAY_DEFAULT_CURRENCY", "CHF"),
};
