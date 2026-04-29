import { Router } from "express";
import { UsersControllerImpl } from "./users.controller.ts";
import { authenticate } from "../auth/auth.middleware.ts";

const usersRouter = Router();

usersRouter.get("/me", authenticate, UsersControllerImpl.getMyProfile);
usersRouter.patch("/me", authenticate, UsersControllerImpl.updateProfile);
usersRouter.get("/", authenticate, UsersControllerImpl.searchUsers);
usersRouter.get("/:username", authenticate, UsersControllerImpl.getProfileByUsername);

export { usersRouter };