import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { GamesRepoImpl } from "./games.repo.ts";
import { RatingsServiceImpl } from "../ratings/ratings.service.ts";
import { UsersRepoImpl } from "../users/users.repo.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import { emitGameRoom } from "../../realtime/events.ts";
import type { TimeClass_I, ChessColor_I, GameResult_I, TerminationReason_I } from "../../shared/types/index.ts";
import type { Game } from "../../db/schema.ts";
import { STOCKFISH_BOT_USER_ID } from "../../shared/config/botUser.ts";

function applyUciOrSan(chess: Chess, uci: string) {
    const clean = uci.trim();
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(clean)) {
        const promotion = clean[4]?.toLowerCase() as "q" | "r" | "b" | "n" | undefined;
        return chess.move({
            from: clean.slice(0, 2) as Square,
            to: clean.slice(2, 4) as Square,
            ...(promotion ? { promotion } : {}),
        });
    }
    return chess.move(clean);
}

function parseFenClocks(fen: string): { halfmoveClock: number; fullmoveNumber: number } {
    const parts = fen.split(/\s+/);
    const halfmoveClock = Number.parseInt(parts[4] ?? "0", 10) || 0;
    const fullmoveNumber = Number.parseInt(parts[5] ?? "1", 10) || 1;
    return { halfmoveClock, fullmoveNumber };
}

function historyParticipantNames(
    userId: string,
    userRow: { username: string; displayName: string | null } | undefined
): { username: string | null; displayName: string | null } {
    if (userId === STOCKFISH_BOT_USER_ID) {
        return { username: "Stockfish", displayName: "Stockfish" };
    }
    if (!userRow) {
        return { username: null, displayName: null };
    }
    return { username: userRow.username, displayName: userRow.displayName };
}

/** Elapsed wall time since `clockReferenceAt` only reduces the side-to-move clock (PvP). */
export function liveClocksForGame(
    game: Pick<
        Game,
        | "status"
        | "vsComputer"
        | "sideToMove"
        | "whiteClockMs"
        | "blackClockMs"
        | "clockReferenceAt"
        | "startedAt"
    >,
    nowMs: number = Date.now()
): { whiteClockMs: number; blackClockMs: number } {
    const w = Math.max(0, game.whiteClockMs);
    const b = Math.max(0, game.blackClockMs);

    if (game.status !== "active" || game.vsComputer) {
        return { whiteClockMs: w, blackClockMs: b };
    }

    const refMs = game.clockReferenceAt?.getTime() ?? game.startedAt?.getTime() ?? nowMs;
    const elapsed = Math.max(0, nowMs - refMs);

    if (game.sideToMove === "white") {
        return { whiteClockMs: Math.max(0, w - elapsed), blackClockMs: b };
    }
    return { whiteClockMs: w, blackClockMs: Math.max(0, b - elapsed) };
}

export class GamesService {
    async createGame(params: {
        rated: boolean;
        vsComputer?: boolean;
        timeClass: TimeClass_I;
        initialSeconds: number;
        incrementSeconds: number;
        delaySeconds: number;
        whiteUserId: string;
        blackUserId: string;
        challengeId?: string;
    }) {
        const whiteRating = await RatingsServiceImpl.getUserRatingOrDefault(params.whiteUserId, params.timeClass);
        const blackRating = await RatingsServiceImpl.getUserRatingOrDefault(params.blackUserId, params.timeClass);

        const { game, whiteParticipant, blackParticipant } = await GamesRepoImpl.create({
            ...params,
            vsComputer: params.vsComputer ?? false,
            whiteRating: whiteRating.rating,
            blackRating: blackRating.rating,
        });

        const liveCreate = liveClocksForGame(game);

        return {
            id: game.id,
            status: game.status,
            rated: game.rated,
            vsComputer: game.vsComputer,
            timeClass: game.timeClass,
            initialSeconds: game.initialSeconds,
            incrementSeconds: game.incrementSeconds,
            delaySeconds: game.delaySeconds,
            currentFen: game.currentFen,
            sideToMove: game.sideToMove,
            whiteClockMs: liveCreate.whiteClockMs,
            blackClockMs: liveCreate.blackClockMs,
            participants: {
                white: { userId: whiteParticipant.userId, ratingBefore: whiteParticipant.ratingBefore },
                black: { userId: blackParticipant.userId, ratingBefore: blackParticipant.ratingBefore },
            },
        };
    }

    async createComputerGame(
        userId: string,
        params: {
            playAs: ChessColor_I;
            timeClass: TimeClass_I;
            initialSeconds: number;
            incrementSeconds: number;
            delaySeconds: number;
        }
    ) {
        const humanWhite = params.playAs === "white";
        const whiteUserId = humanWhite ? userId : STOCKFISH_BOT_USER_ID;
        const blackUserId = humanWhite ? STOCKFISH_BOT_USER_ID : userId;

        return this.createGame({
            rated: false,
            vsComputer: true,
            timeClass: params.timeClass,
            initialSeconds: params.initialSeconds,
            incrementSeconds: params.incrementSeconds,
            delaySeconds: params.delaySeconds,
            whiteUserId,
            blackUserId,
        });
    }

    async getGame(gameId: string, userId: string) {
        const game = await GamesRepoImpl.findById(gameId);
        if (!game) {
            throw new AppError({ statusCode: 404, message: "Game not found" });
        }

        const participants = await GamesRepoImpl.getParticipants(gameId);
        const moves = await GamesRepoImpl.getMoves(gameId);

        const whiteParticipant = participants.find((p) => p.color === "white");
        const blackParticipant = participants.find((p) => p.color === "black");

        const isParticipant = participants.some((p) => p.userId === userId);

        const live = liveClocksForGame(game);

        return {
            id: game.id,
            status: game.status,
            rated: game.rated,
            vsComputer: game.vsComputer,
            timeClass: game.timeClass,
            initialSeconds: game.initialSeconds,
            incrementSeconds: game.incrementSeconds,
            delaySeconds: game.delaySeconds,
            startingFen: game.startingFen,
            currentFen: game.currentFen,
            sideToMove: game.sideToMove,
            whiteClockMs: live.whiteClockMs,
            blackClockMs: live.blackClockMs,
            drawOfferedByUserId: game.drawOfferedByUserId ?? null,
            result: game.result,
            terminationReason: game.terminationReason,
            participants: {
                white: {
                    userId: whiteParticipant?.userId,
                    ratingBefore: whiteParticipant?.ratingBefore,
                    ratingAfter: whiteParticipant?.ratingAfter,
                    ratingDelta: whiteParticipant?.ratingDelta,
                },
                black: {
                    userId: blackParticipant?.userId,
                    ratingBefore: blackParticipant?.ratingBefore,
                    ratingAfter: blackParticipant?.ratingAfter,
                    ratingDelta: blackParticipant?.ratingDelta,
                },
            },
            moves: moves.map((m) => ({
                plyIndex: m.plyIndex,
                moveNumber: m.moveNumber,
                color: m.color,
                uci: m.uci,
                san: m.san,
                fenAfter: m.fenAfter,
            })),
            isParticipant,
        };
    }

    private async broadcastGameState(gameId: string) {
        const participants = await GamesRepoImpl.getParticipants(gameId);
        const viewerId = participants[0]?.userId;
        if (!viewerId) {
            return;
        }
        const snapshot = await this.getGame(gameId, viewerId);
        emitGameRoom(gameId, "gameState", snapshot);
    }

    async makeMove(gameId: string, userId: string, uci: string, whiteClockMs: number, blackClockMs: number) {
        const game = await GamesRepoImpl.findById(gameId);
        if (!game) {
            throw new AppError({ statusCode: 404, message: "Game not found" });
        }

        if (game.status !== "active") {
            throw new AppError({ statusCode: 400, message: "Game is not active" });
        }

        const participants = await GamesRepoImpl.getParticipants(gameId);
        const userParticipant = participants.find((p) => p.userId === userId);

        if (!userParticipant) {
            throw new AppError({ statusCode: 403, message: "Not a player in this game" });
        }

        const participantToMove = participants.find((p) => p.color === game.sideToMove);
        const isEngineToMove =
            game.vsComputer && participantToMove?.userId === STOCKFISH_BOT_USER_ID;

        if (userParticipant.color !== game.sideToMove) {
            if (!isEngineToMove) {
                throw new AppError({ statusCode: 400, message: "Not your turn" });
            }
        }

        const existingMoves = await GamesRepoImpl.getMoves(gameId);
        const plyIndex = existingMoves.length + 1;

        const chess = new Chess(game.currentFen);
        const move = applyUciOrSan(chess, uci);

        if (!move) {
            throw new AppError({ statusCode: 400, message: "Invalid move" });
        }

        const newSideToMove: ChessColor_I = chess.turn() === "w" ? "white" : "black";
        const { halfmoveClock, fullmoveNumber } = parseFenClocks(chess.fen());
        const moveNumber = Math.ceil(plyIndex / 2);

        const gameOver = chess.isGameOver();
        let result: GameResult_I | null = null;
        let terminationReason: TerminationReason_I | null = null;

        if (gameOver) {
            if (chess.isCheckmate()) {
                terminationReason = "checkmate";
                result = chess.turn() === "w" ? "black_win" : "white_win";
            } else if (chess.isStalemate()) {
                terminationReason = "stalemate";
                result = "draw";
            } else if (chess.isThreefoldRepetition()) {
                terminationReason = "threefold_repetition";
                result = "draw";
            } else if (chess.isInsufficientMaterial()) {
                terminationReason = "insufficient_material";
                result = "draw";
            } else if (chess.isDraw()) {
                terminationReason = "fifty_move_rule";
                result = "draw";
            }
        }

        const nextState = {
            currentFen: chess.fen(),
            sideToMove: newSideToMove,
            whiteClockMs,
            blackClockMs,
            halfmoveClock,
            fullmoveNumber,
        };

        const movePayload = {
            plyIndex,
            moveNumber,
            color: game.sideToMove,
            uci: cleanUciFromMove(move),
            san: move.san,
            fenBefore: game.currentFen,
            fenAfter: chess.fen(),
            whiteClockMs,
            blackClockMs,
        };

        let updatedGame;

        if (result && terminationReason) {
            updatedGame = (
                await GamesRepoImpl.applyMoveInTransaction({
                    gameId,
                    move: movePayload,
                    nextGameState: nextState,
                    finish: { result, terminationReason },
                })
            ).game;

            if (game.rated) {
                const ratingResult = result as "white_win" | "black_win" | "draw";
                const deltas = await RatingsServiceImpl.updateRatingAfterGame(
                    participants.find((p) => p.color === "white")!.userId,
                    participants.find((p) => p.color === "black")!.userId,
                    game.timeClass,
                    gameId,
                    ratingResult
                );
                await GamesRepoImpl.updateParticipantRating(
                    gameId,
                    "white",
                    deltas.white.ratingAfter,
                    deltas.white.ratingDelta
                );
                await GamesRepoImpl.updateParticipantRating(
                    gameId,
                    "black",
                    deltas.black.ratingAfter,
                    deltas.black.ratingDelta
                );
            }

            emitGameRoom(gameId, "gameEnded", {
                result: updatedGame.result,
                terminationReason: updatedGame.terminationReason,
            });
        } else {
            updatedGame = (
                await GamesRepoImpl.applyMoveInTransaction({
                    gameId,
                    move: movePayload,
                    nextGameState: nextState,
                })
            ).game;
        }

        await this.broadcastGameState(gameId);

        return {
            gameId: updatedGame.id,
            fen: updatedGame.currentFen,
            sideToMove: updatedGame.sideToMove,
            result: updatedGame.result,
            terminationReason: updatedGame.terminationReason,
            move: { uci: movePayload.uci, san: move.san },
        };
    }

    async resign(gameId: string, userId: string) {
        const game = await GamesRepoImpl.findById(gameId);
        if (!game) {
            throw new AppError({ statusCode: 404, message: "Game not found" });
        }

        if (game.status !== "active") {
            throw new AppError({ statusCode: 400, message: "Game is not active" });
        }

        const participants = await GamesRepoImpl.getParticipants(gameId);
        const userParticipant = participants.find((p) => p.userId === userId);

        if (!userParticipant) {
            throw new AppError({ statusCode: 403, message: "Not a player in this game" });
        }

        const result: GameResult_I = userParticipant.color === "white" ? "black_win" : "white_win";

        const updatedGame = await GamesRepoImpl.finishGame(gameId, result, "resignation");

        if (game.rated) {
            const deltas = await RatingsServiceImpl.updateRatingAfterGame(
                participants.find((p) => p.color === "white")!.userId,
                participants.find((p) => p.color === "black")!.userId,
                game.timeClass,
                gameId,
                result
            );
            await GamesRepoImpl.updateParticipantRating(
                gameId,
                "white",
                deltas.white.ratingAfter,
                deltas.white.ratingDelta
            );
            await GamesRepoImpl.updateParticipantRating(
                gameId,
                "black",
                deltas.black.ratingAfter,
                deltas.black.ratingDelta
            );
        }

        emitGameRoom(gameId, "gameEnded", {
            result: updatedGame.result,
            terminationReason: updatedGame.terminationReason,
        });
        await this.broadcastGameState(gameId);

        return {
            gameId: updatedGame.id,
            result: updatedGame.result,
            terminationReason: updatedGame.terminationReason,
        };
    }

    async claimTimeout(gameId: string, userId: string, _whiteClockMs: number, _blackClockMs: number) {
        const game = await GamesRepoImpl.findById(gameId);
        if (!game) {
            throw new AppError({ statusCode: 404, message: "Game not found" });
        }

        if (game.status !== "active") {
            throw new AppError({ statusCode: 400, message: "Game is not active" });
        }

        if (game.vsComputer) {
            throw new AppError({ statusCode: 400, message: "Computer games have no clock" });
        }

        const participants = await GamesRepoImpl.getParticipants(gameId);
        if (!participants.some((p) => p.userId === userId)) {
            throw new AppError({ statusCode: 403, message: "Not a player in this game" });
        }

        const live = liveClocksForGame(game);
        const stm = game.sideToMove;
        const moverClockMs = stm === "white" ? live.whiteClockMs : live.blackClockMs;
        if (moverClockMs > 0) {
            throw new AppError({
                statusCode: 400,
                message: "Clock still has time — cannot flag timeout yet",
            });
        }

        const result: GameResult_I = stm === "white" ? "black_win" : "white_win";

        const updatedGame = await GamesRepoImpl.finishGameWithClocks(
            gameId,
            result,
            "timeout",
            live.whiteClockMs,
            live.blackClockMs
        );

        if (game.rated) {
            const deltas = await RatingsServiceImpl.updateRatingAfterGame(
                participants.find((p) => p.color === "white")!.userId,
                participants.find((p) => p.color === "black")!.userId,
                game.timeClass,
                gameId,
                result
            );
            await GamesRepoImpl.updateParticipantRating(
                gameId,
                "white",
                deltas.white.ratingAfter,
                deltas.white.ratingDelta
            );
            await GamesRepoImpl.updateParticipantRating(
                gameId,
                "black",
                deltas.black.ratingAfter,
                deltas.black.ratingDelta
            );
        }

        emitGameRoom(gameId, "gameEnded", {
            result: updatedGame.result,
            terminationReason: updatedGame.terminationReason,
        });
        await this.broadcastGameState(gameId);

        return {
            gameId: updatedGame.id,
            result: updatedGame.result,
            terminationReason: updatedGame.terminationReason,
        };
    }

    async offerDraw(gameId: string, userId: string) {
        const game = await GamesRepoImpl.findById(gameId);
        if (!game) {
            throw new AppError({ statusCode: 404, message: "Game not found" });
        }

        if (game.status !== "active") {
            throw new AppError({ statusCode: 400, message: "Game is not active" });
        }

        if (game.vsComputer) {
            throw new AppError({
                statusCode: 400,
                message: "Draw offers are not available in computer games",
            });
        }

        const participants = await GamesRepoImpl.getParticipants(gameId);
        const userParticipant = participants.find((p) => p.userId === userId);
        if (!userParticipant) {
            throw new AppError({ statusCode: 403, message: "Not a player in this game" });
        }

        if (userParticipant.color !== game.sideToMove) {
            throw new AppError({ statusCode: 400, message: "You can only offer a draw on your turn" });
        }

        await GamesRepoImpl.setDrawOffer(gameId, userId);
        emitGameRoom(gameId, "drawOffer", { fromUserId: userId, gameId });
        await this.broadcastGameState(gameId);
        return { message: "Draw offer sent", gameId };
    }

    async acceptDraw(gameId: string, userId: string) {
        const game = await GamesRepoImpl.findById(gameId);
        if (!game) {
            throw new AppError({ statusCode: 404, message: "Game not found" });
        }

        if (game.status !== "active") {
            throw new AppError({ statusCode: 400, message: "Game is not active" });
        }

        if (game.vsComputer) {
            throw new AppError({
                statusCode: 400,
                message: "Cannot accept a draw in computer games",
            });
        }

        if (!game.drawOfferedByUserId) {
            throw new AppError({ statusCode: 400, message: "No draw offer to accept" });
        }

        if (game.drawOfferedByUserId === userId) {
            throw new AppError({ statusCode: 400, message: "You cannot accept your own draw offer" });
        }

        const participants = await GamesRepoImpl.getParticipants(gameId);
        const isParticipant = participants.some((p) => p.userId === userId);

        if (!isParticipant) {
            throw new AppError({ statusCode: 403, message: "Not a player in this game" });
        }

        const updatedGame = await GamesRepoImpl.finishGame(gameId, "draw", "draw_agreement");

        if (game.rated) {
            const deltas = await RatingsServiceImpl.updateRatingAfterGame(
                participants.find((p) => p.color === "white")!.userId,
                participants.find((p) => p.color === "black")!.userId,
                game.timeClass,
                gameId,
                "draw"
            );
            await GamesRepoImpl.updateParticipantRating(
                gameId,
                "white",
                deltas.white.ratingAfter,
                deltas.white.ratingDelta
            );
            await GamesRepoImpl.updateParticipantRating(
                gameId,
                "black",
                deltas.black.ratingAfter,
                deltas.black.ratingDelta
            );
        }

        emitGameRoom(gameId, "gameEnded", {
            result: updatedGame.result,
            terminationReason: updatedGame.terminationReason,
        });
        await this.broadcastGameState(gameId);

        return {
            gameId: updatedGame.id,
            result: updatedGame.result,
            terminationReason: updatedGame.terminationReason,
        };
    }

    async getGameHistory(userId: string, limit?: number, offset?: number) {
        const gamesList = await GamesRepoImpl.getGameHistory(userId, limit, offset);

        const participantRows = await Promise.all(
            gamesList.map((g) => GamesRepoImpl.getParticipants(g.id))
        );

        const allUserIds = new Set<string>();
        for (const parts of participantRows) {
            for (const p of parts) {
                allUserIds.add(p.userId);
            }
        }

        const userRows = await UsersRepoImpl.findByIds([...allUserIds]);
        const byId = new Map(userRows.map((u) => [u.id, u]));

        const gamesWithParticipants = await Promise.all(
            gamesList.map(async (g, i) => {
                const parts = participantRows[i]!;
                const white = parts.find((p) => p.color === "white");
                const black = parts.find((p) => p.color === "black");
                const wu = white?.userId;
                const bu = black?.userId;
                const wNames = wu
                    ? historyParticipantNames(wu, byId.get(wu))
                    : { username: null, displayName: null };
                const bNames = bu
                    ? historyParticipantNames(bu, byId.get(bu))
                    : { username: null, displayName: null };
                const moveCount = await GamesRepoImpl.countMovesForGame(g.id);

                return {
                    id: g.id,
                    vsComputer: g.vsComputer,
                    timeClass: g.timeClass,
                    rated: g.rated,
                    initialSeconds: g.initialSeconds,
                    incrementSeconds: g.incrementSeconds,
                    delaySeconds: g.delaySeconds,
                    result: g.result,
                    terminationReason: g.terminationReason,
                    startedAt: g.startedAt ? g.startedAt.toISOString() : null,
                    endedAt: g.endedAt ? g.endedAt.toISOString() : null,
                    moveCount,
                    participants: {
                        white: {
                            userId: wu ?? "",
                            username: wNames.username,
                            displayName: wNames.displayName,
                            ratingBefore: white?.ratingBefore ?? null,
                            ratingAfter: white?.ratingAfter ?? null,
                            ratingDelta: white?.ratingDelta ?? null,
                        },
                        black: {
                            userId: bu ?? "",
                            username: bNames.username,
                            displayName: bNames.displayName,
                            ratingBefore: black?.ratingBefore ?? null,
                            ratingAfter: black?.ratingAfter ?? null,
                            ratingDelta: black?.ratingDelta ?? null,
                        },
                    },
                };
            })
        );

        return gamesWithParticipants;
    }

    async findActiveGameIdForUser(userId: string): Promise<string | null> {
        const rows = await GamesRepoImpl.getActiveGamesForUser(userId);
        return rows[0]?.game.id ?? null;
    }
}

function cleanUciFromMove(move: { from: string; to: string; promotion?: string }): string {
    let uci = `${move.from}${move.to}`;
    if (move.promotion) {
        uci += move.promotion.toLowerCase();
    }
    return uci;
}

export const GamesServiceImpl = new GamesService();
