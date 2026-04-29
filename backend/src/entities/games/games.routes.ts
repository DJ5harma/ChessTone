import { Router } from "express";
import { GamesControllerImpl } from "./games.controller.ts";
import { authenticate } from "../auth/auth.middleware.ts";

const gamesRouter = Router();

gamesRouter.post("/computer", authenticate, GamesControllerImpl.createComputerGame);
gamesRouter.post("/", authenticate, GamesControllerImpl.createGame);
gamesRouter.get("/history", authenticate, GamesControllerImpl.getHistory);
gamesRouter.get("/:gameId", authenticate, GamesControllerImpl.getGame);
gamesRouter.post("/:gameId/move", authenticate, GamesControllerImpl.makeMove);
gamesRouter.post("/:gameId/resign", authenticate, GamesControllerImpl.resign);
gamesRouter.post("/:gameId/draw/offer", authenticate, GamesControllerImpl.offerDraw);
gamesRouter.post("/:gameId/draw/accept", authenticate, GamesControllerImpl.acceptDraw);

export { gamesRouter };