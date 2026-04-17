import { NextResponse } from "next/server";

import { buildRequestContext, getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { createReportService, createReportReviewService } from "@/backend/report/report.module";
import { classifyReportResultSemantics, type ReportResultSemanticState } from "@/backend/report/result-semantics";
import { RectificationSplitError } from "@/backend/rectification/rectification.service";
import { createRectificationService } from "@/backend/rectification/rectification.module";
import { buildRequestUrl } from "@/backend/http/request-url";
import type { ResultReviewState, ReviewSelectedIssue } from "@/backend/report/report.types";

const reviewService = createReportReviewService();
const reportService = createReportService();
const rectificationService = createRectificationService();

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

function parseSelectedIssues(raw: string): ReviewSelectedIssue[] {
  if (!raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const id = Number((item as { id?: unknown }).id);
        const title = String((item as { title?: unknown }).title || "").trim();
        if (!Number.isInteger(id) || id <= 0 || !title) {
          return null;
        }
        return { id, title };
      })
      .filter((item): item is ReviewSelectedIssue => Boolean(item));
  } catch {
    return [];
  }
}

function readMetadataString(metadata: unknown, key: string): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
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
  const selectedIssues = parseSelectedIssues(String(payload.selected_issues_json || ""));
  const shouldCorrected = String(payload.should_corrected || "").trim();
  const requestedSemanticState = String(payload.result_semantic_state || "").trim();
  const requestContext = buildRequestContext(currentUser);
  let resolvedSemanticState: ReportResultSemanticState | null = null;

  let createdRectificationOrders: Array<{ id: number; huiyunying_order_id: string | null; status: string }> = [];

  if (normalizedReviewStatus === "completed") {
    const report = reportService.getReportDetail(reportId, requestContext);
    const resultDetail = report?.results.find((result) => result.id === imageId) ?? null;
    if (!report || !resultDetail) {
      return Response.json({ success: false, error: "Review target not found." }, { status: 404 });
    }

    const resultIssues = report.issues.filter((issue) => {
      if (issue.result_id && issue.result_id === imageId) {
        return true;
      }
      return readMetadataString(issue.metadata, "capture_id") === readMetadataString(resultDetail.metadata, "capture_id");
    });
    const resultInspections = report.inspections.filter((inspection) => {
      if (inspection.result_id && inspection.result_id === imageId) {
        return true;
      }
      return readMetadataString(inspection.metadata, "capture_id") === readMetadataString(resultDetail.metadata, "capture_id");
    });
    const semanticState: ReportResultSemanticState = classifyReportResultSemantics(resultIssues, resultInspections);
    resolvedSemanticState = semanticState;
    const shouldCreateRectification = semanticState === "issue_found" || resultIssues.length > 0;
    const semanticMismatch = requestedSemanticState && requestedSemanticState !== semanticState;
    if (semanticMismatch) {
      return Response.json(
        { success: false, error: "当前巡检结果状态已变化，请刷新页面后重试。" },
        { status: 409 }
      );
    }
    if (shouldCreateRectification && !shouldCorrected) {
      return Response.json({ success: false, error: "整改截止日期不能为空。" }, { status: 400 });
    }

    const store = report.stores.find((item) => item.store_id === resultDetail.store_id) ?? null;
    const storeCode =
      readMetadataString(resultDetail.metadata, "store_code") ||
      readMetadataString(store?.metadata, "store_code") ||
      "";
    const imageUrl = readMetadataString(resultDetail.metadata, "display_url") || resultDetail.url;

    if (shouldCreateRectification) {
      try {
        createdRectificationOrders = (
          await rectificationService.createOrdersForReview({
            reportId,
            resultId: imageId,
            storeId: resultDetail.store_id,
            storeCode,
            storeName: resultDetail.store_name,
            imageUrls: imageUrl ? [imageUrl] : [],
            selectedIssues,
            shouldCorrected,
            note,
            createdBy: operatorName,
            context: requestContext
          })
        ).map((order) => ({
          id: order.id,
          huiyunying_order_id: order.huiyunying_order_id,
          status: order.status
        }));
      } catch (error) {
        if (error instanceof RectificationSplitError) {
          return Response.json({ success: false, error: error.message }, { status: 400 });
        }
        return Response.json(
          {
            success: false,
            error: "创建慧运营整改单失败。",
            detail: error instanceof Error ? error.message : "Unknown error"
          },
          { status: 502 }
        );
      }
    }
  }

  const result = reviewService.updateImageReviewStatus(
    reportId,
    imageId,
    normalizedReviewStatus,
    operatorName,
    note,
    requestContext,
    selectedIssues
  );
  if (!result) {
    return Response.json({ success: false, error: "Review target not found." }, { status: 404 });
  }

  const returnTo = String(payload.return_to || "").trim();
  const redirectUrl = buildRequestUrl(
    request,
    returnTo && returnTo.startsWith("/") ? returnTo : `/reports/${reportId}#image-${imageId}`
  );

  if (result.recent_log?.id && createdRectificationOrders.length > 0) {
    rectificationService.attachReviewLog(
      createdRectificationOrders.map((order) => order.id),
      result.recent_log.id
    );
  }

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
    should_corrected: shouldCorrected || null,
    result_semantic_state: resolvedSemanticState,
    selected_issues: selectedIssues,
    rectification_orders: createdRectificationOrders,
    recent_log: result.recent_log,
    updated_at: result.updated_at
  });
}
