import { buildRequestContext, getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { createReportService } from "@/backend/report/report.module";

export const dynamic = "force-dynamic";

const reportService = createReportService();

export async function GET(
  request: Request,
  context: { params: Promise<{ reportId: string }> }
): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "report:read")) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const reportId = Number(params.reportId);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return Response.json(
      {
        success: false,
        error: "Invalid report id."
      },
      { status: 400 }
    );
  }

  const report = reportService.getReportDetail(reportId, buildRequestContext(currentUser));

  if (!report) {
    return Response.json(
      {
        success: false,
        error: "Report not found."
      },
      { status: 404 }
    );
  }

  return Response.json({
    success: true,
    report
  });
}
