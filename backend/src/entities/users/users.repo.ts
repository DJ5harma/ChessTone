import { db } from "../../db/client.ts";
import { users, userRatings, userPresence } from "../../db/schema.ts";
import { eq, inArray } from "drizzle-orm";
import type { User, UserRating, UserPresence } from "../../db/schema.ts";

export class UsersRepo {
    async findById(userId: string) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        return user || null;
    }

    async findByIds(ids: string[]): Promise<User[]> {
        const uniq = [...new Set(ids)].filter(Boolean);
        if (uniq.length === 0) {
            return [];
        }
        return db.select().from(users).where(inArray(users.id, uniq));
    }

    async findByUsername(username: string) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username.toLowerCase()))
            .limit(1);
        return user || null;
    }

    async findRatingsByUserId(userId: string) {
        return db
            .select()
            .from(userRatings)
            .where(eq(userRatings.userId, userId));
    }

    async findPresenceByUserId(userId: string) {
        const [presence] = await db
            .select()
            .from(userPresence)
            .where(eq(userPresence.userId, userId))
            .limit(1);
        return presence || null;
    }

    async updateProfile(
        userId: string,
        data: { displayName?: string; countryCode?: string }
    ) {
        const [updated] = await db
            .update(users)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning();
        return updated;
    }
}

export const UsersRepoImpl = new UsersRepo();