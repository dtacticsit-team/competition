-- Add proof guideline reference images for competitions (Start, Mid, End stage proofs)
ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "proof_start_image_id" uuid REFERENCES "images"("id") ON DELETE SET NULL;
ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "proof_mid_image_id" uuid REFERENCES "images"("id") ON DELETE SET NULL;
ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "proof_end_image_id" uuid REFERENCES "images"("id") ON DELETE SET NULL;

