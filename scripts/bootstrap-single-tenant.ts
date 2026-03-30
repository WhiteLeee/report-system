import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type BootstrapOptions = {
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
  force: boolean;
  dryRun: boolean;
  resetDb: boolean;
};

function readArg(flag: string): string {
  const index = process.argv.indexOf(flag);
  if (index < 0) return "";
  return String(process.argv[index + 1] || "").trim();
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function resolvePath(raw: string, fallback: string): string {
  const value = raw.trim() || fallback;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function buildOptions(): BootstrapOptions {
  const dataDir = resolvePath(readArg("--data-dir"), "data");
  const dbPath = resolvePath(readArg("--db-path"), path.join(dataDir, "report-system.sqlite"));
  return {
    tenantId: readArg("--tenant-id") || "default-tenant",
    tenantName: readArg("--tenant-name") || "默认客户",
    brandName: readArg("--brand-name") || "Report System",
    baseUrl: readArg("--base-url") || "http://127.0.0.1:3000",
    logoUrl: readArg("--logo-url"),
    primaryColor: readArg("--primary-color") || "#8b5a2b",
    primaryColorStrong: readArg("--primary-color-strong") || "#6b421d",
    defaultTimezone: readArg("--default-timezone") || "Asia/Shanghai",
    dataDir,
    dbPath,
    envPath: resolvePath(readArg("--env-path"), ".env.local"),
    configPath: resolvePath(readArg("--config-path"), "config/tenant.json"),
    adminUsername: readArg("--admin-username") || "admin",
    adminPassword: readArg("--admin-password") || "ChangeMe123!",
    adminDisplayName: readArg("--admin-display-name") || "系统管理员",
    supportedPayloadVersions: readArg("--supported-payload-versions") || "2",
    force: hasFlag("--force"),
    dryRun: hasFlag("--dry-run"),
    resetDb: hasFlag("--reset-db")
  };
}

function ensureWritable(pathname: string, force: boolean): void {
  if (fs.existsSync(pathname) && !force) {
    throw new Error(`${pathname} 已存在，如需覆盖请追加 --force`);
  }
}

function buildEnvContent(options: BootstrapOptions): string {
  return [
    `REPORT_SYSTEM_TENANT_ID=${options.tenantId}`,
    `REPORT_SYSTEM_TENANT_NAME=${options.tenantName}`,
    `REPORT_SYSTEM_BRAND_NAME=${options.brandName}`,
    `REPORT_SYSTEM_BASE_URL=${options.baseUrl}`,
    `REPORT_SYSTEM_LOGO_URL=${options.logoUrl}`,
    `REPORT_SYSTEM_PRIMARY_COLOR=${options.primaryColor}`,
    `REPORT_SYSTEM_PRIMARY_COLOR_STRONG=${options.primaryColorStrong}`,
    `REPORT_SYSTEM_DEFAULT_TIMEZONE=${options.defaultTimezone}`,
    `REPORT_SYSTEM_DATA_DIR=${options.dataDir}`,
    `REPORT_SYSTEM_DB_PATH=${options.dbPath}`,
    `REPORT_SYSTEM_TENANT_CONFIG_PATH=${options.configPath}`,
    `REPORT_SYSTEM_ADMIN_USERNAME=${options.adminUsername}`,
    `REPORT_SYSTEM_ADMIN_PASSWORD=${options.adminPassword}`,
    `REPORT_SYSTEM_ADMIN_DISPLAY_NAME=${options.adminDisplayName}`,
    `REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS=${options.supportedPayloadVersions}`
  ].join("\n") + "\n";
}

function buildTenantConfig(options: BootstrapOptions): Record<string, string | string[] | number[]> {
  return {
    tenantId: options.tenantId,
    tenantName: options.tenantName,
    brandName: options.brandName,
    baseUrl: options.baseUrl,
    logoUrl: options.logoUrl,
    primaryColor: options.primaryColor,
    primaryColorStrong: options.primaryColorStrong,
    defaultTimezone: options.defaultTimezone,
    dataDir: options.dataDir,
    dbPath: options.dbPath,
    adminUsername: options.adminUsername,
    adminPassword: options.adminPassword,
    adminDisplayName: options.adminDisplayName,
    supportedPayloadVersions: options.supportedPayloadVersions
      .split(",")
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0)
  };
}

function writeFile(pathname: string, content: string): void {
  fs.mkdirSync(path.dirname(pathname), { recursive: true });
  fs.writeFileSync(pathname, content, "utf-8");
}

function buildRuntimeEnv(options: BootstrapOptions): NodeJS.ProcessEnv {
  return {
    ...process.env,
    REPORT_SYSTEM_TENANT_ID: options.tenantId,
    REPORT_SYSTEM_TENANT_NAME: options.tenantName,
    REPORT_SYSTEM_BRAND_NAME: options.brandName,
    REPORT_SYSTEM_BASE_URL: options.baseUrl,
    REPORT_SYSTEM_LOGO_URL: options.logoUrl,
    REPORT_SYSTEM_PRIMARY_COLOR: options.primaryColor,
    REPORT_SYSTEM_PRIMARY_COLOR_STRONG: options.primaryColorStrong,
    REPORT_SYSTEM_DEFAULT_TIMEZONE: options.defaultTimezone,
    REPORT_SYSTEM_DATA_DIR: options.dataDir,
    REPORT_SYSTEM_DB_PATH: options.dbPath,
    REPORT_SYSTEM_TENANT_CONFIG_PATH: options.configPath,
    REPORT_SYSTEM_ADMIN_USERNAME: options.adminUsername,
    REPORT_SYSTEM_ADMIN_PASSWORD: options.adminPassword,
    REPORT_SYSTEM_ADMIN_DISPLAY_NAME: options.adminDisplayName,
    REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS: options.supportedPayloadVersions
  };
}

function runMigrate(options: BootstrapOptions): void {
  const result = spawnSync("npm", ["run", "db:migrate"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: buildRuntimeEnv(options)
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runAuthSeed(options: BootstrapOptions): void {
  const result = spawnSync("npm", ["run", "auth:seed"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: buildRuntimeEnv(options)
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main(): void {
  const options = buildOptions();
  const envContent = buildEnvContent(options);
  const configContent = `${JSON.stringify(buildTenantConfig(options), null, 2)}\n`;

  if (options.dryRun) {
    console.log("[dry-run] 将写入环境文件:");
    console.log(envContent);
    console.log("[dry-run] 将写入客户配置:");
    console.log(configContent);
    return;
  }

  ensureWritable(options.envPath, options.force);
  ensureWritable(options.configPath, options.force);

  if (options.resetDb) {
    fs.rmSync(options.dataDir, { recursive: true, force: true });
  }

  fs.mkdirSync(options.dataDir, { recursive: true });
  fs.mkdirSync(path.dirname(options.dbPath), { recursive: true });
  writeFile(options.envPath, envContent);
  writeFile(options.configPath, configContent);
  runMigrate(options);
  runAuthSeed(options);

  console.log("Single-tenant bootstrap completed.");
  console.log(`env: ${options.envPath}`);
  console.log(`tenant-config: ${options.configPath}`);
  console.log(`database: ${options.dbPath}`);
  console.log(`admin: ${options.adminUsername}`);
}

main();
