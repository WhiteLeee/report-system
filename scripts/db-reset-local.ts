import fs from "node:fs";
import { spawnSync } from "node:child_process";

import { getReportSystemConfig } from "../backend/config/report-system-config";

const dataDir = getReportSystemConfig().dataDir;

fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

const result = spawnSync("npm", ["run", "db:migrate"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Local database reset completed.");
