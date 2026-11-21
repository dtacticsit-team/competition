-- KolamFest Phase 1: Add Public Creator Profiles (username & bio)
-- Safe, additive migration with deterministic backfill

-- 1. Add columns as nullable first
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;

-- 2. Deterministic backfill for existing users lacking a username
WITH candidate_users AS (
  SELECT
    id,
    COALESCE(
      NULLIF(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            LOWER(TRIM(name)),
            '[^a-z0-9_]+', '_', 'g'
          ),
          '^_+|_+$', '', 'g'
        ),
        ''
      ),
      'kolam_artist'
    ) AS raw_candidate,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS seq
  FROM "users"
  WHERE "username" IS NULL OR "username" = ''
)
UPDATE "users" u
SET "username" = CASE
  WHEN LENGTH(c.raw_candidate) >= 3 AND c.raw_candidate NOT IN ('admin', 'api', 'kolamfest', 'support', 'system', 'root') AND c.seq = 1
    THEN SUBSTRING(c.raw_candidate, 1, 24)
  ELSE
    SUBSTRING(
      CASE
        WHEN LENGTH(c.raw_candidate) < 3 THEN 'kolam_artist'
        ELSE c.raw_candidate
      END,
      1, 18
    ) || '_' || c.seq
END
FROM candidate_users c
WHERE u.id = c.id AND (u.username IS NULL OR u.username = '');

-- 3. Enforce NOT NULL constraint on username
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- 4. Create unique constraint/index on username
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
