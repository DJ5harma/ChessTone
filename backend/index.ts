import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";
import { errorHandler } from "./src/shared/middleware/error-handler.ts";
import { notFoundHandler } from "./src/shared/middleware/not-found.ts";
import { ENV } from "./src/ENV.ts";
import { authRouter } from "./src/entities/auth/auth.routes.ts";
import { usersRouter } from "./src/entities/users/users.routes.ts";
import { gamesRouter } from "./src/entities/games/games.routes.ts";
import { ratingsRouter } from "./src/entities/ratings/ratings.routes.ts";
import { matchmakingRouter } from "./src/entities/matchmaking/matchmaking.routes.ts";
import { setSocketServer } from "./src/realtime/io.ts";
import { registerSocketHandlers } from "./src/realtime/registerSocket.ts";

export const app = express();
export const httpServer = createServer(app);

export const io = new Server(httpServer, {
    cors: {
        origin: ENV.CORS_ORIGIN,
        credentials: true,
    },
});

setSocketServer(io);
registerSocketHandlers(io);

app.use(cors({ origin: ENV.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

const apiRouter = express.Router();
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/games", gamesRouter);
apiRouter.use("/ratings", ratingsRouter);
apiRouter.use("/matchmaking", matchmakingRouter);

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

if (import.meta.main) {
    httpServer.listen(ENV.PORT, () => {
        console.log(`Server running on port ${ENV.PORT}`);
    });
}
