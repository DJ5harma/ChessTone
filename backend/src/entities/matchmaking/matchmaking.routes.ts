import { Router } from "express";
import { MatchmakingControllerImpl } from "./matchmaking.controller.ts";
import { authenticate } from "../auth/auth.middleware.ts";

const matchmakingRouter = Router();

matchmakingRouter.post("/queue/join", authenticate, MatchmakingControllerImpl.joinQueue);
matchmakingRouter.post("/queue/leave", authenticate, MatchmakingControllerImpl.leaveQueue);
matchmakingRouter.get("/queue/status", authenticate, MatchmakingControllerImpl.getQueueStatus);

matchmakingRouter.post("/challenge", authenticate, MatchmakingControllerImpl.createChallenge);
matchmakingRouter.get("/challenge", authenticate, MatchmakingControllerImpl.getPendingChallenges);
matchmakingRouter.post("/challenge/:challengeId/accept", authenticate, MatchmakingControllerImpl.acceptChallenge);
matchmakingRouter.post("/challenge/:challengeId/decline", authenticate, MatchmakingControllerImpl.declineChallenge);
matchmakingRouter.post("/challenge/:challengeId/withdraw", authenticate, MatchmakingControllerImpl.withdrawChallenge);

export { matchmakingRouter };
