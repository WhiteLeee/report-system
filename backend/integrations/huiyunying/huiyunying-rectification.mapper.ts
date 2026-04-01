import type { HuiYunYingApiSettings } from "@/backend/system-settings/system-settings.types";
import type { HuiYunYingResolvedSettings } from "@/backend/integrations/huiyunying/huiyunying.types";

function normalizeRouteSegment(value: string): string {
  return String(value || "").trim().replace(/^\/+|\/+$/g, "");
}

function normalizePath(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function resolveRouteTemplate(template: string, routeValue: string): string {
  const normalizedTemplate = normalizePath(template);
  const normalizedRoute = normalizeRouteSegment(routeValue);

  if (!normalizedTemplate || !normalizedRoute) {
    return normalizedTemplate;
  }

  return normalizedTemplate.replace(/^\/route(?=\/|$)/, `/${normalizedRoute}`).replace(/\{route\}/g, normalizedRoute);
}

export function resolveHuiYunYingSettings(settings: HuiYunYingApiSettings): HuiYunYingResolvedSettings {
  return {
    baseUri: settings.uri.trim(),
    signPath: "/sign",
    appid: settings.appid.trim(),
    secret: settings.secret.trim(),
    rectificationCreateRoute: resolveRouteTemplate(
      settings.rectificationCreateRoute.trim() || settings.route.trim(),
      settings.route.trim()
    ),
    rectificationListRoute: resolveRouteTemplate(
      settings.rectificationListRoute.trim() || settings.route.trim(),
      settings.route.trim()
    ),
    rateLimitCount: settings.rateLimitCount,
    rateLimitWindowMs: settings.rateLimitWindowMs,
    rectificationDescriptionMaxLength: settings.rectificationDescriptionMaxLength,
    defaultShouldCorrectedDays: settings.defaultShouldCorrectedDays,
    rectificationSyncIntervalMs: settings.rectificationSyncIntervalMs,
    rectificationSyncRetryCount: settings.rectificationSyncRetryCount,
    rectificationSyncTimeoutMs: settings.rectificationSyncTimeoutMs,
    rectificationSyncBatchSize: settings.rectificationSyncBatchSize
  };
}
