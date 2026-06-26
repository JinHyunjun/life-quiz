import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../../src/db/schema";

export function createDb(db: D1Database) {
  return drizzle(db, { schema });
}

export type AppDb = ReturnType<typeof createDb>;
export { schema };
