import { RatingsRepoImpl } from "./ratings.repo.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import type { TimeClass_I } from "../../shared/types/index.ts";
import type { UserRating } from "../../db/schema.ts";

const K_FACTOR = 32;

function calculateNewRating(
    currentRating: number,
    opponentRating: number,
    result: "win" | "loss" | "draw"
): number {
    const expectedScore =
        1 / (1 + Math.pow(10, (opponentRating - currentRating) / 400));

    let actualScore: number;
    switch (result) {
        case "win":
            actualScore = 1;
            break;
        case "loss":
            actualScore = 0;
            break;
        case "draw":
            actualScore = 0.5;
            break;
    }

    return Math.round(currentRating + K_FACTOR * (actualScore - expectedScore));
}

export class RatingsService {
    async getUserRating(userId: string, timeClass: TimeClass_I) {
        const rating = await RatingsRepoImpl.getUserRating(userId, timeClass);
        if (!rating) {
            throw new AppError({ statusCode: 404, message: "Rating not found" });
        }
        return rating;
    }

    /** Used when creating games — registration normally seeds all time classes. */
    async getUserRatingOrDefault(userId: string, timeClass: TimeClass_I): Promise<UserRating> {
        const row = await RatingsRepoImpl.getUserRating(userId, timeClass);
        if (row) {
            return row;
        }
        return {
            userId,
            timeClass,
            rating: 1200,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            peakRating: 1200,
            updatedAt: new Date(),
        };
    }

    async getRatingHistory(userId: string, limit?: number) {
        return RatingsRepoImpl.getRatingHistory(userId, limit);
    }

    async getLeaderboard(timeClass: TimeClass_I, limit?: number) {
        return RatingsRepoImpl.getLeaderboard(timeClass, limit);
    }

    async updateRatingAfterGame(
        whiteUserId: string,
        blackUserId: string,
        timeClass: TimeClass_I,
        gameId: string,
        result: "white_win" | "black_win" | "draw"
    ) {
        const whiteRating = await RatingsRepoImpl.getUserRating(whiteUserId, timeClass);
        const blackRating = await RatingsRepoImpl.getUserRating(blackUserId, timeClass);

        if (!whiteRating || !blackRating) {
            throw new AppError({ statusCode: 400, message: "Player rating not found" });
        }

        let whiteResult: "win" | "loss" | "draw";
        let blackResult: "win" | "loss" | "draw";

        switch (result) {
            case "white_win":
                whiteResult = "win";
                blackResult = "loss";
                break;
            case "black_win":
                whiteResult = "loss";
                blackResult = "win";
                break;
            case "draw":
                whiteResult = "draw";
                blackResult = "draw";
                break;
        }

        const newWhiteRating = calculateNewRating(
            whiteRating.rating,
            blackRating.rating,
            whiteResult
        );
        const newBlackRating = calculateNewRating(
            blackRating.rating,
            whiteRating.rating,
            blackResult
        );

        const whiteDelta = newWhiteRating - whiteRating.rating;
        const blackDelta = newBlackRating - blackRating.rating;

        await Promise.all([
            RatingsRepoImpl.updateRating(whiteUserId, timeClass, newWhiteRating, whiteResult),
            RatingsRepoImpl.updateRating(blackUserId, timeClass, newBlackRating, blackResult),
            RatingsRepoImpl.addRatingLedgerEntry({
                userId: whiteUserId,
                gameId,
                timeClass,
                ratingBefore: whiteRating.rating,
                ratingAfter: newWhiteRating,
                ratingDelta: whiteDelta,
            }),
            RatingsRepoImpl.addRatingLedgerEntry({
                userId: blackUserId,
                gameId,
                timeClass,
                ratingBefore: blackRating.rating,
                ratingAfter: newBlackRating,
                ratingDelta: blackDelta,
            }),
        ]);

        return {
            white: { ratingAfter: newWhiteRating, ratingDelta: whiteDelta },
            black: { ratingAfter: newBlackRating, ratingDelta: blackDelta },
        };
    }
}

export const RatingsServiceImpl = new RatingsService();