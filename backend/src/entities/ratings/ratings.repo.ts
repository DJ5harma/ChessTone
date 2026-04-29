import { db } from "../../db/client.ts";
import { userRatings, ratingLedger, users } from "../../db/schema.ts";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import type { TimeClass_I } from "../../shared/types/index.ts";

export class RatingsRepo {
    async getUserRating(userId: string, timeClass: TimeClass_I) {
        const [rating] = await db
            .select()
            .from(userRatings)
            .where(
                and(
                    eq(userRatings.userId, userId),
                    eq(userRatings.timeClass, timeClass)
                )
            )
            .limit(1);
        return rating || null;
    }

    async getRatingHistory(userId: string, limit = 20) {
        return db
            .select()
            .from(ratingLedger)
            .where(eq(ratingLedger.userId, userId))
            .orderBy(desc(ratingLedger.createdAt))
            .limit(limit);
    }

    async getLeaderboard(timeClass: TimeClass_I, limit = 100) {
        return db
            .select({
                userId: userRatings.userId,
                rating: userRatings.rating,
                gamesPlayed: userRatings.gamesPlayed,
                username: users.username,
            })
            .from(userRatings)
            .innerJoin(users, eq(users.id, userRatings.userId))
            .where(eq(userRatings.timeClass, timeClass))
            .orderBy(desc(userRatings.rating))
            .limit(limit);
    }

    async updateRating(
        userId: string,
        timeClass: TimeClass_I,
        newRating: number,
        result: "win" | "loss" | "draw"
    ) {
        const updateData: Record<string, unknown> = {
            rating: newRating,
            gamesPlayed: sql`${userRatings.gamesPlayed} + 1`,
            peakRating: sql`GREATEST(${userRatings.peakRating}, ${newRating})`,
            updatedAt: new Date(),
        };

        if (result === "win") {
            updateData.wins = sql`${userRatings.wins} + 1`;
        } else if (result === "loss") {
            updateData.losses = sql`${userRatings.losses} + 1`;
        } else if (result === "draw") {
            updateData.draws = sql`${userRatings.draws} + 1`;
        }

        const [updated] = await db
            .update(userRatings)
            .set(updateData)
            .where(
                and(
                    eq(userRatings.userId, userId),
                    eq(userRatings.timeClass, timeClass)
                )
            )
            .returning();

        if (!updated) {
            throw new Error("Failed to update rating");
        }
        return updated;
    }

    async addRatingLedgerEntry(data: {
        userId: string;
        gameId: string;
        timeClass: TimeClass_I;
        ratingBefore: number;
        ratingAfter: number;
        ratingDelta: number;
    }) {
        const [entry] = await db.insert(ratingLedger).values(data).returning();
        return entry;
    }
}

export const RatingsRepoImpl = new RatingsRepo();