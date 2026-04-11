import { eq } from "drizzle-orm";

import { getReportSystemConfig } from "@/backend/config/report-system-config";
import { db } from "@/backend/database/client";
import { systemSettingTable } from "@/backend/database/schema";
import type {
  AuthSecurityPolicy,
  DeliveryMode,
  EnterpriseBrandingSettings,
  HuiYunYingApiSettings,
  SystemSettingsRepository
} from "@/backend/system-settings/system-settings.types";

const HUIYUNYING_API_KEY = "huiyunying_api";
const DELIVERY_MODE_KEY = "auth_delivery_mode";
const AUTH_SECURITY_POLICY_KEY = "auth_security_policy";
const ENTERPRISE_BRANDING_KEY = "enterprise_branding_v1";

const defaultHuiYunYingApiSettings: HuiYunYingApiSettings = {
  uri: "",
  route: "",
  appid: "",
  secret: "",
  rateLimitCount: 30,
  rateLimitWindowMs: 60000,
  rectificationCreateRoute: "/route/ri/open/item/create",
  rectificationListRoute: "/route/ri/open/item/list",
  rectificationDescriptionMaxLength: 500,
  defaultShouldCorrectedDays: 0,
  rectificationSyncIntervalMs: 1800000,
  rectificationSyncRetryCount: 2,
  rectificationSyncTimeoutMs: 10000,
  rectificationSyncBatchSize: 50,
  analyticsFactRefreshIntervalMs: 0,
  analyticsSnapshotRefreshIntervalMs: 0
};

const defaultAuthSecurityPolicy: AuthSecurityPolicy = {
  passwordMinLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialCharacter: false,
  loginMaxFailures: 5,
  loginLockDurationMs: 300000
};

const config = getReportSystemConfig();
const defaultEnterpriseBrandingSettings: EnterpriseBrandingSettings = {
  enterpriseName: config.tenantName,
  logoUrl: config.logoUrl,
  faviconUrl: config.logoUrl,
  primaryColor: config.primaryColor,
  primaryColorStrong: config.primaryColorStrong,
  updatedBy: "",
  updatedAt: ""
};

function safeParseSettings(value: string): HuiYunYingApiSettings {
  try {
    const parsed = JSON.parse(value) as Partial<HuiYunYingApiSettings>;
    return {
      uri: String(parsed.uri || "").trim(),
      route: String(parsed.route || "").trim(),
      appid: String(parsed.appid || "").trim(),
      secret: String(parsed.secret || "").trim(),
      rateLimitCount:
        Number.isFinite(parsed.rateLimitCount) && Number(parsed.rateLimitCount) > 0
          ? Number(parsed.rateLimitCount)
          : defaultHuiYunYingApiSettings.rateLimitCount,
      rateLimitWindowMs:
        Number.isFinite(parsed.rateLimitWindowMs) && Number(parsed.rateLimitWindowMs) > 0
          ? Number(parsed.rateLimitWindowMs)
          : defaultHuiYunYingApiSettings.rateLimitWindowMs,
      rectificationCreateRoute:
        String(parsed.rectificationCreateRoute || "").trim() || defaultHuiYunYingApiSettings.rectificationCreateRoute,
      rectificationListRoute:
        String(parsed.rectificationListRoute || "").trim() || defaultHuiYunYingApiSettings.rectificationListRoute,
      rectificationDescriptionMaxLength:
        Number.isFinite(parsed.rectificationDescriptionMaxLength) &&
        Number(parsed.rectificationDescriptionMaxLength) > 0
          ? Number(parsed.rectificationDescriptionMaxLength)
          : defaultHuiYunYingApiSettings.rectificationDescriptionMaxLength,
      defaultShouldCorrectedDays:
        Number.isFinite(parsed.defaultShouldCorrectedDays) && Number(parsed.defaultShouldCorrectedDays) >= 0
          ? Number(parsed.defaultShouldCorrectedDays)
          : defaultHuiYunYingApiSettings.defaultShouldCorrectedDays,
      rectificationSyncIntervalMs:
        Number.isFinite(parsed.rectificationSyncIntervalMs) && Number(parsed.rectificationSyncIntervalMs) >= 0
          ? Number(parsed.rectificationSyncIntervalMs)
          : defaultHuiYunYingApiSettings.rectificationSyncIntervalMs,
      rectificationSyncRetryCount:
        Number.isFinite(parsed.rectificationSyncRetryCount) && Number(parsed.rectificationSyncRetryCount) >= 0
          ? Number(parsed.rectificationSyncRetryCount)
          : defaultHuiYunYingApiSettings.rectificationSyncRetryCount,
      rectificationSyncTimeoutMs:
        Number.isFinite(parsed.rectificationSyncTimeoutMs) && Number(parsed.rectificationSyncTimeoutMs) > 0
          ? Number(parsed.rectificationSyncTimeoutMs)
          : defaultHuiYunYingApiSettings.rectificationSyncTimeoutMs,
      rectificationSyncBatchSize:
        Number.isFinite(parsed.rectificationSyncBatchSize) && Number(parsed.rectificationSyncBatchSize) > 0
          ? Number(parsed.rectificationSyncBatchSize)
          : defaultHuiYunYingApiSettings.rectificationSyncBatchSize,
      analyticsFactRefreshIntervalMs:
        Number.isFinite(parsed.analyticsFactRefreshIntervalMs) && Number(parsed.analyticsFactRefreshIntervalMs) >= 0
          ? Number(parsed.analyticsFactRefreshIntervalMs)
          : defaultHuiYunYingApiSettings.analyticsFactRefreshIntervalMs,
      analyticsSnapshotRefreshIntervalMs:
        Number.isFinite(parsed.analyticsSnapshotRefreshIntervalMs) && Number(parsed.analyticsSnapshotRefreshIntervalMs) >= 0
          ? Number(parsed.analyticsSnapshotRefreshIntervalMs)
          : defaultHuiYunYingApiSettings.analyticsSnapshotRefreshIntervalMs
    };
  } catch {
    return defaultHuiYunYingApiSettings;
  }
}

function safeParseAuthSecurityPolicy(value: string): AuthSecurityPolicy {
  try {
    const parsed = JSON.parse(value) as Partial<AuthSecurityPolicy>;
    return {
      passwordMinLength:
        Number.isFinite(parsed.passwordMinLength) && Number(parsed.passwordMinLength) >= 8
          ? Math.floor(Number(parsed.passwordMinLength))
          : defaultAuthSecurityPolicy.passwordMinLength,
      requireUppercase:
        typeof parsed.requireUppercase === "boolean"
          ? parsed.requireUppercase
          : defaultAuthSecurityPolicy.requireUppercase,
      requireLowercase:
        typeof parsed.requireLowercase === "boolean"
          ? parsed.requireLowercase
          : defaultAuthSecurityPolicy.requireLowercase,
      requireNumber:
        typeof parsed.requireNumber === "boolean" ? parsed.requireNumber : defaultAuthSecurityPolicy.requireNumber,
      requireSpecialCharacter:
        typeof parsed.requireSpecialCharacter === "boolean"
          ? parsed.requireSpecialCharacter
          : defaultAuthSecurityPolicy.requireSpecialCharacter,
      loginMaxFailures:
        Number.isFinite(parsed.loginMaxFailures) && Number(parsed.loginMaxFailures) > 0
          ? Math.floor(Number(parsed.loginMaxFailures))
          : defaultAuthSecurityPolicy.loginMaxFailures,
      loginLockDurationMs:
        Number.isFinite(parsed.loginLockDurationMs) && Number(parsed.loginLockDurationMs) > 0
          ? Math.floor(Number(parsed.loginLockDurationMs))
          : defaultAuthSecurityPolicy.loginLockDurationMs
    };
  } catch {
    return defaultAuthSecurityPolicy;
  }
}

function safeParseEnterpriseBrandingSettings(value: string): EnterpriseBrandingSettings {
  try {
    const parsed = JSON.parse(value) as Partial<EnterpriseBrandingSettings>;
    return {
      enterpriseName: String(parsed.enterpriseName || "").trim() || defaultEnterpriseBrandingSettings.enterpriseName,
      logoUrl: String(parsed.logoUrl || "").trim(),
      faviconUrl: String(parsed.faviconUrl || "").trim(),
      primaryColor: String(parsed.primaryColor || "").trim() || defaultEnterpriseBrandingSettings.primaryColor,
      primaryColorStrong:
        String(parsed.primaryColorStrong || "").trim() || defaultEnterpriseBrandingSettings.primaryColorStrong,
      updatedBy: String(parsed.updatedBy || "").trim(),
      updatedAt: String(parsed.updatedAt || "").trim()
    };
  } catch {
    return defaultEnterpriseBrandingSettings;
  }
}

export class SqliteSystemSettingsRepository implements SystemSettingsRepository {
  getHuiYunYingApiSettings(): HuiYunYingApiSettings {
    const row = db
      .select()
      .from(systemSettingTable)
      .where(eq(systemSettingTable.settingKey, HUIYUNYING_API_KEY))
      .get();

    if (!row) {
      return defaultHuiYunYingApiSettings;
    }

    return safeParseSettings(row.valueJson);
  }

  saveHuiYunYingApiSettings(settings: HuiYunYingApiSettings): void {
    const now = new Date().toISOString();
    db.insert(systemSettingTable)
      .values({
        settingKey: HUIYUNYING_API_KEY,
        category: "integration",
        valueJson: JSON.stringify(settings),
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: systemSettingTable.settingKey,
        set: {
          category: "integration",
          valueJson: JSON.stringify(settings),
          updatedAt: now
        }
      })
      .run();
  }

  getDeliveryMode(): DeliveryMode {
    const row = db
      .select()
      .from(systemSettingTable)
      .where(eq(systemSettingTable.settingKey, DELIVERY_MODE_KEY))
      .get();

    if (!row) {
      return "internal";
    }

    try {
      const parsed = JSON.parse(row.valueJson) as { mode?: string };
      return parsed.mode === "customer" ? "customer" : "internal";
    } catch {
      return "internal";
    }
  }

  saveDeliveryMode(mode: DeliveryMode): void {
    const now = new Date().toISOString();
    const normalizedMode: DeliveryMode = mode === "customer" ? "customer" : "internal";
    db.insert(systemSettingTable)
      .values({
        settingKey: DELIVERY_MODE_KEY,
        category: "auth",
        valueJson: JSON.stringify({ mode: normalizedMode }),
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: systemSettingTable.settingKey,
        set: {
          category: "auth",
          valueJson: JSON.stringify({ mode: normalizedMode }),
          updatedAt: now
        }
      })
      .run();
  }

  getAuthSecurityPolicy(): AuthSecurityPolicy {
    const row = db
      .select()
      .from(systemSettingTable)
      .where(eq(systemSettingTable.settingKey, AUTH_SECURITY_POLICY_KEY))
      .get();

    if (!row) {
      return defaultAuthSecurityPolicy;
    }
    return safeParseAuthSecurityPolicy(row.valueJson);
  }

  saveAuthSecurityPolicy(policy: AuthSecurityPolicy): void {
    const now = new Date().toISOString();
    db.insert(systemSettingTable)
      .values({
        settingKey: AUTH_SECURITY_POLICY_KEY,
        category: "auth",
        valueJson: JSON.stringify(policy),
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: systemSettingTable.settingKey,
        set: {
          category: "auth",
          valueJson: JSON.stringify(policy),
          updatedAt: now
        }
      })
      .run();
  }

  getEnterpriseBrandingSettings(): EnterpriseBrandingSettings {
    const row = db
      .select()
      .from(systemSettingTable)
      .where(eq(systemSettingTable.settingKey, ENTERPRISE_BRANDING_KEY))
      .get();

    if (!row) {
      return defaultEnterpriseBrandingSettings;
    }
    return safeParseEnterpriseBrandingSettings(row.valueJson);
  }

  saveEnterpriseBrandingSettings(settings: EnterpriseBrandingSettings): void {
    const now = new Date().toISOString();
    db.insert(systemSettingTable)
      .values({
        settingKey: ENTERPRISE_BRANDING_KEY,
        category: "branding",
        valueJson: JSON.stringify(settings),
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: systemSettingTable.settingKey,
        set: {
          category: "branding",
          valueJson: JSON.stringify(settings),
          updatedAt: now
        }
      })
      .run();
  }
}
