import { Response, NextFunction } from "express";
import { UsersServiceImpl } from "./users.service.ts";
import type { AuthRequest } from "../auth/auth.middleware.ts";

export class UsersController {
    async getMyProfile(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const profile = await UsersServiceImpl.getProfile(req.user!.userId);
            res.json(profile);
        } catch (err) {
            next(err);
        }
    }

    async getProfileByUsername(
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ) {
        try {
            const username = req.params.username as string;
            const profile = await UsersServiceImpl.getProfileByUsername(username);
            res.json(profile);
        } catch (err) {
            next(err);
        }
    }

    async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { displayName } = req.body;
            const profile = await UsersServiceImpl.updateProfile(
                req.user!.userId,
                { displayName }
            );
            res.json(profile);
        } catch (err) {
            next(err);
        }
    }

    async searchUsers(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const q = req.query.q as string | undefined;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
            const users = await UsersServiceImpl.searchUsers(q || "", limit);
            res.json(users);
        } catch (err) {
            next(err);
        }
    }
}

export const UsersControllerImpl = new UsersController();