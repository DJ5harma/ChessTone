import { db } from "../../db/client.ts";
import { matchmakingQueue, gameChallenges } from "../../db/schema.ts";
import { eq, and, desc, sql, or, not } from "drizzle-orm";
import type { TimeClass_I } from "../../shared/types/index.ts";
import type { MatchmakingQueueEntry, GameChallenge } from "../../db/schema.ts";

export class MatchmakingRepo {
    async joinQueue(data: {
        userId: string;
        rated: boolean;
        timeClass: TimeClass_I;
        initialSeconds: number;
        incrementSeconds: number;
        delaySeconds: number;
    }): Promise<MatchmakingQueueEntry> {
        const existing = await this.findByUserId(data.userId);
        if (existing) {
            throw new Error("User already in queue");
        }

        const [entry] = await db.insert(matchmakingQueue).values({
            userId: data.userId,
            rated: data.rated,
            timeClass: data.timeClass,
            initialSeconds: data.initialSeconds,
            incrementSeconds: data.incrementSeconds,
            delaySeconds: data.delaySeconds,
        }).returning();

        if (!entry) {
            throw new Error("Failed to join queue");
        }

        return entry;
    }

    async leaveQueue(userId: string) {
        await db.delete(matchmakingQueue).where(eq(matchmakingQueue.userId, userId));
    }

    async findByUserId(userId: string) {
        const [entry] = await db
            .select()
            .from(matchmakingQueue)
            .where(eq(matchmakingQueue.userId, userId))
            .limit(1);
        return entry || null;
    }

    async findMatch(params: {
        userId: string;
        rated: boolean;
        timeClass: TimeClass_I;
        initialSeconds: number;
        incrementSeconds: number;
    }) {
        const potentials = await db
            .select()
            .from(matchmakingQueue)
            .where(
                and(
                    not(eq(matchmakingQueue.userId, params.userId)),
                    eq(matchmakingQueue.rated, params.rated),
                    eq(matchmakingQueue.timeClass, params.timeClass),
                    eq(matchmakingQueue.initialSeconds, params.initialSeconds),
                    eq(matchmakingQueue.incrementSeconds, params.incrementSeconds)
                )
            )
            .limit(1);

        return potentials[0] || null;
    }

    async removeFromQueue(userId: string) {
        await db.delete(matchmakingQueue).where(eq(matchmakingQueue.userId, userId));
    }

    async getQueueCount(params: {
        rated: boolean;
        timeClass: TimeClass_I;
        initialSeconds: number;
        incrementSeconds: number;
    }) {
        const count = await db
            .select({ count: sql<number>`count(*)` })
            .from(matchmakingQueue)
            .where(
                and(
                    eq(matchmakingQueue.rated, params.rated),
                    eq(matchmakingQueue.timeClass, params.timeClass),
                    eq(matchmakingQueue.initialSeconds, params.initialSeconds),
                    eq(matchmakingQueue.incrementSeconds, params.incrementSeconds)
                )
            );
        return count[0]?.count || 0;
    }
}

export const MatchmakingRepoImpl = new MatchmakingRepo();

export class ChallengesRepo {
    async createChallenge(data: {
        challengerId: string;
        opponentId: string;
        rated: boolean;
        timeClass: TimeClass_I;
        initialSeconds: number;
        incrementSeconds: number;
        delaySeconds: number;
    }): Promise<GameChallenge> {
        const [challenge] = await db.insert(gameChallenges).values(data).returning();
        if (!challenge) {
            throw new Error("Failed to create challenge");
        }
        return challenge;
    }

    async findById(id: string) {
        const [challenge] = await db
            .select()
            .from(gameChallenges)
            .where(eq(gameChallenges.id, id))
            .limit(1);
        return challenge || null;
    }

    async acceptChallenge(challengeId: string) {
        const [challenge] = await db
            .update(gameChallenges)
            .set({
                status: "accepted",
                respondedAt: new Date(),
            })
            .where(
                and(
                    eq(gameChallenges.id, challengeId),
                    eq(gameChallenges.status, "pending")
                )
            )
            .returning();
        if (!challenge) {
            throw new Error("Challenge not found or already processed");
        }
        return challenge;
    }

    async declineChallenge(challengeId: string) {
        const [challenge] = await db
            .update(gameChallenges)
            .set({
                status: "declined",
                respondedAt: new Date(),
            })
            .where(
                and(
                    eq(gameChallenges.id, challengeId),
                    eq(gameChallenges.status, "pending")
                )
            )
            .returning();
        if (!challenge) {
            throw new Error("Challenge not found or already processed");
        }
        return challenge;
    }

    async withdrawChallenge(challengeId: string) {
        await db
            .update(gameChallenges)
            .set({
                status: "withdrawn",
                cancelledAt: new Date(),
            })
            .where(eq(gameChallenges.id, challengeId));
    }

    async getPendingForUser(userId: string) {
        return db
            .select()
            .from(gameChallenges)
            .where(
                and(
                    or(
                        eq(gameChallenges.challengerId, userId),
                        eq(gameChallenges.opponentId, userId)
                    ),
                    eq(gameChallenges.status, "pending")
                )
            )
            .orderBy(desc(gameChallenges.createdAt));
    }
}

export const ChallengesRepoImpl = new ChallengesRepo();
