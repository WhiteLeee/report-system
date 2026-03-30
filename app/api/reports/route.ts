import { NextRequest } from "next/server";

import { buildRequestContext, getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { createReportService } from "@/backend/report/report.module";
import type { ReportFilters } from "@/backend/report/report.types";

export const dynamic = "force-dynamic";

const reportService = createReportService();

export async function GET(request: NextRequest): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "report:read")) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;

  const filters: ReportFilters = {
    enterprise: searchParams.get("enterprise") ?? "",
    publishId: searchParams.get("publishId") ?? "",
    reportType: searchParams.get("reportType") ?? "",
    reviewStatus: (searchParams.get("reviewStatus") as ReportFilters["reviewStatus"]) ?? "",
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? ""
  };

  const reports = reportService.listReports(filters, buildRequestContext(currentUser));

  return Response.json({
    success: true,
    count: reports.length,
    reports
  });
}
