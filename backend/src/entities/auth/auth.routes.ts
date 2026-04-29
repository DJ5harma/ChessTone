import { Router } from "express";
import { AuthControllerImpl } from "./auth.controller.ts";
import { authenticate } from "./auth.middleware.ts";

const authRouter = Router();

authRouter.post("/register", AuthControllerImpl.register);
authRouter.post("/login", AuthControllerImpl.login);
authRouter.get("/me", authenticate, AuthControllerImpl.me);

export { authRouter };