import fs from "node:fs";
import path from "node:path";

export type ReportSystemConfig = {
  tenantId: string;
  tenantName: string;
  brandName: string;
  logoUrl: string;
  baseUrl: string;
  primaryColor: string;
  primaryColorStrong: string;
  defaultTimezone: string;
  dataDir: string;
  dbPath: string;
  tenantConfigPath: string;
  adminUsername: string;
  adminPassword: string;
  adminDisplayName: string;
  supportedPayloadVersions: number[];
};

type PartialTenantConfig = Partial<{
  tenantId: string;
  tenantName: string;
  brandName: string;
  logoUrl: string;
  baseUrl: string;
  primaryColor: string;
  primaryColorStrong: string;
  defaultTimezone: string;
  dataDir: string;
  dbPath: string;
  adminUsername: string;
  adminPassword: string;
  adminDisplayName: string;
  supportedPayloadVersions: number[];
}>;

function normalizeVersionList(values: unknown, fallback: number[]): number[] {
  if (Array.isArray(values)) {
    const normalized = Array.from(
      new Set(
        values
          .map((value) => (typeof value === "number" ? value : Number.parseInt(String(value ?? "").trim(), 10)))
          .filter((value) => Number.isInteger(value) && value > 0)
      )
    ).sort((left, right) => left - right);
    return normalized.length > 0 ? normalized : fallback;
  }

  const text = typeof values === "string" ? values.trim() : "";
  if (!text) {
    return fallback;
  }

  const normalized = Array.from(
    new Set(
      text
        .split(",")
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  ).sort((left, right) => left - right);

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeDir(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  }
  return path.isAbsolute(raw) ? raw : path.resolve(/* turbopackIgnore: true */ process.cwd(), raw);
}

function normalizeDbPath(value: string, dataDir: string): string {
  const raw = value.trim();
  if (!raw) {
    return path.join(dataDir, "report-system.sqlite");
  }
  return path.isAbsolute(raw) ? raw : path.resolve(/* turbopackIgnore: true */ process.cwd(), raw);
}

function normalizeConfigPath(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return path.join(/* turbopackIgnore: true */ process.cwd(), "config", "tenant.json");
  }
  return path.isAbsolute(raw) ? raw : path.resolve(/* turbopackIgnore: true */ process.cwd(), raw);
}

function readTenantConfigFile(configPath: string): PartialTenantConfig {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    return {
      tenantId: typeof raw.tenantId === "string" ? raw.tenantId.trim() : "",
      tenantName: typeof raw.tenantName === "string" ? raw.tenantName.trim() : "",
      brandName: typeof raw.brandName === "string" ? raw.brandName.trim() : "",
      logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl.trim() : "",
      baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl.trim() : "",
      primaryColor: typeof raw.primaryColor === "string" ? raw.primaryColor.trim() : "",
      primaryColorStrong: typeof raw.primaryColorStrong === "string" ? raw.primaryColorStrong.trim() : "",
      defaultTimezone: typeof raw.defaultTimezone === "string" ? raw.defaultTimezone.trim() : "",
      dataDir: typeof raw.dataDir === "string" ? raw.dataDir.trim() : "",
      dbPath: typeof raw.dbPath === "string" ? raw.dbPath.trim() : "",
      adminUsername: typeof raw.adminUsername === "string" ? raw.adminUsername.trim() : "",
      adminPassword: typeof raw.adminPassword === "string" ? raw.adminPassword.trim() : "",
      adminDisplayName: typeof raw.adminDisplayName === "string" ? raw.adminDisplayName.trim() : "",
      supportedPayloadVersions: normalizeVersionList(raw.supportedPayloadVersions, [])
    };
  } catch {
    return {};
  }
}

export function getReportSystemConfig(): ReportSystemConfig {
  const tenantConfigPath = normalizeConfigPath(process.env.REPORT_SYSTEM_TENANT_CONFIG_PATH || "");
  const fileConfig = readTenantConfigFile(tenantConfigPath);
  const dataDir = normalizeDir(process.env.REPORT_SYSTEM_DATA_DIR || fileConfig.dataDir || "");
  return {
    tenantId: (process.env.REPORT_SYSTEM_TENANT_ID || fileConfig.tenantId || "default-tenant").trim(),
    tenantName: (process.env.REPORT_SYSTEM_TENANT_NAME || fileConfig.tenantName || "默认客户").trim(),
    brandName: (process.env.REPORT_SYSTEM_BRAND_NAME || fileConfig.brandName || "Report System").trim(),
    logoUrl: (process.env.REPORT_SYSTEM_LOGO_URL || fileConfig.logoUrl || "").trim(),
    baseUrl: (process.env.REPORT_SYSTEM_BASE_URL || fileConfig.baseUrl || "http://127.0.0.1:3000").trim(),
    primaryColor: (process.env.REPORT_SYSTEM_PRIMARY_COLOR || fileConfig.primaryColor || "#8b5a2b").trim(),
    primaryColorStrong: (
      process.env.REPORT_SYSTEM_PRIMARY_COLOR_STRONG ||
      fileConfig.primaryColorStrong ||
      "#6b421d"
    ).trim(),
    defaultTimezone: (
      process.env.REPORT_SYSTEM_DEFAULT_TIMEZONE ||
      fileConfig.defaultTimezone ||
      "Asia/Shanghai"
    ).trim(),
    dataDir,
    dbPath: normalizeDbPath(process.env.REPORT_SYSTEM_DB_PATH || fileConfig.dbPath || "", dataDir),
    tenantConfigPath,
    adminUsername: (
      process.env.REPORT_SYSTEM_ADMIN_USERNAME ||
      fileConfig.adminUsername ||
      "admin"
    ).trim(),
    adminPassword: (
      process.env.REPORT_SYSTEM_ADMIN_PASSWORD ||
      fileConfig.adminPassword ||
      "ChangeMe123!"
    ).trim(),
    adminDisplayName: (
      process.env.REPORT_SYSTEM_ADMIN_DISPLAY_NAME ||
      fileConfig.adminDisplayName ||
      "系统管理员"
    ).trim(),
    supportedPayloadVersions: normalizeVersionList(
      process.env.REPORT_SYSTEM_SUPPORTED_PAYLOAD_VERSIONS || fileConfig.supportedPayloadVersions || [],
      [2]
    )
  };
}
