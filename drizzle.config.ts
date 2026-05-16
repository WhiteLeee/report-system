import { defineConfig } from "drizzle-kit";

import { getReportSystemConfig } from "./backend/config/report-system-config";

const config = getReportSystemConfig();

export default defineConfig({
  schema: "./backend/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  migrations: {
    table: config.dbMigrationsTable,
    schema: config.dbMigrationsSchema
  },
  dbCredentials: {
    url: config.dbUrl
  }
});
