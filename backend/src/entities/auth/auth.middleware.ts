import { Request, Response, NextFunction } from "express";
import { AuthServiceImpl } from "./auth.service.ts";
import { AppError } from "../../shared/errors/AppError.ts";

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        username: string;
    };
}

export const authenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        const token =
            req.cookies?.token ||
            (authHeader && authHeader.startsWith("Bearer ")
                ? authHeader.slice(7)
                : null);

        if (!token) {
            throw new AppError({ statusCode: 401, message: "Not authenticated" });
        }

        const payload = AuthServiceImpl.verifyToken(token);
        req.user = { userId: payload.userId, username: payload.username };
        next();
    } catch (err) {
        next(err);
    }
};