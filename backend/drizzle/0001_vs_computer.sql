ALTER TABLE "games" ADD COLUMN "vs_computer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
INSERT INTO "users" ("id", "username", "display_name", "country_code", "is_disabled", "created_at", "updated_at")
VALUES (
  'a0000001-0001-4000-8000-000000000001',
  'stockfish_bot',
  'Stockfish',
  NULL,
  false,
  now(),
  now()
)
ON CONFLICT ("username") DO NOTHING;