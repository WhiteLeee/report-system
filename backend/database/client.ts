import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { getReportSystemConfig } from "@/backend/config/report-system-config";
import * as schema from "@/backend/database/schema";

const config = getReportSystemConfig();
const dataDir = config.dataDir;
const dbPath = config.dbPath;

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite, dbPath };
