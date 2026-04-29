import {
    pgTable,
    uuid,
    text,
    boolean,
    integer,
    timestamp,
    pgEnum,
    serial,
    uniqueIndex,
    primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const timeClassEnum = pgEnum("time_class", [
    "bullet",
    "blitz",
    "rapid",
    "classical",
]);

export const chessColorEnum = pgEnum("chess_color", ["white", "black"]);

export const gameStatusEnum = pgEnum("game_status", [
    "active",
    "finished",
    "aborted",
    "cancelled",
]);

export const gameResultEnum = pgEnum("game_result", [
    "white_win",
    "black_win",
    "draw",
    "none",
]);

export const terminationReasonEnum = pgEnum("termination_reason", [
    "checkmate",
    "resignation",
    "timeout",
    "stalemate",
    "draw_agreement",
    "threefold_repetition",
    "insufficient_material",
    "fifty_move_rule",
    "abort",
    "disconnect",
]);

export const challengeStatusEnum = pgEnum("challenge_status", [
    "pending",
    "accepted",
    "declined",
    "withdrawn",
    "expired",
]);

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull().unique(),
    displayName: text("display_name"),
    countryCode: text("country_code"),
    isDisabled: boolean("is_disabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export const userCredentials = pgTable("user_credentials", {
    userId: uuid("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    passwordUpdatedAt: timestamp("password_updated_at", {
        withTimezone: true,
        mode: "date",
    })
        .notNull()
        .default(sql`now()`),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
});

export const userRatings = pgTable(
    "user_ratings",
    {
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        timeClass: timeClassEnum("time_class").notNull(),
        rating: integer("rating").notNull().default(1200),
        gamesPlayed: integer("games_played").notNull().default(0),
        wins: integer("wins").notNull().default(0),
        losses: integer("losses").notNull().default(0),
        draws: integer("draws").notNull().default(0),
        peakRating: integer("peak_rating").notNull().default(1200),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
            .notNull()
            .default(sql`now()`),
    },
    (table) => [primaryKey({ columns: [table.userId, table.timeClass] })]
);

export const matchmakingQueue = pgTable("matchmaking_queue", {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: "cascade" }),
    rated: boolean("rated").notNull().default(true),
    timeClass: timeClassEnum("time_class").notNull(),
    initialSeconds: integer("initial_seconds").notNull(),
    incrementSeconds: integer("increment_seconds").notNull().default(0),
    delaySeconds: integer("delay_seconds").notNull().default(0),
    queuedAt: timestamp("queued_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
});

export const gameChallenges = pgTable("game_challenges", {
    id: uuid("id").primaryKey().defaultRandom(),
    challengerId: uuid("challenger_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    opponentId: uuid("opponent_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    rated: boolean("rated").notNull().default(true),
    timeClass: timeClassEnum("time_class").notNull(),
    initialSeconds: integer("initial_seconds").notNull(),
    incrementSeconds: integer("increment_seconds").notNull().default(0),
    delaySeconds: integer("delay_seconds").notNull().default(0),
    status: challengeStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
});

export const games = pgTable("games", {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeId: uuid("challenge_id")
        .unique()
        .references(() => gameChallenges.id, {
            onDelete: "set null",
        }),
    status: gameStatusEnum("status").notNull().default("active"),
    rated: boolean("rated").notNull().default(true),
    /** Human vs local engine — human may POST moves for the engine's turn. */
    vsComputer: boolean("vs_computer").notNull().default(false),
    timeClass: timeClassEnum("time_class").notNull(),
    initialSeconds: integer("initial_seconds").notNull(),
    incrementSeconds: integer("increment_seconds").notNull().default(0),
    delaySeconds: integer("delay_seconds").notNull().default(0),
    startingFen: text("starting_fen").notNull(),
    currentFen: text("current_fen").notNull(),
    sideToMove: chessColorEnum("side_to_move").notNull().default("white"),
    whiteClockMs: integer("white_clock_ms").notNull().default(0),
    blackClockMs: integer("black_clock_ms").notNull().default(0),
    /** Wall time when stored clocks became valid for the current thinking period (PvP live clock). */
    clockReferenceAt: timestamp("clock_reference_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
    /** Player who offered a draw; cleared when the offer is accepted or any move is played. */
    drawOfferedByUserId: uuid("draw_offered_by_user_id").references(() => users.id, {
        onDelete: "set null",
    }),
    halfmoveClock: integer("halfmove_clock").notNull().default(0),
    fullmoveNumber: integer("fullmove_number").notNull().default(1),
    result: gameResultEnum("result").notNull().default("none"),
    terminationReason: terminationReasonEnum("termination_reason"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
});

export const gameParticipants = pgTable(
    "game_participants",
    {
        gameId: uuid("game_id")
            .notNull()
            .references(() => games.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        color: chessColorEnum("color").notNull(),
        joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" })
            .notNull()
            .default(sql`now()`),
        leftAt: timestamp("left_at", { withTimezone: true, mode: "date" }),
        ratingBefore: integer("rating_before"),
        ratingAfter: integer("rating_after"),
        ratingDelta: integer("rating_delta"),
    },
    (table) => [
        primaryKey({ columns: [table.gameId, table.color] }),
        uniqueIndex("unique_game_user_idx").on(table.gameId, table.userId),
    ]
);

export const gameMoves = pgTable(
    "game_moves",
    {
        id: serial("id").primaryKey(),
        gameId: uuid("game_id")
            .notNull()
            .references(() => games.id, { onDelete: "cascade" }),
        plyIndex: integer("ply_index").notNull(),
        moveNumber: integer("move_number").notNull(),
        color: chessColorEnum("color").notNull(),
        uci: text("uci").notNull(),
        san: text("san").notNull(),
        fenBefore: text("fen_before").notNull(),
        fenAfter: text("fen_after").notNull(),
        whiteClockMs: integer("white_clock_ms").notNull(),
        blackClockMs: integer("black_clock_ms").notNull(),
        playedAt: timestamp("played_at", { withTimezone: true, mode: "date" })
            .notNull()
            .default(sql`now()`),
    },
    (table) => [
        uniqueIndex("unique_game_ply_idx").on(table.gameId, table.plyIndex),
        uniqueIndex("unique_game_move_color_idx").on(
            table.gameId,
            table.moveNumber,
            table.color
        ),
    ]
);

export const gameAnnotations = pgTable("game_annotations", {
    id: serial("id").primaryKey(),
    gameId: uuid("game_id")
        .notNull()
        .references(() => games.id, { onDelete: "cascade" }),
    moveId: integer("move_id").references(() => gameMoves.id, {
        onDelete: "cascade",
    }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    fen: text("fen"),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
});

export const ratingLedger = pgTable(
    "rating_ledger",
    {
        id: serial("id").primaryKey(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        gameId: uuid("game_id")
            .notNull()
            .references(() => games.id, { onDelete: "cascade" }),
        timeClass: timeClassEnum("time_class").notNull(),
        ratingBefore: integer("rating_before").notNull(),
        ratingAfter: integer("rating_after").notNull(),
        ratingDelta: integer("rating_delta").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
            .notNull()
            .default(sql`now()`),
    },
    (table) => [uniqueIndex("unique_user_game_idx").on(table.userId, table.gameId)]
);

export const userPresence = pgTable("user_presence", {
    userId: uuid("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    isOnline: boolean("is_online").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
        .notNull()
        .default(sql`now()`),
    currentGameId: uuid("current_game_id").references(() => games.id, {
        onDelete: "set null",
    }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserCredentials = typeof userCredentials.$inferSelect;
export type NewUserCredentials = typeof userCredentials.$inferInsert;
export type UserRating = typeof userRatings.$inferSelect;
export type NewUserRating = typeof userRatings.$inferInsert;
export type MatchmakingQueueEntry = typeof matchmakingQueue.$inferSelect;
export type NewMatchmakingQueueEntry = typeof matchmakingQueue.$inferInsert;
export type GameChallenge = typeof gameChallenges.$inferSelect;
export type NewGameChallenge = typeof gameChallenges.$inferInsert;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GameParticipant = typeof gameParticipants.$inferSelect;
export type NewGameParticipant = typeof gameParticipants.$inferInsert;
export type GameMove = typeof gameMoves.$inferSelect;
export type NewGameMove = typeof gameMoves.$inferInsert;
export type GameAnnotation = typeof gameAnnotations.$inferSelect;
export type NewGameAnnotation = typeof gameAnnotations.$inferInsert;
export type RatingLedgerEntry = typeof ratingLedger.$inferSelect;
export type NewRatingLedgerEntry = typeof ratingLedger.$inferInsert;
export type UserPresence = typeof userPresence.$inferSelect;
export type NewUserPresence = typeof userPresence.$inferInsert;