// Safe, idempotent user profile backfill & migration runner
//
// 1. Adds `username` (text) and `bio` (text) to users table if missing.
// 2. Safely normalizes and backfills usernames for all existing users.
// 3. Handles collisions deterministically by suffixing.
// 4. Sets NOT NULL and UNIQUE constraint on `username`.
//
// Usage: node scripts/migrate-usernames.mjs

import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const RESERVED = new Set([
  "admin",
  "administrator",
  "api",
  "app",
  "auth",
  "competition",
  "competitions",
  "cron",
  "dashboard",
  "explore",
  "feed",
  "help",
  "image",
  "images",
  "kolam",
  "kolamfest",
  "login",
  "logout",
  "moderator",
  "profile",
  "register",
  "reset",
  "root",
  "settings",
  "submit",
  "support",
  "system",
  "terms",
  "u",
  "user",
  "users",
  "verify",
  "vote",
  "winner",
  "winners",
]);

function normalizeName(name) {
  let base = (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");

  if (base.length < 3) base = "kolam_artist";
  if (base.length > 18) base = base.slice(0, 18).replace(/_+$/, "");
  if (base.length < 3) base = "kolam_artist";
  if (RESERVED.has(base)) base = `${base}_artist`;
  return base;
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing in environment or .env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  console.log("Checking database schema for username and bio columns...");
  await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;`);
  await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;`);

  console.log("Querying users needing username backfill...");
  const { rows: allUsers } = await client.query(
    `SELECT id, name, email, username FROM "users" ORDER BY created_at ASC, id ASC;`
  );

  const assignedUsernames = new Set();
  // Register already established valid usernames
  for (const u of allUsers) {
    if (u.username && /^[a-z0-9_]{3,24}$/.test(u.username) && !RESERVED.has(u.username)) {
      assignedUsernames.add(u.username);
    }
  }

  let backfillCount = 0;
  for (const u of allUsers) {
    if (u.username && assignedUsernames.has(u.username)) {
      continue;
    }

    const base = normalizeName(u.name);
    let chosen = base;
    let suffix = 1;

    while (assignedUsernames.has(chosen) || RESERVED.has(chosen)) {
      const s = String(suffix);
      chosen = `${base.slice(0, 24 - s.length - 1)}_${s}`;
      suffix++;
    }

    assignedUsernames.add(chosen);
    await client.query(`UPDATE "users" SET "username" = $1 WHERE id = $2;`, [chosen, u.id]);
    backfillCount++;
    console.log(`  [Backfilled] ${u.name} (${u.email}) -> @${chosen}`);
  }

  console.log(`Backfilled ${backfillCount} user accounts.`);

  console.log("Applying NOT NULL and UNIQUE constraint on username...");
  await client.query(`ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");`);

  console.log("Migration completed successfully! All users have valid, unique usernames.");
} catch (err) {
  console.error("Migration error:", err);
  process.exit(1);
} finally {
  await client.end();
}
