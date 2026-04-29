import { Response, NextFunction } from "express";
import { MatchmakingServiceImpl } from "./matchmaking.service.ts";
import type { AuthRequest } from "../auth/auth.middleware.ts";
import type { TimeClass_I } from "../../shared/types/index.ts";

export class MatchmakingController {
    async joinQueue(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { rated, timeClass, initialSeconds, incrementSeconds, delaySeconds } = req.body;
            const result = await MatchmakingServiceImpl.joinQueue(req.user!.userId, {
                rated,
                timeClass: timeClass as TimeClass_I,
                initialSeconds,
                incrementSeconds,
                delaySeconds: delaySeconds || 0,
            });
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async leaveQueue(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const result = await MatchmakingServiceImpl.leaveQueue(req.user!.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async getQueueStatus(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const status = await MatchmakingServiceImpl.getQueueStatus(req.user!.userId);
            res.json(status);
        } catch (err) {
            next(err);
        }
    }

    async createChallenge(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { opponentId, rated, timeClass, initialSeconds, incrementSeconds, delaySeconds } =
                req.body;
            const challenge = await MatchmakingServiceImpl.createChallenge(
                req.user!.userId,
                opponentId as string,
                {
                    rated,
                    timeClass: timeClass as TimeClass_I,
                    initialSeconds,
                    incrementSeconds,
                    delaySeconds: delaySeconds || 0,
                }
            );
            res.status(201).json(challenge);
        } catch (err) {
            next(err);
        }
    }

    async acceptChallenge(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const challengeId = req.params.challengeId as string;
            const result = await MatchmakingServiceImpl.acceptChallenge(req.user!.userId, challengeId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async declineChallenge(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const challengeId = req.params.challengeId as string;
            const result = await MatchmakingServiceImpl.declineChallenge(req.user!.userId, challengeId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async withdrawChallenge(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const challengeId = req.params.challengeId as string;
            const result = await MatchmakingServiceImpl.withdrawChallenge(req.user!.userId, challengeId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async getPendingChallenges(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const challenges = await MatchmakingServiceImpl.getPendingChallenges(req.user!.userId);
            res.json(challenges);
        } catch (err) {
            next(err);
        }
    }
}

export const MatchmakingControllerImpl = new MatchmakingController();
