import { NextResponse } from "next/server";

import { ensureAnalyticsJobManagerStarted } from "@/backend/analytics/jobs/analytics-job.manager";
import { readAuditRequestMeta, stringifyAuditPayload, toAuditActor } from "@/backend/auth/auth-audit";
import { createAuthService } from "@/backend/auth/auth.module";
import type { ManagedNavigationMenuItem, RoleCode } from "@/backend/auth/auth.types";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
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

function resolveSettingsTab(
  raw: FormDataEntryValue | null
): "api" | "rectification" | "analytics" | "navigation" | "security" {
  const value = String(raw || "").trim();
  if (value === "rectification" || value === "analytics" || value === "navigation" || value === "security") {
    return value;
  }
  return "api";
}

function readBoolean(formData: FormData, key: string): boolean {
  const value = String(formData.get(key) || "").trim();
  return value === "1" || value === "on" || value === "true";
}

function parseNavigationMenus(formData: FormData, current: ManagedNavigationMenuItem[]): ManagedNavigationMenuItem[] {
  const currentMap = new Map(current.map((item) => [item.code, item]));
  const codeSet = new Set<string>();
  formData.forEach((value, key) => {
    if (key.startsWith("menuCode:")) {
      const code = String(value || "").trim() || key.slice("menuCode:".length).trim();
      if (code) {
        codeSet.add(code);
      }
    }
  });
  if (codeSet.size === 0) {
    current.forEach((item) => codeSet.add(item.code));
  }

  const mutableRoles: RoleCode[] = ["manage", "reviewer", "viewer"];
  return Array.from(codeSet)
    .map((code) => {
      const base = currentMap.get(code);
      const label = String(formData.get(`menuLabel:${code}`) || base?.label || "").trim();
      const href = String(formData.get(`menuHref:${code}`) || base?.href || "").trim();
      const icon = String(formData.get(`menuIcon:${code}`) || base?.icon || "").trim();
      if (!code || !label || !href) {
        return null;
      }
      const roleCodes: RoleCode[] = ["admin"];
      mutableRoles.forEach((roleCode) => {
        if (readBoolean(formData, `menuRole:${roleCode}:${code}`)) {
          roleCodes.push(roleCode);
        }
      });
      return {
        code,
        label,
        href,
        icon,
        sortOrder: readNonNegativeNumber(formData.get(`menuSortOrder:${code}`), base?.sortOrder ?? 0),
        visible: readBoolean(formData, `menuVisible:${code}`),
        roleCodes
      } satisfies ManagedNavigationMenuItem;
    })
    .filter((item): item is ManagedNavigationMenuItem => Boolean(item));
}

export async function POST(request: Request): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "system:settings:write") || !currentUser?.roles.includes("admin")) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const auditMeta = readAuditRequestMeta(request);
  const actor = toAuditActor(currentUser);

  const formData = await request.formData().catch(() => new FormData());
  const tab = resolveSettingsTab(formData.get("tab"));
  const currentSettings = systemSettingsService.getHuiYunYingApiSettings();
  const currentDeliveryMode = systemSettingsService.getDeliveryMode();
  const currentSecurityPolicy = systemSettingsService.getAuthSecurityPolicy();
  const currentNavigationMenus = authService.listManagedNavigationMenus();

  if (tab === "api") {
    const nextSettings = {
      ...currentSettings,
      uri: String(formData.get("uri") || "").trim(),
      route: String(formData.get("route") || "").trim(),
      appid: String(formData.get("appid") || "").trim(),
      secret: String(formData.get("secret") || "").trim(),
      rateLimitCount: readPositiveNumber(formData.get("rateLimitCount"), currentSettings.rateLimitCount),
      rateLimitWindowMs: readPositiveNumber(formData.get("rateLimitWindowMs"), currentSettings.rateLimitWindowMs)
    };
    systemSettingsService.saveHuiYunYingApiSettings(nextSettings);
    authService.createAuditLog({
      ...actor,
      targetUserId: null,
      targetUsername: "system_setting:huiyunying_api",
      action: "system.settings.api.update",
      beforeJson: stringifyAuditPayload(currentSettings),
      afterJson: stringifyAuditPayload(nextSettings),
      requestId: auditMeta.requestId,
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    });
  } else if (tab === "rectification") {
    const nextSettings = {
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
    };
    systemSettingsService.saveHuiYunYingApiSettings(nextSettings);
    authService.createAuditLog({
      ...actor,
      targetUserId: null,
      targetUsername: "system_setting:rectification",
      action: "system.settings.rectification.update",
      beforeJson: stringifyAuditPayload(currentSettings),
      afterJson: stringifyAuditPayload(nextSettings),
      requestId: auditMeta.requestId,
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    });
  } else if (tab === "analytics") {
    const nextSettings = {
      ...currentSettings,
      analyticsFactRefreshIntervalMs: readNonNegativeNumber(
        formData.get("analyticsFactRefreshIntervalMs"),
        currentSettings.analyticsFactRefreshIntervalMs
      ),
      analyticsSnapshotRefreshIntervalMs: readNonNegativeNumber(
        formData.get("analyticsSnapshotRefreshIntervalMs"),
        currentSettings.analyticsSnapshotRefreshIntervalMs
      )
    };
    systemSettingsService.saveHuiYunYingApiSettings(nextSettings);
    authService.createAuditLog({
      ...actor,
      targetUserId: null,
      targetUsername: "system_setting:analytics",
      action: "system.settings.analytics.update",
      beforeJson: stringifyAuditPayload(currentSettings),
      afterJson: stringifyAuditPayload(nextSettings),
      requestId: auditMeta.requestId,
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    });
  } else if (tab === "navigation") {
    const nextNavigationMenus = parseNavigationMenus(formData, currentNavigationMenus);
    authService.saveManagedNavigationMenus(nextNavigationMenus);
    authService.createAuditLog({
      ...actor,
      targetUserId: null,
      targetUsername: "system_setting:navigation",
      action: "system.settings.navigation.update",
      beforeJson: stringifyAuditPayload(currentNavigationMenus),
      afterJson: stringifyAuditPayload(nextNavigationMenus),
      requestId: auditMeta.requestId,
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    });
  } else {
    const nextDeliveryMode = String(formData.get("deliveryMode") || "").trim() === "customer" ? "customer" : "internal";
    const nextSecurityPolicy = {
      passwordMinLength: readPositiveNumber(formData.get("passwordMinLength"), currentSecurityPolicy.passwordMinLength),
      requireUppercase: readBoolean(formData, "requireUppercase"),
      requireLowercase: readBoolean(formData, "requireLowercase"),
      requireNumber: readBoolean(formData, "requireNumber"),
      requireSpecialCharacter: readBoolean(formData, "requireSpecialCharacter"),
      loginMaxFailures: readPositiveNumber(formData.get("loginMaxFailures"), currentSecurityPolicy.loginMaxFailures),
      loginLockDurationMs: readPositiveNumber(formData.get("loginLockDurationMs"), currentSecurityPolicy.loginLockDurationMs)
    };
    systemSettingsService.saveDeliveryMode(nextDeliveryMode);
    systemSettingsService.saveAuthSecurityPolicy(nextSecurityPolicy);
    authService.createAuditLog({
      ...actor,
      targetUserId: null,
      targetUsername: "system_setting:auth_delivery_mode",
      action: "system.settings.delivery_mode.update",
      beforeJson: stringifyAuditPayload({ mode: currentDeliveryMode, securityPolicy: currentSecurityPolicy }),
      afterJson: stringifyAuditPayload({ mode: nextDeliveryMode, securityPolicy: nextSecurityPolicy }),
      requestId: auditMeta.requestId,
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent
    });
  }
  ensureRectificationSyncManagerStarted();
  ensureAnalyticsJobManagerStarted();

  return NextResponse.redirect(new URL(`/admin/settings?tab=${tab}`, request.url), 303);
}
