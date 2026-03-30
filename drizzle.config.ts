import { defineConfig } from "drizzle-kit";

import { getReportSystemConfig } from "./backend/config/report-system-config";

const config = getReportSystemConfig();

export default defineConfig({
  schema: "./backend/database/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: config.dbPath
  }
});
