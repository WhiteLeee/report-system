import { NextResponse } from "next/server";

import { ensureAnalyticsJobManagerStarted } from "@/backend/analytics/jobs/analytics-job.manager";
import { createAuthService } from "@/backend/auth/auth.module";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import type { PermissionCode } from "@/backend/auth/auth.types";
import { ensureRectificationSyncManagerStarted } from "@/backend/rectification/rectification-sync.manager";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";

const systemSettingsService = createSystemSettingsService();
const authService = createAuthService();

function readPositiveNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readNonNegativeNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function resolveSettingsTab(raw: FormDataEntryValue | null): "api" | "rectification" | "analytics" | "permission" {
  const value = String(raw || "").trim();
  if (value === "rectification" || value === "analytics" || value === "permission") {
    return value;
  }
  return "api";
}

function readPermissionCodes(formData: FormData, roleCode: "viewer" | "reviewer"): PermissionCode[] {
  return formData
    .getAll(`permissions_${roleCode}`)
    .map((item) => String(item || "").trim())
    .filter((item): item is PermissionCode => item === "report:read" || item === "review:write" || item === "user:manage");
}

export async function POST(request: Request): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "user:manage") || !currentUser?.roles.includes("admin")) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => new FormData());
  const tab = resolveSettingsTab(formData.get("tab"));
  const currentSettings = systemSettingsService.getHuiYunYingApiSettings();

  if (tab === "api") {
    systemSettingsService.saveHuiYunYingApiSettings({
      ...currentSettings,
      uri: String(formData.get("uri") || "").trim(),
      route: String(formData.get("route") || "").trim(),
      appid: String(formData.get("appid") || "").trim(),
      secret: String(formData.get("secret") || "").trim(),
      rateLimitCount: readPositiveNumber(formData.get("rateLimitCount"), currentSettings.rateLimitCount),
      rateLimitWindowMs: readPositiveNumber(formData.get("rateLimitWindowMs"), currentSettings.rateLimitWindowMs)
    });
  } else if (tab === "rectification") {
    systemSettingsService.saveHuiYunYingApiSettings({
      ...currentSettings,
      rectificationCreateRoute: String(formData.get("rectificationCreateRoute") || "").trim(),
      rectificationListRoute: String(formData.get("rectificationListRoute") || "").trim(),
      rectificationDescriptionMaxLength: readPositiveNumber(
        formData.get("rectificationDescriptionMaxLength"),
        currentSettings.rectificationDescriptionMaxLength
      ),
      defaultShouldCorrectedDays: readNonNegativeNumber(
        formData.get("defaultShouldCorrectedDays"),
        currentSettings.defaultShouldCorrectedDays
      ),
      rectificationSyncIntervalMs: readNonNegativeNumber(
        formData.get("rectificationSyncIntervalMs"),
        currentSettings.rectificationSyncIntervalMs
      ),
      rectificationSyncRetryCount: readNonNegativeNumber(
        formData.get("rectificationSyncRetryCount"),
        currentSettings.rectificationSyncRetryCount
      ),
      rectificationSyncTimeoutMs: readPositiveNumber(
        formData.get("rectificationSyncTimeoutMs"),
        currentSettings.rectificationSyncTimeoutMs
      ),
      rectificationSyncBatchSize: readPositiveNumber(
        formData.get("rectificationSyncBatchSize"),
        currentSettings.rectificationSyncBatchSize
      )
    });
  } else if (tab === "analytics") {
    systemSettingsService.saveHuiYunYingApiSettings({
      ...currentSettings,
      analyticsFactRefreshIntervalMs: readNonNegativeNumber(
        formData.get("analyticsFactRefreshIntervalMs"),
        currentSettings.analyticsFactRefreshIntervalMs
      ),
      analyticsSnapshotRefreshIntervalMs: readNonNegativeNumber(
        formData.get("analyticsSnapshotRefreshIntervalMs"),
        currentSettings.analyticsSnapshotRefreshIntervalMs
      )
    });
  } else {
    authService.replaceRolePermissions("viewer", readPermissionCodes(formData, "viewer"));
    authService.replaceRolePermissions("reviewer", readPermissionCodes(formData, "reviewer"));
  }
  ensureRectificationSyncManagerStarted();
  ensureAnalyticsJobManagerStarted();

  return NextResponse.redirect(new URL(`/admin/settings?tab=${tab}`, request.url), 303);
}
