import { MatchmakingRepoImpl, ChallengesRepoImpl } from "./matchmaking.repo.ts";
import { GamesServiceImpl } from "../games/games.service.ts";
import { UsersRepoImpl } from "../users/users.repo.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import type { TimeClass_I } from "../../shared/types/index.ts";
import { emitUserRoom } from "../../realtime/events.ts";

export class MatchmakingService {
    async joinQueue(
        userId: string,
        params: {
            rated: boolean;
            timeClass: TimeClass_I;
            initialSeconds: number;
            incrementSeconds: number;
            delaySeconds: number;
        }
    ) {
        const existing = await MatchmakingRepoImpl.findByUserId(userId);
        if (existing) {
            throw new AppError({
                statusCode: 400,
                message: "Already in queue",
            });
        }

        const queueEntry = await MatchmakingRepoImpl.joinQueue({
            userId,
            ...params,
        });

        const match = await MatchmakingRepoImpl.findMatch({
            userId,
            rated: params.rated,
            timeClass: params.timeClass,
            initialSeconds: params.initialSeconds,
            incrementSeconds: params.incrementSeconds,
        });

        if (match) {
            await MatchmakingRepoImpl.removeFromQueue(userId);
            await MatchmakingRepoImpl.removeFromQueue(match.userId);

            const game = await GamesServiceImpl.createGame({
                rated: params.rated,
                timeClass: params.timeClass,
                initialSeconds: params.initialSeconds,
                incrementSeconds: params.incrementSeconds,
                delaySeconds: params.delaySeconds,
                whiteUserId: userId,
                blackUserId: match.userId,
            });

            const payload = { gameId: game.id };
            emitUserRoom(userId, "matchFound", payload);
            emitUserRoom(match.userId, "matchFound", payload);

            return {
                matched: true,
                gameId: game.id,
            };
        }

        const queueCount = await MatchmakingRepoImpl.getQueueCount({
            rated: params.rated,
            timeClass: params.timeClass,
            initialSeconds: params.initialSeconds,
            incrementSeconds: params.incrementSeconds,
        });

        return {
            matched: false,
            queuePosition: queueCount,
            queueEntry,
        };
    }

    async leaveQueue(userId: string) {
        await MatchmakingRepoImpl.leaveQueue(userId);
        return { success: true };
    }

    async getQueueStatus(userId: string) {
        const entry = await MatchmakingRepoImpl.findByUserId(userId);
        if (entry) {
            return {
                inQueue: true,
                ...entry,
            };
        }

        const activeGameId = await GamesServiceImpl.findActiveGameIdForUser(userId);
        if (activeGameId) {
            return { inQueue: false, activeGameId };
        }

        return { inQueue: false };
    }

    async createChallenge(
        challengerId: string,
        opponentId: string,
        params: {
            rated: boolean;
            timeClass: TimeClass_I;
            initialSeconds: number;
            incrementSeconds: number;
            delaySeconds: number;
        }
    ) {
        const opponent = await UsersRepoImpl.findById(opponentId);
        if (!opponent) {
            throw new AppError({ statusCode: 404, message: "User not found" });
        }

        const challenge = await ChallengesRepoImpl.createChallenge({
            challengerId,
            opponentId,
            ...params,
        });

        const challengerUser = await UsersRepoImpl.findById(challengerId);
        emitUserRoom(opponentId, "challengeReceived", {
            challenge: {
                id: challenge.id,
                challengerId: challenge.challengerId,
                opponentId: challenge.opponentId,
                challengerUsername: challengerUser?.username ?? null,
                rated: challenge.rated,
                timeClass: challenge.timeClass,
                initialSeconds: challenge.initialSeconds,
                incrementSeconds: challenge.incrementSeconds,
                delaySeconds: challenge.delaySeconds,
                createdAt: challenge.createdAt,
                isIncoming: true,
            },
        });

        return challenge;
    }

    async acceptChallenge(userId: string, challengeId: string) {
        const challenge = await ChallengesRepoImpl.findById(challengeId);
        if (!challenge) {
            throw new AppError({ statusCode: 404, message: "Challenge not found" });
        }

        if (challenge.opponentId !== userId) {
            throw new AppError({ statusCode: 403, message: "Not authorized" });
        }

        if (challenge.status !== "pending") {
            throw new AppError({ statusCode: 400, message: "Challenge not pending" });
        }

        await ChallengesRepoImpl.acceptChallenge(challengeId);

        const game = await GamesServiceImpl.createGame({
            rated: challenge.rated,
            timeClass: challenge.timeClass,
            initialSeconds: challenge.initialSeconds,
            incrementSeconds: challenge.incrementSeconds,
            delaySeconds: challenge.delaySeconds,
            whiteUserId: challenge.challengerId,
            blackUserId: challenge.opponentId,
            challengeId: challenge.id,
        });

        const acceptedPayload = {
            challengeId: challenge.id,
            gameId: game.id,
        };

        // Notify both players — previously only the challenger was emitted to, so they often
        // never navigated (socket timing / reconnect). Opponent already redirects via HTTP from accept().
        emitUserRoom(challenge.challengerId, "challengeAccepted", acceptedPayload);
        emitUserRoom(challenge.opponentId, "challengeAccepted", acceptedPayload);

        return { game, challenge };
    }

    async declineChallenge(userId: string, challengeId: string) {
        const challenge = await ChallengesRepoImpl.findById(challengeId);
        if (!challenge) {
            throw new AppError({ statusCode: 404, message: "Challenge not found" });
        }

        if (challenge.opponentId !== userId && challenge.challengerId !== userId) {
            throw new AppError({ statusCode: 403, message: "Not authorized" });
        }

        if (challenge.status !== "pending") {
            throw new AppError({ statusCode: 400, message: "Challenge not pending" });
        }

        await ChallengesRepoImpl.declineChallenge(challengeId);

        const otherUserId =
            challenge.challengerId === userId ? challenge.opponentId : challenge.challengerId;
        emitUserRoom(otherUserId, "challengeDeclined", { challengeId });

        return { success: true };
    }

    async withdrawChallenge(userId: string, challengeId: string) {
        const challenge = await ChallengesRepoImpl.findById(challengeId);
        if (!challenge) {
            throw new AppError({ statusCode: 404, message: "Challenge not found" });
        }

        if (challenge.challengerId !== userId) {
            throw new AppError({ statusCode: 403, message: "Not authorized" });
        }

        await ChallengesRepoImpl.withdrawChallenge(challengeId);

        emitUserRoom(challenge.opponentId, "challengeWithdrawn", { challengeId });

        return { success: true };
    }

    async getPendingChallenges(userId: string) {
        const challenges = await ChallengesRepoImpl.getPendingForUser(userId);

        const enriched = await Promise.all(
            challenges.map(async (c) => {
                const [challengerUser, opponentUser] = await Promise.all([
                    UsersRepoImpl.findById(c.challengerId),
                    UsersRepoImpl.findById(c.opponentId),
                ]);
                return {
                    id: c.id,
                    challengerId: c.challengerId,
                    opponentId: c.opponentId,
                    challengerUsername: challengerUser?.username ?? null,
                    opponentUsername: opponentUser?.username ?? null,
                    rated: c.rated,
                    timeClass: c.timeClass,
                    initialSeconds: c.initialSeconds,
                    incrementSeconds: c.incrementSeconds,
                    delaySeconds: c.delaySeconds,
                    createdAt: c.createdAt,
                    isIncoming: c.opponentId === userId,
                };
            })
        );

        return enriched;
    }
}

export const MatchmakingServiceImpl = new MatchmakingService();
