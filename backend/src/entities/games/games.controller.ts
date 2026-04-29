import { Response, NextFunction } from "express";
import { GamesServiceImpl } from "./games.service.ts";
import type { AuthRequest } from "../auth/auth.middleware.ts";
import type { TimeClass_I } from "../../shared/types/index.ts";

export class GamesController {
    async createComputerGame(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { playAs, timeClass, initialSeconds, incrementSeconds, delaySeconds } = req.body;

            const game = await GamesServiceImpl.createComputerGame(req.user!.userId, {
                playAs: playAs as "white" | "black",
                timeClass: timeClass as TimeClass_I,
                initialSeconds: Number(initialSeconds),
                incrementSeconds: Number(incrementSeconds),
                delaySeconds: Number(delaySeconds ?? 0),
            });

            res.status(201).json(game);
        } catch (err) {
            next(err);
        }
    }

    async createGame(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { rated, timeClass, initialSeconds, incrementSeconds, delaySeconds, whiteUserId, blackUserId } = req.body;

            const game = await GamesServiceImpl.createGame({
                rated,
                timeClass: timeClass as TimeClass_I,
                initialSeconds,
                incrementSeconds,
                delaySeconds,
                whiteUserId,
                blackUserId,
            });

            res.status(201).json(game);
        } catch (err) {
            next(err);
        }
    }

    async getGame(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const gameId = req.params.gameId as string;
            const game = await GamesServiceImpl.getGame(gameId, req.user!.userId);
            res.json(game);
        } catch (err) {
            next(err);
        }
    }

    async makeMove(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const gameId = req.params.gameId as string;
            const { uci, whiteClockMs, blackClockMs } = req.body;

            const result = await GamesServiceImpl.makeMove(
                gameId,
                req.user!.userId,
                uci as string,
                whiteClockMs as number,
                blackClockMs as number
            );

            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async resign(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const gameId = req.params.gameId as string;
            const result = await GamesServiceImpl.resign(gameId, req.user!.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async claimTimeout(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const gameId = req.params.gameId as string;
            const { whiteClockMs, blackClockMs } = req.body as {
                whiteClockMs?: number;
                blackClockMs?: number;
            };
            const result = await GamesServiceImpl.claimTimeout(
                gameId,
                req.user!.userId,
                Number(whiteClockMs ?? 0),
                Number(blackClockMs ?? 0)
            );
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async offerDraw(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const gameId = req.params.gameId as string;
            const result = await GamesServiceImpl.offerDraw(gameId, req.user!.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async acceptDraw(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const gameId = req.params.gameId as string;
            const result = await GamesServiceImpl.acceptDraw(gameId, req.user!.userId);
            res.json(result);
        } catch (err) {
            next(err);
        }
    }

    async getHistory(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
            const history = await GamesServiceImpl.getGameHistory(req.user!.userId, limit, offset);
            res.json(history);
        } catch (err) {
            next(err);
        }
    }
}

export const GamesControllerImpl = new GamesController();