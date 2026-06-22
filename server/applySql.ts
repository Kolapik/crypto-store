import dotenv from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ??
  process.env.DEV_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/helvetic_reserve";

const sqlDir = path.resolve(process.cwd(), "sql");
async function main() {
  const pool = new Pool({ connectionString });
  const files = (await readdir(sqlDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No SQL files found.");
    return;
  }

  try {
    for (const file of files) {
      const sql = await readFile(path.join(sqlDir, file), "utf8");
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log(`Applied ${files.length} SQL file(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to apply SQL: ${message}`);
  console.error("Set DATABASE_URL to a reachable PostgreSQL database, or start local PostgreSQL on 127.0.0.1:5432.");
  process.exit(1);
});
