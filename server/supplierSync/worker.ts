import { ENV } from "../_core/env";
import { createSupplierSyncWorker, scheduleSupplierSyncJobs } from "./queue";

if (!ENV.syncWorkerEnabled) {
  console.log("Supplier sync worker is disabled. Set SYNC_WORKER_ENABLED=1 to run it.");
  process.exit(0);
}

if (!ENV.redisUrl) {
  console.error("REDIS_URL is required when SYNC_WORKER_ENABLED=1.");
  process.exit(1);
}

const worker = createSupplierSyncWorker();
await scheduleSupplierSyncJobs();

worker.on("completed", (job) => {
  console.log(`[SupplierSync] Job ${job.id} completed (${job.name}).`);
});

worker.on("failed", (job, error) => {
  console.error(`[SupplierSync] Job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

console.log("Supplier sync worker running.");
