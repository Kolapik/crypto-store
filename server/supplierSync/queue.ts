import { Queue, Worker, type JobsOptions } from "bullmq";
import { ENV } from "../_core/env";
import {
  listSuppliers,
  retrySupplierProduct,
  runDiscoveryInline,
  runProductSyncInline,
} from "./service";

type SupplierSyncJob =
  | { type: "discovery"; supplierId: number }
  | { type: "product_sync"; supplierId: number }
  | { type: "retry_product"; productId: number };

const QUEUE_NAME = "supplier-sync";
type SupplierQueue = Queue<SupplierSyncJob, unknown, string>;
type RedisConnectionOptions = NonNullable<ConstructorParameters<typeof Queue>[1]>["connection"];
let queue: SupplierQueue | null = null;
let connection: RedisConnectionOptions | null = null;

function getConnection() {
  if (!ENV.redisUrl) return null;
  if (!connection) {
    const url = new URL(ENV.redisUrl);
    connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      db: url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) : undefined,
      tls: url.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
  return connection;
}

export function supplierSyncQueueEnabled() {
  return Boolean(ENV.redisUrl && ENV.catalogSyncEnabled);
}

export function getSupplierSyncQueue() {
  const redis = getConnection();
  if (!redis) return null;
  if (!queue) {
    queue = new Queue<SupplierSyncJob, unknown, string>(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });
  }
  return queue;
}

async function enqueueOrRun(
  data: SupplierSyncJob,
  inline: () => Promise<unknown>,
  options: JobsOptions = {},
) {
  const q = supplierSyncQueueEnabled() ? getSupplierSyncQueue() : null;
  if (!q) {
    const run = await inline();
    return { queued: false, run };
  }
  const job = await q.add(data.type, data, options);
  return { queued: true, jobId: String(job.id) };
}

export function enqueueDiscoveryOrRun(supplierId: number) {
  return enqueueOrRun(
    { type: "discovery", supplierId },
    () => runDiscoveryInline(supplierId),
    { jobId: `discovery:${supplierId}:${Date.now()}` },
  );
}

export function enqueueProductSyncOrRun(supplierId: number) {
  return enqueueOrRun(
    { type: "product_sync", supplierId },
    () => runProductSyncInline(supplierId),
    { jobId: `product-sync:${supplierId}:${Date.now()}` },
  );
}

export function enqueueRetryProductOrRun(productId: number) {
  return enqueueOrRun(
    { type: "retry_product", productId },
    () => retrySupplierProduct(productId),
    { jobId: `retry-product:${productId}:${Date.now()}` },
  );
}

export async function scheduleSupplierSyncJobs() {
  if (!supplierSyncQueueEnabled()) return { scheduled: 0, reason: "queue-disabled" };
  const q = getSupplierSyncQueue();
  if (!q) return { scheduled: 0, reason: "redis-unavailable" };
  const suppliers = (await listSuppliers()).filter((supplier) => supplier.active);
  let scheduled = 0;

  for (const supplier of suppliers) {
    const syncEvery = Math.max(5, supplier.syncIntervalMinutes) * 60_000;
    const discoveryEvery = Math.max(30, supplier.discoveryIntervalMinutes) * 60_000;
    const spread = (supplier.id * 31_000) % syncEvery;
    await q.add(
      "product_sync",
      { type: "product_sync", supplierId: supplier.id },
      {
        jobId: `scheduled-product-sync:${supplier.id}`,
        delay: spread,
        repeat: { every: syncEvery },
      },
    );
    await q.add(
      "discovery",
      { type: "discovery", supplierId: supplier.id },
      {
        jobId: `scheduled-discovery:${supplier.id}`,
        delay: (supplier.id * 47_000) % discoveryEvery,
        repeat: { every: discoveryEvery },
      },
    );
    scheduled += 2;
  }

  return { scheduled };
}

export function createSupplierSyncWorker() {
  const redis = getConnection();
  if (!redis) throw new Error("REDIS_URL is required for the supplier sync worker.");
  return new Worker<SupplierSyncJob, unknown, string>(
    QUEUE_NAME,
    async (job) => {
      if (job.data.type === "discovery") return runDiscoveryInline(job.data.supplierId);
      if (job.data.type === "product_sync") return runProductSyncInline(job.data.supplierId);
      return retrySupplierProduct(job.data.productId);
    },
    {
      connection: redis,
      concurrency: 2,
      limiter: { max: 20, duration: 60_000 },
    },
  );
}
