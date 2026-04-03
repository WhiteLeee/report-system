import { notFound } from "next/navigation";

import { buildRequestContext, requirePermission } from "@/backend/auth/session";
import { createReportService } from "@/backend/report/report.module";
import type { ReviewFilterState } from "@/backend/report/report.types";
import { DETAIL_PAGE_SIZE_OPTIONS, type DetailFilters } from "@/ui/report-detail-helpers";
import type { ReportResultSemanticState } from "@/ui/report-result-semantics";
import { ReportDetailView } from "@/ui/report-detail-view";

export const dynamic = "force-dynamic";

const reportService = createReportService();

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

export default async function ReportDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requirePermission("report:read");
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const reportId = Number(resolvedParams.reportId);

  if (!Number.isInteger(reportId) || reportId <= 0) {
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
  const showCollaboration = typeof resolvedSearchParams.collaboration === "string" && resolvedSearchParams.collaboration === "1";

  return <ReportDetailView currentUser={currentUser} filters={filters} report={report} showCollaboration={showCollaboration} />;
}
