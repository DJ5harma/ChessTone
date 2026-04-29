import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRepoImpl } from "./auth.repo.ts";
import { AppError } from "../../shared/errors/AppError.ts";
import { ENV } from "../../ENV.ts";
import type { AuthPayload_I } from "../../shared/types/index.ts";

const JWT_SECRET = ENV.JWT_SECRET as string;

export class AuthService {
    async register(username: string, password: string) {
        const existing = await AuthRepoImpl.findByUsername(username);
        if (existing) {
            throw new AppError({ statusCode: 409, message: "Username already taken" });
        }

        if (password.length < 6) {
            throw new AppError({
                statusCode: 400,
                message: "Password must be at least 6 characters",
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const { userId } = await AuthRepoImpl.createUser({
            username,
            passwordHash,
        });

        const token = this.generateToken({ userId, username });
        return { token, userId };
    }

    async login(username: string, password: string) {
        const user = await AuthRepoImpl.findByUsername(username);
        if (!user) {
            throw new AppError({ statusCode: 401, message: "Invalid credentials" });
        }

        const cred = await AuthRepoImpl.findCredentialsByUserId(user.id);
        if (!cred) {
            throw new AppError({ statusCode: 401, message: "Invalid credentials" });
        }

        const isValid = await bcrypt.compare(password, cred.passwordHash);
        if (!isValid) {
            throw new AppError({ statusCode: 401, message: "Invalid credentials" });
        }

        const token = this.generateToken({ userId: user.id, username: user.username });
        return { token, userId: user.id, username: user.username };
    }

    verifyToken(token: string): AuthPayload_I {
        try {
            return jwt.verify(token, JWT_SECRET) as AuthPayload_I;
        } catch {
            throw new AppError({ statusCode: 401, message: "Invalid token" });
        }
    }

    private generateToken(payload: AuthPayload_I): string {
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: "7d",
        });
    }
}

export const AuthServiceImpl = new AuthService();