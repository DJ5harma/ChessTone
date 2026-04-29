CREATE TYPE "public"."challenge_status" AS ENUM('pending', 'accepted', 'declined', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."chess_color" AS ENUM('white', 'black');--> statement-breakpoint
CREATE TYPE "public"."game_result" AS ENUM('white_win', 'black_win', 'draw', 'none');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('active', 'finished', 'aborted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."termination_reason" AS ENUM('checkmate', 'resignation', 'timeout', 'stalemate', 'draw_agreement', 'threefold_repetition', 'insufficient_material', 'fifty_move_rule', 'abort', 'disconnect');--> statement-breakpoint
CREATE TYPE "public"."time_class" AS ENUM('bullet', 'blitz', 'rapid', 'classical');--> statement-breakpoint
CREATE TABLE "game_annotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"move_id" integer,
	"user_id" uuid NOT NULL,
	"fen" text,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenger_id" uuid NOT NULL,
	"opponent_id" uuid NOT NULL,
	"rated" boolean DEFAULT true NOT NULL,
	"time_class" time_class NOT NULL,
	"initial_seconds" integer NOT NULL,
	"increment_seconds" integer DEFAULT 0 NOT NULL,
	"delay_seconds" integer DEFAULT 0 NOT NULL,
	"status" "challenge_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "game_moves" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"ply_index" integer NOT NULL,
	"move_number" integer NOT NULL,
	"color" "chess_color" NOT NULL,
	"uci" text NOT NULL,
	"san" text NOT NULL,
	"fen_before" text NOT NULL,
	"fen_after" text NOT NULL,
	"white_clock_ms" integer NOT NULL,
	"black_clock_ms" integer NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_participants" (
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"color" "chess_color" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"rating_before" integer,
	"rating_after" integer,
	"rating_delta" integer,
	CONSTRAINT "game_participants_game_id_color_pk" PRIMARY KEY("game_id","color")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid,
	"status" "game_status" DEFAULT 'active' NOT NULL,
	"rated" boolean DEFAULT true NOT NULL,
	"time_class" time_class NOT NULL,
	"initial_seconds" integer NOT NULL,
	"increment_seconds" integer DEFAULT 0 NOT NULL,
	"delay_seconds" integer DEFAULT 0 NOT NULL,
	"starting_fen" text NOT NULL,
	"current_fen" text NOT NULL,
	"side_to_move" "chess_color" DEFAULT 'white' NOT NULL,
	"white_clock_ms" integer DEFAULT 0 NOT NULL,
	"black_clock_ms" integer DEFAULT 0 NOT NULL,
	"halfmove_clock" integer DEFAULT 0 NOT NULL,
	"fullmove_number" integer DEFAULT 1 NOT NULL,
	"result" "game_result" DEFAULT 'none' NOT NULL,
	"termination_reason" "termination_reason",
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_challenge_id_unique" UNIQUE("challenge_id")
);
--> statement-breakpoint
CREATE TABLE "matchmaking_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"rated" boolean DEFAULT true NOT NULL,
	"time_class" time_class NOT NULL,
	"initial_seconds" integer NOT NULL,
	"increment_seconds" integer DEFAULT 0 NOT NULL,
	"delay_seconds" integer DEFAULT 0 NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "matchmaking_queue_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "rating_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"time_class" time_class NOT NULL,
	"rating_before" integer NOT NULL,
	"rating_after" integer NOT NULL,
	"rating_delta" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"password_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_presence" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_game_id" uuid
);
--> statement-breakpoint
CREATE TABLE "user_ratings" (
	"user_id" uuid NOT NULL,
	"time_class" time_class NOT NULL,
	"rating" integer DEFAULT 1200 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"peak_rating" integer DEFAULT 1200 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ratings_user_id_time_class_pk" PRIMARY KEY("user_id","time_class")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"country_code" text,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "game_annotations" ADD CONSTRAINT "game_annotations_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_annotations" ADD CONSTRAINT "game_annotations_move_id_game_moves_id_fk" FOREIGN KEY ("move_id") REFERENCES "public"."game_moves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_annotations" ADD CONSTRAINT "game_annotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_challenges" ADD CONSTRAINT "game_challenges_challenger_id_users_id_fk" FOREIGN KEY ("challenger_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_challenges" ADD CONSTRAINT "game_challenges_opponent_id_users_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_challenge_id_game_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."game_challenges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchmaking_queue" ADD CONSTRAINT "matchmaking_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_ledger" ADD CONSTRAINT "rating_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_ledger" ADD CONSTRAINT "rating_ledger_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_current_game_id_games_id_fk" FOREIGN KEY ("current_game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ratings" ADD CONSTRAINT "user_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_game_ply_idx" ON "game_moves" USING btree ("game_id","ply_index");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_game_move_color_idx" ON "game_moves" USING btree ("game_id","move_number","color");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_game_user_idx" ON "game_participants" USING btree ("game_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_game_idx" ON "rating_ledger" USING btree ("user_id","game_id");