import type { RequestContext } from "@/backend/auth/request-context";
import type {
  PublishReceipt,
  PublishStatusReceipt,
  CreateManualReportIssueInput,
  ReportDetail,
  ReportFilters,
  ReportIssue,
  ReportPublishPayload,
  ReportReviewLog,
  ReportSummary,
  ReviewSelectedIssue,
  ReviewStatusUpdateInput,
  ReviewResultUpdateResult,
  ResultReviewState
} from "@/backend/report/report.types";

export interface ReportRepository {
  publishReport(payload: ReportPublishPayload, context?: RequestContext): PublishReceipt;
  getPublishStatus(publishId: string, context?: RequestContext): PublishStatusReceipt;
  listReports(filters?: ReportFilters, context?: RequestContext): ReportSummary[];
  getReportDetail(reportId: number, context?: RequestContext): ReportDetail | null;
  updateImageReviewStatus(
    reportId: number,
    imageId: number,
    input: ReviewStatusUpdateInput,
    context?: RequestContext
  ): ReviewResultUpdateResult | null;
  createManualIssue(input: CreateManualReportIssueInput, context?: RequestContext): ReportIssue | null;
  listReviewLogs(
    reportId: number,
    limit?: number,
    imageId?: number,
    context?: RequestContext
  ): ReportReviewLog[];
}
