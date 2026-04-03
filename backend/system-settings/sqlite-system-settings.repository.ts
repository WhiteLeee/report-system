import { eq } from "drizzle-orm";

import { db } from "@/backend/database/client";
import { systemSettingTable } from "@/backend/database/schema";
import type { HuiYunYingApiSettings, SystemSettingsRepository } from "@/backend/system-settings/system-settings.types";

const HUIYUNYING_API_KEY = "huiyunying_api";

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
}
