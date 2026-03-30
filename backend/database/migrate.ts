import fs from "node:fs";
import path from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db } from "@/backend/database/client";

const migrationsFolder = path.join(process.cwd(), "drizzle");

if (!fs.existsSync(migrationsFolder)) {
  throw new Error("Migration folder not found. Run `npm run db:generate` or add migrations first.");
}

migrate(db, { migrationsFolder });

console.log("Database migrations completed.");
