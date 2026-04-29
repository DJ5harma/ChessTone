import { Response, NextFunction } from "express";
import { AuthServiceImpl } from "./auth.service.ts";
import type { AuthRequest } from "./auth.middleware.ts";

export class AuthController {
    async register(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { username, password } = req.body;
            const result = await AuthServiceImpl.register(username, password);
            res.cookie("token", result.token, {
                httpOnly: true,
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            res.status(201).json({
                token: result.token,
                userId: result.userId,
            });
        } catch (err) {
            next(err);
        }
    }

    async login(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { username, password } = req.body;
            const result = await AuthServiceImpl.login(username, password);
            res.cookie("token", result.token, {
                httpOnly: true,
                sameSite: "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            res.json({
                token: result.token,
                userId: result.userId,
                username: result.username,
            });
        } catch (err) {
            next(err);
        }
    }

    async me(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            res.json({
                userId: req.user?.userId,
                username: req.user?.username,
            });
        } catch (err) {
            next(err);
        }
    }
}

export const AuthControllerImpl = new AuthController();