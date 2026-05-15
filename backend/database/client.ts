import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getReportSystemConfig } from "@/backend/config/report-system-config";
import * as schema from "@/backend/database/schema";

const config = getReportSystemConfig();

export const pool = new Pool({
  connectionString: config.dbUrl,
  max: Number.parseInt(process.env.REPORT_SYSTEM_DB_POOL_MAX || "20", 10) || 20,
  idleTimeoutMillis: Number.parseInt(process.env.REPORT_SYSTEM_DB_IDLE_TIMEOUT_MS || "30000", 10) || 30000
});

export const db = drizzle(pool, { schema });
export const dbUrl = config.dbUrl;

export async function closeDatabasePool(): Promise<any> {
  await pool.end();
}
