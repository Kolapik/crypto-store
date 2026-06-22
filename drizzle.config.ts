import { defineConfig } from "drizzle-kit";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.DEV_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/helvetic_reserve";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
