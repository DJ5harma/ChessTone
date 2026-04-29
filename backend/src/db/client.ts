import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";
import { ENV } from "../ENV.ts";

const pool = new pg.Pool({
  connectionString: ENV.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
