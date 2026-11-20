import { defineConfig } from "drizzle-kit";

/**
 * `npx drizzle-kit push` creates/updates the tables (there are no migration files).
 * Reads DATABASE_URL from the environment, with the local sandbox default.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
