import { spawnSync } from "node:child_process";
import { Client } from "pg";

import { getReportSystemConfig } from "../backend/config/report-system-config";

async function resetSchema(dbUrl: string): Promise<void> {
  const { dbMigrationsSchema } = getReportSystemConfig();
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query("drop schema if exists public cascade");
    if (dbMigrationsSchema !== "public") {
      await client.query(`drop schema if exists "${dbMigrationsSchema}" cascade`);
    }
    await client.query("create schema public");
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const { dbUrl } = getReportSystemConfig();
  await resetSchema(dbUrl);

  const result = spawnSync("npm", ["run", "db:migrate"], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log("Local PostgreSQL schema reset completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
