import type { Server } from "socket.io";
import type { Socket } from "socket.io";
import { AuthServiceImpl } from "../entities/auth/auth.service.ts";

export function registerSocketHandlers(io: Server) {
    io.use((socket: Socket, next) => {
        try {
            const token =
                (socket.handshake.auth?.token as string | undefined) ||
                (socket.handshake.query?.token as string | undefined);
            if (!token || typeof token !== "string") {
                next(new Error("Unauthorized"));
                return;
            }
            const payload = AuthServiceImpl.verifyToken(token);
            socket.data.userId = payload.userId as string;
            socket.data.username = payload.username as string;
            next();
        } catch {
            next(new Error("Unauthorized"));
        }
    });

    io.on("connection", (socket: Socket) => {
        const userId = socket.data.userId as string;
        socket.join(`user:${userId}`);

        socket.on("joinGame", (gameId: string) => {
            if (typeof gameId !== "string" || !gameId) {
                return;
            }
            socket.join(`game:${gameId}`);
        });

        socket.on("leaveGame", (gameId: string) => {
            if (typeof gameId !== "string" || !gameId) {
                return;
            }
            socket.leave(`game:${gameId}`);
        });
    });
}
