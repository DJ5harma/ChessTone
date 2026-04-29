ALTER TABLE "games" ADD COLUMN "clock_reference_at" timestamp with time zone;
UPDATE "games" SET "clock_reference_at" = COALESCE("started_at", "created_at");
ALTER TABLE "games" ALTER COLUMN "clock_reference_at" SET NOT NULL;
ALTER TABLE "games" ALTER COLUMN "clock_reference_at" SET DEFAULT now();
