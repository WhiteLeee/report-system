import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { ensureAnalyticsJobManagerStarted } from "@/backend/analytics/jobs/analytics-job.manager";
import { readAuditRequestMeta, stringifyAuditPayload, toAuditActor } from "@/backend/auth/auth-audit";
import { createAuthService } from "@/backend/auth/auth.module";
import type { ManagedNavigationMenuItem, RoleCode } from "@/backend/auth/auth.types";
import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { buildRequestUrl } from "@/backend/http/request-url";
import { ensureRectificationSyncManagerStarted } from "@/backend/rectification/rectification-sync.manager";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";

const systemSettingsService = createSystemSettingsService();
const authService = createAuthService();
const MAX_BRANDING_UPLOAD_BYTES = 2 * 1024 * 1024;
const LOGO_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const FAVICON_EXTENSIONS = new Set([".ico", ".png"]);
const LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const FAVICON_MIME_TYPES = new Set(["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/ico"]);
const MIME_BY_EXTENSION: Record<string, Set<string>> = {
  ".png": new Set(["image/png"]),
  ".jpg": new Set(["image/jpeg"]),
  ".jpeg": new Set(["image/jpeg"]),
  ".webp": new Set(["image/webp"]),
  ".ico": new Set(["image/x-icon", "image/vnd.microsoft.icon", "image/ico"])
};

export const runtime = "nodejs";

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
): "branding" | "api" | "rectification" | "analytics" | "navigation" | "security" {
  const value = String(raw || "").trim();
  if (
    value === "branding" ||
    value === "rectification" ||
    value === "analytics" ||
    value === "navigation" ||
    value === "security"
  ) {
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

function isFileEntry(entry: FormDataEntryValue | null): entry is File {
  return typeof File !== "undefined" && entry instanceof File;
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function detectMimeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  const icoHead = `${toHex(buffer[0] || 0)}${toHex(buffer[1] || 0)}${toHex(buffer[2] || 0)}${toHex(buffer[3] || 0)}`;
  if (icoHead === "00000100" || icoHead === "00000200") {
    return "image/x-icon";
  }
  return null;
}

async function saveBrandingUpload(
  file: File,
  type: "logo" | "favicon"
): Promise<string> {
  if (file.size <= 0) {
    throw new Error("上传文件为空");
  }
  if (file.size > MAX_BRANDING_UPLOAD_BYTES) {
    throw new Error("上传文件过大（最大 2MB）");
  }

  const extension = path.extname(file.name || "").toLowerCase();
  const allowed = type === "logo" ? LOGO_EXTENSIONS : FAVICON_EXTENSIONS;
  if (!allowed.has(extension)) {
    throw new Error(type === "logo" ? "Logo 文件格式不支持" : "Favicon 文件格式不支持");
  }
  const allowedMimes = type === "logo" ? LOGO_MIME_TYPES : FAVICON_MIME_TYPES;
  const expectedMimes = MIME_BY_EXTENSION[extension] || new Set<string>();

  const uploadDir = path.join(process.cwd(), "public", "uploads", "branding");
  await fs.mkdir(uploadDir, { recursive: true });

  const filename = `${type}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
  const absolutePath = path.join(uploadDir, filename);
  const content = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectMimeFromBuffer(content);
  const declaredMime = String(file.type || "").trim().toLowerCase();

  if (declaredMime && !allowedMimes.has(declaredMime)) {
    throw new Error(type === "logo" ? "Logo 文件类型校验失败，请重新上传。" : "Favicon 文件类型校验失败，请重新上传。");
  }
  if (!detectedMime || !allowedMimes.has(detectedMime) || (expectedMimes.size > 0 && !expectedMimes.has(detectedMime))) {
    throw new Error(type === "logo" ? "Logo 文件内容校验失败，请上传真实图片文件。" : "Favicon 文件内容校验失败，请上传真实图标文件。");
  }

  await fs.writeFile(absolutePath, content);
  return `/uploads/branding/${filename}`;
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
  const currentBrandingSettings = systemSettingsService.getEnterpriseBrandingSettings();
  const currentDeliveryMode = systemSettingsService.getDeliveryMode();
  const currentSecurityPolicy = systemSettingsService.getAuthSecurityPolicy();
  const currentNavigationMenus = authService.listManagedNavigationMenus();

  try {
    if (tab === "branding") {
      const now = new Date().toISOString();
      const logoFile = formData.get("logoFile");
      const faviconFile = formData.get("faviconFile");
      const nextLogoUrl =
        isFileEntry(logoFile) && logoFile.size > 0
          ? await saveBrandingUpload(logoFile, "logo")
          : currentBrandingSettings.logoUrl;
      const nextFaviconUrl =
        isFileEntry(faviconFile) && faviconFile.size > 0
          ? await saveBrandingUpload(faviconFile, "favicon")
          : currentBrandingSettings.faviconUrl;

      const nextBrandingSettings = {
        ...currentBrandingSettings,
        enterpriseName: String(formData.get("enterpriseName") || "").trim() || currentBrandingSettings.enterpriseName,
        primaryColor: String(formData.get("primaryColor") || "").trim() || currentBrandingSettings.primaryColor,
        primaryColorStrong:
          String(formData.get("primaryColorStrong") || "").trim() || currentBrandingSettings.primaryColorStrong,
        logoUrl: nextLogoUrl,
        faviconUrl: nextFaviconUrl,
        updatedBy: currentUser.username,
        updatedAt: now
      };
      systemSettingsService.saveEnterpriseBrandingSettings(nextBrandingSettings);
      authService.createAuditLog({
        ...actor,
        targetUserId: null,
        targetUsername: "system_setting:enterprise_branding",
        action: "system.settings.branding.update",
        beforeJson: stringifyAuditPayload(currentBrandingSettings),
        afterJson: stringifyAuditPayload(nextBrandingSettings),
        requestId: auditMeta.requestId,
        ipAddress: auditMeta.ipAddress,
        userAgent: auditMeta.userAgent
      });
    } else if (tab === "api") {
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
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "保存失败，请稍后重试。";
    return NextResponse.redirect(
      buildRequestUrl(request, `/admin/settings?tab=${tab}&error=${encodeURIComponent(message)}`),
      303
    );
  }

  ensureRectificationSyncManagerStarted();
  ensureAnalyticsJobManagerStarted();

  return NextResponse.redirect(buildRequestUrl(request, `/admin/settings?tab=${tab}`), 303);
}
