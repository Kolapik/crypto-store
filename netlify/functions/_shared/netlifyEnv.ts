const NETLIFY_ENV_KEYS = [
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD_HASH",
  "AI_NORMALIZATION_ENABLED",
  "AI_NORMALIZATION_MODEL",
  "BTCPAY_API_KEY",
  "BTCPAY_DEFAULT_CURRENCY",
  "BTCPAY_ENABLED",
  "BTCPAY_SERVER_URL",
  "BTCPAY_STORE_ID",
  "BTCPAY_WEBHOOK_SECRET",
  "BUILT_IN_FORGE_API_KEY",
  "BUILT_IN_FORGE_API_URL",
  "CATALOG_SYNC_ENABLED",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_EMAIL_API_TOKEN",
  "CLOUDFLARE_EMAIL_FROM",
  "CLOUDFLARE_EMAIL_SEND_CUSTOMER_CONFIRMATION",
  "CLOUDFLARE_EMAIL_TO",
  "DATABASE_URL",
  "DEV_DATABASE_URL",
  "JWT_SECRET",
  "MISSING_PRODUCT_DISABLE_THRESHOLD",
  "NODE_ENV",
  "OAUTH_SERVER_URL",
  "OPENAI_API_KEY",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_MODEL",
  "OWNER_OPEN_ID",
  "PRICE_CHANGE_REVIEW_THRESHOLD_PERCENT",
  "PUBLIC_CONTACT_EMAIL",
  "PUBLIC_SITE_URL",
  "R2_ACCESS_KEY_ID",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "R2_PUBLIC_BASE_URL",
  "R2_SECRET_ACCESS_KEY",
  "RAW_SNAPSHOT_RETENTION_DAYS",
  "REDIS_URL",
  "SYNC_CRON_SECRET",
  "SYNC_WORKER_ENABLED",
  "VITE_APP_ID",
] as const;

type NetlifyGlobal = typeof globalThis & {
  Netlify?: {
    env?: {
      get?: (name: string) => string | undefined | null;
    };
  };
};

export function hydrateNetlifyEnv() {
  const getter = (globalThis as NetlifyGlobal).Netlify?.env?.get;
  if (!getter) return;

  for (const key of NETLIFY_ENV_KEYS) {
    if (process.env[key]) continue;

    const value = getter(key);
    if (typeof value === "string" && value.length > 0) {
      process.env[key] = value;
    }
  }
}
