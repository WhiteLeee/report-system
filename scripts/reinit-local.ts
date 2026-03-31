import path from "node:path";
import { spawnSync } from "node:child_process";

import { getReportSystemConfig } from "../backend/config/report-system-config";

type ReinitOptions = {
  tenantId: string;
  tenantName: string;
  brandName: string;
  baseUrl: string;
  logoUrl: string;
  primaryColor: string;
  primaryColorStrong: string;
  defaultTimezone: string;
  dataDir: string;
  dbPath: string;
  envPath: string;
  configPath: string;
  adminUsername: string;
  adminPassword: string;
  adminDisplayName: string;
  supportedPayloadVersions: string;
  dryRun: boolean;
};

function readArg(flag: string): string {
  const index = process.argv.indexOf(flag);
  if (index < 0) return "";
  return String(process.argv[index + 1] || "").trim();
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function buildOptions(): ReinitOptions {
  const currentConfig = getReportSystemConfig();
  return {
    tenantId: readArg("--tenant-id") || currentConfig.tenantId,
    tenantName: readArg("--tenant-name") || currentConfig.tenantName,
    brandName: readArg("--brand-name") || currentConfig.brandName,
    baseUrl: readArg("--base-url") || currentConfig.baseUrl,
    logoUrl: readArg("--logo-url") || currentConfig.logoUrl,
    primaryColor: readArg("--primary-color") || currentConfig.primaryColor,
    primaryColorStrong: readArg("--primary-color-strong") || currentConfig.primaryColorStrong,
    defaultTimezone: readArg("--default-timezone") || currentConfig.defaultTimezone,
    dataDir: readArg("--data-dir") || currentConfig.dataDir,
    dbPath: readArg("--db-path") || currentConfig.dbPath,
    envPath: readArg("--env-path") || path.resolve(process.cwd(), ".env.local"),
    configPath: readArg("--config-path") || currentConfig.tenantConfigPath,
    adminUsername: readArg("--admin-username") || currentConfig.adminUsername,
    adminPassword: readArg("--admin-password") || currentConfig.adminPassword,
    adminDisplayName: readArg("--admin-display-name") || currentConfig.adminDisplayName,
    supportedPayloadVersions:
      readArg("--supported-payload-versions") || currentConfig.supportedPayloadVersions.join(","),
    dryRun: hasFlag("--dry-run")
  };
}

function main(): void {
  const options = buildOptions();
  const args = [
    "run",
    "tenant:init",
    "--",
    "--tenant-id",
    options.tenantId,
    "--tenant-name",
    options.tenantName,
    "--brand-name",
    options.brandName,
    "--base-url",
    options.baseUrl,
    "--logo-url",
    options.logoUrl,
    "--primary-color",
    options.primaryColor,
    "--primary-color-strong",
    options.primaryColorStrong,
    "--default-timezone",
    options.defaultTimezone,
    "--data-dir",
    options.dataDir,
    "--db-path",
    options.dbPath,
    "--env-path",
    options.envPath,
    "--config-path",
    options.configPath,
    "--admin-username",
    options.adminUsername,
    "--admin-password",
    options.adminPassword,
    "--admin-display-name",
    options.adminDisplayName,
    "--supported-payload-versions",
    options.supportedPayloadVersions,
    "--force",
    "--reset-db"
  ];

  if (options.dryRun) {
    args.push("--dry-run");
  }

  const result = spawnSync("npm", args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main();
