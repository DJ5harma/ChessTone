import { io, type Socket } from "socket.io-client";

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

let socket: Socket | null = null;

function getToken(): string | null {
    if (typeof window === "undefined") {
        return null;
    }
    return localStorage.getItem("token");
}

export function getSocket(): Socket {
    if (!socket) {
        socket = io(apiOrigin, {
            autoConnect: false,
            transports: ["websocket", "polling"],
            withCredentials: true,
        });
    }
    const token = getToken();
    socket.auth = { token };
    return socket;
}

export function connectSocket() {
    const s = getSocket();
    if (!s.connected) {
        s.connect();
    }
}

export function disconnectSocket() {
    if (socket?.connected) {
        socket.disconnect();
    }
}

export function joinGameRoom(gameId: string) {
    getSocket().emit("joinGame", gameId);
}

export function leaveGameRoom(gameId: string) {
    getSocket().emit("leaveGame", gameId);
}

export function onMatchFound(cb: (payload: { gameId: string }) => void) {
    const s = getSocket();
    s.on("matchFound", cb);
    return () => {
        s.off("matchFound", cb);
    };
}

export default getSocket;
