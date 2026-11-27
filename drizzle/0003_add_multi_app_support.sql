-- Safe, non-destructive migration for multi-application support (APP_ID).
-- Preserves all existing KolamFest data and assigns APP_ID = 1.

CREATE TABLE IF NOT EXISTS "applications" (
  "id" integer PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "applications" ("id", "name", "slug")
VALUES
  (1, 'KolamFest', 'kolamfest'),
  (2, 'PhotoFest', 'photofest')
ON CONFLICT ("id") DO NOTHING;

-- 1. competitions
ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "app_id" integer;
UPDATE "competitions" SET "app_id" = 1 WHERE "app_id" IS NULL;
ALTER TABLE "competitions" ALTER COLUMN "app_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "competitions" ADD CONSTRAINT "competitions_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "competitions_app_status_end_idx" ON "competitions" ("app_id", "status", "end_at");

-- 2. registrations
ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "app_id" integer;
UPDATE "registrations" SET "app_id" = 1 WHERE "app_id" IS NULL;
ALTER TABLE "registrations" ALTER COLUMN "app_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "registrations" ADD CONSTRAINT "registrations_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "registrations_app_competition_idx" ON "registrations" ("app_id", "competition_id");

-- 3. submissions
ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "app_id" integer;
UPDATE "submissions" SET "app_id" = 1 WHERE "app_id" IS NULL;
ALTER TABLE "submissions" ALTER COLUMN "app_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "submissions_app_competition_idx" ON "submissions" ("app_id", "competition_id", "submitted_at");
CREATE INDEX IF NOT EXISTS "submissions_app_submitted_idx" ON "submissions" ("app_id", "submitted_at");

-- 4. votes
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "app_id" integer;
UPDATE "votes" SET "app_id" = 1 WHERE "app_id" IS NULL;
ALTER TABLE "votes" ALTER COLUMN "app_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "votes" ADD CONSTRAINT "votes_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "votes_app_submission_idx" ON "votes" ("app_id", "submission_id");

-- 5. vote_events
ALTER TABLE "vote_events" ADD COLUMN IF NOT EXISTS "app_id" integer;
UPDATE "vote_events" SET "app_id" = 1 WHERE "app_id" IS NULL;
ALTER TABLE "vote_events" ALTER COLUMN "app_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "vote_events_app_submission_idx" ON "vote_events" ("app_id", "submission_id", "created_at");

-- 6. sponsors
ALTER TABLE "sponsors" ADD COLUMN IF NOT EXISTS "app_id" integer;
UPDATE "sponsors" SET "app_id" = 1 WHERE "app_id" IS NULL;
ALTER TABLE "sponsors" ALTER COLUMN "app_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "sponsors_app_idx" ON "sponsors" ("app_id", "created_at");

-- 7. prize_configuration
ALTER TABLE "prize_configuration" ADD COLUMN IF NOT EXISTS "app_id" integer;
UPDATE "prize_configuration" SET "app_id" = 1 WHERE "app_id" IS NULL;
ALTER TABLE "prize_configuration" ALTER COLUMN "app_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "prize_configuration" ADD CONSTRAINT "prize_configuration_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "prize_configuration_app_uq" ON "prize_configuration" ("app_id");

-- 8. winners
ALTER TABLE "winners" ADD COLUMN IF NOT EXISTS "app_id" integer;
UPDATE "winners" SET "app_id" = 1 WHERE "app_id" IS NULL;
ALTER TABLE "winners" ALTER COLUMN "app_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "winners" ADD CONSTRAINT "winners_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "winners_app_competition_idx" ON "winners" ("app_id", "competition_id");

-- 9. design_references
ALTER TABLE "design_references" ADD COLUMN IF NOT EXISTS "app_id" integer;
UPDATE "design_references" SET "app_id" = 1 WHERE "app_id" IS NULL;
ALTER TABLE "design_references" ALTER COLUMN "app_id" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "design_references" ADD CONSTRAINT "design_references_app_id_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "design_references_app_section_idx" ON "design_references" ("app_id", "section", "created_at");

