I’d model the baseline around **one game header**, **one participant row per side**, **one move log**, and **separate rating/history tables**.

This keeps live play simple, replay reliable, and rating updates auditable.

```sql
-- Core baseline for a standard online chess platform:
-- - multiplayer games
-- - direct challenges / quick play queue
-- - ratings
-- - game replay / manual review

CREATE SCHEMA IF NOT EXISTS chess;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ----------------------------
-- ENUMS
-- ----------------------------

CREATE TYPE chess.time_class AS ENUM ('bullet', 'blitz', 'rapid', 'classical');

CREATE TYPE chess.chess_color AS ENUM ('white', 'black');

CREATE TYPE chess.game_status AS ENUM (
  'active',
  'finished',
  'aborted',
  'cancelled'
);

CREATE TYPE chess.game_result AS ENUM (
  'white_win',
  'black_win',
  'draw',
  'none'
);

CREATE TYPE chess.termination_reason AS ENUM (
  'checkmate',
  'resignation',
  'timeout',
  'stalemate',
  'draw_agreement',
  'threefold_repetition',
  'insufficient_material',
  'fifty_move_rule',
  'abort',
  'disconnect'
);

CREATE TYPE chess.challenge_status AS ENUM (
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'expired'
);

-- ----------------------------
-- USERS
-- ----------------------------

CREATE TABLE chess.users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username          citext NOT NULL UNIQUE,
  display_name      text,
  country_code      char(2),
  is_disabled       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- Optional local auth. Drop this table if you use external auth only.
CREATE TABLE chess.user_credentials (
  user_id              uuid PRIMARY KEY REFERENCES chess.users(id) ON DELETE CASCADE,
  password_hash        text NOT NULL,
  password_updated_at  timestamptz NOT NULL DEFAULT now(),
  failed_login_count    integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until          timestamptz
);

-- Current rating per time control.
CREATE TABLE chess.user_ratings (
  user_id          uuid NOT NULL REFERENCES chess.users(id) ON DELETE CASCADE,
  time_class       chess.time_class NOT NULL,
  rating           integer NOT NULL DEFAULT 1200 CHECK (rating > 0),
  games_played     integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  wins             integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses           integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws            integer NOT NULL DEFAULT 0 CHECK (draws >= 0),
  peak_rating      integer NOT NULL DEFAULT 1200 CHECK (peak_rating > 0),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, time_class)
);

-- ----------------------------
-- QUEUE + CHALLENGES
-- ----------------------------

-- Quick play queue entry.
CREATE TABLE chess.matchmaking_queue (
  id                 bigserial PRIMARY KEY,
  user_id            uuid NOT NULL UNIQUE REFERENCES chess.users(id) ON DELETE CASCADE,
  rated              boolean NOT NULL DEFAULT true,
  time_class         chess.time_class NOT NULL,
  initial_seconds    integer NOT NULL CHECK (initial_seconds >= 0),
  increment_seconds  integer NOT NULL DEFAULT 0 CHECK (increment_seconds >= 0),
  delay_seconds      integer NOT NULL DEFAULT 0 CHECK (delay_seconds >= 0),
  queued_at          timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz,
  cancelled_at       timestamptz
);

CREATE INDEX matchmaking_queue_search_idx
  ON chess.matchmaking_queue (rated, time_class, initial_seconds, increment_seconds, queued_at);

-- Direct challenge from one user to another.
CREATE TABLE chess.game_challenges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id      uuid NOT NULL REFERENCES chess.users(id) ON DELETE CASCADE,
  opponent_id        uuid NOT NULL REFERENCES chess.users(id) ON DELETE CASCADE,
  rated              boolean NOT NULL DEFAULT true,
  time_class         chess.time_class NOT NULL,
  initial_seconds    integer NOT NULL CHECK (initial_seconds >= 0),
  increment_seconds  integer NOT NULL DEFAULT 0 CHECK (increment_seconds >= 0),
  delay_seconds      integer NOT NULL DEFAULT 0 CHECK (delay_seconds >= 0),
  status             chess.challenge_status NOT NULL DEFAULT 'pending',
  created_at         timestamptz NOT NULL DEFAULT now(),
  responded_at       timestamptz,
  expires_at         timestamptz,
  cancelled_at       timestamptz,
  CONSTRAINT challenge_participants_different CHECK (challenger_id <> opponent_id)
);

CREATE INDEX game_challenges_opponent_status_idx
  ON chess.game_challenges (opponent_id, status, created_at DESC);

CREATE INDEX game_challenges_challenger_status_idx
  ON chess.game_challenges (challenger_id, status, created_at DESC);

-- ----------------------------
-- GAMES
-- ----------------------------

CREATE TABLE chess.games (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id           uuid UNIQUE REFERENCES chess.game_challenges(id) ON DELETE SET NULL,

  status                 chess.game_status NOT NULL DEFAULT 'active',
  rated                  boolean NOT NULL DEFAULT true,
  time_class             chess.time_class NOT NULL,

  initial_seconds        integer NOT NULL CHECK (initial_seconds >= 0),
  increment_seconds      integer NOT NULL DEFAULT 0 CHECK (increment_seconds >= 0),
  delay_seconds          integer NOT NULL DEFAULT 0 CHECK (delay_seconds >= 0),

  starting_fen           text NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  current_fen            text NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',

  side_to_move           chess_color NOT NULL DEFAULT 'white',
  white_clock_ms         integer NOT NULL DEFAULT 0 CHECK (white_clock_ms >= 0),
  black_clock_ms         integer NOT NULL DEFAULT 0 CHECK (black_clock_ms >= 0),
  halfmove_clock         integer NOT NULL DEFAULT 0 CHECK (halfmove_clock >= 0),
  fullmove_number        integer NOT NULL DEFAULT 1 CHECK (fullmove_number >= 1),

  result                 chess.game_result NOT NULL DEFAULT 'none',
  termination_reason     chess.termination_reason,

  started_at             timestamptz,
  ended_at               timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT finished_game_has_end_time
    CHECK (
      (status = 'finished' AND ended_at IS NOT NULL) OR
      (status <> 'finished')
    )
);

CREATE INDEX games_status_created_idx
  ON chess.games (status, created_at DESC);

CREATE INDEX games_created_at_idx
  ON chess.games (created_at DESC);

-- One row per player in the game.
CREATE TABLE chess.game_participants (
  game_id            uuid NOT NULL REFERENCES chess.games(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES chess.users(id) ON DELETE RESTRICT,
  color              chess.chess_color NOT NULL,

  joined_at          timestamptz NOT NULL DEFAULT now(),
  left_at            timestamptz,

  rating_before      integer CHECK (rating_before > 0),
  rating_after       integer CHECK (rating_after > 0),
  rating_delta       integer,

  PRIMARY KEY (game_id, color),
  UNIQUE (game_id, user_id)
);

CREATE INDEX game_participants_user_idx
  ON chess.game_participants (user_id, joined_at DESC);

-- ----------------------------
-- MOVES / REPLAY
-- ----------------------------

CREATE TABLE chess.game_moves (
  id                 bigserial PRIMARY KEY,
  game_id            uuid NOT NULL REFERENCES chess.games(id) ON DELETE CASCADE,

  ply_index          integer NOT NULL CHECK (ply_index >= 1),
  move_number        integer NOT NULL CHECK (move_number >= 1),
  color              chess.chess_color NOT NULL,

  uci                text NOT NULL,
  san                text NOT NULL,

  fen_before         text NOT NULL,
  fen_after          text NOT NULL,

  white_clock_ms     integer NOT NULL CHECK (white_clock_ms >= 0),
  black_clock_ms     integer NOT NULL CHECK (black_clock_ms >= 0),

  played_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (game_id, ply_index),
  UNIQUE (game_id, move_number, color)
);

CREATE INDEX game_moves_game_ply_idx
  ON chess.game_moves (game_id, ply_index);

CREATE INDEX game_moves_game_move_idx
  ON chess.game_moves (game_id, move_number, color);

-- Manual review / notes.
-- Can attach to a specific move or to a raw FEN position.
CREATE TABLE chess.game_annotations (
  id                 bigserial PRIMARY KEY,
  game_id            uuid NOT NULL REFERENCES chess.games(id) ON DELETE CASCADE,
  move_id            bigint REFERENCES chess.game_moves(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES chess.users(id) ON DELETE CASCADE,

  fen                text,
  note               text NOT NULL,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT annotation_has_target
    CHECK (move_id IS NOT NULL OR fen IS NOT NULL)
);

CREATE INDEX game_annotations_game_idx
  ON chess.game_annotations (game_id, created_at DESC);

CREATE INDEX game_annotations_user_idx
  ON chess.game_annotations (user_id, created_at DESC);

-- ----------------------------
-- RATING LEDGER / HISTORY
-- ----------------------------

-- Audit trail for rating changes after rated games.
CREATE TABLE chess.rating_ledger (
  id                 bigserial PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES chess.users(id) ON DELETE CASCADE,
  game_id            uuid NOT NULL REFERENCES chess.games(id) ON DELETE CASCADE,
  time_class         chess.time_class NOT NULL,

  rating_before      integer NOT NULL CHECK (rating_before > 0),
  rating_after       integer NOT NULL CHECK (rating_after > 0),
  rating_delta       integer NOT NULL,

  created_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, game_id)
);

CREATE INDEX rating_ledger_user_idx
  ON chess.rating_ledger (user_id, created_at DESC);

CREATE INDEX rating_ledger_game_idx
  ON chess.rating_ledger (game_id);

-- ----------------------------
-- OPTIONAL: USER ACTIVITY / PRESENCE
-- ----------------------------

-- Helpful for online status and reconnect handling.
CREATE TABLE chess.user_presence (
  user_id            uuid PRIMARY KEY REFERENCES chess.users(id) ON DELETE CASCADE,
  is_online          boolean NOT NULL DEFAULT false,
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  current_game_id    uuid REFERENCES chess.games(id) ON DELETE SET NULL
);

CREATE INDEX user_presence_last_seen_idx
  ON chess.user_presence (last_seen_at DESC);
```

The clean pattern here is:

* `games` stores the match header and current state.
* `game_participants` stores which users played white/black plus rating snapshots.
* `game_moves` stores the full replay log.
* `rating_ledger` stores rating history so you can audit and rebuild stats.
* `game_annotations` stores manual review notes.

A good next step is to generate the **minimal API contract** that matches this schema: create challenge, join queue, start game, submit move, finalize game, fetch replay.
