import { NextResponse } from "next/server";

import { getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { ensureRectificationSyncManagerStarted } from "@/backend/rectification/rectification-sync.manager";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";

const systemSettingsService = createSystemSettingsService();

function readPositiveNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readNonNegativeNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export async function POST(request: Request): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "user:manage") || !currentUser?.roles.includes("admin")) {
    return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => new FormData());
  systemSettingsService.saveHuiYunYingApiSettings({
    uri: String(formData.get("uri") || "").trim(),
    route: String(formData.get("route") || "").trim(),
    rectificationCreateRoute: String(formData.get("rectificationCreateRoute") || "").trim(),
    rectificationListRoute: String(formData.get("rectificationListRoute") || "").trim(),
    appid: String(formData.get("appid") || "").trim(),
    secret: String(formData.get("secret") || "").trim(),
    rateLimitCount: readPositiveNumber(formData.get("rateLimitCount"), 30),
    rateLimitWindowMs: readPositiveNumber(formData.get("rateLimitWindowMs"), 60000),
    rectificationDescriptionMaxLength: readPositiveNumber(formData.get("rectificationDescriptionMaxLength"), 500),
    defaultShouldCorrectedDays: readNonNegativeNumber(formData.get("defaultShouldCorrectedDays"), 0),
    rectificationSyncIntervalMs: readNonNegativeNumber(formData.get("rectificationSyncIntervalMs"), 600000)
  });
  ensureRectificationSyncManagerStarted();

  return NextResponse.redirect(new URL("/admin/settings", request.url), 303);
}
