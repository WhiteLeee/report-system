import { notFound } from "next/navigation";

import { buildRequestContext, requirePermission } from "@/backend/auth/session";
import { createRectificationService } from "@/backend/rectification/rectification.module";
import { createReportService } from "@/backend/report/report.module";
import type { ReviewFilterState } from "@/backend/report/report.types";
import { createSystemSettingsService } from "@/backend/system-settings/system-settings.module";
import { DETAIL_PAGE_SIZE_OPTIONS, type DetailFilters } from "@/ui/report/report-detail-helpers";
import type { ReportImageMode } from "@/ui/report/report-detail-helpers";
import type { ReportResultSemanticState } from "@/ui/report/report-result-semantics";
import { ReportResultDetailView } from "@/ui/report/report-result-detail-view";

export const dynamic = "force-dynamic";

const reportService = createReportService();
const rectificationService = createRectificationService();
const systemSettingsService = createSystemSettingsService();

function normalizeReviewStatus(value: string): ReviewFilterState {
  return value === "pending" || value === "in_progress" || value === "completed" ? value : "";
}

function normalizePage(value: string | string[] | undefined): number {
  const page = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizeSemanticState(value: string): ReportResultSemanticState | "" {
  return value === "issue_found" || value === "pass" || value === "inconclusive" || value === "inspection_failed"
    ? value
    : "";
}

function normalizePageSize(value: string | string[] | undefined): DetailFilters["pageSize"] {
  const pageSize = typeof value === "string" ? Number(value) : NaN;
  return DETAIL_PAGE_SIZE_OPTIONS.includes(pageSize as DetailFilters["pageSize"]) ? (pageSize as DetailFilters["pageSize"]) : 30;
}

function normalizeImageMode(value: string | string[] | undefined): ReportImageMode {
  return value === "original" ? "original" : "evidence";
}

function normalizeImageFallback(value: string | string[] | undefined): "load_failed" | "" {
  return value === "load_failed" ? "load_failed" : "";
}

export default async function ReportResultDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ reportId: string; resultId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("report:read");
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const reportId = Number(resolvedParams.reportId);
  const resultId = Number(resolvedParams.resultId);

  if (!Number.isInteger(reportId) || reportId <= 0 || !Number.isInteger(resultId) || resultId <= 0) {
    notFound();
  }

  const report = reportService.getReportDetail(reportId, buildRequestContext(currentUser));

  if (!report) {
    notFound();
  }

  const filters: DetailFilters = {
    organization: typeof resolvedSearchParams.organization === "string" ? resolvedSearchParams.organization : "",
    storeId: typeof resolvedSearchParams.storeId === "string" ? resolvedSearchParams.storeId : "",
    reviewStatus: normalizeReviewStatus(
      typeof resolvedSearchParams.reviewStatus === "string" ? resolvedSearchParams.reviewStatus : ""
    ),
    semanticState: normalizeSemanticState(
      typeof resolvedSearchParams.semanticState === "string" ? resolvedSearchParams.semanticState : ""
    ),
    page: normalizePage(resolvedSearchParams.page),
    pageSize: normalizePageSize(resolvedSearchParams.pageSize)
  };
  const activeInspectionId =
    typeof resolvedSearchParams.inspection === "string" ? resolvedSearchParams.inspection : "";
  const activePanel = typeof resolvedSearchParams.panel === "string" ? resolvedSearchParams.panel : "";
  const imageMode = normalizeImageMode(resolvedSearchParams.imageMode);
  const imageFallback = normalizeImageFallback(resolvedSearchParams.imageFallback);
  const failedInspectionId = typeof resolvedSearchParams.failedInspectionId === "string" ? resolvedSearchParams.failedInspectionId : "";
  const previewImage = typeof resolvedSearchParams.preview === "string" && resolvedSearchParams.preview === "1";
  const rectificationOrders = await rectificationService.syncOrdersByResultId(resultId);
  const huiYunYingApiSettings = systemSettingsService.getHuiYunYingApiSettings();

  return (
    <ReportResultDetailView
      activeInspectionId={activeInspectionId}
      activePanel={activePanel}
      currentUser={currentUser}
      defaultShouldCorrectedDays={huiYunYingApiSettings.defaultShouldCorrectedDays}
      filters={filters}
      failedInspectionId={failedInspectionId}
      imageFallback={imageFallback}
      imageMode={imageMode}
      maxRectificationDescriptionLength={huiYunYingApiSettings.rectificationDescriptionMaxLength}
      previewImage={previewImage}
      rectificationOrders={rectificationOrders}
      report={report}
      resultId={resultId}
    />
  );
}
