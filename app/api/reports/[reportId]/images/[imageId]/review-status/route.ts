import { NextResponse } from "next/server";

import { buildRequestContext, getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { createReportReviewService } from "@/backend/report/report.module";
import type { ResultReviewState } from "@/backend/report/report.types";

const reviewService = createReportReviewService();

async function readPayload(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(json).map(([key, value]) => [key, typeof value === "string" ? value : ""])
    );
  }
  const formData = await request.formData().catch(() => new FormData());
  return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string; imageId: string }> }
): Promise<Response> {
  const currentUser = getSessionUserFromRequest(request);
  if (!hasPermission(currentUser, "review:write")) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const reportId = Number(params.reportId);
  const imageId = Number(params.imageId);
  if (!Number.isInteger(reportId) || reportId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
    return Response.json({ success: false, error: "Invalid report id or image id." }, { status: 400 });
  }

  const payload = await readPayload(request);
  const reviewStatus = String(payload.review_status || "").trim();
  const normalizedReviewStatus: ResultReviewState =
    reviewStatus === "completed" || reviewStatus === "reviewed" ? "completed" : "pending";
  if (!["pending", "completed", "pending_review", "reviewed"].includes(reviewStatus)) {
    return Response.json({ success: false, error: "Invalid review status." }, { status: 400 });
  }
  const operatorName = currentUser?.displayName || String(payload.operator_name || "report-system").trim() || "report-system";
  const note = String(payload.note || "").trim();

  const result = reviewService.updateImageReviewStatus(
    reportId,
    imageId,
    normalizedReviewStatus,
    operatorName,
    note,
    buildRequestContext(currentUser)
  );
  if (!result) {
    return Response.json({ success: false, error: "Review target not found." }, { status: 404 });
  }

  const returnTo = String(payload.return_to || "").trim();
  const redirectUrl = new URL(
    returnTo && returnTo.startsWith("/") ? returnTo : `/reports/${reportId}#image-${imageId}`,
    request.url
  );
  const isJsonRequest = (request.headers.get("content-type") || "").includes("application/json");
  if (!isJsonRequest) {
    return NextResponse.redirect(redirectUrl, 303);
  }

  return Response.json({
    success: true,
    report_id: result.report_id,
    result_id: result.result_id,
    from_status: result.from_status,
    to_status: result.to_status,
    changed: result.changed,
    progress_state: result.progress_state,
    completed_result_count: result.completed_result_count,
    total_result_count: result.total_result_count,
    recent_log: result.recent_log,
    updated_at: result.updated_at
  });
}
