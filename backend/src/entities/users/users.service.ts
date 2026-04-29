import { db } from "../../db/client.ts";
import { users } from "../../db/schema.ts";
import { ilike } from "drizzle-orm";
import { UsersRepoImpl } from "./users.repo.ts";
import { AppError } from "../../shared/errors/AppError.ts";

export class UsersService {
    async getProfile(userId: string) {
        const user = await UsersRepoImpl.findById(userId);
        if (!user) {
            throw new AppError({ statusCode: 404, message: "User not found" });
        }

        const ratings = await UsersRepoImpl.findRatingsByUserId(userId);
        const presence = await UsersRepoImpl.findPresenceByUserId(userId);

        return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            countryCode: user.countryCode,
            createdAt: user.createdAt,
            ratings: ratings.map((r) => ({
                timeClass: r.timeClass,
                rating: r.rating,
                gamesPlayed: r.gamesPlayed,
                wins: r.wins,
                losses: r.losses,
                draws: r.draws,
                peakRating: r.peakRating,
            })),
            isOnline: presence?.isOnline || false,
        };
    }

    async getProfileByUsername(username: string) {
        const user = await UsersRepoImpl.findByUsername(username);
        if (!user) {
            throw new AppError({ statusCode: 404, message: "User not found" });
        }

        const ratings = await UsersRepoImpl.findRatingsByUserId(user.id);
        const presence = await UsersRepoImpl.findPresenceByUserId(user.id);

        return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            countryCode: user.countryCode,
            createdAt: user.createdAt,
            ratings: ratings.map((r) => ({
                timeClass: r.timeClass,
                rating: r.rating,
                gamesPlayed: r.gamesPlayed,
                wins: r.wins,
                losses: r.losses,
                draws: r.draws,
                peakRating: r.peakRating,
            })),
            isOnline: presence?.isOnline || false,
        };
    }

    async updateProfile(userId: string, data: { displayName?: string }) {
        const user = await UsersRepoImpl.updateProfile(userId, data);
        if (!user) {
            throw new AppError({ statusCode: 404, message: "User not found" });
        }
        return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
        };
    }

    async searchUsers(query: string, limit = 10) {
        const q = query.trim();
        if (!q) {
            return [];
        }
        const results = await db
            .select({
                id: users.id,
                username: users.username,
                displayName: users.displayName,
            })
            .from(users)
            .where(ilike(users.username, `%${q}%`))
            .limit(limit);
        return results;
    }
}

export const UsersServiceImpl = new UsersService();