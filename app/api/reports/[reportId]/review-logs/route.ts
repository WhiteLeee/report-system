import { buildRequestContext, getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { createReportReviewService } from "@/backend/report/report.module";

const reviewService = createReportReviewService();

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
    return Response.json({ success: false, error: "Invalid report id." }, { status: 400 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "20");
  const imageId = Number(url.searchParams.get("imageId") || "0");
  const logs = reviewService.listRecentReviewLogs(reportId, limit, imageId, buildRequestContext(currentUser));

  return Response.json({
    success: true,
    count: logs.length,
    logs
  });
}
