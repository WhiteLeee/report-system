import type { CSSProperties, ReactNode } from "react";

import "./globals.css";

import { getReportSystemConfig } from "@/backend/config/report-system-config";

const siteConfig = getReportSystemConfig();

export const metadata = {
  title: siteConfig.brandName,
  description: `${siteConfig.tenantName} 在线报告系统`
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body
        style={
          {
            "--brand": siteConfig.primaryColor,
            "--brand-strong": siteConfig.primaryColorStrong
          } as CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
