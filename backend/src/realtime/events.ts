import { getSocketServer } from "./io.ts";

export function emitGameRoom(gameId: string, event: string, payload: unknown) {
    const io = getSocketServer();
    io?.to(`game:${gameId}`).emit(event, payload);
}

export function emitUserRoom(userId: string, event: string, payload: unknown) {
    const io = getSocketServer();
    io?.to(`user:${userId}`).emit(event, payload);
}
