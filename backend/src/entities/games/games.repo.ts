import { db } from "../../db/client.ts";
import { games, gameParticipants, gameMoves } from "../../db/schema.ts";
import { eq, desc, and, ilike, count } from "drizzle-orm";
import type { Game, GameParticipant, GameMove } from "../../db/schema.ts";
import type { TimeClass_I, ChessColor_I, GameResult_I, TerminationReason_I } from "../../shared/types/index.ts";

export class GamesRepo {
    async create(data: {
        rated: boolean;
        vsComputer?: boolean;
        timeClass: TimeClass_I;
        initialSeconds: number;
        incrementSeconds: number;
        delaySeconds: number;
        whiteUserId: string;
        blackUserId: string;
        whiteRating: number;
        blackRating: number;
        challengeId?: string;
    }): Promise<{ game: Game; whiteParticipant: GameParticipant; blackParticipant: GameParticipant }> {
        const result = await db.transaction(async (tx) => {
            const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
            const initialClockMs = data.initialSeconds * 1000;

            const [game] = await tx
                .insert(games)
                .values({
                    challengeId: data.challengeId,
                    rated: data.rated,
                    vsComputer: data.vsComputer ?? false,
                    timeClass: data.timeClass,
                    initialSeconds: data.initialSeconds,
                    incrementSeconds: data.incrementSeconds,
                    delaySeconds: data.delaySeconds,
                    startingFen,
                    currentFen: startingFen,
                    sideToMove: "white",
                    whiteClockMs: initialClockMs,
                    blackClockMs: initialClockMs,
                    halfmoveClock: 0,
                    fullmoveNumber: 1,
                    result: "none",
                    startedAt: new Date(),
                })
                .returning();

            if (!game) {
                throw new Error("Failed to create game");
            }

            const [whiteParticipant] = await tx
                .insert(gameParticipants)
                .values({
                    gameId: game.id,
                    userId: data.whiteUserId,
                    color: "white",
                    ratingBefore: data.whiteRating,
                })
                .returning();

            const [blackParticipant] = await tx
                .insert(gameParticipants)
                .values({
                    gameId: game.id,
                    userId: data.blackUserId,
                    color: "black",
                    ratingBefore: data.blackRating,
                })
                .returning();

            if (!whiteParticipant || !blackParticipant) {
                throw new Error("Failed to create participants");
            }

            return { game, whiteParticipant, blackParticipant };
        });

        return result;
    }

    async findById(gameId: string) {
        const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
        return game || null;
    }

    async getParticipants(gameId: string) {
        return db.select().from(gameParticipants).where(eq(gameParticipants.gameId, gameId));
    }

    async getMoves(gameId: string) {
        return db
            .select()
            .from(gameMoves)
            .where(eq(gameMoves.gameId, gameId))
            .orderBy(gameMoves.plyIndex);
    }

    async countMovesForGame(gameId: string): Promise<number> {
        const [row] = await db
            .select({ n: count() })
            .from(gameMoves)
            .where(eq(gameMoves.gameId, gameId));
        return Number(row?.n ?? 0);
    }

    async updateGameState(
        gameId: string,
        data: {
            currentFen: string;
            sideToMove: ChessColor_I;
            whiteClockMs: number;
            blackClockMs: number;
            halfmoveClock: number;
            fullmoveNumber: number;
        }
    ) {
        const [updated] = await db
            .update(games)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(games.id, gameId))
            .returning();
        if (!updated) {
            throw new Error("Failed to update game");
        }
        return updated;
    }

    async finishGame(gameId: string, result: GameResult_I, terminationReason: TerminationReason_I) {
        const [updated] = await db
            .update(games)
            .set({
                status: "finished",
                result,
                terminationReason,
                endedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(games.id, gameId))
            .returning();
        if (!updated) {
            throw new Error("Failed to finish game");
        }
        return updated;
    }

    async finishGameWithClocks(
        gameId: string,
        result: GameResult_I,
        terminationReason: TerminationReason_I,
        whiteClockMs: number,
        blackClockMs: number
    ) {
        const [updated] = await db
            .update(games)
            .set({
                status: "finished",
                result,
                terminationReason,
                whiteClockMs: Math.max(0, whiteClockMs),
                blackClockMs: Math.max(0, blackClockMs),
                endedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(games.id, gameId))
            .returning();
        if (!updated) {
            throw new Error("Failed to finish game");
        }
        return updated;
    }

    async applyMoveInTransaction(params: {
        gameId: string;
        move: {
            plyIndex: number;
            moveNumber: number;
            color: ChessColor_I;
            uci: string;
            san: string;
            fenBefore: string;
            fenAfter: string;
            whiteClockMs: number;
            blackClockMs: number;
        };
        nextGameState: {
            currentFen: string;
            sideToMove: ChessColor_I;
            whiteClockMs: number;
            blackClockMs: number;
            halfmoveClock: number;
            fullmoveNumber: number;
        };
        finish?: { result: GameResult_I; terminationReason: TerminationReason_I };
    }): Promise<{ game: Game; move: GameMove }> {
        return db.transaction(async (tx) => {
            const [move] = await tx
                .insert(gameMoves)
                .values({
                    gameId: params.gameId,
                    plyIndex: params.move.plyIndex,
                    moveNumber: params.move.moveNumber,
                    color: params.move.color,
                    uci: params.move.uci,
                    san: params.move.san,
                    fenBefore: params.move.fenBefore,
                    fenAfter: params.move.fenAfter,
                    whiteClockMs: params.move.whiteClockMs,
                    blackClockMs: params.move.blackClockMs,
                })
                .returning();

            if (!move) {
                throw new Error("Failed to add move");
            }

            if (params.finish) {
                const [updated] = await tx
                    .update(games)
                    .set({
                        status: "finished",
                        result: params.finish.result,
                        terminationReason: params.finish.terminationReason,
                        currentFen: params.nextGameState.currentFen,
                        sideToMove: params.nextGameState.sideToMove,
                        whiteClockMs: params.nextGameState.whiteClockMs,
                        blackClockMs: params.nextGameState.blackClockMs,
                        halfmoveClock: params.nextGameState.halfmoveClock,
                        fullmoveNumber: params.nextGameState.fullmoveNumber,
                        endedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(games.id, params.gameId))
                    .returning();
                if (!updated) {
                    throw new Error("Failed to finish game after move");
                }
                return { game: updated, move };
            }

            const [updated] = await tx
                .update(games)
                .set({
                    currentFen: params.nextGameState.currentFen,
                    sideToMove: params.nextGameState.sideToMove,
                    whiteClockMs: params.nextGameState.whiteClockMs,
                    blackClockMs: params.nextGameState.blackClockMs,
                    halfmoveClock: params.nextGameState.halfmoveClock,
                    fullmoveNumber: params.nextGameState.fullmoveNumber,
                    updatedAt: new Date(),
                })
                .where(eq(games.id, params.gameId))
                .returning();
            if (!updated) {
                throw new Error("Failed to update game");
            }
            return { game: updated, move };
        });
    }

    async updateParticipantRating(
        gameId: string,
        color: ChessColor_I,
        ratingAfter: number,
        ratingDelta: number
    ) {
        await db
            .update(gameParticipants)
            .set({ ratingAfter, ratingDelta })
            .where(and(eq(gameParticipants.gameId, gameId), eq(gameParticipants.color, color)));
    }

    async getActiveGamesForUser(userId: string) {
        return db
            .select({ game: games })
            .from(games)
            .innerJoin(
                gameParticipants,
                and(eq(gameParticipants.gameId, games.id), eq(gameParticipants.userId, userId))
            )
            .where(eq(games.status, "active"));
    }

    async getGameHistory(userId: string, limit = 20, offset = 0) {
        const rows = await db
            .select({ game: games })
            .from(games)
            .innerJoin(
                gameParticipants,
                and(eq(gameParticipants.gameId, games.id), eq(gameParticipants.userId, userId))
            )
            .where(eq(games.status, "finished"))
            .orderBy(desc(games.endedAt))
            .limit(limit)
            .offset(offset);

        return rows.map((r) => r.game);
    }
}

export const GamesRepoImpl = new GamesRepo();
