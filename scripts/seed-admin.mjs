// Creates (or updates) the competition-creator admin account from .env.
//
//   ADMIN_EMAIL=admin@kolam.test
//   ADMIN_PASSWORD=your-strong-password      (min 8 characters)
//
// Run once after `npx drizzle-kit push`, and again any time you change the
// password in .env. Safe to re-run: it updates the same account.
import { randomBytes, scrypt } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

// Minimal .env loader so the script works with plain `node` (no extra tooling).
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
const name = process.env.ADMIN_NAME?.trim() || "Competition Admin";
const phone = process.env.ADMIN_PHONE?.trim() || "9999999999";

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("ADMIN_EMAIL is missing or not a valid email address in .env");
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_PASSWORD is missing or shorter than 8 characters in .env");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing in .env");
  process.exit(1);
}

// Same format as src/lib/auth.ts hashPassword(): scrypt$<saltHex>$<keyHex>
const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
  scrypt(password, salt, 64, (err, k) => (err ? reject(err) : resolve(k))),
);
const passwordHash = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(
    `insert into users (name, email, phone, password_hash, role, email_verified_at)
     values ($1, $2, $3, $4, 'admin', now())
     on conflict (email) do update
       set password_hash = excluded.password_hash,
           role = 'admin',
           email_verified_at = coalesce(users.email_verified_at, now())
     returning id, (xmax = 0) as created`,
    [name, email, phone, passwordHash],
  );
  console.log(`${rows[0].created ? "Created" : "Updated"} admin account: ${email}`);
  console.log("Log in at /login with this email and ADMIN_PASSWORD from .env.");
} finally {
  await client.end();
}
