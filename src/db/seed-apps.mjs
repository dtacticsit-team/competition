import "dotenv/config";
import pg from "pg";

/**
 * Seed / register applications in the `applications` table.
 * Edit the `APPLICATIONS` list below to add new apps (e.g. APP_ID=3),
 * then run: `node src/db/seed-apps.mjs`
 */
const APP = { id: 2, name: "PhotoFest", slug: "photofest" };

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const res = await pool.query(
    `INSERT INTO applications (id, name, slug)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [APP.id, APP.name, APP.slug],
  );
  if (res.rowCount === 0) {
    console.log(`Skipped duplicate application (id=${APP.id} or slug="${APP.slug}" already exists).`);
  } else {
    console.log(`Seeded application: ${APP.id}:${APP.slug}`);
  }
} finally {
  await pool.end();
}

