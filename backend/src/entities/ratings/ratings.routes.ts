import { Router } from "express";
import { RatingsControllerImpl } from "./ratings.controller.ts";
import { authenticate } from "../auth/auth.middleware.ts";

const ratingsRouter = Router();

ratingsRouter.get("/users/:userId", authenticate, RatingsControllerImpl.getUserRating);
ratingsRouter.get("/users/:userId/history", authenticate, RatingsControllerImpl.getRatingHistory);
ratingsRouter.get("/leaderboard", authenticate, RatingsControllerImpl.getLeaderboard);

export { ratingsRouter };