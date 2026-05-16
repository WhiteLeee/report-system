import { NextResponse } from "next/server";

import { buildRequestContext, getSessionUserFromRequest, hasPermission } from "@/backend/auth/session";
import { createReportService, createReportReviewService } from "@/backend/report/report.module";
import { classifyReportResultSemantics, type ReportResultSemanticState } from "@/backend/report/result-semantics";
import { RectificationSplitError } from "@/backend/rectification/rectification.service";
import { createRectificationService } from "@/backend/rectification/rectification.module";
import { buildRequestUrl } from "@/backend/http/request-url";
import type { ResultReviewState, ReviewSelectedIssue, ReviewAction, ReviewDisposition } from "@/backend/report/report.types";
import type { RectificationIssueSelection } from "@/lib/rectification-preview";

const reviewService = createReportReviewService();
const reportService = createReportService();
const rectificationService = createRectificationService();

async function readPayload(request: Request): Promise<any> {
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

function parseSelectedIssues(raw: string): any {
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
      .filter((item): any => Boolean(item));
  } catch {
    return [];
  }
}

function normalizeReviewAction(value: string, reviewStatus: ResultReviewState): any {
  if (reviewStatus !== "completed") {
    return "reopen";
  }
  return value === "create_rectification" ? "create_rectification" : "complete_only";
}

function normalizeReviewDisposition(value: string): any {
  if (
    value === "rectification_required" ||
    value === "no_rectification" ||
    value === "offline_handled" ||
    value === "false_positive" ||
    value === "other"
  ) {
    return value;
  }
  return "";
}

function isAutoCompletedReviewPayload(value: unknown): any {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).auto_completed === true);
}

function readMetadataString(metadata: unknown, key: string): any {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function readMetadataBoolean(metadata: unknown, key: string): any {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as Record<string, unknown>)[key] === true;
}

function issueMatchesInspection(
  issue: { metadata: unknown },
  inspection: { inspection_id: string; skill_id: string; skill_name: string | null }
): any {
  const issueInspectionId = readMetadataString(issue.metadata, "inspection_id");
  const issueSkillId = readMetadataString(issue.metadata, "skill_id");
  const issueSkillName = readMetadataString(issue.metadata, "skill_name");
  if (issueInspectionId && issueInspectionId === inspection.inspection_id) {
    return true;
  }
  if (issueSkillId && issueSkillId === inspection.skill_id) {
    return true;
  }
  return Boolean(inspection.skill_name && issueSkillName && issueSkillName === inspection.skill_name);
}

function normalizeImageUrls(values: unknown[]): any {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((url) => url && url !== "about:blank")
    )
  );
}

function isDeprecatedManualUploadUrl(url: string): any {
  return url.trim().startsWith("/uploads/report-issues/");
}

function issueUsesInspection(issue: { metadata: unknown }, inspectionId: string): any {
  if (!inspectionId) {
    return false;
  }
  return readMetadataString(issue.metadata, "inspection_id") === inspectionId ||
    readMetadataString(issue.metadata, "linked_inspection_id") === inspectionId;
}

function buildIssueRectificationImageUrls(input: {
  issue: { image_url: string | null; metadata: unknown };
  linkedInspection: { metadata: unknown } | null;
  resultDetail: { metadata: unknown; url: string };
  failedInspectionIds: Set<string>;
}): any {
  const isManualIssue = readMetadataBoolean(input.issue.metadata, "manual_issue") ||
    readMetadataString(input.issue.metadata, "source") === "manual_review";
  const useOriginalFallback = Array.from(input.failedInspectionIds).some((inspectionId) =>
    issueUsesInspection(input.issue, inspectionId)
  );
  const resultOriginalUrls = [
    readMetadataString(input.resultDetail.metadata, "capture_url"),
    readMetadataString(input.resultDetail.metadata, "preview_url"),
    input.resultDetail.url
  ];
  const originalUrls = normalizeImageUrls([
    readMetadataString(input.issue.metadata, "original_image_url"),
    readMetadataString(input.linkedInspection?.metadata, "original_image_url"),
    ...resultOriginalUrls
  ]);
  if (useOriginalFallback) {
    return originalUrls.slice(0, 1);
  }
  if (isManualIssue) {
    return normalizeImageUrls([
      readMetadataString(input.resultDetail.metadata, "preview_url"),
      readMetadataString(input.resultDetail.metadata, "display_url"),
      input.resultDetail.url,
      readMetadataString(input.issue.metadata, "preview_url"),
      readMetadataString(input.issue.metadata, "original_image_url"),
      input.issue.image_url || "",
      readMetadataString(input.issue.metadata, "display_image_url"),
      readMetadataString(input.issue.metadata, "capture_url"),
      ...resultOriginalUrls
    ].filter((url) => typeof url !== "string" || !isDeprecatedManualUploadUrl(url))).slice(0, 1);
  }

  const evidenceUrls = normalizeImageUrls([
    readMetadataString(input.issue.metadata, "evidence_image_url"),
    readMetadataString(input.issue.metadata, "linked_inspection_evidence_image_url"),
    readMetadataString(input.linkedInspection?.metadata, "evidence_image_url")
  ]);
  return (evidenceUrls.length > 0 ? evidenceUrls : originalUrls).slice(0, 1);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string; imageId: string }> }
): Promise<any> {
  const currentUser = await getSessionUserFromRequest(request);
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
  const requestedReviewAction = String(payload.review_action || "").trim();
  let reviewAction = normalizeReviewAction(requestedReviewAction, normalizedReviewStatus);
  let reviewDisposition = normalizeReviewDisposition(String(payload.review_disposition || "").trim());
  const failedInspectionId = String(payload.failed_inspection_id || "").trim();
  const requestedSemanticState = String(payload.result_semantic_state || "").trim();
  const requestContext = buildRequestContext(currentUser);
  let resolvedSemanticState: ReportResultSemanticState | null = null;
  let effectiveSelectedIssues = selectedIssues;
  let rectificationPartialFailed = false;

  let createdRectificationOrders: Array<{ id: number; huiyunying_order_id: string | null; status: string }> = [];

  const report = await reportService.getReportResultDetail(reportId, imageId, requestContext);
  const resultDetail = report?.results.find((result) => result.id === imageId) ?? null;
  if (!report || !resultDetail) {
    return Response.json({ success: false, error: "Review target not found." }, { status: 404 });
  }
  if (resultDetail.review_state === "completed" && !isAutoCompletedReviewPayload(resultDetail.review_payload)) {
    return Response.json(
      { success: false, error: "当前巡检结果已完成复核，不能再次修改复核状态或处理方式。" },
      { status: 409 }
    );
  }

  if (normalizedReviewStatus === "completed") {
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
    const resultHasIssue = semanticState === "issue_found" || resultIssues.length > 0;
    if (!requestedReviewAction) {
      reviewAction = resultHasIssue ? "create_rectification" : "complete_only";
    }
    if (reviewAction === "complete_only" && !reviewDisposition && !resultHasIssue) {
      reviewDisposition = "no_rectification";
    }
    const shouldCreateRectification = reviewAction === "create_rectification" && resultHasIssue;
    const selectedIssueIdSet = new Set(selectedIssues.map((issue) => issue.id));
    const selectedResultIssues = selectedIssueIdSet.size > 0
      ? resultIssues.filter((issue) => selectedIssueIdSet.has(issue.id))
      : [];
    if (selectedIssueIdSet.size > 0) {
      if (selectedResultIssues.length !== selectedIssueIdSet.size) {
        return Response.json(
          { success: false, error: "所选问题项不属于当前巡检结果，请刷新页面后重试。" },
          { status: 400 }
        );
      }
      effectiveSelectedIssues = selectedResultIssues.map((issue) => ({
        id: issue.id,
        title: issue.title
      }));
    }
    if (reviewAction === "create_rectification" && selectedIssueIdSet.size === 0) {
      return Response.json(
        { success: false, error: "请至少勾选一个问题项后再创建整改单。" },
        { status: 400 }
      );
    }
    if (reviewAction === "complete_only") {
      if (!reviewDisposition || reviewDisposition === "rectification_required") {
        return Response.json({ success: false, error: "请选择本次复核结论。" }, { status: 400 });
      }
      if (reviewDisposition === "other" && !note) {
        return Response.json({ success: false, error: "选择其他结论时请填写复核备注。" }, { status: 400 });
      }
    }
    const semanticMismatch = requestedSemanticState && requestedSemanticState !== semanticState;
    if (semanticMismatch) {
      return Response.json(
        { success: false, error: "当前巡检结果状态已变化，请刷新页面后重试。" },
        { status: 409 }
      );
    }
    if (reviewAction === "create_rectification" && !resultHasIssue) {
      return Response.json({ success: false, error: "当前结果没有可下发的问题项。" }, { status: 400 });
    }
    if (shouldCreateRectification && !shouldCorrected) {
      return Response.json({ success: false, error: "整改截止日期不能为空。" }, { status: 400 });
    }

    const store = report.stores.find((item) => item.store_id === resultDetail.store_id) ?? null;
    const storeCode =
      readMetadataString(resultDetail.metadata, "store_code") ||
      readMetadataString(store?.metadata, "store_code") ||
      "";
    const failedInspectionIds = new Set<string>();
    if (failedInspectionId) {
      failedInspectionIds.add(failedInspectionId);
    }
    const selectedIssuesForRectification: RectificationIssueSelection[] = selectedResultIssues.map((issue) => {
      const linkedInspection = resultInspections.find((inspection) => issueMatchesInspection(issue, inspection)) ?? null;
      return {
        id: issue.id,
        title: issue.title,
        imageUrls: buildIssueRectificationImageUrls({
          issue,
          linkedInspection,
          resultDetail,
          failedInspectionIds
        })
      };
    });
    const missingImageIssues = selectedIssuesForRectification.filter((issue) => (issue.imageUrls ?? []).length === 0);
    if (missingImageIssues.length > 0) {
      return Response.json(
        {
          success: false,
          error: `以下问题缺少可下发图片，请检查标注图或原图：${missingImageIssues.map((issue) => issue.title).join("、")}`
        },
        { status: 400 }
      );
    }
    const rectificationImageUrls = normalizeImageUrls(selectedIssuesForRectification.flatMap((issue) => issue.imageUrls ?? []));

    if (shouldCreateRectification) {
      try {
        createdRectificationOrders = (
          await rectificationService.createOrdersForReview({
            reportId,
            resultId: imageId,
            storeId: resultDetail.store_id,
            storeCode,
            storeName: resultDetail.store_name,
            imageUrls: rectificationImageUrls,
            selectedIssues: selectedIssuesForRectification,
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
        rectificationPartialFailed = createdRectificationOrders.some((order) => order.status === "sync_failed");
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

  const result = await reviewService.updateImageReviewStatus(
    reportId,
    imageId,
    normalizedReviewStatus,
    operatorName,
    note,
    requestContext,
    effectiveSelectedIssues,
    reviewAction,
    reviewAction === "create_rectification" ? "rectification_required" : reviewDisposition
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
    await rectificationService.attachReviewLog(
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
    review_action: reviewAction,
    review_disposition: reviewAction === "create_rectification" ? "rectification_required" : reviewDisposition,
    result_semantic_state: resolvedSemanticState,
    selected_issues: effectiveSelectedIssues,
    rectification_orders: createdRectificationOrders,
    rectification_partial_failed: rectificationPartialFailed,
    warning: rectificationPartialFailed
      ? "部分整改单创建失败，已保留成功和失败记录；请在整改单列表中核查失败项。"
      : null,
    recent_log: result.recent_log,
    updated_at: result.updated_at
  });
}
