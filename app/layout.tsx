import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";

import "./globals.css";

import { ensureAnalyticsJobManagerStarted } from "@/backend/analytics/jobs/analytics-job.manager";
import { getReportSystemConfig } from "@/backend/config/report-system-config";
import { ensureRectificationSyncManagerStarted } from "@/backend/rectification/rectification-sync.manager";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import { BrandingProvider } from "@/ui/shared/branding-provider";

const siteConfig = getReportSystemConfig();
const systemSettingsService = createSystemSettingsService();

export const dynamic = "force-dynamic";

function toBrandSoft(hexColor: string): string {
  const normalized = hexColor.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return "rgba(24, 24, 27, 0.08)";
  }
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.14)`;
}

function appendAssetVersion(url: string, version: string): string {
  const trimmedUrl = url.trim();
  const trimmedVersion = version.trim();
  if (!trimmedUrl || !trimmedVersion) {
    return trimmedUrl;
  }

  try {
    const resolved = new URL(trimmedUrl, siteConfig.baseUrl);
    resolved.searchParams.set("v", trimmedVersion);
    if (/^https?:\/\//i.test(trimmedUrl)) {
      return resolved.toString();
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    const separator = trimmedUrl.includes("?") ? "&" : "?";
    return `${trimmedUrl}${separator}v=${encodeURIComponent(trimmedVersion)}`;
  }
}

export function generateMetadata(): Metadata {
  const branding = systemSettingsService.getEnterpriseBrandingSettings();
  const title = branding.enterpriseName || siteConfig.brandName;
  const description = `${branding.enterpriseName || siteConfig.tenantName} 在线报告系统`;
  const favicon = appendAssetVersion(branding.faviconUrl || siteConfig.logoUrl || "", branding.updatedAt);

  return {
    title,
    description,
    icons: favicon
      ? {
          icon: favicon,
          apple: favicon
        }
      : undefined
  };
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  ensureRectificationSyncManagerStarted();
  ensureAnalyticsJobManagerStarted();
  const branding = systemSettingsService.getEnterpriseBrandingSettings();
  const primaryColor = branding.primaryColor || siteConfig.primaryColor;
  const primaryColorStrong = branding.primaryColorStrong || siteConfig.primaryColorStrong;

  return (
    <html lang="zh-CN">
      <body
        style={
          {
            "--brand": primaryColor,
            "--brand-strong": primaryColorStrong,
            "--brand-soft": toBrandSoft(primaryColor)
          } as CSSProperties
        }
      >
        <BrandingProvider
          value={{
            enterpriseName: branding.enterpriseName || siteConfig.tenantName,
            logoUrl: branding.logoUrl || siteConfig.logoUrl
          }}
        >
          {children}
        </BrandingProvider>
      </body>
    </html>
  );
}
