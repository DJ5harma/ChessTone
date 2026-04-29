import { Response, NextFunction } from "express";
import { RatingsServiceImpl } from "./ratings.service.ts";
import type { TimeClass_I } from "../../shared/types/index.ts";
import type { AuthRequest } from "../auth/auth.middleware.ts";

export class RatingsController {
    async getUserRating(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.params.userId as string;
            const timeClass = req.query.timeClass as TimeClass_I;
            const rating = await RatingsServiceImpl.getUserRating(userId, timeClass);
            res.json(rating);
        } catch (err) {
            next(err);
        }
    }

    async getRatingHistory(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.params.userId as string;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
            const history = await RatingsServiceImpl.getRatingHistory(userId, limit);
            res.json(history);
        } catch (err) {
            next(err);
        }
    }

    async getLeaderboard(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const timeClass = req.query.timeClass as TimeClass_I;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
            const leaderboard = await RatingsServiceImpl.getLeaderboard(timeClass, limit);
            res.json(leaderboard);
        } catch (err) {
            next(err);
        }
    }
}

export const RatingsControllerImpl = new RatingsController();