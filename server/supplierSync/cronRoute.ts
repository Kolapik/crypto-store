import type { Express } from "express";
import { ENV } from "../_core/env";
import { scheduleSupplierSyncJobs } from "./queue";

export function registerSupplierSyncCronRoute(app: Express) {
  app.all("/api/supplier-sync/cron", async (req, res) => {
    if (!ENV.syncCronSecret) {
      res.status(503).json({ error: "SYNC_CRON_SECRET is not configured." });
      return;
    }
    const token = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? String(req.query.secret ?? "");
    if (token !== ENV.syncCronSecret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const result = await scheduleSupplierSyncJobs();
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });
}
