import "express";
import type { AuthPayload_I } from "../../shared/types/index.ts";

declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload_I;
            cookies?: Record<string, string>;
        }
    }
}

export {};